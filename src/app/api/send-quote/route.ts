import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL ?? "quotes@proplan.app";

export async function POST(req: NextRequest) {
  if (!apiKey) {
    // Email not configured — quote was already downloaded, just acknowledge
    return NextResponse.json({ success: true, skipped: true });
  }

  try {
    const { to, firstName, projectName, pdfBase64 } = await req.json() as {
      to: string;
      firstName: string;
      projectName: string;
      pdfBase64: string;
    };

    const resend = new Resend(apiKey);

    await resend.emails.send({
      from: fromEmail,
      to,
      subject: `Your ${projectName} Configuration Quote`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
          <h2 style="color:#0f172a">Hi ${firstName},</h2>
          <p style="color:#475569">
            Thank you for configuring your dream home.
            Please find your personalised quote attached to this email.
          </p>
          <p style="color:#475569">
            Our team will be in touch shortly to discuss next steps.
          </p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
          <p style="font-size:12px;color:#94a3b8">
            ${projectName} · Powered by ProPlan
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `${projectName.replace(/\s+/g, "-")}-quote.pdf`,
          content: pdfBase64,
        },
      ],
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("send-quote route:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
