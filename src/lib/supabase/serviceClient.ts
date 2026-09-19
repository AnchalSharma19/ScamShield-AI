import { createClient as createRawClient } from "@supabase/supabase-js";

/**
 * Service-role client for trusted server-only operations (webhook handlers,
 * the Discord worker, seeding scam_patterns). Deliberately kept in its own
 * file with no next/headers dependency (unlike lib/supabase/server.ts's
 * createClient()) — the Discord bot (scripts/discord-bot.ts) is a standalone
 * Node process with no Next.js request/response cycle, so anything it
 * imports must not pull in next/headers' cookies(), which only works inside
 * an actual Next.js request. Never import this from client code.
 */
export function createServiceClient() {
  return createRawClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
