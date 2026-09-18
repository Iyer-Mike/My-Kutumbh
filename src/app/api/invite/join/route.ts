import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { code: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { code } = body;
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Missing invite code" }, { status: 400 });
  }

  // Look up the invite
  const { data: invite } = await supabase
    .from("kutumbh_invites")
    .select("id, kutumbh_id, expires_at, is_active")
    .eq("invite_code", code.trim().toUpperCase())
    .single();

  if (!invite) {
    return NextResponse.json({ error: "Invite not found or expired" }, { status: 404 });
  }
  if (!invite.is_active) {
    return NextResponse.json({ error: "This invite link is no longer active" }, { status: 410 });
  }
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invite link has expired" }, { status: 410 });
  }

  // Check if already in a kutumbh
  const { data: existing } = await supabase
    .from("kutumbh_members")
    .select("kutumbh_id")
    .eq("user_id", user.id)
    .single();

  if (existing) {
    if (existing.kutumbh_id === invite.kutumbh_id) {
      return NextResponse.json({ error: "You are already in this family" }, { status: 409 });
    }
    return NextResponse.json({ error: "You are already in a Kutumbh" }, { status: 409 });
  }

  // Join the kutumbh
  const { error: insertError } = await supabase.from("kutumbh_members").insert({
    kutumbh_id: invite.kutumbh_id,
    user_id: user.id,
    role: "member",
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Increment used_count
  await supabase
    .from("kutumbh_invites")
    .update({ used_count: (invite as { used_count?: number }).used_count ?? 0 + 1 })
    .eq("id", invite.id);

  return NextResponse.json({ success: true, kutumbh_id: invite.kutumbh_id });
}
