-- Covering indexes for the two busiest foreign keys (Supabase performance advisor).
create index if not exists shopping_items_pantry_item_idx on public.shopping_items (pantry_item_id);
create index if not exists pantry_stock_events_kutumbh_idx on public.pantry_stock_events (kutumbh_id, on_date desc);
