import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthCodeHandler from "@/components/AuthCodeHandler";
import LandingPage from "@/components/LandingPage";

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

  // Supabase falls back to Site URL (this route) when its redirect allow-list
  // rejects the requested redirectTo, so auth codes land here. The PKCE
  // verifier is in browser storage, so the exchange must run client-side.
  // token_hash needs no PKCE verifier, so the server route can verify it.
  if (params.token_hash) {
    const qs = new URLSearchParams({
      token_hash: params.token_hash,
      type: params.type ?? "recovery",
    });
    redirect(`/auth/reset?${qs.toString()}`);
  }

  // A PKCE code must be exchanged in the browser, where the verifier lives.
  if (params.code) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center min-h-screen px-4 py-safe">
        <AuthCodeHandler />
      </main>
    );
  }

  if (params.error_description) {
    redirect(`/forgot-password?error=${encodeURIComponent(params.error_description)}`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Signed in → straight to today's meals. Otherwise, the way in.
  if (user) redirect("/dashboard");
  return <LandingPage />;
}
