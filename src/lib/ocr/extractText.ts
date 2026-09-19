import { createWorker } from "tesseract.js";

/**
 * Runs OCR on an image buffer using Tesseract.js (server-side, Node worker).
 * Returns the raw extracted text plus a mean confidence (0-100) so callers
 * can flag low-confidence extractions instead of treating OCR as ground truth.
 */
export async function extractTextFromImage(imageBuffer: Buffer): Promise<{ text: string; confidence: number }> {
  const worker = await createWorker("eng");
  try {
    const {
      data: { text, confidence },
    } = await worker.recognize(imageBuffer);
    return { text: text.trim(), confidence };
  } finally {
    await worker.terminate();
  }
}
