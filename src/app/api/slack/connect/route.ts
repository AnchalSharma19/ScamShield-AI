import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BOT_SCOPES = ["chat:write", "im:history", "im:read", "users:read"].join(",");

export async function GET(request: Request) {
  const { origin: requestOrigin } = new URL(request.url);
  // Behind a tunnel/reverse proxy, request.url's origin is the local address
  // the server is bound to, not the public URL the browser used — see the
  // matching comment in /api/zernio/callback for the full explanation.
  const origin = process.env.NEXT_PUBLIC_APP_URL || requestOrigin;

  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "SLACK_CLIENT_ID is not set" }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const redirectUri = `${origin}/api/slack/callback`;
  const params = new URLSearchParams({ client_id: clientId, scope: BOT_SCOPES, redirect_uri: redirectUri });

  return NextResponse.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
}
