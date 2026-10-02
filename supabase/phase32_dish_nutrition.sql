-- =====================================================================
-- Phase 32: save reviewed nutrition for a family DISH (no recipe needed).
-- Prime Member only. n = per-serving values, stored per 100 g like the
-- rest of food_items. Additive: one function.
-- =====================================================================
create or replace function public.save_dish_nutrition(p_food_item_id uuid, n jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d record; w numeric; f numeric;
begin
  select * into d from public.food_items where id = p_food_item_id and kutumbh_id is not null;
  if not found or d.kutumbh_id not in (select public.my_prime_kutumbh_ids()) then
    raise exception 'Only the Prime Member can save nutrition';
  end if;
  w := coalesce((n->>'serving_weight_g')::numeric, 0);
  if w <= 0 or w > 2000 then raise exception 'Serving weight must be between 1 and 2000 g'; end if;
  if coalesce((n->>'kcal')::numeric, -1) < 0 or (n->>'kcal')::numeric > 5000 then
    raise exception 'Calories look wrong';
  end if;
  f := 100 / w;
  update public.food_items set
    serving_unit = coalesce(nullif(n->>'serving_unit',''), serving_unit),
    serving_weight_g = w,
    calories = round((n->>'kcal')::numeric * f, 1),
    protein_g = round(coalesce((n->>'protein_g')::numeric,0) * f, 2),
    carbs_g = round(coalesce((n->>'carbs_g')::numeric,0) * f, 2),
    fat_g = round(coalesce((n->>'fat_g')::numeric,0) * f, 2),
    fiber_g = round(coalesce((n->>'fibre_g')::numeric,0) * f, 2),
    iron_mg = round(coalesce((n->>'iron_mg')::numeric,0) * f, 2),
    calcium_mg = round(coalesce((n->>'calcium_mg')::numeric,0) * f, 2),
    vitamin_b12_mcg = round(coalesce((n->>'vit_b12_mcg')::numeric,0) * f, 3),
    sodium_mg = round(coalesce((n->>'sodium_mg')::numeric,0) * f, 1)
  where id = p_food_item_id;
end $$;
revoke all on function public.save_dish_nutrition(uuid, jsonb) from public, anon;
grant execute on function public.save_dish_nutrition(uuid, jsonb) to authenticated;
-- ROLLBACK: drop function public.save_dish_nutrition(uuid, jsonb);
