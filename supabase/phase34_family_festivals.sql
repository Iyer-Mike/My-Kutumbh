-- =====================================================================
-- Phase 34: festival days a family keeps of its own. Built-in festivals
-- live in the app; this table holds the ones the Prime Member adds
-- (a family's own occasions, or a correction of a date for their region).
-- Everyone in the family reads them; only the Prime Member adds or removes.
-- =====================================================================
create table if not exists public.family_festivals (
  id            uuid primary key default gen_random_uuid(),
  kutumbh_id    uuid not null references public.kutumbhs(id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 80),
  festival_date date not null,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now()
);
create index if not exists family_festivals_kutumbh_date_idx on public.family_festivals (kutumbh_id, festival_date);

alter table public.family_festivals enable row level security;

drop policy if exists "family_festivals_select" on public.family_festivals;
drop policy if exists "family_festivals_insert" on public.family_festivals;
drop policy if exists "family_festivals_delete" on public.family_festivals;

create policy "family_festivals_select" on public.family_festivals
  for select using (kutumbh_id in (select public.my_kutumbh_ids()));
create policy "family_festivals_insert" on public.family_festivals
  for insert with check (kutumbh_id in (select public.my_prime_kutumbh_ids()));
create policy "family_festivals_delete" on public.family_festivals
  for delete using (kutumbh_id in (select public.my_prime_kutumbh_ids()));
