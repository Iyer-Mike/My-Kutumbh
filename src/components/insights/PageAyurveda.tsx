"use client";

import type { AyurvedaSummary, Rasa } from "@/lib/insights/ayurveda";
import { Card, Label, Says, C, T } from "./bits";
import { FAMILY, look } from "@/lib/brand";

/**
 * 4 · Ayurvedic Analysis
 *
 * The six tastes, what is heating and what is cooling, and what the
 * week has done to each dosha. A complement to the nutrition, never a
 * replacement for a doctor.
 */

const RASA: Record<Rasa, string> = {
  sweet: "Sweet", sour: "Sour", salty: "Salty", pungent: "Pungent", bitter: "Bitter", astringent: "Astringent",
};

/** Which tastes are so absent they are worth naming. */
const SCARCE = 0.06;

type Fix = { problem: string; change: string; how: string };

/** What each missing taste brings, in the classical terms. */
const TASTE_FIX: Partial<Record<Rasa, { change: string; how: string }>> = {
  bitter: { change: "Add karela, methi, drumstick leaves, neem flowers or bitter greens.", how: "Bitter cools Pitta and dries Kapha, and is the taste most often missing; it also helps digestion and steadies blood sugar." },
  astringent: { change: "Add moong, whole pulses, pomegranate, raw banana or green leafy vegetables.", how: "Astringent is drying and binding: it calms Pitta and Kapha and settles a loose or heavy stomach." },
  pungent: { change: "Add ginger, black pepper, cumin, mustard or green chilli in the tempering.", how: "Pungent kindles digestion (agni) and clears Kapha heaviness." },
  sour: { change: "Add lemon, amla, buttermilk, tamarind or a little curd.", how: "Sour wakes the appetite and digestion and calms Vata." },
  sweet: { change: "Add whole grains, milk, ghee, dates or sweet fruit.", how: "Sweet is the taste that nourishes; it calms Vata and Pitta." },
};

/** What a food change would do for each shortcoming this page finds. */
function fixes(a: AyurvedaSummary): Fix[] {
  const out: Fix[] = [];
  const name = (r: Rasa) => RASA[r].toLowerCase();

  for (const r of (Object.keys(RASA) as Rasa[])) {
    const t = TASTE_FIX[r];
    if (t && a.tasteShare[r] < SCARCE) out.push({ problem: `Little ${name(r)} taste (${Math.round(a.tasteShare[r] * 100)}%)`, ...t });
  }

  for (const d of a.primaryDoshas) {
    if (a.aggravatingShare[d] < 0.35) continue;
    const pct = Math.round(a.aggravatingShare[d] * 100);
    if (d === "vata") out.push({ problem: `${pct}% of food aggravates Vata`, change: "Favour warm, cooked, moist food with ghee or sesame oil; keep raw salads, dry snacks and cold drinks small.", how: "Warmth, oil and a little sweet, sour or salty taste steady Vata's dry, light, cold nature." });
    if (d === "pitta") out.push({ problem: `${pct}% of food aggravates Pitta`, change: "Favour cooling food: coconut, cucumber, coriander, fennel, buttermilk; ease off chilli, fried and very sour food.", how: "Sweet, bitter and astringent tastes with cooling foods quench Pitta's heat." });
    if (d === "kapha") out.push({ problem: `${pct}% of food aggravates Kapha`, change: "Favour light, warm food with ginger, pepper and bitter greens; go easy on sweets, dairy, fried food and cold drinks.", how: "Pungent, bitter and astringent tastes lighten and dry Kapha's heavy, damp nature." });
  }

  if (a.primaryDoshas.includes("pitta") && a.virya.heating >= 0.5) {
    out.push({ problem: `${Math.round(a.virya.heating * 100)}% of food is heating`, change: "Swap some for cooling dishes: curd rice, cucumber raita, coconut chutney, buttermilk.", how: "Cooling food offsets the heat that builds up Pitta." });
  }
  if ((a.primaryDoshas.includes("vata") || a.primaryDoshas.includes("kapha")) && a.virya.cooling >= 0.5) {
    out.push({ problem: `${Math.round(a.virya.cooling * 100)}% of food is cooling`, change: "Swap some for warming dishes: ginger tea, cumin rasam, hot soups, cooked vegetables.", how: "Warm food counters the cold, slow quality that Vata and Kapha tend to." });
  }
  return out.slice(0, 4);
}

