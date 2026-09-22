// Shared types for the Insights engine. Engine modules import only types
// from each other so each stays a pure, independently testable unit.

export type NutrientKey =
  | "kcal" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g"
  | "iron_mg" | "calcium_mg" | "vitamin_b12_mcg" | "vitamin_c_mg"
  | "folate_mcg" | "sodium_mg" | "potassium_mg";

export type Nutrients = Record<NutrientKey, number>;

/** Food data per 100 g, as stored in food_items. */
export type FoodData = {
  name: string;
  category: string | null;
  serving_unit: string | null;
  serving_weight_g: number | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  iron_mg: number | null;
  calcium_mg: number | null;
  vitamin_b12_mcg: number | null;
  vitamin_c_mg: number | null;
  folate_mcg: number | null;
  sodium_mg: number | null;
  potassium_mg: number | null;
  rasa: string[] | null;
  virya: string | null;
  vata_effect: string | null;
  pitta_effect: string | null;
  kapha_effect: string | null;
  ingredients?: string | null;
};

/** One logged item, with the food it links to (if any). */
export type LogEntry = {
  logged_date: string;          // YYYY-MM-DD, India time
  meal_slot: string;
  food_name: string;
  quantity_g: number;           // quantity in quantity_unit
  quantity_unit: string | null;
  calories: number | null;      // as saved at log time
  protein_g: number | null;
  nutrition_estimated: boolean | null;
  food: FoodData | null;
};

export type Profile = {
  date_of_birth: string | null;
  gender: string | null;        // male | female | other
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: string | null;
  daily_kcal_goal: number | null;
  primary_dosha: string | null;
  diet_type: string | null;
  allergies: string[] | null;
  conditions: string[] | null;
  medications?: string[] | null;
};

/** A personalised finding from the Intelligence layer (Blueprint: "AI Correction Event"). */
export type CorrectionEvent = {
  id: string;                               // stable key, e.g. "med-metformin-b12"
  severity: "alert" | "watch" | "tip";
  category: "medicine" | "allergy" | "condition" | "pattern";
  title: string;
  detail: string;
  action: string;
  evidence: string[];                        // the facts it was based on
};

export type Target = { value: number; kind: "goal" | "limit"; source: string };
export type Needs = Record<NutrientKey, Target>;

export type IntakeSummary = {
  days: number;                 // days in the period
  loggedDays: number;           // days with at least one log
  items: number;
  perDay: Nutrients;            // average per LOGGED day
  daily: { date: string; kcal: number }[];
  /** Share (0–1) of logged kcal whose micronutrients are known. */
  microCoverage: number;
  estimatedShare: number;       // share of kcal that is an estimate
};

export type LabReading = {
  key: string;
  label: string;
  unit: string;
  value: number;
  status: "low" | "high";
  range: string;
};

/** One finding: related out-of-range readings grouped under shared advice. */
export type LabFlag = {
  key: string;                  // group key, e.g. "lipids"
  label: string;                // group title, e.g. "Cholesterol & blood fats"
  readings: LabReading[];
  known: boolean;               // false = no dietary rule; shown as "other values"
  meaning: string;
  favour: string[];             // advice lines
  limit: string[];
  nutrient: NutrientKey | null; // intake nutrient this finding relates to
  favourFoods: string[];        // concrete foods from the catalogue / family dishes
  intakeNote: string | null;    // correlation with what was actually eaten
};
