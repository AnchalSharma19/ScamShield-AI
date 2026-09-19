import { GoogleGenerativeAI } from "@google/generative-ai";

let client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Add it to .env.local (server-side only).");
  }
  if (!client) client = new GoogleGenerativeAI(apiKey);
  return client;
}

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/**
 * Strips markdown code fences some models add despite JSON-only instructions.
 */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) return candidate.trim();
  return candidate.slice(start, end + 1).trim();
}

export async function generateJson<T>(prompt: string): Promise<T> {
  const model = getClient().getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const jsonText = extractJson(text);

  try {
    return JSON.parse(jsonText) as T;
  } catch (err) {
    throw new Error(`Gemini returned non-JSON output: ${(err as Error).message}\nRaw: ${text.slice(0, 500)}`);
  }
}

export async function generateText(prompt: string): Promise<string> {
  const model = getClient().getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
  });

  const result = await model.generateContent(prompt);
  return result.response.text();
}
