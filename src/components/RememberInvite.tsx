"use client";

import { useEffect } from "react";
import { rememberInvite } from "@/lib/invite";

/** Keeps the invite code on this phone while the person signs up and
 *  confirms their email, so they come back to the right family. */
export default function RememberInvite({ code }: { code: string }) {
  useEffect(() => { rememberInvite(code); }, [code]);
  return null;
}
