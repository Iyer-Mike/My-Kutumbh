-- =====================================================================
-- Phase 31: edit family recipes, and the nutrition "bucket".
--
-- The Prime Member edits a family recipe (an author may edit their own
-- while it is still a draft). The Prime Member can drop recipes into a
-- bucket; one button asks the AI to estimate their nutrition; the Prime
-- Member reviews and saves. Saved values go to the recipe AND to the
-- family dish, so the Log counts them. Nothing is saved without the
-- Prime Member's confirmation, and every saved value is marked estimated.
-- Additive only.
-- =====================================================================

alter table public.recipes
  add column if not exists in_bucket boolean not null default false;

create index if not exists recipes_in_bucket on public.recipes (kutumbh_id) where in_bucket;

-- ---------------------------------------------------------------------
-- Edit.  p = { cuisine, diet, is_jain, serves, prep_time, cook_time, blurb,
--              tip, ingredients: [text], method: [text], in_bucket: bool }
-- in_bucket is honoured for the Prime Member only.
-- ---------------------------------------------------------------------
create or replace function public.update_family_recipe(p_recipe_id integer, p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record; uid uuid := auth.uid(); is_prime boolean; ing text[]; mth text[];
begin
  select * into r from public.recipes where id = p_recipe_id and kutumbh_id is not null;
  if not found then raise exception 'No such family recipe'; end if;
  is_prime := r.kutumbh_id in (select public.my_prime_kutumbh_ids());
  if not (is_prime or (r.created_by = uid and r.status = 'draft')) then
    raise exception 'Not allowed';
  end if;

  ing := array(select trim(x) from jsonb_array_elements_text(coalesce(p->'ingredients','[]'::jsonb)) x where trim(x) <> '');
  mth := array(select trim(x) from jsonb_array_elements_text(coalesce(p->'method','[]'::jsonb)) x where trim(x) <> '');
  if coalesce(array_length(ing,1),0) = 0 then raise exception 'Add at least one ingredient'; end if;
  if coalesce(array_length(mth,1),0) = 0 then raise exception 'Add at least one step'; end if;

  update public.recipes set
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
end $$;

-- ---------------------------------------------------------------------
-- Save reviewed nutrition (per serving) for a family recipe.
--   n = { serving_unit, serving_weight_g, kcal, protein_g, carbs_g, fat_g,
--         fibre_g, iron_mg, calcium_mg, vit_b12_mcg, sodium_mg }
-- Also written to the family dish (per 100 g) so the Log counts it.
-- ---------------------------------------------------------------------
create or replace function public.save_family_nutrition(p_recipe_id integer, n jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record; w numeric; f numeric;
begin
  select * into r from public.recipes where id = p_recipe_id and kutumbh_id is not null;
  if not found or r.kutumbh_id not in (select public.my_prime_kutumbh_ids()) then
    raise exception 'Only the Prime Member can save nutrition';
  end if;

  w := coalesce((n->>'serving_weight_g')::numeric, 0);
  if w <= 0 or w > 2000 then raise exception 'Serving weight must be between 1 and 2000 g'; end if;
  if coalesce((n->>'kcal')::numeric, -1) < 0 or (n->>'kcal')::numeric > 5000 then
    raise exception 'Calories look wrong';
  end if;

  update public.recipes set
    serving_unit = coalesce(nullif(n->>'serving_unit',''), serving_unit),
    serving_weight_g = w,
    kcal = (n->>'kcal')::numeric,
    protein_g = (n->>'protein_g')::numeric, carbs_g = (n->>'carbs_g')::numeric,
    fat_g = (n->>'fat_g')::numeric, fibre_g = (n->>'fibre_g')::numeric,
    iron_mg = (n->>'iron_mg')::numeric, calcium_mg = (n->>'calcium_mg')::numeric,
    vit_b12_mcg = (n->>'vit_b12_mcg')::numeric, sodium_mg = (n->>'sodium_mg')::numeric,
    nutrition_estimated = true, in_bucket = false
  where id = p_recipe_id;

  if r.food_item_id is not null then
    f := 100 / w;
    update public.food_items set
      serving_unit = coalesce(nullif(n->>'serving_unit',''), serving_unit),
      serving_weight_g = w,
      calories = round((n->>'kcal')::numeric * f, 1),
      protein_g = round((n->>'protein_g')::numeric * f, 2), carbs_g = round((n->>'carbs_g')::numeric * f, 2),
      fat_g = round((n->>'fat_g')::numeric * f, 2), fiber_g = round((n->>'fibre_g')::numeric * f, 2),
      iron_mg = round((n->>'iron_mg')::numeric * f, 2), calcium_mg = round((n->>'calcium_mg')::numeric * f, 2),
      vitamin_b12_mcg = round((n->>'vit_b12_mcg')::numeric * f, 3), sodium_mg = round((n->>'sodium_mg')::numeric * f, 1)
    where id = r.food_item_id and kutumbh_id = r.kutumbh_id;
  end if;
end $$;

revoke all on function public.update_family_recipe(integer, jsonb) from public, anon;
revoke all on function public.save_family_nutrition(integer, jsonb) from public, anon;
grant execute on function public.update_family_recipe(integer, jsonb) to authenticated;
grant execute on function public.save_family_nutrition(integer, jsonb) to authenticated;

-- ROLLBACK: drop function public.update_family_recipe(integer, jsonb);
--           drop function public.save_family_nutrition(integer, jsonb);
--           alter table public.recipes drop column in_bucket;
