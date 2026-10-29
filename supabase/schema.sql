-- ABB HELP ME: shared community data. Run once in Supabase > SQL Editor.
-- Only work questions, achievements, their answers, votes and reports are stored here.
-- Mood check-ins, personal notes, bookmarks and the profile stay encrypted on the device.
--
-- Then run 002_email_auth.sql, which restricts access to members signed in with a verified email.

create table if not exists public.posts (
  id text primary key default ('c-' || gen_random_uuid()::text),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('work_question', 'achievement')),
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
  reason text,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id),
  check (value = 1 or reason is not null)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  post_id text not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);

create index if not exists comments_post_idx on public.comments (post_id);
create index if not exists posts_created_idx on public.posts (created_at desc);

alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.votes enable row level security;
alter table public.reports enable row level security;

-- Everyone signed in can read the community; you can only change your own rows.
create policy "posts read" on public.posts for select to authenticated using (true);
create policy "posts insert own" on public.posts for insert to authenticated with check (user_id = auth.uid());
create policy "posts update own" on public.posts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "posts delete own" on public.posts for delete to authenticated using (user_id = auth.uid());

create policy "comments read" on public.comments for select to authenticated using (true);
create policy "comments insert own" on public.comments for insert to authenticated with check (user_id = auth.uid());
create policy "comments delete own" on public.comments for delete to authenticated using (user_id = auth.uid());

-- Votes are private to the voter; totals come from vote_scores() below.
create policy "votes read own" on public.votes for select to authenticated using (user_id = auth.uid());
create policy "votes insert own" on public.votes for insert to authenticated with check (user_id = auth.uid());
create policy "votes update own" on public.votes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "votes delete own" on public.votes for delete to authenticated using (user_id = auth.uid());

-- Reports can be written but not read back by other users (review them in the dashboard).
create policy "reports insert own" on public.reports for insert to authenticated with check (user_id = auth.uid());
create policy "reports read own" on public.reports for select to authenticated using (user_id = auth.uid());

-- Total score per item without exposing who voted.
create or replace function public.vote_scores(t text, ids text[])
returns table (target_id text, score integer)
language sql stable security definer set search_path = public as $$
  select v.target_id, coalesce(sum(v.value), 0)::integer
  from public.votes v
  where v.target_type = t and v.target_id = any (ids)
  group by v.target_id
$$;
revoke all on function public.vote_scores(text, text[]) from public, anon;
grant execute on function public.vote_scores(text, text[]) to authenticated;

-- "Delete all my data" in the app: removing the auth user cascades to everything above.
create or replace function public.delete_my_data()
returns void
language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid()
$$;
revoke all on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;
