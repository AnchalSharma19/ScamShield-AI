import { describe, it, expect } from "vitest";
import { computeFinalScore, riskLevelFromScore } from "@/lib/scam/scoring";

describe("computeFinalScore", () => {
  it("weights AI 40% and rules 30% when no URL/pattern signal is present, renormalized to 100%", () => {
    const breakdown = computeFinalScore({ aiScore: 100, ruleScore: 0 });
    // ai(0.4) / (0.4+0.3) = 4/7 of the weight goes to a 100 score
    expect(breakdown.final_score).toBe(Math.round((100 * 0.4) / 0.7));
  });

  it("incorporates URL and pattern scores when provided", () => {
    const breakdown = computeFinalScore({ aiScore: 82, ruleScore: 90, urlScore: 95, patternScore: 88 });
    expect(breakdown.final_score).toBe(Math.round(82 * 0.4 + 90 * 0.3 + 95 * 0.2 + 88 * 0.1));
  });

  it("never exceeds the 0-100 range for extreme inputs", () => {
    const breakdown = computeFinalScore({ aiScore: 100, ruleScore: 100, urlScore: 100, patternScore: 100 });
    expect(breakdown.final_score).toBe(100);
  });
});

describe("riskLevelFromScore", () => {
  it.each([
    [0, "LOW"],
    [40, "LOW"],
    [41, "MEDIUM"],
    [60, "MEDIUM"],
    [61, "HIGH"],
    [80, "HIGH"],
    [81, "CRITICAL"],
    [100, "CRITICAL"],
  ])("maps score %i to %s", (score, expected) => {
    expect(riskLevelFromScore(score)).toBe(expected);
  });
});
