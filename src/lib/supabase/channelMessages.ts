import { createServiceClient } from "./server";
import { isSupabaseConfigured } from "./history";

const UNIQUE_VIOLATION = "23505";

export interface ClaimChannelMessageInput {
  externalMessageId: string;
  platformMessageId: string;
  userId: string;
  platform: string;
  conversationId: string;
  accountId: string;
}

export type ClaimChannelMessageResult = { claimed: true; id: string } | { claimed: false };

/**
 * Inserts a placeholder row for an inbound message *before* the slow
 * analyze step runs, keyed on the provider-scoped unique constraint
 * (platform, external_message_id). A redelivered/retried webhook or a
 * Gateway RESUME replay hits the unique-violation branch instead of racing
 * a duplicate analysis + duplicate alert reply — the check-then-insert
 * pattern this replaces left a real gap between "not yet processed" and
 * "recorded as processed" for that to happen in.
 */
export async function claimChannelMessage(input: ClaimChannelMessageInput): Promise<ClaimChannelMessageResult> {
  if (!isSupabaseConfigured()) return { claimed: true, id: "unclaimed" };

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("channel_messages")
    .insert({
      external_message_id: input.externalMessageId,
      platform_message_id: input.platformMessageId,
      user_id: input.userId,
      platform: input.platform,
      conversation_id: input.conversationId,
      account_id: input.accountId,
      analysis_id: null,
      replied: false,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { claimed: false };
    console.error("Failed to claim channel message:", error.message);
    return { claimed: false };
  }

  return { claimed: true, id: data.id as string };
}

export interface FinalizeChannelMessageInput {
  analysisId: string | null;
  replied: boolean;
}

export async function finalizeChannelMessage(id: string, input: FinalizeChannelMessageInput): Promise<void> {
  if (!isSupabaseConfigured() || id === "unclaimed") return;

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("channel_messages")
    .update({ analysis_id: input.analysisId, replied: input.replied })
    .eq("id", id);

  if (error) console.error("Failed to finalize channel message:", error.message);
}

export interface ChannelMessageRiskInfo {
  platformMessageId: string;
  riskScore: number;
  riskLevel: string;
  category: string;
}

/** Looks up risk info for a batch of messages (by their platform message id) shown in a conversation thread, to overlay a risk badge on flagged ones. */
export async function getRiskInfoForMessages(platformMessageIds: string[]): Promise<ChannelMessageRiskInfo[]> {
  if (!isSupabaseConfigured() || platformMessageIds.length === 0) return [];

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("channel_messages")
    .select("platform_message_id, scam_analyses(risk_score, risk_level, scam_category)")
    .in("platform_message_id", platformMessageIds)
    .not("analysis_id", "is", null);

  if (error || !data) return [];

  return data
    .filter((row) => row.scam_analyses)
    .map((row) => {
      const analysis = row.scam_analyses as unknown as { risk_score: number; risk_level: string; scam_category: string };
      return {
        platformMessageId: row.platform_message_id as string,
        riskScore: analysis.risk_score,
        riskLevel: analysis.risk_level,
        category: analysis.scam_category,
      };
    });
}

export interface ConversationRiskTimelinePoint {
  analyzedAt: string;
  riskScore: number;
  riskLevel: string;
  category: string;
}

/**
 * Full ordered risk history for one conversation (every analyzed inbound
 * message, oldest first) — the input to the conversation-level risk score
 * and escalation detection, since a scam's trajectory across messages can
 * reveal what no single message's score does on its own.
 */
export async function getConversationRiskTimeline(conversationId: string, platform?: string): Promise<ConversationRiskTimelinePoint[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = createServiceClient();
  let query = supabase
    .from("channel_messages")
    .select("processed_at, scam_analyses(risk_score, risk_level, scam_category)")
    .eq("conversation_id", conversationId)
    .not("analysis_id", "is", null)
    .order("processed_at", { ascending: true });

  if (platform) query = query.eq("platform", platform);

  const { data, error } = await query;
  if (error || !data) return [];

  return data
    .filter((row) => row.scam_analyses)
    .map((row) => {
      const analysis = row.scam_analyses as unknown as { risk_score: number; risk_level: string; scam_category: string };
      return {
        analyzedAt: row.processed_at as string,
        riskScore: analysis.risk_score,
        riskLevel: analysis.risk_level,
        category: analysis.scam_category,
      };
    });
}
