"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toSquareJpeg } from "@/lib/photo";
import { FACES_BUCKET, familyFacePath, memberFacePath } from "@/lib/faces";
import { BRAND as B } from "@/lib/brand";
import Face from "./Face";

type Subject =
  | { kind: "member"; userId: string }
  | { kind: "family" };

/**
 * Choosing a face: the phone offers its camera or its gallery, the picture
 * is squared off and shrunk here, and only then does it leave the phone.
 * The one it replaces is removed, so a family keeps one photo each.
 */
export default function FacePicker({
  kutumbhId, subject, name, url, currentPath, size = 72, label = "Add a photo",
}: {
  kutumbhId: string;
  subject: Subject;
  name?: string | null;
  url?: string | null;
  currentPath?: string | null;
  size?: number;
  label?: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";               // so the same picture can be picked again
    if (!file) return;

    setError(null);
    setBusy(true);
    try {
      const jpeg = await toSquareJpeg(file);
      const supabase = createClient();
      const path = subject.kind === "member"
        ? memberFacePath(kutumbhId, subject.userId)
        : familyFacePath(kutumbhId);

      const { error: upErr } = await supabase.storage
        .from(FACES_BUCKET).upload(path, jpeg, { contentType: "image/jpeg" });
      if (upErr) throw new Error(upErr.message);

      const { error: saveErr } = subject.kind === "member"
        ? await supabase.rpc("set_member_photo", { member: subject.userId, path })
        : await supabase.from("kutumbhs").update({ photo_path: path }).eq("id", kutumbhId);
      if (saveErr) throw new Error(saveErr.message);

      // The one it replaces has no further use
      if (currentPath && currentPath !== path) {
        await supabase.storage.from(FACES_BUCKET).remove([currentPath]);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That photo could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function removeIt() {
    if (!currentPath) return;
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: saveErr } = subject.kind === "member"
        ? await supabase.rpc("set_member_photo", { member: subject.userId, path: null })
        : await supabase.from("kutumbhs").update({ photo_path: null }).eq("id", kutumbhId);
      if (saveErr) throw new Error(saveErr.message);
      await supabase.storage.from(FACES_BUCKET).remove([currentPath]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That photo could not be removed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2 justify-items-center">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="relative rounded-full disabled:opacity-60"
        aria-label={url ? `Change the photo of ${name ?? "the family"}` : label}
      >
        <Face url={url} name={name} size={size} />
        <span
          className="absolute bottom-0 right-0 flex items-center justify-center rounded-full text-[11px]"
          style={{ width: 24, height: 24, background: B.gold, color: "#2A1646", border: "2px solid #fff" }}
          aria-hidden
        >
          {busy ? "…" : "📷"}
        </span>
      </button>

      <div className="flex items-center gap-3">
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
          className="text-[12px] font-semibold" style={{ color: B.violet }}>
          {url ? (subject.kind === "member" ? "Change your photo" : "Change the family photo") : label}
        </button>
        {url && (
          <button type="button" onClick={removeIt} disabled={busy}
            className="text-[12px]" style={{ color: B.muted2 }}>
            Remove
          </button>
        )}
      </div>

      {error && (
        <p className="text-[12px] text-center m-0" style={{ color: "#9A2C1B" }}>{error}</p>
      )}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={choose} />
    </div>
  );
}
