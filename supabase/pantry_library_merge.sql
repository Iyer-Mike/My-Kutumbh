-- Pantry update, 29–30 Oct 2026. Run once in Supabase → SQL Editor (or by Claude when approved).
-- Backups were taken first: _backup_pantry_items_20261029, _backup_pantry_purchases_20261029, _backup_shopping_items_20261029.

-- 1. Match the shelf to the kitchen library and fold duplicates together (purchases move with them)
do $$
declare v_fam uuid := 'ac6a96a3-8704-4eb5-9944-d88788e0a287'; r record; keeper uuid;
begin
  if exists (select 1 from public.pantry_items where kutumbh_id = v_fam and library_key is not null) then
    raise notice 'Already matched — skipping step 1'; return;
  end if;
  create temp table m (old text, key text, nm text, kind text, cat text, unit text, f numeric, buys int, shelf int) on commit drop;
  insert into m values
('Moong dal','moong-dal-yellow','Moong dal (yellow)','staple','dal','kg',1,0,365),
('Makki Daliya','makki-daliya','Makki daliya','staple','grain','kg',1,0,180),
('Cauliflower (Desi)','cauliflower','Cauliflower','fresh','vegetable','kg',1,0,6),
('Ginger (Deshi)','ginger','Ginger','fresh','vegetable','kg',1,1,14),
('Cumin (jeera)','cumin-seeds','Cumin seeds','sundry','spice','g',1,0,365),
('Desi Khand','brown-sugar','Brown sugar','staple','ready','kg',1,0,365),
('Roasted Amaranth','amaranth-rajgira','Amaranth (rajgira)','staple','dal','kg',1,0,270),
('Moong Dhuli','moong-dal-yellow','Moong dal (yellow)','staple','dal','kg',1,0,365),
('Chana Dal','chana-dal','Chana dal','staple','dal','kg',1,0,365),
('Peanut Oil','groundnut-oil','Groundnut oil','staple','oil','l',1,0,180),
('Roasted Channa Plain','roasted-chana','Roasted chana','staple','dal','kg',1,0,180),
('Kandhari Kishmish','raisins','Raisins','staple','dry_fruit','kg',1,0,180),
('Halim Seed','garden-cress-seeds','Garden cress seeds','sundry','spice','kg',1,0,365),
('Kali Mirch','black-pepper','Black pepper','sundry','spice','g',1,0,365),
('Gulab Patti','dried-rose-petals','Dried rose petals','sundry','spice','g',1,0,365),
('Fruit Nut Museli','muesli','Muesli','staple','grain','kg',1,0,180),
('Mustard seeds','mustard-seeds','Mustard seeds','sundry','spice','g',1,0,365),
('Turmeric (haldi)','turmeric-powder','Turmeric powder','sundry','spice','g',1,0,365),
('Haldi (Fresh A Grade)','fresh-turmeric','Fresh turmeric','fresh','vegetable','kg',1,0,14),
('Til Oil','gingelly-oil','Gingelly oil','staple','oil','l',1,0,270),
('Toor dal','toor-dal','Toor dal','staple','dal','kg',1,0,365),
('Urad dal','urad-dal-split','Urad dal (split)','staple','dal','kg',1,0,365),
('Watermelon Seeds','melon-seeds','Melon seeds','sundry','spice','kg',1,0,180),
('Wheat atta','wheat-atta','Wheat atta','staple','flour','kg',1,0,90),
('Ghee','ghee','Ghee','fresh','dairy','ml',1,1,270),
('Milk','milk','Milk','fresh','dairy','l',1,0,2),
('Tomato','tomato','Tomato','fresh','vegetable','kg',1,1,6),
('Lemon (A Grade)','lemon','Lemon','fresh','vegetable','piece',20,0,10),
('Potato','potato','Potato','fresh','vegetable','kg',1,1,21),
('Carrot','carrot','Carrot','fresh','vegetable','kg',1,1,14),
('Coriander leaves','coriander-leaves','Coriander leaves','fresh','vegetable','bunch',0.01,1,4),
('Green Chilli','green-chilli','Green chilli','fresh','vegetable','kg',1,1,7),
('Radish','radish','Radish','fresh','vegetable','kg',1,1,7),
('Beetroot','beetroot','Beetroot','fresh','vegetable','g',1,1,14),
('Elephant Foot Yam','yam-suran','Yam (suran)','fresh','vegetable','kg',1,1,21),
('Sweet Corn','sweet-corn','Sweet corn','fresh','vegetable','kg',1,1,4),
('ginger','ginger','Ginger','fresh','vegetable','g',1,0,14),
('Arhar','toor-dal','Toor dal','staple','dal','kg',1,0,365),
('Cashew Tukdi','cashews','Cashews','staple','dry_fruit','kg',1,0,180),
('Cooking oil','sunflower-oil','Sunflower oil','staple','oil','l',1,0,180),
('Shimla Mirch','capsicum-green','Capsicum (green)','fresh','vegetable','kg',1,2,7),
('Flaxseeds','flax-seeds','Flax seeds','sundry','spice','kg',1,0,180),
('Coconut Oil','coconut-oil','Coconut oil','staple','oil','l',1,1,365),
('Onion','onion','Onion','fresh','vegetable','kg',1,2,21),
('Green Apple','apple-green','Apple (Green)','fresh','fruit','kg',1,1,21),
('Patta Gobhi','cabbage','Cabbage','fresh','vegetable','kg',1,1,10),
('Gala Apple','apple-gala','Apple (Gala)','fresh','fruit','kg',1,2,21),
('Ramphal Fruit','ramphal','Ramphal','fresh','fruit','kg',1,1,4),
('Banana','banana-robusta','Banana (Robusta)','fresh','fruit','piece',1,2,5),
('Sugar','sugar','Sugar','staple','ready','kg',1,1,730),
('Salt','salt','Salt','staple','ready','kg',1,1,730),
('Rice','rice-sona-masoori','Rice (Sona Masoori)','staple','grain','kg',1,3,365),
('Gobhi','cauliflower','Cauliflower','fresh','vegetable','kg',1,1,6),
('Mushroom','mushroom','Mushroom','fresh','vegetable','kg',1,1,4),
('Petha','ash-gourd','Ash gourd','fresh','vegetable','kg',1,1,21),
('Avocado','avocado','Avocado','fresh','fruit','piece',5,1,5),
('Amla','amla','Amla','fresh','fruit','kg',1,1,14),
('Loki','bottle-gourd','Bottle gourd','fresh','vegetable','kg',1,1,7),
('Adrak','ginger','Ginger','fresh','vegetable','kg',1,1,14),
('Nimbu','lemon','Lemon','fresh','vegetable','piece',20,1,10),
('Anar Kandhari','pomegranate','Pomegranate','fresh','fruit','kg',1,1,21),
('Arvi A Grade','colocasia','Colocasia','fresh','vegetable','kg',1,1,10),
('Catch Hing','asafoetida','Asafoetida','sundry','spice','g',1,1,365),
('Fine French Beans A Grade','french-beans','French beans','fresh','vegetable','kg',1,1,5),
('Green Cholai A Grade','amaranth-leaves','Amaranth leaves','fresh','vegetable','bunch',4,1,3),
('Karela Bhujia','bitter-gourd','Bitter gourd','fresh','vegetable','kg',1,1,5),
('Mint A Grade','mint-leaves','Mint leaves','fresh','vegetable','bunch',10,1,4),
('Tinda Deshi','tinda','Tinda','fresh','vegetable','kg',1,1,5);

  for r in select distinct key from m loop
    keeper := null;
    select p.id into keeper from public.pantry_items p join m on m.old = p.name
     where p.kutumbh_id = v_fam and m.key = r.key order by m.buys desc, p.created_at limit 1;
    if keeper is null then continue; end if;
    update public.pantry_items tgt set quantity = (
      select case when count(p.quantity) = 0 then null else round(sum(
        p.quantity * m.f * case when m.unit = km.unit then 1
          when m.unit = 'g' and km.unit = 'kg' then 0.001 when m.unit = 'kg' and km.unit = 'g' then 1000
          when m.unit = 'ml' and km.unit = 'l' then 0.001 when m.unit = 'l' and km.unit = 'ml' then 1000 else 1 end), 3) end
      from public.pantry_items p join m on m.old = p.name, m km
      where p.kutumbh_id = v_fam and m.key = r.key and km.old = (select name from public.pantry_items where id = keeper))
     where tgt.id = keeper;
    update public.pantry_purchases set pantry_item_id = keeper
     where pantry_item_id in (select p.id from public.pantry_items p join m on m.old = p.name where p.kutumbh_id = v_fam and m.key = r.key and p.id <> keeper);
    update public.shopping_items set pantry_item_id = keeper
     where pantry_item_id in (select p.id from public.pantry_items p join m on m.old = p.name where p.kutumbh_id = v_fam and m.key = r.key and p.id <> keeper);
    delete from public.pantry_items p using m where m.old = p.name and p.kutumbh_id = v_fam and m.key = r.key and p.id <> keeper;
    update public.pantry_items p set library_key = m.key, name = m.nm, kind = m.kind, category = m.cat, unit = m.unit,
           use_within_days = m.shelf, stock_at = now()
      from m where p.id = keeper and m.old = p.name;
  end loop;
