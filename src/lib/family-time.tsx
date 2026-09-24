"use client";

import { createContext, useContext } from "react";
import { DEFAULT_TIME_ZONE } from "@/lib/dates";

/**
 * The family's own time zone, handed down from the server so every screen
 * agrees on which day it is — including a Kutumbh that doesn't live in India.
 */
const FamilyTimeZone = createContext<string>(DEFAULT_TIME_ZONE);

export function FamilyTimeProvider({ tz, children }: { tz: string; children: React.ReactNode }) {
  return <FamilyTimeZone.Provider value={tz}>{children}</FamilyTimeZone.Provider>;
}

export function useFamilyTimeZone(): string {
  return useContext(FamilyTimeZone);
}
