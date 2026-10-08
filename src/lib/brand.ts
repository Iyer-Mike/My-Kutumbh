// Violet & gold — the way in (landing, sign in, invite).
// The rest of the app still wears forest green; it moves over in one pass.
export const BRAND = {
  headerGradient: "linear-gradient(160deg, #241238 0%, #3A2260 68%, #4E3080 100%)",
  violetDeep: "#241238",
  violetMid: "#3A2260",
  violet: "#4B2D7A",
  violetLink: "#6B46B8",
  button: "#34205A",
  gold: "#F2B531",
  goldInk: "#8A5A06",      // gold that stays readable on a light ground
  goldTint: "#FBEBCB",
  page: "#F3EEFA",
  card: "#FAF7FE",
  cardEdge: "#E0D4F2",
  field: "#F0EAFA",
  tint: "#E7DCF7",
  ink: "#241C33",
  ink2: "#3D3550",
  muted: "#625A75",
  muted2: "#6A6180",
  onDark: "#CFC0E8",
  onDarkFaint: "#C9B8E4",
} as const;

/** Boxes with a light fill wear a coloured edge. One family per meaning, so the same kind of box looks the same everywhere. */
export type Family = { bg: string; edge: string; ink: string; line: string };
export const FAMILY = {
  blue:   { bg: "#E8F2FD", edge: "#2E64A0", ink: "#1D4A7C", line: "rgba(46,100,160,0.25)" },   // lists and rows
  amber:  { bg: "#FFE9C7", edge: "#C2551F", ink: "#9A3F10", line: "rgba(194,85,31,0.28)" },    // summaries and forms
  green:  { bg: "#E6F6EA", edge: "#2E8B57", ink: "#1F6B40", line: "rgba(46,139,87,0.28)" },    // good or finished
  violet: { bg: "#EDE4F8", edge: "#6B46B8", ink: "#4B2D7A", line: "rgba(107,70,184,0.28)" },   // neutral info and settings
  gold:   { bg: "#FFF6D6", edge: "#C99A06", ink: "#7A5A06", line: "rgba(201,154,6,0.30)" },    // waiting or needs a look
  red:    { bg: "#FDECEA", edge: "#B42318", ink: "#8A1C12", line: "rgba(180,35,24,0.28)" },     // warnings and removal
} as const satisfies Record<string, Family>;

/** The box itself: light fill, 2.5px coloured edge. */
export const look = (f: Family) => ({ background: f.bg, border: `2.5px solid ${f.edge}` }) as const;
/** A text box or chip inside a family: white, 2px edge. */
export const fieldLook = (f: Family) => ({ background: "#fff", border: `2px solid ${f.edge}`, color: "#241C33", outline: "none" }) as const;
