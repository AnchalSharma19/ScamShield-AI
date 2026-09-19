import { analyzeText, analyzeImage } from "@/lib/scam/pipeline";
import { findUserByChannelAccount } from "@/lib/supabase/channels";
import { saveChannelAnalysis } from "@/lib/supabase/channelAnalysis";
import { claimChannelMessage, finalizeChannelMessage } from "@/lib/supabase/channelMessages";
import type { AnalysisResult, InputType } from "@/types/analysis";

/** Risk levels at or above this trigger an automated bot reply in the chat. Below it, the bot stays silent rather than commenting on every message. */
const ALERT_THRESHOLD: Record<AnalysisResult["risk_level"], boolean> = {
  LOW: false,
  MEDIUM: true,
  HIGH: true,
  CRITICAL: true,
};

export function inputTypeForPlatform(platform: string): InputType {
  if (platform === "whatsapp") return "whatsapp";
  if (platform === "sms") return "sms";
  return "social_media"; // instagram, facebook, telegram, slack, discord
}

/**
 * Builds the auto-reply text sent into the conversation for MEDIUM+ risk
 * messages. Leads with the AI's own contextual explanation (why THIS message
 * is risky, e.g. "asks you to share an OTP and creates urgency") rather than
 * a raw dump of red-flag labels, so it reads like an agent that understood
 * the message instead of a rules engine listing matches.
 */
export function buildAlertMessage(result: AnalysisResult): string {
  const emoji = result.risk_level === "CRITICAL" ? "🚨" : "⚠️";
  const header = `${emoji} ScamShield flagged this as ${result.risk_level} risk (${result.risk_score}/100) — ${result.category}.`;

  const reason = result.summary.trim() || result.red_flags.slice(0, 2).join(" ");
  const topActions = result.recommended_actions.slice(0, 2);

  const lines = [header];
  if (reason) lines.push(reason);
  if (topActions.length > 0) lines.push(topActions.join(" "));

  return lines.join("\n");
}

export interface ChannelMessageInput {
  /** The provider's own id for this message (Zernio message id, "channel:ts" for Slack, the Discord message snowflake) — the idempotency key, scoped per-platform. */
  externalMessageId: string;
  /** The id shown by the provider's own conversation-history view, for joining risk data onto that view later (may equal externalMessageId). */
  platformMessageId: string;
  platform: string;
  conversationId: string;
  /** The provider_account_id used to resolve which ScamShield user owns this channel. */
  accountId: string;
  text: string | null;
  imageUrl?: string | null;
  downloadImage?: (url: string) => Promise<Buffer>;
  sendReply: (text: string) => Promise<void>;
}

export interface ChannelProcessResult {
  skipped: boolean;
  reason?: string;
  analysisId?: string | null;
  replied?: boolean;
}

/**
 * Handles one inbound channel message end-to-end, shared by every connected
 * platform (Zernio-backed and direct): resolve which ScamShield user owns
 * the account, claim the message for idempotency, analyze it (text or the
 * first image attachment), save it to history, and reply in the same thread
 * if the risk level clears the alert threshold.
 */
export async function handleInboundChannelMessage(input: ChannelMessageInput): Promise<ChannelProcessResult> {
  const owner = await findUserByChannelAccount(input.platform, input.accountId);
  if (!owner) {
    return { skipped: true, reason: "unrecognized_account" };
  }

  const claim = await claimChannelMessage({
    externalMessageId: input.externalMessageId,
    platformMessageId: input.platformMessageId,
    userId: owner.userId,
    platform: input.platform,
    conversationId: input.conversationId,
    accountId: input.accountId,
  });
  if (!claim.claimed) {
    return { skipped: true, reason: "already_processed" };
  }

  const inputType = inputTypeForPlatform(input.platform);

  let result: AnalysisResult | null = null;
  if (input.text && input.text.trim().length > 0) {
    result = await analyzeText(input.text, inputType);
  } else if (input.imageUrl && input.downloadImage) {
    const buffer = await input.downloadImage(input.imageUrl);
    result = await analyzeImage(buffer, inputType);
  }

  if (!result) {
    await finalizeChannelMessage(claim.id, { analysisId: null, replied: false });
    return { skipped: true, reason: "nothing_to_analyze" };
  }

  const analysisId = await saveChannelAnalysis(owner.userId, result);

  let replied = false;
  if (ALERT_THRESHOLD[result.risk_level]) {
    try {
      await input.sendReply(buildAlertMessage(result));
      replied = true;
    } catch (err) {
      console.error(`Failed to send ${input.platform} alert reply:`, err);
    }
  }

  await finalizeChannelMessage(claim.id, { analysisId, replied });

  return { skipped: false, analysisId, replied };
}
