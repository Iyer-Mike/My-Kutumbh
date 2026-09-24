// Where does this person go next?
//
// The rules live here, in one place, because they used to live in seven and
// an invited member fell through the gap between two of them.
//
//   Not signed in, asking for a public page  → let them through
//   Not signed in, asking for anything else  → sign in, and come back here
//   Signed in, at sign-in or sign-up         → their day (the dashboard)
//   Signed in, invite waiting on this phone  → the invite, before anything else
//   Just confirmed an email, invite waiting   → the invite
//   Just confirmed an email, no invite        → wherever they were headed
//
// "Public" means a page that must work with no account at all: the landing
// page, the sign-in pages, the password ones, an invite link, and the auth
// callbacks the email links come back to.

const PUBLIC_PREFIXES = ["/login", "/signup", "/forgot-password", "/reset-password", "/join/", "/auth/"];

export const HOME = "/dashboard";
export const START = "/onboarding";

export function isPublicPath(pathname: string): boolean {
  return pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export function isAuthPath(pathname: string): boolean {
  return pathname.startsWith("/login") || pathname.startsWith("/signup");
}

/** Onboarding is its own case: a signed-in newcomer belongs there. */
export function isStartPath(pathname: string): boolean {
  return pathname.startsWith(START);
}

/** Only our own paths are worth returning to — never another site. */
export function safeRedirect(target: string | null | undefined, fallback = HOME): string {
  if (!target) return fallback;
  if (!target.startsWith("/") || target.startsWith("//")) return fallback;
  if (isAuthPath(target) || target === "/") return fallback;
  return target;
}

/** Sign in, and come back to the page they actually asked for. */
export function signInHref(pathname: string, search = ""): string {
  const wanted = `${pathname}${search}`;
  if (isPublicPath(pathname)) return "/login";
  return `/login?redirect=${encodeURIComponent(wanted)}`;
}

/** After signing in or confirming an email: an invite always comes first. */
export function afterSignIn(redirect: string | null | undefined, invite: string | null | undefined): string {
  if (invite) return `/join/${invite}`;
  return safeRedirect(redirect);
}

/** Where a confirmation email should return to. */
export function emailReturnTo(origin: string, next: string | null | undefined): string {
  return `${origin}/auth/callback?next=${encodeURIComponent(safeRedirect(next, START))}`;
}
