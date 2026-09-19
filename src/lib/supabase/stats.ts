import { createClient } from "./server";
import { isSupabaseConfigured } from "./history";

export const INPUT_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  email: "Email",
  whatsapp: "WhatsApp",
  job_offer: "Job Offer",
  social_media: "Social Media",
  screenshot: "Screenshot",
  url: "URL",
  sms: "SMS",
};

// Widest range the trend dropdown offers (90 days) — fetched once and sliced
// client-side so switching ranges doesn't need another round trip.
const TREND_DAYS = 90;
const CATEGORY_CAP = 6;
const INPUT_TYPE_CAP = 5;

export interface DashboardStats {
  total: number;
  scamCount: number;
  safeCount: number;
  avgRiskScore: number;
  byRiskLevel: { level: string; count: number }[];
  byCategory: { category: string; count: number }[];
  byInputType: { type: string; label: string; count: number }[];
  trend: { date: string; count: number }[];
}

const EMPTY_STATS: DashboardStats = {
  total: 0,
  scamCount: 0,
  safeCount: 0,
  avgRiskScore: 0,
  byRiskLevel: [],
  byCategory: [],
  byInputType: [],
  trend: [],
};

/** Folds a count-sorted list down to `cap` entries, bucketing the remainder into "Other". */
function capWithOther<T extends { count: number }>(sorted: T[], cap: number, makeOther: (count: number) => T): T[] {
  if (sorted.length <= cap) return sorted;
  const head = sorted.slice(0, cap - 1);
  const otherCount = sorted.slice(cap - 1).reduce((sum, row) => sum + row.count, 0);
  return [...head, makeOther(otherCount)];
}

export async function getUserStats(): Promise<DashboardStats> {
  if (!isSupabaseConfigured()) return EMPTY_STATS;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY_STATS;

  const { data, error } = await supabase
    .from("scam_analyses")
    .select("risk_level, scam_category, input_type, risk_score, created_at")
    .eq("user_id", user.id);

  if (error || !data) return EMPTY_STATS;

  const byRiskLevel = new Map<string, number>();
  const byCategory = new Map<string, number>();
  const byInputType = new Map<string, number>();
  const byDate = new Map<string, number>();
  let scamCount = 0;
  let scoreSum = 0;

  const today = new Date();
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    byDate.set(d.toISOString().slice(0, 10), 0);
  }

  for (const row of data) {
    byRiskLevel.set(row.risk_level, (byRiskLevel.get(row.risk_level) ?? 0) + 1);
    byCategory.set(row.scam_category, (byCategory.get(row.scam_category) ?? 0) + 1);
    byInputType.set(row.input_type, (byInputType.get(row.input_type) ?? 0) + 1);
    if (row.risk_level === "HIGH" || row.risk_level === "CRITICAL") scamCount += 1;
    scoreSum += row.risk_score;

    const day = row.created_at?.slice(0, 10);
    if (day && byDate.has(day)) byDate.set(day, (byDate.get(day) ?? 0) + 1);
  }

  const sortedCategories = Array.from(byCategory, ([category, count]) => ({ category, count })).sort(
    (a, b) => b.count - a.count
  );
  const sortedInputTypes = Array.from(byInputType, ([type, count]) => ({
    type,
    label: INPUT_TYPE_LABELS[type] ?? type,
    count,
  })).sort((a, b) => b.count - a.count);

  return {
    total: data.length,
    scamCount,
    safeCount: data.length - scamCount,
    avgRiskScore: data.length ? Math.round(scoreSum / data.length) : 0,
    byRiskLevel: Array.from(byRiskLevel, ([level, count]) => ({ level, count })),
    byCategory: capWithOther(sortedCategories, CATEGORY_CAP, (count) => ({ category: "Other", count })),
    byInputType: capWithOther(sortedInputTypes, INPUT_TYPE_CAP, (count) => ({ type: "other", label: "Other", count })),
    trend: Array.from(byDate, ([date, count]) => ({ date, count })),
  };
}
