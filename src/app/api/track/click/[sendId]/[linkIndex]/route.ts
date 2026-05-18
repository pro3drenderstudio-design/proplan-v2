import { NextRequest, NextResponse } from "next/server";

// Forward to Leadash — all outreach tracking data lives in Leadash's Supabase.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sendId: string; linkIndex: string }> },
) {
  const { sendId, linkIndex } = await params;
  return NextResponse.redirect(
    `https://leadash.com/api/track/click/${sendId}/${linkIndex}`,
    { status: 302 },
  );
}
