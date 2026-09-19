import type { Indicator } from "@/types/analysis";

export type Severity = "low" | "medium" | "high" | "critical";

export interface ScamRule {
  id: string;
  label: string;
  severity: Severity;
  /** Points added to the rule-engine score (0-100 scale) when this rule fires. */
  weight: number;
  pattern: RegExp;
}

/**
 * Phrases that, when found near a match, flip a rule from "suspicious" to
 * "safety advice" — e.g. "Never share your OTP with anyone" should NOT score
 * as an OTP-request red flag.
 */
const NEGATION_CUES = [
  "never share",
  "never give",
  "never provide",
  "never disclose",
  "don't share",
  "do not share",
  "won't ask",
  "will never ask",
  "does not ask",
  "doesn't ask",
  "should not share",
  "should never share",
  "please do not",
  "we will never",
  "avoid sharing",
];

const NEGATION_WINDOW = 40; // chars to look back from a match for a negation cue

export const RULES: ScamRule[] = [
  { id: "registration_fee", label: "Registration fee request", severity: "high", weight: 25, pattern: /\bregistration\s+fee\b/i },
  { id: "pay_before_joining", label: "Pay before joining/employment", severity: "high", weight: 30, pattern: /\bpay\s+before\s+(joining|employment|starting)\b/i },
  { id: "otp_request", label: "OTP request", severity: "high", weight: 25, pattern: /\botp\b|\bone[-\s]?time\s+password\b/i },
  { id: "password_request", label: "Password request", severity: "high", weight: 25, pattern: /\bpassword\b/i },
  { id: "pin_request", label: "PIN request", severity: "high", weight: 25, pattern: /\b(pin\s*code|4-?digit\s+pin|share.{0,15}\bpin\b)\b/i },
  { id: "urgency", label: "Urgency / time pressure", severity: "medium", weight: 10, pattern: /\b(urgent|immediately|act now|expires? (today|soon)|limited time|within\s+\d+\s*(hours?|minutes?))\b/i },
  { id: "threat", label: "Threat of consequence", severity: "high", weight: 20, pattern: /\b(account (will be|will get) (suspended|blocked|closed)|legal action|arrest warrant|penalty|fine of)\b/i },
  { id: "guaranteed_return", label: "Guaranteed / unrealistic returns", severity: "high", weight: 25, pattern: /\b(guaranteed returns?|100%\s*(profit|returns?)|double your money|risk[-\s]?free investment)\b/i },
  { id: "unrealistic_salary", label: "Unrealistic salary/reward", severity: "medium", weight: 10, pattern: /\b(earn\s*[₹$]?\s*\d{2,3},?\d{3,}\s*(per|\/)\s*(day|week))\b/i },
  { id: "send_money", label: "Request to send money", severity: "high", weight: 25, pattern: /\b(send money|transfer (the )?(funds|amount|money)|wire transfer)\b/i },
  { id: "upi_request", label: "UPI / payment ID request", severity: "medium", weight: 10, pattern: /\b(upi\s*id|google\s*pay|phonepe|paytm)\b/i },
  { id: "gift_card", label: "Gift card request", severity: "high", weight: 25, pattern: /\b(gift\s*card|itunes\s*card|google\s*play\s*card|steam\s*card)\b/i },
  { id: "crypto_request", label: "Cryptocurrency request", severity: "high", weight: 20, pattern: /\b(bitcoin|crypto(currency)?|usdt|wallet address)\b/i },
  { id: "remote_access", label: "Remote access request", severity: "critical", weight: 30, pattern: /\b(anydesk|teamviewer|remote access|screen share|install this app to (fix|verify))\b/i },
  { id: "account_verification", label: "Account verification / suspicious link", severity: "medium", weight: 15, pattern: /\b(verify your account|confirm your (identity|details)|click (here|the link) to verify)\b/i },
  { id: "lottery", label: "Lottery / prize claim", severity: "high", weight: 25, pattern: /\b(you (have|'ve) won|lottery winner|lucky draw|claim your prize)\b/i },
  { id: "move_platform", label: "Requests to move to another platform", severity: "medium", weight: 10, pattern: /\b(message me on (whatsapp|telegram)|continue on telegram|add me on whatsapp)\b/i },
  { id: "advance_fee", label: "Advance/processing fee", severity: "high", weight: 20, pattern: /\b(processing fee|advance fee|customs fee|clearance fee|release your (parcel|package))\b/i },
  { id: "bank_details", label: "Bank details request", severity: "high", weight: 25, pattern: /\b(account number|ifsc code|card number|cvv|expiry date)\b/i },
  { id: "no_interview", label: "No-interview hiring", severity: "medium", weight: 10, pattern: /\b(no interview required|direct joining|selected without interview)\b/i },
];

interface Match {
  rule: ScamRule;
  index: number;
  evidence: string;
}

function findMatches(text: string): Match[] {
  const matches: Match[] = [];
  for (const rule of RULES) {
    const globalPattern = new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : rule.pattern.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = globalPattern.exec(text)) !== null) {
      matches.push({ rule, index: m.index, evidence: m[0] });
      if (m.index === globalPattern.lastIndex) globalPattern.lastIndex++; // avoid infinite loop on zero-width matches
    }
  }
  return matches;
}

function isNegated(text: string, matchIndex: number): boolean {
  const windowStart = Math.max(0, matchIndex - NEGATION_WINDOW);
  const context = text.slice(windowStart, matchIndex).toLowerCase();
  return NEGATION_CUES.some((cue) => context.includes(cue));
}

export interface RuleEngineResult {
  score: number; // 0-100
  indicators: Indicator[];
}

/**
 * Context-aware keyword/pattern rule engine. Matches are discounted (not
 * dropped) when preceded by a negation cue, since "never share your OTP" is
 * safety advice, not evidence the message is asking for one.
 */
export function runRuleEngine(text: string): RuleEngineResult {
  const matches = findMatches(text);
  const seen = new Set<string>();
  const indicators: Indicator[] = [];
  let total = 0;

  for (const match of matches) {
    if (seen.has(match.rule.id)) continue;

    const negated = isNegated(text, match.index);
    const effectiveWeight = negated ? Math.round(match.rule.weight * 0.15) : match.rule.weight;

    if (negated && effectiveWeight === 0) continue;
    seen.add(match.rule.id);
    total += effectiveWeight;

    indicators.push({
      type: match.rule.label,
      severity: negated ? "low" : match.rule.severity,
      evidence: match.evidence,
      confidence: negated ? 40 : 85,
      score: effectiveWeight,
    });
  }

  return { score: Math.min(100, total), indicators };
}
