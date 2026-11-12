import Link from "next/link";
import { BRAND as B } from "@/lib/brand";

/**
 * Says, in one short card, whose profile the menu is planned around, so no one
 * has to guess. The Key Member plans it; each person's own Good Range still
 * comes from their own profile.
 */
export default function MenuBasis({ keyName, isKey, details, profileDone }: {
  keyName: string | null; isKey: boolean; details: string[]; profileDone: boolean;
}) {
  return (
    <section className="rounded-2xl px-4 py-3 mb-4 grid gap-1" style={{ background: "#fff", border: `1.5px solid ${B.violet}` }} aria-label="How this menu is planned">
      <p className="m-0 text-xs font-bold uppercase tracking-wide" style={{ color: B.violet }}>How this menu is planned</p>
      <p className="m-0 text-sm" style={{ color: B.ink }}>
        {isKey
          ? "You plan it, around your own profile"
          : <>Planned by {keyName ?? "the Key Member"}, around their profile</>}
        {details.length > 0 && <> · {details.join(" · ")}</>}.
      </p>
      <p className="m-0 text-xs" style={{ color: B.muted }}>
        {isKey
          ? "Each member's Good Range comes from their own profile, so ask everyone to complete theirs."
          : "Your Good Range and Intake % come from your own profile."}
        {!profileDone && (
          <> <Link href="/profile" className="font-semibold underline" style={{ color: B.violet }}>Complete your profile</Link></>
        )}
      </p>
    </section>
  );
}
