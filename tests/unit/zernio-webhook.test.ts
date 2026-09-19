import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import { verifyZernioSignature } from "@/lib/zernio/webhook";

const SECRET = "test-webhook-secret";
const originalSecret = process.env.ZERNIO_WEBHOOK_SECRET;

function signHex(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function signBase64(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body).digest("base64");
}

describe("verifyZernioSignature", () => {
  beforeEach(() => {
    process.env.ZERNIO_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    process.env.ZERNIO_WEBHOOK_SECRET = originalSecret;
  });

  it("accepts a correctly signed body in hex encoding", () => {
    const body = JSON.stringify({ event: "message.received" });
    expect(verifyZernioSignature(body, signHex(body))).toBe(true);
  });

  it("accepts a correctly signed body in base64 encoding", () => {
    const body = JSON.stringify({ event: "message.received" });
    expect(verifyZernioSignature(body, signBase64(body))).toBe(true);
  });

  it("accepts a hex signature with a sha256= prefix", () => {
    const body = JSON.stringify({ event: "message.received" });
    expect(verifyZernioSignature(body, `sha256=${signHex(body)}`)).toBe(true);
  });

  it("rejects a body signed with the wrong secret", () => {
    const body = JSON.stringify({ event: "message.received" });
    expect(verifyZernioSignature(body, signHex(body, "wrong-secret"))).toBe(false);
  });

  it("rejects a tampered body that no longer matches its signature", () => {
    const body = JSON.stringify({ event: "message.received" });
    const signature = signHex(body);
    const tampered = JSON.stringify({ event: "message.received", extra: "injected" });
    expect(verifyZernioSignature(tampered, signature)).toBe(false);
  });

  it("rejects when no signature header is present", () => {
    const body = JSON.stringify({ event: "message.received" });
    expect(verifyZernioSignature(body, null)).toBe(false);
  });

  it("rejects garbage that isn't valid hex or base64-decodable to 32 bytes", () => {
    const body = JSON.stringify({ event: "message.received" });
    expect(verifyZernioSignature(body, "not-a-real-signature")).toBe(false);
  });

  it("rejects when the webhook secret isn't configured", () => {
    delete process.env.ZERNIO_WEBHOOK_SECRET;
    const body = JSON.stringify({ event: "message.received" });
    expect(verifyZernioSignature(body, signHex(body))).toBe(false);
  });
});
