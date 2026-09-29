import Link from "next/link";
import LegalDoc from "@/components/LegalDoc";
import { TERMS } from "@/lib/legal";

export const metadata = { title: "Using My Kutumbh" };

/**
 * Readable without signing in — on purpose.
 *
 * What you are agreeing to should be readable before you agree, not
 * only after. This page says the app is not a doctor, which is the
 * sentence somebody is most likely to want to check first.
 */
export default function TermsPage() {
  return (
    <div className="min-h-screen px-5 py-10" style={{ background: "#F3EEFA" }}>
      <div className="mx-auto" style={{ maxWidth: 560 }}>
        <div
          className="rounded-3xl px-6 py-7"
          style={{ background: "#fff", border: "1px solid #E0D4F2", boxShadow: "0 10px 40px rgba(36,18,56,0.08)" }}
        >
          <p className="m-0 mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: "#6A6180" }}>
            My Kutumbh
          </p>
          <LegalDoc doc={TERMS} />
        </div>

        <p className="text-center mt-5 mb-0 text-sm" style={{ color: "#6A6180" }}>
          <Link href="/privacy" className="font-semibold" style={{ color: "#6B46B8" }}>What My Kutumbh knows about you</Link>
          <span className="mx-2">·</span>
          <Link href="/login" className="font-semibold" style={{ color: "#6B46B8" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
