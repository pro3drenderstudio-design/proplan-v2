import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ builderId: string }> },
) {
  const { builderId } = await params;
  const { subject, body } = await req.json().catch(() => ({}));

  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "Subject and body are required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: builder } = await (supabase.from("builders") as any)
    .select("contact_email, company_name")
    .eq("id", builderId)
    .single();

  if (!builder?.contact_email) {
    return NextResponse.json({ error: "Builder has no contact email" }, { status: 400 });
  }

  // Convert plain text line breaks to HTML for the email template
  const htmlBody = body
    .split("\n")
    .map((line: string) => line.trim() ? `<p style="margin:0 0 10px;">${line}</p>` : "<br/>")
    .join("");

  await sendEmail({
    to:      builder.contact_email,
    subject: subject.trim(),
    title:   subject.trim(),
    body:    htmlBody,
  });

  return NextResponse.json({ ok: true, sentTo: builder.contact_email });
}
