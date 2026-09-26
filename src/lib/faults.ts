import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Writing down what broke.
 *
 * Two rules. It never throws — a logger that fails must not turn a
 * handled error into a crash. And it never records what a family
 * typed, ate, uploaded or asked: a fault log is exactly where private
 * things pile up unnoticed, so only the machine's own words go in.
 */

/** Anything that looks like a person's own words is not ours to keep. */
function safeMessage(raw: unknown): string {
  const text = String(
    raw instanceof Error ? raw.message : typeof raw === "string" ? raw : JSON.stringify(raw ?? "unknown"),
  );
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "<an email>")   // never a real address
    .replace(/\b\d{6,}\b/g, "<a number>")                 // nor anything that long and numeric
    .slice(0, 400);
}

export async function logFault(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  fault: { where: string; error: unknown; status?: number; kutumbhId?: string | null; userId?: string | null },
): Promise<void> {
  try {
    await supabase.from("app_faults").insert({
      where_at:   fault.where.slice(0, 80),
      message:    safeMessage(fault.error),
      status:     fault.status ?? null,
      kutumbh_id: fault.kutumbhId ?? null,
      user_id:    fault.userId ?? null,
    });
  } catch {
    // Deliberately silent. See above.
  }
}
