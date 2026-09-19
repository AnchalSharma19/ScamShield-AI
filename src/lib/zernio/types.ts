/** Platforms Zernio can deliver inbound messages for (per their message.received webhook schema). Snapchat has no messaging API on any provider, so it's intentionally excluded. */
export type ZernioMessagePlatform = "instagram" | "facebook" | "telegram" | "whatsapp" | "sms";

/** Platforms connectable via the OAuth redirect flow (GET /v1/connect/{platform}, returns an authUrl). Telegram is deliberately excluded — it uses a separate access-code flow (GET/PATCH /v1/connect/telegram), not a redirect. SMS numbers are provisioned separately, not "connected" at all. */
export type ZernioConnectPlatform = "instagram" | "facebook" | "whatsapp";

export interface ZernioAttachment {
  type: "image" | "video" | "audio" | "file" | "sticker" | "share";
  url: string;
  payload?: Record<string, unknown>;
}

export interface ZernioMessageSender {
  id: string;
  contactId?: string;
  name?: string;
  username?: string;
  picture?: string;
  phoneNumber?: string | null;
  businessScopedUserId?: string;
}

export interface ZernioInboxMessage {
  id: string;
  conversationId: string;
  platform: ZernioMessagePlatform;
  platformMessageId: string;
  direction: "incoming" | "outgoing";
  text: string | null;
  attachments: ZernioAttachment[];
  sender: ZernioMessageSender;
  sentAt: string;
  isRead: boolean;
}

export interface ZernioInboxConversation {
  id: string;
  platformConversationId: string;
  participantId?: string;
  participantName?: string;
  participantUsername?: string;
  status: "active" | "archived";
}

export interface ZernioInboxAccount {
  id: string;
  accountId: string;
  profileId?: string;
  platform: string;
  username: string;
  displayName?: string;
}

export interface ZernioMessageReceivedPayload {
  id: string;
  event: "message.received";
  message: ZernioInboxMessage;
  conversation: ZernioInboxConversation;
  account: ZernioInboxAccount;
  metadata?: Record<string, unknown> | null;
  timestamp: string;
}

export interface ZernioWebhookEnvelope {
  id: string;
  event: string;
  timestamp: string;
  [key: string]: unknown;
}
