import { createHash } from "crypto";
import { embedText } from "@/lib/ai/embeddings";
import { getRedis, getVectorIndex, isCacheConfigured } from "./clients";
import type { AnalysisResult } from "@/types/analysis";

const CACHE_KEY_VERSION = "v1"; // bump to invalidate every cached entry after a scoring-pipeline change
const TTL_SECONDS = Number(process.env.ANALYSIS_CACHE_TTL_SECONDS) || 60 * 60 * 24 * 7;
const SEMANTIC_THRESHOLD = Number(process.env.SEMANTIC_CACHE_SIMILARITY_THRESHOLD) || 0.95;
const MIN_LENGTH_FOR_SEMANTIC = 20; // very short strings embed too generically to match meaningfully

function normalizeMessage(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function hashMessage(normalized: string): string {
  return createHash("sha256").update(normalized).digest("hex");
}

function exactKey(hash: string): string {
  return `scamshield:analysis:${CACHE_KEY_VERSION}:${hash}`;
}

export interface MessageCacheHit {
  result: AnalysisResult;
  match: "exact" | "semantic";
}

export interface MessageCacheLookup {
  hit: MessageCacheHit | null;
  /** The embedding computed while checking the semantic cache — null on an exact hit (never needed) or if embedding failed. Pass this into cacheAnalysisResult() on a miss to avoid a second, redundant embedding call for the same text. */
  embedding: number[] | null;
}

/**
 * Checks the exact-match cache first (fast, no embedding call), then falls
 * back to the semantic cache (embeds the message, queries Upstash Vector for
 * a near-duplicate above SEMANTIC_THRESHOLD). Same underlying scoring
 * pipeline produces the same result regardless of which "tab"/channel a
 * message came in through — classifyMessage/runRuleEngine don't take
 * inputType into account — so the cache is keyed on message text alone and
 * the caller re-labels input_type/input_text on the returned result.
 *
 * Never throws: caching is a pure optimization, not a hard dependency —
 * any failure here just means the normal (uncached) pipeline runs.
 */
export async function lookupCachedAnalysis(text: string): Promise<MessageCacheLookup> {
  if (!isCacheConfigured()) return { hit: null, embedding: null };

  const normalized = normalizeMessage(text);
  if (!normalized) return { hit: null, embedding: null };

  try {
    const redis = getRedis();
    const exact = await redis.get<AnalysisResult>(exactKey(hashMessage(normalized)));
    if (exact) return { hit: { result: exact, match: "exact" }, embedding: null };
  } catch (err) {
    console.error("Exact cache lookup failed:", err);
  }

  if (normalized.length < MIN_LENGTH_FOR_SEMANTIC) return { hit: null, embedding: null };

  let embedding: number[] | null = null;
  try {
    embedding = await embedText(normalized);
    const vector = getVectorIndex();
    const [nearest] = await vector.query({ vector: embedding, topK: 1, includeMetadata: true });

    if (nearest && nearest.score >= SEMANTIC_THRESHOLD) {
      const redisKey = (nearest.metadata as { redisKey?: string } | undefined)?.redisKey;
      if (redisKey) {
        const redis = getRedis();
        const semanticResult = await redis.get<AnalysisResult>(redisKey);
        if (semanticResult) {
          // A literal repeat of this exact text should hit the fast path next time.
          void redis.set(exactKey(hashMessage(normalized)), semanticResult, { ex: TTL_SECONDS }).catch(() => {});
          return { hit: { result: semanticResult, match: "semantic" }, embedding };
        }
      }
    }
  } catch (err) {
    console.error("Semantic cache lookup failed:", err);
  }

  return { hit: null, embedding };
}

/**
 * Stores a freshly computed analysis in both caches. `embedding` should be
 * the value returned by lookupCachedAnalysis() for the same text when
 * available, to avoid embedding the same string twice. Never throws.
 */
export async function cacheAnalysisResult(text: string, result: AnalysisResult, embedding?: number[] | null): Promise<void> {
  if (!isCacheConfigured()) return;

  const normalized = normalizeMessage(text);
  if (!normalized) return;

  const hash = hashMessage(normalized);
  const redisKey = exactKey(hash);

  try {
    const redis = getRedis();
    await redis.set(redisKey, result, { ex: TTL_SECONDS });
  } catch (err) {
    console.error("Failed to write exact cache:", err);
  }

  if (normalized.length < MIN_LENGTH_FOR_SEMANTIC) return;

  try {
    const vec = embedding ?? (await embedText(normalized));
    const vector = getVectorIndex();
    await vector.upsert({ id: hash, vector: vec, metadata: { redisKey, cachedAt: Date.now() } });
  } catch (err) {
    console.error("Failed to write semantic cache:", err);
  }
}
