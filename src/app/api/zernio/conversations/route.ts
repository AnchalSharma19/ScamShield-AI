import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listConversations } from "@/lib/zernio/client";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: row } = await supabase.from("users").select("zernio_profile_id").eq("id", user.id).single();
  if (!row?.zernio_profile_id) {
    return NextResponse.json({ data: [], pagination: { hasMore: false, nextCursor: null } });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;

  try {
    const result = await listConversations(row.zernio_profile_id, { cursor });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to list conversations:", err);
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
  }
}
