import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.RESEND_FROM_EMAIL ?? "notifications@proplanstudio.com";

function base(title: string, body: string): string {
  return `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:560px;margin:40px auto;background:#111;border-radius:12px;border:1px solid #222;overflow:hidden;">
  <div style="background:#1a1a1a;padding:24px 32px;border-bottom:1px solid #222;">
    <span style="color:#fff;font-weight:700;font-size:16px;">ProPlan Studio</span>
  </div>
  <div style="padding:32px;">
    <h2 style="color:#fff;font-size:20px;font-weight:700;margin:0 0 12px;">${title}</h2>
    <div style="color:#aaa;font-size:14px;line-height:1.6;">${body}</div>
  </div>
  <div style="background:#0e0e0e;padding:16px 32px;border-top:1px solid #222;">
    <p style="color:#555;font-size:12px;margin:0;">ProPlan Studio · Automated notification</p>
  </div>
</div>
</body></html>`.trim();
}

export async function sendEmail({
  to,
  subject,
  title,
  body,
}: {
  to: string;
  subject: string;
  title: string;
  body: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY || !to) return;
  try {
    await resend.emails.send({
      from:    FROM,
      to,
      subject,
      html:    base(title, body),
    });
  } catch (e) {
    console.error("[resend] sendEmail error:", e);
  }
}
