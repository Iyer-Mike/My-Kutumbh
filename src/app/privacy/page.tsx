import Link from "next/link";
import LegalDoc from "@/components/LegalDoc";
import { PRIVACY } from "@/lib/legal";

export const metadata = { title: "What My Kutumbh knows about you" };

/**
 * Readable without signing in — on purpose.
 *
 * Somebody deciding whether to register should be able to find out
 * what the app would hold about them BEFORE handing any of it over.
 * A privacy notice you can only reach from inside is an odd promise.
 */
export default function PrivacyPage() {
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
          <LegalDoc doc={PRIVACY} />
        </div>

        <p className="text-center mt-5 mb-0 text-sm" style={{ color: "#6A6180" }}>
          <Link href="/terms" className="font-semibold" style={{ color: "#6B46B8" }}>Using My Kutumbh</Link>
          <span className="mx-2">·</span>
          <Link href="/login" className="font-semibold" style={{ color: "#6B46B8" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
