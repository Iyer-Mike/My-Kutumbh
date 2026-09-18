import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import PageNav from "@/components/PageNav";
import ProfileEditCard from "@/components/ProfileEditCard";

const DOSHA_COLOR: Record<string, string> = {
  vata:          "#7B68EE",
  pitta:         "#E07B39",
  kapha:         "#4A7C44",
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

  const doshaColor = profile?.primary_dosha
    ? (DOSHA_COLOR[profile.primary_dosha] ?? "#4A7C44")
    : "#4A7C44";

  const doshaLabel = profile?.primary_dosha
    ? (DOSHA_LABEL[profile.primary_dosha] ?? profile.primary_dosha)
    : null;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#F6F5EE" }}>
      {/* Header */}
      <header
        className="px-5 pt-safe pb-6"
        style={{ background: "linear-gradient(160deg, #1C2B1C 0%, #2E4A2C 70%, #3D6638 100%)" }}
      >
        <PageNav />
        <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>My Kutumbh</p>
        <h1 className="text-2xl text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>
          {profile?.full_name ?? "My Profile"}
        </h1>
        {doshaLabel && (
          <span
            className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold text-white"
            style={{ background: doshaColor }}
          >
            {doshaLabel} Prakriti
          </span>
        )}
      </header>

      <main className="flex-1 px-5 py-5 space-y-4">

        <ProfileEditCard
          userId={user!.id}
          fullName={profile?.full_name ?? null}
          heightCm={profile?.height_cm ?? null}
          weightKg={profile?.weight_kg ?? null}
          activityLevel={profile?.activity_level ?? null}
          gender={profile?.gender ?? null}
          dateOfBirth={profile?.date_of_birth ?? null}
        />

        {/* Prakriti scores */}
        {profile?.prakriti_vata != null && (
          <div
            className="rounded-2xl px-5 py-4"
            style={{ background: "#fff", border: "1px solid #E2E1D8" }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#8A9085" }}>
              Prakriti — Dosha Balance
            </p>
            <div className="space-y-3">
              {[
                { label: "Vata",  score: profile.prakriti_vata,  color: "#7B68EE" },
                { label: "Pitta", score: profile.prakriti_pitta, color: "#E07B39" },
                { label: "Kapha", score: profile.prakriti_kapha, color: "#4A7C44" },
              ].map(({ label, score, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: "#5A6055" }}>{label}</span>
                    <span style={{ color }}>{score}/20</span>
                  </div>
                  <div className="rounded-full h-2" style={{ background: "#E2E1D8" }}>
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{ width: `${((score ?? 0) / 20) * 100}%`, background: color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sign out */}
        <SignOutButton />

      </main>
    </div>
  );
}
