-- OPTIONAL DEMO DATA for the admin dashboard's wellbeing screens. Run in Supabase > SQL Editor, after setup.sql.
--
-- The dashboard hides any group of fewer than 5 people, so with only a handful of real users the mood charts stay
-- empty. This adds 84 demo accounts across 12 roles with about 60 days of made-up check-ins so every chart has
-- something to show. It adds ONLY accounts and private mood check-ins: no posts, nothing in anyone's feed, and the
-- accounts cannot sign in. The numbers are invented and say nothing about real people.
--
-- Safe to run again (it skips accounts that already exist).
-- REMOVE IT before real use (this deletes the demo accounts and their check-ins):
--   delete from auth.users where email like 'demo.%@outlook.com';

do $$
declare
  r record;
  i integer;
  d integer;
  uid uuid;
  low_p numeric;
  roll numeric;
  m text;
  tg text[];
  exps text[] := array['lt1', '1to3', '3to5', '5to10', '10plus'];
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Run supabase/setup.sql first (all of it, to the end), then run this again.';
  end if;

  for r in
    select * from (values
      -- role,             how many, chance a check-in is a low day, usual tags
      ('intern',           8, 0.34, array['workload', 'sleep', 'learning']),
      ('apprentice',       6, 0.28, array['learning', 'sleep', 'team']),
      ('engineer',        12, 0.24, array['workload', 'team', 'learning']),
      ('senior_engineer',  8, 0.22, array['workload', 'team', 'recognition']),
      ('technician',       6, 0.20, array['health', 'workload', 'team']),
      ('operations',       8, 0.30, array['workload', 'sleep', 'health']),
      ('sales',            6, 0.26, array['workload', 'recognition', 'team']),
      ('project_manager',  6, 0.31, array['workload', 'team', 'sleep']),
      ('manager',          6, 0.27, array['workload', 'team', 'family']),
      ('hr',               6, 0.21, array['team', 'recognition', 'workload']),
      ('it',               6, 0.23, array['workload', 'learning', 'sleep']),
      ('finance',          6, 0.19, array['workload', 'team', 'family'])
    ) as t(role, n, low_chance, tags)
  loop
    for i in 1..r.n loop
      if exists (select 1 from auth.users where email = format('demo.%s.%s@outlook.com', r.role, i)) then continue; end if;
      uid := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data,
                              raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', format('demo.%s.%s@outlook.com', r.role, i),
              '', now(), '{"provider":"email","providers":["email"]}', '{}', now() - interval '70 days', now(), '', '', '', '');
      insert into public.profiles (id, display_name, role, experience, lock_enabled, onboarding_complete, created_at)
      values (uid, 'Demo ' || r.role || ' ' || i, r.role,
              case when r.role = 'intern' then 'lt1' when r.role = 'apprentice' then '1to3' else exps[1 + (i % 5)] end,
              false, true, now() - interval '70 days');

      for d in 0..59 loop
        -- about every other day; a little less often at weekends
        continue when random() > case when extract(dow from current_date - d) in (0, 6) then 0.25 else 0.55 end;
        -- Mondays are a little harder; the last two weeks improve slightly
        low_p := r.low_chance
                 + case when extract(dow from current_date - d) = 1 then 0.08 else 0 end
                 - case when d < 14 then 0.04 else 0 end;
        roll := random();
        m := case when roll < low_p * 0.3 then 'struggling'
                  when roll < low_p then 'not_great'
                  when roll < low_p + (1 - low_p) * 0.45 then 'okay'
                  else 'great' end;
        tg := case when random() < 0.7 then array[r.tags[1 + floor(random() * 3)::int]] else '{}' end;
        insert into public.mood_checkins (user_id, mood, tags, created_at)
        values (uid, m, tg, (current_date - d) + time '09:00' + (random() * interval '8 hours'));
      end loop;
    end loop;
  end loop;
end $$;

select p.role, count(distinct p.id) as demo_people, count(c.id) as checkins
  from auth.users u join public.profiles p on p.id = u.id left join public.mood_checkins c on c.user_id = u.id
 where u.email like 'demo.%@outlook.com' group by p.role order by p.role;
