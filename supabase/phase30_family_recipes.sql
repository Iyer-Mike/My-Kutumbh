-- =====================================================================
-- Phase 30: family recipes, in the same shape as the built-in ones.
--
-- A family member adds a recipe for one of the family's dishes. It is
-- stored in the same `recipes` table with the same fields, so the recipe
-- page, the PDF and the Ayurvedic reading look identical. A recipe added
-- by a member waits as a 'draft' (visible to the author and the Prime
-- Member); the Prime Member approves it, and it appears for the family.
-- A Prime Member's own recipe is published straight away.
--
-- Additive only: nothing existing is changed except the read rule, which
-- keeps every built-in recipe visible exactly as before.
-- =====================================================================

alter table public.recipes
  add column if not exists kutumbh_id  uuid references public.kutumbhs(id) on delete cascade,
  add column if not exists created_by  uuid references auth.users(id) on delete set null,
  add column if not exists food_item_id uuid references public.food_items(id) on delete set null,
  add column if not exists status      text not null default 'published'
    check (status in ('draft', 'published'));

-- Built-in recipes use ids 1..563; family recipes start well above them.
create sequence if not exists public.recipes_family_id_seq start with 100000;

create index if not exists recipes_by_family on public.recipes (kutumbh_id) where kutumbh_id is not null;

-- Who can read: built-ins (no family) as before; a family's published
-- recipes; and drafts only to their author and the family's Prime Member.
drop policy if exists recipes_select on public.recipes;
create policy recipes_select on public.recipes
  for select to authenticated using (
    kutumbh_id is null
    or (kutumbh_id in (select public.my_kutumbh_ids()) and status = 'published')
    or created_by = (select auth.uid())
    or kutumbh_id in (select public.my_prime_kutumbh_ids())
  );
-- No insert/update/delete policies: writes go through the functions below.

