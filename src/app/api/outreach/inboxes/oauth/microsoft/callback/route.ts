import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { exchangeCode, createGraphSubscription } from "@/lib/outreach/microsoft";
import { encrypt } from "@/lib/outreach/crypto";

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

  // Admin consent redirect — no code, just a success/error from adminconsent endpoint
  if (state === "admin_consent") {
    if (error) {
      return NextResponse.redirect(new URL(`/admin/outreach/inboxes?error=${encodeURIComponent(error)}`, req.url));
    }
    return NextResponse.redirect(new URL("/admin/outreach/inboxes?success=admin_consent", req.url));
  }

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/admin/outreach/inboxes?error=${encodeURIComponent(error ?? "cancelled")}`, req.url),
    );
  }

  try {
    const tokens = await exchangeCode(code);
    const label  = state ? decodeURIComponent(state) : "Outlook Inbox";

    const db = supabase();
    const { data: existing } = await db
      .from("outreach_inboxes")
      .select("id")
      .eq("email_address", tokens.email)
      .single();

    const inboxData = {
      label,
      provider:            "outlook",
      email_address:       tokens.email,
      oauth_access_token:  encrypt(tokens.accessToken),
      oauth_refresh_token: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
      oauth_expires_at:    tokens.expiresAt,
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

    // Set up Graph subscription for reply detection
    if (inboxId) {
      const { data: inbox } = await db
        .from("outreach_inboxes")
        .select("*")
        .eq("id", inboxId)
        .single();
      if (inbox) {
        await createGraphSubscription(inbox).catch(console.error);
      }
    }

    return NextResponse.redirect(new URL("/admin/outreach/inboxes?success=microsoft", req.url));
  } catch (err) {
    console.error("Microsoft OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/admin/outreach/inboxes?error=oauth_failed", req.url),
    );
  }
}
