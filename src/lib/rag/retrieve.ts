import { embedText } from "@/lib/ai/embeddings";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/history";

export interface RetrievedPattern {
  category: string;
  pattern: string;
  description: string | null;
  similarity: number;
}

/**
 * Finds previously catalogued scam patterns similar to the given message via
 * pgvector cosine similarity. Returns an empty list (never throws) if
 * Supabase/pgvector isn't configured or the service key is missing — RAG is
 * an optional signal, not a hard dependency: core analysis works without it.
 */
export async function retrieveSimilarPatterns(text: string, limit = 5): Promise<RetrievedPattern[]> {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.GEMINI_API_KEY) return [];

  try {
    const embedding = await embedText(text);
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc("match_scam_patterns", {
      query_embedding: embedding,
      match_threshold: 0.75,
      match_count: limit,
    });

    if (error || !data) return [];
    return data as RetrievedPattern[];
  } catch (err) {
    console.error("RAG retrieval failed:", err);
    return [];
  }
}
