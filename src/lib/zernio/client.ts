import type { ZernioConnectPlatform } from "./types";

const ZERNIO_BASE_URL = process.env.ZERNIO_BASE_URL || "https://zernio.com/api";

function getApiKey(): string {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) {
    throw new Error("ZERNIO_API_KEY is not set. Add it to .env.local (server-side only).");
  }
  return apiKey;
}

export class ZernioApiError extends Error {
  constructor(
    public status: number,
    public code: string | undefined,
    public details: Record<string, unknown> | undefined,
    message: string
  ) {
    super(message);
    this.name = "ZernioApiError";
  }
}

async function zernioFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${ZERNIO_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    let parsed: { code?: string; error?: string; details?: Record<string, unknown> } = {};
    try {
      parsed = JSON.parse(errText);
    } catch {
      // non-JSON error body — fall through with parsed left empty
    }
    throw new ZernioApiError(
      response.status,
      parsed.code,
      parsed.details,
      `Zernio API error ${response.status} on ${path}: ${errText.slice(0, 300)}`
    );
  }

  return response.json() as Promise<T>;
}

export interface ZernioProfile {
  _id: string;
  name: string;
  color?: string;
  isDefault?: boolean;
}

/** Creates a Zernio "profile" (workspace) — one per ScamShield user, so their connected channels are isolated from everyone else's. */
export async function createProfile(name: string): Promise<ZernioProfile> {
  const { profile } = await zernioFetch<{ message: string; profile: ZernioProfile }>("/v1/profiles", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return profile;
}

export interface ZernioConnectUrlResult {
  authUrl: string;
  state: string;
}

/** Starts the OAuth connect flow for a platform, returning the URL to redirect the user's browser to. */
export async function getConnectUrl(
  platform: ZernioConnectPlatform,
  profileId: string,
  redirectUrl: string
): Promise<ZernioConnectUrlResult> {
  const params = new URLSearchParams({ profileId, redirect_url: redirectUrl });
  return zernioFetch<ZernioConnectUrlResult>(`/v1/connect/${platform}?${params.toString()}`);
}

export interface TelegramConnectCode {
  code: string;
  expiresAt: string;
  expiresIn: number;
  botUsername: string;
  instructions: string[];
}

/** Generates a Telegram access code (valid 15 min) — the user adds the named bot as admin and sends this code, there's no OAuth redirect for this platform. */
export async function getTelegramConnectCode(profileId: string): Promise<TelegramConnectCode> {
  const params = new URLSearchParams({ profileId });
  return zernioFetch<TelegramConnectCode>(`/v1/connect/telegram?${params.toString()}`);
}

export type TelegramConnectStatus =
  | { status: "pending"; expiresAt: string; expiresIn: number }
  | { status: "connected"; chatId: string; chatTitle: string; chatType: string; account: { _id: string; platform: string; username: string; displayName: string } }
  | { status: "expired"; message: string };

/** Polls whether a Telegram access code has been used yet — recommended interval is 3s. */
export async function checkTelegramConnectStatus(code: string): Promise<TelegramConnectStatus> {
  const params = new URLSearchParams({ code });
  return zernioFetch<TelegramConnectStatus>(`/v1/connect/telegram?${params.toString()}`, { method: "PATCH" });
}

/** Disconnects a connected social account on Zernio's side (not just in our own DB). */
export async function disconnectAccount(accountId: string): Promise<void> {
  await zernioFetch(`/v1/accounts/${accountId}`, { method: "DELETE" });
}

export interface ZernioProvisionedNumber {
  _id: string;
  phoneNumber: string;
  status: string;
  profileId: unknown;
}

export interface ZernioConnectedWhatsAppNumber {
  accountId: string;
  phoneNumber: string | null;
  displayName: string | null;
  profileId: string | null;
}

export interface ZernioPhoneNumbersResult {
  numbers: ZernioProvisionedNumber[];
  connected: ZernioConnectedWhatsAppNumber[];
}

/** Lists phone numbers already provisioned/connected under a profile. Buying a new number is done in the Zernio dashboard, not here — that flow involves carrier KYC and is out of scope for this app. */
export async function listPhoneNumbers(profileId: string): Promise<ZernioPhoneNumbersResult> {
  const params = new URLSearchParams({ profileId, status: "active" });
  return zernioFetch<ZernioPhoneNumbersResult>(`/v1/phone-numbers?${params.toString()}`);
}

export interface ZernioConversation {
  id: string;
  platform: string;
  accountId: string;
  accountUsername: string;
  participantId: string;
  participantName: string;
  participantPicture: string | null;
  lastMessage: string;
  updatedTime: string;
  status: "active" | "archived";
  unreadCount: number | null;
  url: string | null;
}

export interface ListConversationsResult {
  data: ZernioConversation[];
  pagination: { hasMore: boolean; nextCursor: string | null };
}

/** Lists DM conversations across all of a profile's connected accounts, aggregated and deduplicated by Zernio. SMS isn't included — it has no unified conversation view on this endpoint. */
export async function listConversations(
  profileId: string,
  opts: { cursor?: string; limit?: number } = {}
): Promise<ListConversationsResult> {
  const params = new URLSearchParams({ profileId, sortOrder: "desc" });
  if (opts.cursor) params.set("cursor", opts.cursor);
  if (opts.limit) params.set("limit", String(opts.limit));
  return zernioFetch<ListConversationsResult>(`/v1/inbox/conversations?${params.toString()}`);
}

export interface ZernioConversationMessage {
  id: string; // wamid/mid/etc — matches platformMessageId from the webhook, NOT the internal message.id
  conversationId: string;
  accountId: string;
  platform: string;
  message: string;
  senderId: string;
  senderName: string | null;
  direction: "incoming" | "outgoing";
  createdAt: string;
  attachments: { id: string; type: string; url: string }[];
}

export interface ListMessagesResult {
  messages: ZernioConversationMessage[];
  pagination: { hasMore: boolean; nextCursor: string | null };
}

/** Fetches the message thread for one conversation, oldest first (chat order). */
export async function getConversationMessages(
  conversationId: string,
  accountId: string,
  opts: { cursor?: string; limit?: number } = {}
): Promise<ListMessagesResult> {
  const params = new URLSearchParams({ accountId, sortOrder: "asc" });
  if (opts.cursor) params.set("cursor", opts.cursor);
  if (opts.limit) params.set("limit", String(opts.limit));
  return zernioFetch<ListMessagesResult>(`/v1/inbox/conversations/${conversationId}/messages?${params.toString()}`);
}

export interface SendInboxMessageInput {
  accountId: string;
  message: string;
  attachmentUrl?: string;
  attachmentType?: "image" | "video" | "audio" | "file";
}

/** Replies into an existing conversation — used for the bot's risk-alert reply, regardless of platform (WhatsApp, Instagram, Facebook, Telegram, SMS all go through this one endpoint). */
export async function sendInboxMessage(conversationId: string, input: SendInboxMessageInput): Promise<{ id: string }> {
  return zernioFetch<{ id: string }>(`/v1/inbox/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * Downloads an inbound WhatsApp media attachment. WhatsApp media URLs are Zernio's
 * own authenticated endpoint (unlike Instagram/Facebook/Telegram, whose attachment
 * URLs are direct CDN links needing no auth) — this must only be used for those.
 */
export async function fetchWhatsAppMedia(mediaId: string): Promise<Buffer> {
  const response = await fetch(`${ZERNIO_BASE_URL}/v1/whatsapp/media/${mediaId}`, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch WhatsApp media ${mediaId}: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}
