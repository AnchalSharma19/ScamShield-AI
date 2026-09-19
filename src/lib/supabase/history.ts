import { createClient } from "./server";
import type { AnalysisResult } from "@/types/analysis";

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Persists an analysis for the signed-in user. No-ops (returns null) when
 * Supabase isn't configured or nobody is signed in — analysis still works
 * without an account, it just isn't saved to history.
 */
export async function saveAnalysis(result: AnalysisResult): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: analysis, error } = await supabase
    .from("scam_analyses")
    .insert({
      user_id: user.id,
      input_type: result.input_type,
      input_text: result.input_text.slice(0, 5000),
      risk_score: result.risk_score,
      risk_level: result.risk_level,
      scam_category: result.category,
      summary: result.summary,
    })
    .select("id")
    .single();

  if (error || !analysis) {
    console.error("Failed to save analysis:", error?.message);
    return null;
  }

  if (result.indicators.length > 0) {
    await supabase.from("risk_indicators").insert(
      result.indicators.map((i) => ({
        analysis_id: analysis.id,
        indicator: i.type,
        severity: i.severity,
        description: i.evidence,
        score: i.score,
      }))
    );
  }

  if (result.recommended_actions.length > 0) {
    await supabase.from("recommendations").insert(
      result.recommended_actions.map((rec, idx) => ({
        analysis_id: analysis.id,
        recommendation: rec,
        priority: idx,
      }))
    );
  }

  return analysis.id as string;
}

export async function listAnalyses(limit = 50) {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("scam_analyses")
    .select("id, input_type, risk_score, risk_level, scam_category, summary, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to load history:", error.message);
    return [];
  }
  return data;
}

export async function deleteAnalysis(id: string) {
  if (!isSupabaseConfigured()) return false;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase.from("scam_analyses").delete().eq("id", id).eq("user_id", user.id);
  return !error;
}
