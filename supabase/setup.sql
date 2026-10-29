-- ABB HELP ME: complete database setup.
-- Run once in Supabase > SQL Editor (paste the whole file, press Run). Safe to re-run.
--
-- Security model
--  * Every request carries the signed-in user's JWT. is_member() only admits verified, non-anonymous
--    users whose email is on the allowed list (keep in sync with src/lib/emailPolicy.ts).
--  * Base tables are readable only by their owner. Everybody else reads the community through the
--    *_feed views, which never expose user_id, so "anonymous" posts cannot be traced to an account.
--  * Votes, reports, mood check-ins, bookmarks, notifications and profiles are private to their owner.
--  * Content reported by 3 different people is hidden from everybody except its author.
--  * Per-user rate limits protect against spam.

-- ---------------------------------------------------------------------------------------------
-- Membership
-- ---------------------------------------------------------------------------------------------
create or replace function public.is_member()
returns boolean
language sql stable
set search_path = public
as $$
  select auth.uid() is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
     and coalesce(auth.jwt() ->> 'email', '') ~* '@(([a-z0-9-]+\.)*abb\.com|outlook\.com|outlook\.in|hotmail\.com|hotmail\.co\.uk|live\.com|live\.in|msn\.com)$'
$$;

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null default 'there' check (char_length(display_name) <= 40),
  role text check (role is null or char_length(role) <= 40),
  experience text check (experience is null or char_length(experience) <= 40),
  lock_enabled boolean not null default true,
  onboarding_complete boolean not null default false,
  topics text[] not null default '{}' check (cardinality(topics) <= 30),
  daily_reminder boolean not null default false,
  resource_tips boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists reminder_hydration boolean not null default false;
alter table public.profiles add column if not exists reminder_break boolean not null default false;
-- "People who understand": opt-in discovery. discover_code is an opaque handle, never a user id.
alter table public.profiles add column if not exists discoverable boolean not null default false;
alter table public.profiles add column if not exists discover_code text unique default substr(md5(gen_random_uuid()::text), 1, 12);

create table if not exists public.communities (
  id text primary key,
  name text not null,
  description text not null default '',
  icon text not null default 'people-outline',
  accent text not null default 'blue',
  sort integer not null default 0
);

create table if not exists public.community_members (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  community_id text not null references public.communities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, community_id)
);

-- Managed in the dashboard (Table Editor): the people who lead a community. No API access.
create table if not exists public.community_leaders (
  community_id text not null references public.communities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (community_id, user_id)
);

create table if not exists public.posts (
  id text primary key default ('c-' || gen_random_uuid()::text),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null,
  category text not null check (char_length(category) <= 60),
  title text not null check (char_length(title) <= 200),
  body text not null check (char_length(body) between 1 and 500),
  show_author boolean not null default false,
  author_role text,
  author_experience text,
  accepted_comment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Older installs only allowed two kinds and no title rule.
alter table public.posts add column if not exists community_id text references public.communities (id) on delete set null;
alter table public.posts add column if not exists attachments text[] not null default '{}';
alter table public.posts drop constraint if exists posts_attachments_max;
alter table public.posts add constraint posts_attachments_max check (cardinality(attachments) <= 4);
alter table public.posts drop constraint if exists posts_kind_check;
alter table public.posts add constraint posts_kind_check
  check (kind in ('work_question', 'achievement', 'personal', 'discussion', 'poll', 'idea'));
alter table public.posts drop constraint if exists posts_title_needed;
alter table public.posts add constraint posts_title_needed check (kind = 'personal' or char_length(btrim(title)) >= 3);

create table if not exists public.comments (
  id text primary key default ('c-' || gen_random_uuid()::text),
  post_id text not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  show_author boolean not null default false,
  author_role text,
  author_experience text,
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment')),
  target_id text not null,
  value smallint not null check (value in (-1, 1)),
  reason text check (reason is null or char_length(reason) <= 60),
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id),
  check (value = 1 or reason is not null)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  post_id text not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text not null check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);

create table if not exists public.mood_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mood text not null check (mood in ('great', 'okay', 'not_great', 'struggling')),
  tags text[] not null default '{}' check (cardinality(tags) <= 10),
  created_at timestamptz not null default now()
);

create table if not exists public.bookmarks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null,
  item_id text not null check (char_length(item_id) <= 80),
  created_at timestamptz not null default now(),
  primary key (user_id, type, item_id)
);
alter table public.bookmarks drop constraint if exists bookmarks_type_check;
alter table public.bookmarks add constraint bookmarks_type_check check (type in ('post', 'resource', 'session', 'conversation'));

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  post_id text references public.posts (id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in ('answer', 'comment', 'accepted', 'shoutout'));

create table if not exists public.resources (
  id text primary key,
  grp text not null check (grp in ('wellbeing', 'hr', 'it', 'workplace', 'support', 'faq', 'policy')),
  title text not null,
  subtitle text not null default '',
  body text not null default '',
  url text,
  phone text,
  email text,
  verified boolean not null default false,
  sort integer not null default 0
);
alter table public.resources add column if not exists source text not null default 'ABB';
alter table public.resources drop constraint if exists resources_source_check;
alter table public.resources add constraint resources_source_check check (source in ('ABB', 'External'));
alter table public.resources add column if not exists reviewed_at date;

create index if not exists comments_post_idx on public.comments (post_id);
create index if not exists comments_user_idx on public.comments (user_id);
create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_user_idx on public.posts (user_id);
create index if not exists mood_user_idx on public.mood_checkins (user_id, created_at desc);
create index if not exists notif_user_idx on public.notifications (user_id, created_at desc);
create index if not exists votes_target_idx on public.votes (target_type, target_id);
create index if not exists reports_post_idx on public.reports (post_id);

-- ---------------------------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.votes enable row level security;
alter table public.reports enable row level security;
alter table public.mood_checkins enable row level security;
alter table public.bookmarks enable row level security;
alter table public.notifications enable row level security;
alter table public.resources enable row level security;

-- Helper views need these (defined before the policies that use them).
drop view if exists public.comments_feed;
drop view if exists public.posts_feed;
create view public.posts_feed as
select p.id, p.kind, p.category, p.title, p.body,
       p.show_author,
       case when p.show_author then p.author_role end as author_role,
       case when p.show_author then p.author_experience end as author_experience,
       p.accepted_comment_id, p.created_at, p.updated_at,
       p.community_id, p.attachments,
       exists (select 1 from public.community_leaders l where l.community_id = p.community_id and l.user_id = p.user_id) as is_leader,
       (p.user_id = auth.uid()) as mine
from public.posts p
where public.is_member()
  and (p.user_id = auth.uid()
       or (select count(*) from public.reports r where r.post_id = p.id) < 3);

create view public.comments_feed as
select c.id, c.post_id, c.body,
       c.show_author,
       case when c.show_author then c.author_role end as author_role,
       case when c.show_author then c.author_experience end as author_experience,
       c.created_at,
       (c.user_id = auth.uid()) as mine
from public.comments c
join public.posts_feed f on f.id = c.post_id
where public.is_member();

revoke all on public.posts_feed, public.comments_feed from public, anon;
grant select on public.posts_feed, public.comments_feed to authenticated;

create or replace function public.is_own_target(t text, i text)
returns boolean
language sql stable security definer set search_path = public as $$
  select case t
    when 'post' then exists (select 1 from public.posts where id = i and user_id = auth.uid())
    else exists (select 1 from public.comments where id = i and user_id = auth.uid())
  end
$$;

create or replace function public.target_visible(t text, i text)
returns boolean
language sql stable security definer set search_path = public as $$
  select case t
    when 'post' then exists (select 1 from public.posts_feed where id = i)
    else exists (select 1 from public.comments_feed where id = i)
  end
$$;
revoke all on function public.is_own_target(text, text), public.target_visible(text, text) from public, anon;
grant execute on function public.is_own_target(text, text), public.target_visible(text, text) to authenticated;

-- profiles: own row only
drop policy if exists "profiles own select" on public.profiles;
drop policy if exists "profiles own insert" on public.profiles;
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own select" on public.profiles for select to authenticated using (public.is_member() and id = auth.uid());
create policy "profiles own insert" on public.profiles for insert to authenticated with check (public.is_member() and id = auth.uid());
create policy "profiles own update" on public.profiles for update to authenticated
  using (public.is_member() and id = auth.uid()) with check (id = auth.uid());

-- posts: the base table is private to the author; the community reads posts_feed
drop policy if exists "posts read" on public.posts;
drop policy if exists "posts insert own" on public.posts;
drop policy if exists "posts update own" on public.posts;
drop policy if exists "posts delete own" on public.posts;
drop policy if exists "posts own select" on public.posts;
drop policy if exists "posts own insert" on public.posts;
drop policy if exists "posts own update" on public.posts;
drop policy if exists "posts own delete" on public.posts;
create policy "posts own select" on public.posts for select to authenticated using (public.is_member() and user_id = auth.uid());
create policy "posts own insert" on public.posts for insert to authenticated with check (public.is_member() and user_id = auth.uid());
create policy "posts own update" on public.posts for update to authenticated
  using (public.is_member() and user_id = auth.uid()) with check (user_id = auth.uid());
create policy "posts own delete" on public.posts for delete to authenticated using (public.is_member() and user_id = auth.uid());

-- comments
drop policy if exists "comments read" on public.comments;
drop policy if exists "comments insert own" on public.comments;
drop policy if exists "comments delete own" on public.comments;
drop policy if exists "comments own select" on public.comments;
drop policy if exists "comments own insert" on public.comments;
drop policy if exists "comments own delete" on public.comments;
create policy "comments own select" on public.comments for select to authenticated using (public.is_member() and user_id = auth.uid());
create policy "comments own insert" on public.comments for insert to authenticated
  with check (public.is_member() and user_id = auth.uid() and public.target_visible('post', post_id));
create policy "comments own delete" on public.comments for delete to authenticated using (public.is_member() and user_id = auth.uid());

