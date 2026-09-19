const SLACK_API_BASE = "https://slack.com/api";

export class SlackApiError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "SlackApiError";
  }
}

/**
 * Slack's Web API always replies 200 with an `{ok: boolean, error?: string}`
 * envelope, even on failure — HTTP status alone doesn't tell you the call
 * failed, so every caller must check `ok` explicitly.
 */
async function slackFetch<T extends Record<string, unknown>>(path: string, token: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${SLACK_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as T & { ok: boolean; error?: string };
  if (!data.ok) {
    throw new SlackApiError(data.error ?? "unknown_error", `Slack API error on ${path}: ${data.error}`);
  }
  return data;
}

export interface SlackOAuthResult {
  teamId: string;
  teamName: string;
  botToken: string;
  botUserId: string;
  authedUserId: string;
}

/** Exchanges the OAuth `code` from the redirect callback for a bot token, scoped to the installing workspace. */
export async function exchangeOAuthCode(code: string, redirectUri: string): Promise<SlackOAuthResult> {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("SLACK_CLIENT_ID / SLACK_CLIENT_SECRET are not set");

  const response = await fetch(`${SLACK_API_BASE}/oauth.v2.access`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
  });

  const data = (await response.json()) as {
    ok: boolean;
    error?: string;
    access_token?: string;
    bot_user_id?: string;
    team?: { id: string; name: string };
    authed_user?: { id: string };
  };

  if (!data.ok || !data.access_token || !data.team || !data.authed_user) {
    throw new SlackApiError(data.error ?? "unknown_error", `Slack OAuth exchange failed: ${data.error}`);
  }

  return {
    teamId: data.team.id,
    teamName: data.team.name,
    botToken: data.access_token,
    botUserId: data.bot_user_id ?? "",
    authedUserId: data.authed_user.id,
  };
}

/** Opens (or fetches the existing) DM channel between the bot and a given Slack user — returns its channel id. */
export async function openDirectMessage(token: string, userId: string): Promise<string> {
  const { channel } = await slackFetch<{ channel: { id: string } }>("/conversations.open", token, { users: userId });
  return channel.id;
}

/** Sends a message into a channel/DM as the bot. */
export async function postMessage(token: string, channel: string, text: string): Promise<{ ts: string }> {
  const { ts } = await slackFetch<{ ts: string }>("/chat.postMessage", token, { channel, text });
  return { ts };
}

export interface SlackHistoryMessage {
  ts: string;
  text: string;
  user?: string;
  bot_id?: string;
}

/** Fetches recent messages in a DM channel, newest first (matches Slack's own default ordering). */
export async function listSlackMessages(token: string, channel: string, opts: { limit?: number } = {}): Promise<SlackHistoryMessage[]> {
  const { messages } = await slackFetch<{ messages: SlackHistoryMessage[] }>("/conversations.history", token, {
    channel,
    limit: opts.limit ?? 50,
  });
  return messages;
}

/** Looks up a Slack user's display name, for the inbox UI's participant label. */
export async function getUserDisplayName(token: string, userId: string): Promise<string | null> {
  try {
    const { user } = await slackFetch<{ user: { real_name?: string; name?: string } }>("/users.info", token, { user: userId });
    return user.real_name ?? user.name ?? null;
  } catch {
    return null;
  }
}
