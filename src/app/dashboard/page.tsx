"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldAlert, ShieldCheck, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  RiskLevelPieChart,
  CategoryBarChart,
  InputTypeDonutChart,
  ActivityTrendCard,
  AvgRiskScoreGauge,
} from "@/components/dashboard/DashboardCharts";
import type { DashboardStats } from "@/lib/supabase/stats";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then(setStats);
  }, []);

  if (!stats) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold">Your activity</h1>
        <p className="text-sm text-muted-foreground">A quick look at everything you&apos;ve checked so far.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile icon={Activity} label="Total Analyses" value={stats.total} />
        <StatTile icon={ShieldAlert} label="Flagged (High/Critical)" value={stats.scamCount} tone="danger" />
        <StatTile icon={ShieldCheck} label="Looked Safe" value={stats.safeCount} tone="safe" />
      </div>

      <ActivityTrendCard data={stats.trend} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk Level Breakdown</CardTitle>
            <CardDescription>Share of analyses by risk level</CardDescription>
          </CardHeader>
          <CardContent>
            <RiskLevelPieChart data={stats.byRiskLevel} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Average Risk Score</CardTitle>
            <CardDescription>Mean score across all analyses</CardDescription>
          </CardHeader>
          <CardContent>
            <AvgRiskScoreGauge score={stats.avgRiskScore} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scam Categories</CardTitle>
            <CardDescription>Most common categories detected</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryBarChart data={stats.byCategory} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Input Types</CardTitle>
            <CardDescription>Where the analyzed content came from</CardDescription>
          </CardHeader>
          <CardContent>
            <InputTypeDonutChart data={stats.byInputType} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone?: "danger" | "safe";
}) {
  const toneClass = tone === "danger" ? "text-red-500" : tone === "safe" ? "text-emerald-500" : "text-primary";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
