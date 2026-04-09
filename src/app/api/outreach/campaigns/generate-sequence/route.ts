import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-3-flash-preview";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 400 });

  const {
    product_name,
    target_audience,
    value_prop,
    tone = "professional",
    num_emails = 3,
    wait_days_between = 3,
  } = await req.json();

  if (!product_name || !target_audience || !value_prop) {
    return NextResponse.json({ error: "product_name, target_audience, and value_prop are required" }, { status: 400 });
  }

  const prompt = `Generate a cold email sequence for the following:

Product/Service: ${product_name}
Target audience: ${target_audience}
Value proposition: ${value_prop}
Tone: ${tone}
Number of emails: ${num_emails}
Days between each email: ${wait_days_between}

Rules:
- Each email must be SHORT (3–5 sentences max for the body)
- No fluff, no generic phrases like "I hope this email finds you well"
- Subject lines must be curiosity-driven or direct (not clickbait)
- Use {{first_name}}, {{company}}, {{title}} as variables where natural
- The sequence should start with a cold intro, then follow-ups that add value or change angle
- Final email should be a "breakup" style (last attempt)

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "steps": [
    { "type": "email", "subject": "...", "body": "..." },
    { "type": "wait", "wait_days": ${wait_days_between} },
    { "type": "email", "subject": "...", "body": "..." }
  ]
}

The steps array must alternate: email, wait, email, wait, email (${num_emails} emails total with wait steps between them).`;

  try {
    const genai = new GoogleGenerativeAI(apiKey);
    const model = genai.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(prompt);
    const raw = result.response.text();

    const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    const parsed = JSON.parse(cleaned);
    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
