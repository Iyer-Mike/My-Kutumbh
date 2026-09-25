// Who last signed in on THIS phone. Email and first name only — never a
// password — so the box is already filled when they come back.
//
// Storage can throw or come back empty (private window, cleared data), so
// every read and write is guarded and the page works without it.

const LAST_USER = "mk-last-user-v1";

export type LastUser = { email: string; name: string | null };

const listeners = new Set<() => void>();
let cached: string | null = null;

export function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function getSnapshot(): string | null {
  try {
    const raw = localStorage.getItem(LAST_USER);
    if (raw !== cached) cached = raw;
  } catch {
    cached = null;
  }
  return cached;
}

export function writeLastUser(value: LastUser | null) {
  const raw = value ? JSON.stringify(value) : null;
  try {
    if (raw) localStorage.setItem(LAST_USER, raw);
    else localStorage.removeItem(LAST_USER);
  } catch { /* private window — the page still works */ }
  cached = raw;
  listeners.forEach((l) => l());
}

export function parseLastUser(raw: string | null): LastUser | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as LastUser;
    return v && typeof v.email === "string" && v.email ? v : null;
  } catch {
    return null;
  }
}
