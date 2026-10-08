import { createHash } from "node:crypto";

/**
 * The two documents a member is asked to accept.
 *
 * They live here, in the repository, rather than in the database, for
 * one reason: a promise about privacy should change only when somebody
 * deliberately edits a file and commits it, with the change visible in
 * git for ever afterwards. A row in a table can be edited quietly.
 *
 * ── On the writing ───────────────────────────────────────────────
 *
 * Plain language is not decoration here. Most of what these documents
 * describe is uncomfortable — that a Key Member reads a member's
 * blood report, that food and lab values are sent to Anthropic, that
 * one person runs this and it may one day stop. A family cannot weigh
 * any of that if it is buried in hedged nouns, so the awkward parts
 * are near the top and said in the fewest words that are still true.
 *
 * There is no "we". There is one person, and there is you.
 *
 * ── On versions ──────────────────────────────────────────────────
 *
 * Each document carries a version, and `fingerprint()` hashes the text
 * itself. Consent is recorded against BOTH. Change a word and the
 * fingerprint changes, so nobody is ever counted as having agreed to
 * something they never read. Bump `version` when the change is one a
 * member should be asked about again; the fingerprint catches the rest
 * whether or not anyone remembered to.
 */

/** A run of paragraphs under an optional heading. `**bold**` is honoured. */
export type Section = { heading?: string; body: string[] };

export type Doc = {
  slug: "privacy" | "terms";
  title: string;
  lede?: string;
  version: string;
  sections: Section[];
};

export const PRIVACY: Doc = {
  slug: "privacy",
  title: "What My Kutumbh knows about you",
  lede:
    "In short: your food, your body, and your lab reports. Nothing is sold, nothing is " +
    "advertised, and nobody outside your family reads it.",
  version: "2026-10-05",
  sections: [
    {
      heading: "What you give it",
      body: [
        "Your name, date of birth, height and weight, and any conditions, allergies and " +
          "medicines you choose to enter. What you eat, when you log it. Medical reports you " +
          "upload, and the values read from them. A photograph, if you want one — it is " +
          "optional, and you can change or remove it whenever you like.",
      ],
    },
    {
      heading: "Who can see it",
      body: [
        "**You** — all of it.",
        "**Your Key Member** — the person who keeps your Kutumbh sees the family's reports " +
          "and insights. You share a kitchen; advice about food only works if someone can see " +
          "the whole table.",
        "**Everyone in your Kutumbh** — the day's menu and what was cooked. Not your lab values.",
        "**The Admin** — how many households there are, when each last logged a meal, what the " +
          "app costs to run. **Never what you ate, uploaded, or asked.**",
        "**Nobody else.**",
      ],
    },
    {
      heading: "Where it lives",
      body: [
        "On Supabase's servers in **Singapore**, not in India. Every table is locked so one " +
          "household cannot read another's. Uploaded files are private, opened only through a " +
          "link that expires in five minutes.",
        "**Your uploaded reports and photographs never leave Supabase.** A copy of the app's " +
          "records — not the files themselves — is kept each night on the Admin's own computer, " +
          "so a family could be brought back if Supabase failed.",
      ],
    },
    {
      heading: "What leaves, and why",
      body: [
        "When you ask the Coach a question or open Insights, what you have eaten and the values " +
          "from your report are sent to **Anthropic** to be read by Claude. They are not used to " +
          "train it. Nothing is sent unless you open those pages.",
      ],
    },
    {
      heading: "What you can do, any day",
      body: [
        "**Take my data** — everything held about you, as a file.",
        "**Forget me** — your account, your logs, your reports and your photograph, deleted. " +
          "Not hidden. Deleted.",
      ],
    },
    {
      heading: "Children",
      body: [
        "A Key Member who adds someone under eighteen confirms they are that child's parent " +
          "or guardian, and agrees to this on the child's behalf.",
      ],
    },
    {
      heading: "If something here is wrong",
      body: ["Write to iyer.mike@gmail.com. It is one person, and it is read."],
    },
  ],
};

export const TERMS: Doc = {
  slug: "terms",
  title: "Using My Kutumbh",
  version: "2026-10-05",
  sections: [
    {
      heading: "This is not medical advice",
      body: [
        "My Kutumbh reads lab reports and suggests food. It is not a doctor, it does not " +
          "diagnose, and it cannot know what your doctor knows. Nothing here should change your " +
          "medicine or a doctor's instruction. Where it matters the app says *Ask Your Doctor* " +
          "— please do.",
      ],
    },
    {
      heading: "Nutrition numbers are estimates",
      body: [
        "Values come from food tables and from Claude's reading of a dish's name. A katori is " +
          "not a measurement. Treat every number as near enough, never exact.",
      ],
    },
    {
      heading: "The app is invited, not open",
      body: [
        "You are here because someone let you in. The Admin may decline a registration or " +
          "remove an account; a Key Member may remove someone from their Kutumbh.",
      ],
    },
    {
      heading: "Your Kutumbh is shared",
      body: [
        "What you log, your family sees. Your Key Member sees your reports. Enter nothing you " +
          "would not say at your own table.",
      ],
    },
    {
      heading: "What is expected of you",
      body: [
        "Enter your own information honestly, and another person's only if they are yours to " +
          "enter — a child you are guardian of. Don't upload anyone else's medical report. " +
          "Don't try to reach another household's data.",
      ],
    },
    {
      heading: "It is free, and it is small",
      body: [
        "One person runs it; there is no company behind it. It may be slow, it may be wrong, " +
          "and one day it may stop. If it is going to stop, you will be told, and *Take my " +
          "data* will work until the day it does.",
      ],
    },
    {
      heading: "If you don't agree with this",
      body: ["Don't accept it — nothing is kept, and *Forget me* works regardless."],
    },
  ],
};

export const DOCS = [PRIVACY, TERMS] as const;

/**
 * A short hash of the document's exact words.
 *
 * Headings and paragraphs only — not the title or the version — so the
 * fingerprint answers one question: did the text somebody agreed to say
 * what today's text says? Twelve hex characters is plenty; this proves
 * a change happened, it does not guard against anyone forging one.
 */
export function fingerprint(doc: Doc): string {
  const canonical = doc.sections
    .map((s) => [s.heading ?? "", ...s.body].join("\n"))
    .join("\n\n");
  return createHash("sha256").update(canonical, "utf8").digest("hex").slice(0, 12);
}

/** What a member must have agreed to before the app opens. */
export function requiredConsents(): { doc: string; version: string; hash: string }[] {
  return DOCS.map((d) => ({ doc: d.slug, version: d.version, hash: fingerprint(d) }));
}
