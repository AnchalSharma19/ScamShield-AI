import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveConnectedChannel } from "@/lib/supabase/channels";
import type { ZernioMessagePlatform } from "@/lib/zernio/types";

export async function GET(request: Request) {
  const { searchParams, origin: requestOrigin } = new URL(request.url);
  // Behind a tunnel (ngrok) or reverse proxy, request.url reflects the local
  // origin the server is actually bound to, not the public URL the browser
  // used to get here — redirecting to that would send the user to an
  // unreachable address. NEXT_PUBLIC_APP_URL is the source of truth.
  const origin = process.env.NEXT_PUBLIC_APP_URL || requestOrigin;
  const settingsUrl = `${origin}/settings/channels`;

  const error = searchParams.get("error");
  if (error) {
    return NextResponse.redirect(`${settingsUrl}?error=${encodeURIComponent(error)}`);
  }

  const platform = searchParams.get("connected") as ZernioMessagePlatform | null;
  const accountId = searchParams.get("accountId");
  const username = searchParams.get("username") ?? undefined;

  if (!platform || !accountId) {
    return NextResponse.redirect(`${settingsUrl}?error=invalid_callback`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  try {
    await saveConnectedChannel(user.id, { platform, providerAccountId: accountId, username });
  } catch (err) {
    console.error("Failed to save connected channel:", err);
    return NextResponse.redirect(`${settingsUrl}?error=save_failed`);
  }

  return NextResponse.redirect(`${settingsUrl}?connected=${platform}`);
}
