import { createHmac, timingSafeEqual } from "crypto";

const FIVE_MINUTES_SECONDS = 5 * 60;

/**
 * Verifies Slack's request signature per their documented spec: HMAC-SHA256
 * of `v0:{timestamp}:{rawBody}`, keyed by the signing secret, compared
 * against the `X-Slack-Signature` header (format `v0=<hex>`). Also rejects
 * requests whose timestamp has drifted more than 5 minutes from now, which
 * Slack's own docs call out as required replay protection — an attacker who
 * captured a valid signed request could otherwise replay it indefinitely.
 */
export function verifySlackSignature(rawBody: string, timestampHeader: string | null, signatureHeader: string | null): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret || !signatureHeader || !timestampHeader) return false;

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > FIVE_MINUTES_SECONDS) return false;

  const match = /^v0=([0-9a-f]{64})$/i.exec(signatureHeader.trim());
  if (!match) return false;
  const receivedBuf = Buffer.from(match[1], "hex");

  const expectedBuf = createHmac("sha256", secret).update(`v0:${timestampHeader}:${rawBody}`).digest();
  if (expectedBuf.length !== receivedBuf.length) return false;

  return timingSafeEqual(expectedBuf, receivedBuf);
}
