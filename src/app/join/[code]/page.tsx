import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JoinButton from "./JoinButton";

interface Props {
  params: Promise<{ code: string }>;
}

export default async function JoinPage({ params }: Props) {
  const { code } = await params;
  const supabase  = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Not logged in → go to login, come back after
  if (!user) {
    redirect(`/login?redirect=/join/${code}`);
  }

  // Look up invite
  const { data: invite } = await supabase
    .from("kutumbh_invites")
    .select("kutumbh_id, expires_at, is_active, kutumbhs(name)")
    .eq("invite_code", code.trim().toUpperCase())
    .single();

  // Check if already a member of any kutumbh
  const { data: existingMember } = await supabase
    .from("kutumbh_members")
    .select("kutumbh_id")
    .eq("user_id", user.id)
    .single();

  const kutumbhName = (invite?.kutumbhs as unknown as { name: string } | null)?.name;
  const expired = invite && new Date(invite.expires_at) < new Date();
  const invalid = !invite || !invite.is_active || expired;

  // Already in this same kutumbh → go straight to family page
  if (existingMember && invite && existingMember.kutumbh_id === invite.kutumbh_id) {
    redirect("/family");
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5"
      style={{ background: "#F6F5EE" }}
    >
      <div
        className="w-full rounded-3xl overflow-hidden"
        style={{ maxWidth: 400, background: "#fff", border: "1px solid #E2E1D8", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}
      >
        {/* Header band */}
        <div
          className="px-6 pt-8 pb-6 text-center"
          style={{ background: "linear-gradient(160deg, #1C2B1C 0%, #2E4A2C 70%, #3D6638 100%)" }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
            style={{ background: "rgba(255,255,255,0.12)" }}
          >
            🏠
          </div>
          <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.55)" }}>
            Family Invite
          </p>
          <h1
            className="text-2xl font-semibold text-white"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {invalid ? "Invite Unavailable" : kutumbhName ?? "My Kutumbh"}
          </h1>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-5">
          {invalid ? (
            <div className="text-center space-y-3">
              <p className="text-sm" style={{ color: "#5A6055" }}>
                {!invite
                  ? "This invite link is not valid."
                  : expired
                  ? "This invite link has expired."
                  : "This invite link is no longer active."}
              </p>
              <p className="text-xs" style={{ color: "#8A9085" }}>
                Ask the family owner to send you a fresh link.
              </p>
              <a
                href="/"
                className="inline-block mt-2 py-2.5 px-6 rounded-xl text-sm font-semibold text-white"
                style={{ background: "#1C2B1C" }}
              >
                Go Home
              </a>
            </div>
          ) : existingMember ? (
            <div className="text-center space-y-3">
              <p className="text-sm" style={{ color: "#5A6055" }}>
                You are already part of a Kutumbh.
              </p>
              <p className="text-xs" style={{ color: "#8A9085" }}>
                A person can only belong to one family at a time.
              </p>
              <a
                href="/family"
                className="inline-block mt-2 py-2.5 px-6 rounded-xl text-sm font-semibold text-white"
                style={{ background: "#1C2B1C" }}
              >
                View My Family
              </a>
            </div>
          ) : (
            <>
              <div className="text-center">
                <p className="text-sm" style={{ color: "#5A6055" }}>
                  You have been invited to join
                </p>
                <p className="text-lg font-semibold mt-1" style={{ color: "#1C2B1C" }}>
                  {kutumbhName}
                </p>
                <p className="text-xs mt-1" style={{ color: "#8A9085" }}>
                  Joining lets the family see each other&apos;s daily meals and wellness.
                </p>
              </div>

              <JoinButton code={code.trim().toUpperCase()} />

              <p className="text-center text-xs" style={{ color: "#8A9085" }}>
                Don&apos;t have an account?{" "}
                <a
                  href={`/signup?redirect=${encodeURIComponent(`/join/${code.trim().toUpperCase()}`)}`}
                  className="font-semibold"
                  style={{ color: "#4A7C44" }}
                >
                  Create one
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
