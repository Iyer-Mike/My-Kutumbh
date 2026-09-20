import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code       = searchParams.get("code");
  const tokenHash  = searchParams.get("token_hash");
  const type       = searchParams.get("type") as EmailOtpType | null;
  const next       = searchParams.get("next") ?? "/dashboard";

  const supabase = await createClient();
  let authError: string | null = null;

  if (code) {
    // PKCE flow — exchange auth code for session
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) authError = error.message;
  } else if (tokenHash && type) {
    // OTP / token-hash flow (password recovery emails often use this)
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) authError = error.message;
  }

  if (authError) {
    // Send user back to forgot-password with a visible error
    return NextResponse.redirect(
      `${origin}/forgot-password?error=${encodeURIComponent("Reset link is invalid or has expired. Please request a new one.")}`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
