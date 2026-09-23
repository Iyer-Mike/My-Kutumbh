import Link from "next/link";
import { BRAND as B } from "@/lib/brand";

type Point = { title: string; body: string; tint: string; stroke: string; icon: React.ReactNode };

const POINTS: Point[] = [
  {
    title: "One menu, everyone's own plate",
    body: "Anyone in the family can put up the day's menu. Each person logs the portion they actually ate.",
    tint: B.tint, stroke: B.violet,
    icon: (
      <>
        <path d="M9 7a3 3 0 1 0 0-.01" /><path d="M3 20v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1" />
        <path d="M16 3.5a3 3 0 0 1 0 5.8" /><path d="M21 20v-1a4 4 0 0 0-3-3.85" />
      </>
    ),
  },
  {
    title: "Dishes you actually cook",
    body: "Idli to rajma to avial, with recipes — picked by region, diet and kind of dish, and add your own family dishes.",
    tint: B.goldTint, stroke: B.goldInk,
    icon: (
      <>
        <path d="M4 4h10a4 4 0 0 1 0 8H4" /><path d="M4 12h8a4 4 0 0 1 0 8H4" />
        <path d="M4 4v16" /><path d="M18 14v6" />
      </>
    ),
  },
  {
    title: "Your lab report, turned into food",
    body: "Upload a report and see what to eat more of and what to keep small — for sugar, cholesterol, iron, vitamins.",
    tint: B.tint, stroke: B.violet,
    icon: <path d="M3 13h4l2.5 6 5-14 2.5 8h4" />,
  },
  {
    title: "Ask the coach anything",
    body: "Answers built from your own meals, profile and reports — never a change to your medicines.",
    tint: B.goldTint, stroke: B.goldInk,
    icon: (
      <>
        <path d="M21 12a8 8 0 1 1-3.2-6.4" /><path d="M12 8v4l3 2" />
      </>
    ),
  },
];

export default function LandingPage() {
  return (
    <main className="flex flex-col min-h-screen" style={{ background: B.page }}>
      {/* Header */}
      <header className="px-6 pt-safe pb-8" style={{ background: B.headerGradient }}>
        <div className="max-w-md mx-auto pt-10 grid gap-[18px]">
          <div className="flex items-center gap-2.5">
            <div className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center text-[19px]"
              style={{ background: B.gold, color: "#2A1646", fontFamily: "var(--font-dm-serif)" }} aria-hidden>
              क
            </div>
            <div className="grid">
              <span className="text-[19px] leading-tight text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>
                My Kutumbh
              </span>
              <span className="text-[11px] tracking-wide" style={{ color: B.onDarkFaint }}>मेरा कुटुम्ब</span>
            </div>
          </div>

          <div className="grid gap-2.5">
            <div className="flex items-center gap-2.5">
              <span className="block w-[22px] h-px" style={{ background: B.gold }} />
              <span className="text-[11px] uppercase" style={{ letterSpacing: "0.16em", color: B.gold }}>
                अन्नं ब्रह्म · food is sacred
              </span>
            </div>
            <h1 className="m-0 text-white" style={{ fontFamily: "var(--font-dm-serif)", lineHeight: 1.14 }}>
              <span className="block text-[36px]">Eat as a Family.</span>
              <span className="block text-[28px] italic" style={{ color: B.gold }}>Thrive as Yourself.</span>
            </h1>
          </div>

          <p className="m-0 text-sm leading-relaxed" style={{ color: B.onDark }}>
            Plan the day&apos;s menu together, log what each person actually eats, and let your meals answer to your
            body — in the language of Indian home cooking.
          </p>
        </div>
      </header>

      {/* What it does */}
      <section className="flex-1 px-6 pt-6">
        <div className="max-w-md mx-auto grid gap-3.5">
          {POINTS.map((p) => (
            <div key={p.title} className="flex gap-3.5 items-start">
              <div className="w-[38px] h-[38px] shrink-0 rounded-xl flex items-center justify-center" style={{ background: p.tint }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={p.stroke} strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {p.icon}
                </svg>
              </div>
              <div className="grid gap-0.5">
                <p className="m-0 text-[14.5px] font-semibold" style={{ color: B.ink }}>{p.title}</p>
                <p className="m-0 text-[13px] leading-relaxed" style={{ color: B.muted }}>{p.body}</p>
              </div>
            </div>
          ))}

          <div className="rounded-2xl px-4 py-3 flex gap-3 items-center"
            style={{ background: B.card, border: `1px solid ${B.cardEdge}` }}>
            <span className="text-[22px]" style={{ fontFamily: "var(--font-dm-serif)", color: "#B07C12" }} aria-hidden>आ</span>
            <p className="m-0 text-[12.5px] leading-relaxed" style={{ color: B.muted }}>
              <b style={{ color: B.goldInk }}>Ayurvedic approach —</b> every dish also carries its{" "}
              <b style={{ color: B.ink }}>rasa, virya and dosha effect</b>, so the advice fits your prakriti.
            </p>
          </div>
        </div>
      </section>

      {/* Actions */}
      <section className="px-6 pt-5 pb-safe">
        <div className="max-w-md mx-auto grid gap-3 pb-8">
          <Link href="/signup" className="block text-center py-4 rounded-2xl text-[15px] font-semibold text-white"
            style={{ background: B.button }}>
            Create an account
          </Link>

          <p className="m-0 text-center text-[13.5px]" style={{ color: B.muted }}>
            Already with us?{" "}
            <Link href="/login" className="font-semibold" style={{ color: B.violetLink }}>Sign in</Link>
          </p>

          <div className="mt-1 rounded-2xl px-3.5 py-3 flex gap-2.5 items-center"
            style={{ background: "#EDE4FA", border: "1px dashed #C4AEE6" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={B.violet} strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
              <rect x="6" y="2" width="12" height="20" rx="3" /><path d="M12 6v7" /><path d="M9 10l3 3 3-3" />
            </svg>
            <p className="m-0 text-xs leading-snug" style={{ color: B.ink2 }}>
              <b>Add to Home Screen</b> to use My Kutumbh like an app, even offline.
            </p>
          </div>

          <p className="m-0 text-center text-[11px] leading-snug" style={{ color: B.muted2 }}>
            General guidance on food and habits — not medical advice.
          </p>
        </div>
      </section>
    </main>
  );
}
