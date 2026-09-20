import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import type { Indicator } from "@/types/analysis";

const SEVERITY_DOT: Record<string, string> = {
  low: "bg-amber-400",
  medium: "bg-orange-500",
  high: "bg-red-500",
  critical: "bg-red-600",
};

export function RiskFactors({ indicators, redFlags, safeSignals }: { indicators: Indicator[]; redFlags: string[]; safeSignals: string[] }) {
  return (
    <div className="space-y-4">
      {indicators.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <ShieldAlert className="h-4 w-4" /> Detected risk indicators
          </h3>
          <ul className="space-y-1.5">
            {indicators
              .slice()
              .sort((a, b) => b.score - a.score)
              .map((indicator, idx) => (
                <li key={idx} className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[indicator.severity] ?? "bg-muted-foreground"}`} />
                    {indicator.type}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">+{indicator.score}</span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {redFlags.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-red-500" /> Red flags from AI analysis
          </h3>
          <ul className="space-y-1.5">
            {redFlags.map((flag, idx) => (
              <li key={idx} className="text-sm text-muted-foreground">
                • {flag}
              </li>
            ))}
          </ul>
        </div>
      )}

      {safeSignals.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Signals that look okay
          </h3>
          <ul className="space-y-1.5">
            {safeSignals.map((signal, idx) => (
              <li key={idx} className="text-sm text-muted-foreground">
                • {signal}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
