-- =====================================================================
-- Phase 33: the Prime Member removes a family dish (test entries,
-- duplicates). Removes the dish AND its family recipe. Meals already
-- logged keep their own name and values (logs store them); planned
-- meals keep their text but lose the link; pantry links clear on their own.
-- Built-in dishes and recipes (kutumbh_id null) can never be removed here.
-- =====================================================================
create or replace function public.remove_family_dish(p_food_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare d record;
begin
  select * into d from public.food_items where id = p_food_item_id and kutumbh_id is not null;
  if not found or d.kutumbh_id not in (select public.my_prime_kutumbh_ids()) then
    raise exception 'Only the Prime Member can remove a family dish';
  end if;
  update public.meal_plans set food_item_id = null where food_item_id = p_food_item_id;
  delete from public.recipes
   where kutumbh_id = d.kutumbh_id and (food_item_id = p_food_item_id or id = d.recipe_id);
  delete from public.food_items where id = p_food_item_id;
end $$;
revoke all on function public.remove_family_dish(uuid) from public, anon;
grant execute on function public.remove_family_dish(uuid) to authenticated;
-- ROLLBACK: drop function public.remove_family_dish(uuid);
