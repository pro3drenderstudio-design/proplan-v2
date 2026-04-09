import { NextRequest, NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/outreach/gmail";

export async function GET(req: NextRequest) {
  const label = req.nextUrl.searchParams.get("label") ?? "Gmail Inbox";
  const url = getAuthorizationUrl(encodeURIComponent(label));
  return NextResponse.redirect(url);
}
