import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getChannelTokenById } from "@/lib/supabase/channelCredentials";
import { listSlackMessages, getUserDisplayName } from "@/lib/slack/client";
import { listDiscordMessages } from "@/lib/discord/rest";

interface ConnectedRow {
  id: string;
  platform: string;
  provider_account_id: string;
  channel_id: string | null;
  username: string | null;
  display_name: string | null;
  connected_at: string;
}

async function buildSlackConversation(row: ConnectedRow) {
  const token = await getChannelTokenById(row.id);
  const slackUserId = row.provider_account_id.split(":")[1];

  let lastMessage = "";
  let updatedTime = row.connected_at;
  let participantName = row.username ?? "Slack user";

  if (token && row.channel_id) {
    try {
      const [messages, displayName] = await Promise.all([
        listSlackMessages(token, row.channel_id, { limit: 1 }),
        getUserDisplayName(token, slackUserId),
      ]);
      if (messages[0]) {
        lastMessage = messages[0].text ?? "";
        updatedTime = new Date(Number(messages[0].ts) * 1000).toISOString();
      }
      if (displayName) participantName = displayName;
    } catch (err) {
      console.error("Failed to preview Slack conversation:", err);
      lastMessage = "Unable to load messages";
    }
  }

  return {
    id: row.id,
    platform: "slack",
    accountId: row.provider_account_id,
    accountUsername: row.display_name ?? "Slack",
    participantName,
    participantPicture: null,
    lastMessage,
    updatedTime,
    status: "active" as const,
    unreadCount: null,
  };
}

async function buildDiscordConversation(row: ConnectedRow) {
  let lastMessage = "";
  let updatedTime = row.connected_at;

  if (row.channel_id) {
    try {
      const messages = await listDiscordMessages(row.channel_id, { limit: 1 });
      if (messages[0]) {
        lastMessage = messages[0].content ?? "";
        updatedTime = messages[0].timestamp;
      }
    } catch (err) {
      console.error("Failed to preview Discord conversation:", err);
      lastMessage = "Unable to load messages";
    }
  }

  return {
    id: row.id,
    platform: "discord",
    accountId: row.provider_account_id,
    accountUsername: "Discord",
    participantName: row.username ?? row.display_name ?? "Discord user",
    participantPicture: null,
    lastMessage,
    updatedTime,
    status: "active" as const,
    unreadCount: null,
  };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ data: [] });

  const { data: rows, error } = await supabase
    .from("connected_channels")
    .select("id, platform, provider_account_id, channel_id, username, display_name, connected_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("platform", ["slack", "discord"]);

  if (error) {
    console.error("Failed to list Slack/Discord channels:", error.message);
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
  }

  const conversations = await Promise.all(
    (rows ?? []).map((row) => (row.platform === "slack" ? buildSlackConversation(row) : buildDiscordConversation(row)))
  );

  return NextResponse.json({ data: conversations, pagination: { hasMore: false, nextCursor: null } });
}
