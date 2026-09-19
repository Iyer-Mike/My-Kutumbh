"use client";

import { useState } from "react";
import DashboardSlotCard from "./DashboardSlotCard";
import PlanSlotCard from "./PlanSlotCard";

const SLOTS = [
  { key: "breakfast", name: "Breakfast", icon: "☀️",  time: "7 – 9 am" },
  { key: "lunch",     name: "Lunch",     icon: "🌤️", time: "12 – 2 pm" },
  { key: "dinner",   name: "Dinner",    icon: "🌙",  time: "7 – 9 pm" },
  { key: "other",    name: "Other",     icon: "＋",  time: "Any time" },
];

type MealLog = {
  id: string;
  food_name: string;
  meal_slot: string;
  quantity_g: number;
  quantity_unit: string | null;
  calories: number | null;
};

type MealPlan = {
  id: string;
  food_name: string;
  meal_slot: string;
  quantity_g: number;
  quantity_unit: string | null;
};

type Props = {
  logs: MealLog[];
  totalKcal: number;
  initialPlans: MealPlan[];
  userId: string;
};

export default function DashboardTabs({ logs, totalKcal, initialPlans, userId }: Props) {
  const [tab, setTab] = useState<"plan" | "log">("log");

  const slotLogs: Record<string, MealLog[]>   = {};
  for (const log of logs)         { (slotLogs[log.meal_slot]  ??= []).push(log); }

  const slotPlans: Record<string, MealPlan[]> = {};
  for (const plan of initialPlans) { (slotPlans[plan.meal_slot] ??= []).push(plan); }

  return (
    <>
      {/* Tab switcher */}
      <div
        className="flex gap-1 rounded-xl p-1 mb-4"
        style={{ background: "#E8E7E0" }}
      >
        {(["log", "plan"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: tab === t ? "#1C2B1C" : "transparent",
              color:      tab === t ? "#fff"    : "#8A9085",
            }}
          >
            {t === "log" ? "Log" : "Plan"}
          </button>
        ))}
      </div>

      {tab === "log" ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#8A9085" }}>
            Today&apos;s Meals
          </p>

          <div className="space-y-3">
            {SLOTS.map(({ key, name, icon, time }) => (
              <DashboardSlotCard
                key={key}
                slotKey={key}
                name={name}
                icon={icon}
                time={time}
                items={slotLogs[key] ?? []}
              />
            ))}
          </div>

          {/* Summary strip */}
          <div
            className="rounded-2xl px-4 py-3 flex items-center justify-between mt-3"
            style={{ background: "#1C2B1C" }}
          >
            <div>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Today&apos;s total</p>
              <p className="text-lg font-semibold text-white mt-0.5">
                {totalKcal > 0 ? `${Math.round(totalKcal)} kcal` : "0 kcal"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Items logged</p>
              <p className="text-sm font-medium mt-0.5" style={{ color: "#8FBF88" }}>
                {logs.length > 0 ? `${logs.length} item${logs.length > 1 ? "s" : ""}` : "— log to start"}
              </p>
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#8A9085" }}>
            Today&apos;s Plan
          </p>

          {SLOTS.map(({ key, name, icon, time }) => (
            <PlanSlotCard
              key={key}
              slotKey={key}
              name={name}
              icon={icon}
              time={time}
              userId={userId}
              initialItems={slotPlans[key] ?? []}
            />
          ))}
        </>
      )}
    </>
  );
}
