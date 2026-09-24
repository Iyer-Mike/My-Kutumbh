import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Plain sentences for what the database function can refuse
const REASONS: Record<string, { message: string; status: number }> = {
  not_signed_in:     { message: "Please sign in again.", status: 401 },
  invite_not_found:  { message: "This invite link is not valid.", status: 404 },
  invite_inactive:   { message: "This invite link is no longer active.", status: 410 },
  invite_expired:    { message: "This invite link has expired. Ask for a fresh one.", status: 410 },
  in_another_family: {
    message: "You're already in a Kutumbh with other people. Ask its Prime Member to remove you first.",
    status: 409,
  },
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const code = body.code?.trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "Missing invite code" }, { status: 400 });

  // One step in the database: check the invite, leave a Kutumbh that is only
  // this person's, and join. A family with others in it is never left this way.
  const { data, error } = await supabase.rpc("join_kutumbh_with_invite", { p_code: code });

  if (error) {
    const key = Object.keys(REASONS).find((k) => error.message.includes(k));
    const known = key ? REASONS[key] : null;
    return NextResponse.json(
      { error: known?.message ?? "Couldn't join just now. Please try again." },
      { status: known?.status ?? 500 },
    );
  }

  const result = data as { kutumbh_id: string; status: string };
  return NextResponse.json({ success: true, ...result });
}
