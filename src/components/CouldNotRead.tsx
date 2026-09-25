import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import KutumbhLogo from "@/components/KutumbhLogo";
import { BRAND as B } from "@/lib/brand";

/**
 * Shown when the page is signed in but the database would not answer — most
 * often a key that has just been changed elsewhere. It says so, instead of
 * treating the person as somebody new.
 */
export default function CouldNotRead() {
  return (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ background: B.page }}>
      <div className="w-full max-w-sm rounded-2xl px-5 py-7 text-center grid gap-4"
        style={{ background: B.card, border: `1px solid ${B.cardEdge}` }}>
        <div className="flex justify-center"><KutumbhLogo size={40} color={B.violet} /></div>
        <div className="grid gap-1.5">
          <h1 className="m-0 text-lg" style={{ fontFamily: "var(--font-dm-serif)", color: B.ink }}>
            We couldn&apos;t reach your Kutumbh
          </h1>
          <p className="m-0 text-sm" style={{ color: B.muted }}>
            Your sign-in may have ended — that happens after a password change.
            Try once more, and if it still won&apos;t open, sign in again.
          </p>
        </div>
        <Link href="/dashboard"
          className="w-full py-3 rounded-xl text-sm font-semibold text-white"
          style={{ background: B.button }}>
          Try again
        </Link>
        <SignOutButton />
      </div>
    </div>
  );
}
