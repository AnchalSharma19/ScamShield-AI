import { NextResponse } from "next/server";
import { checkLinkCodeStatus } from "@/lib/discord/linking";

/** Polled by the frontend every ~3s while a Discord link code is pending, mirroring the Telegram status route. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const status = await checkLinkCodeStatus(code);
  return NextResponse.json(status);
}
