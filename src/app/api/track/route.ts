import { NextRequest, NextResponse } from "next/server";

// Proxy for Leadash outreach tracking links that were mistakenly generated
// pointing to proplanstudio.com instead of leadash.com.
// Forwards all params to the correct Leadash endpoint.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams.toString();
  const target = `https://leadash.com/api/track${params ? `?${params}` : ""}`;
  return NextResponse.redirect(target, { status: 302 });
}
