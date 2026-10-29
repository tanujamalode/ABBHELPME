// Runs supabase/setup.sql on an in-process Postgres (PGlite) with Supabase's auth/storage schemas stubbed,
// then checks the security rules as different signed-in users. Run it with: npm run test:db
// It proves the SQL is valid, re-runnable and enforces what the app relies on. It is not a substitute for
// trying the real project: PGlite is not Supabase.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import { fileURLToPath } from 'url';

const SETUP = fileURLToPath(new URL('../setup.sql', import.meta.url));
const db = new PGlite();

const stub = `
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, banned_until timestamptz, last_sign_in_at timestamptz, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema public, auth, storage to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
`;
await db.exec(stub);
const sql = fs.readFileSync(SETUP, 'utf8');
await db.exec(sql);
console.log('setup.sql ran OK');
await db.exec(sql); // idempotency
console.log('setup.sql re-run OK');

// ---- helpers
const users = {};
async function mkUser(name, email) {
  const r = await db.query(`insert into auth.users (email) values ($1) returning id`, [email]);
  users[name] = r.rows[0].id;
}
async function as(name, fn) {
  const claims = JSON.stringify({ sub: users[name], email: name + '@outlook.com', role: 'authenticated', is_anonymous: false });
  await db.exec(`select set_config('request.jwt.claims', '${claims}', false); select set_config('request.jwt.claim.sub', '${users[name]}', false); set role authenticated;`);
  try { return await fn(); } finally { await db.exec('reset role'); }
}
async function asAnon(fn) {
  await db.exec(`select set_config('request.jwt.claims', '', false); select set_config('request.jwt.claim.sub', '', false); set role anon;`);
  try { return await fn(); } finally { await db.exec('reset role'); }
}
async function expectFail(label, fn) {
  try { await fn(); console.log('FAIL (should have been blocked):', label); process.exitCode = 1; }
  catch (e) { console.log('ok  blocked:', label, '->', String(e.message).slice(0, 70)); }
}
let failures = 0;
function check(label, cond) { if (cond) console.log('ok  ', label); else { console.log('FAIL', label); failures++; process.exitCode = 1; } }
const q = (s, p) => db.query(s, p);

await mkUser('alice', 'alice@outlook.com');
await mkUser('bob', 'bob@outlook.com');
await mkUser('carol', 'carol@outlook.com');
await mkUser('dave', 'dave@gmail.com');
await db.query(`update auth.users set email = 'dave@gmail.com' where id = $1`, [users.dave]);

// profiles
for (const n of ['alice', 'bob', 'carol']) {
  await as(n, () => q(`insert into profiles (display_name, role, experience, topics, onboarding_complete, discoverable) values ($1, 'engineer', '3to5', array['mental','career'], true, true)`, [n[0].toUpperCase() + n.slice(1)]));
}
// non-allowed email domain cannot create a profile
await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: users.dave, email: 'dave@gmail.com', role: 'authenticated' })}', false); select set_config('request.jwt.claim.sub','${users.dave}',false); set role authenticated;`);
await expectFail('gmail member cannot create profile', () => q(`insert into profiles (display_name) values ('Dave')`));
await db.exec('reset role');
await asAnon(() => expectFail('anon cannot read posts_feed', () => q('select * from posts_feed')));
await asAnon(() => expectFail('anon cannot read posts', () => q('select * from posts')));

// posts: anonymity
let postId;
await as('alice', async () => {
  const r = await q(`insert into posts (kind, category, title, body, show_author) values ('work_question','IT','How to VPN','details here', false) returning id`);
  postId = r.rows[0].id;
});
await as('bob', async () => {
  const feed = await q('select * from posts_feed');
  check('bob sees alice post in feed', feed.rows.length === 1 && feed.rows[0].mine === false);
  check('feed has no user_id column', !('user_id' in feed.rows[0]));
  const base = await q('select * from posts');
  check('bob cannot read base posts table rows', base.rows.length === 0);
  await expectFail('bob cannot update alice post', async () => { const r = await q(`update posts set title='x' where id=$1 returning id`, [postId]); if (!r.rows.length) throw new Error('0 rows'); });
});
await as('alice', async () => { const f = await q('select mine from posts_feed'); check('alice sees own post as mine', f.rows[0].mine === true); });

