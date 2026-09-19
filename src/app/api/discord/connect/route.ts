import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLinkCode } from "@/lib/discord/linking";

const INSTRUCTIONS = [
  "Make sure the bot has been invited to at least one server you're also in (Discord requires sharing a server before you can DM a bot).",
  "Open a DM with the bot and send it this code.",
];

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const botInviteUrl = process.env.DISCORD_BOT_INVITE_URL;
  if (!botInviteUrl) {
    return NextResponse.json({ error: "DISCORD_BOT_INVITE_URL is not set" }, { status: 500 });
  }

  try {
    const { code, expiresAt } = await createLinkCode(user.id);
    return NextResponse.json({ code, expiresAt, botInviteUrl, instructions: INSTRUCTIONS });
  } catch (err) {
    console.error("Failed to create Discord link code:", err);
    return NextResponse.json({ error: "Failed to start Discord connection" }, { status: 500 });
  }
}
