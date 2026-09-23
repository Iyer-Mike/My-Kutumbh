"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ── Prakriti questionnaire ───────────────────────────────
// Each question has 3 options: [Vata, Pitta, Kapha]
const QUESTIONS = [
  {
    q: "My body frame is",
    opts: ["Thin, light, difficult to gain weight", "Medium, muscular, moderate weight", "Broad, heavy, easy to gain weight"],
  },
  {
    q: "My skin is typically",
    opts: ["Dry, rough, or thin", "Warm, oily, or prone to rashes", "Thick, smooth, and oily"],
  },
  {
    q: "My hair is",
    opts: ["Dry, brittle, thin, or frizzy", "Fine, oily, early greying or thinning", "Thick, oily, wavy, and lustrous"],
  },
  {
    q: "My digestion is",
    opts: ["Irregular — sometimes strong, sometimes weak", "Strong — I get very hungry and irritable if I miss a meal", "Slow but steady — I can skip meals comfortably"],
  },
  {
    q: "My appetite is",
    opts: ["Variable — changes day to day", "High — I must eat regularly", "Low to moderate — rarely very hungry"],
  },
  {
    q: "My sleep is",
    opts: ["Light, interrupted, or difficulty falling asleep", "Moderate — I wake up but fall back easily", "Deep and long — I could sleep more than needed"],
  },
  {
    q: "When I am under stress, I tend to",
    opts: ["Become anxious, worried, or fearful", "Become irritable, angry, or critical", "Withdraw, become quiet, or depressed"],
  },
  {
    q: "My memory is",
    opts: ["Quick to learn, quick to forget", "Sharp — I remember details well", "Slow to learn, but long-lasting memory"],
  },
  {
    q: "My speech style is",
    opts: ["Fast, talkative, sometimes jumping topics", "Precise, direct, and purposeful", "Slow, measured, and deliberate"],
  },
  {
    q: "My energy levels through the day are",
    opts: ["Variable — bursts of energy followed by exhaustion", "Strong and focused — I accomplish a lot", "Steady and consistent throughout the day"],
  },
  {
    q: "My joints and bones are",
    opts: ["Prominent, cracking sounds sometimes", "Loose, flexible, sometimes inflamed", "Large, well-formed, well-lubricated"],
  },
  {
    q: "In cold weather, I",
    opts: ["Feel cold easily and dislike it strongly", "Feel comfortable or prefer cool environments", "Tolerate cold well — I prefer warmth but manage"],
  },
  {
    q: "My bowel movement is",
    opts: ["Irregular, tends toward constipation", "Regular, sometimes loose or diarrhoea-prone", "Regular, heavy, and sluggish"],
  },
  {
    q: "My decision-making style is",
    opts: ["Indecisive — I change my mind frequently", "Decisive and confident — sometimes forceful", "Slow but steady — once decided, I stick to it"],
  },
  {
    q: "My emotional nature is",
    opts: ["Enthusiastic, creative, but anxious or fearful", "Passionate, driven, but prone to anger or jealousy", "Calm, patient, loving, but can be possessive"],
  },
];

const DOSHA_LABELS = ["Vata", "Pitta", "Kapha"];
const DOSHA_COLORS = ["#7B68EE", "#E07B39", "#6B46B8"];
const DOSHA_ICONS  = ["🌬️", "🔥", "🌊"];

function computePrakriti(answers: number[]) {
  const scores = [0, 0, 0];
  for (const a of answers) {
    if (a >= 0) scores[a]++;
  }
  // Scale to 0-20
  const max = QUESTIONS.length;
  const vata  = Math.round((scores[0] / max) * 20);
  const pitta = Math.round((scores[1] / max) * 20);
  const kapha = Math.round((scores[2] / max) * 20);

  // Determine primary dosha
  const sorted = [
    { d: "vata",  s: vata  },
    { d: "pitta", s: pitta },
    { d: "kapha", s: kapha },
  ].sort((a, b) => b.s - a.s);

  let primary: string;
  const diff01 = sorted[0].s - sorted[1].s;
  if (diff01 <= 2) {
    // Name the pair in canonical order — profiles_primary_dosha_check only
    // accepts vata-pitta / pitta-kapha / vata-kapha, never e.g. pitta-vata.
    const ORDER = ["vata", "pitta", "kapha"];
    const pair = [sorted[0].d, sorted[1].d].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    primary = `${pair[0]}-${pair[1]}`;
    // Special case: all three equal-ish
    const diff12 = sorted[1].s - sorted[2].s;
    if (diff01 <= 2 && diff12 <= 2) primary = "tridosha";
  } else {
    primary = sorted[0].d;
  }

  return { vata, pitta, kapha, primary };
}

type Props = { userId: string };

