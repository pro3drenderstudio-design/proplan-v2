import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const resendKey       = process.env.RESEND_API_KEY;
const fromEmail       = process.env.RESEND_FROM_EMAIL ?? "noreply@proplan.app";
const appUrl          = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  const { memberId } = await req.json() as { memberId: string };
  if (!memberId) {
    return NextResponse.json({ error: "memberId required" }, { status: 400 });
  }

  // Use service role to bypass RLS
  const supabase = createClient(supabaseUrl, supabaseService);

  // Generate a fresh token and record the send time
  const token = crypto.randomUUID();
  const { data: member, error } = await supabase
    .from("team_members")
    .update({ invite_token: token, invite_sent_at: new Date().toISOString() })
    .eq("id", memberId)
    .select("name, email, role, builder_id")
    .single();

  if (error || !member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const inviteUrl = `${appUrl}/auth/invite?token=${token}`;
  const isBuilder = !!member.builder_id;
  const roleLabel = member.role.replace(/_/g, " ");

  // If Resend isn't configured, just return the link so devs can test manually
  if (!resendKey) {
    return NextResponse.json({ success: true, inviteUrl, skipped: true });
  }

  const resend = new Resend(resendKey);
  await resend.emails.send({
    from: fromEmail,
    to: member.email,
    subject: `You've been invited to ProPlan Studio`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#0f172a;">
        <div style="background:#0f172a;padding:32px;border-radius:12px 12px 0 0;text-align:center;">
          <img src="${appUrl}/logo_light.png" alt="ProPlan Studio" style="height:36px;object-fit:contain;" />
        </div>
        <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;">
          <h2 style="margin:0 0 8px;font-size:20px;">Hi ${member.name},</h2>
          <p style="color:#475569;margin:0 0 24px;">
            You've been invited to join ProPlan Studio as a
            <strong style="color:#1e293b;">${roleLabel}</strong>${isBuilder ? " on the builder portal" : " on the admin team"}.
          </p>
          <a href="${inviteUrl}"
            style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;">
            Accept Invitation &amp; Set Password
          </a>
          <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">
            This link expires in 7 days. If you didn't expect this invitation, you can safely ignore this email.
          </p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0 16px;"/>
          <p style="font-size:11px;color:#cbd5e1;margin:0;">ProPlan Studio · Powered by ProPlan</p>
        </div>
      </div>
    `,
  });

  return NextResponse.json({ success: true, inviteUrl });
}
