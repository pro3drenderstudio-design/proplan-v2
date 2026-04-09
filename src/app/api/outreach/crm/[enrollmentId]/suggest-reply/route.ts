import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-3-flash-preview";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> },
) {
  const { enrollmentId } = await params;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 400 });

  const db = supabase();

  const { data: enrollment } = await db
    .from("outreach_enrollments")
    .select("id, campaign_id, lead_id, crm_status")
    .eq("id", enrollmentId)
    .single();

  if (!enrollment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ data: lead }, { data: campaign }, { data: sends }, { data: notes }] = await Promise.all([
    db.from("outreach_leads").select("first_name, last_name, email, company, title").eq("id", enrollment.lead_id).single(),
    db.from("outreach_campaigns").select("name").eq("id", enrollment.campaign_id).single(),
    db.from("outreach_sends").select("subject, body, replied_at, sent_at").eq("enrollment_id", enrollmentId).order("sent_at", { ascending: false }).limit(3),
    db.from("outreach_crm_notes").select("body").eq("lead_id", enrollment.lead_id).order("created_at", { ascending: false }).limit(3),
  ]);

  const leadName = [lead?.first_name, lead?.last_name].filter(Boolean).join(" ") || lead?.email || "the lead";
  const context = [
    `Campaign: ${campaign?.name ?? "unknown"}`,
    `Lead: ${leadName}${lead?.title ? `, ${lead.title}` : ""}${lead?.company ? ` at ${lead.company}` : ""}`,
    `CRM status: ${enrollment.crm_status}`,
    `\nEmails sent (most recent first):`,
    ...(sends ?? []).map((s, i) => `[Email ${i + 1}] Subject: ${s.subject}\n${s.body?.slice(0, 500)}`),
    ...(notes?.length ? [`\nCRM Notes:\n${notes.map((n) => n.body).join("\n")}`] : []),
  ].join("\n");

  const prompt = `You are helping a sales rep write a follow-up reply to a cold email conversation.

Context:
${context}

Write a short, professional, and friendly reply the sales rep can send. Keep it to 3–5 sentences. Be conversational, not salesy. Reference the context naturally. Return ONLY the reply body — no subject line, no explanations.`;

  try {
    const genai = new GoogleGenerativeAI(apiKey);
    const model = genai.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(prompt);
    const suggestion = result.response.text();
    return NextResponse.json({ suggestion });
  } catch (err) {
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