export default function PrakritiAssessment({ userId }: Props) {
  const router   = useRouter();
  const supabase = createClient();

  const [answers, setAnswers] = useState<number[]>(new Array(QUESTIONS.length).fill(-1));
  const [step, setStep]       = useState<"quiz" | "result">("quiz");
  const [result, setResult]   = useState<{ vata: number; pitta: number; kapha: number; primary: string } | null>(null);
  const [saving, setSaving]   = useState(false);

  const answered    = answers.filter(a => a >= 0).length;
  const allAnswered = answered === QUESTIONS.length;

  function pick(qIdx: number, optIdx: number) {
    setAnswers(prev => { const n = [...prev]; n[qIdx] = optIdx; return n; });
  }

  function submit() {
    const r = computePrakriti(answers);
    setResult(r);
    setStep("result");
  }

  async function saveAndReturn() {
    if (!result) return;
    setSaving(true);
    await supabase.from("profiles").update({
      prakriti_vata:  result.vata,
      prakriti_pitta: result.pitta,
      prakriti_kapha: result.kapha,
      primary_dosha:  result.primary,
    }).eq("id", userId);
    setSaving(false);
    router.push("/profile");
    router.refresh();
  }

  const DOSHA_LABEL_MAP: Record<string, string> = {
    vata: "Vata", pitta: "Pitta", kapha: "Kapha",
    "vata-pitta": "Vata-Pitta", "pitta-kapha": "Pitta-Kapha",
    "vata-kapha": "Vata-Kapha", tridosha: "Tridosha",
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#F3EEFA" }}>

      {/* Header */}
      <header className="px-5 py-4 flex items-center justify-between"
        style={{ background: "linear-gradient(160deg, #241238 0%, #3A2260 70%, #4E3080 100%)" }}>
        <div>
          <p className="text-xs mb-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>Prakriti Assessment</p>
          <h1 className="text-xl text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>
            Your Constitution
          </h1>
        </div>
        <button
          onClick={() => router.push("/profile")}
          className="px-4 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>
          Skip
        </button>
      </header>

      {step === "quiz" && (
        <main className="flex-1 px-5 py-5 space-y-5 pb-24">

          <p className="text-xs" style={{ color: "#6A6180" }}>
            {answered} of {QUESTIONS.length} answered — choose the option that best describes you most of the time.
          </p>

          {/* Progress bar */}
          <div className="rounded-full h-1.5" style={{ background: "#E0D4F2" }}>
            <div className="h-1.5 rounded-full transition-all"
              style={{ width: `${(answered / QUESTIONS.length) * 100}%`, background: "#6B46B8" }} />
          </div>

          {QUESTIONS.map((item, qi) => (
            <div key={qi} className="rounded-2xl overflow-hidden"
              style={{ background: "#FAF7FE", border: `1.5px solid ${answers[qi] >= 0 ? "#6B46B8" : "#E0D4F2"}` }}>
              <div className="px-4 pt-3 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: "#6A6180" }}>
                  Q{qi + 1}
                </p>
                <p className="text-sm font-medium" style={{ color: "#241C33" }}>{item.q}</p>
              </div>
              <div style={{ borderTop: "1px solid #EDE7F7" }}>
                {item.opts.map((opt, oi) => {
                  const selected = answers[qi] === oi;
                  return (
                    <button
                      key={oi}
                      onClick={() => pick(qi, oi)}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left"
                      style={{
                        borderTop: oi > 0 ? "1px solid #EDE7F7" : undefined,
                        background: selected ? "#E7DCF7" : "#fff",
                      }}>
                      <div className="shrink-0 w-5 h-5 rounded-full mt-0.5 flex items-center justify-center"
                        style={{
                          background: selected ? DOSHA_COLORS[oi] : "#fff",
                          border: `2px solid ${selected ? DOSHA_COLORS[oi] : "#CBBDE4"}`,
                        }}>
                        {selected && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span className="text-sm leading-snug" style={{ color: selected ? "#241C33" : "#625A75" }}>
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Fixed bottom bar */}
          <div className="fixed bottom-0 left-0 right-0 px-5 py-4"
            style={{ background: "#F3EEFA", borderTop: "1px solid #E0D4F2" }}>
            <button
              onClick={submit}
              disabled={!allAnswered}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-40"
              style={{ background: "#241238" }}>
              {allAnswered ? "See My Prakriti →" : `Answer all ${QUESTIONS.length - answered} remaining`}
            </button>
          </div>
        </main>
      )}

      {step === "result" && result && (
        <main className="flex-1 px-5 py-5 space-y-4">

          {/* Primary Dosha */}
          <div className="rounded-2xl px-5 py-5 text-center"
            style={{ background: "#241238" }}>
            <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Your Prakriti</p>
            <p className="text-3xl mb-1" style={{ fontFamily: "var(--font-dm-serif)", color: "#fff" }}>
              {DOSHA_LABEL_MAP[result.primary] ?? result.primary}
            </p>
            <p className="text-xs" style={{ color: "#C9B8E4" }}>Dominant constitution</p>
          </div>

          {/* Score bars */}
          <div className="rounded-2xl px-5 py-4 space-y-4"
            style={{ background: "#FAF7FE", border: "1px solid #E0D4F2" }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6A6180" }}>
              Dosha Balance
            </p>
            {[
              { label: "Vata",  score: result.vata,  color: "#7B68EE", icon: "🌬️" },
              { label: "Pitta", score: result.pitta, color: "#E07B39", icon: "🔥" },
              { label: "Kapha", score: result.kapha, color: "#6B46B8", icon: "🌊" },
            ].map(({ label, score, color, icon }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium" style={{ color: "#241C33" }}>
                    {icon} {label}
                  </span>
                  <span className="text-sm font-semibold" style={{ color }}>{score}/20</span>
                </div>
                <div className="rounded-full h-2" style={{ background: "#E0D4F2" }}>
                  <div className="h-2 rounded-full transition-all"
                    style={{ width: `${(score / 20) * 100}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>

          {/* Brief description */}
          <div className="rounded-2xl px-5 py-4"
            style={{ background: "#E7DCF7", border: "1px solid #CBB4EE" }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#6B46B8" }}>
              What this means
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "#2D5228" }}>
              Your Prakriti score guides food choices, timing, and portion sizes personalised to your constitution.
              This is used throughout the app to refine your nutritional analysis and AI recommendations.
            </p>
          </div>

          {/* Retake / Save */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={saveAndReturn}
              disabled={saving}
              className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-40"
              style={{ background: "#241238" }}>
              {saving ? "Saving…" : "Save to Profile ✓"}
            </button>
            <button
              onClick={() => setStep("quiz")}
              className="px-4 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "#EDE7F7", color: "#625A75" }}>
              Retake
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