export default function PageAyurveda({
  ayurveda, primaryDosha, viewingOther, firstName,
}: {
  ayurveda: AyurvedaSummary;
  primaryDosha: string | null;
  viewingOther: boolean;
  firstName: string;
}) {
  if (ayurveda.coverage === 0) {
    return (
      <Card>
        <Label n={1}>The six tastes</Label>
        <Says>
          No Ayurvedic data yet · fills in as dishes are completed.
        </Says>
      </Card>
    );
  }

  const tastes = (Object.keys(RASA) as Rasa[])
    .map((r) => ({ r, share: ayurveda.tasteShare[r] }))
    .sort((a, b) => b.share - a.share);

  const todo = fixes(ayurveda);
  const missing = tastes.filter((t) => t.share < SCARCE).map((t) => RASA[t.r].toLowerCase());
  const leading = tastes[0];

  return (
    <div className="grid gap-3">

      {/* 1 · The six tastes */}
      <Card>
        <Label n={1} aside={primaryDosha ? `${primaryDosha[0].toUpperCase()}${primaryDosha.slice(1)} Prakriti` : undefined}>
          The six tastes
        </Label>

        <div className="mt-3 grid gap-2">
          {tastes.map(({ r, share }) => (
            <div key={r} className="flex items-center gap-2.5">
              <span className="flex-shrink-0" style={{ width: "5.5rem", fontSize: T.body, color: C.ink }}>{RASA[r]}</span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: C.track }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(share * 100, 1)}%`, background: share < SCARCE ? C.warn : "#C8832A" }}
                />
              </div>
              <span
                className="flex-shrink-0 text-right tabular-nums"
                style={{ width: "2.6rem", fontSize: T.note, color: share < SCARCE ? C.warn : C.ink3, fontWeight: share < SCARCE ? 600 : 400 }}
              >
                {Math.round(share * 100)}%
              </span>
            </div>
          ))}
        </div>

        <Says>
          {missing.length > 0 ? `Low: ${missing.join(", ")} → karela, methi, drumstick, moong.` : `${RASA[leading.r]} leads at ${Math.round(leading.share * 100)}%.`}
        </Says>
      </Card>

      {/* 2 · Heating and cooling */}
      <Card>
        <Label n={2}>Heating and cooling</Label>

        <div className="flex rounded-full overflow-hidden mt-3" style={{ height: "0.7rem" }}>
          <div style={{ width: `${ayurveda.virya.heating * 100}%`, background: "#D4573A" }} />
          <div style={{ width: `${ayurveda.virya.neutral * 100}%`, background: "#B9B3A2" }} />
          <div style={{ width: `${ayurveda.virya.cooling * 100}%`, background: "#3F7FB8" }} />
        </div>
        <div className="flex justify-between mt-1.5" style={{ fontSize: T.note, color: C.ink3 }}>
          <span>Heating {Math.round(ayurveda.virya.heating * 100)}%</span>
          <span>Neutral {Math.round(ayurveda.virya.neutral * 100)}%</span>
          <span>Cooling {Math.round(ayurveda.virya.cooling * 100)}%</span>
        </div>

        <div className="flex gap-2 mt-4">
          {(["vata", "pitta", "kapha"] as const).map((d) => {
            const net = ayurveda.doshaNet[d];
            const mine = ayurveda.primaryDoshas.includes(d);
            const word = net > 0.15 ? "Balancing" : net < -0.15 ? "Aggravating" : "Neutral";
            return (
              <div
                key={d}
                className="flex-1 rounded-xl px-2 py-2 text-center"
                style={mine ? { background: "#FBEBCB", border: "2.5px solid #F2B531" } : look(FAMILY.violet)}
              >
                <p className="m-0 font-bold capitalize" style={{ fontSize: T.body, color: C.ink }}>
                  {d}{mine ? " ★" : ""}
                </p>
                <p className="m-0 mt-0.5 font-semibold" style={{ fontSize: T.note, color: net < -0.15 ? C.warn : net > 0.15 ? C.leaf : C.ink3 }}>
                  {word}
                </p>
              </div>
            );
          })}
        </div>

        {ayurveda.notes.length > 0 && (
          <ul className="grid gap-1.5 mt-3 mb-0 pl-4" style={{ fontSize: T.body, color: C.ink2, listStyle: "disc", lineHeight: 1.55 }}>
            {ayurveda.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        )}

        <p className="m-0 mt-3" style={{ fontSize: T.note, color: C.ink3, lineHeight: 1.5 }}>
          Complements nutrition · not a substitute for {viewingOther ? `${firstName}'s` : "your"} doctor.
        </p>
      </Card>

      {/* 3 · How a change of food would help */}
      <Card tone="mint">
        <Label>How a change of food would help</Label>
        {todo.length === 0 ? (
          <Says>Tastes and doshas are in balance for this period · nothing to change ✓</Says>
        ) : (
          <div className="mt-2 grid gap-3">
            {todo.map((f) => (
              <div key={f.problem}>
                <p className="m-0 font-bold" style={{ fontSize: T.body, color: C.ink }}>{f.problem}</p>
                <p className="m-0 mt-0.5" style={{ fontSize: T.body, color: C.ink2, lineHeight: 1.5 }}>
                  <b style={{ color: C.leaf }}>Change:</b> {f.change}
                </p>
                <p className="m-0 mt-0.5" style={{ fontSize: T.body, color: C.ink2, lineHeight: 1.5 }}>
                  <b style={{ color: C.ink }}>How it helps:</b> {f.how}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
