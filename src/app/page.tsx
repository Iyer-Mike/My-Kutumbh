import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Search = {
  code?: string;
  token_hash?: string;
  type?: string;
  error_description?: string;
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;

  // Supabase falls back to Site URL (this route) whenever its redirect
  // allow-list rejects the requested redirectTo, so auth codes can land here
  // instead of on /auth/reset. Forward them rather than dropping them.
  if (params.code || params.token_hash) {
    const qs = new URLSearchParams();
    if (params.code)       qs.set("code", params.code);
    if (params.token_hash) qs.set("token_hash", params.token_hash);
    qs.set("type", params.type ?? "recovery");
    redirect(`/auth/reset?${qs.toString()}`);
  }

  if (params.error_description) {
    redirect(`/forgot-password?error=${encodeURIComponent(params.error_description)}`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  redirect(user ? "/dashboard" : "/login");
}
