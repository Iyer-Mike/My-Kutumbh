import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthCodeHandler from "@/components/AuthCodeHandler";

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
  if (params.code || params.token_hash) {
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

  redirect(user ? "/dashboard" : "/login");
}
