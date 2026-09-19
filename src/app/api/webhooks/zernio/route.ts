import { NextResponse } from "next/server";
import { verifyZernioSignature } from "@/lib/zernio/webhook";
import { processInboundMessage } from "@/lib/zernio/pipeline";
import type { ZernioMessageReceivedPayload, ZernioWebhookEnvelope } from "@/lib/zernio/types";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-zernio-signature");

  if (!verifyZernioSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: ZernioWebhookEnvelope;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (payload.event !== "message.received") {
    // Acknowledge every other event type we don't act on yet (account.connected, etc.)
    // so Zernio doesn't retry them as failures.
    return NextResponse.json({ received: true, handled: false });
  }

  try {
    const result = await processInboundMessage(payload as unknown as ZernioMessageReceivedPayload);
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    console.error("Zernio webhook processing error:", err);
    // Still 200 — Zernio would otherwise retry a message our own bug already
    // failed on, potentially double-replying once the bug is fixed.
    return NextResponse.json({ received: true, error: "processing_failed" });
  }
}
