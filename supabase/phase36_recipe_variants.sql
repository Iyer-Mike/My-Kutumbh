-- =====================================================================
-- Phase 36: a family can keep several versions of one recipe.
--
-- The Key Member names each copy ("Barnyard Millet Dosa (Kuthiraivali
-- Dosa)"); the fixed "(Family)" suffix goes away. A copy starts in the
-- nutrition bucket, because its ingredients differ from the original,
-- and carries no Tamil/Hindi name of the original. A family recipe can
-- be renamed afterwards, and its dish is renamed with it.
--
-- Replaces copy_recipe_for_family(integer) and update_family_recipe.
-- =====================================================================

drop function if exists public.copy_recipe_for_family(integer);

create or replace function public.copy_recipe_for_family(p_recipe_id integer, p_name text default null)
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
  nm      text := nullif(trim(coalesce(p_name, '')), '');
  dish_id uuid := gen_random_uuid();
begin
  if uid is null then raise exception 'Not signed in'; end if;

  select k into kid from public.my_prime_kutumbh_ids() k limit 1;
  if kid is null then raise exception 'Only the Key Member can make the family''s version'; end if;
  if nm is not null and char_length(nm) > 80 then raise exception 'Name is too long'; end if;

  select * into r from public.recipes where id = p_recipe_id and kutumbh_id is null;
  if not found then raise exception 'Only a built-in recipe can be copied'; end if;

  -- No name given: hand back a copy already made, if any
  if nm is null then
    select id into new_id from public.recipes where kutumbh_id = kid and copied_from = p_recipe_id order by id limit 1;
    if found then return new_id; end if;
  end if;

  select * into d from public.food_items where recipe_id = p_recipe_id and kutumbh_id is null limit 1;
  if not found then raise exception 'This recipe has no dish to copy'; end if;

  nm := coalesce(nm, d.name || ' (Family)');
  new_id := nextval('public.recipes_family_id_seq');

  insert into public.food_items (
    id, name, name_hi, name_ta, category, calories, protein_g, carbs_g, fat_g, fiber_g,
    virya, vata_effect, pitta_effect, kapha_effect, is_south_indian, serving_unit, serving_weight_g, season,
    ingredients, preparation, iron_mg, calcium_mg, vitamin_b12_mcg, vitamin_c_mg, folate_mcg, sodium_mg, potassium_mg,
    rasa, guna, vipaka, cuisine, diet, is_jain, meal_hint, kutumbh_id, created_by, needs_review
  ) values (
    dish_id, nm, null, null, d.category, d.calories, d.protein_g, d.carbs_g, d.fat_g, d.fiber_g,
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
    new_id, nm, r.source_cuisine, r.cuisine, r.diet, r.is_jain, r.dish_type, r.serves, r.prep_time, r.cook_time, r.blurb, r.tip, r.badge, r.tags,
    r.ingredients, r.method, r.meal_hint, r.serving_unit, r.serving_weight_g,
    r.kcal, r.protein_g, r.carbs_g, r.fat_g, r.fibre_g, r.iron_mg, r.calcium_mg, r.vit_b12_mcg, r.sodium_mg,
    true, kid, uid, dish_id, 'published', true, p_recipe_id
  );

  update public.food_items set recipe_id = new_id where id = dish_id;
  return new_id;
end $$;

revoke all on function public.copy_recipe_for_family(integer, text) from public, anon;
grant execute on function public.copy_recipe_for_family(integer, text) to authenticated;

-- Renaming: a family recipe's name can change with its ingredients
create or replace function public.update_family_recipe(p_recipe_id integer, p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record; uid uuid := auth.uid(); is_prime boolean; ing text[]; mth text[];
  nm text := nullif(trim(coalesce(p->>'name', '')), '');
begin
  select * into r from public.recipes where id = p_recipe_id and kutumbh_id is not null;
  if not found then raise exception 'No such family recipe'; end if;
  is_prime := r.kutumbh_id in (select public.my_prime_kutumbh_ids());
  if not (is_prime or (r.created_by = uid and r.status = 'draft')) then
    raise exception 'Not allowed';
  end if;
  if nm is not null and char_length(nm) > 80 then raise exception 'Name is too long'; end if;

  ing := array(select trim(x) from jsonb_array_elements_text(coalesce(p->'ingredients','[]'::jsonb)) x where trim(x) <> '');
  mth := array(select trim(x) from jsonb_array_elements_text(coalesce(p->'method','[]'::jsonb)) x where trim(x) <> '');
  if coalesce(array_length(ing,1),0) = 0 then raise exception 'Add at least one ingredient'; end if;
  if coalesce(array_length(mth,1),0) = 0 then raise exception 'Add at least one step'; end if;

  update public.recipes set
    name      = coalesce(nm, name),
    cuisine   = coalesce(nullif(p->>'cuisine',''), cuisine),
    diet      = coalesce(nullif(p->>'diet',''), diet),
    is_jain   = coalesce((p->>'is_jain')::boolean, is_jain),
    serves    = nullif(p->>'serves',''),
    prep_time = nullif(p->>'prep_time',''),
    cook_time = nullif(p->>'cook_time',''),
    blurb     = nullif(p->>'blurb',''),
    tip       = nullif(p->>'tip',''),
    ingredients = ing,
    method      = mth,
    in_bucket   = case when is_prime and p ? 'in_bucket' then (p->>'in_bucket')::boolean else in_bucket end
  where id = p_recipe_id;

  -- The dish carries the same name, so menus and logs show it
  if nm is not null and is_prime then
    update public.food_items set name = nm
     where kutumbh_id = r.kutumbh_id and (id = r.food_item_id or recipe_id = p_recipe_id);
  end if;
end $$;

-- ROLLBACK: re-run phase35 and phase31 function definitions, then
--   drop function public.copy_recipe_for_family(integer, text);
