import { createHmac, timingSafeEqual } from "crypto";

const SHA256_BYTE_LENGTH = 32;

/**
 * Zernio's docs and SDK don't specify whether X-Zernio-Signature is hex or
 * base64 encoded (both are common across webhook providers, and the secret
 * they issue looks base64 itself). Rather than gamble on one and silently
 * reject every real webhook if it's the other, decode whichever format the
 * header actually parses to a valid 32-byte SHA-256 digest as, stripping a
 * possible "sha256=" prefix some providers add.
 */
function decodeSignature(header: string): Buffer | null {
  const value = header.replace(/^sha256=/i, "").trim();

  if (/^[0-9a-f]{64}$/i.test(value)) {
    return Buffer.from(value, "hex");
  }

  try {
    const decoded = Buffer.from(value, "base64");
    if (decoded.length === SHA256_BYTE_LENGTH) return decoded;
  } catch {
    // fall through
  }

  return null;
}

/**
 * Verifies the X-Zernio-Signature header (HMAC-SHA256 of the raw body, keyed
 * by the webhook secret). Must run against the raw, unparsed request body —
 * re-serializing parsed JSON would not reproduce the same bytes Zernio signed.
 */
export function verifyZernioSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.ZERNIO_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const receivedBuf = decodeSignature(signatureHeader);
  if (!receivedBuf) return false;

  const expectedBuf = createHmac("sha256", secret).update(rawBody).digest();
  if (expectedBuf.length !== receivedBuf.length) return false;

  return timingSafeEqual(expectedBuf, receivedBuf);
}
