-- =====================================================================
-- My Kutumbh - foundation fixes           prepared 30 Sep 2026
-- FOR REVIEW. NOT APPLIED to any database.
--
-- Written against the live schema of project zmqvimdktsbmemitvogg as
-- read on 30 Sep 2026. Apply to a Supabase BRANCH first, run the
-- checks in section E, click through the app as a second (non-Prime)
-- member, then apply to production.
--
-- Order matters: A (privacy) -> B (duplicates and speed) -> C (indexes).
-- Each part can be applied on its own. Section F undoes section A/B.
-- =====================================================================


-- =====================================================================
-- A. PRIVACY  (tested live on 30 Sep: these three are real leaks)
-- =====================================================================

-- A1. Profiles: a non-Prime member could read every other member's full
--     row (weight, date of birth, conditions, allergies, medicines).
--     Tested: as a plain member, 2 other profiles visible, both with
--     private fields. The narrow view family_roster (name, dosha, photo,
--     role) is the intended way to see the family, so the broad policy goes.
--
--     DEPENDENCY: every screen that shows another member's name or photo
--     must read public.family_roster, not public.profiles. Check the
--     Kutumbh page, the Home family strip, and meal roll-ups.
drop policy if exists "Users can view own and family profiles" on public.profiles;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = (select auth.uid())
    or id in (
      select km.user_id from public.kutumbh_members km
      where km.kutumbh_id in (select public.my_prime_kutumbh_ids())
    )
  );

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert with check (id = (select auth.uid()));

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (id = (select auth.uid()));


-- A2. Invitations: any signed-in account, even one with no family, could
--     read every active invitation row. Tested: a stranger saw 3 active
--     invites (all using the older invite_code; none had a join_code today,
--     but a join_code row would be exposed the same way).
--     Now only the person who made it, or the family's Prime Member.
drop policy if exists invites_select on public.kutumbh_invites;
create policy invites_select on public.kutumbh_invites
  for select to authenticated using (
    created_by = (select auth.uid())
    or kutumbh_id in (select public.my_prime_kutumbh_ids())
  );

drop policy if exists invites_update on public.kutumbh_invites;
create policy invites_update on public.kutumbh_invites
  for update using (created_by = (select auth.uid()));

drop policy if exists invites_insert on public.kutumbh_invites;
create policy invites_insert on public.kutumbh_invites
  for insert with check (
    exists (
      select 1 from public.kutumbhs k
      where k.id = kutumbh_invites.kutumbh_id
        and k.created_by = (select auth.uid())
    )
  );

-- OPTIONAL A2b. Only needed if the join page shows the family's name
-- BEFORE the person joins (the old policy on kutumbhs allowed that by
-- letting any signed-in user read a family that had an active invite).
-- This gives that one fact, for one code, and nothing else.
create or replace function public.preview_invite(p_code text)
returns table (kutumbh_name text, photo_path text)
language sql stable security definer
set search_path = public
as $$
  select k.name, k.photo_path
  from public.kutumbh_invites i
  join public.kutumbhs k on k.id = i.kutumbh_id
  where i.is_active
    and i.expires_at > now()
    and (i.invite_code = p_code or i.join_code = p_code)
  limit 1
$$;
revoke all on function public.preview_invite(text) from public, anon;
grant execute on function public.preview_invite(text) to authenticated;


-- A3. Kutumbhs: drop the "anyone with an active invite" read. A member
--     sees their own families; the creator can still read the row they
--     just inserted (needed for insert ... returning before the
--     membership row exists).
drop policy if exists "Anyone can view kutumbh via active invite" on public.kutumbhs;
drop policy if exists kutumbh_select on public.kutumbhs;
create policy kutumbh_select on public.kutumbhs
  for select to authenticated using (
    id in (select public.my_kutumbh_ids())
    or created_by = (select auth.uid())
  );

drop policy if exists kutumbh_insert on public.kutumbhs;
create policy kutumbh_insert on public.kutumbhs
  for insert with check ((select auth.uid()) = created_by);

drop policy if exists kutumbh_update on public.kutumbhs;
drop policy if exists kutumbhs_update_prime on public.kutumbhs;
create policy kutumbhs_update_prime on public.kutumbhs
  for update
  using      (id in (select public.my_prime_kutumbh_ids()))
  with check (id in (select public.my_prime_kutumbh_ids()));

