import { createClient, createServiceClient } from "./server";
import { isSupabaseConfigured } from "./history";
import { createProfile, ZernioApiError } from "@/lib/zernio/client";

export type ChannelPlatform = "whatsapp" | "instagram" | "facebook" | "telegram" | "sms" | "slack" | "discord";

/**
 * Returns the current user's Zernio profile ID, creating one on Zernio (and
 * persisting it) if this is their first channel connection.
 *
 * Self-heals a specific partial-failure: if the profile was created on
 * Zernio's side but the DB write recording it never happened (e.g. a crash
 * or bug in between), retrying would normally fail with a 409 name
 * conflict — recover by reusing the existing profile Zernio points us at
 * instead of surfacing that as an error.
 */
export async function getOrCreateZernioProfile(): Promise<{ userId: string; profileId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data: row } = await supabase.from("users").select("zernio_profile_id").eq("id", user.id).single();

  if (row?.zernio_profile_id) {
    return { userId: user.id, profileId: row.zernio_profile_id };
  }

  let profileId: string;
  try {
    const profile = await createProfile(`scamshield-${user.id}`);
    profileId = profile._id;
  } catch (err) {
    const existingId =
      err instanceof ZernioApiError && err.code === "profile_name_conflict" ? (err.details?.existingProfileId as string | undefined) : undefined;
    if (!existingId) throw err;
    profileId = existingId;
  }

  const { error } = await supabase.from("users").update({ zernio_profile_id: profileId }).eq("id", user.id);
  if (error) throw new Error(`Failed to save Zernio profile: ${error.message}`);

  return { userId: user.id, profileId };
}

export interface ConnectedChannelInput {
  platform: ChannelPlatform;
  providerAccountId: string;
  channelId?: string;
  username?: string;
  displayName?: string;
  phoneNumber?: string;
}

/** Records a newly connected channel for the currently signed-in user (runs with their session, not the service role). */
export async function saveConnectedChannel(userId: string, input: ConnectedChannelInput): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("connected_channels")
    .upsert(
      {
        user_id: userId,
        platform: input.platform,
        provider_account_id: input.providerAccountId,
        channel_id: input.channelId,
        username: input.username,
        display_name: input.displayName,
        phone_number: input.phoneNumber,
        status: "active",
      },
      { onConflict: "platform,provider_account_id" }
    )
    .select("id")
    .single();
  if (error) throw new Error(`Failed to save connected channel: ${error.message}`);
  return data.id as string;
}

export async function deleteConnectedChannel(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("connected_channels").delete().eq("id", id);
}

export async function listConnectedChannels(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("connected_channels")
    .select("id, platform, username, display_name, phone_number, status, connected_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("connected_at", { ascending: false });

  if (error) throw new Error(`Failed to list connected channels: ${error.message}`);
  return data;
}

/**
 * Looks up which ScamShield user owns a given channel account, for the
 * webhook/bot handlers — which have no user session, so this always goes
 * through the service role rather than an authenticated client.
 */
export async function findUserByChannelAccount(platform: string, providerAccountId: string): Promise<{ userId: string } | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("connected_channels")
    .select("user_id")
    .eq("platform", platform)
    .eq("provider_account_id", providerAccountId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;
  return { userId: data.user_id as string };
}
