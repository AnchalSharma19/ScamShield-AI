import { NextResponse } from "next/server";
import { analyzeImage } from "@/lib/scam/pipeline";
import { saveAnalysis } from "@/lib/supabase/history";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`ocr:${ip}`, 5, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment and try again." }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data with an 'image' field" }, { status: 400 });
  }
  const file = formData.get("image");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only PNG, JPEG, or WebP images are supported" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Image is too large (max 8MB)" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await analyzeImage(buffer, "screenshot");

    if (!result) {
      return NextResponse.json({ error: "Could not extract readable text from this image" }, { status: 422 });
    }

    const savedId = await saveAnalysis(result);
    return NextResponse.json({ ...result, id: savedId });
  } catch (err) {
    console.error("OCR analyze error:", err);
    const message = err instanceof Error ? err.message : "OCR analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