end $$;

-- 2. "Running short" phone alert to the Key Member: who to tell, and at most once a day per family
create table if not exists public.pantry_alerts (
  kutumbh_id uuid primary key references public.kutumbhs(id) on delete cascade,
  last_on date not null
);
alter table public.pantry_alerts enable row level security;

create or replace function public.claim_pantry_alert(p_kutumbh uuid, p_today date)
returns boolean language plpgsql security definer set search_path = '' as $$
declare done int;
begin
  if p_kutumbh not in (select public.my_kutumbh_ids()) then return false; end if;
  insert into public.pantry_alerts (kutumbh_id, last_on) values (p_kutumbh, p_today)
  on conflict (kutumbh_id) do update set last_on = excluded.last_on where public.pantry_alerts.last_on < excluded.last_on;
  get diagnostics done = row_count;
  return done > 0;
end $$;

create or replace function public.pantry_push_targets(p_kutumbh uuid)
returns table (endpoint text, p256dh text, auth text)
language sql security definer set search_path = '' as $$
  select s.endpoint, s.p256dh, s.auth
  from public.push_subscriptions s
  join public.kutumbh_members o on o.user_id = s.user_id and o.kutumbh_id = p_kutumbh and o.role = 'owner'
  where p_kutumbh in (select public.my_kutumbh_ids());
$$;

revoke all on function public.claim_pantry_alert(uuid, date), public.pantry_push_targets(uuid) from public, anon;
grant execute on function public.claim_pantry_alert(uuid, date), public.pantry_push_targets(uuid) to authenticated;

-- Check
select count(*) filter (where library_key is not null) as matched, count(*) as shelf_items,
       (select count(*) from public.pantry_purchases) as purchases
from public.pantry_items;