-- votes: private to the voter, never on your own content, only on content you can see
drop policy if exists "votes read own" on public.votes;
drop policy if exists "votes insert own" on public.votes;
drop policy if exists "votes update own" on public.votes;
drop policy if exists "votes delete own" on public.votes;
create policy "votes read own" on public.votes for select to authenticated using (public.is_member() and user_id = auth.uid());
create policy "votes insert own" on public.votes for insert to authenticated
  with check (public.is_member() and user_id = auth.uid()
              and not public.is_own_target(target_type, target_id) and public.target_visible(target_type, target_id));
create policy "votes update own" on public.votes for update to authenticated
  using (public.is_member() and user_id = auth.uid())
  with check (user_id = auth.uid() and not public.is_own_target(target_type, target_id));
create policy "votes delete own" on public.votes for delete to authenticated using (public.is_member() and user_id = auth.uid());

-- reports: write once per post, read own
drop policy if exists "reports insert own" on public.reports;
drop policy if exists "reports read own" on public.reports;
create policy "reports insert own" on public.reports for insert to authenticated
  with check (public.is_member() and user_id = auth.uid() and public.target_visible('post', post_id));
create policy "reports read own" on public.reports for select to authenticated using (public.is_member() and user_id = auth.uid());

-- mood check-ins and bookmarks: owner only
drop policy if exists "mood own select" on public.mood_checkins;
drop policy if exists "mood own insert" on public.mood_checkins;
drop policy if exists "mood own delete" on public.mood_checkins;
create policy "mood own select" on public.mood_checkins for select to authenticated using (public.is_member() and user_id = auth.uid());
create policy "mood own insert" on public.mood_checkins for insert to authenticated with check (public.is_member() and user_id = auth.uid());
create policy "mood own delete" on public.mood_checkins for delete to authenticated using (public.is_member() and user_id = auth.uid());

drop policy if exists "bookmarks own select" on public.bookmarks;
drop policy if exists "bookmarks own insert" on public.bookmarks;
drop policy if exists "bookmarks own delete" on public.bookmarks;
create policy "bookmarks own select" on public.bookmarks for select to authenticated using (public.is_member() and user_id = auth.uid());
create policy "bookmarks own insert" on public.bookmarks for insert to authenticated with check (public.is_member() and user_id = auth.uid());
create policy "bookmarks own delete" on public.bookmarks for delete to authenticated using (public.is_member() and user_id = auth.uid());

