import type { RiskLevel, ScoreBreakdown } from "@/types/analysis";

const WEIGHTS = {
  ai: 0.4,
  rule: 0.3,
  url: 0.2,
  pattern: 0.1,
} as const;

export function riskLevelFromScore(score: number): RiskLevel {
  if (score <= 20) return "LOW";
  if (score <= 40) return "LOW";
  if (score <= 60) return "MEDIUM";
  if (score <= 80) return "HIGH";
  return "CRITICAL";
}

/**
 * Combines AI, rule-engine, URL-reputation, and pattern-similarity scores
 * into one final score. When a signal isn't available (e.g. no URL in the
 * message), its weight is redistributed proportionally across the signals
 * that ARE available, so a text-only analysis isn't penalized for missing
 * a URL score it was never going to have.
 */
export function computeFinalScore(input: {
  aiScore: number;
  ruleScore: number;
  urlScore?: number | null;
  patternScore?: number | null;
}): ScoreBreakdown {
  const available: { key: keyof typeof WEIGHTS; value: number }[] = [
    { key: "ai", value: input.aiScore },
    { key: "rule", value: input.ruleScore },
  ];
  if (input.urlScore != null) available.push({ key: "url", value: input.urlScore });
  if (input.patternScore != null) available.push({ key: "pattern", value: input.patternScore });

  const totalWeight = available.reduce((sum, a) => sum + WEIGHTS[a.key], 0);
  const finalScore = available.reduce((sum, a) => sum + a.value * (WEIGHTS[a.key] / totalWeight), 0);

  return {
    ai_score: input.aiScore,
    rule_score: input.ruleScore,
    url_score: input.urlScore ?? null,
    pattern_score: input.patternScore ?? null,
    final_score: Math.round(finalScore),
    weights: { ...WEIGHTS },
  };
}
