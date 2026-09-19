import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateZernioProfile, saveConnectedChannel } from "@/lib/supabase/channels";
import { listPhoneNumbers } from "@/lib/zernio/client";

/**
 * Registers any phone numbers already provisioned (bought + carrier-registered)
 * on this user's Zernio profile as SMS channels. Buying a new number involves
 * KYC/carrier registration and is done directly in the Zernio dashboard, not here.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let profileId: string;
  try {
    ({ profileId } = await getOrCreateZernioProfile());
  } catch (err) {
    console.error("Zernio profile error:", err);
    return NextResponse.json({ error: "Failed to prepare Zernio profile" }, { status: 500 });
  }

  try {
    const { numbers } = await listPhoneNumbers(profileId);
    const active = numbers.filter((n) => n.status === "active");

    for (const number of active) {
      await saveConnectedChannel(user.id, {
        platform: "sms",
        providerAccountId: number._id,
        phoneNumber: number.phoneNumber,
      });
    }

    return NextResponse.json({ synced: active.length });
  } catch (err) {
    console.error("SMS sync error:", err);
    const message = err instanceof Error ? err.message : "Failed to sync phone numbers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