// personal posts shared anonymously
await as('alice', () => q(`insert into posts (kind, category, title, body) values ('personal','Burnout','','feeling tired')`));
await as('bob', async () => { const f = await q(`select * from posts_feed where kind='personal'`); check('bob sees anonymous personal post', f.rows.length === 1 && f.rows[0].author_role === null); });

// comments, notifications, accept
let cid;
await as('bob', async () => { const r = await q(`insert into comments (post_id, body) values ($1,'try the gateway') returning id`, [postId]); cid = r.rows[0].id; });
await as('alice', async () => {
  const n = await q('select * from notifications'); check('alice notified of answer', n.rows.length === 1 && n.rows[0].kind === 'answer');
  await q(`update posts set accepted_comment_id = $1 where id = $2`, [cid, postId]);
  await expectFail('cannot accept a non-existent answer', () => q(`update posts set accepted_comment_id = 'c-nope' where id = $1`, [postId]));
});
await as('bob', async () => { const n = await q(`select * from notifications where kind='accepted'`); check('bob notified of accepted answer', n.rows.length === 1); });

// votes
await as('alice', () => expectFail('cannot vote on own post', () => q(`insert into votes (target_type, target_id, value) values ('post', $1, 1)`, [postId])));
await as('bob', async () => {
  await q(`insert into votes (target_type, target_id, value) values ('post', $1, 1)`, [postId]);
  const s = await q(`select * from vote_scores('post', array[$1])`, [postId]); check('score is 1', s.rows[0].score === 1);
  await expectFail('downvote needs reason', () => q(`insert into votes (target_type, target_id, value) values ('comment','x',-1)`));
});
await as('alice', async () => { const f = await q('select * from my_received_feedback()'); check('alice received 1 upvote', f.rows[0].upvotes === 1); });
await as('carol', async () => { const f = await q('select * from my_received_feedback()'); check('carol received nothing', f.rows[0].upvotes === 0); });

// reports hide content at 3
await as('bob', () => q(`insert into reports (post_id, reason) values ($1,'x')`, [postId]));
await as('carol', () => q(`insert into reports (post_id, reason) values ($1,'x')`, [postId]));
await as('carol', async () => { const f = await q('select id from posts_feed where id=$1', [postId]); check('post still visible after 2 reports', f.rows.length === 1); });
await db.query(`insert into auth.users (email) values ('erin@outlook.com')`);
const erin = (await q(`select id from auth.users where email='erin@outlook.com'`)).rows[0].id; users.erin = erin;
await as('erin', () => q(`insert into profiles (display_name) values ('Erin')`));
await as('erin', () => q(`insert into reports (post_id, reason) values ($1,'x')`, [postId]));
await as('carol', async () => { const f = await q('select id from posts_feed where id=$1', [postId]); check('post hidden after 3 reports', f.rows.length === 0); });
await as('alice', async () => { const f = await q('select id from posts_feed where id=$1', [postId]); check('author still sees own reported post', f.rows.length === 1); });

// polls
let pollId;
await as('alice', async () => {
  const r = await q(`select create_poll('Ideas & improvement','Best day?','Pick one', array['Mon','Tue','',' Wed'], false, null, null, 'ideas', '{}') as id`);
  pollId = r.rows[0].id;
  const res = await q('select * from poll_results($1)', [pollId]); check('author sees poll results with 3 options', res.rows.length === 3 && res.rows[0].revealed === true);
});
await as('alice', () => expectFail('poll needs 2+ options', () => q(`select create_poll('x','Title','b', array['only'], false, null, null, null, '{}')`)));
await as('bob', async () => {
  let res = await q('select * from poll_results($1)', [pollId]); check('non-voter sees hidden results', res.rows.every((r) => r.votes === 0 && r.revealed === false));
  await q(`insert into poll_votes (post_id, option_id) values ($1, $2)`, [pollId, res.rows[0].option_id]);
  res = await q('select * from poll_results($1)', [pollId]); check('voter sees results', res.rows[0].votes === 1 && res.rows[0].mine === true);
  const other = await q(`insert into posts (kind, category, title, body) values ('discussion','x','Other post','body text') returning id`);
  await expectFail('cannot vote with option from another post', () => q(`insert into poll_votes (post_id, option_id) values ($1, $2)`, [other.rows[0].id, res.rows[1].option_id]));
});

