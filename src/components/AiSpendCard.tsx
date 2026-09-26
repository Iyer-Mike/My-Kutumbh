import { MONTH_FAMILY_PAISE, DAY_PERSON_PAISE } from "@/lib/ai-budget";

const rupees = (paise: number) =>
  paise >= 100 ? `₹${Math.round(paise / 100)}` : paise > 0 ? `₹${(paise / 100).toFixed(2)}` : "₹0";

/**
 * What the family's thinking has cost this month, and what is left.
 * Shown plainly, before anyone is ever refused.
 */
export default function AiSpendCard({ familyPaise, myPaise }: { familyPaise: number; myPaise: number }) {
  const used = Math.min(100, Math.round((familyPaise / MONTH_FAMILY_PAISE) * 100));
  const spent = familyPaise >= MONTH_FAMILY_PAISE;

  return (
    <section className="rounded-2xl px-4 py-4" style={{ background: "#FAF7FE", border: "1px solid #E0D4F2" }}>
      <p className="text-xs font-semibold uppercase tracking-widest m-0" style={{ color: "#6A6180" }}>
        AI this month
      </p>

      <p className="text-sm mt-2 mb-2" style={{ color: "#241C33" }}>
        <span className="font-semibold">{rupees(familyPaise)}</span>
        <span style={{ color: "#6A6180" }}> of {rupees(MONTH_FAMILY_PAISE)} — the whole Kutumbh</span>
      </p>

      <div className="h-2 rounded-full overflow-hidden" style={{ background: "#E7DCF7" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(used, familyPaise > 0 ? 2 : 0)}%`, background: spent ? "#B0453A" : "#6B46B8" }}
        />
      </div>

      <p className="text-[11px] mt-3 mb-0" style={{ color: "#6A6180" }}>
        {spent
          ? "The month's allowance is used. The coach and the photograph readers will be back next month; everything else works as usual."
          : `You've used ${rupees(myPaise)} of your ${rupees(DAY_PERSON_PAISE)} for today. This covers the coach, reading bills and plates, and working out a dish — nothing else in the app costs anything.`}
      </p>
    </section>
  );
}
