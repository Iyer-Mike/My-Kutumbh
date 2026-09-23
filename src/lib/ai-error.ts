import Anthropic from "@anthropic-ai/sdk";

/**
 * A plain sentence for anything the AI service throws, so a family sees
 * what to do rather than a status code. Out-of-credit is called out by
 * name: it is the one cause the Prime Member can actually fix.
 */
export function aiErrorMessage(error: unknown, what: string): { message: string; status: number } {
  if (error instanceof Anthropic.RateLimitError) {
    return { message: `${what} is busy just now. Try again in a minute.`, status: 429 };
  }
  if (error instanceof Anthropic.APIError) {
    const raw = String(error.message ?? "");
    if (/credit balance is too low|billing|quota/i.test(raw)) {
      return {
        message: "The app's AI credit has run out. Top up the Anthropic account and this will work again.",
        status: 402,
      };
    }
    if (error.status === 401 || error.status === 403) {
      return { message: "The app's AI key was refused. Check the key on the server.", status: 502 };
    }
    return { message: `${what} couldn't answer (error ${error.status}). Please try again.`, status: 502 };
  }
  return { message: `Couldn't reach ${what}. Check your connection and try again.`, status: 502 };
}
