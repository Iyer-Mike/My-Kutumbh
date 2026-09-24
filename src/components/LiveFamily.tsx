"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** How often an open page checks for itself, in case the socket went quiet. */
const CHECK_EVERY_MS = 20_000;

/**
 * A menu put up in the kitchen should show on every phone in the family.
 * Listens for changes to the family's rows and re-reads the page. Sockets
 * drop, phones sleep and networks block them, so the page also checks on
 * its own while it is on screen, and again on returning to the app.
 */
export default function LiveFamily({ kutumbhId, tables }: { kutumbhId: string; tables: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!kutumbhId) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let stopped = false;

    // Several rows often change together (adding four dishes at once),
    // so wait a moment and re-read once.
    const refreshSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };

    // The page is signed in through a cookie, but the socket is opened
    // separately and starts out as a stranger. Told who is listening, the
    // family's own rules let the change through; without it, every change
    // is hidden and nothing ever arrives.
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) supabase.realtime.setAuth(token);
      if (stopped) return;

      const c = supabase.channel(`family-${kutumbhId}`);
      for (const table of tables.split(",")) {
        c.on(
          "postgres_changes",
          { event: "*", schema: "public", table, filter: `kutumbh_id=eq.${kutumbhId}` },
          refreshSoon,
        );
      }
      c.subscribe();
      channel = c;
    })();

    // Phones suspend sockets in the background; catch up on return
    const onWake = () => { if (document.visibilityState === "visible") router.refresh(); };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);

    const beat = setInterval(onWake, CHECK_EVERY_MS);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      clearInterval(beat);
      if (channel) supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [kutumbhId, tables, router]);

  return null;
}
