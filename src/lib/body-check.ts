// Sanity checks for height and weight, so a slipped digit is caught before it is saved.
// Returns a plain sentence for the first problem found, or null when all is well.

export function ageOn(dob: string, today = new Date()): number | null {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let a = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) a--;
  return a;
}

export function bodyProblem(input: {
  heightCm: number | null | undefined;
  weightKg: number | null | undefined;
  dob?: string | null;
}, today = new Date()): string | null {
  const { heightCm: h, weightKg: w } = input;
  const age = input.dob ? ageOn(input.dob, today) : null;
  if (h != null && (Number.isNaN(h) || h < 50 || h > 250))
    return "Height looks off. Please enter it in centimetres, for example 165.";
  if (w != null && (Number.isNaN(w) || w < 3 || w > 300))
    return "Weight looks off. Please enter it in kilograms, for example 62.";
  if (h != null && age != null && age >= 18 && h < 120)
    return "That height looks too short for an adult. Please check it is in centimetres.";
  if (h != null && age != null && age >= 18 && h < 135 && w != null && w >= 50)
    return "Height and weight don't seem to go together. Please check both.";
  if (h != null && w != null) {
    const bmi = w / ((h / 100) ** 2);
    if (bmi < 10 || bmi > 70) return "Height and weight don't seem to go together. Please check both.";
  }
  return null;
}
