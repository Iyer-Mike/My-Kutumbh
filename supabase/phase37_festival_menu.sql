-- =====================================================================
-- Phase 37: festival menus as a draft the Key Member publishes, and dishes
-- the family suggests for the Key Member to approve or decline.
--  festival_menus      one row per family per festival day; published_at
--                      empty = still a draft (the family does not see it)
--  festival_suggestions a member's suggestion for a meal on that day
-- =====================================================================
create table if not exists public.festival_menus (
  kutumbh_id    uuid not null references public.kutumbhs(id) on delete cascade,
  festival_date date not null,
  published_at  timestamptz,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  primary key (kutumbh_id, festival_date)
);
alter table public.festival_menus enable row level security;
drop policy if exists "festival_menus_select" on public.festival_menus;
drop policy if exists "festival_menus_insert" on public.festival_menus;
drop policy if exists "festival_menus_update" on public.festival_menus;
drop policy if exists "festival_menus_delete" on public.festival_menus;
create policy "festival_menus_select" on public.festival_menus
  for select using (kutumbh_id in (select public.my_kutumbh_ids()));
create policy "festival_menus_insert" on public.festival_menus
  for insert with check (kutumbh_id in (select public.my_prime_kutumbh_ids()));
create policy "festival_menus_update" on public.festival_menus
  for update using (kutumbh_id in (select public.my_prime_kutumbh_ids()))
  with check (kutumbh_id in (select public.my_prime_kutumbh_ids()));
create policy "festival_menus_delete" on public.festival_menus
  for delete using (kutumbh_id in (select public.my_prime_kutumbh_ids()));

create table if not exists public.festival_suggestions (
  id            uuid primary key default gen_random_uuid(),
  kutumbh_id    uuid not null references public.kutumbhs(id) on delete cascade,
  festival_date date not null,
  meal_slot     text not null check (meal_slot in ('breakfast','morning_snack','lunch','evening_snack','dinner')),
  food_item_id  uuid references public.food_items(id) on delete set null,
  food_name     text not null check (char_length(btrim(food_name)) between 1 and 120),
  note          text check (note is null or char_length(note) <= 200),
  suggested_by  uuid not null default auth.uid(),
  status        text not null default 'pending' check (status in ('pending','approved','declined')),
  created_at    timestamptz not null default now()
);
create index if not exists festival_suggestions_day_idx on public.festival_suggestions (kutumbh_id, festival_date);
alter table public.festival_suggestions enable row level security;
drop policy if exists "festival_suggestions_select" on public.festival_suggestions;
drop policy if exists "festival_suggestions_insert" on public.festival_suggestions;
drop policy if exists "festival_suggestions_update" on public.festival_suggestions;
drop policy if exists "festival_suggestions_delete" on public.festival_suggestions;
-- the Key Member reads all of them; everyone else only their own
create policy "festival_suggestions_select" on public.festival_suggestions
  for select using (
    suggested_by = auth.uid()
    or kutumbh_id in (select public.my_prime_kutumbh_ids())
  );
create policy "festival_suggestions_insert" on public.festival_suggestions
  for insert with check (
    suggested_by = auth.uid() and status = 'pending'
    and kutumbh_id in (select public.my_kutumbh_ids())
  );
create policy "festival_suggestions_update" on public.festival_suggestions
  for update using (kutumbh_id in (select public.my_prime_kutumbh_ids()))
  with check (kutumbh_id in (select public.my_prime_kutumbh_ids()));
create policy "festival_suggestions_delete" on public.festival_suggestions
  for delete using (
    kutumbh_id in (select public.my_prime_kutumbh_ids())
    or (suggested_by = auth.uid() and status = 'pending')
  );
