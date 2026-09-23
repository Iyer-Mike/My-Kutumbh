"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userId: string;
  fullName: string | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  dietType: string | null;
  conditions: string[];
  allergies: string[];
  medications: string[];
  dailyKcalGoal: number | null;
};

const ACTIVITY_OPTIONS = [
  // Must match profiles_activity_level_check (same values as onboarding)
  { value: "sedentary",   label: "Sedentary — desk work, little movement" },
  { value: "light",       label: "Light — walking, light housework" },
  { value: "moderate",    label: "Moderate — exercise 3–4× per week" },
  { value: "active",      label: "Active — exercise most days" },
  { value: "very_active", label: "Very Active — physical job or intense daily training" },
];

const DIET_OPTIONS = [
  { value: "vegetarian",     label: "Vegetarian" },
  { value: "vegan",          label: "Vegan" },
  { value: "non_vegetarian", label: "Non-Vegetarian" },
  { value: "eggetarian",     label: "Eggetarian" },
  { value: "jain",           label: "Jain" },
];

const COMMON_CONDITIONS = [
  "Diabetes",
  "Hypertension",
  "Thyroid",
  "PCOD / PCOS",
  "High Cholesterol",
  "Anaemia",
  "Obesity",
  "Kidney Disease",
  "Liver Disease",
  "Heart Disease",
  "Asthma",
  "Arthritis",
];