drop policy if exists kutumbh_delete on public.kutumbhs;
create policy kutumbh_delete on public.kutumbhs
  for delete using ((select auth.uid()) = created_by);


-- A4. Functions that only make sense signed-in should not be callable
--     by the anonymous role. (The admin_* ones already refuse non-admins
--     inside; this is defence in depth.) Policy-helper functions such as
--     my_kutumbh_ids() are deliberately NOT touched.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'admin\_%'
           or p.proname in ('forget_me','remove_member','hand_over_prime',
                            'reclaim_prime','claim_prime','leave_kutumbh',
                            'join_kutumbh_with_invite','join_with_code',
                            'claim_app_invite','apply_family_dish',
                            'flag_pantry_low','set_member_photo',
                            'reply_to_admin','ai_spend_month_total'))
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
  end loop;
end $$;
-- Leave alone on purpose: note_wrong_code (check whether the app calls it
-- before sign-in), handle_new_user (trigger).


-- =====================================================================
-- B. DUPLICATES AND SPEED
--    Same rules, fewer of them, and auth.uid() wrapped in (select ...)
--    so Postgres evaluates it once per query, not once per row.
-- =====================================================================

-- B1. meal_logs: meal_logs_select already covers "own OR family", so the
--     older policy is redundant.
drop policy if exists "Members can view family meal logs" on public.meal_logs;

drop policy if exists meal_logs_select on public.meal_logs;
create policy meal_logs_select on public.meal_logs
  for select using (
    user_id = (select auth.uid())
    or user_id in (
      select km.user_id from public.kutumbh_members km
      where km.kutumbh_id in (select public.my_kutumbh_ids())
    )
  );

drop policy if exists meal_logs_insert on public.meal_logs;
create policy meal_logs_insert on public.meal_logs
  for insert with check (user_id = (select auth.uid()));

drop policy if exists meal_logs_update on public.meal_logs;
create policy meal_logs_update on public.meal_logs
  for update using (user_id = (select auth.uid()));

drop policy if exists meal_logs_delete on public.meal_logs;
create policy meal_logs_delete on public.meal_logs
  for delete using (user_id = (select auth.uid()));


-- B2. kutumbh_members: four SELECT policies, one is enough
--     ("all in my kutumbhs" already includes my own row and the roster).
drop policy if exists km_select on public.kutumbh_members;
drop policy if exists "Users can view own membership" on public.kutumbh_members;
drop policy if exists "Members can view kutumbh roster" on public.kutumbh_members;
-- kept as is: "Members can view all in their kutumbh"

drop policy if exists km_insert on public.kutumbh_members;
create policy km_insert on public.kutumbh_members
  for insert with check (user_id = (select auth.uid()));

drop policy if exists km_delete on public.kutumbh_members;
create policy km_delete on public.kutumbh_members
  for delete using (user_id = (select auth.uid()));


-- B3. meal_plans: same rules, wrapped.
drop policy if exists "Family members can view meal plans" on public.meal_plans;
create policy "Family members can view meal plans" on public.meal_plans
  for select using (
    user_id = (select auth.uid())
    or kutumbh_id in (select public.my_kutumbh_ids())
  );

drop policy if exists "Family members can insert meal plans" on public.meal_plans;
create policy "Family members can insert meal plans" on public.meal_plans
  for insert with check (
    user_id = (select auth.uid())
    and (kutumbh_id is null or kutumbh_id in (select public.my_kutumbh_ids()))
  );

drop policy if exists "Users can update their own meal plans" on public.meal_plans;
create policy "Users can update their own meal plans" on public.meal_plans
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own meal plans" on public.meal_plans;
create policy "Users can delete their own meal plans" on public.meal_plans
  for delete using (user_id = (select auth.uid()));


-- B4. medical_records: wrapped only (own rows; Prime can also read the family's).
drop policy if exists "Users can manage own medical records" on public.medical_records;
create policy "Users can manage own medical records" on public.medical_records
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));


