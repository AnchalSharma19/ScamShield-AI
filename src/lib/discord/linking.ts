import { randomBytes } from "crypto";
import { createServiceClient } from "@/lib/supabase/serviceClient";
import { isSupabaseConfigured } from "@/lib/supabase/history";

const CODE_LENGTH = 6;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — easy to misread when typed into Discord
const CODE_TTL_MS = 15 * 60 * 1000;

function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return code;
}

export interface DiscordLinkCode {
  code: string;
  expiresAt: string;
}

/** Generates a short-lived link code the user DMs to the bot to connect their Discord account — the self-hosted equivalent of Zernio's Telegram access-code flow. */
export async function createLinkCode(userId: string): Promise<DiscordLinkCode> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");

  const supabase = createServiceClient();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  const code = generateCode();

  const { error } = await supabase.from("discord_link_codes").insert({ code, user_id: userId, status: "pending", expires_at: expiresAt });
  if (error) throw new Error(`Failed to create Discord link code: ${error.message}`);

  return { code, expiresAt };
}

export type DiscordLinkStatus = { status: "pending"; expiresAt: string } | { status: "connected" } | { status: "expired" } | { status: "not_found" };

export async function checkLinkCodeStatus(code: string): Promise<DiscordLinkStatus> {
  if (!isSupabaseConfigured()) return { status: "not_found" };

  const supabase = createServiceClient();
  const { data } = await supabase.from("discord_link_codes").select("status, expires_at").eq("code", code).maybeSingle();
  if (!data) return { status: "not_found" };

  if (data.status === "used") return { status: "connected" };
  if (data.status === "expired" || new Date(data.expires_at) < new Date()) return { status: "expired" };
  return { status: "pending", expiresAt: data.expires_at as string };
}

/**
 * Called by the Discord worker (scripts/discord-bot.ts) when a DM's text
 * matches a pending code. Atomically claims the code (a conditional UPDATE,
 * not select-then-update, so it can't be consumed twice concurrently) and
 * creates the connected_channels row.
 *
 * The worker is a standalone Node process with no signed-in Next.js
 * request/session, so this writes with the service-role client directly
 * (like the webhook handlers do) rather than going through
 * saveConnectedChannel(), which depends on next/headers' cookies() and only
 * works inside a Next.js request.
 */
export async function consumeLinkCode(code: string, discordUserId: string, discordUsername: string, channelId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("discord_link_codes")
    .update({ status: "used", discord_user_id: discordUserId, discord_username: discordUsername })
    .eq("code", code)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select("user_id")
    .maybeSingle();

  if (error || !data) return false;

  const { error: insertError } = await supabase.from("connected_channels").upsert(
    {
      user_id: data.user_id as string,
      platform: "discord",
      provider_account_id: discordUserId,
      channel_id: channelId,
      username: discordUsername,
      status: "active",
    },
    { onConflict: "platform,provider_account_id" }
  );

  return !insertError;
}
