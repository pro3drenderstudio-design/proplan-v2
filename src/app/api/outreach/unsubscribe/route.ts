import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyUnsubscribeToken } from "@/lib/outreach/template";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  const token = req.nextUrl.searchParams.get("token");

  if (!email || !token || !verifyUnsubscribeToken(email, token)) {
    return new NextResponse(errorPage("Invalid or expired unsubscribe link."), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  const db = supabase();

  // Insert into global unsubscribe list
  await db
    .from("outreach_unsubscribes")
    .upsert({ email: email.toLowerCase(), source: "link_click" }, { onConflict: "email" });

  // Mark lead as unsubscribed
  await db
    .from("outreach_leads")
    .update({ status: "unsubscribed" })
    .eq("email", email.toLowerCase());

  // Stop any active enrollments
  await db
    .from("outreach_enrollments")
    .update({ status: "unsubscribed" })
    .eq("status", "active")
    .in(
      "lead_id",
      (await db.from("outreach_leads").select("id").eq("email", email.toLowerCase())).data?.map((l) => l.id) ?? [],
    );

  return new NextResponse(successPage(email), {
    headers: { "Content-Type": "text/html" },
  });
}

function successPage(email: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title>
<style>body{font-family:system-ui,sans-serif;background:#050508;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.box{max-width:400px;text-align:center;padding:40px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;}
h1{font-size:22px;margin-bottom:12px;}p{color:rgba(255,255,255,0.5);font-size:14px;line-height:1.6;}</style></head>
<body><div class="box"><h1>You've been unsubscribed</h1>
<p>${email} has been removed from our mailing list. You won't receive any further emails from us.</p>
</div></body></html>`;
}

function errorPage(msg: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Error</title>
<style>body{font-family:system-ui,sans-serif;background:#050508;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.box{max-width:400px;text-align:center;padding:40px;}</style></head>
<body><div class="box"><h1>Error</h1><p>${msg}</p></div></body></html>`;
}
