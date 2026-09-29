import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { standingOf } from "@/lib/admission";
import { pendingConsents } from "@/lib/consent";
import LegalDoc from "@/components/LegalDoc";
import AgreeButton from "@/components/AgreeButton";
import SignOutButton from "@/components/SignOutButton";
import { PRIVACY, TERMS } from "@/lib/legal";

export const dynamic = "force-dynamic";

/**
 * Both documents, on one page, before the app opens.
 *
 * On one page because two consecutive screens of terms is how people
 * are taught to tap without reading. Here the awkward paragraphs —
 * who sees your blood report, what is sent to Anthropic, that one
 * person runs this — are between the reader and the button.
 *
 * Someone who has already agreed is sent on; this page is a gate, not
 * a place to be.
 */
export default async function AgreePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Still behind the first door: that question comes before this one.
  if ((await standingOf(supabase, user.id)) !== "admitted") redirect("/waiting");

  if ((await pendingConsents(supabase, user.id)).length === 0) redirect("/dashboard");

  return (
    <div className="min-h-screen px-5 py-8" style={{ background: "#F3EEFA" }}>
      <div className="mx-auto" style={{ maxWidth: 560 }}>
        <p className="m-0 mb-3 text-xs font-semibold uppercase tracking-widest text-center" style={{ color: "#6A6180" }}>
          Before you begin
        </p>

        <p className="m-0 mb-5 text-sm text-center" style={{ color: "#4A4360", lineHeight: 1.65 }}>
          My Kutumbh will hold what you eat and what your lab reports say. Two short
          pages, and then you are in.
        </p>

        <div
          className="rounded-3xl px-6 py-7 mb-4"
          style={{ background: "#fff", border: "1px solid #E0D4F2", boxShadow: "0 10px 40px rgba(36,18,56,0.08)" }}
        >
          <LegalDoc doc={PRIVACY} compact />
        </div>

        <div
          className="rounded-3xl px-6 py-7 mb-6"
          style={{ background: "#fff", border: "1px solid #E0D4F2", boxShadow: "0 10px 40px rgba(36,18,56,0.08)" }}
        >
          <LegalDoc doc={TERMS} compact />
        </div>

        <AgreeButton />

        <div className="mt-6 pt-5 flex items-center justify-between" style={{ borderTop: "1px solid #E0D4F2" }}>
          <span className="text-xs" style={{ color: "#8A80A0" }}>{user.email}</span>
          <SignOutButton compact />
        </div>
      </div>
    </div>
  );
}
