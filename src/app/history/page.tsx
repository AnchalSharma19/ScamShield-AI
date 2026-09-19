"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2, Loader2, History as HistoryIcon } from "lucide-react";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RISK_LEVEL_COLORS } from "@/lib/scam/categories";
import { inputTypeMeta } from "@/lib/scam/inputTypes";

interface HistoryRow {
  id: string;
  input_type: string;
  risk_score: number;
  risk_level: keyof typeof RISK_LEVEL_COLORS;
  scam_category: string;
  summary: string;
  created_at: string;
}

function groupByDay(rows: HistoryRow[]): Record<string, HistoryRow[]> {
  const groups: Record<string, HistoryRow[]> = {};
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();

  for (const row of rows) {
    const day = new Date(row.created_at).toDateString();
    const label = day === today ? "Today" : day === yesterday ? "Yesterday" : new Date(row.created_at).toLocaleDateString();
    groups[label] = groups[label] ?? [];
    groups[label].push(row);
  }
  return groups;
}

function relativeClock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function HistoryPage() {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/history")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setRows(data.analyses ?? []);
        setSignedOut((data.analyses ?? []).length === 0);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete(id: string) {
    setDeletingId(id);
    await fetch(`/api/history?id=${id}`, { method: "DELETE" });
    setRows((prev) => prev?.filter((r) => r.id !== id) ?? null);
    setDeletingId(null);
  }

  if (rows === null) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const groups = groupByDay(rows);

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold">Your scan history</h1>
        <p className="text-sm text-muted-foreground">Everything you&apos;ve checked, kept in one place.</p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <HistoryIcon className="h-6 w-6" />
            </div>
            <CardTitle className="text-base">Nothing here yet</CardTitle>
            <CardDescription>
              {signedOut
                ? "Sign in to start building your history, or run a scan right now."
                : "Run a scan and it'll show up here."}
            </CardDescription>
            <Button nativeButton={false} render={<Link href="/analyze" />} className="mt-1">
              Run a scan
            </Button>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groups).map(([day, dayRows]) => (
          <div key={day} className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">{day}</h2>
            <div className="space-y-2">
              {dayRows.map((row) => {
                const colors = RISK_LEVEL_COLORS[row.risk_level] ?? RISK_LEVEL_COLORS.LOW;
                const { label: typeLabel, icon: TypeIcon } = inputTypeMeta(row.input_type);
                return (
                  <Card key={row.id} className="group overflow-hidden">
                    <CardContent className="flex items-center gap-3 py-3.5">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colors.bg} ${colors.text}`}>
                        <TypeIcon className="h-5 w-5" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{row.scam_category}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">· {typeLabel}</span>
                        </div>
                        <p className="truncate text-sm text-muted-foreground">{row.summary || "No summary available"}</p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <div className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colors.bg} ${colors.text}`}>
                          {row.risk_score}
                        </div>
                        <span className="text-[11px] text-muted-foreground/70">{relativeClock(row.created_at)}</span>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={() => handleDelete(row.id)}
                        disabled={deletingId === row.id}
                        aria-label="Delete this analysis"
                      >
                        {deletingId === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
