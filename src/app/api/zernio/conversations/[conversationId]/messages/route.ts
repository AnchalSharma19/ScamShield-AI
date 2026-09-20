import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getConversationMessages, sendInboxMessage } from "@/lib/zernio/client";
import { getRiskInfoForMessages, getConversationRiskTimeline } from "@/lib/supabase/channelMessages";
import { computeConversationRisk } from "@/lib/scam/conversationRisk";
import { requireOwnedZernioAccount } from "@/lib/supabase/channels";

export async function GET(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");
  const cursor = searchParams.get("cursor") ?? undefined;

  if (!accountId) {
    return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  if (!(await requireOwnedZernioAccount(supabase, user.id, accountId))) {
    return NextResponse.json({ error: "Not your channel" }, { status: 403 });
  }

  try {
    const result = await getConversationMessages(conversationId, accountId, { cursor });
    const riskInfo = await getRiskInfoForMessages(result.messages.map((m) => m.id));
    const riskById = new Map(riskInfo.map((r) => [r.platformMessageId, r]));

    const messages = result.messages.map((m) => ({ ...m, risk: riskById.get(m.id) ?? null }));

    const timeline = await getConversationRiskTimeline(conversationId);
    const conversationRisk = computeConversationRisk(timeline);

    return NextResponse.json({ ...result, messages, conversationRisk });
  } catch (err) {
    console.error("Failed to load conversation messages:", err);
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
  }
}

const SendMessageSchema = z.object({
  accountId: z.string().min(1),
  message: z.string().trim().min(1).max(4000),
});

export async function POST(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;

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

  if (!(await requireOwnedZernioAccount(supabase, user.id, parsed.data.accountId))) {
    return NextResponse.json({ error: "Not your channel" }, { status: 403 });
  }

  try {
    const result = await sendInboxMessage(conversationId, {
      accountId: parsed.data.accountId,
      message: parsed.data.message,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to send message:", err);
    const message = err instanceof Error ? err.message : "Failed to send message";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
