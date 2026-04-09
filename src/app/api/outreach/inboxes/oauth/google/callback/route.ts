import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createOAuth2Client, watchGmailInbox } from "@/lib/outreach/gmail";
import { encrypt } from "@/lib/outreach/crypto";
import { google } from "googleapis";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/admin/outreach/inboxes?error=${encodeURIComponent(error ?? "cancelled")}`, req.url),
    );
  }

  try {
    const oauth2 = createOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    // Fetch the email address
    const oauth2Api = google.oauth2({ version: "v2", auth: oauth2 });
    const userInfo  = await oauth2Api.userinfo.get();
    const email     = userInfo.data.email ?? "";

    const label = state ? decodeURIComponent(state) : "Gmail Inbox";

    // Insert or update the inbox
    const db = supabase();
    const { data: existing } = await db
      .from("outreach_inboxes")
      .select("id")
      .eq("email_address", email)
      .single();

    const inboxData = {
      label,
      provider:            "gmail",
      email_address:       email,
      oauth_access_token:  tokens.access_token  ? encrypt(tokens.access_token)  : null,
      oauth_refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      oauth_expires_at:    tokens.expiry_date   ? new Date(tokens.expiry_date).toISOString() : null,
      status:              "active",
    };

    let inboxId: string;

    if (existing) {
      await db.from("outreach_inboxes").update(inboxData).eq("id", existing.id);
      inboxId = existing.id;
    } else {
      const { data } = await db.from("outreach_inboxes").insert(inboxData).select("id").single();
      inboxId = data?.id ?? "";
    }

    // Set up Gmail Pub/Sub watch for reply detection
    if (inboxId) {
      const { data: inbox } = await db
        .from("outreach_inboxes")
        .select("*")
        .eq("id", inboxId)
        .single();
      if (inbox) {
        await watchGmailInbox(inbox).catch(console.error); // non-fatal
      }
    }

    return NextResponse.redirect(new URL("/admin/outreach/inboxes?success=gmail", req.url));
  } catch (err) {
    console.error("Gmail OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/admin/outreach/inboxes?error=oauth_failed", req.url),
    );
  }
}