-- notifications: created only by triggers; the owner reads, marks read and deletes
drop policy if exists "notif own select" on public.notifications;
drop policy if exists "notif own update" on public.notifications;
drop policy if exists "notif own delete" on public.notifications;
create policy "notif own select" on public.notifications for select to authenticated using (public.is_member() and user_id = auth.uid());
create policy "notif own update" on public.notifications for update to authenticated
  using (public.is_member() and user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notif own delete" on public.notifications for delete to authenticated using (public.is_member() and user_id = auth.uid());

-- resources: members read; edit them in the dashboard (Table Editor)
drop policy if exists "resources read" on public.resources;
create policy "resources read" on public.resources for select to authenticated using (public.is_member());

-- Nothing is available to signed-out (anon) callers.
revoke all on public.profiles, public.posts, public.comments, public.votes, public.reports,
  public.mood_checkins, public.bookmarks, public.notifications, public.resources from anon;
revoke insert, update, delete on public.resources from authenticated;
revoke insert on public.notifications from authenticated;

-- ---------------------------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists posts_touch on public.posts;
create trigger posts_touch before update on public.posts for each row execute function public.touch_updated_at();

-- The accepted answer must be an answer to that same question.
create or replace function public.check_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.accepted_comment_id is not null and not exists (
    select 1 from public.comments where id = new.accepted_comment_id and post_id = new.id) then
    raise exception 'invalid accepted answer';
  end if;
  return new;
end $$;
drop trigger if exists posts_check_accepted on public.posts;
create trigger posts_check_accepted before insert or update of accepted_comment_id on public.posts
  for each row execute function public.check_accepted();

-- Spam limits per user per hour (argument = maximum).
create or replace function public.limit_rate()
returns trigger language plpgsql security definer set search_path = public as $$
declare n integer; cap integer;
begin
  cap := tg_argv[0]::integer;
  execute format('select count(*) from public.%I where user_id = $1 and created_at > now() - interval ''1 hour''', tg_table_name)
    into n using new.user_id;
  if n >= cap then raise exception 'rate limit exceeded, please try again later'; end if;
  return new;
end $$;
drop trigger if exists posts_rate on public.posts;
create trigger posts_rate before insert on public.posts for each row execute function public.limit_rate(30);
drop trigger if exists comments_rate on public.comments;
create trigger comments_rate before insert on public.comments for each row execute function public.limit_rate(120);
drop trigger if exists mood_rate on public.mood_checkins;
create trigger mood_rate before insert on public.mood_checkins for each row execute function public.limit_rate(48);

-- Votes and bookmarks are polymorphic (no foreign key), so clean them up when content is deleted.
create or replace function public.cleanup_deleted_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.votes where target_type = 'post' and target_id = old.id;
  delete from public.bookmarks where type = 'post' and item_id = old.id;
  return old;
end $$;
drop trigger if exists posts_cleanup on public.posts;
create trigger posts_cleanup after delete on public.posts for each row execute function public.cleanup_deleted_post();

create or replace function public.cleanup_deleted_comment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.votes where target_type = 'comment' and target_id = old.id;
  return old;
end $$;
drop trigger if exists comments_cleanup on public.comments;
create trigger comments_cleanup after delete on public.comments for each row execute function public.cleanup_deleted_comment();

-- ---------------------------------------------------------------------------------------------
-- In-app notifications
-- ---------------------------------------------------------------------------------------------
create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid; ttl text; pkind text;
begin
  select user_id, title, kind into owner, ttl, pkind from public.posts where id = new.post_id;
  if owner is not null and owner <> new.user_id then
    insert into public.notifications (user_id, kind, title, body, post_id)
    values (owner,
            case when pkind = 'work_question' then 'answer' else 'comment' end,
            case when pkind = 'work_question' then 'Someone answered your question' else 'New comment on your post' end,
            left(coalesce(nullif(btrim(ttl), ''), 'Your personal post'), 120),
            new.post_id);
  end if;
  return new;
end $$;
drop trigger if exists comments_notify on public.comments;
create trigger comments_notify after insert on public.comments for each row execute function public.notify_on_comment();

create or replace function public.notify_on_accept()
returns trigger language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
  if new.accepted_comment_id is not null and new.accepted_comment_id is distinct from old.accepted_comment_id then
    select user_id into author from public.comments where id = new.accepted_comment_id;
    if author is not null and author <> new.user_id then
      insert into public.notifications (user_id, kind, title, body, post_id)
      values (author, 'accepted', 'Your answer was accepted', left(coalesce(nullif(btrim(new.title), ''), 'A question'), 120), new.id);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists posts_notify_accept on public.posts;
create trigger posts_notify_accept after update of accepted_comment_id on public.posts for each row execute function public.notify_on_accept();

-- ---------------------------------------------------------------------------------------------
-- Functions the app calls
-- ---------------------------------------------------------------------------------------------
-- Totals without revealing who voted.
create or replace function public.vote_scores(t text, ids text[])
returns table (target_id text, score integer)
language sql stable security definer set search_path = public as $$
  select v.target_id, coalesce(sum(v.value), 0)::integer
  from public.votes v
  where public.is_member() and v.target_type = t and v.target_id = any (ids)
  group by v.target_id
$$;

-- Score, answer count and "solved" flag for a list of posts, in one round trip.
create or replace function public.post_stats(ids text[])
returns table (post_id text, score integer, comments integer, solved boolean)
language sql stable security definer set search_path = public as $$
  select p.id,
         coalesce((select sum(v.value) from public.votes v where v.target_type = 'post' and v.target_id = p.id), 0)::integer,
         (select count(*) from public.comments c where c.post_id = p.id)::integer,
         p.accepted_comment_id is not null
  from public.posts p
  where public.is_member() and p.id = any (ids)
$$;

-- What colleagues gave me: votes on my posts and answers, and answers of mine that others accepted.
create or replace function public.my_received_feedback()
returns table (upvotes integer, downvotes integer, accepted_by_others integer)
language sql stable security definer set search_path = public as $$
  select
    coalesce(sum(case when v.value = 1 then 1 else 0 end), 0)::integer,
    coalesce(sum(case when v.value = -1 then 1 else 0 end), 0)::integer,
    (select count(*) from public.posts p
       join public.comments c on c.id = p.accepted_comment_id
      where c.user_id = auth.uid() and p.user_id <> auth.uid())::integer
  from public.votes v
  where public.is_member() and v.user_id <> auth.uid() and (
    (v.target_type = 'post' and exists (select 1 from public.posts p where p.id = v.target_id and p.user_id = auth.uid()))
    or (v.target_type = 'comment' and exists (select 1 from public.comments c where c.id = v.target_id and c.user_id = auth.uid())))
$$;

-- Organisation-wide counts by topic. Groups smaller than 3 are hidden so nobody can be singled out.
create or replace function public.community_stats(days integer default 30)
returns table (kind text, category text, n integer)
language sql stable security definer set search_path = public as $$
  select p.kind, p.category, count(*)::integer
  from public.posts p
  where public.is_member() and p.created_at > now() - make_interval(days => days)
  group by p.kind, p.category
  having count(*) >= 3
  order by 3 desc
$$;

-- "Delete account and data": removing the auth user cascades to every table above.
create or replace function public.delete_my_data()
returns void
language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid() and public.is_member()
$$;

revoke all on function public.vote_scores(text, text[]), public.post_stats(text[]), public.my_received_feedback(),
  public.community_stats(integer), public.delete_my_data() from public, anon;
grant execute on function public.vote_scores(text, text[]), public.post_stats(text[]), public.my_received_feedback(),
  public.community_stats(integer), public.delete_my_data() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Communities
-- ---------------------------------------------------------------------------------------------
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_leaders enable row level security;

drop policy if exists "communities read" on public.communities;
create policy "communities read" on public.communities for select to authenticated using (public.is_member());

drop policy if exists "community members own select" on public.community_members;
drop policy if exists "community members own insert" on public.community_members;
drop policy if exists "community members own delete" on public.community_members;
create policy "community members own select" on public.community_members for select to authenticated
  using (public.is_member() and user_id = auth.uid());
create policy "community members own insert" on public.community_members for insert to authenticated
  with check (public.is_member() and user_id = auth.uid());
create policy "community members own delete" on public.community_members for delete to authenticated
  using (public.is_member() and user_id = auth.uid());

revoke all on public.communities, public.community_members, public.community_leaders from anon;
revoke all on public.community_leaders from authenticated;
revoke insert, update, delete on public.communities from authenticated;

create or replace function public.community_overview()
returns table (id text, name text, description text, icon text, accent text, members integer, posts_7d integer, following boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.description, c.icon, c.accent,
         (select count(*) from public.community_members m where m.community_id = c.id)::integer,
         (select count(*) from public.posts p where p.community_id = c.id and p.created_at > now() - interval '7 days')::integer,
         exists (select 1 from public.community_members m where m.community_id = c.id and m.user_id = auth.uid())
  from public.communities c
  where public.is_member()
  order by c.sort
$$;

insert into public.communities (id, name, description, icon, accent, sort) values
  ('mental-wellbeing', 'Mental wellbeing', 'Stress, anxiety, burnout and looking after yourself.', 'heart-outline', 'rose', 10),
  ('workplace', 'Workplace', 'Offices, tools, policies and day-to-day questions.', 'business-outline', 'blue', 20),
  ('career-growth', 'Career growth', 'Learning, moves, mentoring and development.', 'trending-up-outline', 'violet', 30),
  ('teams', 'Teams & collaboration', 'Working well together, across sites and time zones.', 'people-outline', 'teal', 40),
  ('work-life-balance', 'Work-life balance', 'Boundaries, flexibility, family and time off.', 'leaf-outline', 'green', 50),
  ('ideas', 'Ideas & improvement', 'Suggestions to make ABB a better place to work.', 'bulb-outline', 'amber', 60),
  ('abb-life', 'ABB life', 'Events, wins, recognition and everything in between.', 'sparkles-outline', 'slate', 70)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Polls
-- ---------------------------------------------------------------------------------------------
create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  post_id text not null references public.posts (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  sort integer not null default 0
);
create table if not exists public.poll_votes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  post_id text not null references public.posts (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index if not exists poll_options_post_idx on public.poll_options (post_id);

alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

create or replace function public.option_in_post(o uuid, p text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.poll_options where id = o and post_id = p)
$$;
revoke all on function public.option_in_post(uuid, text) from public, anon;
grant execute on function public.option_in_post(uuid, text) to authenticated;

drop policy if exists "poll options read" on public.poll_options;
create policy "poll options read" on public.poll_options for select to authenticated
  using (public.is_member() and public.target_visible('post', post_id));

drop policy if exists "poll votes own select" on public.poll_votes;
drop policy if exists "poll votes own insert" on public.poll_votes;
drop policy if exists "poll votes own update" on public.poll_votes;
drop policy if exists "poll votes own delete" on public.poll_votes;
create policy "poll votes own select" on public.poll_votes for select to authenticated using (public.is_member() and user_id = auth.uid());
create policy "poll votes own insert" on public.poll_votes for insert to authenticated
  with check (public.is_member() and user_id = auth.uid() and public.target_visible('post', post_id) and public.option_in_post(option_id, post_id));
create policy "poll votes own update" on public.poll_votes for update to authenticated
  using (public.is_member() and user_id = auth.uid())
  with check (user_id = auth.uid() and public.option_in_post(option_id, post_id));
create policy "poll votes own delete" on public.poll_votes for delete to authenticated using (public.is_member() and user_id = auth.uid());
revoke all on public.poll_options, public.poll_votes from anon;
revoke insert, update, delete on public.poll_options from authenticated;

-- A poll and its options are created together.
create or replace function public.create_poll(
  p_category text, p_title text, p_body text, p_options text[], p_show boolean, p_role text, p_experience text,
  p_community text default null, p_attachments text[] default '{}')
returns text
language plpgsql security definer set search_path = public as $$
declare pid text; opt text; i integer := 0; clean text[];
begin
  if not public.is_member() then raise exception 'not allowed'; end if;
  select coalesce(array_agg(btrim(o)) filter (where btrim(o) <> ''), '{}') into clean from unnest(p_options) o;
  if cardinality(clean) < 2 or cardinality(clean) > 6 then raise exception 'A poll needs 2 to 6 options.'; end if;
  insert into public.posts (user_id, kind, category, title, body, show_author, author_role, author_experience, community_id, attachments)
  values (auth.uid(), 'poll', p_category, btrim(p_title), btrim(p_body), coalesce(p_show, false),
          case when p_show then p_role end, case when p_show then p_experience end, p_community, coalesce(p_attachments, '{}'))
  returning id into pid;
  foreach opt in array clean loop
    insert into public.poll_options (post_id, label, sort) values (pid, left(opt, 80), i);
    i := i + 1;
  end loop;
  return pid;
end $$;

-- Results are shown only to people who voted and to the poll's author, so votes are not swayed by the running total.
create or replace function public.poll_results(p_post text)
returns table (option_id uuid, label text, votes integer, mine boolean, revealed boolean)
language sql stable security definer set search_path = public as $$
  with ctx as (
    select (exists (select 1 from public.poll_votes v where v.post_id = p_post and v.user_id = auth.uid())
            or exists (select 1 from public.posts p where p.id = p_post and p.user_id = auth.uid())) as revealed
  )
  select o.id, o.label,
         case when ctx.revealed then (select count(*) from public.poll_votes v where v.option_id = o.id)::integer else 0 end,
         exists (select 1 from public.poll_votes v where v.option_id = o.id and v.user_id = auth.uid()),
         ctx.revealed
  from public.poll_options o cross join ctx
  where public.is_member() and public.target_visible('post', p_post) and o.post_id = p_post
  order by o.sort
$$;

-- ---------------------------------------------------------------------------------------------
-- Post images (private bucket; any member can view, you can only add to your own folder)
-- ---------------------------------------------------------------------------------------------
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('post-images', 'post-images', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists "post images read" on storage.objects;
  drop policy if exists "post images insert" on storage.objects;
  drop policy if exists "post images delete" on storage.objects;
  create policy "post images read" on storage.objects for select to authenticated
    using (bucket_id = 'post-images' and public.is_member());
  create policy "post images insert" on storage.objects for insert to authenticated
    with check (bucket_id = 'post-images' and public.is_member() and (storage.foldername(name))[1] = auth.uid()::text);
  create policy "post images delete" on storage.objects for delete to authenticated
    using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
exception when others then
  raise notice 'Could not set up the post-images bucket (%). Create a private bucket named post-images in Storage and add the policies by hand.', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 1-to-1 chat ("People who understand")
-- Tables are closed to the API. People read through the my_* views and act through the functions
-- below, which enforce who may do what. Nobody ever sees the other person's account id or email.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users (id) on delete cascade,   -- asked to chat
  user_b uuid not null references auth.users (id) on delete cascade,   -- was asked
  status text not null default 'pending' check (status in ('pending', 'active', 'declined', 'closed')),
  a_alias text not null,
  b_alias text not null,
  a_show_role boolean not null default false,
  b_show_role boolean not null default false,
  a_revealed boolean not null default false,
  b_revealed boolean not null default false,
  a_muted boolean not null default false,
  b_muted boolean not null default false,
  a_left boolean not null default false,
  b_left boolean not null default false,
  a_read_at timestamptz not null default now(),
  b_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_a <> user_b)
);
create unique index if not exists conversations_open_pair_idx
  on public.conversations (least(user_a, user_b), greatest(user_a, user_b)) where status in ('pending', 'active');
create index if not exists conversations_a_idx on public.conversations (user_a);
create index if not exists conversations_b_idx on public.conversations (user_b);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages (conversation_id, created_at);

create table if not exists public.blocks (
  blocker uuid not null references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);

create table if not exists public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references auth.users (id) on delete cascade,
  reported uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  reason text not null check (char_length(reason) <= 300),
  created_at timestamptz not null default now()
);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.chat_reports enable row level security;
revoke all on public.conversations, public.messages, public.blocks, public.chat_reports from anon, authenticated;

create or replace function public.alias_for(seed text)
returns text language sql immutable as $$
  select (array['Quiet','Gentle','Calm','Bright','Kind','Steady','Warm','Brave','Curious','Patient','Sunny','Mellow'])[1 + (abs(hashtext(seed)::bigint) % 12)::integer]
         || ' ' ||
         (array['Otter','Heron','Maple','Falcon','Willow','Panda','Cedar','Finch','Lynx','Robin','Fern','Koala'])[1 + (abs(hashtext(seed || 'x')::bigint) % 12)::integer]
$$;

create or replace function public.is_blocked_pair(x uuid, y uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks b where (b.blocker = x and b.blocked = y) or (b.blocker = y and b.blocked = x))
$$;

create or replace view public.my_conversations as
select c.id, c.status,
       (c.user_a = auth.uid()) as i_requested,
       case when c.user_a = auth.uid() then c.b_alias else c.a_alias end as other_alias,
       case when (c.user_a = auth.uid() and c.b_revealed) or (c.user_b = auth.uid() and c.a_revealed) then op.display_name end as other_name,
       case when (c.user_a = auth.uid() and (c.b_show_role or c.b_revealed)) or (c.user_b = auth.uid() and (c.a_show_role or c.a_revealed)) then op.role end as other_role,
       case when (c.user_a = auth.uid() and (c.b_show_role or c.b_revealed)) or (c.user_b = auth.uid() and (c.a_show_role or c.a_revealed)) then op.experience end as other_experience,
       case when c.user_a = auth.uid() then c.a_revealed else c.b_revealed end as i_revealed,
       case when c.user_a = auth.uid() then c.b_revealed else c.a_revealed end as other_revealed,
       case when c.user_a = auth.uid() then c.a_muted else c.b_muted end as muted,
       (select m.body from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1) as last_body,
       (select max(m.created_at) from public.messages m where m.conversation_id = c.id) as last_at,
       (select count(*) from public.messages m
         where m.conversation_id = c.id and m.sender <> auth.uid()
           and m.created_at > case when c.user_a = auth.uid() then c.a_read_at else c.b_read_at end)::integer as unread,
       c.created_at
from public.conversations c
cross join lateral (select case when c.user_a = auth.uid() then c.user_b else c.user_a end as oid) o
left join public.profiles op on op.id = o.oid
where public.is_member()
  and auth.uid() in (c.user_a, c.user_b)
  and not (case when c.user_a = auth.uid() then c.a_left else c.b_left end);

create or replace view public.my_messages as
select m.id, m.conversation_id, m.body, m.created_at, (m.sender = auth.uid()) as mine
from public.messages m
join public.conversations c on c.id = m.conversation_id
where public.is_member() and auth.uid() in (c.user_a, c.user_b);

revoke all on public.my_conversations, public.my_messages from public, anon;
grant select on public.my_conversations, public.my_messages to authenticated;

-- Opt-in matches by role, experience and shared topics. Returns opaque codes, never account ids.
create or replace function public.discover_people(p_limit integer default 10)
returns table (code text, alias text, role text, experience text, shared_topics integer, score integer)
language sql stable security definer set search_path = public as $$
  select p.discover_code, public.alias_for(p.discover_code), p.role, p.experience,
         (select count(*) from unnest(p.topics) t where t = any (me.topics))::integer,
         ((case when p.role is not null and p.role = me.role then 3 else 0 end)
          + (case when p.experience is not null and p.experience = me.experience then 2 else 0 end)
          + (select count(*) from unnest(p.topics) t where t = any (me.topics)))::integer
  from public.profiles p
  join public.profiles me on me.id = auth.uid()
  where public.is_member() and p.discoverable and p.onboarding_complete and p.id <> me.id
    and not public.is_blocked_pair(me.id, p.id)
    and not exists (select 1 from public.conversations c where c.status in ('pending', 'active')
                    and ((c.user_a = me.id and c.user_b = p.id) or (c.user_a = p.id and c.user_b = me.id)))
  order by 6 desc, md5(p.discover_code || current_date::text)
  limit least(greatest(p_limit, 1), 30)
$$;

create or replace function public.request_chat(p_code text, p_intro text, p_show_role boolean default false)
returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); target uuid; cid uuid := gen_random_uuid(); n integer;
begin
  if not public.is_member() then raise exception 'not allowed'; end if;
  if not (char_length(btrim(coalesce(p_intro, ''))) between 1 and 500) then raise exception 'Write a short introduction (up to 500 characters).'; end if;
  select id into target from public.profiles where discover_code = p_code and discoverable and id <> me;
  if target is null or public.is_blocked_pair(me, target) then raise exception 'That person is no longer available.'; end if;
  if exists (select 1 from public.conversations c where c.status in ('pending', 'active')
             and ((c.user_a = me and c.user_b = target) or (c.user_a = target and c.user_b = me))) then
    raise exception 'You already have a conversation with this person.';
  end if;
  select count(*) into n from public.conversations where user_a = me and created_at > now() - interval '1 day';
  if n >= 5 then raise exception 'You have sent enough requests for today. Please try again tomorrow.'; end if;
  insert into public.conversations (id, user_a, user_b, a_alias, b_alias, a_show_role)
  values (cid, me, target, public.alias_for(cid::text || 'a'), public.alias_for(cid::text || 'b'), coalesce(p_show_role, false));
  insert into public.messages (conversation_id, sender, body) values (cid, me, btrim(p_intro));
  return cid;
