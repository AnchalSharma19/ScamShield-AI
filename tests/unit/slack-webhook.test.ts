import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import { verifySlackSignature } from "@/lib/slack/webhook";

const SECRET = "test-signing-secret";
const originalSecret = process.env.SLACK_SIGNING_SECRET;

function sign(body: string, timestamp: string, secret = SECRET): string {
  return `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${body}`).digest("hex")}`;
}

function nowSeconds(): string {
  return String(Math.floor(Date.now() / 1000));
}

describe("verifySlackSignature", () => {
  beforeEach(() => {
    process.env.SLACK_SIGNING_SECRET = SECRET;
  });

  afterEach(() => {
    process.env.SLACK_SIGNING_SECRET = originalSecret;
  });

  it("accepts a correctly signed, fresh request", () => {
    const body = JSON.stringify({ type: "event_callback" });
    const timestamp = nowSeconds();
    expect(verifySlackSignature(body, timestamp, sign(body, timestamp))).toBe(true);
  });

  it("rejects a body signed with the wrong secret", () => {
    const body = JSON.stringify({ type: "event_callback" });
    const timestamp = nowSeconds();
    expect(verifySlackSignature(body, timestamp, sign(body, timestamp, "wrong-secret"))).toBe(false);
  });

  it("rejects a tampered body that no longer matches its signature", () => {
    const body = JSON.stringify({ type: "event_callback" });
    const timestamp = nowSeconds();
    const signature = sign(body, timestamp);
    const tampered = JSON.stringify({ type: "event_callback", extra: "injected" });
    expect(verifySlackSignature(tampered, timestamp, signature)).toBe(false);
  });

  it("rejects when no signature header is present", () => {
    const body = JSON.stringify({ type: "event_callback" });
    expect(verifySlackSignature(body, nowSeconds(), null)).toBe(false);
  });

  it("rejects when no timestamp header is present", () => {
    const body = JSON.stringify({ type: "event_callback" });
    const timestamp = nowSeconds();
    expect(verifySlackSignature(body, null, sign(body, timestamp))).toBe(false);
  });

  it("rejects garbage that isn't a valid v0=<hex> signature", () => {
    const body = JSON.stringify({ type: "event_callback" });
    expect(verifySlackSignature(body, nowSeconds(), "not-a-real-signature")).toBe(false);
  });

  it("rejects a request whose timestamp has drifted more than 5 minutes", () => {
    const body = JSON.stringify({ type: "event_callback" });
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 6 * 60);
    expect(verifySlackSignature(body, staleTimestamp, sign(body, staleTimestamp))).toBe(false);
  });

  it("rejects when the signing secret isn't configured", () => {
    delete process.env.SLACK_SIGNING_SECRET;
    const body = JSON.stringify({ type: "event_callback" });
    const timestamp = nowSeconds();
    expect(verifySlackSignature(body, timestamp, sign(body, timestamp))).toBe(false);
  });
});
