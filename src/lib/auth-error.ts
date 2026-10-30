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

/** The sentence to show for an auth error: plain for a dropped connection, otherwise the server's own. */
export function authErrorText(error: { message?: string; name?: string }): string {
  return isNetworkError(error) ? NETWORK_MESSAGE : (error.message ?? "Something went wrong. Please try again.");
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