// communities
await as('bob', async () => {
  const o = await q('select * from community_overview()'); check('7 communities', o.rows.length === 7);
  await q(`insert into community_members (community_id) values ('ideas')`);
  const o2 = await q(`select * from community_overview() where id='ideas'`); check('following + member count', o2.rows[0].following === true && o2.rows[0].members === 1 && o2.rows[0].posts_7d === 1);
});

// chat
let convId, bobCode;
await as('alice', async () => {
  const d = await q('select * from discover_people(10)'); check('alice discovers 3 others (bob, carol, erin excluded: not discoverable)', d.rows.length === 2);
  check('discovery exposes no account ids', !('id' in d.rows[0]) && !('user_id' in d.rows[0]));
  check('role match scores higher', d.rows[0].score >= 3);
  bobCode = d.rows[0].code;
  const r = await q(`select request_chat($1, 'Hi, I also work in IT and feel stretched. Want to talk?', false) as id`, [bobCode]); convId = r.rows[0].id;
});
await as('alice', () => expectFail('cannot read conversations table', () => q('select * from conversations')));
await as('alice', () => expectFail('cannot insert messages directly', () => q(`insert into messages (conversation_id, sender, body) values ('${convId}', '${users.alice}', 'x')`)));
// which of the two discovered was bob? find by conversation
const convRow = (await q('select user_b from conversations where id=$1', [convId])).rows[0];
const recipient = Object.keys(users).find((k) => users[k] === convRow.user_b);
console.log('   recipient is', recipient);
await as(recipient, async () => {
  const c = await q('select * from my_conversations'); check('recipient sees pending request', c.rows.length === 1 && c.rows[0].status === 'pending' && c.rows[0].i_requested === false);
  check('requester identity hidden (alias, no name/role)', c.rows[0].other_alias && c.rows[0].other_name === null && c.rows[0].other_role === null);
  const u = await q('select chat_unread() as n'); check('unread counts the request', u.rows[0].n === 1);
  await expectFail('cannot message before accepting', () => q(`select send_message($1,'hello')`, [convId]));
  await q('select respond_chat($1, true, true)', [convId]);
  await q(`select send_message($1,'Sure, happy to chat.')`, [convId]);
});
await as('alice', async () => {
  const c = await q('select * from my_conversations'); check('requester sees other role (shared on accept) but no name', c.rows[0].other_role === 'engineer' && c.rows[0].other_name === null);
  const m = await q('select * from my_messages where conversation_id=$1 order by created_at', [convId]); check('both messages visible with mine flags', m.rows.length === 2 && m.rows[0].mine === true && m.rows[1].mine === false);
  check('unread = 1', c.rows[0].unread === 1);
  await q('select mark_chat_read($1)', [convId]);
  const c2 = await q('select unread from my_conversations'); check('read clears unread', c2.rows[0].unread === 0);
  await q(`select set_chat_flag($1, 'reveal', true)`, [convId]);
});
await as(recipient, async () => {
  const c = await q('select * from my_conversations'); check('recipient sees revealed name after reveal', c.rows[0].other_name === 'Alice');
  await q('select block_user($1)', [convId]);
  const after = await q('select * from my_conversations'); check('blocker no longer lists the conversation', after.rows.length === 0);
});
await as('alice', async () => {
  await expectFail('blocked: cannot send', () => q(`select send_message($1,'hello?')`, [convId]));
  const d = await q('select * from discover_people(10)'); check('blocked person not rediscovered', !d.rows.some((r) => r.code === bobCode && recipient === 'bob'));
});
// strangers cannot see anything
await as('erin', async () => { const m = await q('select * from my_messages'); const c = await q('select * from my_conversations'); check('outsider sees no chat data', m.rows.length === 0 && c.rows.length === 0); });

