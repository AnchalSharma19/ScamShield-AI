import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeUrl } from "@/lib/url/analyzer";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const RequestSchema = z.object({
  url: z.string().trim().min(1, "URL is required").max(2048),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`url-scan:${ip}`, 10, 60_000);
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

  try {
    new URL(parsed.data.url.startsWith("http") ? parsed.data.url : `https://${parsed.data.url}`);
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid URL" }, { status: 400 });
  }

  try {
    const result = await analyzeUrl(parsed.data.url);
    return NextResponse.json(result);
  } catch (err) {
    console.error("URL scan error:", err);
    const message = err instanceof Error ? err.message : "URL analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
