import { createServiceClient } from "./server";
import { isSupabaseConfigured } from "./history";

/**
 * Stores a per-channel secret (e.g. a Slack workspace's bot token) in
 * channel_credentials, a table with RLS enabled and zero policies — only
 * the service-role client used here can ever read or write it. Always call
 * this with the service client, never a session-scoped one.
 */
export async function saveChannelCredential(connectedChannelId: string, token: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = createServiceClient();
  const { error } = await supabase.from("channel_credentials").insert({ connected_channel_id: connectedChannelId, token });
  if (error) throw new Error(`Failed to save channel credential: ${error.message}`);
}

export async function getChannelToken(platform: string, providerAccountId: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createServiceClient();
  const { data: channel } = await supabase
    .from("connected_channels")
    .select("id")
    .eq("platform", platform)
    .eq("provider_account_id", providerAccountId)
    .eq("status", "active")
    .maybeSingle();
  if (!channel) return null;

  const { data: credential } = await supabase
    .from("channel_credentials")
    .select("token")
    .eq("connected_channel_id", channel.id)
    .maybeSingle();

  return (credential?.token as string) ?? null;
}

export async function getChannelTokenById(connectedChannelId: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createServiceClient();
  const { data } = await supabase.from("channel_credentials").select("token").eq("connected_channel_id", connectedChannelId).maybeSingle();
  return (data?.token as string) ?? null;
}
