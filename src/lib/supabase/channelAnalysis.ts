import { createServiceClient } from "./server";
import { isSupabaseConfigured } from "./history";
import type { AnalysisResult } from "@/types/analysis";

/**
 * Same job as saveAnalysis() in history.ts, but for the webhook path: there's
 * no signed-in request to read a user from, so the caller (which already
 * resolved the user via connected_channels) passes the user id directly, and
 * this writes with the service role rather than an RLS-scoped client.
 */
export async function saveChannelAnalysis(userId: string, result: AnalysisResult): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createServiceClient();

  const { data: analysis, error } = await supabase
    .from("scam_analyses")
    .insert({
      user_id: userId,
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
    console.error("Failed to save channel analysis:", error?.message);
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
