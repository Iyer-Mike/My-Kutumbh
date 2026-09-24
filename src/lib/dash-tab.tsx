"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type DashTab = "log" | "plan";

const DashTabContext = createContext<{ tab: DashTab; setTab: (t: DashTab) => void }>({
  tab: "log",
  setTab: () => {},
});

/**
 * Which half of the dashboard is showing. The day arrows sit in the header,
 * above the tabs, and need to know: tomorrow's menu can be planned, but
 * tomorrow's meals cannot be eaten yet.
 */
export function DashTabProvider({ initial = "log", children }: { initial?: DashTab; children: React.ReactNode }) {
  const [tab, setTab] = useState<DashTab>(initial);
  const value = useMemo(() => ({ tab, setTab }), [tab]);
  return <DashTabContext.Provider value={value}>{children}</DashTabContext.Provider>;
}

export const useDashTab = () => useContext(DashTabContext);
