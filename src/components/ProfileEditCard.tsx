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
};

const ACTIVITY_OPTIONS = [
  { value: "sedentary",        label: "Sedentary (desk job, little exercise)" },
  { value: "lightly_active",   label: "Lightly active (light exercise 1–3 days)" },
  { value: "moderately_active",label: "Moderately active (exercise 3–5 days)" },
  { value: "very_active",      label: "Very active (hard exercise 6–7 days)" },
  { value: "extra_active",     label: "Extra active (very hard exercise / physical job)" },
];

export default function ProfileEditCard(props: Props) {
  const router   = useRouter();
  const supabase = createClient();

  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);

  const [fullName,      setFullName]      = useState(props.fullName      ?? "");
  const [heightCm,      setHeightCm]      = useState(String(props.heightCm      ?? ""));
  const [weightKg,      setWeightKg]      = useState(String(props.weightKg      ?? ""));
  const [activityLevel, setActivityLevel] = useState(props.activityLevel ?? "");
  const [gender,        setGender]        = useState(props.gender        ?? "");
  const [dateOfBirth,   setDateOfBirth]   = useState(props.dateOfBirth   ?? "");

  function cancel() {
    setFullName(props.fullName ?? "");
    setHeightCm(String(props.heightCm ?? ""));
    setWeightKg(String(props.weightKg ?? ""));
    setActivityLevel(props.activityLevel ?? "");
    setGender(props.gender ?? "");
    setDateOfBirth(props.dateOfBirth ?? "");
    setEditing(false);
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name:      fullName.trim() || null,
        height_cm:      heightCm  ? parseFloat(heightCm)  : null,
        weight_kg:      weightKg  ? parseFloat(weightKg)  : null,
        activity_level: activityLevel || null,
        gender:         gender    || null,
        date_of_birth:  dateOfBirth || null,
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

  return (
    <div
      className="rounded-2xl px-5 py-4"
      style={{ background: "#fff", border: "1px solid #E2E1D8" }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8A9085" }}>
          Health Basics
        </p>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold"
            style={{ background: "#EAF2E8", color: "#4A7C44" }}
          >
            <svg width="11" height="11" viewBox="0 0 13 13" fill="none">
              <path d="M9 1.5L11.5 4L4.5 11H2v-2.5L9 1.5Z" stroke="#4A7C44" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M7.5 3L10 5.5" stroke="#4A7C44" strokeWidth="1.5"/>
            </svg>
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          {/* Name */}
          <div>
            <label className="text-xs" style={{ color: "#8A9085" }}>Full name</label>
            <input
              type="text" value={fullName} onChange={e => setFullName(e.target.value)}
              className="w-full mt-1 rounded-xl px-3 py-2 text-sm"
              style={{ border: "1.5px solid #4A7C44", background: "#fff", color: "#1C201C", outline: "none" }}
            />
          </div>

          {/* Gender */}
          <div>
            <label className="text-xs" style={{ color: "#8A9085" }}>Gender</label>
            <select
              value={gender} onChange={e => setGender(e.target.value)}
              className="w-full mt-1 rounded-xl px-3 py-2 text-sm"
              style={{ border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none" }}
            >
              <option value="">— select —</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* DOB */}
          <div>
            <label className="text-xs" style={{ color: "#8A9085" }}>Date of birth</label>
            <input
              type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)}
              className="w-full mt-1 rounded-xl px-3 py-2 text-sm"
              style={{ border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none" }}
            />
          </div>

          {/* Height + Weight side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs" style={{ color: "#8A9085" }}>Height (cm)</label>
              <input
                type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)}
                className="w-full mt-1 rounded-xl px-3 py-2 text-sm"
                style={{ border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none" }}
              />
            </div>
            <div>
              <label className="text-xs" style={{ color: "#8A9085" }}>Weight (kg)</label>
              <input
                type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)}
                className="w-full mt-1 rounded-xl px-3 py-2 text-sm"
                style={{ border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none" }}
              />
            </div>
          </div>

          {/* Activity level */}
          <div>
            <label className="text-xs" style={{ color: "#8A9085" }}>Activity level</label>
            <select
              value={activityLevel} onChange={e => setActivityLevel(e.target.value)}
              className="w-full mt-1 rounded-xl px-3 py-2 text-sm"
              style={{ border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none" }}
            >
              <option value="">— select —</option>
              {ACTIVITY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Save / Cancel */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={save} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: "#1C2B1C" }}
            >
              {saving ? "Saving…" : "Save ✓"}
            </button>
            <button
              onClick={cancel}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "#F0EFE8", color: "#5A6055" }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Age",    value: props.dateOfBirth ? `${age(props.dateOfBirth)} yrs` : "—" },
            { label: "Gender", value: props.gender ? props.gender.charAt(0).toUpperCase() + props.gender.slice(1) : "—" },
            { label: "Height", value: props.heightCm ? `${props.heightCm} cm` : "—" },
            { label: "Weight", value: props.weightKg ? `${props.weightKg} kg` : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl px-3 py-3" style={{ background: "#F3F2EB" }}>
              <p className="text-xs" style={{ color: "#8A9085" }}>{label}</p>
              <p className="text-base font-semibold mt-0.5" style={{ color: "#1C201C" }}>{value}</p>
            </div>
          ))}
          {props.activityLevel && (
            <div className="col-span-2 rounded-xl px-3 py-3" style={{ background: "#F3F2EB" }}>
              <p className="text-xs" style={{ color: "#8A9085" }}>Activity level</p>
              <p className="text-sm font-medium mt-0.5 capitalize" style={{ color: "#1C201C" }}>
                {props.activityLevel.replace(/_/g, " ")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