export default function ProfileEditCard(props: Props) {
  const router   = useRouter();
  const supabase = createClient();

  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);

  const [fullName,      setFullName]      = useState(props.fullName      ?? "");
  const [heightCm,      setHeightCm]      = useState(String(props.heightCm ?? ""));
  const [weightKg,      setWeightKg]      = useState(String(props.weightKg ?? ""));
  const [activityLevel, setActivityLevel] = useState(props.activityLevel ?? "");
  const [gender,        setGender]        = useState(props.gender        ?? "");
  const [dateOfBirth,   setDateOfBirth]   = useState(props.dateOfBirth   ?? "");
  const [dietType,       setDietType]      = useState(props.dietType      ?? "");
  const [conditions,     setConditions]    = useState<string[]>(props.conditions ?? []);
  const [allergiesText,  setAllergiesText] = useState((props.allergies ?? []).join(", "));
  const [medsText,       setMedsText]      = useState((props.medications ?? []).join(", "));
  const [dailyKcalGoal,  setDailyKcalGoal] = useState(String(props.dailyKcalGoal ?? ""));

  function toggleCondition(c: string) {
    setConditions(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  }

  function cancel() {
    setFullName(props.fullName ?? "");
    setHeightCm(String(props.heightCm ?? ""));
    setWeightKg(String(props.weightKg ?? ""));
    setActivityLevel(props.activityLevel ?? "");
    setGender(props.gender ?? "");
    setDateOfBirth(props.dateOfBirth ?? "");
    setDietType(props.dietType ?? "");
    setConditions(props.conditions ?? []);
    setAllergiesText((props.allergies ?? []).join(", "));
    setMedsText((props.medications ?? []).join(", "));
    setDailyKcalGoal(String(props.dailyKcalGoal ?? ""));
    setEditing(false);
  }

  async function save() {
    setSaving(true);
    const allergyArr = allergiesText
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    const medsArr = medsText
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name:      fullName.trim() || null,
        height_cm:      heightCm  ? parseFloat(heightCm)  : null,
        weight_kg:      weightKg  ? parseFloat(weightKg)  : null,
        activity_level: activityLevel || null,
        gender:         gender    || null,
        date_of_birth:  dateOfBirth || null,
        diet_type:       dietType  || null,
        conditions:      conditions,
        allergies:       allergyArr,
        medications:     medsArr,
        daily_kcal_goal: dailyKcalGoal ? parseInt(dailyKcalGoal) : null,
      })
      .eq("id", props.userId);

    setSaving(false);
    if (error) { alert(`Save failed: ${error.message}`); return; }
    setEditing(false);
    router.refresh();
  }

  function age(dob: string) {
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  }

  const dietLabel = DIET_OPTIONS.find(d => d.value === props.dietType)?.label;

  return (
    <div className="rounded-2xl px-5 py-4" style={{ background: "#FAF7FE", border: "1px solid #E0D4F2" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6A6180" }}>
          Health Basics
        </p>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold"
            style={{ background: "#E7DCF7", color: "#6B46B8" }}
          >
            <svg width="11" height="11" viewBox="0 0 13 13" fill="none">
              <path d="M9 1.5L11.5 4L4.5 11H2v-2.5L9 1.5Z" stroke="#6B46B8" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M7.5 3L10 5.5" stroke="#6B46B8" strokeWidth="1.5"/>
            </svg>
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          {/* Name */}
          <div>
            <label className="text-xs" style={{ color: "#6A6180" }}>Full name</label>
            <input
              type="text" value={fullName} onChange={e => setFullName(e.target.value)}
              className="w-full mt-1 rounded-xl px-3 py-2 text-sm"
              style={{ border: "1.5px solid #6B46B8", background: "#FAF7FE", color: "#241C33", outline: "none" }}
            />
          </div>

          {/* Gender */}
          <div>
            <label className="text-xs" style={{ color: "#6A6180" }}>Gender</label>
            <select
              value={gender} onChange={e => setGender(e.target.value)}
              className="w-full mt-1 rounded-xl px-3 py-2 text-sm"
              style={{ border: "1.5px solid #E0D4F2", background: "#FAF7FE", color: "#241C33", outline: "none" }}
            >
              <option value="">— select —</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* DOB */}
          <div>
            <label className="text-xs" style={{ color: "#6A6180" }}>Date of birth</label>
            <input
              type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)}
              className="w-full mt-1 rounded-xl px-3 py-2 text-sm"
              style={{ border: "1.5px solid #E0D4F2", background: "#FAF7FE", color: "#241C33", outline: "none" }}
            />
          </div>

          {/* Height + Weight */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs" style={{ color: "#6A6180" }}>Height (cm)</label>
              <input
                type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)}
                className="w-full mt-1 rounded-xl px-3 py-2 text-sm"
                style={{ border: "1.5px solid #E0D4F2", background: "#FAF7FE", color: "#241C33", outline: "none" }}
              />
            </div>
            <div>
              <label className="text-xs" style={{ color: "#6A6180" }}>Weight (kg)</label>
              <input
                type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)}
                className="w-full mt-1 rounded-xl px-3 py-2 text-sm"
                style={{ border: "1.5px solid #E0D4F2", background: "#FAF7FE", color: "#241C33", outline: "none" }}
              />
            </div>
          </div>

          {/* Activity level */}
          <div>
            <label className="text-xs" style={{ color: "#6A6180" }}>Activity level</label>
            <select
              value={activityLevel} onChange={e => setActivityLevel(e.target.value)}
              className="w-full mt-1 rounded-xl px-3 py-2 text-sm"
              style={{ border: "1.5px solid #E0D4F2", background: "#FAF7FE", color: "#241C33", outline: "none" }}
            >
              <option value="">— select —</option>
              {ACTIVITY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Diet type */}
          <div>
            <label className="text-xs" style={{ color: "#6A6180" }}>Diet type</label>
            <select
              value={dietType} onChange={e => setDietType(e.target.value)}
              className="w-full mt-1 rounded-xl px-3 py-2 text-sm"
              style={{ border: "1.5px solid #E0D4F2", background: "#FAF7FE", color: "#241C33", outline: "none" }}
            >
              <option value="">— select —</option>
              {DIET_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Conditions checklist */}
          <div>
            <label className="text-xs block mb-2" style={{ color: "#6A6180" }}>
              Health conditions <span style={{ color: "#A79BC0" }}>(select all that apply)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {COMMON_CONDITIONS.map(c => {
                const on = conditions.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCondition(c)}
                    className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                    style={{
                      background: on ? "#241238" : "#F0EAFA",
                      color: on ? "#fff" : "#625A75",
                      border: `1.5px solid ${on ? "#241238" : "#E0D4F2"}`,
                    }}
                  >
                    {on && "✓ "}{c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Allergies */}
          <div>
            <label className="text-xs" style={{ color: "#6A6180" }}>
              Allergies / intolerances{" "}
              <span style={{ color: "#A79BC0" }}>(comma-separated, e.g. peanuts, gluten)</span>
            </label>
            <input
              type="text"
              value={allergiesText}
              onChange={e => setAllergiesText(e.target.value)}
              placeholder="peanuts, shellfish, gluten…"
              className="w-full mt-1 rounded-xl px-3 py-2 text-sm"
              style={{ border: "1.5px solid #E0D4F2", background: "#FAF7FE", color: "#241C33", outline: "none" }}
            />
          </div>

          {/* Medications */}
          <div>
            <label htmlFor="medications" className="text-xs" style={{ color: "#6A6180" }}>
              Regular medications{" "}
              <span style={{ color: "#A79BC0" }}>(comma-separated, e.g. metformin, amlodipine)</span>
            </label>
            <input
              id="medications"
              type="text"
              value={medsText}
              onChange={e => setMedsText(e.target.value)}
              placeholder="metformin, thyroxine…"
              className="w-full mt-1 rounded-xl px-3 py-2 text-sm"
              style={{ border: "1.5px solid #E0D4F2", background: "#FAF7FE", color: "#241C33", outline: "none" }}
            />
            <p className="text-[11px] mt-1" style={{ color: "#A79BC0" }}>
              Used to spot food–medicine interactions in your insights. Shared only within your Kutumbh.
            </p>
          </div>

          {/* Daily kcal goal */}
          <div>
            <label className="text-xs" style={{ color: "#6A6180" }}>
              Daily calorie goal{" "}
              <span style={{ color: "#A79BC0" }}>(kcal — optional, enables dashboard progress bar)</span>
            </label>
            <input
              type="number"
              value={dailyKcalGoal}
              onChange={e => setDailyKcalGoal(e.target.value)}
              placeholder="e.g. 1800"
              min={500} max={5000}
              className="w-full mt-1 rounded-xl px-3 py-2 text-sm"
              style={{ border: "1.5px solid #E0D4F2", background: "#FAF7FE", color: "#241C33", outline: "none" }}
            />
          </div>

          {/* Save / Cancel */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={save} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: "#241238" }}
            >
              {saving ? "Saving…" : "Save ✓"}
            </button>
            <button
              onClick={cancel}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "#EDE7F7", color: "#625A75" }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Age",    value: props.dateOfBirth ? `${age(props.dateOfBirth)} yrs` : "—" },
              { label: "Gender", value: props.gender ? props.gender.charAt(0).toUpperCase() + props.gender.slice(1) : "—" },
              { label: "Height", value: props.heightCm ? `${props.heightCm} cm` : "—" },
              { label: "Weight", value: props.weightKg ? `${props.weightKg} kg` : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl px-3 py-3" style={{ background: "#F0EAFA" }}>
                <p className="text-xs" style={{ color: "#6A6180" }}>{label}</p>
                <p className="text-base font-semibold mt-0.5" style={{ color: "#241C33" }}>{value}</p>
              </div>
            ))}
          </div>

          {props.activityLevel && (
            <div className="rounded-xl px-3 py-3" style={{ background: "#F0EAFA" }}>
              <p className="text-xs" style={{ color: "#6A6180" }}>Activity level</p>
              <p className="text-sm font-medium mt-0.5 capitalize" style={{ color: "#241C33" }}>
                {props.activityLevel.replace(/_/g, " ")}
              </p>
            </div>
          )}

          {dietLabel && (
            <div className="rounded-xl px-3 py-3" style={{ background: "#F0EAFA" }}>
              <p className="text-xs" style={{ color: "#6A6180" }}>Diet type</p>
              <p className="text-sm font-medium mt-0.5" style={{ color: "#241C33" }}>{dietLabel}</p>
            </div>
          )}

          {props.conditions && props.conditions.length > 0 && (
            <div>
              <p className="text-xs mb-2" style={{ color: "#6A6180" }}>Health conditions</p>
              <div className="flex flex-wrap gap-1.5">
                {props.conditions.map(c => (
                  <span key={c} className="px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: "#241238", color: "#fff" }}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {props.allergies && props.allergies.length > 0 && (
            <div>
              <p className="text-xs mb-2" style={{ color: "#6A6180" }}>Allergies / intolerances</p>
              <div className="flex flex-wrap gap-1.5">
                {props.allergies.map(a => (
                  <span key={a} className="px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: "#FFF3E8", color: "#C85A00", border: "1px solid #FDD9B5" }}>
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {props.medications && props.medications.length > 0 && (
            <div>
              <p className="text-xs mb-2" style={{ color: "#6A6180" }}>Medications</p>
              <div className="flex flex-wrap gap-1.5">
                {props.medications.map(m => (
                  <span key={m} className="px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: "#EEF1FA", color: "#3E4F86", border: "1px solid #D3DAF0" }}>
                    💊 {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {props.dailyKcalGoal && (
            <div className="rounded-xl px-3 py-3" style={{ background: "#F0EAFA" }}>
              <p className="text-xs" style={{ color: "#6A6180" }}>Daily calorie goal</p>
              <p className="text-base font-semibold mt-0.5" style={{ color: "#241C33" }}>
                {props.dailyKcalGoal} kcal
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
