/** Shown while a page loads, so a slow connection never shows a blank screen. */
export default function Loading() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-live="polite">
      <div className="text-center">
        <p className="m-0 text-3xl animate-pulse" aria-hidden>🌿</p>
        <p className="m-0 mt-2 text-sm" style={{ color: "#6A6180" }}>One moment…</p>
      </div>
    </div>
  );
}
