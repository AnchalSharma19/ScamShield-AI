import { NextResponse } from "next/server";
import { getTelegramConnectCode } from "@/lib/zernio/client";
import { getOrCreateZernioProfile } from "@/lib/supabase/channels";

/** Starts a Telegram connection: generates the access code the user sends to Zernio's bot. No redirect involved. */
export async function POST() {
  let profileId: string;
  try {
    ({ profileId } = await getOrCreateZernioProfile());
  } catch (err) {
    if (err instanceof Error && err.message === "Not signed in") {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    console.error("Zernio Telegram connect error:", err);
    return NextResponse.json({ error: "Failed to start Telegram connection" }, { status: 500 });
  }

  try {
    const code = await getTelegramConnectCode(profileId);
    return NextResponse.json(code);
  } catch (err) {
    console.error("Zernio getTelegramConnectCode error:", err);
    const message = err instanceof Error ? err.message : "Failed to generate Telegram code";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
