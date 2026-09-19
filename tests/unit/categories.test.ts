import { describe, it, expect } from "vitest";
import { normalizeCategory } from "@/lib/scam/categories";

describe("normalizeCategory", () => {
  it("matches an exact category case-insensitively", () => {
    expect(normalizeCategory("lottery scam")).toBe("Lottery Scam");
  });

  it("falls back to substring matching when the model doesn't comply exactly", () => {
    expect(normalizeCategory("Lottery Scam / Phishing")).toBe("Lottery Scam");
    expect(normalizeCategory("This looks like a Job Scam.")).toBe("Job Scam");
  });

  it("returns Unknown for genuinely unrecognized text", () => {
    expect(normalizeCategory("Some Made Up Category")).toBe("Unknown");
  });
});
