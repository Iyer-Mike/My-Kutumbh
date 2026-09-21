"use client";

import { useState } from "react";
import DashboardSlotCard from "./DashboardSlotCard";
import PlanSlotCard, { type PlanItem } from "./PlanSlotCard";
import { SLOTS } from "@/lib/meal-slots";

type MealLog = {
  id: string;
  food_name: string;
  meal_slot: string;
  quantity_g: number;
  quantity_unit: string | null;
  calories: number | null;
  nutrition_estimated: boolean | null;
};

type MealPlan = PlanItem & { meal_slot: string };

type Props = {
  logs: MealLog[];
  totalKcal: number;
  dailyKcalGoal: number | null;
  initialPlans: MealPlan[];
  poolNames: Record<string, string>;
  memberNames: Record<string, string>;
  userId: string;
  kutumbhId: string | null;
};

export default function DashboardTabs({
  logs, totalKcal, dailyKcalGoal, initialPlans, poolNames, memberNames, userId, kutumbhId,
}: Props) {
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
            {SLOTS.map(({ key, label, icon, time }) => (
              <DashboardSlotCard
                key={key}
                slotKey={key}
                name={label}
                icon={icon}
                time={time}
                items={slotLogs[key] ?? []}
              />
            ))}
          </div>

          {/* Summary strip */}
          <div className="rounded-2xl px-4 py-4 mt-3" style={{ background: "#1C2B1C" }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Today&apos;s total</p>
                <p className="text-lg font-semibold text-white mt-0.5">
                  {Math.round(totalKcal)} kcal
                </p>
              </div>
              <div className="text-right">
                {dailyKcalGoal ? (
                  <>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Daily goal</p>
                    <p className="text-sm font-medium mt-0.5" style={{ color: "#8FBF88" }}>
                      {dailyKcalGoal} kcal
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Items logged</p>
                    <p className="text-sm font-medium mt-0.5" style={{ color: "#8FBF88" }}>
                      {logs.length > 0 ? `${logs.length} item${logs.length > 1 ? "s" : ""}` : "— log to start"}
                    </p>
                  </>
                )}
              </div>
            </div>
            {dailyKcalGoal && (
              <>
                <div className="rounded-full h-2 overflow-hidden" style={{ background: "rgba(255,255,255,0.15)" }}>
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.round((totalKcal / dailyKcalGoal) * 100))}%`,
                      background: totalKcal >= dailyKcalGoal ? "#E07B39" : "#8FBF88",
                    }}
                  />
                </div>
                <p className="text-xs mt-1.5 text-right" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {totalKcal >= dailyKcalGoal
                    ? `${Math.round(totalKcal - dailyKcalGoal)} kcal over goal`
                    : `${Math.round(dailyKcalGoal - totalKcal)} kcal remaining`}
                </p>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#8A9085" }}>
            Today&apos;s Plan
          </p>

          {SLOTS.map(({ key, label, icon, time }) => (
            <PlanSlotCard
              key={key}
              slotKey={key}
              name={label}
              icon={icon}
              time={time}
              userId={userId}
              kutumbhId={kutumbhId}
              initialItems={slotPlans[key] ?? []}
              initialPoolName={poolNames[key] ?? null}
              memberNames={memberNames}
            />
          ))}
        </>
      )}
    </>
  );
}
