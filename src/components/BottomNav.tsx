"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Drawn icons rather than text symbols: they look the same on every phone.
const ICONS: Record<string, React.ReactNode> = {
  home:    <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5" />,
  log:     <path d="M12 5v14M5 12h14M4 4h16v16H4z" />,
  insight: <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />,
  family:  <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 11a2.5 2.5 0 1 0 0-5M17 14c2.5 0 4.5 2.3 4.5 5.5" />,
  profile: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" />,
};

// `also` keeps a tab lit on the pages that live under it.
const NAV = [
  { href: "/dashboard", label: "Home",     icon: "home",    also: ["/festivals"] },
  { href: "/log",       label: "Log",      icon: "log",     also: [] },
  { href: "/insights",  label: "Insights", icon: "insight", also: [] },
  { href: "/family",    label: "Kutumbh",  icon: "family",  also: ["/pantry", "/recipes"] },
  { href: "/profile",   label: "Profile",  icon: "profile", also: [] },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 bg-(--color-nav) border-t border-white/10"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        left: 0,
        right: 0,
        marginInline: "auto",
        maxWidth: 480,
      }}
    >
      <div className="flex">
        {NAV.map(({ href, label, icon, also }) => {
          const active = [href, ...also].some((h) => pathname.startsWith(h));
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs transition-colors ${
                active ? "text-(--color-sage-light)" : "text-white/60"
              }`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ICONS[icon]}
              </svg>
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
