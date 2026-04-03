import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resendKey  = process.env.RESEND_API_KEY;
const fromEmail  = process.env.RESEND_FROM_EMAIL ?? "noreply@proplan.app";
const supportTo  = process.env.SUPPORT_EMAIL ?? "support@proplan.app";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const { subject, category, priority, message, builderName, builderEmail } =
    await req.json() as {
      subject: string;
      category: string;
      priority: string;
      message: string;
      builderName?: string;
      builderEmail?: string;
    };

  if (!subject || !message) {
    return NextResponse.json({ error: "subject and message required" }, { status: 400 });
  }

  // Persist to DB (best-effort — table may not exist yet)
  const { data: ticket } = await supabase.from("support_tickets").insert({
    builder_name:  builderName  ?? null,
    builder_email: builderEmail ?? null,
    subject,
    category,
    priority,
    message,
    status: "open",
  }).select("id").single();

  const ticketId = (ticket as { id: string } | null)?.id;

  if (!resendKey) {
    console.log("[Support ticket]", { id: ticketId, subject, category, priority, message, builderName, builderEmail });
    return NextResponse.json({ success: true, skipped: true, id: ticketId });
  }

  const resend = new Resend(resendKey);
  await resend.emails.send({
    from: fromEmail,
    to:   supportTo,
    replyTo: builderEmail ?? fromEmail,
    subject: `[Support] [${priority.toUpperCase()}] ${subject}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#0f172a;">
        <div style="background:#0f172a;padding:24px 32px;border-radius:12px 12px 0 0;">
          <p style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.1em;margin:0;">ProPlan Studio — Support Ticket${ticketId ? ` #${ticketId.slice(-6).toUpperCase()}` : ""}</p>
        </div>
        <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;">
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
            <tr><td style="padding:6px 0;color:#64748b;font-size:12px;width:100px;">From</td><td style="font-size:13px;color:#0f172a;">${builderName ?? "Unknown"} &lt;${builderEmail ?? "—"}&gt;</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;font-size:12px;">Category</td><td style="font-size:13px;color:#0f172a;">${category}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;font-size:12px;">Priority</td><td style="font-size:13px;color:#0f172a;font-weight:600;text-transform:uppercase;">${priority}</td></tr>
          </table>
          <h2 style="margin:0 0 12px;font-size:16px;color:#0f172a;">${subject}</h2>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
            <p style="margin:0;font-size:13px;color:#334155;white-space:pre-wrap;">${message}</p>
          </div>
        </div>
      </div>
    `,
  });

  return NextResponse.json({ success: true, id: ticketId });
}
