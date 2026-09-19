import { NextResponse, after } from "next/server";
import { verifySlackSignature } from "@/lib/slack/webhook";
import { getChannelToken } from "@/lib/supabase/channelCredentials";
import { postMessage } from "@/lib/slack/client";
import { handleInboundChannelMessage } from "@/lib/channels/pipeline";

interface SlackEventCallback {
  type: "event_callback";
  team_id: string;
  event: {
    type: string;
    channel_type?: string;
    channel: string;
    user?: string;
    text?: string;
    ts: string;
    bot_id?: string;
    subtype?: string;
  };
}

interface SlackUrlVerification {
  type: "url_verification";
  challenge: string;
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  // Slack's one-time Events API setup handshake — must be answered before
  // any signature-dependent logic touches the DB (it does carry a valid
  // signature too, but there's nothing to verify ownership of yet).
  let parsed: SlackUrlVerification | SlackEventCallback;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (parsed.type === "url_verification") {
    return new NextResponse(parsed.challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  const signature = request.headers.get("x-slack-signature");
  const timestamp = request.headers.get("x-slack-request-timestamp");
  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (parsed.type !== "event_callback") {
    return NextResponse.json({ received: true, handled: false });
  }

  const { event, team_id } = parsed;

  // Only plain inbound DMs — skip anything that isn't a fresh message.im
  // event (message_changed/message_deleted/bot_message etc.), and skip the
  // bot's own messages, since without this the bot's own alert reply would
  // trigger another event and loop-reply to itself.
  if (event.type !== "message" || event.channel_type !== "im" || event.bot_id || event.subtype || !event.user) {
    return NextResponse.json({ received: true, handled: false });
  }

  const accountId = `${team_id}:${event.user}`;
  const externalMessageId = `${event.channel}:${event.ts}`;

  // Ack immediately — Slack retries aggressively (~3s) if it doesn't get a
  // fast 200, and the analyze pipeline (Gemini + RAG) routinely takes
  // longer than that. Running the slow work in after() keeps the function
  // alive past the response without new queue infrastructure. The
  // claim-based idempotency in handleInboundChannelMessage is a second,
  // independent guard against any retry that still slips through.
  after(async () => {
    try {
      await handleInboundChannelMessage({
        externalMessageId,
        platformMessageId: externalMessageId,
        platform: "slack",
        conversationId: event.channel,
        accountId,
        text: event.text ?? null,
        sendReply: async (text) => {
          const token = await getChannelToken("slack", accountId);
          if (!token) throw new Error("No stored Slack bot token for this account");
          await postMessage(token, event.channel, text);
        },
      });
    } catch (err) {
      console.error("Slack webhook processing error:", err);
    }
  });

  return NextResponse.json({ received: true });
}
