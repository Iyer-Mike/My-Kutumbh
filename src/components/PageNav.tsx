"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PageNav() {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2 mb-3">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
        style={{ background: "rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.9)" }}
      >
        ← Back
      </button>
      <Link
        href="/dashboard"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
        style={{ background: "rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.9)" }}
      >
        ⌂ Home
      </Link>
    </div>
  );
}
