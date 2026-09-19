import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listConnectedChannels } from "@/lib/supabase/channels";
import { disconnectAccount } from "@/lib/zernio/client";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ channels: [] });

  const channels = await listConnectedChannels(user.id);
  return NextResponse.json({ channels });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: channel, error: fetchError } = await supabase
    .from("connected_channels")
    .select("platform, provider_account_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const ZERNIO_PLATFORMS = ["whatsapp", "instagram", "facebook", "telegram", "sms"];
  if (ZERNIO_PLATFORMS.includes(channel.platform)) {
    try {
      await disconnectAccount(channel.provider_account_id);
    } catch (err) {
      // The account may already be disconnected on Zernio's side (returns 404) —
      // don't block removing it from our own records over that.
      console.error("Zernio disconnect warning:", err);
    }
  }
  // Slack/Discord have no Zernio-side account to disconnect — just remove the row below
  // (which cascades to channel_credentials for Slack's stored bot token).

  const { error: deleteError } = await supabase.from("connected_channels").delete().eq("id", id).eq("user_id", user.id);
  if (deleteError) {
    return NextResponse.json({ error: "Failed to remove channel" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
