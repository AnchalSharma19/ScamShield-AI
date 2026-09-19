"use client";

import { RISK_LEVEL_COLORS } from "@/lib/scam/categories";
import type { RiskLevel } from "@/types/analysis";

const LEVEL_LABEL: Record<RiskLevel, string> = {
  LOW: "Low Risk",
  MEDIUM: "Medium Risk",
  HIGH: "High Risk",
  CRITICAL: "Critical Risk",
};

const RING_COLOR: Record<RiskLevel, string> = {
  LOW: "stroke-emerald-500",
  MEDIUM: "stroke-amber-500",
  HIGH: "stroke-orange-500",
  CRITICAL: "stroke-red-500",
};

export function RiskScore({ score, level, category }: { score: number; level: RiskLevel; category: string }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const colors = RISK_LEVEL_COLORS[level];

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="relative h-44 w-44">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r={radius} strokeWidth="12" className="fill-none stroke-muted" />
          <circle
            cx="80"
            cy="80"
            r={radius}
            strokeWidth="12"
            strokeLinecap="round"
            className={`fill-none transition-all duration-700 ease-out ${RING_COLOR[level]}`}
            style={{ strokeDasharray: circumference, strokeDashoffset: offset }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold tabular-nums">{score}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>

      <div className={`rounded-full px-4 py-1.5 text-sm font-semibold ${colors.bg} ${colors.text}`}>
        {LEVEL_LABEL[level]}
      </div>

      <p className="text-sm text-muted-foreground">
        Category: <span className="font-medium text-foreground">{category}</span>
      </p>
    </div>
  );
}
