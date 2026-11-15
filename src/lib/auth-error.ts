/**
 * "Failed to fetch" is the browser's own wording for "the request never got an
 * answer": no connection, a VPN or blocker in the way, a dropped signal. It says
 * nothing about the password or the account, so it should not be shown as if it did.
 */
export const NETWORK_MESSAGE =
  "Can't reach the server right now. Check your internet connection, then try again.";

export function isNetworkError(error: { message?: string; name?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    error.name === "AuthRetryableFetchError" ||
    /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(error.message ?? "")
  );
}

/**
 * An email address as typed on a phone: stray spaces, capitals, a slip of the thumb.
 * Returns the cleaned address and, when it cannot be right, a sentence saying exactly why.
 */
const DOMAIN_SLIPS: Record<string, string> = {
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gmal.com": "gmail.com", "gamil.com": "gmail.com",
  "gmail.co": "gmail.com", "gmail.con": "gmail.com", "gmail.cm": "gmail.com", "gmail.om": "gmail.com", "gnail.com": "gmail.com",
  "yaho.com": "yahoo.com", "yahoo.con": "yahoo.com", "yahooo.com": "yahoo.com", "yahoo.co": "yahoo.com",
  "hotmial.com": "hotmail.com", "hotmail.con": "hotmail.com", "hotmai.com": "hotmail.com",
  "outlok.com": "outlook.com", "outlook.con": "outlook.com", "rediffmail.con": "rediffmail.com", "redifmail.com": "rediffmail.com",
};

export function checkEmail(raw: string): { email: string; problem: string | null } {
  const email = raw.trim().toLowerCase();
  if (!email) return { email, problem: "Please type your email address." };
  if (/\s/.test(email)) return { email, problem: "The email address has a space in it. Please remove the space." };
  const at = email.split("@");
  if (at.length < 2) return { email, problem: "The email address needs an @, as in name@gmail.com." };
  if (at.length > 2) return { email, problem: "The email address has more than one @. Please check it." };
  const [name, domain] = at;
  if (!name) return { email, problem: "Something is missing before the @ in the email address." };
  if (!domain) return { email, problem: "Something is missing after the @, such as gmail.com." };
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) {
    return { email, problem: `The part after the @ ("${domain}") is not complete. It should look like gmail.com.` };
  }
  if (/[,;:<>()[\]\\"]/.test(email)) return { email, problem: "The email address has a character that is not allowed, such as a comma. Please check it." };
  const fix = DOMAIN_SLIPS[domain];
  if (fix) return { email, problem: `Did you mean ${name}@${fix}? "${domain}" looks like a typing slip.` };
  return { email, problem: null };
}

/**
 * The sentence to show for an auth error: what went wrong and what to do next,
 * in plain words. The server's own wording is kept only when nothing better is known.
 */
export function authErrorText(error: { message?: string; name?: string; code?: string; status?: number }): string {
  if (isNetworkError(error)) return NETWORK_MESSAGE;
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  const has = (...words: string[]) => words.some((w) => msg.includes(w));

  if (code === "email_address_invalid" || (has("email") && has("invalid", "not valid")))
    return "That email address was not accepted. Please check the spelling, especially the part after the @ (for example gmail.com), or try another address.";
  if (code === "user_already_exists" || code === "email_exists" || has("already registered", "already been registered"))
    return "This email already has an account. Tap Sign in below, or use Forgot password if you don't remember it.";
  if (code === "invalid_credentials" || has("invalid login"))
    return "Incorrect email or password. Please check both and try again.";
  if (code === "email_not_confirmed" || has("not confirmed"))
    return "Please confirm your email first. Check your inbox for a confirmation link.";
  if (code === "weak_password" || has("password should", "weak password"))
    return "That password is too easy to guess. Use at least 8 characters, with both letters and digits.";
  if (code === "same_password" || has("different from the old"))
    return "That is your present password. Please choose a new one.";
  if (code.includes("rate_limit") || error.status === 429 || has("rate limit", "too many", "for security purposes"))
    return "Too many attempts in a short time. Please wait a few minutes, then try again.";
  if (code === "email_address_not_authorized" || has("not authorized"))
    return "We can't send email to that address just now. Please write to the person who invited you.";
  if (code === "signup_disabled" || has("signups not allowed", "signup is disabled"))
    return "New registrations are closed at the moment. Please write to the person who invited you.";
  if (code === "user_banned" || has("banned"))
    return "This account has been blocked. Please write to the person who invited you.";
  if (error.status && error.status >= 500)
    return "The server had a problem. Nothing is wrong on your side. Please try again in a minute.";

  return error.message
    ? `It didn't go through: ${error.message}. Please try again, or write to the person who invited you.`
    : "Something went wrong. Please try again.";
}

/**
 * Tries a request, and once more after a moment if the connection itself failed.
 * A wrong password or a taken email is an answer, not a failure, and is never retried.
 */
export async function withOneRetry<T extends { error: { message?: string; name?: string } | null }>(
  run: () => Promise<T>,
): Promise<T> {
  const first = await run();
  if (!isNetworkError(first.error)) return first;
  await new Promise((r) => setTimeout(r, 1500));
  return run();
}
