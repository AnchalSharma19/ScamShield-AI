import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { updateConversationStatus } from "@/lib/zernio/client";
import { requireOwnedZernioAccount } from "@/lib/supabase/channels";

const UpdateStatusSchema = z.object({
  accountId: z.string().min(1),
  status: z.enum(["read", "unread", "archived", "unarchived"]),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = UpdateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  if (!(await requireOwnedZernioAccount(supabase, user.id, parsed.data.accountId))) {
    return NextResponse.json({ error: "Not your channel" }, { status: 403 });
  }

  try {
    await updateConversationStatus(conversationId, parsed.data.status);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update conversation status:", err);
    const message = err instanceof Error ? err.message : "Failed to update conversation status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
