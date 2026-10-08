import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import { standingOf } from "@/lib/admission";
import EnterAnyCode from "@/components/EnterAnyCode";
import { tellAdminIfWaiting } from "@/lib/door-alert";
import { FAMILY, look } from "@/lib/brand";

/**
 * The waiting room.
 *
 * Somebody has registered and is waiting to be let into My Kutumbh.
 * The screen's job is to make waiting feel like a step rather than a
 * fault: what has happened, what happens next, and roughly when.
 */
export default async function WaitingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const standing = await standingOf(supabase, user.id);
  if (standing === "admitted") redirect("/onboarding");

  const declined = standing === "declined";
  const neverKnocked = standing === "unknown";

  // Somebody is behind the door. The Admin is told once, here, because
  // waiting for him to think of opening the desk could take days.
  if (standing === "waiting") {
    await tellAdminIfWaiting(
      supabase,
      user,
      process.env.NEXT_PUBLIC_APP_URL ?? "https://my-kutumbh.vercel.app",
    );
  }

  // Whatever the Admin said, in his own words
  const { data: note } = await supabase
    .from("notices")
    .select("title, body, created_at")
    .eq("user_id", user.id)
    .eq("kind", "admin")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10" style={{ background: "#F3EEFA" }}>
      <div className="w-full" style={{ maxWidth: 420 }}>
        <div
          className="rounded-3xl px-6 py-7"
          style={{ ...look(FAMILY.gold), boxShadow: "0 10px 40px rgba(36,18,56,0.08)" }}
        >
          <p className="m-0 text-xs font-semibold uppercase tracking-widest" style={{ color: "#6A6180" }}>
            My Kutumbh
          </p>

          <h1 className="mt-2 mb-0 text-2xl" style={{ fontFamily: "var(--font-dm-serif)", color: "#241C33" }}>
            {declined
              ? "Your registration was not approved"
              : neverKnocked
              ? "Almost there"
              : "Thank you — you're registered"}
          </h1>

          {declined ? (
            <p className="mt-3 mb-0 text-sm" style={{ color: "#4A4360", lineHeight: 1.6 }}>
              {note?.body ?? "If you believe this is a mistake, reply to the invitation you received."}
            </p>
          ) : (
            <>
              <p className="mt-3 mb-0 text-sm" style={{ color: "#4A4360", lineHeight: 1.6 }}>
                {neverKnocked
                  ? "Your account exists. To go further you need the code you were sent — either the passcode from the letter that invited you, or the six-digit number a family gave you."
                  : "Your details are safely with us. Someone at My Kutumbh will look at your registration and welcome you in — usually within a day."}
              </p>

              {!neverKnocked && <div className="mt-5 grid gap-3">
                {[
                  ["Registered", "Done — your account exists and nobody else can use it.", true],
                  ["Being welcomed", "A person reads your registration and approves it.", false],
                  ["Your Kutumbh", "You name your family, and the app opens.", false],
                ].map(([title, what, done]) => (
                  <div key={title as string} className="flex gap-3 items-start">
                    <span
                      className="flex-shrink-0 rounded-full flex items-center justify-center font-bold"
                      style={{
                        width: "1.6rem", height: "1.6rem", fontSize: "0.8rem", lineHeight: 1,
                        background: done ? "#E1F0DE" : "#E7DCF7",
                        color: done ? "#2F6B34" : "#6B46B8",
                      }}
                    >
                      {done ? "✓" : "·"}
                    </span>
                    <div>
                      <p className="m-0 text-sm font-semibold" style={{ color: "#241C33" }}>{title}</p>
                      <p className="m-0 mt-0.5 text-xs" style={{ color: "#6A6180", lineHeight: 1.5 }}>{what}</p>
                    </div>
                  </div>
                ))}
              </div>}

              {!neverKnocked && (
                <p className="mt-5 mb-0 text-xs" style={{ color: "#6A6180", lineHeight: 1.6 }}>
                  Nothing more is needed from you now. Open this page again later and it will have moved on,
                  or the person who invited you will say so.
                </p>
              )}

              {neverKnocked && <EnterAnyCode />}
            </>
          )}

          <div className="mt-6 pt-5 flex items-center justify-between" style={{ borderTop: "1px solid #E0D4F2" }}>
            <span className="text-xs" style={{ color: "#8A80A0" }}>{user.email}</span>
            <SignOutButton compact />
          </div>
        </div>
      </div>
    </div>
  );
}
