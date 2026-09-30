import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { familyOf } from "@/lib/family";
import PageNav from "@/components/PageNav";
import FamilyRecipeForm from "@/components/FamilyRecipeForm";
import { BRAND as B } from "@/lib/brand";

export default async function NewRecipePage({ searchParams }: { searchParams: Promise<{ dish?: string }> }) {
  const { dish: dishId } = await searchParams;
  if (!dishId) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: dish } = await supabase
    .from("food_items")
    .select("id, name, cuisine, diet, recipe_id, kutumbh_id")
    .eq("id", dishId)
    .maybeSingle();

  // Only a dish the family added can have a family recipe
  if (!dish || !dish.kutumbh_id) notFound();
  if (dish.recipe_id != null) redirect(`/recipes/${dish.recipe_id}`);

  const { isPrime } = await familyOf(supabase, user.id);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: B.page }}>
      <header className="px-5 pt-safe pb-6" style={{ background: B.headerGradient }}>
        <PageNav />
        <p className="text-xs mb-1" style={{ color: B.gold }}>Family recipe</p>
        <h1 className="text-2xl text-white" style={{ fontFamily: "var(--font-dm-serif)", lineHeight: 1.2 }}>{dish.name}</h1>
        <p className="text-sm mt-2" style={{ color: B.onDark }}>Write it the way your family makes it.</p>
      </header>
      <main className="flex-1 px-4 py-5">
        <FamilyRecipeForm dishId={dish.id} dishName={dish.name} cuisine={dish.cuisine} diet={dish.diet} isPrime={isPrime} />
      </main>
    </div>
  );
}