end $$;

create or replace function public.respond_chat(p_id uuid, p_accept boolean, p_show_role boolean default false)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then raise exception 'not allowed'; end if;
  update public.conversations
     set status = case when p_accept then 'active' else 'declined' end,
         b_show_role = case when p_accept then coalesce(p_show_role, false) else b_show_role end,
         b_read_at = now(), updated_at = now()
   where id = p_id and user_b = auth.uid() and status = 'pending';
  if not found then raise exception 'This request is no longer open.'; end if;
end $$;

create or replace function public.send_message(p_id uuid, p_body text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.conversations; mid uuid; n integer;
begin
  if not public.is_member() then raise exception 'not allowed'; end if;
  select * into c from public.conversations where id = p_id and me in (user_a, user_b);
  if not found or c.status <> 'active' or public.is_blocked_pair(c.user_a, c.user_b) then raise exception 'This conversation is not open.'; end if;
  if not (char_length(btrim(coalesce(p_body, ''))) between 1 and 1000) then raise exception 'Messages can be up to 1000 characters.'; end if;
  select count(*) into n from public.messages where sender = me and created_at > now() - interval '1 hour';
  if n >= 120 then raise exception 'rate limit exceeded, please try again later'; end if;
  insert into public.messages (conversation_id, sender, body) values (p_id, me, btrim(p_body)) returning id into mid;
  update public.conversations
     set updated_at = now(),
         a_read_at = case when user_a = me then now() else a_read_at end,
         b_read_at = case when user_b = me then now() else b_read_at end
   where id = p_id;
  return mid;
end $$;

create or replace function public.mark_chat_read(p_id uuid)
returns void
language sql security definer set search_path = public as $$
  update public.conversations
     set a_read_at = case when user_a = auth.uid() then now() else a_read_at end,
         b_read_at = case when user_b = auth.uid() then now() else b_read_at end
   where id = p_id and auth.uid() in (user_a, user_b) and public.is_member()
$$;

-- flag: 'muted' (either way) or 'reveal' (true only: you cannot take a reveal back).
create or replace function public.set_chat_flag(p_id uuid, p_flag text, p_value boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if not public.is_member() then raise exception 'not allowed'; end if;
  if p_flag = 'muted' then
    update public.conversations set a_muted = case when user_a = me then p_value else a_muted end,
                                    b_muted = case when user_b = me then p_value else b_muted end
     where id = p_id and me in (user_a, user_b);
  elsif p_flag = 'reveal' and p_value then
    update public.conversations set a_revealed = case when user_a = me then true else a_revealed end,
                                    b_revealed = case when user_b = me then true else b_revealed end
     where id = p_id and me in (user_a, user_b) and status = 'active';
  else
    raise exception 'unknown option';
  end if;
end $$;

create or replace function public.leave_chat(p_id uuid)
returns void
language sql security definer set search_path = public as $$
  update public.conversations
     set status = 'closed', updated_at = now(),
         a_left = a_left or user_a = auth.uid(),
         b_left = b_left or user_b = auth.uid()
   where id = p_id and auth.uid() in (user_a, user_b) and public.is_member()
$$;

create or replace function public.block_user(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); other uuid;
begin
  if not public.is_member() then raise exception 'not allowed'; end if;
  select case when user_a = me then user_b else user_a end into other from public.conversations where id = p_id and me in (user_a, user_b);
  if other is null then return; end if;
  insert into public.blocks (blocker, blocked) values (me, other) on conflict do nothing;
  perform public.leave_chat(p_id);
end $$;

create or replace function public.report_chat(p_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); other uuid;
begin
  if not public.is_member() then raise exception 'not allowed'; end if;
  select case when user_a = me then user_b else user_a end into other from public.conversations where id = p_id and me in (user_a, user_b);
  if other is null then raise exception 'Conversation not found.'; end if;
  insert into public.chat_reports (reporter, reported, conversation_id, reason) values (me, other, p_id, left(coalesce(p_reason, 'user_report'), 300));
  -- Three different people reporting the same person takes them out of discovery until a moderator looks.
  if (select count(distinct reporter) from public.chat_reports where reported = other) >= 3 then
    update public.profiles set discoverable = false where id = other;
  end if;
end $$;

create or replace function public.chat_unread()
returns integer
language sql stable security definer set search_path = public as $$
  select case when not public.is_member() then 0 else (
    (select count(*) from public.conversations c where c.user_b = auth.uid() and c.status = 'pending' and not c.b_left)
    + (select count(*) from public.messages m join public.conversations c on c.id = m.conversation_id
        where c.status = 'active' and m.sender <> auth.uid() and auth.uid() in (c.user_a, c.user_b)
          and not (case when c.user_a = auth.uid() then c.a_muted or c.a_left else c.b_muted or c.b_left end)
          and m.created_at > case when c.user_a = auth.uid() then c.a_read_at else c.b_read_at end)
  )::integer end
$$;

-- ---------------------------------------------------------------------------------------------
-- Wellbeing sessions (meditation, breathing, sleep, micro-breaks)
-- ---------------------------------------------------------------------------------------------
create table if not exists public.wellness_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('meditation', 'breathing', 'sleep', 'microbreak')),
  slug text not null check (char_length(slug) <= 40),
  minutes numeric(5, 1) not null check (minutes >= 0 and minutes <= 120),
  created_at timestamptz not null default now()
);
create index if not exists wellness_user_idx on public.wellness_sessions (user_id, created_at desc);
alter table public.wellness_sessions enable row level security;
drop policy if exists "wellness own select" on public.wellness_sessions;
drop policy if exists "wellness own insert" on public.wellness_sessions;
drop policy if exists "wellness own delete" on public.wellness_sessions;
create policy "wellness own select" on public.wellness_sessions for select to authenticated using (public.is_member() and user_id = auth.uid());
create policy "wellness own insert" on public.wellness_sessions for insert to authenticated with check (public.is_member() and user_id = auth.uid());
create policy "wellness own delete" on public.wellness_sessions for delete to authenticated using (public.is_member() and user_id = auth.uid());
revoke all on public.wellness_sessions from anon;
drop trigger if exists wellness_rate on public.wellness_sessions;
create trigger wellness_rate before insert on public.wellness_sessions for each row execute function public.limit_rate(60);

