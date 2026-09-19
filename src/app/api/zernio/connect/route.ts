import { NextResponse } from "next/server";
import { getConnectUrl } from "@/lib/zernio/client";
import { getOrCreateZernioProfile } from "@/lib/supabase/channels";
import type { ZernioConnectPlatform } from "@/lib/zernio/types";

const CONNECTABLE_PLATFORMS: ZernioConnectPlatform[] = ["whatsapp", "instagram", "facebook"];

/** OAuth-redirect connect flow. Telegram is handled separately (see /api/zernio/telegram/*) — it uses an access-code flow with no authUrl to redirect to. */
export async function GET(request: Request) {
  const { searchParams, origin: requestOrigin } = new URL(request.url);
  // Behind a tunnel/reverse proxy, request.url's origin is the local address
  // the server is bound to, not the public URL the browser used — see the
  // matching comment in /api/zernio/callback for the full explanation.
  const origin = process.env.NEXT_PUBLIC_APP_URL || requestOrigin;
  const platform = searchParams.get("platform") as ZernioConnectPlatform | null;

  if (!platform || !CONNECTABLE_PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: "Unsupported or missing platform" }, { status: 400 });
  }

  let profileId: string;
  try {
    ({ profileId } = await getOrCreateZernioProfile());
  } catch (err) {
    if (err instanceof Error && err.message === "Not signed in") {
      return NextResponse.redirect(`${origin}/login`);
    }
    console.error("Zernio connect error:", err);
    return NextResponse.json({ error: "Failed to start channel connection" }, { status: 500 });
  }

  try {
    const redirectUrl = `${origin}/api/zernio/callback`;
    const { authUrl } = await getConnectUrl(platform, profileId, redirectUrl);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("Zernio getConnectUrl error:", err);
    const message = err instanceof Error ? err.message : "Failed to get connect URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
