import { NextResponse } from "next/server";
import { z } from "zod";
import { InputType } from "@/types/analysis";
import { analyzeText } from "@/lib/scam/pipeline";
import { saveAnalysis } from "@/lib/supabase/history";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const RequestSchema = z.object({
  text: z.string().trim().min(1, "Message text is required").max(10000, "Message is too long"),
  input_type: InputType.default("text"),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`analyze:${ip}`, 10, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": Math.ceil(rate.retryAfterMs / 1000).toString() } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  try {
    const result = await analyzeText(parsed.data.text, parsed.data.input_type);
    const savedId = await saveAnalysis(result);
    return NextResponse.json({ ...result, id: savedId });
  } catch (err) {
    console.error("Analyze error:", err);
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
