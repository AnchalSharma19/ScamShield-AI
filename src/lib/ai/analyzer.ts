import { generateJson } from "./client";
import { CLASSIFICATION_PROMPT, OCR_ANALYSIS_PROMPT } from "./prompts";
import { AiAnalysisSchema, type AiAnalysis } from "@/types/analysis";

export async function classifyMessage(message: string): Promise<AiAnalysis> {
  const raw = await generateJson<unknown>(CLASSIFICATION_PROMPT(message));
  return AiAnalysisSchema.parse(raw);
}

export async function classifyOcrText(ocrText: string): Promise<AiAnalysis & { ocr_uncertainty?: string[] }> {
  const raw = await generateJson<Record<string, unknown>>(OCR_ANALYSIS_PROMPT(ocrText));

  // OCR prompt uses a slightly different shape (no scam_probability); normalize it.
  const normalized = {
    risk_score: raw.risk_score ?? 0,
    risk_level: raw.risk_level ?? "LOW",
    scam_probability: raw.risk_score ?? 0,
    category: raw.category ?? "Unknown",
    summary: raw.summary ?? "",
    red_flags: raw.red_flags ?? [],
    safe_signals: [],
    recommended_actions: raw.recommended_actions ?? [],
  };

  const parsed = AiAnalysisSchema.parse(normalized);
  return { ...parsed, ocr_uncertainty: (raw.ocr_uncertainty as string[]) ?? [] };
}
