import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RiskScore } from "./RiskScore";
import { RiskFactors } from "./RiskFactors";
import { Recommendations } from "./Recommendations";
import { Chatbot } from "./Chatbot";
import type { AnalysisResult } from "@/types/analysis";

export function AnalysisResultCard({ result }: { result: AnalysisResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Analysis Result</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <RiskScore score={result.risk_score} level={result.risk_level} category={result.category} />

        {result.summary && <p className="text-sm text-muted-foreground">{result.summary}</p>}

        {result.ocr_uncertainty && result.ocr_uncertainty.length > 0 && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            {result.ocr_uncertainty.map((note, idx) => (
              <p key={idx}>⚠️ {note}</p>
            ))}
          </div>
        )}

        <Separator />

        <RiskFactors indicators={result.indicators} redFlags={result.red_flags} safeSignals={result.safe_signals} />

        <Separator />

        <Recommendations actions={result.recommended_actions} />

        <Separator />

        <div className="text-xs text-muted-foreground">
          Score breakdown — AI: {result.score_breakdown.ai_score}, Rules: {result.score_breakdown.rule_score}
          {result.score_breakdown.url_score != null && `, URL: ${result.score_breakdown.url_score}`}
          {result.score_breakdown.pattern_score != null && `, Pattern: ${result.score_breakdown.pattern_score}`}
          {" → "}Final: {result.score_breakdown.final_score}
        </div>

        <Separator />

        <Chatbot originalMessage={result.input_text} analysis={result} />
      </CardContent>
    </Card>
  );
}
