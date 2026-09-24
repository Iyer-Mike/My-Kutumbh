"use client";

import { useRouter } from "next/navigation";
import { BRAND as B } from "@/lib/brand";
import { dayLabel, daysAgoLocal, daysAheadLocal, daysFromToday, longDateFor, todayLocal } from "@/lib/dates";
import { useFamilyTimeZone } from "@/lib/family-time";

/**
 * ‹ day › for a page that works on one day at a time. Today is the default
 * and one tap away; the arrows stop at what the page allows.
 */
export default function DayNav({ date, back, ahead, path, onDark = false }: {
  date: string; back: number; ahead: number; path: string; onDark?: boolean;
}) {
  const router = useRouter();
  const tz = useFamilyTimeZone();
  const off = daysFromToday(date, tz);
  const isToday = off === 0;

  const go = (d: string) => router.push(d === todayLocal(tz) ? path : `${path}?date=${d}`);
  const step = (n: number) => {
    const target = off + n;
    go(target >= 0 ? daysAheadLocal(target, tz) : daysAgoLocal(-target, tz));
  };

  const canBack = off > -back;
  const canAhead = off < ahead;

  const fg = onDark ? "#FFFFFF" : B.ink;
  const chip = onDark
    ? { background: "rgba(255,255,255,0.14)", color: "#FFFFFF" }
    : { background: B.tint, color: B.violet };

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => step(-1)} disabled={!canBack} aria-label="Day before"
        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold disabled:opacity-30"
        style={chip}>
        ‹
      </button>

      <div className="flex-1 min-w-0 text-center">
        <p className="m-0 text-sm font-semibold truncate" style={{ color: fg }}>{dayLabel(date, tz)}</p>
        <p className="m-0 text-[11px] truncate" style={{ color: onDark ? "rgba(255,255,255,0.6)" : B.muted2 }}>
          {longDateFor(date)}
        </p>
      </div>

      <button onClick={() => step(1)} disabled={!canAhead} aria-label="Day after"
        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold disabled:opacity-30"
        style={chip}>
        ›
      </button>

      {!isToday && (
        <button onClick={() => go(todayLocal(tz))}
          className="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
          style={chip}>
          Today
        </button>
      )}
    </div>
  );
}
