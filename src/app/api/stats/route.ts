import { NextResponse } from "next/server";
import { getUserStats } from "@/lib/supabase/stats";

export async function GET() {
  const stats = await getUserStats();
  return NextResponse.json(stats);
}