// shout-outs
await as('bob', async () => {
  await q(`select give_shoutout('carol@outlook.com', 'teamwork', 'Thanks for the help on the release', false)`);
  await q(`select give_shoutout('nobody@outlook.com', 'kind', 'hello there', false)`);
});
await as('carol', async () => {
  const s = await q('select * from my_shoutouts'); check('carol received 1 shout-out with sender name', s.rows.length === 1 && s.rows[0].from_name === 'Bob');
  const wall0 = await q('select * from shoutout_wall'); check('not on wall until shared', wall0.rows.length === 0);
  await q('select share_shoutout($1, true)', [s.rows[0].id]);
  const n = await q(`select * from notifications where kind='shoutout'`); check('shout-out notification', n.rows.length === 1);
});
await as('alice', async () => { const w = await q('select * from shoutout_wall'); check('wall shows shared shout-out', w.rows.length === 1 && w.rows[0].to_name === 'Carol'); const mine = await q('select * from my_shoutouts'); check('alice sees none of carols', mine.rows.length === 0); });
await as('alice', () => expectFail('cannot read shoutouts table', () => q('select * from shoutouts')));

// feedback
await as('alice', async () => {
  for (let i = 0; i < 3; i++) await q(`select submit_feedback('workplace', 'noisy open office ${i}')`);
  await expectFail('4th feedback in a day blocked', () => q(`select submit_feedback('workplace', 'again')`));
  await expectFail('cannot read feedback table', () => q('select * from feedback'));
  await expectFail('cannot read throttle', () => q('select * from feedback_throttle'));
});
await as('bob', async () => { const r = await q('select * from feedback_report()'); check('report shows category with >=3', r.rows.length === 1 && r.rows[0].n === 3); });
const cols = (await q(`select column_name from information_schema.columns where table_name='feedback'`)).rows.map((r) => r.column_name);
check('feedback rows hold no account id', !cols.some((c) => /user|author|uid/.test(c)));

// pulse k-anonymity
for (const n of ['alice', 'bob', 'carol', 'erin']) await as(n, () => q(`insert into mood_checkins (mood, tags) values ('okay', array['workload'])`));
await as('alice', async () => { const p = await q('select * from org_pulse(30)'); check('pulse hidden with <5 people', p.rows.length === 0); });
await db.query(`insert into auth.users (email) values ('fay@outlook.com')`);
users.fay = (await q(`select id from auth.users where email='fay@outlook.com'`)).rows[0].id;
await as('fay', () => q(`insert into profiles (display_name) values ('Fay')`));
await as('fay', () => q(`insert into mood_checkins (mood, tags) values ('great', array['team'])`));
await as('alice', async () => { const p = await q('select * from org_pulse(30)'); check('pulse visible with 5 people', p.rows.length === 2); const f = await q('select * from org_pulse_factors(30)'); check('factors aggregated', f.rows.length === 2); });
await as('alice', async () => { const m = await q('select * from mood_checkins'); check('mood only own rows', m.rows.length === 1); });

// storage policy sanity
const pol = await q(`select policyname from pg_policies where tablename='objects' and schemaname='storage'`);
check('storage policies created (app + staff)', pol.rows.length === 5);


