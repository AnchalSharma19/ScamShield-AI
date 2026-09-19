import { NextResponse } from "next/server";
import { listAnalyses, deleteAnalysis } from "@/lib/supabase/history";

export async function GET() {
  const analyses = await listAnalyses();
  return NextResponse.json({ analyses });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const ok = await deleteAnalysis(id);
  if (!ok) {
    return NextResponse.json({ error: "Could not delete analysis" }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
