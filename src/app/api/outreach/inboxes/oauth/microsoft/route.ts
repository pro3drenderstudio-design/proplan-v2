import { NextRequest, NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/outreach/microsoft";

export async function GET(req: NextRequest) {
  // Admin consent flow — grants permission for the entire tenant at once
  if (req.nextUrl.searchParams.get("admin_consent") === "1") {
    const tenantId   = process.env.MICROSOFT_TENANT_ID ?? "common";
    const clientId   = process.env.MICROSOFT_CLIENT_ID!;
    const redirectUri = encodeURIComponent(process.env.MICROSOFT_REDIRECT_URI!);
    const url = `https://login.microsoftonline.com/${tenantId}/adminconsent?client_id=${clientId}&redirect_uri=${redirectUri}&state=admin_consent`;
    return NextResponse.redirect(url);
  }

  const label = req.nextUrl.searchParams.get("label") ?? "Outlook Inbox";
  const email = req.nextUrl.searchParams.get("email") ?? undefined;
  const url = await getAuthorizationUrl(encodeURIComponent(label), email);
  return NextResponse.redirect(url);
}
