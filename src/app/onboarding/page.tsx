"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { pendingInvite } from "@/lib/invite";
import { DEFAULT_TIME_ZONE, deviceTimeZone } from "@/lib/dates";
import { useRouter } from "next/navigation";
import KutumbhLogo from "@/components/KutumbhLogo";

// ── Prakriti questions ────────────────────────────────────────────
const QUESTIONS = [
  {
    q: "My body build is",
    options: [
      { label: "Thin, light — hard to gain weight",        dosha: "vata" },
      { label: "Medium, muscular — gain/lose moderately",  dosha: "pitta" },
      { label: "Large, heavy — gain easily, lose slowly",  dosha: "kapha" },
    ],
  },
  {
    q: "My skin is usually",
    options: [
      { label: "Dry, rough, or thin",         dosha: "vata" },
      { label: "Warm, slightly oily, reddish", dosha: "pitta" },
      { label: "Thick, smooth, and moist",     dosha: "kapha" },
    ],
  },
  {
    q: "My appetite is",
    options: [
      { label: "Variable — I sometimes forget to eat",      dosha: "vata" },
      { label: "Strong — irritable if a meal is late",      dosha: "pitta" },
      { label: "Slow but steady — can skip meals easily",   dosha: "kapha" },
    ],
  },
  {
    q: "My digestion tends to be",
    options: [
      { label: "Irregular — gas or bloating is common",  dosha: "vata" },
      { label: "Sharp — I can eat almost anything",      dosha: "pitta" },
      { label: "Slow — I feel heavy after a full meal",  dosha: "kapha" },
    ],
  },
  {
    q: "Memory & learning",
    options: [
      { label: "Learn quickly, forget quickly",    dosha: "vata" },
      { label: "Sharp and focused on details",     dosha: "pitta" },
      { label: "Slow to learn, retain very well",  dosha: "kapha" },
    ],
  },
  {
    q: "Under stress I become",
    options: [
      { label: "Anxious or worried",     dosha: "vata" },
      { label: "Irritable or angry",     dosha: "pitta" },
      { label: "Withdrawn or lethargic", dosha: "kapha" },
    ],
  },
  {
    q: "My sleep is usually",
    options: [
      { label: "Light — wake easily and often",   dosha: "vata" },
      { label: "Moderate — wake feeling fresh",   dosha: "pitta" },
      { label: "Heavy — hard to wake up",         dosha: "kapha" },
    ],
  },
  {
    q: "My energy through the day",
    options: [
      { label: "Bursts followed by fatigue",        dosha: "vata" },
      { label: "Steady and purposeful throughout",  dosha: "pitta" },
      { label: "Slow start, sustained once going",  dosha: "kapha" },
    ],
  },
  {
    q: "My speech style is",
    options: [
      { label: "Fast and enthusiastic",    dosha: "vata" },
      { label: "Clear, precise, direct",   dosha: "pitta" },
      { label: "Slow and thoughtful",      dosha: "kapha" },
    ],
  },
];

function computeDosha(answers: Record<number, string>) {
  let vata = 0, pitta = 0, kapha = 0;
  Object.values(answers).forEach((d) => {
    if (d === "vata")  vata++;
    if (d === "pitta") pitta++;
    if (d === "kapha") kapha++;
  });
  const total = vata + pitta + kapha || 1;
  const v = Math.round((vata  / total) * 20);
  const p = Math.round((pitta / total) * 20);
  const k = Math.round((kapha / total) * 20);

  const sorted = [
    { d: "vata", s: vata }, { d: "pitta", s: pitta }, { d: "kapha", s: kapha },
  ].sort((a, b) => b.s - a.s);

  let primary = sorted[0].d;
  if (sorted[0].s - sorted[1].s <= 1) primary = `${sorted[0].d}-${sorted[1].d}`;
  if (vata >= 7 && pitta >= 7 && kapha >= 7) primary = "tridosha";

  return { v, p, k, primary };
}

const DOSHA_DESC: Record<string, { title: string; desc: string; color: string }> = {
  vata:          { title: "Vata",        desc: "Creative, quick-moving, light. Governed by Air & Space.",      color: "#7B68EE" },
  pitta:         { title: "Pitta",       desc: "Focused, driven, warm. Governed by Fire & Water.",             color: "#E07B39" },
  kapha:         { title: "Kapha",       desc: "Grounded, nurturing, steady. Governed by Earth & Water.",      color: "#6B46B8" },
  "vata-pitta":  { title: "Vata-Pitta", desc: "Lively and sharp — quick mind with strong drive.",             color: "#9B6EC9" },
  "pitta-kapha": { title: "Pitta-Kapha",desc: "Strong and steady with natural leadership.",                   color: "#5A8F5A" },
  "vata-kapha":  { title: "Vata-Kapha", desc: "Creative and enduring — light yet grounded.",                  color: "#6B8CAE" },
  tridosha:      { title: "Tridosha",   desc: "Rare balanced constitution — all three doshas in harmony.",    color: "#C8832A" },
};

