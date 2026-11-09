-- What each person has already looked at, kept on the server so phone and browser agree.
-- Used for: the "running short" pop-up (key short_items) and the shopping-list "!" (key shop_seen).
create table if not exists public.user_seen (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.user_seen enable row level security;
drop policy if exists user_seen_own on public.user_seen;
create policy user_seen_own on public.user_seen for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.user_seen to authenticated;
