/**
 * What a newcomer is told once the Admin has decided: one wording, used by
 * the Admin's own email or WhatsApp and by the app's email when it can send one.
 */
export function decisionLetter(o: {
  name: string | null; admit: boolean; note: string | null; appUrl: string; signature: string | null;
}): { subject: string; text: string } {
  const url = o.appUrl.replace(/\/+$/, "");
  const note = o.note?.trim() || null;
  const lines = o.admit
    ? [
        `Dear ${o.name?.trim() || "friend"},`,
        "",
        "Your registration with My Kutumb Bhojan has been approved. Welcome!",
        "",
        note,
        note ? "" : null,
        "To begin:",
        `  1. Open ${url}/login and sign in with the email and password you registered with.`,
        "  2. Name your Kutumbh (your family).",
        "  3. Fill in your profile, then invite your family members.",
        "",
        `— ${o.signature?.trim() || "My Kutumb Bhojan"}`,
      ]
    : [
        `Dear ${o.name?.trim() || "friend"},`,
        "",
        "Thank you for registering with My Kutumb Bhojan. Your registration was not approved this time.",
        "",
        note,
        note ? "" : null,
        `— ${o.signature?.trim() || "My Kutumb Bhojan"}`,
      ];
  return {
    subject: o.admit ? "Welcome to My Kutumb Bhojan: your registration is approved" : "About your My Kutumb Bhojan registration",
    text: lines.filter((l): l is string => l !== null).join("\n"),
  };
}
