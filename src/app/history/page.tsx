"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RISK_LEVEL_COLORS } from "@/lib/scam/categories";

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
          <CardHeader>
            <CardTitle>Nothing here yet</CardTitle>
            <CardDescription>
              {signedOut
                ? "Sign in to start building your history, or run a scan right now."
                : "Run a scan and it'll show up here."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button nativeButton={false} render={<Link href="/analyze" />}>Run a scan</Button>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groups).map(([day, dayRows]) => (
          <div key={day} className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">{day}</h2>
            <div className="space-y-2">
              {dayRows.map((row) => {
                const colors = RISK_LEVEL_COLORS[row.risk_level] ?? RISK_LEVEL_COLORS.LOW;
                return (
                  <Card key={row.id}>
                    <CardContent className="flex items-center justify-between gap-4 py-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{row.scam_category}</span>
                          <Badge variant="outline" className="text-xs">
                            {row.input_type}
                          </Badge>
                        </div>
                        <p className="truncate text-sm text-muted-foreground">{row.summary}</p>
                      </div>
                      <div className={`rounded-full px-3 py-1 text-sm font-semibold ${colors.bg} ${colors.text}`}>
                        {row.risk_score}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(row.id)}
                        disabled={deletingId === row.id}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
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
