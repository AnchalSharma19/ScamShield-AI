"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
  LabelList,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import type { DashboardStats } from "@/lib/supabase/stats";

const RISK_COLORS: Record<string, string> = {
  LOW: "var(--viz-risk-low)",
  MEDIUM: "var(--viz-risk-medium)",
  HIGH: "var(--viz-risk-high)",
  CRITICAL: "var(--viz-risk-critical)",
};

const RISK_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

const CATEGORICAL_COLORS = [
  "var(--viz-cat-1)",
  "var(--viz-cat-2)",
  "var(--viz-cat-3)",
  "var(--viz-cat-4)",
  "var(--viz-cat-5)",
];

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  fontSize: 12,
  boxShadow: "0 8px 24px -8px rgb(0 0 0 / 0.25)",
};

export function RiskLevelPieChart({ data }: { data: DashboardStats["byRiskLevel"] }) {
  if (data.length === 0) return <EmptyChart label="No data yet" />;
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="level"
            innerRadius={58}
            outerRadius={84}
            paddingAngle={3}
            strokeWidth={2}
            stroke="var(--card)"
          >
            {data.map((entry) => (
              <Cell key={entry.level} fill={RISK_COLORS[entry.level] ?? "var(--viz-other)"} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, _name, item) => {
              const n = Number(value) || 0;
              return [`${n} (${total ? Math.round((n / total) * 100) : 0}%)`, RISK_LABELS[item.payload.level] ?? item.payload.level];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{total}</span>
        <span className="text-xs text-muted-foreground">total</span>
      </div>
      <ChartLegend
        items={data.map((d) => ({
          key: d.level,
          label: RISK_LABELS[d.level] ?? d.level,
          count: d.count,
          color: RISK_COLORS[d.level] ?? "var(--viz-other)",
        }))}
      />
    </div>
  );
}

export function InputTypeDonutChart({ data }: { data: DashboardStats["byInputType"] }) {
  if (data.length === 0) return <EmptyChart label="No data yet" />;
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            innerRadius={58}
            outerRadius={84}
            paddingAngle={3}
            strokeWidth={2}
            stroke="var(--card)"
          >
            {data.map((entry, i) => (
              <Cell key={entry.type} fill={entry.type === "other" ? "var(--viz-other)" : CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, _name, item) => {
              const n = Number(value) || 0;
              return [`${n} (${total ? Math.round((n / total) * 100) : 0}%)`, item.payload.label];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{total}</span>
        <span className="text-xs text-muted-foreground">total</span>
      </div>
      <ChartLegend
        items={data.map((d, i) => ({
          key: d.type,
          label: d.label,
          count: d.count,
          color: d.type === "other" ? "var(--viz-other)" : CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length],
        }))}
      />
    </div>
  );
}

export function CategoryBarChart({ data }: { data: DashboardStats["byCategory"] }) {
  if (data.length === 0) return <EmptyChart label="No data yet" />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 24, right: 24 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="category"
          width={140}
          tick={{ fontSize: 12, fill: "var(--foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} maxBarSize={20}>
          <LabelList dataKey="count" position="right" style={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const TREND_RANGES = [
  { days: 7, label: "Last 7 days" },
  { days: 15, label: "Last 15 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
] as const;

const DEFAULT_TREND_DAYS: (typeof TREND_RANGES)[number]["days"] = 15;

export function ActivityTrendCard({ data }: { data: DashboardStats["trend"] }) {
  const [days, setDays] = useState<number>(DEFAULT_TREND_DAYS);
  const range = TREND_RANGES.find((r) => r.days === days) ?? TREND_RANGES[1];
  const sliced = data.slice(-days);
  const total = sliced.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activity Trend</CardTitle>
        <CardDescription>Analyses run in the {range.label.toLowerCase()}</CardDescription>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              {range.label}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={days} onValueChange={(value) => setDays(Number(value))}>
                {TREND_RANGES.map((r) => (
                  <DropdownMenuRadioItem key={r.days} value={r.days} closeOnClick>
                    {r.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent>
        {total === 0 ? <EmptyChart label="No activity yet" /> : <ActivityTrendChart data={sliced} />}
      </CardContent>
    </Card>
  );
}

function ActivityTrendChart({ data }: { data: DashboardStats["trend"] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ left: -12, right: 12, top: 8 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(label) => label} />
        <Area type="monotone" dataKey="count" name="Analyses" stroke="var(--primary)" strokeWidth={2} fill="url(#trendFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

const SCORE_BAND: { max: number; color: string; label: string }[] = [
  { max: 34, color: "var(--viz-risk-low)", label: "Low" },
  { max: 59, color: "var(--viz-risk-medium)", label: "Medium" },
  { max: 84, color: "var(--viz-risk-high)", label: "High" },
  { max: 101, color: "var(--viz-risk-critical)", label: "Critical" },
];

function scoreBand(score: number) {
  return SCORE_BAND.find((b) => score <= b.max) ?? SCORE_BAND[SCORE_BAND.length - 1];
}

export function AvgRiskScoreGauge({ score }: { score: number }) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;
  const band = scoreBand(score);

  return (
    <div className="flex items-center gap-4 py-1">
      <div className="relative h-28 w-28 shrink-0">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 108 108">
          <circle cx="54" cy="54" r={radius} strokeWidth="10" className="fill-none stroke-muted" />
          <circle
            cx="54"
            cy="54"
            r={radius}
            strokeWidth="10"
            strokeLinecap="round"
            className="fill-none transition-all duration-700 ease-out"
            style={{ stroke: band.color, strokeDasharray: circumference, strokeDashoffset: offset }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold tabular-nums">{score}</span>
          <span className="text-[10px] text-muted-foreground">/ 100</span>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold" style={{ color: band.color }}>
          {band.label} average
        </p>
        <p className="text-xs text-muted-foreground">Mean risk score across every analysis you&apos;ve run.</p>
      </div>
    </div>
  );
}

function ChartLegend({ items }: { items: { key: string; label: string; count: number; color: string }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-foreground">{item.label}</span>
          <span className="tabular-nums">{item.count}</span>
        </li>
      ))}
    </ul>
  );
}

function EmptyChart({ label }: { label: string }) {
  return <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">{label}</div>;
}
