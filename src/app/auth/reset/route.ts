import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

const FAILED = "Reset link is invalid or has expired. Please request a new one.";

// Password-reset landing route.
//
// token_hash links (from the email template) carry no PKCE state, so they can
// be verified here on the server. A PKCE `code` cannot -- its verifier lives in
// browser storage -- so that case is handed to the client handler on `/`.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code      = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type      = (searchParams.get("type") as EmailOtpType | null) ?? "recovery";

  if (tokenHash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

    return NextResponse.redirect(
      error
        ? `${origin}/forgot-password?error=${encodeURIComponent(`${FAILED} [${error.message}]`)}`
        : `${origin}/reset-password`
    );
  }

  if (code) {
    return NextResponse.redirect(`${origin}/?code=${encodeURIComponent(code)}`);
  }

  return NextResponse.redirect(
    `${origin}/forgot-password?error=${encodeURIComponent(FAILED)}`
  );
}
