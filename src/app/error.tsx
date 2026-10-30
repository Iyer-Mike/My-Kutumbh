"use client";

import Link from "next/link";

/** Something broke on a page: say so kindly, and offer a way on. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex-1 min-h-screen flex items-center justify-center px-5 py-10" style={{ background: "#F3EEFA" }}>
      <div className="w-full text-center rounded-3xl px-6 py-8" style={{ maxWidth: 380, background: "#fff", border: "2px solid #CBB4EE" }}>
        <p className="m-0 text-3xl" aria-hidden>🌿</p>
        <h1 className="mt-2 mb-1 text-xl" style={{ fontFamily: "var(--font-dm-serif)", color: "#241C33" }}>Something went wrong</h1>
        <p className="m-0 text-sm" style={{ color: "#4A4360", lineHeight: 1.55 }}>
          Your food diary is safe. Please try again — if it keeps happening, go back to Home.
        </p>
        <div className="mt-5 grid gap-2">
          <button onClick={reset} className="py-3 rounded-xl text-sm font-semibold text-white" style={{ background: "#241238" }}>Try again</button>
          <Link href="/dashboard" className="py-3 rounded-xl text-sm font-semibold" style={{ border: "1.5px solid #6B46B8", color: "#6B46B8" }}>Go to Home</Link>
        </div>
      </div>
    </main>
  );
}
