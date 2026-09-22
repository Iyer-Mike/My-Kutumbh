"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Home",    icon: "⌂" },
  { href: "/log",       label: "Log",     icon: "✎" },
  { href: "/insights",  label: "Insights", icon: "◔" },
  { href: "/family",    label: "Kutumbh", icon: "⚇" },
  { href: "/profile",   label: "Profile", icon: "◉" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 bg-(--color-nav) border-t border-white/10"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 480,
      }}
    >
      <div className="flex">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs transition-colors ${
                active ? "text-(--color-sage-light)" : "text-white/50"
              }`}
            >
              <span className="text-lg leading-none">{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