-- ---------------------------------------------------------------------------------------------
-- Recognition & shout-outs
-- Sent by email address; the answer is the same whether or not the address belongs to a colleague,
-- so addresses cannot be probed. The recipient decides whether a shout-out appears on the wall.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.shoutouts (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  badge text not null check (badge in ('thanks', 'teamwork', 'above_beyond', 'creative', 'helpful', 'kind')),
  message text not null check (char_length(message) between 1 and 200),
  anonymous boolean not null default false,
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);
create index if not exists shoutouts_to_idx on public.shoutouts (to_user, created_at desc);
alter table public.shoutouts enable row level security;
revoke all on public.shoutouts from anon, authenticated;

create or replace view public.my_shoutouts as
select s.id, s.badge, s.message, s.created_at, s.shared,
       case when s.anonymous then null else sp.display_name end as from_name
from public.shoutouts s
join public.profiles sp on sp.id = s.from_user
where public.is_member() and s.to_user = auth.uid();

create or replace view public.shoutout_wall as
select s.id, s.badge, s.message, s.created_at,
       rp.display_name as to_name,
       case when s.anonymous then null else sp.display_name end as from_name
from public.shoutouts s
join public.profiles rp on rp.id = s.to_user
join public.profiles sp on sp.id = s.from_user
where public.is_member() and s.shared;

revoke all on public.my_shoutouts, public.shoutout_wall from public, anon;
grant select on public.my_shoutouts, public.shoutout_wall to authenticated;

create or replace function public.give_shoutout(p_email text, p_badge text, p_message text, p_anonymous boolean default false)
returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); target uuid; n integer;
begin
  if not public.is_member() then raise exception 'not allowed'; end if;
  if p_badge not in ('thanks', 'teamwork', 'above_beyond', 'creative', 'helpful', 'kind') then raise exception 'Choose a badge.'; end if;
  if not (char_length(btrim(coalesce(p_message, ''))) between 1 and 200) then raise exception 'Write a short message (up to 200 characters).'; end if;
  select count(*) into n from public.shoutouts where from_user = me and created_at > now() - interval '1 day';
  if n >= 10 then raise exception 'rate limit exceeded, please try again later'; end if;
  select u.id into target
    from auth.users u join public.profiles p on p.id = u.id
   where lower(u.email) = lower(btrim(coalesce(p_email, ''))) and u.id <> me limit 1;
  if target is null or public.is_blocked_pair(me, target) then return; end if;
  insert into public.shoutouts (from_user, to_user, badge, message, anonymous)
  values (me, target, p_badge, btrim(p_message), coalesce(p_anonymous, false));
  insert into public.notifications (user_id, kind, title, body)
  values (target, 'shoutout', 'You got a shout-out', left(btrim(p_message), 120));
end $$;

create or replace function public.share_shoutout(p_id uuid, p_shared boolean)
returns void
language sql security definer set search_path = public as $$
  update public.shoutouts set shared = coalesce(p_shared, false)
   where id = p_id and to_user = auth.uid() and public.is_member()
$$;

-- ---------------------------------------------------------------------------------------------
-- Anonymous feedback to ABB
-- The feedback row holds no account id and only the month. A separate throttle table (account + day,
-- no content) limits spam, so a row can never be tied back to a person.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('workplace', 'wellbeing', 'facilities', 'management', 'technology', 'culture', 'other')),
  body text not null check (char_length(body) between 1 and 1000),
  month date not null default (date_trunc('month', now()))::date
);
create table if not exists public.feedback_throttle (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  n integer not null default 0,
  primary key (user_id, day)
);
alter table public.feedback enable row level security;
alter table public.feedback_throttle enable row level security;
revoke all on public.feedback, public.feedback_throttle from anon, authenticated;

create or replace function public.submit_feedback(p_category text, p_body text)
returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); used integer;
begin
  if not public.is_member() then raise exception 'not allowed'; end if;
  if p_category not in ('workplace', 'wellbeing', 'facilities', 'management', 'technology', 'culture', 'other') then raise exception 'Choose a category.'; end if;
  if not (char_length(btrim(coalesce(p_body, ''))) between 1 and 1000) then raise exception 'Feedback can be up to 1000 characters.'; end if;
  delete from public.feedback_throttle where day < current_date - 1;
  insert into public.feedback_throttle (user_id, day, n) values (me, current_date, 1)
  on conflict (user_id, day) do update set n = public.feedback_throttle.n + 1 returning n into used;
  if used > 3 then raise exception 'rate limit exceeded, please try again tomorrow'; end if;
  insert into public.feedback (category, body) values (p_category, btrim(p_body));
end $$;

-- Monthly counts per category. Counts under 3 are not shown, so a small group cannot be picked out.
create or replace function public.feedback_report(p_month date default current_date)
returns table (category text, n integer, prev_n integer)
language sql stable security definer set search_path = public as $$
  with cur as (
    select f.category, count(*)::integer as n from public.feedback f
     where f.month = date_trunc('month', p_month)::date group by f.category),
  prev as (
    select f.category, count(*)::integer as n from public.feedback f
     where f.month = (date_trunc('month', p_month) - interval '1 month')::date group by f.category)
  select cur.category, cur.n, case when prev.n >= 3 then prev.n end
    from cur left join prev on prev.category = cur.category
   where public.is_member() and cur.n >= 3
   order by cur.n desc
$$;

-- ---------------------------------------------------------------------------------------------
-- Aggregated wellbeing pulse. Shown only when at least 5 different people checked in.
-- ---------------------------------------------------------------------------------------------
create or replace function public.org_pulse(p_days integer default 30)
returns table (mood text, n integer, people integer)
language sql stable security definer set search_path = public as $$
  with m as (select user_id, mood from public.mood_checkins where created_at > now() - make_interval(days => least(greatest(p_days, 1), 365))),
       t as (select count(distinct user_id)::integer as people from m)
  select m.mood, count(*)::integer, (select people from t)
    from m
   where public.is_member() and (select people from t) >= 5
   group by m.mood
$$;

create or replace function public.org_pulse_factors(p_days integer default 30)
returns table (tag text, n integer)
language sql stable security definer set search_path = public as $$
  with m as (select user_id, tags from public.mood_checkins where created_at > now() - make_interval(days => least(greatest(p_days, 1), 365))),
       t as (select count(distinct user_id)::integer as people from m)
  select x.tag, count(*)::integer
    from m, unnest(m.tags) as x(tag)
   where public.is_member() and (select people from t) >= 5
   group by x.tag
   order by 2 desc
$$;

-- ---------------------------------------------------------------------------------------------
-- Grants for the functions above
-- ---------------------------------------------------------------------------------------------
revoke all on function
  public.community_overview(), public.create_poll(text, text, text, text[], boolean, text, text, text, text[]), public.poll_results(text),
  public.is_blocked_pair(uuid, uuid), public.discover_people(integer), public.request_chat(text, text, boolean),
  public.respond_chat(uuid, boolean, boolean), public.send_message(uuid, text), public.mark_chat_read(uuid),
  public.set_chat_flag(uuid, text, boolean), public.leave_chat(uuid), public.block_user(uuid), public.report_chat(uuid, text),
  public.chat_unread(), public.give_shoutout(text, text, text, boolean), public.share_shoutout(uuid, boolean),
  public.submit_feedback(text, text), public.feedback_report(date), public.org_pulse(integer), public.org_pulse_factors(integer)
  from public, anon;
grant execute on function
  public.community_overview(), public.create_poll(text, text, text, text[], boolean, text, text, text, text[]), public.poll_results(text),
  public.discover_people(integer), public.request_chat(text, text, boolean),
  public.respond_chat(uuid, boolean, boolean), public.send_message(uuid, text), public.mark_chat_read(uuid),
  public.set_chat_flag(uuid, text, boolean), public.leave_chat(uuid), public.block_user(uuid), public.report_chat(uuid, text),
  public.chat_unread(), public.give_shoutout(text, text, text, boolean), public.share_shoutout(uuid, boolean),
  public.submit_feedback(text, text), public.feedback_report(date), public.org_pulse(integer), public.org_pulse_factors(integer)
  to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Resources (edit in Table Editor: add real phone / url / email and tick "verified" once ABB approves)
-- ---------------------------------------------------------------------------------------------
insert into public.resources (id, grp, title, subtitle, body, verified, sort) values
 ('r-wellbeing', 'wellbeing', 'Mental Well-being Resources', 'Articles, videos, and tools',
  'A starting point for looking after your mental health at work: short exercises, planning your day, and talking to someone you trust.', false, 10),
 ('r-stress', 'wellbeing', 'Stress & Anxiety', 'Guided exercises, tips, and tools',
  'Try a few slow breaths, write down what is on your plate, and pick one thing to do next. Talking to someone you trust can help too.', false, 20),
 ('r-mindful', 'wellbeing', 'Mindfulness & Meditation', 'Take a break, reset your mind',
  'A two-minute pause between tasks can help you reset. Close your eyes, breathe slowly, and notice how your body feels.', false, 30),
 ('r-balance', 'wellbeing', 'Work-Life Balance', 'Tips for a healthier routine',
  'Set clear start and stop times, protect your breaks, and agree priorities with your manager each week.', false, 40),
 ('r-eap', 'support', 'Employee Assistance Program (EAP)', 'Counselling & support services',
  'Contact details have not been added yet. Ask HR for the approved EAP route. An administrator can add the phone, link or email in the resources table.', false, 50),
 ('r-hr', 'hr', 'HR Policies', 'Leave, benefits, career, more',
  'Leave, benefits and career questions are handled by HR. Ask your HR contact, or ask the community how others approached it.', false, 60),
 ('r-it', 'it', 'IT Support', 'Tech help, system access, VPN',
  'For access, devices and VPN problems, raise a ticket through your IT service portal. Include what you tried and when it happened.', false, 70),
 ('r-workplace', 'workplace', 'Workplace & Facilities', 'Office, safety, transport',
  'Office, safety, transport and accessibility questions go to Facilities. Contact details have not been added yet.', false, 80),
 ('r-urgent', 'support', 'Emergency Contacts', 'Urgent help information',
  'If you or someone else is in danger, contact your local emergency services immediately. This app is not monitored and cannot send help.', false, 90),
 ('r-faq', 'faq', 'FAQs', 'Quick answers to common queries',
  'Browse questions other colleagues have asked in the Community tab, or ask your own.', false, 100),
 ('r-policy', 'policy', 'Code of Conduct & Policies', 'Where to find company policies',
  'Company policies explain how concerns are handled. Ask HR where the approved policy library lives.', false, 110)
