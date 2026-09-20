import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getChannelTokenById } from "@/lib/supabase/channelCredentials";
import { listSlackMessages, postMessage as postSlackMessage } from "@/lib/slack/client";
import { listDiscordMessages, sendDiscordMessage } from "@/lib/discord/rest";
import { getRiskInfoForMessages, getConversationRiskTimeline } from "@/lib/supabase/channelMessages";
import { computeConversationRisk } from "@/lib/scam/conversationRisk";

interface ConnectedRow {
  id: string;
  platform: string;
  provider_account_id: string;
  channel_id: string | null;
}

async function loadOwnedChannel(userId: string, id: string): Promise<ConnectedRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("connected_channels")
    .select("id, platform, provider_account_id, channel_id")
    .eq("id", id)
    .eq("user_id", userId)
    .in("platform", ["slack", "discord"])
    .maybeSingle();

  if (!data || !data.channel_id) {
    // Diagnostic only: distinguishes "no row at all" (id mismatch / not this
    // user's row) from "row exists but channel_id was never set" (a bug in
    // the connect flow), instead of a bare 403 with no lead.
    console.error("[channels messages] ownership check failed", JSON.stringify({ userId, requestedId: id, foundRow: data ?? null }));
  }

  return data;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const channel = await loadOwnedChannel(user.id, id);
  if (!channel || !channel.channel_id) {
    return NextResponse.json({ error: "Not your channel" }, { status: 403 });
  }

  try {
    let messages: { id: string; message: string; senderName: string | null; direction: "incoming" | "outgoing"; createdAt: string }[];
    let platformMessageIds: string[];

    if (channel.platform === "slack") {
      const token = await getChannelTokenById(channel.id);
      if (!token) return NextResponse.json({ error: "Missing Slack credential" }, { status: 500 });
      const history = await listSlackMessages(token, channel.channel_id, { limit: 50 });
      platformMessageIds = history.map((m) => `${channel.channel_id}:${m.ts}`);
      messages = history
        .slice()
        .reverse()
        .map((m) => ({
          id: m.ts,
          message: m.text ?? "",
          senderName: null,
          direction: (m.bot_id ? "outgoing" : "incoming") as "incoming" | "outgoing",
          createdAt: new Date(Number(m.ts) * 1000).toISOString(),
        }));
    } else {
      const history = await listDiscordMessages(channel.channel_id, { limit: 50 });
      platformMessageIds = history.map((m) => m.id);
      messages = history
        .slice()
        .reverse()
        .map((m) => ({
          id: m.id,
          message: m.content ?? "",
          senderName: null,
          direction: (m.author.bot ? "outgoing" : "incoming") as "incoming" | "outgoing",
          createdAt: m.timestamp,
        }));
    }

    const riskInfo = await getRiskInfoForMessages(platformMessageIds);
    const riskById = new Map(riskInfo.map((r) => [r.platformMessageId, r]));
    const withRisk = messages.map((m, i) => {
      const risk = riskById.get(platformMessageIds[i]);
      return { ...m, risk: risk ? { riskScore: risk.riskScore, riskLevel: risk.riskLevel, category: risk.category } : null };
    });

    const timeline = await getConversationRiskTimeline(channel.channel_id, channel.platform);
    const conversationRisk = computeConversationRisk(timeline);

    return NextResponse.json({ messages: withRisk, conversationRisk, pagination: { hasMore: false, nextCursor: null } });
  } catch (err) {
    console.error("Failed to load conversation messages:", err);
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
  }
}

const SendMessageSchema = z.object({
  message: z.string().trim().min(1).max(4000),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const channel = await loadOwnedChannel(user.id, id);
  if (!channel || !channel.channel_id) {
    return NextResponse.json({ error: "Not your channel" }, { status: 403 });
  }

  try {
    if (channel.platform === "slack") {
      const token = await getChannelTokenById(channel.id);
      if (!token) return NextResponse.json({ error: "Missing Slack credential" }, { status: 500 });
      const { ts } = await postSlackMessage(token, channel.channel_id, parsed.data.message);
      return NextResponse.json({ id: ts });
    }

    const sent = await sendDiscordMessage(channel.channel_id, parsed.data.message);
    return NextResponse.json({ id: sent.id });
  } catch (err) {
    console.error("Failed to send message:", err);
    const message = err instanceof Error ? err.message : "Failed to send message";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
