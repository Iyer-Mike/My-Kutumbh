import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

/** Sends a test alert to the caller's own phones, so each person can check alerts work without anyone else. */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return NextResponse.json({ ok: false, error: "Phone alerts are not set up yet." }, { status: 503 });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:hello@example.com", pub, priv);

  // RLS: a person reads only their own phones
  const { data: subs } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", user.id);
  if (!subs?.length) return NextResponse.json({ ok: false, error: "This phone isn't signed up for alerts yet." }, { status: 404 });

  const payload = JSON.stringify({ title: "My Kutumb Bhojan", body: "Menu alerts are working on this phone. 🌿", url: "/dashboard" });
  let sent = 0;
  let lastError = "";
  for (const s of subs) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 600 }); sent++; }
    catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      lastError = String(code ?? (e as Error).message);
      if (code === 404 || code === 410) await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
    }
  }
  return sent ? NextResponse.json({ ok: true, sent }) : NextResponse.json({ ok: false, error: `The alert service refused it (${lastError}). Turn alerts off and on again.` }, { status: 502 });
}