on conflict (id) do nothing;


-- =============================================================================================
-- ADMIN CONSOLE (the web dashboard in admin-dashboard/)
--
-- Two staff roles, kept in public.staff (add people with supabase/seed_admin_users.sql):
--   admin  : sees everything below and can edit, suspend or delete users, delete posts and comments,
--            clear reports and manage resources and community leaders.
--   viewer : sees everything below, changes nothing.
--
-- Staff never read tables directly. Every screen calls a security-definer function that first checks the
-- caller's staff role, so the public anon key in the dashboard grants nothing on its own.
--
-- Mental health is shown only as aggregates: no function returns an individual's check-ins, and any group
-- smaller than 5 people is withheld. Who wrote an anonymous post is revealed only on request, and every
-- reveal and every change is written to admin_audit.
-- =============================================================================================

alter table public.profiles add column if not exists suspended boolean not null default false;

create table if not exists public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now()
);
create table if not exists public.admin_audit (
  id bigint generated always as identity primary key,
  actor uuid references auth.users (id) on delete set null,
  actor_email text,
  action text not null,
  target_type text,
  target_id text,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.staff enable row level security;
alter table public.admin_audit enable row level security;
revoke all on public.staff, public.admin_audit from anon, authenticated;

create or replace function public.staff_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.staff where user_id = auth.uid()
$$;
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid())
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and role = 'admin')
$$;
create or replace function public.is_suspended()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select suspended from public.profiles where id = auth.uid()), false)
$$;

-- Suspended people lose access to everything immediately, not only at their next sign-in.
create or replace function public.is_member()
returns boolean
language sql stable
set search_path = public
as $$
  select auth.uid() is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
     and coalesce(auth.jwt() ->> 'email', '') ~* '@(([a-z0-9-]+\.)*abb\.com|outlook\.com|outlook\.in|hotmail\.com|hotmail\.co\.uk|live\.com|live\.in|msn\.com)$'
     and not public.is_suspended()
$$;

create or replace function public.require_staff()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Staff access only' using errcode = '42501'; end if;
end $$;
create or replace function public.require_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only an admin can do this' using errcode = '42501'; end if;
end $$;

create or replace function public.log_admin(p_action text, p_type text, p_id text, p_detail jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.admin_audit (actor, actor_email, action, target_type, target_id, detail)
  values (auth.uid(), auth.jwt() ->> 'email', p_action, p_type, p_id, coalesce(p_detail, '{}'))
$$;

-- ---- who am I ------------------------------------------------------------------------------
create or replace function public.my_staff_role()
returns text language sql stable security definer set search_path = public as $$
  select public.staff_role()
$$;

-- ---- overview ------------------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d7 timestamptz := now() - interval '7 days';
begin
  perform public.require_staff();
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'users_7d', (select count(*) from public.profiles where created_at > d7),
    'suspended', (select count(*) from public.profiles where suspended),
    'active_7d', (select count(distinct uid) from (
        select user_id as uid from public.posts where created_at > d7
        union select user_id from public.comments where created_at > d7
        union select user_id from public.mood_checkins where created_at > d7
        union select sender from public.messages where created_at > d7) a),
    'posts', (select count(*) from public.posts),
    'posts_7d', (select count(*) from public.posts where created_at > d7),
    'comments_7d', (select count(*) from public.comments where created_at > d7),
    'checkins_7d', (select count(*) from public.mood_checkins where created_at > d7),
    'messages_7d', (select count(*) from public.messages where created_at > d7),
    'conversations_active', (select count(*) from public.conversations where status = 'active'),
    'reported_posts', (select count(distinct post_id) from public.reports),
    'hidden_posts', (select count(*) from (select post_id from public.reports group by post_id having count(*) >= 3) h),
    'reported_people', (select count(distinct reported) from public.chat_reports),
    'feedback_month', (select count(*) from public.feedback where month = date_trunc('month', now())::date),
    'shoutouts_30d', (select count(*) from public.shoutouts where created_at > now() - interval '30 days'),
    'sessions_7d', (select coalesce(sum(minutes), 0) from public.wellness_sessions where created_at > d7)
  );
end $$;

create or replace function public.admin_activity(p_days integer default 30)
returns table (day date, signups integer, posts integer, comments integer, checkins integer, messages integer)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return query
  select g.d::date,
         (select count(*) from public.profiles p where p.created_at::date = g.d::date)::integer,
         (select count(*) from public.posts p where p.created_at::date = g.d::date)::integer,
         (select count(*) from public.comments c where c.created_at::date = g.d::date)::integer,
         (select count(*) from public.mood_checkins m where m.created_at::date = g.d::date)::integer,
         (select count(*) from public.messages m where m.created_at::date = g.d::date)::integer
  from generate_series(current_date - (least(greatest(p_days, 7), 365) - 1), current_date, interval '1 day') as g(d)
  order by 1;
end $$;

-- ---- wellbeing (aggregates only, groups under 5 people withheld) ----------------------------
create or replace function public.admin_wellbeing(p_days integer default 90)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  since timestamptz := now() - make_interval(days => least(greatest(p_days, 7), 365));
  k constant integer := public.wellbeing_k();
  people integer;
  result jsonb;
begin
  perform public.require_staff();
  select count(distinct user_id) into people from public.mood_checkins where created_at > since;

  result := jsonb_build_object(
    'min_group', k,
    'people', people,
    'members', (select count(*) from public.profiles),
    'checkins', (select count(*) from public.mood_checkins where created_at > since));
  if people < k then
    return result || jsonb_build_object('suppressed', true);
  end if;

  return result || jsonb_build_object(
    'suppressed', false,
    'moods', (select coalesce(jsonb_object_agg(mood, n), '{}') from (
        select mood, count(*) as n from public.mood_checkins where created_at > since group by mood) x),
    'weekly', (select coalesce(jsonb_agg(w order by w->>'week'), '[]') from (
        select jsonb_build_object(
          'week', wk::date, 'people', count(distinct user_id),
          'great', count(*) filter (where mood = 'great'), 'okay', count(*) filter (where mood = 'okay'),
          'not_great', count(*) filter (where mood = 'not_great'), 'struggling', count(*) filter (where mood = 'struggling')) as w
        from (select date_trunc('week', created_at) as wk, user_id, mood from public.mood_checkins where created_at > since) m
        group by wk having count(distinct user_id) >= k) y),
    'factors', (select coalesce(jsonb_agg(jsonb_build_object('tag', tag, 'n', n, 'low_share', low_share) order by n desc), '[]') from (
        select t.tag, count(*) as n,
               round(100.0 * count(*) filter (where m.mood in ('not_great', 'struggling')) / count(*))::integer as low_share
        from public.mood_checkins m, unnest(m.tags) as t(tag)
        where m.created_at > since group by t.tag having count(distinct m.user_id) >= k) f),
    'by_role', (select coalesce(jsonb_agg(jsonb_build_object('group', grp, 'people', ppl, 'avg', avg_score, 'low_share', low_share) order by avg_score), '[]') from (
        select coalesce(p.role, 'not_set') as grp, count(distinct m.user_id) as ppl,
               round(avg(case m.mood when 'great' then 4 when 'okay' then 3 when 'not_great' then 2 else 1 end), 2) as avg_score,
               round(100.0 * count(*) filter (where m.mood in ('not_great', 'struggling')) / count(*))::integer as low_share
        from public.mood_checkins m join public.profiles p on p.id = m.user_id
        where m.created_at > since group by 1 having count(distinct m.user_id) >= k) r),
    'by_experience', (select coalesce(jsonb_agg(jsonb_build_object('group', grp, 'people', ppl, 'avg', avg_score, 'low_share', low_share) order by grp), '[]') from (
        select coalesce(p.experience, 'not_set') as grp, count(distinct m.user_id) as ppl,
               round(avg(case m.mood when 'great' then 4 when 'okay' then 3 when 'not_great' then 2 else 1 end), 2) as avg_score,
               round(100.0 * count(*) filter (where m.mood in ('not_great', 'struggling')) / count(*))::integer as low_share
        from public.mood_checkins m join public.profiles p on p.id = m.user_id
        where m.created_at > since group by 1 having count(distinct m.user_id) >= k) e),
    'low_share_7d', (select case when count(distinct user_id) >= k
        then round(100.0 * count(*) filter (where mood in ('not_great', 'struggling')) / count(*))::integer end
        from public.mood_checkins where created_at > now() - interval '7 days'),
    'low_share_prev_7d', (select case when count(distinct user_id) >= k
        then round(100.0 * count(*) filter (where mood in ('not_great', 'struggling')) / count(*))::integer end
        from public.mood_checkins where created_at between now() - interval '14 days' and now() - interval '7 days'),
    'sessions', (select coalesce(jsonb_object_agg(kind, mins), '{}') from (
        select kind, round(sum(minutes))::integer as mins from public.wellness_sessions where created_at > since group by kind) s)
  );
end $$;

