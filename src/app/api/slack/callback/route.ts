import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveConnectedChannel, deleteConnectedChannel } from "@/lib/supabase/channels";
import { saveChannelCredential } from "@/lib/supabase/channelCredentials";
import { exchangeOAuthCode, openDirectMessage, SlackApiError, type SlackOAuthResult } from "@/lib/slack/client";

export async function GET(request: Request) {
  const { searchParams, origin: requestOrigin } = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL || requestOrigin;
  const settingsUrl = `${origin}/settings/channels`;

  const error = searchParams.get("error");
  if (error) {
    return NextResponse.redirect(`${settingsUrl}?error=${encodeURIComponent(error)}`);
  }

  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${settingsUrl}?error=invalid_callback`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  let oauth: SlackOAuthResult;
  try {
    oauth = await exchangeOAuthCode(code, `${origin}/api/slack/callback`);
  } catch (err) {
    console.error("Slack OAuth exchange error:", err);
    const message = err instanceof SlackApiError ? err.code : "oauth_failed";
    return NextResponse.redirect(`${settingsUrl}?error=${encodeURIComponent(message)}`);
  }

  // A Slack workspace can hold many people — scope the connection to "this
  // one Slack person in this one workspace" (not the bare team id), so a
  // second ScamShield user connecting the same workspace can't silently
  // overwrite this connection, and other workspace members' DMs to the bot
  // aren't misattributed to whoever happened to install the app.
  const providerAccountId = `${oauth.teamId}:${oauth.authedUserId}`;

  let channelId: string;
  try {
    channelId = await openDirectMessage(oauth.botToken, oauth.authedUserId);
  } catch (err) {
    console.error("Slack conversations.open error:", err);
    return NextResponse.redirect(`${settingsUrl}?error=slack_dm_open_failed`);
  }

  let connectedChannelId: string;
  try {
    connectedChannelId = await saveConnectedChannel(user.id, {
      platform: "slack",
      providerAccountId,
      channelId,
      displayName: oauth.teamName,
    });
  } catch (err) {
    console.error("Failed to save connected Slack channel:", err);
    return NextResponse.redirect(`${settingsUrl}?error=save_failed`);
  }

  try {
    await saveChannelCredential(connectedChannelId, oauth.botToken);
  } catch (err) {
    console.error("Failed to save Slack credential, rolling back connection:", err);
    await deleteConnectedChannel(connectedChannelId);
    return NextResponse.redirect(`${settingsUrl}?error=save_failed`);
  }

  return NextResponse.redirect(`${settingsUrl}?connected=slack`);
}
