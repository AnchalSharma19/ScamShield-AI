"use client";

import { useState } from "react";
import { Loader2, Link as LinkIcon, CheckCircle2, XCircle, AlertTriangle, CircleDot } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RiskScore } from "./RiskScore";
import type { UrlAnalysisResult } from "@/types/analysis";

export function URLAnalyzer() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UrlAnalysisResult | null>(null);

  async function analyze() {
    if (!url.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/url-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "URL analysis failed");
        return;
      }
      setResult(data);
    } catch {
      setError("Could not reach the analysis service. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="https://suspicious-link.example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && analyze()}
          disabled={loading}
        />
        <Button onClick={analyze} disabled={loading || !url.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
          {loading ? "Scanning..." : "Scan URL"}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="break-all text-base">{result.metadata.final_url}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <RiskScore score={result.risk_score} level={result.risk_level} category="URL Scan" />

            <p className="text-sm text-muted-foreground">{result.explanation}</p>

            <Separator />

            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              <span className="text-muted-foreground">Domain</span>
              <span className="truncate text-right font-mono">{result.metadata.domain}</span>

              <span className="text-muted-foreground">HTTPS</span>
              <MetaValue ok={result.metadata.https_enabled} okLabel="Yes" badLabel="No" />

              <span className="text-muted-foreground">IP-based address</span>
              <MetaValue ok={!result.metadata.is_ip_based} okLabel="No" badLabel="Yes" />

              <span className="text-muted-foreground">URL shortener</span>
              <MetaValue ok={!result.metadata.uses_url_shortener} okLabel="No" badLabel="Yes" />

              <span className="text-muted-foreground">Redirects</span>
              <span className="text-right tabular-nums">{result.metadata.redirect_count}</span>
            </div>

            {result.suspicious_signals.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Suspicious signals
                  </h3>
                  <ul className="space-y-1.5">
                    {result.suspicious_signals.map((s, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CircleDot className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            <Separator />
            <p className="text-sm font-medium">{result.recommended_action}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetaValue({ ok, okLabel, badLabel }: { ok: boolean; okLabel: string; badLabel: string }) {
  return (
    <span className={`flex items-center justify-end gap-1 text-right ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {ok ? okLabel : badLabel}
    </span>
  );
}
