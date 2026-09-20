import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RiskScore } from "./RiskScore";
import { RiskFactors } from "./RiskFactors";
import { Recommendations } from "./Recommendations";
import { Chatbot } from "./Chatbot";
import type { AnalysisResult } from "@/types/analysis";

export function AnalysisResultCard({ result }: { result: AnalysisResult }) {
  const breakdown = result.score_breakdown;
  const scoreStats = [
    { label: "AI", value: breakdown.ai_score },
    { label: "Rules", value: breakdown.rule_score },
    ...(breakdown.url_score != null ? [{ label: "URL", value: breakdown.url_score }] : []),
    ...(breakdown.pattern_score != null ? [{ label: "Pattern", value: breakdown.pattern_score }] : []),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analysis Result</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <RiskScore score={result.risk_score} level={result.risk_level} category={result.category} />

        {result.summary && <p className="text-sm text-muted-foreground">{result.summary}</p>}

        {result.ocr_uncertainty && result.ocr_uncertainty.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="space-y-1">
              {result.ocr_uncertainty.map((note, idx) => (
                <p key={idx}>{note}</p>
              ))}
            </div>
          </div>
        )}

        <Separator />

        <RiskFactors indicators={result.indicators} redFlags={result.red_flags} safeSignals={result.safe_signals} />

        <Separator />

        <Recommendations actions={result.recommended_actions} />

        <Separator />

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Score breakdown</p>
          <div className="flex flex-wrap items-center gap-2">
            {scoreStats.map((s) => (
              <div key={s.label} className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-semibold tabular-nums">{s.value}</span>
              </div>
            ))}
            <span className="text-muted-foreground">→</span>
            <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
              <span className="font-medium">Final</span>
              <span className="font-semibold tabular-nums">{breakdown.final_score}</span>
            </div>
          </div>
        </div>

        <Separator />

        <Chatbot originalMessage={result.input_text} analysis={result} />
      </CardContent>
    </Card>
  );
}
