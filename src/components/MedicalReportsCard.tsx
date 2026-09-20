"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// ── Lab value display metadata ───────────────────────────
const LAB_META: Record<string, { label: string; unit: string }> = {
  hemoglobin:            { label: "Hemoglobin",         unit: "g/dL"  },
  hba1c:                 { label: "HbA1c",               unit: "%"     },
  fasting_glucose:       { label: "Fasting Glucose",     unit: "mg/dL" },
  postprandial_glucose:  { label: "PP Glucose",          unit: "mg/dL" },
  total_cholesterol:     { label: "Total Cholesterol",   unit: "mg/dL" },
  ldl:                   { label: "LDL",                 unit: "mg/dL" },
  hdl:                   { label: "HDL",                 unit: "mg/dL" },
  triglycerides:         { label: "Triglycerides",       unit: "mg/dL" },
  iron:                  { label: "Iron",                unit: "μg/dL" },
  ferritin:              { label: "Ferritin",            unit: "ng/mL" },
  vitamin_b12:           { label: "Vitamin B12",         unit: "pg/mL" },
  vitamin_d:             { label: "Vitamin D",           unit: "ng/mL" },
  tsh:                   { label: "TSH",                 unit: "mIU/L" },
  t3:                    { label: "T3",                  unit: "ng/dL" },
  t4:                    { label: "T4",                  unit: "μg/dL" },
  creatinine:            { label: "Creatinine",          unit: "mg/dL" },
  urea:                  { label: "Urea",                unit: "mg/dL" },
  uric_acid:             { label: "Uric Acid",           unit: "mg/dL" },
  alt:                   { label: "ALT",                 unit: "U/L"   },
  ast:                   { label: "AST",                 unit: "U/L"   },
  alkaline_phosphatase:  { label: "ALP",                 unit: "U/L"   },
  bilirubin_total:       { label: "Bilirubin Total",     unit: "mg/dL" },
  wbc:                   { label: "WBC",                 unit: "×10³/μL"},
  rbc:                   { label: "RBC",                 unit: "×10⁶/μL"},
  platelets:             { label: "Platelets",           unit: "×10³/μL"},
  sodium:                { label: "Sodium",              unit: "mEq/L" },
  potassium:             { label: "Potassium",           unit: "mEq/L" },
  calcium:               { label: "Calcium",             unit: "mg/dL" },
};

const REPORT_TYPE_LABEL: Record<string, string> = {
  blood_test:   "Blood Test",
  lipid_panel:  "Lipid Panel",
  thyroid:      "Thyroid Panel",
  kidney:       "Kidney Function",
  liver:        "Liver Function",
  cbc:          "CBC",
  diabetes:     "Diabetes Panel",
  other:        "Report",
};

type MedRecord = {
  id: string;
  report_date: string | null;
  report_type: string | null;
  file_name: string | null;
  file_url: string | null;
  extracted_values: Record<string, unknown> | null;
  notes: string | null;
};

type Props = {
  userId: string;
  initialRecords: MedRecord[];
};

