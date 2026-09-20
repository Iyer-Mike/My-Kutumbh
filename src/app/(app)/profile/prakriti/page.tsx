import PrakritiAssessment from "@/components/PrakritiAssessment";
import { createClient } from "@/lib/supabase/server";

export default async function PrakritiPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return <PrakritiAssessment userId={user!.id} />;
}
