const DISCORD_API_BASE = "https://discord.com/api/v10";

function getBotToken(): string {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not set");
  return token;
}

/**
 * Plain REST calls against Discord's HTTP API (not the Gateway) — usable
 * from ordinary Next.js API routes, unlike discord.js's Client, which needs
 * a persistent websocket connection and is confined to scripts/discord-bot.ts.
 * Sending/reading message history doesn't need the Gateway at all.
 */
async function discordFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${DISCORD_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${getBotToken()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Discord API error ${response.status} on ${path}: ${errText.slice(0, 300)}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export interface DiscordMessage {
  id: string;
  content: string;
  author: { id: string; username: string; bot?: boolean };
  timestamp: string;
}

/** Fetches recent messages in a DM channel, newest first (Discord's default ordering). */
export async function listDiscordMessages(channelId: string, opts: { limit?: number } = {}): Promise<DiscordMessage[]> {
  const params = new URLSearchParams({ limit: String(opts.limit ?? 50) });
  return discordFetch<DiscordMessage[]>(`/channels/${channelId}/messages?${params.toString()}`);
}

export async function sendDiscordMessage(channelId: string, content: string): Promise<DiscordMessage> {
  return discordFetch<DiscordMessage>(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}
