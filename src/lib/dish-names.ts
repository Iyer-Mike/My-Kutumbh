import type { SupabaseClient } from "@supabase/supabase-js";
import { isLang, type LangCode } from "./languages";

/** The reader's chosen language, or null for English (or if it cannot be read). */
export async function readingLanguage(supabase: SupabaseClient, userId: string): Promise<LangCode | null> {
  const { data, error } = await supabase.from("profiles").select("reading_language").eq("id", userId).maybeSingle();
  if (error) return null;
  const code = (data as { reading_language?: string | null } | null)?.reading_language;
  return isLang(code) ? code : null;
}

/** The family's names for these dishes in one language, by dish id. Missing ones simply stay English. */
export async function dishNames(
  supabase: SupabaseClient, lang: LangCode | null, ids: (string | null | undefined)[],
): Promise<Record<string, string>> {
  const want = [...new Set(ids.filter((i): i is string => !!i))];
  if (!lang || want.length === 0) return {};
  const { data, error } = await supabase.from("dish_names").select("food_item_id, name").eq("lang", lang).in("food_item_id", want);
  if (error) return {};
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as { food_item_id: string; name: string }[]) out[r.food_item_id] = r.name;
  return out;
}
