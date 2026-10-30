import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { standingOf } from "@/lib/admission";
import { pendingConsents } from "@/lib/consent";

/**
 * Onboarding lives outside the app's own layout, so it needs the same
 * door. Naming your Kutumbh is the first real thing anyone does here,
 * and it should not happen before somebody has been welcomed in.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const standing = await standingOf(supabase, user.id);
  if (standing !== "admitted") redirect("/waiting");

  // Asked before anything is held: naming a family comes after agreeing
  if ((await pendingConsents(supabase, user.id)).length > 0) redirect("/agree");

  return <>{children}</>;
}
