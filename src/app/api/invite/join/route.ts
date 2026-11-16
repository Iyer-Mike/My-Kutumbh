import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Plain sentences for what the database can refuse. Each says which
// kind of "no" it is, because a person sent back to the telephone for
// the wrong reason gives up.
const REASONS: Record<string, { message: string; status: number }> = {
  not_signed_in: { message: "Please sign in again.", status: 401 },
  code_not_six_digits: { message: "The number is six digits.", status: 400 },
  wrong_code: {
    message: "That number doesn't match any invitation. Check it with whoever invited you.",
    status: 404,
  },
  too_many_tries: {
    message: "Too many tries just now. Wait an hour, or ask for a fresh invitation.",
    status: 429,
  },
  invite_expired: {
    message: "That invitation has run out of time (they last three days). Ask for a new one.",
    status: 410,
  },
  invite_closed_after_tries: {
    message: "That invitation was closed after too many wrong numbers. Ask for a fresh one.",
    status: 410,
  },
  invite_other_email: {
    message:
      "That number belongs to an invitation sent to a different email address. Sign in with the address the family invited, or ask them to invite the address you are using.",
    status: 403,
  },
  in_another_family: {
    message:
      "You're already in a Kutumbh with other people. Leave it from your family page first, or ask its Key Member to remove you.",
    status: 409,
  },
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  let body: { code?: string; link?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const code = (body.code ?? "").replace(/\D/g, "");
  if (!code) return NextResponse.json({ error: "Enter the six-digit number." }, { status: 400 });

  const { data, error } = await supabase.rpc("join_with_code", { p_code: code });

  if (error) {
    const key = Object.keys(REASONS).find((k) => error.message.includes(k));

    // A wrong number typed against a real invitation counts against
    // that invitation as well, so five tries close it.
    if (key === "wrong_code" && body.link) {
      await supabase.rpc("note_wrong_code", { p_link: body.link });
    }

    // Counted here, in a call of its own: a row written inside the refused call is undone with it
    if (key === "wrong_code" || key === "invite_other_email") await supabase.rpc("note_join_attempt");

    const known = key ? REASONS[key] : null;
    return NextResponse.json(
      { error: known?.message ?? "Couldn't join just now. Please try again." },
      { status: known?.status ?? 500 },
    );
  }

  const result = data as { kutumbh_id: string; status: string };
  return NextResponse.json({ success: true, ...result });
}
