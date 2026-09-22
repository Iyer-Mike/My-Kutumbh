import type { LogEntry } from "./types";

export const RASAS = ["sweet", "sour", "salty", "pungent", "bitter", "astringent"] as const;
export type Rasa = (typeof RASAS)[number];
export type Dosha = "vata" | "pitta" | "kapha";
const DOSHAS: Dosha[] = ["vata", "pitta", "kapha"];

export type AyurvedaSummary = {
  coverage: number;                      // share of intake (by kcal) with Ayurvedic data
  tasteShare: Record<Rasa, number>;      // 0–1, sums to 1 when data exists
  missingTastes: Rasa[];                 // under 3% of intake
  virya: { heating: number; cooling: number; neutral: number };
  /** Net effect per dosha, -1 (all aggravating) … +1 (all balancing). */
  doshaNet: Record<Dosha, number>;
  aggravatingShare: Record<Dosha, number>;
  primaryDoshas: Dosha[];
  notes: string[];
};

const EFFECT: Record<string, number> = { balances: 1, neutral: 0, aggravates: -1 };

/** Doshas named in a primary_dosha value such as "pitta", "vata-pitta" or "tridosha". */
export function doshasOf(primary: string | null): Dosha[] {
  if (!primary) return [];
  if (primary === "tridosha") return [...DOSHAS];
  return primary.split("-").filter((d): d is Dosha => (DOSHAS as string[]).includes(d));
}

const label = (d: Dosha) => d[0].toUpperCase() + d.slice(1);
const pct = (x: number) => `${Math.round(x * 100)}%`;

export function summarizeAyurveda(entries: LogEntry[], primaryDosha: string | null): AyurvedaSummary {
  const taste = Object.fromEntries(RASAS.map((r) => [r, 0])) as Record<Rasa, number>;
  const virya = { heating: 0, cooling: 0, neutral: 0 };
  const net = { vata: 0, pitta: 0, kapha: 0 };
  const aggr = { vata: 0, pitta: 0, kapha: 0 };
  let total = 0;
  let covered = 0;

  for (const e of entries) {
    const w = e.calories && e.calories > 0 ? e.calories : 1;   // weight by energy eaten
    total += w;
    const f = e.food;
    if (!f || (!f.rasa?.length && !f.virya && !f.vata_effect)) continue;
    covered += w;

    const tastes = (f.rasa ?? []).filter((r): r is Rasa => (RASAS as readonly string[]).includes(r));
    for (const r of tastes) taste[r] += w / tastes.length;

    if (f.virya === "heating" || f.virya === "cooling" || f.virya === "neutral") virya[f.virya] += w;

    const eff: Record<Dosha, string | null> = { vata: f.vata_effect, pitta: f.pitta_effect, kapha: f.kapha_effect };
    for (const d of DOSHAS) {
      const v = EFFECT[eff[d] ?? "neutral"] ?? 0;
      net[d] += v * w;
      if (v < 0) aggr[d] += w;
    }
  }

  const tasteSum = RASAS.reduce((s, r) => s + taste[r], 0);
  const tasteShare = Object.fromEntries(RASAS.map((r) => [r, tasteSum ? taste[r] / tasteSum : 0])) as Record<Rasa, number>;
  const viryaSum = virya.heating + virya.cooling + virya.neutral;
  const norm = (x: number, by: number) => (by ? x / by : 0);

  const summary: AyurvedaSummary = {
    coverage: norm(covered, total),
    tasteShare,
    missingTastes: tasteSum ? RASAS.filter((r) => tasteShare[r] < 0.03) : [],
    virya: {
      heating: norm(virya.heating, viryaSum),
      cooling: norm(virya.cooling, viryaSum),
      neutral: norm(virya.neutral, viryaSum),
    },
    doshaNet: { vata: norm(net.vata, covered), pitta: norm(net.pitta, covered), kapha: norm(net.kapha, covered) },
    aggravatingShare: { vata: norm(aggr.vata, covered), pitta: norm(aggr.pitta, covered), kapha: norm(aggr.kapha, covered) },
    primaryDoshas: doshasOf(primaryDosha),
    notes: [],
  };

  if (covered === 0) return summary;

  for (const d of summary.primaryDoshas) {
    if (summary.aggravatingShare[d] >= 0.35) {
      summary.notes.push(`${pct(summary.aggravatingShare[d])} of what you ate tends to aggravate ${label(d)}, your dominant dosha.`);
    }
  }
  if (summary.primaryDoshas.includes("pitta") && summary.virya.heating >= 0.5) {
    summary.notes.push(`Heating foods made up ${pct(summary.virya.heating)} of your intake; cooling foods help balance Pitta.`);
  }
  if ((summary.primaryDoshas.includes("vata") || summary.primaryDoshas.includes("kapha")) && summary.virya.cooling >= 0.5) {
    summary.notes.push(`Cooling foods made up ${pct(summary.virya.cooling)} of your intake; warming foods suit your constitution better.`);
  }
  if (summary.missingTastes.length) {
    summary.notes.push(`Missing or rare tastes: ${summary.missingTastes.join(", ")}. Ayurveda suggests all six tastes each day.`);
  }
  return summary;
}
