// An invite has to survive a trip through the email app: someone taps the
// link, signs up, confirms by email, and only then comes back. The code is
// kept on their phone in the meantime so the family isn't lost on the way.
const KEY = "mk-pending-invite-v1";

export function rememberInvite(code: string) {
  try { localStorage.setItem(KEY, code.trim().toUpperCase()); } catch { /* private window */ }
}

export function pendingInvite(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && /^[A-Z0-9-]{4,20}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

export function forgetInvite() {
  try { localStorage.removeItem(KEY); } catch { /* private window */ }
}

/** The invite code inside a path like /join/ABC123, if that's what it is. */
export function inviteFromPath(path: string | null | undefined): string | null {
  const m = (path ?? "").match(/^\/join\/([A-Za-z0-9-]{4,20})/);
  return m ? m[1].toUpperCase() : null;
}
