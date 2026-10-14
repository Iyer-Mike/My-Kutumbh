"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BRAND as B } from "@/lib/brand";

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
      {/* The app's name, on every page that has this bar; short form on very narrow phones */}
      <span className="ml-auto min-w-0 whitespace-nowrap text-[15px] leading-none"
        style={{ color: B.gold, fontFamily: "var(--font-dm-serif)", letterSpacing: "0.02em" }}>
        <span className="hidden min-[360px]:inline">My Kutumb Bhojan</span>
        <span className="min-[360px]:hidden">Kutumb Bhojan</span>
      </span>
    </div>
  );
}
