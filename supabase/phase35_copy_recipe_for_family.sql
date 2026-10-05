-- =====================================================================
-- Phase 35: the Key Member makes the family's own version of a built-in
-- recipe, so small changes (less chilli, an extra step) can be made
-- without touching the shared recipe every family sees.
--
-- Additive only: one new column and one new function. The built-in
-- recipe and its dish are never changed. The copy is a Family Dish and a
-- Family Recipe, published at once, named "<dish> (Family)", and edited
-- afterwards with the existing family-recipe form.
-- =====================================================================

alter table public.recipes add column if not exists copied_from integer;
create index if not exists recipes_copied_from on public.recipes (kutumbh_id, copied_from) where copied_from is not null;

create or replace function public.copy_recipe_for_family(p_recipe_id integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  kid     uuid;
  r       record;
  d       record;
  new_id  integer;
  dish_id uuid := gen_random_uuid();
begin
  if uid is null then raise exception 'Not signed in'; end if;

  select k into kid from public.my_prime_kutumbh_ids() k limit 1;
  if kid is null then raise exception 'Only the Key Member can make the family''s version'; end if;

  select * into r from public.recipes where id = p_recipe_id and kutumbh_id is null;
  if not found then raise exception 'Only a built-in recipe can be copied'; end if;

  -- Already made: hand back the same copy
  select id into new_id from public.recipes where kutumbh_id = kid and copied_from = p_recipe_id limit 1;
  if found then return new_id; end if;

  select * into d from public.food_items where recipe_id = p_recipe_id and kutumbh_id is null limit 1;
  if not found then raise exception 'This recipe has no dish to copy'; end if;

  new_id := nextval('public.recipes_family_id_seq');

  insert into public.food_items (
    id, name, name_hi, name_ta, category, calories, protein_g, carbs_g, fat_g, fiber_g,
    virya, vata_effect, pitta_effect, kapha_effect, is_south_indian, serving_unit, serving_weight_g, season,
    ingredients, preparation, iron_mg, calcium_mg, vitamin_b12_mcg, vitamin_c_mg, folate_mcg, sodium_mg, potassium_mg,
    rasa, guna, vipaka, cuisine, diet, is_jain, meal_hint, kutumbh_id, created_by, needs_review
  ) values (
    dish_id, d.name || ' (Family)', d.name_hi, d.name_ta, d.category, d.calories, d.protein_g, d.carbs_g, d.fat_g, d.fiber_g,
    d.virya, d.vata_effect, d.pitta_effect, d.kapha_effect, d.is_south_indian, d.serving_unit, d.serving_weight_g, d.season,
    d.ingredients, d.preparation, d.iron_mg, d.calcium_mg, d.vitamin_b12_mcg, d.vitamin_c_mg, d.folate_mcg, d.sodium_mg, d.potassium_mg,
    d.rasa, d.guna, d.vipaka, d.cuisine, d.diet, d.is_jain, d.meal_hint, kid, uid, false
  );

  insert into public.recipes (
    id, name, source_cuisine, cuisine, diet, is_jain, dish_type, serves, prep_time, cook_time, blurb, tip, badge, tags,
    ingredients, method, meal_hint, serving_unit, serving_weight_g,
    kcal, protein_g, carbs_g, fat_g, fibre_g, iron_mg, calcium_mg, vit_b12_mcg, sodium_mg,
    nutrition_estimated, kutumbh_id, created_by, food_item_id, status, in_bucket, copied_from
  ) values (
    new_id, d.name || ' (Family)', r.source_cuisine, r.cuisine, r.diet, r.is_jain, r.dish_type, r.serves, r.prep_time, r.cook_time, r.blurb, r.tip, r.badge, r.tags,
    r.ingredients, r.method, r.meal_hint, r.serving_unit, r.serving_weight_g,
    r.kcal, r.protein_g, r.carbs_g, r.fat_g, r.fibre_g, r.iron_mg, r.calcium_mg, r.vit_b12_mcg, r.sodium_mg,
    r.nutrition_estimated, kid, uid, dish_id, 'published', false, p_recipe_id
  );

  update public.food_items set recipe_id = new_id where id = dish_id;
  return new_id;
end $$;

revoke all on function public.copy_recipe_for_family(integer) from public, anon;
grant execute on function public.copy_recipe_for_family(integer) to authenticated;

-- ROLLBACK:
--   drop function public.copy_recipe_for_family(integer);
--   drop index if exists public.recipes_copied_from;
--   alter table public.recipes drop column copied_from;
