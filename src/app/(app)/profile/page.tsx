import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import PageNav from "@/components/PageNav";
import ProfileEditCard from "@/components/ProfileEditCard";
import MedicalReportsCard from "@/components/MedicalReportsCard";
import Link from "next/link";
import FacePicker from "@/components/FacePicker";
import { signedFaces } from "@/lib/faces";
import { familyOf } from "@/lib/family";
import AiSpendCard from "@/components/AiSpendCard";
import { checkBudget } from "@/lib/ai-budget";

const DOSHA_COLOR: Record<string, string> = {
  vata:          "#7B68EE",
  pitta:         "#E07B39",
  kapha:         "#6B46B8",
  "vata-pitta":  "#9B6EC9",
  "pitta-kapha": "#5A8F5A",
  "vata-kapha":  "#6B8CAE",
  tridosha:      "#C8832A",
};

const DOSHA_LABEL: Record<string, string> = {
  vata:          "Vata",
  pitta:         "Pitta",
  kapha:         "Kapha",
  "vata-pitta":  "Vata-Pitta",
  "pitta-kapha": "Pitta-Kapha",
  "vata-kapha":  "Vata-Kapha",
  tridosha:      "Tridosha",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  const { data: medRecords } = await supabase
    .from("medical_records")
    .select("id, report_date, report_type, file_name, file_url, extracted_values, notes")
    .eq("user_id", user!.id)
    .order("report_date", { ascending: false });

  const { kutumbhId } = await familyOf(supabase, user!.id);
  const spend = await checkBudget(supabase, user!.id, kutumbhId);
  const myFace = (await signedFaces(supabase, [profile?.photo_path]))[profile?.photo_path ?? ""];

  const doshaColor = profile?.primary_dosha
    ? (DOSHA_COLOR[profile.primary_dosha] ?? "#6B46B8")
    : "#6B46B8";

  const doshaLabel = profile?.primary_dosha
    ? (DOSHA_LABEL[profile.primary_dosha] ?? profile.primary_dosha)
    : null;


  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#F3EEFA" }}>

      {/* Header */}
      <header
        className="px-5 pt-safe pb-6"
        style={{ background: "linear-gradient(160deg, #241238 0%, #3A2260 70%, #4E3080 100%)" }}
      >
        <PageNav />
        <div className="flex items-start justify-between mt-1">
          <div>
            <h1 className="text-2xl text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>
              {profile?.full_name ?? "My Profile"}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>
              {user?.email}
            </p>
          </div>
          <SignOutButton compact />
        </div>
        {doshaLabel && (
          <span
            className="inline-block mt-3 px-3 py-1 rounded-full text-xs font-semibold text-white"
            style={{ background: doshaColor }}
          >
            {doshaLabel} Prakriti
          </span>
        )}
      </header>

      <main className="flex-1 px-5 py-5 space-y-4">

        {/* ── Your face ── */}
        {kutumbhId && (
          <section className="rounded-2xl px-4 py-5" style={{ background: "#FAF7FE", border: "1px solid #E0D4F2" }}>
            <FacePicker
              kutumbhId={kutumbhId}
              subject={{ kind: "member", userId: user!.id }}
              name={profile?.full_name}
              url={myFace}
              currentPath={profile?.photo_path ?? null}
              size={88}
              label="Add your photo"
            />
            <p className="text-[11px] text-center mt-3 m-0" style={{ color: "#6A6180" }}>
              Only your Kutumbh can see it.
            </p>
          </section>
        )}

        {spend.ok && <AiSpendCard familyRupees={spend.familyRupees} myRupees={spend.myRupees} />}

        {/* ── Health Basics ── */}
        <ProfileEditCard
          userId={user!.id}
          fullName={profile?.full_name ?? null}
          heightCm={profile?.height_cm ?? null}
          weightKg={profile?.weight_kg ?? null}
          activityLevel={profile?.activity_level ?? null}
          gender={profile?.gender ?? null}
          dateOfBirth={profile?.date_of_birth ?? null}
          dietType={profile?.diet_type ?? null}
          conditions={profile?.conditions ?? []}
          allergies={profile?.allergies ?? []}
          medications={profile?.medications ?? []}
          dailyKcalGoal={profile?.daily_kcal_goal ?? null}
        />

        {/* ── Prakriti ── */}
        <div className="rounded-2xl px-5 py-4" style={{ background: "#FAF7FE", border: "1px solid #E0D4F2" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6A6180" }}>
              Prakriti — Dosha Balance
            </p>
            <Link
              href="/profile/prakriti"
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold"
              style={{ background: "#E7DCF7", color: "#6B46B8" }}
            >
              {profile?.prakriti_vata != null ? "Retake" : "Take Assessment"}
            </Link>
          </div>

          {profile?.prakriti_vata != null ? (
            <div className="space-y-3">
              {[
                { label: "Vata",  score: profile.prakriti_vata,  color: "#7B68EE", icon: "🌬️" },
                { label: "Pitta", score: profile.prakriti_pitta, color: "#E07B39", icon: "🔥" },
                { label: "Kapha", score: profile.prakriti_kapha, color: "#6B46B8", icon: "🌊" },
              ].map(({ label, score, color, icon }) => (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: "#625A75" }}>{icon} {label}</span>
                    <span style={{ color }}>{score}/20</span>
                  </div>
                  <div className="rounded-full h-2" style={{ background: "#E0D4F2" }}>
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${((score ?? 0) / 20) * 100}%`, background: color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl px-4 py-4 text-center"
              style={{ background: "#F3EEFA", border: "1.5px dashed #CBBDE4" }}>
              <p className="text-sm font-medium mb-1" style={{ color: "#241C33" }}>
                Discover your Ayurvedic constitution
              </p>
              <p className="text-xs mb-3" style={{ color: "#6A6180" }}>
                15 questions · takes about 3 minutes
              </p>
              <div className="flex gap-2 justify-center">
                <Link
                  href="/profile/prakriti"
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white"
                  style={{ background: "#241238" }}
                >
                  Start Assessment →
                </Link>
                <span className="px-4 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: "#EDE7F7", color: "#6A6180" }}>
                  Skip
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Medical Reports ── */}
        <MedicalReportsCard
          userId={user!.id}
          initialRecords={medRecords ?? []}
        />


      </main>
    </div>
  );
}
