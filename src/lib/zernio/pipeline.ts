import { sendInboxMessage, fetchWhatsAppMedia } from "./client";
import { handleInboundChannelMessage, type ChannelProcessResult } from "@/lib/channels/pipeline";
import type { ZernioMessageReceivedPayload } from "./types";

async function downloadAttachment(platform: string, url: string): Promise<Buffer> {
  if (platform === "whatsapp") {
    // WhatsApp attachment URLs point at Zernio's own authenticated media endpoint
    // (GET /v1/whatsapp/media/{mediaId}), not a fetchable URL directly.
    const mediaId = url.split("/").pop();
    if (!mediaId) throw new Error("Could not parse WhatsApp media id from attachment URL");
    return fetchWhatsAppMedia(mediaId);
  }

  // Instagram/Facebook/Telegram attachment URLs are direct, unauthenticated CDN links.
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download attachment: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export type ProcessResult = ChannelProcessResult;

/**
 * Handles one message.received webhook event end-to-end via the shared
 * cross-platform pipeline, supplying Zernio-specific plumbing: WhatsApp's
 * authenticated media download, and replying through sendInboxMessage.
 */
export async function processInboundMessage(payload: ZernioMessageReceivedPayload): Promise<ProcessResult> {
  const { message, conversation, account } = payload;

  if (message.direction !== "incoming") {
    return { skipped: true, reason: "not_incoming" };
  }

  const imageAttachment = message.attachments.find((a) => a.type === "image");

  return handleInboundChannelMessage({
    externalMessageId: message.id,
    platformMessageId: message.platformMessageId,
    platform: message.platform,
    conversationId: conversation.id,
    accountId: account.accountId,
    text: message.text,
    imageUrl: imageAttachment?.url ?? null,
    downloadImage: (url) => downloadAttachment(message.platform, url),
    sendReply: async (text) => {
      await sendInboxMessage(conversation.id, { accountId: account.accountId, message: text });
    },
  });
}
