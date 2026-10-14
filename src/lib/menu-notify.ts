/**
 * Tell the family the menu changed. Fire and forget: the menu is already saved,
 * so a failed alert must never get in the way. Only the Key Member's changes
 * are recorded (the server checks), and a burst of edits makes one phone alert.
 */
export function announceMenu(kutumbhId: string | null, date: string, lines: string[]) {
  if (!kutumbhId || !lines.length) return;
  fetch("/api/menu-notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kutumbhId, date, lines }),
    keepalive: true,
  }).catch(() => {});
}
