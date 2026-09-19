import { riskLevelFromScore } from "./scoring";
import type { RiskLevel } from "@/types/analysis";

export interface ConversationRiskPoint {
  analyzedAt: string;
  riskScore: number;
  riskLevel: string;
  category: string;
}

export interface ConversationRisk {
  score: number;
  level: RiskLevel;
  messageCount: number;
  /** True when risk has climbed meaningfully from the first half of the conversation to the second — the "trust building → urgency → payment ask" shape a scam takes across several messages, which no single message's score reveals. */
  escalating: boolean;
  timeline: ConversationRiskPoint[];
}

const MIN_POINTS_FOR_ESCALATION = 3;
const ESCALATION_RISE_THRESHOLD = 25;

/**
 * Rolls a conversation's per-message risk scores into one conversation-level
 * score. Leans on the latest message (what's happening right now) and the
 * worst message seen (a scam doesn't get less dangerous because later
 * messages were mundane), with the running average as a stabilizer against
 * either single-message noise dominating the score.
 */
export function computeConversationRisk(timeline: ConversationRiskPoint[]): ConversationRisk | null {
  if (timeline.length === 0) return null;

  const scores = timeline.map((p) => p.riskScore);
  const latest = scores[scores.length - 1];
  const max = Math.max(...scores);
  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;

  const escalating = detectEscalation(scores);
  const escalationBonus = escalating ? 10 : 0;
  const score = Math.min(100, Math.round(latest * 0.45 + max * 0.35 + avg * 0.2) + escalationBonus);

  return {
    score,
    level: riskLevelFromScore(score),
    messageCount: timeline.length,
    escalating,
    timeline,
  };
}

/**
 * Escalation is a rising trend from the first half of the conversation to
 * the second, not just "the last message was risky" — a single spike after
 * an otherwise flat history isn't the "normal → urgency → payment ask"
 * pattern this is meant to catch.
 */
function detectEscalation(scores: number[]): boolean {
  if (scores.length < MIN_POINTS_FOR_ESCALATION) return false;

  const midpoint = Math.ceil(scores.length / 2);
  const early = scores.slice(0, midpoint);
  const recent = scores.slice(midpoint);
  const earlyAvg = early.reduce((sum, s) => sum + s, 0) / early.length;
  const recentAvg = recent.reduce((sum, s) => sum + s, 0) / recent.length;

  if (recentAvg - earlyAvg < ESCALATION_RISE_THRESHOLD) return false;

  return scores[scores.length - 1] >= scores[0];
}