export default function MedicalReportsCard({ userId, initialRecords }: Props) {
  const supabase = createClient();
  const fileRef  = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [records, setRecords]       = useState<MedRecord[]>(initialRecords);
  const [uploading, setUploading]   = useState(false);
  const [parsing, setParsing]       = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New report draft state
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [draftType, setDraftType]     = useState("other");
  const [draftDate, setDraftDate]     = useState("");
  const [draftNotes, setDraftNotes]   = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving, setSaving]           = useState(false);

  function resetDraft() {
    setDraftValues({}); setDraftType("other"); setDraftDate("");
    setDraftNotes(""); setPendingFile(null); setShowForm(false);
  }

  async function handleFile(file: File) {
    setPendingFile(file);
    setShowForm(true);
    setParsing(true);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/parse-medical-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64: base64, mediaType: file.type || "image/jpeg" }),
      });

      if (res.ok) {
        const data = await res.json();
        setDraftType(data.report_type ?? "other");
        setDraftDate(data.report_date ?? "");
        // Convert extracted values to string for editing
        const vals: Record<string, string> = {};
        for (const [k, v] of Object.entries(data.extracted_values ?? {})) {
          if (typeof v === "number" || typeof v === "string") {
            vals[k] = String(v);
          }
        }
        setDraftValues(vals);
      }
    } catch {
      // Silent — user can fill manually
    } finally {
      setParsing(false);
    }
  }

  async function saveRecord() {
    if (!userId) return;
    setSaving(true);

    let fileUrl: string | null = null;
    let fileName: string | null = null;

    if (pendingFile) {
      setUploading(true);
      const ext  = pendingFile.name.split(".").pop() ?? "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("medical-reports")
        .upload(path, pendingFile, { contentType: pendingFile.type });
      if (!upErr) {
        const { data: urlData } = supabase.storage
          .from("medical-reports")
          .getPublicUrl(path);
        fileUrl  = urlData.publicUrl;
        fileName = pendingFile.name;
      }
      setUploading(false);
    }

    // Build extracted_values: only numeric keys (not _ref keys for now)
    const extracted: Record<string, number | string> = {};
    for (const [k, v] of Object.entries(draftValues)) {
      if (v.trim() !== "") extracted[k] = isNaN(Number(v)) ? v : Number(v);
    }

    const { data, error } = await supabase
      .from("medical_records")
      .insert({
        user_id:          userId,
        report_date:      draftDate || null,
        report_type:      draftType,
        file_url:         fileUrl,
        file_name:        fileName,
        extracted_values: extracted,
        notes:            draftNotes || null,
      })
      .select("*")
      .single();

    setSaving(false);
    if (!error && data) {
      setRecords(prev => [data as MedRecord, ...prev]);
      setExpandedId(data.id);
      resetDraft();
    }
  }

  // Get displayable lab keys (skip _ref keys)
  function getLabKeys(vals: Record<string, unknown>) {
    return Object.keys(vals).filter(k => !k.endsWith("_ref") && k !== "report_type" && k !== "report_date");
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid #E2E1D8" }}>

      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8A9085" }}>
            Medical Reports
          </p>
          {records.length > 0 && (
            <p className="text-xs mt-0.5" style={{ color: "#8A9085" }}>
              {records.length} report{records.length > 1 ? "s" : ""} on file
            </p>
          )}
        </div>
        {!showForm && (
          <div className="flex items-center gap-2">
            <input ref={cameraRef} type="file" accept="image/*" capture="environment"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} className="hidden" />
            <input ref={fileRef} type="file" accept="image/*,application/pdf"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} className="hidden" />
            <button
              onClick={() => cameraRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: "#EAF2E8", color: "#4A7C44" }}>
              📷 Scan
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: "#EAF2E8", color: "#4A7C44" }}>
              📄 Upload
            </button>
          </div>
        )}
      </div>

      {/* Upload / Parse form */}
      {showForm && (
        <div className="px-5 pb-5 space-y-4" style={{ borderTop: "1px solid #F0EFE8" }}>

          {/* Parsing indicator */}
          {parsing && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl mt-4"
              style={{ background: "#EAF2E8", border: "1px solid #C5DFC2" }}>
              <span className="text-base animate-spin" style={{ display: "inline-block" }}>🔄</span>
              <span className="text-sm font-medium" style={{ color: "#4A7C44" }}>Reading your report…</span>
            </div>
          )}

          {!parsing && (
            <>
              {/* File name */}
              {pendingFile && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl mt-4"
                  style={{ background: "#F0EFE8" }}>
                  <span className="text-sm">📄</span>
                  <span className="text-xs truncate flex-1" style={{ color: "#5A6055" }}>{pendingFile.name}</span>
                  <button onClick={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = ""; if (cameraRef.current) cameraRef.current.value = ""; }}
                    className="text-xs" style={{ color: "#8A9085" }}>✕</button>
                </div>
              )}

              {/* Report type + date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs" style={{ color: "#8A9085" }}>Report type</label>
                  <select value={draftType} onChange={e => setDraftType(e.target.value)}
                    className="w-full mt-1 rounded-xl px-3 py-2 text-sm"
                    style={{ border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none" }}>
                    {Object.entries(REPORT_TYPE_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs" style={{ color: "#8A9085" }}>Report date</label>
                  <input type="date" value={draftDate} onChange={e => setDraftDate(e.target.value)}
                    className="w-full mt-1 rounded-xl px-3 py-2 text-sm"
                    style={{ border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none" }} />
                </div>
              </div>

              {/* Extracted values — editable */}
              {Object.keys(draftValues).filter(k => !k.endsWith("_ref")).length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: "#4A7C44" }}>
                    ✨ Extracted values — verify &amp; edit
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(draftValues)
                      .filter(k => !k.endsWith("_ref"))
                      .map(k => {
                        const meta = LAB_META[k];
                        const refKey = `${k}_ref`;
                        return (
                          <div key={k} className="rounded-xl px-3 py-2.5"
                            style={{ background: "#F0F7EF", border: "1px solid #D5EBD2" }}>
                            <p className="text-xs font-medium mb-1" style={{ color: "#4A7C44" }}>
                              {meta?.label ?? k.replace(/_/g, " ")}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={draftValues[k] ?? ""}
                                onChange={e => setDraftValues(p => ({ ...p, [k]: e.target.value }))}
                                className="flex-1 min-w-0 text-sm font-semibold rounded-lg px-2 py-1"
                                style={{ border: "1.5px solid #C5DFC2", background: "#fff", color: "#1C201C", outline: "none" }}
                              />
                              {meta?.unit && (
                                <span className="text-xs shrink-0" style={{ color: "#8A9085" }}>{meta.unit}</span>
                              )}
                            </div>
                            {draftValues[refKey] && (
                              <p className="text-xs mt-1" style={{ color: "#8A9085" }}>
                                Ref: {draftValues[refKey]}
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-xs" style={{ color: "#8A9085" }}>Notes (optional)</label>
                <input type="text" value={draftNotes} onChange={e => setDraftNotes(e.target.value)}
                  placeholder="e.g. Fasting sample · Dr Sharma's lab"
                  className="w-full mt-1 rounded-xl px-3 py-2 text-sm"
                  style={{ border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none" }} />
              </div>

              {/* Save / Later */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={saveRecord}
                  disabled={saving || uploading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: "#1C2B1C" }}>
                  {uploading ? "Uploading…" : saving ? "Saving…" : "Save Report ✓"}
                </button>
                <button
                  onClick={resetDraft}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "#F0EFE8", color: "#5A6055" }}>
                  Later…
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Past reports list */}
      {records.length === 0 && !showForm && (
        <div className="px-5 pb-5">
          <p className="text-sm text-center py-6" style={{ color: "#8A9085" }}>
            No reports uploaded yet.<br />
            <span style={{ fontSize: "11px" }}>Upload a lab report to track your health values over time.</span>
          </p>
        </div>
      )}

      {records.map((rec, idx) => {
        const isExpanded = expandedId === rec.id;
        const typeLabel  = REPORT_TYPE_LABEL[rec.report_type ?? "other"] ?? "Report";
        const labKeys    = rec.extracted_values ? getLabKeys(rec.extracted_values) : [];
        const keyVals    = labKeys.slice(0, isExpanded ? labKeys.length : 4);

        return (
          <div key={rec.id}
            style={{ borderTop: idx === 0 && !showForm ? "1px solid #F0EFE8" : "1px solid #F0EFE8" }}>
            {/* Report header row */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : rec.id)}
              className="w-full flex items-center gap-3 px-5 py-3 text-left"
              style={{ background: isExpanded ? "#F0F7EF" : "#fff" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ background: "#EAF2E8" }}>🧪</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "#1C201C" }}>{typeLabel}</p>
                <p className="text-xs" style={{ color: "#8A9085" }}>
                  {rec.report_date
                    ? new Date(rec.report_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                    : "Date not recorded"}
                  {rec.notes ? ` · ${rec.notes}` : ""}
                </p>
              </div>
              <span className="text-xs shrink-0" style={{ color: "#4A7C44" }}>
                {isExpanded ? "▲ Less" : "▼ More"}
              </span>
            </button>

            {/* Key values preview / full view */}
            {labKeys.length > 0 && (
              <div className="px-5 pb-3"
                style={{ background: isExpanded ? "#F0F7EF" : "#FAFAF8" }}>
                <div className="grid grid-cols-2 gap-2">
                  {keyVals.map(k => {
                    const meta   = LAB_META[k];
                    const refKey = `${k}_ref`;
                    const val    = rec.extracted_values![k];
                    return (
                      <div key={k} className="rounded-xl px-3 py-2"
                        style={{ background: "#fff", border: "1px solid #E2E1D8" }}>
                        <p className="text-xs" style={{ color: "#8A9085" }}>
                          {meta?.label ?? k.replace(/_/g, " ")}
                        </p>
                        <p className="text-sm font-semibold mt-0.5" style={{ color: "#1C201C" }}>
                          {String(val)}{meta?.unit ? ` ${meta.unit}` : ""}
                        </p>
                        {!!rec.extracted_values![refKey] && (
                          <p className="text-xs" style={{ color: "#8A9085" }}>
                            Ref: {String(rec.extracted_values![refKey])}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!isExpanded && labKeys.length > 4 && (
                  <button onClick={() => setExpandedId(rec.id)}
                    className="text-xs mt-2" style={{ color: "#4A7C44" }}>
                    +{labKeys.length - 4} more values ▼
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
