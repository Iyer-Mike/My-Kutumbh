"use client";

import { BRAND as B, FAMILY, look, fieldLook } from "@/lib/brand";
import { CATEGORIES, UNITS, type Unit } from "@/lib/pantry";
import { HOUSEHOLD, billCheck } from "@/lib/spend";
import Legend from "@/components/Legend";

/** One line of a bill while it is being checked: text so it can be edited freely. */
export type DraftLine = {
  key: string; name: string; quantity: string; unit: Unit | "";
  category: string; price: string; is_food: boolean;
};
export type BillDraft = { shop: string; date: string; total: string; lines: DraftLine[] };

const num = (s: string): number | null => {
  const n = parseFloat(s);
  return s.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
};
export const parseDraftNumber = num;

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/**
 * The reader's first draft, in the Key Member's hands. Every name, amount and
 * price can be corrected; only what is approved here is recorded.
 */
export default function BillCheck({ draft, onChange, onContinue, onCancel }: {
  draft: BillDraft; onChange: (d: BillDraft) => void; onContinue: () => void; onCancel: () => void;
}) {
  const set = (key: string, c: Partial<DraftLine>) =>
    onChange({ ...draft, lines: draft.lines.map((l) => (l.key === key ? { ...l, ...c } : l)) });
  const chk = billCheck(draft.lines.map((l) => num(l.price)), num(draft.total));
  const tone = chk.diff == null ? FAMILY.violet : chk.ok ? FAMILY.green : FAMILY.gold;
  const usable = draft.lines.filter((l) => l.name.trim()).length;

  return (
    <div className="grid gap-3">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider m-0" style={{ color: B.violet }}>Check what was read</h2>
        <p className="text-xs m-0" style={{ color: B.muted2 }}>
          The reader can misread a bill. Correct any name, amount or price. Only what you approve here is recorded.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-xs font-medium col-span-2" style={{ color: B.muted }}>Shop
          <input value={draft.shop} onChange={(e) => onChange({ ...draft, shop: e.target.value })} maxLength={60}
            className="rounded-xl px-3 py-2 text-sm" style={fieldLook(FAMILY.violet)} />
        </label>
        <label className="grid gap-1 text-xs font-medium" style={{ color: B.muted }}>Bill date
          <input type="date" value={draft.date} onChange={(e) => onChange({ ...draft, date: e.target.value })}
            className="rounded-xl px-3 py-2 text-sm" style={fieldLook(FAMILY.violet)} />
        </label>
        <label className="grid gap-1 text-xs font-medium" style={{ color: B.muted }}>Bill total (₹)
          <input type="number" inputMode="decimal" min="0" step="any" value={draft.total}
            onChange={(e) => onChange({ ...draft, total: e.target.value })}
            className="rounded-xl px-3 py-2 text-sm" style={fieldLook(FAMILY.violet)} />
        </label>
      </div>

      <div className="grid gap-2">
        {draft.lines.map((l) => (
          <div key={l.key} className="rounded-xl px-3 py-2 grid gap-1.5"
            style={{ background: l.is_food ? FAMILY.blue.bg : FAMILY.amber.bg, border: `2px solid ${l.is_food ? FAMILY.blue.edge : FAMILY.amber.edge}` }}>
            <div className="flex items-center gap-2">
              <input value={l.name} onChange={(e) => set(l.key, { name: e.target.value })} maxLength={60}
                aria-label="Item name" placeholder="Item"
                className="flex-1 min-w-0 rounded-lg px-2 py-1.5 text-sm" style={fieldLook(l.is_food ? FAMILY.blue : FAMILY.amber)} />
              <button onClick={() => onChange({ ...draft, lines: draft.lines.filter((x) => x.key !== l.key) })}
                aria-label={`Remove ${l.name || "this line"}`} className="w-8 h-8 shrink-0 rounded-full text-sm font-bold"
                style={{ background: "#fff", color: FAMILY.red.ink, border: `2px solid ${FAMILY.red.edge}` }}>✕</button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <input type="number" inputMode="decimal" min="0" step="any" value={l.quantity}
                onChange={(e) => set(l.key, { quantity: e.target.value })} aria-label="Quantity" placeholder="Qty"
                className="w-16 rounded-lg px-2 py-1.5 text-sm" style={fieldLook(FAMILY.blue)} />
              <select value={l.unit} onChange={(e) => set(l.key, { unit: e.target.value as Unit | "" })} aria-label="Unit"
                className="rounded-lg px-1.5 py-1.5 text-sm" style={fieldLook(FAMILY.blue)}>
                <option value="">unit</option>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <span className="text-sm" style={{ color: B.muted }}>₹</span>
              <input type="number" inputMode="decimal" min="0" step="any" value={l.price}
                onChange={(e) => set(l.key, { price: e.target.value })} aria-label="Price" placeholder="Price"
                className="w-20 rounded-lg px-2 py-1.5 text-sm" style={fieldLook(FAMILY.blue)} />
              <select value={l.is_food ? l.category : HOUSEHOLD} aria-label="Kind"
                onChange={(e) => e.target.value === HOUSEHOLD
                  ? set(l.key, { is_food: false, category: HOUSEHOLD })
                  : set(l.key, { is_food: true, category: e.target.value })}
                className="rounded-lg px-1.5 py-1.5 text-xs min-w-0" style={fieldLook(FAMILY.blue)}>
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                <option value={HOUSEHOLD}>Household (not food)</option>
              </select>
            </div>
          </div>
        ))}
        <button onClick={() => onChange({ ...draft, lines: [...draft.lines, { key: `n${Date.now()}`, name: "", quantity: "", unit: "", category: "other", price: "", is_food: true }] })}
          className="text-sm font-semibold text-left" style={{ color: B.violetLink }}>＋ Add a line the reader missed</button>
        <Legend title="Lines" entries={[
          { colour: FAMILY.blue.bg, edge: FAMILY.blue.edge, label: "Food: can go on the shelf" },
          { colour: FAMILY.amber.bg, edge: FAMILY.amber.edge, label: "Household: spending only" },
        ]} />
      </div>

      <div className="rounded-xl px-3 py-2 text-sm" style={look(tone)}>
        <p className="m-0 font-semibold" style={{ color: tone.ink }}>
          Lines add up to {inr(chk.sum)}{num(draft.total) != null ? ` · bill total ${inr(num(draft.total)!)}` : " · no total entered"}
        </p>
        {chk.diff != null && !chk.ok && (
          <p className="m-0 text-xs" style={{ color: tone.ink }}>
            {inr(Math.abs(chk.diff))} {chk.diff > 0 ? "short of" : "over"} the total: a line may be misread, missing or have a wrong price. Check it against the bill.
          </p>
        )}
        {chk.missing > 0 && <p className="m-0 text-xs" style={{ color: tone.ink }}>{chk.missing} line{chk.missing > 1 ? "s have" : " has"} no price yet.</p>}
        <Legend title="Check" entries={[
          { colour: FAMILY.green.bg, edge: FAMILY.green.edge, label: "Matches the total" },
          { colour: FAMILY.gold.bg, edge: FAMILY.gold.edge, label: "Doesn't match: look again" },
          { colour: FAMILY.violet.bg, edge: FAMILY.violet.edge, label: "No total to compare" },
        ]} />
      </div>

      <div className="flex gap-2">
        <button onClick={onContinue} disabled={usable === 0}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: B.button }}>
          Looks right: continue
        </button>
        <button onClick={onCancel} className="px-4 text-sm font-semibold" style={{ color: B.muted }}>Cancel</button>
      </div>
    </div>
  );
}
