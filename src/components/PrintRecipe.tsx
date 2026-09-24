"use client";

import { BRAND as B } from "@/lib/brand";

/**
 * Phones and desktops both offer "Save as PDF" inside the print dialog,
 * which is the one way to get a file without asking for permissions.
 */
export default function PrintRecipe({ name }: { name: string }) {
  function save() {
    const before = document.title;
    document.title = name;                    // becomes the PDF's file name
    window.print();
    setTimeout(() => { document.title = before; }, 500);
  }

  return (
    <button onClick={save} data-print-hide
      className="w-full py-3 rounded-2xl text-sm font-semibold"
      style={{ background: B.tint, color: B.violet }}>
      ⇩ Save as PDF, or print
    </button>
  );
}
