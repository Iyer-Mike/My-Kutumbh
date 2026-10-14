-- Audit, 14 Oct 2026: behaviour-preserving database fixes.
-- Run once in Supabase → SQL Editor (or applied by Claude as migration "audit_safe_fixes").

-- 1. Security rules: evaluate auth.uid() once per query instead of once per row (same meaning, faster)
do $$
declare p record; q text; w text; stmt text;
begin
  for p in select tablename, policyname, qual, with_check from pg_policies
           where schemaname = 'public'
             and (coalesce(qual,'') || coalesce(with_check,'')) ~ 'auth\.uid\(\)'
             and (coalesce(qual,'') || coalesce(with_check,'')) !~ 'SELECT auth\.uid\(\)'
  loop
    q := replace(p.qual, 'auth.uid()', '(select auth.uid())');
    w := replace(p.with_check, 'auth.uid()', '(select auth.uid())');
    stmt := format('alter policy %I on public.%I', p.policyname, p.tablename);
    if q is not null then stmt := stmt || format(' using (%s)', q); end if;
    if w is not null then stmt := stmt || format(' with check (%s)', w); end if;
    execute stmt;
  end loop;
end $$;

-- 2. Signed-out visitors cannot call privileged functions; the sign-up trigger is not callable directly
revoke execute on function public.get_my_kutumbh_id(), public.is_app_admin(), public.my_kutumbh_ids(),
  public.my_prime_kutumbh_ids(), public.note_wrong_code(text) from anon, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- 3. Family roster view: read-only, signed-in members only
revoke all on public.family_roster from anon;
revoke insert, update, delete, truncate, trigger, references on public.family_roster from authenticated;

-- 4. Old food-photos store (unused by the app): no public reading, no new uploads
drop policy if exists "public_read" on storage.objects;
drop policy if exists "auth_upload" on storage.objects;

-- 5. Upload limits
update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array['image/*'] where id in ('family-photos','food-photos');
update storage.buckets set file_size_limit = 20971520, allowed_mime_types = array['image/*','application/pdf'] where id = 'medical-reports';

-- 6. Speed indexes
create index if not exists meal_plans_food_item_idx on public.meal_plans (food_item_id);
create index if not exists meal_logs_food_item_idx on public.meal_logs (food_item_id);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
create index if not exists menu_seen_kutumbh_idx on public.menu_seen (kutumbh_id);
create index if not exists recipes_food_item_idx on public.recipes (food_item_id);
create index if not exists pantry_items_food_item_idx on public.pantry_items (food_item_id);