-- =====================================================================
-- C. INDEXES  (tables are small; plain CREATE INDEX is instant)
-- =====================================================================
-- Every policy asks "which families is this user in?". The existing
-- unique index starts with kutumbh_id, so a lookup by user_id scanned
-- the whole table (about 1,900 scans so far).
create index if not exists kutumbh_members_by_user
  on public.kutumbh_members (user_id) include (kutumbh_id, role);

-- Home, Log and Insights read one person's meals for one day or range.
create index if not exists meal_logs_person_day
  on public.meal_logs (user_id, logged_date desc);

-- The shared menu is read by family and date.
create index if not exists meal_plans_family_day
  on public.meal_plans (kutumbh_id, planned_date);
create index if not exists meal_plans_person_day
  on public.meal_plans (user_id, planned_date);

-- Reports are read per person; invitations per family.
create index if not exists medical_records_person
  on public.medical_records (user_id);
create index if not exists kutumbh_invites_by_family
  on public.kutumbh_invites (kutumbh_id);


-- =====================================================================
-- D. LEFT ALONE ON PURPOSE
-- =====================================================================
-- family_roster is SECURITY DEFINER by design: it is the narrow view that
-- lets members see each other's name, dosha and photo without seeing the
-- private profile row, and it filters by my_kutumbh_ids(). The advisor
-- flags it as an error; that is expected. Keep it, but note it must never
-- gain a private column.
--
-- Not fixed here (needs the app or a settings switch, not SQL):
--   * leaked-password protection (Auth settings in the dashboard)
--   * app_invites / join_attempts have RLS but no policy: correct for
--     tables only touched by security-definer functions; add a comment.
comment on table public.app_invites   is 'RLS on, no policies by design: only security-definer functions touch this table.';
comment on table public.join_attempts is 'RLS on, no policies by design: only security-definer functions touch this table.';


-- =====================================================================
-- E. CHECKS - run on the branch after applying. Expected results shown.
--    Each runs as a role, sees only counts, and ends with the transaction.
-- =====================================================================
-- E1. A stranger (signed in, no family) sees no invitations and no families.
--   select set_config('request.jwt.claims',
--     '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
--   set local role authenticated;
--   select (select count(*) from public.kutumbh_invites) as invites,   -- expect 0
--          (select count(*) from public.kutumbhs)        as families;  -- expect 0
--
-- E2. A plain member sees only their own profile row.
--   select set_config('request.jwt.claims', json_build_object('sub',
--     (select user_id from public.kutumbh_members where role='member' limit 1),
--     'role','authenticated')::text, true);
--   set local role authenticated;
--   select count(*) from public.profiles;                               -- expect 1
--   select count(*) from public.family_roster;                          -- expect the whole family
--
-- E3. The Prime Member still sees the whole family's profiles and reports.
--
-- E4. Click through as a second member: sign in, Home, Log a meal,
--     Kutumbh page (names and photos), join with an invite code.


-- =====================================================================
-- F. ROLLBACK for sections A and B (the original policies, verbatim)
-- =====================================================================
-- create policy "Users can view own and family profiles" on public.profiles for select using (
--   (id = auth.uid()) or (id in (select km.user_id from kutumbh_members km
--     where km.kutumbh_id in (select my_kutumbh_ids()))));
-- create policy invites_select on public.kutumbh_invites for select using (
--   (auth.role() = 'authenticated') and (is_active = true));
-- create policy "Anyone can view kutumbh via active invite" on public.kutumbhs for select using (
--   (id in (select kutumbh_id from kutumbh_members where user_id = auth.uid()))
--   or (id in (select kutumbh_id from kutumbh_invites
--              where is_active = true and expires_at > now())));
-- create policy "Members can view family meal logs" on public.meal_logs for select using (
--   user_id in (select user_id from kutumbh_members where kutumbh_id in
--     (select kutumbh_id from kutumbh_members where user_id = auth.uid())));
-- create policy km_select on public.kutumbh_members for select using (user_id = auth.uid());
-- create policy "Users can view own membership" on public.kutumbh_members for select using (user_id = auth.uid());
-- create policy "Members can view kutumbh roster" on public.kutumbh_members for select using (kutumbh_id = get_my_kutumbh_id());
-- grant execute on all functions in schema public to anon;   -- only if section A4 broke a pre-login call
-- Indexes (section C) are harmless; drop them with: drop index <name>;