// ---- admin console ------------------------------------------------------------------------
async function asEmail(id, email, fn) {
  const claims = JSON.stringify({ sub: id, email, role: 'authenticated', is_anonymous: false });
  await db.exec(`select set_config('request.jwt.claims', '${claims}', false); select set_config('request.jwt.claim.sub', '${id}', false); set role authenticated;`);
  try { return await fn(); } finally { await db.exec('reset role'); }
}
const adminId = (await q(`insert into auth.users (email) values ('admin@abbhelpme.app') returning id`)).rows[0].id;
const viewerId = (await q(`insert into auth.users (email) values ('viewer@abbhelpme.app') returning id`)).rows[0].id;
await q(`insert into public.staff (user_id, role) values ($1, 'admin'), ($2, 'viewer')`, [adminId, viewerId]);
const asAdmin = (fn) => asEmail(adminId, 'admin@abbhelpme.app', fn);
const asViewer = (fn) => asEmail(viewerId, 'viewer@abbhelpme.app', fn);

await as('bob', () => expectFail('member cannot open the admin overview', () => q('select public.admin_overview()')));
await as('bob', () => expectFail('member cannot list users', () => q('select * from public.admin_users()')));
await asAnon(() => expectFail('anon cannot call admin functions', () => q('select public.admin_overview()')));
await asViewer(async () => {
  check('viewer role is viewer', (await q('select public.my_staff_role() r')).rows[0].r === 'viewer');
  const o = (await q('select public.admin_overview() o')).rows[0].o;
  check('overview counts users', o.users >= 4 && o.reported_posts >= 1);
  const users = await q(`select * from public.admin_users('', 50, 0)`);
  check('viewer sees user list with emails', users.rows.some((u) => u.email === 'bob@outlook.com') && Number(users.rows[0].total) === users.rows.length);
  const w = (await q('select public.admin_wellbeing(90) w')).rows[0].w;
  check('wellbeing is aggregated (5+ people) and holds no ids', w.suppressed === false && w.people >= 5 && !JSON.stringify(w).match(/[0-9a-f]{8}-[0-9a-f]{4}-/));
  const act = await q('select * from public.admin_activity(14)');
  check('activity series has one row per day', act.rows.length === 14);
  const posts = await q(`select * from public.admin_posts('', '', false, 50, 0)`);
  check('posts list has no author ids', posts.rows.length > 0 && !('user_id' in posts.rows[0]));
  const rep = await q('select * from public.admin_reports()');
  check('report queue lists the reported post', rep.rows.some((r) => r.reports >= 3 && r.hidden));
  await expectFail('viewer cannot delete a post', () => q(`select public.admin_delete_post($1, 'x')`, [rep.rows[0].post_id]));
  await expectFail('viewer cannot suspend', () => q(`select public.admin_set_suspended($1, true, 'x')`, [users.rows[0].id]));
  await expectFail('viewer cannot write the audit log', () => q(`select public.log_admin('x', 'x', 'x', '{}')`));
  await expectFail('viewer cannot read staff table', () => q('select * from public.staff'));
});
await asViewer(async () => {
  const fb = await q(`select * from public.admin_feedback(current_date)`);
  check('viewer reads anonymous feedback text', fb.rows.length === 3 && !('user_id' in fb.rows[0]));
});
// ids looked up as the database owner (staff cannot read the tables directly, by design)
const discussionId = (await q(`select id from public.posts where kind = 'discussion' limit 1`)).rows[0].id;
const anyComment = (await q('select id from public.comments limit 1')).rows[0];
await asAdmin(async () => {
  const p = discussionId;
  const who = await q(`select * from public.admin_reveal_author('post', $1, 'reported abuse')`, [p]);
  check('admin can reveal an author', who.rows[0].email === 'bob@outlook.com');
  const audit = await q('select * from public.admin_audit_log(10)');
  check('reveal is audited', audit.rows.some((a) => a.action === 'reveal_author' && a.actor_email === 'admin@abbhelpme.app'));

  await q(`select public.admin_set_suspended($1, true, 'spam')`, [users.bob]);
});
await as('bob', async () => {
  check('suspended member is no longer a member', (await q('select public.is_member() m')).rows[0].m === false);
  check('suspended member sees no posts', (await q('select * from posts_feed')).rows.length === 0);
});
check('suspension bans sign-in', (await q('select banned_until is not null b from auth.users where id = $1', [users.bob])).rows[0].b);
await asAdmin(() => q(`select public.admin_set_suspended($1, false, 'appeal')`, [users.bob]));
await as('bob', async () => { check('unsuspended member is back', (await q('select public.is_member() m')).rows[0].m === true); });
let files;
await asAdmin(async () => {
  await q(`select public.admin_update_user($1, 'Robert', 'manager', '10plus')`, [users.bob]);
  if (anyComment) await q(`select public.admin_delete_comment($1, 'off-topic')`, [anyComment.id]);
  files = (await q(`select public.admin_delete_post($1, 'nuisance') f`, [discussionId])).rows[0].f;
  await expectFail('admin cannot delete a staff account', () => q(`select public.admin_delete_user($1, 'x')`, [viewerId]));
  await q(`select public.admin_delete_user($1, 'test')`, [users.erin]);
});
check('admin edits a profile', (await q('select role from profiles where id = $1', [users.bob])).rows[0].role === 'manager');
check('admin deletes a post', Array.isArray(files) && (await q('select count(*)::int n from posts where id = $1', [discussionId])).rows[0].n === 0);
check('admin deletes a user', (await q('select count(*)::int n from auth.users where id = $1', [users.erin])).rows[0].n === 0);
await asAdmin(async () => {
  const log = await q('select action from public.admin_audit_log(50)');
  for (const a of ['suspend_user', 'unsuspend_user', 'update_user', 'delete_post', 'delete_user']) check(`audit has ${a}`, log.rows.some((r) => r.action === a));
  await q(`select public.admin_save_resource('r-test', 'faq', 'Test', 'Sub', 'Body', '', '', '', true, 'External', '2026-05-01', 5)`);
  check('admin saves a resource', (await q(`select * from public.admin_list_resources()`)).rows.some((r) => r.id === 'r-test' && r.source === 'External'));
});


