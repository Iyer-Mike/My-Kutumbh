import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex-1 min-h-screen flex items-center justify-center px-5 py-10" style={{ background: "#F3EEFA" }}>
      <div className="w-full text-center rounded-3xl px-6 py-8" style={{ maxWidth: 380, background: "#fff", border: "2px solid #CBB4EE" }}>
        <p className="m-0 text-3xl" aria-hidden>🔍</p>
        <h1 className="mt-2 mb-1 text-xl" style={{ fontFamily: "var(--font-dm-serif)", color: "#241C33" }}>Page not found</h1>
        <p className="m-0 text-sm" style={{ color: "#4A4360", lineHeight: 1.55 }}>
          That page isn&apos;t here. It may have moved, or the link is old.
        </p>
        <Link href="/dashboard" className="mt-5 block py-3 rounded-xl text-sm font-semibold text-white" style={{ background: "#241238" }}>Go to Home</Link>
      </div>
    </main>
  );
}
