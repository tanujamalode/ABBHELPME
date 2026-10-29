-- ABB HELP ME: switch from anonymous sessions to verified email sign-in.
-- Run once in Supabase > SQL Editor, after schema.sql. Safe to re-run.
--
-- Every request from the app carries the user's JWT. These rules only let signed-in members
-- with an allowed email (Outlook / Hotmail / Live / MSN, or abb.com and its subdomains) read
-- the community, and only let them change their own rows. Anonymous sessions get nothing.
-- Keep the domain list in sync with src/lib/emailPolicy.ts.

create or replace function public.is_member()
returns boolean
language sql stable
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
     and coalesce(auth.jwt() ->> 'email', '') ~* '@(([a-z0-9-]+\.)*abb\.com|outlook\.com|outlook\.in|hotmail\.com|hotmail\.co\.uk|live\.com|live\.in|msn\.com)$'
$$;

-- posts
drop policy if exists "posts read" on public.posts;
drop policy if exists "posts insert own" on public.posts;
drop policy if exists "posts update own" on public.posts;
drop policy if exists "posts delete own" on public.posts;
create policy "posts read" on public.posts for select to authenticated using (public.is_member());
create policy "posts insert own" on public.posts for insert to authenticated with check (public.is_member() and user_id = auth.uid());
create policy "posts update own" on public.posts for update to authenticated
  using (public.is_member() and user_id = auth.uid()) with check (user_id = auth.uid());
create policy "posts delete own" on public.posts for delete to authenticated using (public.is_member() and user_id = auth.uid());

-- comments
drop policy if exists "comments read" on public.comments;
drop policy if exists "comments insert own" on public.comments;
drop policy if exists "comments delete own" on public.comments;
create policy "comments read" on public.comments for select to authenticated using (public.is_member());
create policy "comments insert own" on public.comments for insert to authenticated with check (public.is_member() and user_id = auth.uid());
create policy "comments delete own" on public.comments for delete to authenticated using (public.is_member() and user_id = auth.uid());

-- votes
drop policy if exists "votes read own" on public.votes;
drop policy if exists "votes insert own" on public.votes;
drop policy if exists "votes update own" on public.votes;
drop policy if exists "votes delete own" on public.votes;
create policy "votes read own" on public.votes for select to authenticated using (public.is_member() and user_id = auth.uid());
create policy "votes insert own" on public.votes for insert to authenticated with check (public.is_member() and user_id = auth.uid());
create policy "votes update own" on public.votes for update to authenticated
  using (public.is_member() and user_id = auth.uid()) with check (user_id = auth.uid());
create policy "votes delete own" on public.votes for delete to authenticated using (public.is_member() and user_id = auth.uid());

-- reports
drop policy if exists "reports insert own" on public.reports;
drop policy if exists "reports read own" on public.reports;
create policy "reports insert own" on public.reports for insert to authenticated with check (public.is_member() and user_id = auth.uid());
create policy "reports read own" on public.reports for select to authenticated using (public.is_member() and user_id = auth.uid());

-- Vote totals: members only.
create or replace function public.vote_scores(t text, ids text[])
returns table (target_id text, score integer)
language sql stable security definer set search_path = public as $$
  select v.target_id, coalesce(sum(v.value), 0)::integer
  from public.votes v
  where public.is_member() and v.target_type = t and v.target_id = any (ids)
  group by v.target_id
$$;
revoke all on function public.vote_scores(text, text[]) from public, anon;
grant execute on function public.vote_scores(text, text[]) to authenticated;

-- Optional: remove anonymous test users (and their rows) left from before this change.
-- delete from auth.users where is_anonymous;
