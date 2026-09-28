import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Six digits, said aloud. Never placed in a URL. */
function spokenNumber(): string {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(n[0] % 1_000_000).padStart(6, "0");
}

function randomCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

export async function POST(req: NextRequest) {
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

  // An invitation is addressed to somebody. The link then admits that
  // person and nobody the message is forwarded to.
  let invitedEmail: string | null = null;
  try {
    const body = (await req.json()) as { email?: string };
    const raw = body.email?.trim().toLowerCase() ?? "";
    if (raw) {
      if (!/^[^s@]+@[^s@]+.[^s@]{2,}$/.test(raw)) {
        return NextResponse.json({ error: "That doesn't look like an email address." }, { status: 400 });
      }
      invitedEmail = raw;
    }
  } catch {
    // No body at all: an open link, as before. Older links behave this way.
  }

  // Deactivate any previously active invites for this kutumbh
  await supabase
    .from("kutumbh_invites")
    .update({ is_active: false })
    .eq("kutumbh_id", membership.kutumbh_id)
    .eq("created_by", user.id);

  // The link identifies the invitation; the number admits. A spoken
  // number is used within minutes, so it lives a day rather than a week.
  const code = randomCode(8);
  const joinCode = spokenNumber();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("kutumbh_invites").insert({
    kutumbh_id: membership.kutumbh_id,
    invite_code: code,
    created_by: user.id,
    invited_email: invitedEmail,
    join_code: joinCode,
    expires_at: expires,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ code, joinCode, invitedEmail, expiresAt: expires });
}