-- ---- users ----------------------------------------------------------------------------------
create or replace function public.admin_users(p_search text default '', p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, email text, display_name text, role text, experience text, created_at timestamptz, last_sign_in_at timestamptz,
               suspended boolean, staff_role text, posts integer, comments integer, reports_against integer, chat_reports_against integer, total bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return query
  select u.id, u.email::text, p.display_name, p.role, p.experience, coalesce(p.created_at, u.created_at), u.last_sign_in_at,
         coalesce(p.suspended, false), s.role,
         (select count(*) from public.posts x where x.user_id = u.id)::integer,
         (select count(*) from public.comments x where x.user_id = u.id)::integer,
         (select count(*) from public.reports r join public.posts x on x.id = r.post_id where x.user_id = u.id)::integer,
         (select count(*) from public.chat_reports c where c.reported = u.id)::integer,
         count(*) over ()
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.staff s on s.user_id = u.id
  where coalesce(p_search, '') = ''
     or u.email ilike '%' || p_search || '%' or p.display_name ilike '%' || p_search || '%'
  order by coalesce(p.created_at, u.created_at) desc
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end $$;

-- ---- posts and comments (no author unless revealed) -----------------------------------------
create or replace function public.admin_posts(p_search text default '', p_kind text default '', p_reported_only boolean default false,
                                              p_limit integer default 50, p_offset integer default 0)
returns table (id text, kind text, category text, title text, body text, created_at timestamptz, community_id text, attachments text[],
               show_author boolean, author_role text, author_experience text, comments integer, score integer, reports integer, hidden boolean, total bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return query
  select x.*, count(*) over () from (
    select p.id, p.kind, p.category, p.title, p.body, p.created_at, p.community_id, p.attachments,
           p.show_author, p.author_role, p.author_experience,
           (select count(*) from public.comments c where c.post_id = p.id)::integer as comments,
           coalesce((select sum(v.value) from public.votes v where v.target_type = 'post' and v.target_id = p.id), 0)::integer as score,
           (select count(*) from public.reports r where r.post_id = p.id)::integer as reports,
           (select count(*) from public.reports r where r.post_id = p.id) >= 3 as hidden
    from public.posts p
    where (coalesce(p_kind, '') = '' or p.kind = p_kind)
      and (coalesce(p_search, '') = '' or p.title ilike '%' || p_search || '%' or p.body ilike '%' || p_search || '%')
  ) x
  where not p_reported_only or x.reports > 0
  order by case when p_reported_only then x.reports end desc nulls last, x.created_at desc
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end $$;

create or replace function public.admin_post_comments(p_post text)
returns table (id text, body text, created_at timestamptz, show_author boolean, author_role text, author_experience text, accepted boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return query
  select c.id, c.body, c.created_at, c.show_author, c.author_role, c.author_experience,
         c.id = (select accepted_comment_id from public.posts where id = p_post)
  from public.comments c where c.post_id = p_post order by c.created_at;
end $$;

create or replace function public.admin_reports()
returns table (post_id text, kind text, title text, body text, reports integer, reasons text[], last_reported timestamptz, hidden boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return query
  select p.id, p.kind, p.title, p.body, count(r.id)::integer, array_agg(distinct r.reason), max(r.created_at), count(r.id) >= 3
  from public.reports r join public.posts p on p.id = r.post_id
  group by p.id order by count(r.id) desc, max(r.created_at) desc;
end $$;

-- Who wrote this post or comment. Recorded in the audit log every time.
create or replace function public.admin_reveal_author(p_type text, p_id text, p_reason text default '')
returns table (user_id uuid, email text, display_name text)
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  perform public.require_staff();
  if p_type = 'post' then select x.user_id into uid from public.posts x where x.id = p_id;
  elsif p_type = 'comment' then select x.user_id into uid from public.comments x where x.id = p_id;
  else raise exception 'unknown type'; end if;
  if uid is null then raise exception 'Not found'; end if;
  perform public.log_admin('reveal_author', p_type, p_id, jsonb_build_object('reason', p_reason, 'user_id', uid));
  return query select u.id, u.email::text, p.display_name from auth.users u left join public.profiles p on p.id = u.id where u.id = uid;
end $$;

create or replace function public.admin_chat_reports()
returns table (user_id uuid, email text, display_name text, reports integer, reporters integer, reasons text[], last_reported timestamptz,
               suspended boolean, discoverable boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return query
  select u.id, u.email::text, p.display_name, count(c.id)::integer, count(distinct c.reporter)::integer, array_agg(distinct c.reason),
         max(c.created_at), coalesce(p.suspended, false), coalesce(p.discoverable, false)
  from public.chat_reports c join auth.users u on u.id = c.reported left join public.profiles p on p.id = u.id
  group by u.id, p.display_name, p.suspended, p.discoverable
  order by count(distinct c.reporter) desc, max(c.created_at) desc;
end $$;

create or replace function public.admin_feedback(p_month date default current_date)
returns table (id uuid, category text, body text, month date)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return query select f.id, f.category, f.body, f.month from public.feedback f
  where f.month = date_trunc('month', p_month)::date order by f.category;
end $$;

create or replace function public.admin_list_resources()
returns setof public.resources language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return query select * from public.resources order by sort, id;
end $$;

create or replace function public.admin_communities()
returns table (id text, name text, description text, icon text, accent text, sort integer, members integer, posts_7d integer, leaders jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return query
  select c.id, c.name, c.description, c.icon, c.accent, c.sort,
         (select count(*) from public.community_members m where m.community_id = c.id)::integer,
         (select count(*) from public.posts p where p.community_id = c.id and p.created_at > now() - interval '7 days')::integer,
         coalesce((select jsonb_agg(jsonb_build_object('user_id', l.user_id, 'email', u.email)) from public.community_leaders l
                   join auth.users u on u.id = l.user_id where l.community_id = c.id), '[]')
  from public.communities c order by c.sort;
end $$;

create or replace function public.admin_audit_log(p_limit integer default 200)
returns table (id bigint, actor_email text, action text, target_type text, target_id text, detail jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return query select a.id, a.actor_email, a.action, a.target_type, a.target_id, a.detail, a.created_at
  from public.admin_audit a order by a.created_at desc limit least(greatest(p_limit, 1), 1000);
end $$;

-- ---- admin actions (admin role only, all audited) --------------------------------------------
create or replace function public.admin_delete_post(p_id text, p_reason text default '')
returns text[] language plpgsql security definer set search_path = public as $$
declare files text[]; t text;
begin
  perform public.require_admin();
  select attachments, title into files, t from public.posts where id = p_id;
  if not found then raise exception 'Post not found'; end if;
  delete from public.posts where id = p_id;
  perform public.log_admin('delete_post', 'post', p_id, jsonb_build_object('reason', p_reason, 'title', t));
  return coalesce(files, '{}');  -- the dashboard removes these photos from storage
end $$;

create or replace function public.admin_delete_comment(p_id text, p_reason text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.posts set accepted_comment_id = null where accepted_comment_id = p_id;
  delete from public.comments where id = p_id;
  if not found then raise exception 'Comment not found'; end if;
  perform public.log_admin('delete_comment', 'comment', p_id, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.admin_dismiss_reports(p_post text, p_reason text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  delete from public.reports where post_id = p_post;
  perform public.log_admin('dismiss_reports', 'post', p_post, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.admin_dismiss_chat_reports(p_user uuid, p_reason text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  delete from public.chat_reports where reported = p_user;
  perform public.log_admin('dismiss_chat_reports', 'user', p_user::text, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.admin_set_suspended(p_user uuid, p_suspended boolean, p_reason text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if exists (select 1 from public.staff where user_id = p_user) then raise exception 'Staff accounts cannot be suspended here'; end if;
  update public.profiles set suspended = p_suspended, discoverable = case when p_suspended then false else discoverable end where id = p_user;
  -- Block new sign-ins and end their sessions; access stops at once because is_member() checks suspension.
  update auth.users set banned_until = case when p_suspended then now() + interval '100 years' end where id = p_user;
  if to_regclass('auth.sessions') is not null and p_suspended then
    execute 'delete from auth.sessions where user_id = $1' using p_user;
  end if;
  perform public.log_admin(case when p_suspended then 'suspend_user' else 'unsuspend_user' end, 'user', p_user::text,
                           jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.admin_update_user(p_user uuid, p_display_name text, p_role text, p_experience text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.profiles
     set display_name = left(coalesce(nullif(btrim(p_display_name), ''), 'there'), 40),
         role = nullif(p_role, ''), experience = nullif(p_experience, '')
   where id = p_user;
  if not found then raise exception 'User has no profile'; end if;
  perform public.log_admin('update_user', 'user', p_user::text,
                           jsonb_build_object('display_name', p_display_name, 'role', p_role, 'experience', p_experience));
end $$;

create or replace function public.admin_delete_user(p_user uuid, p_reason text default '')
returns void language plpgsql security definer set search_path = public as $$
declare mail text;
begin
  perform public.require_admin();
  if exists (select 1 from public.staff where user_id = p_user) then raise exception 'Staff accounts cannot be deleted here'; end if;
  select email into mail from auth.users where id = p_user;
  if mail is null then raise exception 'User not found'; end if;
  delete from auth.users where id = p_user;  -- cascades to every table
  perform public.log_admin('delete_user', 'user', p_user::text, jsonb_build_object('reason', p_reason, 'email', mail));
end $$;

create or replace function public.admin_save_resource(
  p_id text, p_grp text, p_title text, p_subtitle text, p_body text, p_url text, p_phone text, p_email text,
  p_verified boolean, p_source text, p_reviewed_at date, p_sort integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  insert into public.resources (id, grp, title, subtitle, body, url, phone, email, verified, source, reviewed_at, sort)
  values (p_id, p_grp, p_title, coalesce(p_subtitle, ''), coalesce(p_body, ''), nullif(p_url, ''), nullif(p_phone, ''), nullif(p_email, ''),
          coalesce(p_verified, false), coalesce(nullif(p_source, ''), 'ABB'), p_reviewed_at, coalesce(p_sort, 0))
  on conflict (id) do update set grp = excluded.grp, title = excluded.title, subtitle = excluded.subtitle, body = excluded.body,
    url = excluded.url, phone = excluded.phone, email = excluded.email, verified = excluded.verified, source = excluded.source,
    reviewed_at = excluded.reviewed_at, sort = excluded.sort;
  perform public.log_admin('save_resource', 'resource', p_id, jsonb_build_object('title', p_title, 'verified', p_verified));
end $$;

create or replace function public.admin_delete_resource(p_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  delete from public.resources where id = p_id;
  perform public.log_admin('delete_resource', 'resource', p_id, '{}');
end $$;

create or replace function public.admin_set_leader(p_community text, p_email text, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  perform public.require_admin();
  select id into uid from auth.users where lower(email) = lower(btrim(p_email));
  if uid is null then raise exception 'No account with that email'; end if;
  if p_on then
    insert into public.community_leaders (community_id, user_id) values (p_community, uid) on conflict do nothing;
  else
    delete from public.community_leaders where community_id = p_community and user_id = uid;
  end if;
  perform public.log_admin(case when p_on then 'add_leader' else 'remove_leader' end, 'community', p_community, jsonb_build_object('email', p_email));
end $$;

-- Staff can view post photos; admins can remove them (the app's own rules stay as they are).
do $$
begin
  drop policy if exists "post images staff read" on storage.objects;
  drop policy if exists "post images admin delete" on storage.objects;
  create policy "post images staff read" on storage.objects for select to authenticated using (bucket_id = 'post-images' and public.is_staff());
  create policy "post images admin delete" on storage.objects for delete to authenticated using (bucket_id = 'post-images' and public.is_admin());
exception when others then
  raise notice 'Could not add staff storage policies (%).', sqlerrm;
end $$;

-- Grants: nothing for signed-out callers; the functions themselves check the staff role.
do $$
declare f text;
begin
  foreach f in array array[
    'public.staff_role()', 'public.is_staff()', 'public.is_admin()', 'public.is_suspended()', 'public.require_staff()', 'public.require_admin()',
    'public.log_admin(text, text, text, jsonb)', 'public.my_staff_role()', 'public.admin_overview()', 'public.admin_activity(integer)',
    'public.admin_wellbeing(integer)', 'public.admin_users(text, integer, integer)',
    'public.admin_posts(text, text, boolean, integer, integer)', 'public.admin_post_comments(text)', 'public.admin_reports()',
    'public.admin_reveal_author(text, text, text)', 'public.admin_chat_reports()', 'public.admin_feedback(date)',
    'public.admin_list_resources()', 'public.admin_communities()', 'public.admin_audit_log(integer)',
    'public.admin_delete_post(text, text)', 'public.admin_delete_comment(text, text)', 'public.admin_dismiss_reports(text, text)',
    'public.admin_dismiss_chat_reports(uuid, text)', 'public.admin_set_suspended(uuid, boolean, text)',
    'public.admin_update_user(uuid, text, text, text)', 'public.admin_delete_user(uuid, text)',
    'public.admin_save_resource(text, text, text, text, text, text, text, text, boolean, text, date, integer)',
    'public.admin_delete_resource(text)', 'public.admin_set_leader(text, text, boolean)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
-- log_admin and require_* are internal: callers cannot write audit entries directly.
revoke execute on function public.log_admin(text, text, text, jsonb) from authenticated;


-- ---- mood analysis: daily and by role (aggregates only) -------------------------------------
-- The smallest group that may be shown. Anything below it comes back with suppressed = true and no numbers.
-- Do not lower this for real use: with a group of 1 the "average" is one person's private check-in.
create or replace function public.wellbeing_k()
returns integer language sql immutable as $$ select 5 $$;

-- One row per day. Role is optional (an id such as 'intern', or 'not_set'). Days with too few people are withheld.
create or replace function public.admin_mood_daily(p_days integer default 30, p_role text default '')
returns table (day date, people integer, checkins integer, great integer, okay integer, not_great integer, struggling integer,
               avg numeric, low_share integer, suppressed boolean)
language plpgsql stable security definer set search_path = public as $$
declare n integer := least(greatest(p_days, 7), 365);
begin
  perform public.require_staff();
  return query
  with m as (
    select c.created_at::date as d, c.user_id, c.mood
      from public.mood_checkins c join public.profiles p on p.id = c.user_id
     where c.created_at >= current_date - (n - 1)
       and (coalesce(p_role, '') = '' or coalesce(p.role, 'not_set') = p_role)),
  agg as (
    select m.d, count(distinct m.user_id)::integer as people, count(*)::integer as checkins,
           count(*) filter (where m.mood = 'great')::integer as great, count(*) filter (where m.mood = 'okay')::integer as okay,
           count(*) filter (where m.mood = 'not_great')::integer as not_great, count(*) filter (where m.mood = 'struggling')::integer as struggling,
           avg(case m.mood when 'great' then 4 when 'okay' then 3 when 'not_great' then 2 else 1 end) as av
      from m group by m.d)
  select g::date,
         coalesce(a.people, 0), coalesce(a.checkins, 0),
         case when coalesce(a.people, 0) >= public.wellbeing_k() then a.great end,
         case when coalesce(a.people, 0) >= public.wellbeing_k() then a.okay end,
         case when coalesce(a.people, 0) >= public.wellbeing_k() then a.not_great end,
         case when coalesce(a.people, 0) >= public.wellbeing_k() then a.struggling end,
         case when coalesce(a.people, 0) >= public.wellbeing_k() then round(a.av, 2) end,
         case when coalesce(a.people, 0) >= public.wellbeing_k() then round(100.0 * (a.not_great + a.struggling) / a.checkins)::integer end,
         coalesce(a.people, 0) < public.wellbeing_k()
    from generate_series(current_date - (n - 1), current_date, interval '1 day') g
    left join agg a on a.d = g::date
   order by 1;
end $$;

-- One row per role for the period.
create or replace function public.admin_mood_roles(p_days integer default 30)
returns table (role text, people integer, members integer, checkins integer, great integer, okay integer, not_great integer, struggling integer,
               avg numeric, low_share integer, suppressed boolean)
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => least(greatest(p_days, 7), 365));
begin
  perform public.require_staff();
  return query
  with mem as (select coalesce(p.role, 'not_set') as r, count(*)::integer as members from public.profiles p group by 1),
  agg as (
    select coalesce(p.role, 'not_set') as r, count(distinct c.user_id)::integer as people, count(*)::integer as checkins,
           count(*) filter (where c.mood = 'great')::integer as great, count(*) filter (where c.mood = 'okay')::integer as okay,
           count(*) filter (where c.mood = 'not_great')::integer as not_great, count(*) filter (where c.mood = 'struggling')::integer as struggling,
           avg(case c.mood when 'great' then 4 when 'okay' then 3 when 'not_great' then 2 else 1 end) as av
      from public.mood_checkins c join public.profiles p on p.id = c.user_id
     where c.created_at >= since group by 1)
  select mem.r, coalesce(a.people, 0), mem.members, coalesce(a.checkins, 0),
         case when coalesce(a.people, 0) >= public.wellbeing_k() then a.great end,
         case when coalesce(a.people, 0) >= public.wellbeing_k() then a.okay end,
         case when coalesce(a.people, 0) >= public.wellbeing_k() then a.not_great end,
         case when coalesce(a.people, 0) >= public.wellbeing_k() then a.struggling end,
         case when coalesce(a.people, 0) >= public.wellbeing_k() then round(a.av, 2) end,
         case when coalesce(a.people, 0) >= public.wellbeing_k() then round(100.0 * (a.not_great + a.struggling) / a.checkins)::integer end,
         coalesce(a.people, 0) < public.wellbeing_k()
    from mem left join agg a on a.r = mem.r
   order by (coalesce(a.people, 0) >= public.wellbeing_k()) desc, mem.members desc, mem.r;
end $$;

-- Role by week: the heatmap. Cells with too few people are withheld.
create or replace function public.admin_mood_matrix(p_weeks integer default 8)
returns table (role text, week date, people integer, avg numeric, low_share integer, suppressed boolean)
language plpgsql stable security definer set search_path = public as $$
declare w integer := least(greatest(p_weeks, 2), 26);
begin
  perform public.require_staff();
  return query
  with weeks as (select date_trunc('week', current_date - (i * 7))::date as wk from generate_series(0, w - 1) i),
  roles as (select distinct coalesce(p.role, 'not_set') as r from public.profiles p),
  agg as (
    select coalesce(p.role, 'not_set') as r, date_trunc('week', c.created_at)::date as wk, count(distinct c.user_id)::integer as people,
           avg(case c.mood when 'great' then 4 when 'okay' then 3 when 'not_great' then 2 else 1 end) as av,
           100.0 * count(*) filter (where c.mood in ('not_great', 'struggling')) / count(*) as low
      from public.mood_checkins c join public.profiles p on p.id = c.user_id
     where c.created_at >= date_trunc('week', current_date - ((w - 1) * 7)) group by 1, 2)
  select roles.r, weeks.wk, coalesce(a.people, 0),
         case when coalesce(a.people, 0) >= public.wellbeing_k() then round(a.av, 2) end,
         case when coalesce(a.people, 0) >= public.wellbeing_k() then round(a.low)::integer end,
         coalesce(a.people, 0) < public.wellbeing_k()
    from roles cross join weeks left join agg a on a.r = roles.r and a.wk = weeks.wk
   where exists (select 1 from agg x where x.r = roles.r)
   order by roles.r, weeks.wk;
end $$;

-- Shares for the pie charts. People counts per role are not wellbeing data, so they are not withheld.
create or replace function public.admin_breakdowns(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => least(greatest(p_days, 7), 365));
begin
  perform public.require_staff();
  return jsonb_build_object(
    'posts_by_kind', (select coalesce(jsonb_object_agg(kind, n), '{}') from (select kind, count(*) as n from public.posts where created_at >= since group by kind) x),
    'members_by_role', (select coalesce(jsonb_object_agg(r, n), '{}') from (select coalesce(role, 'not_set') as r, count(*) as n from public.profiles group by 1) x),
    'members_by_experience', (select coalesce(jsonb_object_agg(r, n), '{}') from (select coalesce(experience, 'not_set') as r, count(*) as n from public.profiles group by 1) x),
    'feedback_by_category', (select coalesce(jsonb_object_agg(category, n), '{}') from (
        select category, count(*) as n from public.feedback where month = date_trunc('month', current_date)::date group by category) x),
    'reports_by_status', jsonb_build_object(
        'hidden', (select count(*) from (select post_id from public.reports group by post_id having count(*) >= 3) h),
        'open', (select count(*) from (select post_id from public.reports group by post_id having count(*) < 3) h))
  );
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.wellbeing_k()', 'public.admin_mood_daily(integer, text)', 'public.admin_mood_roles(integer)',
    'public.admin_mood_matrix(integer)', 'public.admin_breakdowns(integer)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
