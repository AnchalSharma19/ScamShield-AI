export const SCAM_CATEGORIES = [
  "Job Scam",
  "Phishing",
  "Banking Scam",
  "UPI Scam",
  "Investment Scam",
  "Cryptocurrency Scam",
  "Lottery Scam",
  "Shopping Scam",
  "Romance Scam",
  "Impersonation",
  "Tech Support Scam",
  "Loan Scam",
  "Delivery Scam",
  "Government Impersonation",
  "Social Media Scam",
  "Account Takeover",
  "Advance Fee Scam",
  "Other",
  "Not a Scam",
  "Unknown",
] as const;

export type ScamCategoryName = (typeof SCAM_CATEGORIES)[number];

export const RISK_LEVEL_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  LOW: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  MEDIUM: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  HIGH: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", dot: "bg-orange-500" },
  CRITICAL: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
};

/**
 * Maps a free-text category from the model onto our fixed enum. The prompt
 * constrains the model to these exact values, but LLMs don't always comply
 * (e.g. "Lottery Scam / Phishing") — fall back to substring matching before
 * giving up, so a near-miss doesn't get discarded as "Unknown".
 */
export function normalizeCategory(raw: string): ScamCategoryName {
  const cleaned = raw.trim().toLowerCase();
  const exact = SCAM_CATEGORIES.find((c) => c.toLowerCase() === cleaned);
  if (exact) return exact;

  // When the model mashes categories together (e.g. "Lottery Scam / Phishing"),
  // prefer whichever known category name appears first in the text over enum order.
  const candidates = SCAM_CATEGORIES.filter((c) => c !== "Other" && c !== "Unknown" && c !== "Not a Scam")
    .map((c) => ({ category: c, index: cleaned.indexOf(c.toLowerCase()) }))
    .filter((c) => c.index !== -1)
    .sort((a, b) => a.index - b.index);

  return candidates[0]?.category ?? "Unknown";
}
