import { generateJson } from "@/lib/ai/client";
import { RAG_PROMPT } from "@/lib/ai/prompts";
import { retrieveSimilarPatterns, type RetrievedPattern } from "./retrieve";

export interface PatternMatchResult {
  patterns: RetrievedPattern[];
  matching_category: string;
  similarity_reason: string;
  confidence: number; // 0-100, used as the "pattern score" signal
}

const EMPTY_RESULT: PatternMatchResult = { patterns: [], matching_category: "Unknown", similarity_reason: "", confidence: 0 };

/**
 * RAG step: retrieve similar known scam patterns, then ask the model to
 * compare (never assume similarity == fraud — see RAG_PROMPT). Returns a
 * confidence score usable as the pattern-similarity signal in scoring.ts.
 * Silently no-ops when there's no pattern library to compare against yet.
 */
export async function matchAgainstKnownPatterns(text: string): Promise<PatternMatchResult> {
  const patterns = await retrieveSimilarPatterns(text);
  if (patterns.length === 0) return EMPTY_RESULT;

  const raw = await generateJson<Record<string, unknown>>(
    RAG_PROMPT(JSON.stringify(patterns, null, 2), text)
  );

  return {
    patterns,
    matching_category: (raw.matching_category as string) ?? "Unknown",
    similarity_reason: (raw.similarity_reason as string) ?? "",
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0,
  };
}
