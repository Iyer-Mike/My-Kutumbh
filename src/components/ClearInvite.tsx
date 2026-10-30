"use client";

import { useEffect } from "react";
import { forgetInvite } from "@/lib/invite";

/**
 * A person who is inside the app with a family has no invitation left to
 * follow. Without this, the code kept on the phone sent every later
 * sign-in, and Home itself, back to the invite page.
 */
export default function ClearInvite() {
  useEffect(() => { forgetInvite(); }, []);
  return null;
}
