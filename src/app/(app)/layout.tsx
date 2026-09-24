import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import { FamilyTimeProvider } from "@/lib/family-time";
import { familyOf } from "@/lib/family";

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
