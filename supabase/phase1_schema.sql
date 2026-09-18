-- ═══════════════════════════════════════════════════════
--  My Kutumbh — Phase 1 Schema
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ═══════════════════════════════════════════════════════

-- ── 1. Create tables first (no policies yet) ────────────

create table public.kutumbhs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.kutumbh_members (
  id           uuid primary key default gen_random_uuid(),
  kutumbh_id   uuid not null references public.kutumbhs(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner','member')),
  joined_at    timestamptz not null default now(),
  unique(kutumbh_id, user_id)
);

create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  full_name           text,
  date_of_birth       date,
  gender              text check (gender in ('male','female','other')),
  height_cm           numeric(5,1),
  weight_kg           numeric(5,1),
  activity_level      text check (activity_level in ('sedentary','light','moderate','active','very_active')),
  prakriti_vata       int check (prakriti_vata between 0 and 20),
  prakriti_pitta      int check (prakriti_pitta between 0 and 20),
  prakriti_kapha      int check (prakriti_kapha between 0 and 20),
  primary_dosha       text check (primary_dosha in ('vata','pitta','kapha','vata-pitta','pitta-kapha','vata-kapha','tridosha')),
  onboarding_complete boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);


-- ── 2. Enable RLS on all tables ─────────────────────────

alter table public.kutumbhs        enable row level security;
alter table public.kutumbh_members enable row level security;
alter table public.profiles        enable row level security;


-- ── 3. RLS policies — kutumbhs ──────────────────────────

create policy "Members can view their kutumbh"
  on public.kutumbhs for select
  using (
    exists (
      select 1 from public.kutumbh_members km
      where km.kutumbh_id = id and km.user_id = auth.uid()
    )
  );

create policy "Owner can update kutumbh"
  on public.kutumbhs for update
  using (created_by = auth.uid());

create policy "Authenticated users can create kutumbh"
  on public.kutumbhs for insert
  with check (auth.uid() = created_by);


-- ── 4. RLS policies — kutumbh_members ───────────────────

create policy "Members can view their own membership"
  on public.kutumbh_members for select
  using (user_id = auth.uid());

create policy "Owner can manage members"
  on public.kutumbh_members for all
  using (
    exists (
      select 1 from public.kutumbhs k
      where k.id = kutumbh_id and k.created_by = auth.uid()
    )
  );

create policy "Users can join a kutumbh"
  on public.kutumbh_members for insert
  with check (user_id = auth.uid());


-- ── 5. RLS policies — profiles ──────────────────────────

create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());


-- ── 6. Auto-create profile row on every new signup ──────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── 7. Backfill profile for existing user (Mohan) ───────

insert into public.profiles (id, full_name)
select id, raw_user_meta_data->>'full_name'
from auth.users
where id not in (select id from public.profiles);
