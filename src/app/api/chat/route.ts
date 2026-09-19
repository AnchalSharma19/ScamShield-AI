import { NextResponse } from "next/server";
import { z } from "zod";
import { generateText } from "@/lib/ai/client";
import { CHATBOT_PROMPT } from "@/lib/ai/prompts";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const RequestSchema = z.object({
  original_message: z.string().max(10000),
  analysis: z.record(z.string(), z.unknown()),
  question: z.string().trim().min(1).max(1000),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`chat:${ip}`, 20, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment and try again." }, { status: 429 });
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

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server" }, { status: 500 });
  }

  try {
    const prompt = CHATBOT_PROMPT(
      parsed.data.original_message,
      JSON.stringify(parsed.data.analysis),
      parsed.data.question
    );

    const answer = await generateText(prompt);
    return NextResponse.json({ answer });
  } catch (err) {
    console.error("Chat error:", err);
    return NextResponse.json({ error: "Failed to get a response" }, { status: 500 });
  }
}