// ---- daily and role-wise mood analysis ----------------------------------------------------
await asViewer(async () => {
  const roles = await q('select * from public.admin_mood_roles(30)');
  const withData = roles.rows.filter((r) => !r.suppressed);
  check('roles under 5 people are withheld', roles.rows.length > 0 && roles.rows.every((r) => r.suppressed ? r.avg === null && r.low_share === null : r.people >= 5));
  const daily = await q(`select * from public.admin_mood_daily(30, '')`);
  check('daily series covers every day', daily.rows.length === 30);
  check('days under 5 people are withheld', daily.rows.every((d) => d.suppressed ? d.avg === null : d.people >= 5));
  const matrix = await q('select * from public.admin_mood_matrix(8)');
  check('matrix cells under 5 people are withheld', matrix.rows.every((c) => c.suppressed ? c.avg === null : c.people >= 5));
  check('mood analysis returns no account ids', ![roles, daily, matrix].some((x) => JSON.stringify(x.rows).match(/[0-9a-f]{8}-[0-9a-f]{4}-/)));
  const b = (await q('select public.admin_breakdowns(30) b')).rows[0].b;
  check('breakdowns return counts by kind and role', typeof b.members_by_role === 'object' && 'posts_by_kind' in b);
  void withData;
});
await as('bob', () => expectFail('member cannot read mood by role', () => q('select * from public.admin_mood_roles(30)')));
await as('bob', () => expectFail('member cannot read daily mood', () => q(`select * from public.admin_mood_daily(30, '')`)));
await asAnon(() => expectFail('anon cannot read the heatmap', () => q('select * from public.admin_mood_matrix(8)')));

// delete account cascades
await as('alice', () => q('select delete_my_data()'));
const left = await q(`select (select count(*) from posts where user_id=$1) p, (select count(*) from mood_checkins where user_id=$1) m, (select count(*) from conversations where $1 in (user_a,user_b)) c`, [users.alice]);
check('delete_my_data cascades', Number(left.rows[0].p) === 0 && Number(left.rows[0].m) === 0 && Number(left.rows[0].c) === 0);

console.log(failures || process.exitCode ? 'SOME CHECKS FAILED' : 'ALL CHECKS PASSED');
