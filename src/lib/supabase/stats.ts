import { createClient } from "./server";
import { isSupabaseConfigured } from "./history";

export interface DashboardStats {
  total: number;
  scamCount: number;
  safeCount: number;
  byRiskLevel: { level: string; count: number }[];
  byCategory: { category: string; count: number }[];
}

const EMPTY_STATS: DashboardStats = { total: 0, scamCount: 0, safeCount: 0, byRiskLevel: [], byCategory: [] };

export async function getUserStats(): Promise<DashboardStats> {
  if (!isSupabaseConfigured()) return EMPTY_STATS;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY_STATS;

  const { data, error } = await supabase
    .from("scam_analyses")
    .select("risk_level, scam_category")
    .eq("user_id", user.id);

  if (error || !data) return EMPTY_STATS;

  const byRiskLevel = new Map<string, number>();
  const byCategory = new Map<string, number>();
  let scamCount = 0;

  for (const row of data) {
    byRiskLevel.set(row.risk_level, (byRiskLevel.get(row.risk_level) ?? 0) + 1);
    byCategory.set(row.scam_category, (byCategory.get(row.scam_category) ?? 0) + 1);
    if (row.risk_level === "HIGH" || row.risk_level === "CRITICAL") scamCount += 1;
  }

  return {
    total: data.length,
    scamCount,
    safeCount: data.length - scamCount,
    byRiskLevel: Array.from(byRiskLevel, ([level, count]) => ({ level, count })),
    byCategory: Array.from(byCategory, ([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
  };
}
