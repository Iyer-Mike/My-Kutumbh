import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { familyOf } from "@/lib/family";
import PageNav from "@/components/PageNav";
import FamilyRecipeForm from "@/components/FamilyRecipeForm";
import { BRAND as B } from "@/lib/brand";

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipeId = Number(id);
  if (!Number.isInteger(recipeId)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: r } = await supabase
    .from("recipes")
    .select("id, name, cuisine, diet, is_jain, serves, prep_time, cook_time, blurb, tip, ingredients, method, in_bucket, kutumbh_id, created_by, status")
    .eq("id", recipeId)
    .maybeSingle();

  // Only a family's own recipe can be edited here; the built-in ones are fixed
  if (!r || !r.kutumbh_id) notFound();

  const { isPrime } = await familyOf(supabase, user.id);
  if (!(isPrime || (r.status === "draft" && r.created_by === user.id))) redirect(`/recipes/${recipeId}`);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: B.page }}>
      <header className="px-5 pt-safe pb-6" style={{ background: B.headerGradient }}>
        <PageNav />
        <p className="text-xs mb-1" style={{ color: B.gold }}>Edit family recipe</p>
        <h1 className="text-2xl text-white" style={{ fontFamily: "var(--font-dm-serif)", lineHeight: 1.2 }}>{r.name}</h1>
      </header>
      <main className="flex-1 px-4 py-5">
        <FamilyRecipeForm
          recipeId={r.id} dishName={r.name} cuisine={r.cuisine} diet={r.diet} isPrime={isPrime}
          initial={{
            serves: r.serves, prep_time: r.prep_time, cook_time: r.cook_time, blurb: r.blurb, tip: r.tip,
            is_jain: r.is_jain, ingredients: r.ingredients ?? [], method: r.method ?? [], in_bucket: r.in_bucket,
          }}
        />
      </main>
    </div>
  );
}