// ── Shared styles ─────────────────────────────────────────────────
const inputStyle = {
  border: "1.5px solid #E0D4F2",
  background: "#FAF7FE",
  color: "#241C33",
  borderRadius: "12px",
  padding: "10px 14px",
  fontSize: "14px",
  width: "100%",
  outline: "none",
  appearance: "none" as const,
};

// ── Shared layout wrapper (must live OUTSIDE OnboardingPage to avoid remount on state change) ──
function Wrap({ step, children }: { step: number; children: React.ReactNode }) {
  const progress = Math.min(step / 4, 1) * 100;
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F3EEFA" }}>
      <header style={{ background: "linear-gradient(160deg, #241238 0%, #3A2260 70%, #4E3080 100%)" }}>
        <div className="max-w-md mx-auto px-5 pt-safe pb-4">
          <div className="flex items-center gap-2 mb-4">
            <KutumbhLogo size={30} />
            <div>
              <p className="text-base text-white leading-tight" style={{ fontFamily: "var(--font-dm-serif)" }}>
                My Kutumbh
              </p>
              <p className="text-xs leading-tight" style={{ color: "#C9B8E4" }}>मेरा कुटुम्ब</p>
            </div>
          </div>
          <div className="rounded-full h-1.5" style={{ background: "rgba(255,255,255,0.15)" }}>
            <div
              className="h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: "#C9B8E4" }}
            />
          </div>
          <p className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
            Step {Math.min(step, 3)} of 3
          </p>
        </div>
      </header>
      <main className="flex-1 max-w-md mx-auto w-full px-5 py-5">
        {children}
      </main>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // true if the user already belongs to a kutumbh (joined via invite)
  const [alreadyMember, setAlreadyMember] = useState(false);

  const [kutumbhName, setKutumbhName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<ReturnType<typeof computeDosha> | null>(null);

  // An invite in hand means they are joining someone else's family, not starting one
  useEffect(() => {
    const code = pendingInvite();
    if (code) router.replace(`/join/${code}`);
  }, [router]);

  // On mount: if user is already in a kutumbh (joined via invite), skip step 1
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("kutumbh_members")
        .select("kutumbh_id")
        .eq("user_id", user.id)
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setAlreadyMember(true);
            setStep(2); // skip to health basics
          }
        });
    });
  }, []);

  function handleKutumbh(e: React.FormEvent) {
    e.preventDefault();
    if (!kutumbhName.trim()) return;
    const name = kutumbhName.trim().endsWith("Kutumbh")
      ? kutumbhName.trim()
      : `${kutumbhName.trim()} Kutumbh`;
    setKutumbhName(name);
    setStep(2);
  }

  function handleProfile(e: React.FormEvent) {
    e.preventDefault();
    setStep(3);
  }

  function selectAnswer(qIdx: number, dosha: string) {
    setAnswers((prev) => ({ ...prev, [qIdx]: dosha }));
  }

  function handlePrakriti() {
    if (Object.keys(answers).length < QUESTIONS.length) {
      setError("Please answer all questions before continuing.");
      return;
    }
    setError(null);
    setResult(computeDosha(answers));
    setStep(4);
  }

  async function handleSkipPrakriti() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    if (!alreadyMember) {
      const { data: existing } = await supabase
        .from("kutumbh_members")
        .select("kutumbh_id")
        .eq("user_id", user.id)
        .limit(1);
      if (!existing?.[0]) {
        const { data: kutumbh, error: ke } = await supabase
          .from("kutumbhs")
          .insert({ name: kutumbhName, created_by: user.id, time_zone: deviceTimeZone() ?? DEFAULT_TIME_ZONE })
          .select()
          .single();
        if (ke) { setError(ke.message); setSaving(false); return; }
        await supabase.from("kutumbh_members").insert({
          kutumbh_id: kutumbh.id,
          user_id: user.id,
          role: "owner",
        });
      }
    }

    await supabase.from("profiles").upsert({
      id: user.id,
      full_name: user.user_metadata?.full_name,
      date_of_birth: dob || null,
      gender: gender || null,
      height_cm: height ? parseFloat(height) : null,
      weight_kg: weight ? parseFloat(weight) : null,
      activity_level: activity || null,
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    });

    router.push("/dashboard");
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    if (!alreadyMember) {
      // Check if this user already owns a kutumbh (re-run safety)
      const { data: existing } = await supabase
        .from("kutumbh_members")
        .select("kutumbh_id")
        .eq("user_id", user.id)
        .limit(1);

      const existingMembership = existing?.[0] ?? null;

      if (!existingMembership) {
        // First time — create the kutumbh and membership
        const { data: kutumbh, error: ke } = await supabase
          .from("kutumbhs")
          .insert({ name: kutumbhName, created_by: user.id, time_zone: deviceTimeZone() ?? DEFAULT_TIME_ZONE })
          .select()
          .single();

        if (ke) { setError(ke.message); setSaving(false); return; }

        const { error: me } = await supabase.from("kutumbh_members").insert({
          kutumbh_id: kutumbh.id,
          user_id: user.id,
          role: "owner",
        });

        if (me) { setError(me.message); setSaving(false); return; }
      }
    }

    // Always update the profile (idempotent)
    const { error: pe } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: user.user_metadata?.full_name,
      date_of_birth: dob || null,
      gender: gender || null,
      height_cm: height ? parseFloat(height) : null,
      weight_kg: weight ? parseFloat(weight) : null,
      activity_level: activity || null,
      prakriti_vata: result.v,
      prakriti_pitta: result.p,
      prakriti_kapha: result.k,
      primary_dosha: result.primary,
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    });

    if (pe) { setError(pe.message); setSaving(false); return; }
    router.push("/dashboard");
  }

  // ══ STEP 1 — Kutumbh name ══════════════════════════════════════
  if (step === 1) return (
    <Wrap step={step}>
      <h2 className="text-xl mb-1" style={{ fontFamily: "var(--font-dm-serif)", color: "#241C33" }}>
        Name your Kutumbh
      </h2>
      <p className="text-sm mb-5" style={{ color: "#625A75" }}>
        Your family&apos;s name in the app — &ldquo;Kutumbh&rdquo; is added for you.
      </p>
      <form onSubmit={handleKutumbh} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#6A6180" }}>
            Family name
          </label>
          <input
            type="text"
            required
            value={kutumbhName}
            onChange={(e) => setKutumbhName(e.target.value)}
            style={inputStyle}
            placeholder="e.g. Iyer"
          />
          {kutumbhName && (
            <p className="text-sm mt-2 font-medium" style={{ color: "#6B46B8" }}>
              → {kutumbhName.trim().endsWith("Kutumbh") ? kutumbhName.trim() : `${kutumbhName.trim()} Kutumbh`}
            </p>
          )}
        </div>
        <button
          type="submit"
          className="w-full py-3 rounded-xl font-semibold text-sm text-white"
          style={{ background: "#241238" }}
        >
          Continue →
        </button>
      </form>
    </Wrap>
  );

  // ══ STEP 2 — Health basics ═════════════════════════════════════
  if (step === 2) return (
    <Wrap step={step}>
      <h2 className="text-xl mb-1" style={{ fontFamily: "var(--font-dm-serif)", color: "#241C33" }}>
        Your health basics
      </h2>
      <p className="text-sm mb-5" style={{ color: "#625A75" }}>
        Used for calorie targets and Ayurvedic analysis. All fields optional.
      </p>
      <form onSubmit={handleProfile} className="space-y-4">

        {/* DOB + Gender side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#6A6180" }}>
              Date of birth
            </label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#6A6180" }}>
              Gender
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              style={inputStyle}
            >
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Height + Weight side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#6A6180" }}>
              Height (cm)
            </label>
            <input
              type="number" min="100" max="250"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              style={inputStyle}
              placeholder="170"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#6A6180" }}>
              Weight (kg)
            </label>
            <input
              type="number" min="30" max="250"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              style={inputStyle}
              placeholder="70"
            />
          </div>
        </div>

        {/* Activity level — dropdown */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#6A6180" }}>
            Activity level
          </label>
          <select
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            style={inputStyle}
          >
            <option value="">Select activity level</option>
            <option value="sedentary">Sedentary — desk work, little movement</option>
            <option value="light">Light — walking, light housework</option>
            <option value="moderate">Moderate — exercise 3–4× per week</option>
            <option value="active">Active — exercise most days</option>
            <option value="very_active">Very Active — physical job or intense daily training</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full py-3 rounded-xl font-semibold text-sm text-white"
          style={{ background: "#241238" }}
        >
          Continue →
        </button>
        <button
          type="button"
          onClick={() => setStep(1)}
          className="w-full py-2 text-sm"
          style={{ color: "#6A6180" }}
        >
          ← Back
        </button>
      </form>
    </Wrap>
  );

  // ══ STEP 3 — Prakriti quiz ═════════════════════════════════════
  if (step === 3) return (
    <Wrap step={step}>
      <h2 className="text-xl mb-1" style={{ fontFamily: "var(--font-dm-serif)", color: "#241C33" }}>
        Discover your Prakriti
      </h2>
      <p className="text-sm mb-4" style={{ color: "#625A75" }}>
        Choose what best describes your <em>natural</em> tendencies — not your current state, but across most of your life.
      </p>

      <div className="space-y-5 pb-24">
        {QUESTIONS.map((q, qi) => (
          <div key={qi}>
            <p className="text-sm font-semibold mb-2" style={{ color: "#241C33" }}>
              {qi + 1}. {q.q}
            </p>
            <div className="space-y-1.5">
              {q.options.map((opt) => {
                const selected = answers[qi] === opt.dosha;
                return (
                  <button
                    key={opt.dosha}
                    type="button"
                    onClick={() => selectAnswer(qi, opt.dosha)}
                    className="w-full px-3 py-2.5 rounded-xl text-left text-sm"
                    style={{
                      background: selected ? "#E7DCF7" : "#fff",
                      border: `1.5px solid ${selected ? "#6B46B8" : "#E0D4F2"}`,
                      color: selected ? "#4B2D7A" : "#3A3F38",
                      fontWeight: selected ? 500 : 400,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {/* Fixed bottom bar */}
      <div
        className="fixed bottom-0 left-0 right-0 px-5 py-4"
        style={{ background: "#F3EEFA", borderTop: "1px solid #E0D4F2" }}
      >
        <div className="max-w-md mx-auto">
          <p className="text-xs text-center mb-2" style={{ color: "#6A6180" }}>
            {Object.keys(answers).length} of {QUESTIONS.length} answered
          </p>
          <button
            type="button"
            onClick={handlePrakriti}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white"
            style={{
              background: "#241238",
              opacity: Object.keys(answers).length < QUESTIONS.length ? 0.5 : 1,
            }}
          >
            See my Prakriti →
          </button>
          <button
            type="button"
            onClick={handleSkipPrakriti}
            disabled={saving}
            className="w-full py-2 text-sm mt-2"
            style={{ color: "#6A6180" }}
          >
            {saving ? "Saving…" : "Skip for now"}
          </button>
        </div>
      </div>
    </Wrap>
  );

  // ══ STEP 4 — Result ════════════════════════════════════════════
  if (step === 4 && result) {
    const info = DOSHA_DESC[result.primary] ?? DOSHA_DESC["tridosha"];
    return (
      <Wrap step={step}>
        <h2 className="text-xl mb-1" style={{ fontFamily: "var(--font-dm-serif)", color: "#241C33" }}>
          Your Prakriti
        </h2>
        <p className="text-sm mb-4" style={{ color: "#625A75" }}>
          Your primary constitution is:
        </p>

        <div
          className="rounded-2xl px-5 py-5 mb-5 text-center"
          style={{ background: info.color, color: "#fff" }}
        >
          <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-dm-serif)" }}>
            {info.title}
          </p>
          <p className="text-sm mt-1 opacity-85">{info.desc}</p>
        </div>

        <div className="space-y-3 mb-6">
          {[
            { label: "Vata",  score: result.v, color: "#7B68EE" },
            { label: "Pitta", score: result.p, color: "#E07B39" },
            { label: "Kapha", score: result.k, color: "#6B46B8" },
          ].map(({ label, score, color }) => (
            <div key={label}>
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: "#625A75" }}>{label}</span>
                <span style={{ color }}>{score}/20</span>
              </div>
              <div className="rounded-full h-2" style={{ background: "#E0D4F2" }}>
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${(score / 20) * 100}%`, background: color }}
                />
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm mb-4" style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
          style={{ background: "#241238" }}
        >
          {saving ? "Setting up your Kutumbh…" : "Enter My Kutumbh →"}
        </button>
      </Wrap>
    );
  }

  return null;
}
