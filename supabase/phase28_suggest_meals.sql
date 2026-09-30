-- =====================================================================
-- My Kutumbh - meal suggestions for the one-tap "Log" button
-- prepared 30 Sep 2026.   FOR REVIEW. NOT APPLIED to any database.
--
-- What it does
--   For the signed-in person and a day, returns ONE suggestion per meal
--   slot that has nothing logged yet, with the reason it was chosen:
--     1. planned       what the family put on that day's menu
--     2. same_weekday  what this person logged on the same weekday last week
--     3. last_time     what this person logged the last time they had
--                      that meal
--   Each suggestion is a whole meal (all its items and their calories),
--   so one tap can log it.
--
-- Why "last time" and not "usual"
--   After 12 days of history most dishes repeat only once or twice, so a
--   "usual" ranking would be mostly noise. Recent history is honest and
--   works from day two. Once a person has a few weeks of logs, a
--   "most often" source can be added as a fourth rule without changing
--   the shape of the result.
--
-- Safety
--   SECURITY INVOKER: it runs as the caller, so row-level security still
--   decides what can be read. It reads only the caller's own logs and the
--   caller's own families' menu. It writes nothing.
--
-- Depends on: public.my_kutumbh_ids()  (exists)
-- =====================================================================

create or replace function public.suggest_meals(
  p_date date default ((now() at time zone 'Asia/Kolkata')::date)
)
returns table (
  meal_slot   text,
  source      text,        -- 'planned' | 'same_weekday' | 'last_time'
  based_on    date,        -- the day the suggestion comes from
  items       jsonb,       -- [{food_item_id, food_name, quantity_g, quantity_unit, calories}]
  total_kcal  numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with me as (
    select auth.uid() as uid
  ),
  slots(slot, ord) as (
    values ('breakfast', 1), ('morning_snack', 2), ('lunch', 3),
           ('evening_snack', 4), ('dinner', 5)
  ),
  -- slots the person has already logged for this day: no suggestion needed
  already as (
    select distinct l.meal_slot
    from public.meal_logs l, me
    where l.user_id = me.uid and l.logged_date = p_date
  ),
  -- 1. the family's menu for the day (one row per dish, however many
  --    members added it)
  plan_dishes as (
    select distinct on (p.meal_slot, coalesce(p.food_item_id::text, lower(p.food_name)))
           p.meal_slot, p.food_item_id, p.food_name,
           p.quantity_g, p.quantity_unit, p.calories, p.created_at
    from public.meal_plans p
    where p.planned_date = p_date
      and p.kutumbh_id in (select public.my_kutumbh_ids())
    order by p.meal_slot, coalesce(p.food_item_id::text, lower(p.food_name)), p.created_at
  ),
  planned as (
    select d.meal_slot,
           'planned'::text as source,
           p_date          as based_on,
           1               as pri,
           jsonb_agg(jsonb_build_object(
             'food_item_id',  d.food_item_id,
             'food_name',     d.food_name,
             'quantity_g',    d.quantity_g,
             'quantity_unit', d.quantity_unit,
             'calories',      d.calories) order by d.created_at) as items,
           sum(coalesce(d.calories, 0)) as kcal
    from plan_dishes d
    group by d.meal_slot
  ),
  -- the person's own earlier meals, one row per (slot, day)
  mine as (
    select l.meal_slot, l.logged_date,
           jsonb_agg(jsonb_build_object(
             'food_item_id',  l.food_item_id,
             'food_name',     l.food_name,
             'quantity_g',    l.quantity_g,
             'quantity_unit', l.quantity_unit,
             'calories',      l.calories) order by l.logged_at) as items,
           sum(coalesce(l.calories, 0)) as kcal
    from public.meal_logs l, me
    where l.user_id = me.uid
      and l.logged_date < p_date
    group by l.meal_slot, l.logged_date
  ),
  -- 2. the same weekday last week
  same_weekday as (
    select m.meal_slot, 'same_weekday'::text, m.logged_date, 2, m.items, m.kcal
    from mine m
    where m.logged_date = p_date - 7
  ),
  -- 3. the last time they had this meal
  last_time as (
    select distinct on (m.meal_slot)
           m.meal_slot, 'last_time'::text, m.logged_date, 3, m.items, m.kcal
    from mine m
    order by m.meal_slot, m.logged_date desc
  ),
  candidates as (
    select * from planned
    union all select * from same_weekday
    union all select * from last_time
  ),
  best as (
    select distinct on (c.meal_slot) c.*
    from candidates c
    order by c.meal_slot, c.pri
  )
  select b.meal_slot, b.source, b.based_on, b.items, b.kcal
  from best b
  join slots s on s.slot = b.meal_slot
  where b.meal_slot not in (select a.meal_slot from already a)
  order by s.ord
$$;

revoke all on function public.suggest_meals(date) from public, anon;
grant execute on function public.suggest_meals(date) to authenticated;

comment on function public.suggest_meals(date) is
  'One suggested meal per empty slot for the signed-in person: family menu, else same weekday last week, else last time. Read-only.';

-- =====================================================================
-- How the app would use it (one call per Home screen, not one per row)
--   const { data } = await supabase.rpc('suggest_meals', { p_date: '2026-09-30' })
--   -> show data[i].items as the row's second line, source as the label:
--        planned        "Planned by the family: ..."
--        same_weekday   "Same as last Wednesday: ..."
--        last_time      "Same as last time: ..."
--   -> tapping Log inserts one meal_logs row per item, copying
--      food_item_id, food_name, quantity_g, quantity_unit and calories.
--
-- Index that keeps it fast (already in my-kutumbh-foundation-fixes.sql):
--   meal_logs (user_id, logged_date desc)
-- =====================================================================
