const EMBED_MODEL = "gemini-embedding-001";
const OUTPUT_DIMENSIONALITY = 768; // matches the pgvector column in schema.sql

/**
 * Raw REST call rather than the @google/generative-ai SDK: the installed SDK
 * version's EmbedContentRequest type has no outputDimensionality field (a
 * newer API capability), and gemini-embedding-001 defaults to 3072
 * dimensions — asking for 768 directly is what keeps this compatible with
 * the fixed-size vector column without a migration.
 */
export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        outputDimensionality: OUTPUT_DIMENSIONALITY,
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini embedding request failed (${response.status}): ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  return data.embedding.values as number[];
}
