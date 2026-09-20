import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

const FAILED = "Reset link is invalid or has expired. Please request a new one.";

// Dedicated password-reset landing route.
// Kept free of query params so it matches Supabase's redirect allow list exactly.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code      = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type      = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type ?? "recovery",
    });
    ok = !error;
  }

  return NextResponse.redirect(
    ok ? `${origin}/reset-password`
       : `${origin}/forgot-password?error=${encodeURIComponent(FAILED)}`
  );
}
