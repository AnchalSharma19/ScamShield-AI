import { NextResponse } from "next/server";
import { checkTelegramConnectStatus } from "@/lib/zernio/client";
import { createClient } from "@/lib/supabase/server";
import { saveConnectedChannel } from "@/lib/supabase/channels";

/** On "connected", persists the channel for the signed-in user. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  let status;
  try {
    status = await checkTelegramConnectStatus(code);
  } catch (err) {
    console.error("Zernio checkTelegramConnectStatus error:", err);
    return NextResponse.json({ error: "Failed to check connection status" }, { status: 500 });
  }

  if (status.status === "connected") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      try {
        await saveConnectedChannel(user.id, {
          platform: "telegram",
          providerAccountId: status.account._id,
          username: status.account.username,
          displayName: status.account.displayName,
        });
      } catch (err) {
        console.error("Failed to save connected Telegram channel:", err);
      }
    }
  }

  return NextResponse.json(status);
}
