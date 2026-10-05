import { MONTH_FAMILY_RUPEES, DAY_PERSON_RUPEES } from "@/lib/ai-budget";

/** Whole rupees, always. Anything under one rupee is said in words. */
const rupees = (amount: number) =>
  amount >= 1 ? `₹${Math.round(amount).toLocaleString("en-IN")}` : amount > 0 ? "under ₹1" : "₹0";

/**
 * What the family's thinking has cost this month, and what is left.
 * Shown plainly, before anyone is ever refused.
 */
export default function AiSpendCard({ familyRupees, myRupees }: { familyRupees: number; myRupees: number }) {
  const used = Math.min(100, Math.round((familyRupees / MONTH_FAMILY_RUPEES) * 100));
  const spent = familyRupees >= MONTH_FAMILY_RUPEES;

  return (
    <section className="rounded-2xl px-4 py-4" style={{ background: "#FAF7FE", border: "1px solid #E0D4F2" }}>
      <p className="text-xs font-semibold uppercase tracking-widest m-0" style={{ color: "#6A6180" }}>
        AI this month
      </p>

      <p className="text-sm mt-2 mb-2" style={{ color: "#241C33" }}>
        <span className="font-semibold">{rupees(familyRupees)}</span>
        <span style={{ color: "#6A6180" }}> of {rupees(MONTH_FAMILY_RUPEES)} · whole Kutumbh</span>
      </p>

      <div className="h-2 rounded-full overflow-hidden" style={{ background: "#E7DCF7" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(used, familyRupees > 0 ? 2 : 0)}%`, background: spent ? "#B0453A" : "#6B46B8" }}
        />
      </div>

      <p className="text-[11px] mt-3 mb-0" style={{ color: "#6A6180" }}>
        {spent
          ? "Month's AI used up · Returns next month · All else works."
          : `Today: ${rupees(myRupees)} of ${rupees(DAY_PERSON_RUPEES)} · AI only`}
      </p>
    </section>
  );
}
