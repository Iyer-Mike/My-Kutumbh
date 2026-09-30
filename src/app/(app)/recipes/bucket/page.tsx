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

  const { data } = await supabase
    .from("recipes")
    .select("id, name")
    .eq("kutumbh_id", kutumbhId)
    .eq("in_bucket", true)
    .order("name");

  return (
    <div className="flex flex-col min-h-screen" style={{ background: B.page }}>
      <header className="px-5 pt-safe pb-5" style={{ background: B.headerGradient }}>
        <PageNav />
        <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Prime Member</p>
        <h1 className="text-2xl text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>Nutrition bucket</h1>
        <p className="text-xs mt-1" style={{ color: B.gold }}>
          Family recipes waiting for their nutrition values
        </p>
      </header>
      <main className="flex-1 px-4 py-5 grid gap-4 content-start">
        <NutritionBucket items={data ?? []} />
        <Link href="/recipes" className="text-xs text-center underline" style={{ color: B.muted }}>Back to recipes</Link>
      </main>
    </div>
  );
}
