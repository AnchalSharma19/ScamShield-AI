import { generateJson } from "@/lib/ai/client";
import { URL_ANALYSIS_PROMPT } from "@/lib/ai/prompts";
import { riskLevelFromScore } from "@/lib/scam/scoring";
import { UrlAnalysisResultSchema, type UrlAnalysisResult, type UrlMetadata } from "@/types/analysis";
import { fetchUrlMetadata } from "./scanner";

/** Deterministic score from verifiable technical facts, independent of the LLM. */
export function ruleScoreFromMetadata(meta: UrlMetadata): number {
  let score = 0;
  if (!meta.https_enabled) score += 20;
  if (meta.is_ip_based) score += 30;
  if (meta.uses_url_shortener) score += 15;
  if (meta.redirect_count > 0) score += 10;
  score += meta.suspicious_characters.length * 15;
  return Math.min(100, score);
}

export async function analyzeUrl(inputUrl: string): Promise<UrlAnalysisResult> {
  const metadata = await fetchUrlMetadata(inputUrl);
  const reputationJson = JSON.stringify({
    note: "No third-party reputation API configured. Set URL_REPUTATION_API_KEY to enable this signal.",
  });

  const raw = await generateJson<Record<string, unknown>>(
    URL_ANALYSIS_PROMPT(inputUrl, JSON.stringify(metadata, null, 2), reputationJson)
  );

  const ruleScore = ruleScoreFromMetadata(metadata);
  const aiScore = typeof raw.risk_score === "number" ? raw.risk_score : 0;
  const finalScore = Math.round(aiScore * 0.6 + ruleScore * 0.4);

  const parsed = UrlAnalysisResultSchema.parse({
    risk_score: finalScore,
    risk_level: riskLevelFromScore(finalScore),
    suspicious_signals: raw.suspicious_signals ?? [],
    safe_signals: raw.safe_signals ?? [],
    explanation: raw.explanation ?? "",
    recommended_action: raw.recommended_action ?? "",
    metadata,
  });

  return parsed;
}
