import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Sub = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const s = await req.json().catch(() => null) as Sub | null;
  if (!s?.endpoint?.startsWith("https://") || !s.keys?.p256dh || !s.keys?.auth) return NextResponse.json({ ok: false }, { status: 400 });
  const { error } = await supabase.rpc("save_push_subscription", { p_endpoint: s.endpoint, p_p256dh: s.keys.p256dh, p_auth: s.keys.auth });
  return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const s = await req.json().catch(() => null) as Sub | null;
  if (!s?.endpoint) return NextResponse.json({ ok: false }, { status: 400 });
  await supabase.rpc("drop_push_endpoint", { p_endpoint: s.endpoint });
  return NextResponse.json({ ok: true });
}
