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

const BUCKET = "medical-reports";

// Vercel rejects request bodies over 4.5 MB, and base64 adds a third, so
// PDFs are capped here and photos are shrunk before being sent to be read.
const MAX_PDF_BYTES  = 3 * 1024 * 1024;
const MAX_IMAGE_EDGE = 2000;

function readBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function toParsePayload(file: File): Promise<{ base64: string; mediaType: string }> {
  if (file.type === "application/pdf") {
    if (file.size > MAX_PDF_BYTES) {
      throw new Error("This PDF is over 3 MB, too large to read automatically. Enter the values below, or upload a photo or screenshot of the results page.");
    }
    return { base64: await readBase64(file), mediaType: "application/pdf" };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This image format can't be read. Please use a JPG or PNG photo, or a PDF.");
  }
  const scale  = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width  = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const jpeg = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Couldn't prepare the photo."))), "image/jpeg", 0.85),
  );
  return { base64: await readBase64(jpeg), mediaType: "image/jpeg" };
}

// Older records saved a public URL (which never opens for a private
// bucket); newer ones save the storage path. Accept both.
function storagePath(fileUrl: string) {
  return fileUrl.startsWith("http") ? fileUrl.replace(/^.*\/medical-reports\//, "") : fileUrl;
}

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
  const [parseMsg, setParseMsg]       = useState<string | null>(null);

  function resetDraft() {
    setDraftValues({}); setDraftType("other"); setDraftDate("");
    setDraftNotes(""); setPendingFile(null); setShowForm(false); setParseMsg(null);
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  async function handleFile(file: File) {
    setPendingFile(file);
    setShowForm(true);
    setParsing(true);
    setParseMsg(null);

    try {
      const { base64, mediaType } = await toParsePayload(file);
      const res = await fetch("/api/parse-medical-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64: base64, mediaType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setParseMsg(data.error ?? "Couldn't read this report automatically. Enter the values below.");
        return;
      }
      setDraftType(data.report_type ?? "other");
      setDraftDate(data.report_date ?? "");
      const vals: Record<string, string> = {};
      for (const [k, v] of Object.entries(data.extracted_values ?? {})) {
        if (typeof v === "number" || typeof v === "string") vals[k] = String(v);
      }
      setDraftValues(vals);
      if (!Object.keys(vals).some(k => !k.endsWith("_ref"))) {
        setParseMsg("No lab values were found in this file. Check it's the results page, or enter the values below.");
      }
    } catch (e) {
      setParseMsg(e instanceof Error ? e.message : "Couldn't read this report automatically. Enter the values below.");
    } finally {
      setParsing(false);
    }
  }

  async function openOriginal(rec: MedRecord) {
    if (!rec.file_url) return;
    // Open the tab synchronously so mobile browsers don't block it as a pop-up
    const win = window.open("", "_blank");
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath(rec.file_url), 300);
    if (error || !data) {
      win?.close();
      alert(`Couldn't open the file: ${error?.message ?? "not found"}`);
      return;
    }
    if (win) win.location.assign(data.signedUrl);
    else window.location.assign(data.signedUrl);
  }

  async function deleteRecord(rec: MedRecord) {
    if (!confirm("Delete this report and its file? This can't be undone.")) return;
    if (rec.file_url) {
      const { error: fileErr } = await supabase.storage.from(BUCKET).remove([storagePath(rec.file_url)]);
      if (fileErr) { alert(`Couldn't delete the file: ${fileErr.message}`); return; }
    }
    const { error } = await supabase.from("medical_records").delete().eq("id", rec.id);
    if (error) { alert(`Couldn't delete the report: ${error.message}`); return; }
    setRecords(prev => prev.filter(r => r.id !== rec.id));
    setExpandedId(null);
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
        .from(BUCKET)
        .upload(path, pendingFile, { contentType: pendingFile.type });
      setUploading(false);
      if (upErr) {
        // Keep the draft so nothing typed is lost
        setSaving(false);
        alert(`The file couldn't be stored: ${upErr.message}\n\nYour values are still here. Tap ✕ next to the file name to save them without the file.`);
        return;
      }
      fileUrl  = path;
      fileName = pendingFile.name;
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
    if (error || !data) {
      alert(`Couldn't save the report: ${error?.message ?? "unknown error"}`);
      return;
    }
    setRecords(prev => [data as MedRecord, ...prev]);
    setExpandedId(data.id);
    resetDraft();
  }

  // Get displayable lab keys (skip _ref keys)
  function getLabKeys(vals: Record<string, unknown>) {
    return Object.keys(vals).filter(k => !k.endsWith("_ref") && k !== "report_type" && k !== "report_date");
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#FAF7FE", border: "1px solid #E0D4F2" }}>

      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6A6180" }}>
            Medical Reports
          </p>
          {records.length > 0 && (
            <p className="text-xs mt-0.5" style={{ color: "#6A6180" }}>
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
              style={{ background: "#E7DCF7", color: "#6B46B8" }}>
              📷 Scan
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: "#E7DCF7", color: "#6B46B8" }}>
              📄 Upload
            </button>
          </div>
        )}
      </div>

      {/* Upload / Parse form */}
      {showForm && (
        <div className="px-5 pb-5 space-y-4" style={{ borderTop: "1px solid #EDE7F7" }}>

          {/* Parsing indicator */}
          {parsing && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl mt-4"
              style={{ background: "#E7DCF7", border: "1px solid #CBB4EE" }}>
              <span className="text-base animate-spin" style={{ display: "inline-block" }}>🔄</span>
              <span className="text-sm font-medium" style={{ color: "#6B46B8" }}>Reading your report…</span>
            </div>
          )}

          {!parsing && (
            <>
              {parseMsg && (
                <div className="rounded-xl px-4 py-3 mt-4 text-sm"
                  style={{ background: "#FBEBCB", color: "#7A5A06", border: "1px solid #F2B531" }}>
                  {parseMsg}
                </div>
              )}

              {/* File name */}
              {pendingFile && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl mt-4"
                  style={{ background: "#EDE7F7" }}>
                  <span className="text-sm">📄</span>
                  <span className="text-xs truncate flex-1" style={{ color: "#625A75" }}>{pendingFile.name}</span>
                  <button onClick={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = ""; if (cameraRef.current) cameraRef.current.value = ""; }}
                    className="text-xs" style={{ color: "#6A6180" }}>✕</button>
                </div>
              )}

              {/* Report type + date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs" style={{ color: "#6A6180" }}>Report type</label>
                  <select value={draftType} onChange={e => setDraftType(e.target.value)}
                    className="w-full mt-1 rounded-xl px-3 py-2 text-sm"
                    style={{ border: "1.5px solid #E0D4F2", background: "#FAF7FE", color: "#241C33", outline: "none" }}>
                    {Object.entries(REPORT_TYPE_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs" style={{ color: "#6A6180" }}>Report date</label>
                  <input type="date" value={draftDate} onChange={e => setDraftDate(e.target.value)}
                    className="w-full mt-1 rounded-xl px-3 py-2 text-sm"
                    style={{ border: "1.5px solid #E0D4F2", background: "#FAF7FE", color: "#241C33", outline: "none" }} />
                </div>
              </div>

              {/* Extracted values — editable */}
              {Object.keys(draftValues).filter(k => !k.endsWith("_ref")).length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: "#6B46B8" }}>
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
                            style={{ background: "#F5F0FD", border: "1px solid #DDCCF6" }}>
                            <p className="text-xs font-medium mb-1" style={{ color: "#6B46B8" }}>
                              {meta?.label ?? k.replace(/_/g, " ")}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={draftValues[k] ?? ""}
                                onChange={e => setDraftValues(p => ({ ...p, [k]: e.target.value }))}
                                className="flex-1 min-w-0 text-sm font-semibold rounded-lg px-2 py-1"
                                style={{ border: "1.5px solid #CBB4EE", background: "#FAF7FE", color: "#241C33", outline: "none" }}
                              />
                              {meta?.unit && (
                                <span className="text-xs shrink-0" style={{ color: "#6A6180" }}>{meta.unit}</span>
                              )}
                            </div>
                            {draftValues[refKey] && (
                              <p className="text-xs mt-1" style={{ color: "#6A6180" }}>
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
                <label className="text-xs" style={{ color: "#6A6180" }}>Notes (optional)</label>
                <input type="text" value={draftNotes} onChange={e => setDraftNotes(e.target.value)}
                  placeholder="e.g. Fasting sample · Dr Sharma's lab"
                  className="w-full mt-1 rounded-xl px-3 py-2 text-sm"
                  style={{ border: "1.5px solid #E0D4F2", background: "#FAF7FE", color: "#241C33", outline: "none" }} />
              </div>

              {/* Save / Later */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={saveRecord}
                  disabled={saving || uploading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: "#241238" }}>
                  {uploading ? "Uploading…" : saving ? "Saving…" : "Save Report ✓"}
                </button>
                <button
                  onClick={resetDraft}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "#EDE7F7", color: "#625A75" }}>
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
          <p className="text-sm text-center py-6" style={{ color: "#6A6180" }}>
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
            style={{ borderTop: idx === 0 && !showForm ? "1px solid #EDE7F7" : "1px solid #EDE7F7" }}>
            {/* Report header row */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : rec.id)}
              className="w-full flex items-center gap-3 px-5 py-3 text-left"
              style={{ background: isExpanded ? "#F5F0FD" : "#fff" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ background: "#E7DCF7" }}>🧪</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "#241C33" }}>{typeLabel}</p>
                <p className="text-xs" style={{ color: "#6A6180" }}>
                  {rec.report_date
                    ? new Date(rec.report_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                    : "Date not recorded"}
                  {rec.notes ? ` · ${rec.notes}` : ""}
                </p>
              </div>
              <span className="text-xs shrink-0" style={{ color: "#6B46B8" }}>
                {isExpanded ? "▲ Less" : "▼ More"}
              </span>
            </button>

            {/* Key values preview / full view */}
            {labKeys.length > 0 && (
              <div className="px-5 pb-3"
                style={{ background: isExpanded ? "#F5F0FD" : "#FAF7FE" }}>
                <div className="grid grid-cols-2 gap-2">
                  {keyVals.map(k => {
                    const meta   = LAB_META[k];
                    const refKey = `${k}_ref`;
                    const val    = rec.extracted_values![k];
                    return (
                      <div key={k} className="rounded-xl px-3 py-2"
                        style={{ background: "#FAF7FE", border: "1px solid #E0D4F2" }}>
                        <p className="text-xs" style={{ color: "#6A6180" }}>
                          {meta?.label ?? k.replace(/_/g, " ")}
                        </p>
                        <p className="text-sm font-semibold mt-0.5" style={{ color: "#241C33" }}>
                          {String(val)}{meta?.unit ? ` ${meta.unit}` : ""}
                        </p>
                        {!!rec.extracted_values![refKey] && (
                          <p className="text-xs" style={{ color: "#6A6180" }}>
                            Ref: {String(rec.extracted_values![refKey])}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!isExpanded && labKeys.length > 4 && (
                  <button onClick={() => setExpandedId(rec.id)}
                    className="text-xs mt-2" style={{ color: "#6B46B8" }}>
                    +{labKeys.length - 4} more values ▼
                  </button>
                )}
              </div>
            )}

            {isExpanded && (
              <div className="px-5 pb-3 flex flex-wrap items-center justify-between gap-2" style={{ background: "#F5F0FD" }}>
                {rec.file_url ? (
                  <button onClick={() => openOriginal(rec)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg truncate max-w-full"
                    style={{ background: "#FAF7FE", color: "#6B46B8", border: "1px solid #CBB4EE" }}>
                    📄 View original{rec.file_name ? ` · ${rec.file_name}` : ""}
                  </button>
                ) : <span />}
                <button onClick={() => deleteRecord(rec)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: "#FEF2F2", color: "#B42318", border: "1px solid #F5C2BE" }}>
                  Delete report
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
