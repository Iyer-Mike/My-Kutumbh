"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * The Admin writes to one Kutumbh. Who may do this is decided in the
 * database, not here — this only carries the words across.
 */
export async function writeToKutumbh(
  kutumbhId: string,
  title: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_write_to_kutumbh", {
    p_kutumbh: kutumbhId,
    p_title: title,
    p_body: body,
  });

  if (error) {
    return {
      ok: false,
      error:
        error.message === "Not permitted"
          ? "That isn't yours to send."
          : "The note didn't go. Please try again.",
    };
  }

  revalidatePath("/admin");
  return { ok: true };
}

/** The Prime Member writes back. */
export async function replyToAdmin(body: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("reply_to_admin", { p_body: body });
  if (error) {
    return {
      ok: false,
      error:
        error.message.includes("Prime Member")
          ? "Only the Prime Member can reply for the family."
          : "Your reply didn't go. Please try again.",
    };
  }

  revalidatePath("/family");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Read, and not shown again. */
export async function markNoticeRead(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("notices").update({ read_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/dashboard");
  revalidatePath("/family");
}

/** Take back a letter. Only the Admin's own — a reply is not ours to erase. */
export async function withdrawNotice(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_delete_notice", { p_notice: id });
  if (error) return { ok: false, error: "It couldn't be withdrawn. Please try again." };
  if (!data) return { ok: false, error: "That letter is no longer there." };

  revalidatePath("/admin");
  return { ok: true };
}
