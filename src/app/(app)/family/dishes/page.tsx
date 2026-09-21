import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageNav from "@/components/PageNav";
import FamilyDishesEditor, { type FamilyDish } from "@/components/FamilyDishesEditor";

export default async function FamilyDishesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("kutumbh_members")
    .select("kutumbh_id, role")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();

  if (!membership || membership.role !== "owner") redirect("/family");

  const { data: dishes } = await supabase
    .from("food_items")
    .select("id, name, category, serving_unit, serving_weight_g, calories, protein_g, carbs_g, fat_g, fiber_g, ingredients, preparation, virya, vata_effect, pitta_effect, kapha_effect, needs_review, created_by")
    .eq("kutumbh_id", membership.kutumbh_id)
    .order("needs_review", { ascending: false })
    .order("name", { ascending: true });

  const creatorIds = [...new Set((dishes ?? []).map((d) => d.created_by).filter(Boolean))] as string[];
  const creators: Record<string, string> = {};
  if (creatorIds.length) {
    const { data: people } = await supabase.from("profiles").select("id, full_name").in("id", creatorIds);
    for (const p of people ?? []) creators[p.id] = p.full_name?.split(" ")[0] ?? "Family";
  }

  const pending = (dishes ?? []).filter((d) => d.needs_review).length;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#F6F5EE" }}>
      <header
        className="px-5 pt-safe pb-5"
        style={{ background: "linear-gradient(160deg, #1C2B1C 0%, #2E4A2C 70%, #3D6638 100%)" }}
      >
        <PageNav />
        <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Prime Member</p>
        <h1 className="text-2xl text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>Family Dishes</h1>
        <p className="text-xs mt-1" style={{ color: "#8FBF88" }}>
          {pending > 0
            ? `${pending} dish${pending > 1 ? "es" : ""} waiting for your details`
            : "All dishes have their details"}
        </p>
      </header>

      <main className="flex-1 px-5 py-5">
        <FamilyDishesEditor initialDishes={(dishes ?? []) as FamilyDish[]} creators={creators} />
      </main>
    </div>
  );
}
