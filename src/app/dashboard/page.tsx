"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RiskLevelPieChart, CategoryBarChart } from "@/components/dashboard/DashboardCharts";
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
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold">Your activity</h1>
        <p className="text-sm text-muted-foreground">A quick look at everything you&apos;ve checked so far.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Total Analyses" value={stats.total} />
        <StatTile label="Flagged (High/Critical)" value={stats.scamCount} tone="danger" />
        <StatTile label="Looked Safe" value={stats.safeCount} tone="safe" />
      </div>

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
            <CardTitle className="text-base">Scam Categories</CardTitle>
            <CardDescription>Most common categories detected</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryBarChart data={stats.byCategory} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone?: "danger" | "safe" }) {
  const toneClass = tone === "danger" ? "text-red-500" : tone === "safe" ? "text-emerald-500" : "";
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
