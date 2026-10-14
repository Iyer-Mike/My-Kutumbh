import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => null) as { kutumbhId?: string; date?: string; lines?: unknown } | null;
  const lines = Array.isArray(body?.lines) ? body!.lines.filter((l): l is string => typeof l === "string").map((l) => l.trim().slice(0, 120)).filter(Boolean).slice(0, 6) : [];
  if (!body?.kutumbhId || !UUID.test(body.kutumbhId) || !body.date || !DAY.test(body.date) || !lines.length) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Records the change for the in-app card; says no unless the caller is the Key Member,
  // and no again if a phone alert already went out for this day in the last 5 minutes.
  const { data: pushNow, error } = await supabase.rpc("record_menu_change", { p_kutumbh: body.kutumbhId, p_date: body.date, p_lines: lines });
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  if (!pushNow) return NextResponse.json({ ok: true, push: false });

  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return NextResponse.json({ ok: true, push: false, why: "phone alerts not set up" });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:hello@example.com", pub, priv);

  const { data: targets } = await supabase.rpc("menu_push_targets", { p_kutumbh: body.kutumbhId });
  const when = new Date(`${body.date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const payload = JSON.stringify({
    title: "My Kutumb Bhojan · Menu updated",
    body: `${when} — ${lines.join(" · ")}`.slice(0, 160),
    url: `/dashboard?date=${body.date}`,
  });

  let sent = 0;
  await Promise.all((targets ?? []).map(async (t: { endpoint: string; p256dh: string; auth: string }) => {
    try {
      await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload, { TTL: 3600 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await supabase.rpc("drop_push_endpoint", { p_endpoint: t.endpoint });
    }
  }));
  return NextResponse.json({ ok: true, push: true, sent });
}
