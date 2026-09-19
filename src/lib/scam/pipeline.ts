import { classifyMessage, classifyOcrText } from "@/lib/ai/analyzer";
import { matchAgainstKnownPatterns } from "@/lib/rag/analyze";
import { extractTextFromImage } from "@/lib/ocr/extractText";
import { lookupCachedAnalysis, cacheAnalysisResult } from "@/lib/cache/messageCache";
import { runRuleEngine } from "./rules";
import { computeFinalScore, riskLevelFromScore } from "./scoring";
import { normalizeCategory } from "./categories";
import type { AnalysisResult, InputType } from "@/types/analysis";

export async function analyzeText(text: string, inputType: InputType): Promise<AnalysisResult> {
  const cacheLookup = await lookupCachedAnalysis(text);
  if (cacheLookup.hit) {
    // Same message content scores identically regardless of which tab/channel it
    // came in through (classifyMessage/runRuleEngine don't take inputType into
    // account) — reuse the cached scoring, just re-label it for this call's
    // context. Drop any OCR caveat the cached entry may carry: that's specific to
    // a particular image scan, not to a directly-submitted message.
    const { ocr_uncertainty: _ocrUncertainty, ...cached } = cacheLookup.hit.result;
    return { ...cached, input_type: inputType, input_text: text };
  }

  const [aiResult, ruleResult, patternResult] = await Promise.all([
    classifyMessage(text),
    Promise.resolve(runRuleEngine(text)),
    matchAgainstKnownPatterns(text),
  ]);

  // Pattern score only counts as a signal once we actually found similar
  // patterns — zero known matches means "no data", not "definitely safe".
  const patternScore = patternResult.patterns.length > 0 ? patternResult.confidence : null;

  const breakdown = computeFinalScore({
    aiScore: aiResult.risk_score,
    ruleScore: ruleResult.score,
    patternScore,
  });

  const result: AnalysisResult = {
    input_type: inputType,
    input_text: text,
    risk_score: breakdown.final_score,
    risk_level: riskLevelFromScore(breakdown.final_score),
    category: normalizeCategory(aiResult.category),
    summary: aiResult.summary,
    red_flags: aiResult.red_flags,
    safe_signals: aiResult.safe_signals,
    recommended_actions: aiResult.recommended_actions,
    indicators: ruleResult.indicators,
    score_breakdown: breakdown,
  };

  void cacheAnalysisResult(text, result, cacheLookup.embedding);

  return result;
}

/**
 * OCR + classify + score for an image buffer (screenshot upload, or a photo
 * attachment from a connected messaging channel). Returns null if no
 * readable text could be extracted — callers decide what "nothing to
 * analyze" means for their context (an HTTP 422 for the upload endpoint,
 * a silent skip for a webhook-delivered sticker/photo).
 */
export async function analyzeImage(buffer: Buffer, inputType: InputType): Promise<AnalysisResult | null> {
  const { text: ocrText, confidence } = await extractTextFromImage(buffer);
  if (!ocrText || ocrText.length < 5) return null;

  const ocrCaveat = confidence < 60 ? [`Low OCR confidence (${Math.round(confidence)}%) — some text may be misread.`] : [];

  const cacheLookup = await lookupCachedAnalysis(ocrText);
  if (cacheLookup.hit) {
    const cached = cacheLookup.hit.result;
    return {
      ...cached,
      input_type: inputType,
      input_text: ocrText,
      // The OCR confidence caveat is specific to *this* scan, not to whatever
      // produced the cached entry — recompute it fresh rather than reusing a
      // stale one (or missing one) from the cache.
      ocr_uncertainty: [...(cached.ocr_uncertainty ?? []), ...ocrCaveat],
    };
  }

  const [aiResult, ruleResult] = await Promise.all([classifyOcrText(ocrText), Promise.resolve(runRuleEngine(ocrText))]);

  const breakdown = computeFinalScore({ aiScore: aiResult.risk_score, ruleScore: ruleResult.score });

  const result: AnalysisResult = {
    input_type: inputType,
    input_text: ocrText,
    risk_score: breakdown.final_score,
    risk_level: riskLevelFromScore(breakdown.final_score),
    category: normalizeCategory(aiResult.category),
    summary: aiResult.summary,
    red_flags: aiResult.red_flags,
    safe_signals: aiResult.safe_signals,
    recommended_actions: aiResult.recommended_actions,
    indicators: ruleResult.indicators,
    score_breakdown: breakdown,
    ocr_uncertainty: [...(aiResult.ocr_uncertainty ?? []), ...ocrCaveat],
  };

  void cacheAnalysisResult(ocrText, result, cacheLookup.embedding);

  return result;
}
