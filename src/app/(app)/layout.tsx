import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import { FamilyTimeProvider } from "@/lib/family-time";
import { familyOf } from "@/lib/family";
import { standingOf } from "@/lib/admission";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Two doors. This is the first: has the Admin let them into My
  // Kutumbh at all? Someone still waiting sees the waiting room and
  // nothing else — no family, no logging, no coach.
  const standing = await standingOf(supabase, user.id);
  // Anything but a plain "admitted" waits outside. A person whose
  // passcode never landed has no row at all, and must not simply
  // wander in because of it.
  if (standing !== "admitted") {
    redirect("/waiting");
  }

  const { timeZone } = await familyOf(supabase, user.id);

  return (
    <FamilyTimeProvider tz={timeZone}>
    <div style={{ background: "#F3EEFA", minHeight: "100vh" }}>
      <div
        className="mx-auto flex flex-col min-h-screen"
        style={{ maxWidth: 480, boxShadow: "0 0 40px rgba(0,0,0,0.08)" }}
      >
        <div className="flex-1 pb-20">{children}</div>
        <BottomNav />
      </div>
    </div>
    </FamilyTimeProvider>
  );
}
