"use client";

import DayNav from "./DayNav";
import { useDashTab } from "@/lib/dash-tab";

/**
 * The menu can be planned a week ahead; a meal can only be logged once it
 * has been eaten, so on the Log side the day ends at today.
 */
export default function DashboardDayNav({ date }: { date: string }) {
  const { tab } = useDashTab();
  return (
    <DayNav date={date} back={30} ahead={tab === "plan" ? 6 : 0}
      path="/dashboard" onDark />
  );
}