-- ---------------------------------------------------------------------
-- Add a recipe for a family dish.
--   p = { cuisine, diet, dish_type, serves, prep_time, cook_time, blurb,
--         tip, is_jain, ingredients: [text], method: [text] }
-- Nutrition is copied from the dish (per serving) and marked estimated.
-- ---------------------------------------------------------------------
create or replace function public.submit_family_recipe(p_food_item_id uuid, p jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  d        record;
  uid      uuid := auth.uid();
  is_prime boolean;
  new_id   integer;
  w        numeric;
  ing      text[];
  mth      text[];
begin
  if uid is null then raise exception 'Not signed in'; end if;

  select f.* into d from public.food_items f
   where f.id = p_food_item_id and f.kutumbh_id in (select public.my_kutumbh_ids());
  if not found then raise exception 'That dish is not in your Kutumbh'; end if;
  if d.recipe_id is not null then raise exception 'This dish already has a recipe'; end if;
  if exists (select 1 from public.recipes r where r.food_item_id = p_food_item_id and r.status = 'draft') then
    raise exception 'A recipe for this dish is already waiting for approval';
  end if;

  ing := array(select trim(x) from jsonb_array_elements_text(coalesce(p->'ingredients','[]'::jsonb)) x where trim(x) <> '');
  mth := array(select trim(x) from jsonb_array_elements_text(coalesce(p->'method','[]'::jsonb)) x where trim(x) <> '');
  if coalesce(array_length(ing,1),0) = 0 then raise exception 'Add at least one ingredient'; end if;
  if coalesce(array_length(mth,1),0) = 0 then raise exception 'Add at least one step'; end if;

  is_prime := d.kutumbh_id in (select public.my_prime_kutumbh_ids());
  new_id := nextval('public.recipes_family_id_seq');
  w := case when d.serving_unit = 'g' then 100 else coalesce(d.serving_weight_g, 100) end;

  insert into public.recipes (
    id, name, cuisine, diet, is_jain, dish_type, serves, prep_time, cook_time, blurb, tip,
    ingredients, method, meal_hint, serving_unit, serving_weight_g,
    kcal, protein_g, carbs_g, fat_g, fibre_g, iron_mg, calcium_mg, vit_b12_mcg, sodium_mg,
    nutrition_estimated, kutumbh_id, created_by, food_item_id, status
  ) values (
    new_id, d.name,
    coalesce(nullif(p->>'cuisine',''), d.cuisine, 'pan_indian'),
    coalesce(nullif(p->>'diet',''), d.diet, 'veg'),
    coalesce((p->>'is_jain')::boolean, d.is_jain, false),
    coalesce(nullif(p->>'dish_type',''), d.category, 'main'),
    nullif(p->>'serves',''), nullif(p->>'prep_time',''), nullif(p->>'cook_time',''),
    nullif(p->>'blurb',''), nullif(p->>'tip',''),
    ing, mth, d.meal_hint, d.serving_unit, d.serving_weight_g,
    round(d.calories * w / 100), round(d.protein_g * w / 100, 1), round(d.carbs_g * w / 100, 1),
    round(d.fat_g * w / 100, 1), round(d.fiber_g * w / 100, 1), round(d.iron_mg * w / 100, 1),
    round(d.calcium_mg * w / 100, 1), round(d.vitamin_b12_mcg * w / 100, 2), round(d.sodium_mg * w / 100, 0),
    true, d.kutumbh_id, uid, d.id, case when is_prime then 'published' else 'draft' end
  );

  if is_prime then
    update public.food_items set recipe_id = new_id where id = d.id and recipe_id is null;
  end if;
  return new_id;
end $$;

-- ---------------------------------------------------------------------
-- The Prime Member approves a waiting recipe.
-- ---------------------------------------------------------------------
create or replace function public.approve_family_recipe(p_recipe_id integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  select * into r from public.recipes where id = p_recipe_id and kutumbh_id is not null;
  if not found or r.kutumbh_id not in (select public.my_prime_kutumbh_ids()) then
    raise exception 'Only the Prime Member can approve this recipe';
  end if;
  update public.recipes set status = 'published' where id = p_recipe_id;
  update public.food_items set recipe_id = p_recipe_id where id = r.food_item_id and recipe_id is null;
end $$;

-- ---------------------------------------------------------------------
-- The Prime Member (or the author, while it is still a draft) can
-- withdraw a recipe.
-- ---------------------------------------------------------------------
create or replace function public.delete_family_recipe(p_recipe_id integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  select * into r from public.recipes where id = p_recipe_id and kutumbh_id is not null;
  if not found then raise exception 'No such recipe'; end if;
  if not (r.kutumbh_id in (select public.my_prime_kutumbh_ids())
          or (r.created_by = auth.uid() and r.status = 'draft')) then
    raise exception 'Not allowed';
  end if;
  update public.food_items set recipe_id = null where recipe_id = p_recipe_id;
  delete from public.recipes where id = p_recipe_id;
end $$;

revoke all on function public.submit_family_recipe(uuid, jsonb)  from public, anon;
revoke all on function public.approve_family_recipe(integer)     from public, anon;
revoke all on function public.delete_family_recipe(integer)      from public, anon;
grant execute on function public.submit_family_recipe(uuid, jsonb) to authenticated;
grant execute on function public.approve_family_recipe(integer)    to authenticated;
grant execute on function public.delete_family_recipe(integer)     to authenticated;

-- ROLLBACK (only if no family recipe has been added yet):
--   drop function public.submit_family_recipe(uuid, jsonb);
--   drop function public.approve_family_recipe(integer);
--   drop function public.delete_family_recipe(integer);
--   create policy ... (restore recipes_select as: using (auth.role() = 'authenticated'))
--   alter table public.recipes drop column status, drop column food_item_id,
--     drop column created_by, drop column kutumbh_id;
--   drop sequence public.recipes_family_id_seq;
