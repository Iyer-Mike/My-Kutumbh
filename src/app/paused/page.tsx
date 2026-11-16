import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import { familyOf } from "@/lib/family";
import { familyLimit } from "@/lib/ai-budget";
import { FAMILY, look } from "@/lib/brand";

/** Shown to a family the Admin has paused. Their data is kept; the app is closed to them until resumed. */
export default async function PausedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { kutumbhId, kutumbhName } = await familyOf(supabase, user.id);
  const limit = await familyLimit(supabase, kutumbhId);
  if (!limit.blocked) redirect("/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10" style={{ background: "#F3EEFA" }}>
      <div className="w-full rounded-3xl px-6 py-7" style={{ maxWidth: 420, ...look(FAMILY.gold) }}>
        <p className="m-0 text-xs font-semibold uppercase tracking-widest" style={{ color: "#6A6180" }}>My Kutumb Bhojan</p>
        <h1 className="mt-2 mb-0 text-2xl" style={{ fontFamily: "var(--font-dm-serif)", color: "#241C33" }}>
          {kutumbhName ?? "Your Kutumbh"} is paused
        </h1>
        <p className="mt-3 mb-0 text-sm" style={{ color: "#4A4360", lineHeight: 1.6 }}>
          The person who looks after My Kutumb Bhojan has paused this Kutumbh. Nothing has been deleted: your meals, reports and menus are kept.
        </p>
        <p className="mt-3 mb-0 text-sm" style={{ color: "#4A4360", lineHeight: 1.6 }}>
          To have it opened again, please write to the person who told you about the app.
        </p>
        <div className="mt-6 pt-5 flex items-center justify-between" style={{ borderTop: "1px solid #E0D4F2" }}>
          <span className="text-xs" style={{ color: "#8A80A0" }}>{user.email}</span>
          <SignOutButton compact />
        </div>
      </div>
    </div>
  );
}
