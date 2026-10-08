// Reading languages. English is always there; the family adds the others
// one at a time, in the order its members can write and check them.
export const LANGS = [
  { code: "hi", name: "Hindi",   native: "हिन्दी" },
  { code: "ta", name: "Tamil",   native: "தமிழ்" },
  { code: "mr", name: "Marathi", native: "मराठी" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
] as const;

export type LangCode = (typeof LANGS)[number]["code"];

export const isLang = (x: unknown): x is LangCode => LANGS.some((l) => l.code === x);
export const langOf = (code: string | null | undefined) => LANGS.find((l) => l.code === code) ?? null;
