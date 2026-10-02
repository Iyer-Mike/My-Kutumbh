import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { familyOf } from "@/lib/family";
import PageNav from "@/components/PageNav";
import NutritionBucket from "@/components/NutritionBucket";
import { BRAND as B } from "@/lib/brand";

export default async function BucketPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { kutumbhId, isPrime } = await familyOf(supabase, user.id);
  if (!kutumbhId || !isPrime) redirect("/recipes");

  const [{ data: recs }, { data: dishes }] = await Promise.all([
    supabase.from("recipes").select("id, name").eq("kutumbh_id", kutumbhId).eq("in_bucket", true).order("name"),
    supabase.from("food_items").select("id, name").eq("kutumbh_id", kutumbhId).is("calories", null).order("name"),
  ]);
  const recNames = new Set((recs ?? []).map((r) => r.name.toLowerCase()));
  const items = [
    ...(recs ?? []).map((r) => ({ id: String(r.id), name: r.name, kind: "recipe" as const })),
    ...(dishes ?? []).filter((d) => !recNames.has(d.name.toLowerCase())).map((d) => ({ id: d.id as string, name: d.name as string, kind: "dish" as const })),
  ];

  return (
    <div className="flex flex-col min-h-screen" style={{ background: B.page }}>
      <header className="px-5 pt-safe pb-5" style={{ background: B.headerGradient }}>
        <PageNav />
        <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Prime Member</p>
        <h1 className="text-2xl text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>Nutrition bucket</h1>
        <p className="text-xs mt-1" style={{ color: B.gold }}>
          Family recipes and dishes waiting for their values
        </p>
      </header>
      <main className="flex-1 px-4 py-5 grid gap-4 content-start">
        <NutritionBucket items={items} />
        <Link href="/recipes" className="text-xs text-center underline" style={{ color: B.muted }}>Back to recipes</Link>
      </main>
    </div>
  );
}
