/**
 * The one letter the app sends.
 *
 * My Kutumbh deliberately sends almost nothing: there is no verified
 * sending domain, so Resend will only deliver to the account owner's
 * own address. Anything written to a family member would be accepted
 * by the API and then quietly dropped — worse than not writing at all.
 *
 * So exactly one address is reachable, and it belongs to the Admin.
 * That is enough for the thing that actually needs saying: somebody is
 * waiting at the door and cannot get in until you look.
 *
 * Nothing here ever throws. A post office that falls over must not
 * take a page down with it.
 */

const ENDPOINT = "https://api.resend.com/emails";

/** Who can be written to, and who it comes from. */
export const ADMIN_EMAIL = process.env.MY_KUTUMBH_ADMIN_EMAIL ?? "iyer.mike@gmail.com";
const FROM = process.env.MY_KUTUMBH_MAIL_FROM ?? "My Kutumbh <onboarding@resend.dev>";

/** No key, no post. Checked before anything is claimed or marked done. */
export function canSendMail(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export type Sent = { ok: boolean; why?: string };

/**
 * One email, plain text with a plain HTML twin.
 *
 * Ten seconds and no retry: this is called while somebody waits for a
 * page, and a slow mail server is not their problem. If it fails the
 * caller gives its claim back and the next page load tries again.
 */
async function send(to: string, subject: string, text: string, html: string): Promise<Sent> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, why: "no_key" };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, text, html }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });

    if (!res.ok) return { ok: false, why: `resend_${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, why: e instanceof Error ? e.name.toLowerCase() : "send_failed" };
  }
}

/** Escape for the HTML twin — a name is somebody's own text, not markup. */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Somebody registered with a passcode and is now behind the door.
 *
 * Written the way one person tells another, and it says what to do:
 * open the desk and either welcome them or decline. The name and the
 * address are in it because the Admin has to recognise them to decide
 * — this is the one letter where that is the whole point.
 */
export async function tellAdminSomebodyWaits(
  who: { name: string | null; email: string | null; invitedEmail?: string | null },
  appUrl: string,
): Promise<Sent> {
  const name = who.name?.trim() || "Someone with no name given";
  const email = who.email ?? "no address";
  const desk = `${appUrl.replace(/\/+$/, "")}/admin`;

  // Registered with an address other than the one you wrote to. Not
  // wrong in itself — people have several — but worth seeing.
  const odd =
    who.invitedEmail && who.invitedEmail.toLowerCase() !== (who.email ?? "").toLowerCase()
      ? `You wrote the passcode to ${who.invitedEmail}, and they registered as ${email}.`
      : null;

  const subject = `At the door: ${name}`;

  const lines = [
    `${name} has registered with My Kutumbh and is waiting to be let in.`,
    "",
    `    Name:  ${name}`,
    `    Email: ${email}`,
    "",
    odd,
    odd ? "" : null,
    "They cannot do anything yet — no family, no logging, nothing — until you approve them.",
    "",
    `Open the Admin Desk to welcome them in or decline:`,
    `    ${desk}`,
    "",
    "— My Kutumbh",
  ].filter((l): l is string => l !== null);

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#241C33;max-width:34rem">
  <p style="margin:0 0 1rem"><strong>${esc(name)}</strong> has registered with My Kutumbh and is waiting to be let in.</p>
  <table style="margin:0 0 1rem;border-collapse:collapse;font-size:14px">
    <tr><td style="padding:2px 12px 2px 0;color:#6A6180">Name</td><td>${esc(name)}</td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#6A6180">Email</td><td>${esc(email)}</td></tr>
  </table>
  ${odd ? `<p style="margin:0 0 1rem;color:#8A5A06">${esc(odd)}</p>` : ""}
  <p style="margin:0 0 1.25rem;color:#4A4360">They cannot do anything yet — no family, no logging, nothing — until you approve them.</p>
  <p style="margin:0 0 1.5rem"><a href="${esc(desk)}" style="background:#241238;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;display:inline-block;font-weight:600;font-size:14px">Open the Admin Desk</a></p>
  <p style="margin:0;color:#8A80A0;font-size:13px">— My Kutumbh</p>
</div>`;

  return send(ADMIN_EMAIL, subject, lines.join("\n"), html);
}
