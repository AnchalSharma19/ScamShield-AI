import { Redis } from "@upstash/redis";
import { Index } from "@upstash/vector";

export function isCacheConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN &&
      process.env.UPSTASH_VECTOR_REST_URL &&
      process.env.UPSTASH_VECTOR_REST_TOKEN
  );
}

let redisClient: Redis | null = null;

/** Upstash Redis — REST-based, so it's safe to call from serverless route handlers with no persistent connection to manage. Holds the exact-match cache. */
export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redisClient;
}

let vectorClient: Index | null = null;

/**
 * Upstash Vector — holds the semantic cache. Created with "bring your own
 * vector" (not Upstash's built-in text-embedding mode) so it reuses the same
 * Gemini embedding model (lib/ai/embeddings.ts, 768 dims) already used for
 * the RAG pattern library, rather than depending on a second embedding
 * provider. The index must be created in the Upstash console with dimension
 * 768 and cosine similarity to match.
 */
export function getVectorIndex(): Index {
  if (!vectorClient) {
    vectorClient = new Index({
      url: process.env.UPSTASH_VECTOR_REST_URL!,
      token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    });
  }
  return vectorClient;
}
