import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function randomCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Confirm caller is a kutumbh owner
  const { data: membership } = await supabase
    .from("kutumbh_members")
    .select("role, kutumbh_id")
    .eq("user_id", user.id)
    .single();

  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Only the Prime Member can create invites" }, { status: 403 });
  }

  // Deactivate any previously active invites for this kutumbh
  await supabase
    .from("kutumbh_invites")
    .update({ is_active: false })
    .eq("kutumbh_id", membership.kutumbh_id)
    .eq("created_by", user.id);

  // Create a fresh invite code
  const code = randomCode(8);
  const { error } = await supabase.from("kutumbh_invites").insert({
    kutumbh_id: membership.kutumbh_id,
    invite_code: code,
    created_by: user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ code });
}
