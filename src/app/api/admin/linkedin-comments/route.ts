import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const STYLE_DIRECTIVES: Record<string, string> = {
  insight:      "Add a unique perspective or insight the poster didn't consider. Draw from PropTech, home building industry, or your founder experience. Expand the conversation meaningfully.",
  question:     "Ask a genuine, specific question that proves you read the post carefully and invites a real reply. The question should be something you actually want answered, not rhetorical.",
  founder:      "Connect a brief personal or ProPlan Studio experience to the post's point. Make it specific — reference something real about building the company, working with builders, or the industry.",
  contrarian:   "Respectfully challenge the premise, push back on an assumption, or offer a meaningfully different angle. Be direct but not aggressive. This style gets the most engagement when done right.",
  punchy:       "One or two sentences maximum. Make it sharp, memorable, and impossible to scroll past. No fluff — every word earns its place.",
};

const TONE_DIRECTIVES: Record<string, string> = {
  measured: "Thoughtful and confident. You have a clear point of view but express it with nuance.",
  bold:     "More direct and assertive. Say the thing most people are thinking but not saying.",
  spicy:    "Strong take, no hedging. You're willing to be provocative if the post warrants it. Still professional, but with real edge.",
};

function buildSystemPrompt(persona: Record<string, string>): string {
  const banned = persona.banned_phrases
    ? persona.banned_phrases.split(",").map((p: string) => p.trim()).filter(Boolean)
    : [];

  return `You are a LinkedIn comment writer for ${persona.name}, ${persona.title} of ${persona.company}.

ABOUT ${persona.name.toUpperCase()}:
${persona.company_description || ""}

Expertise: ${persona.expertise_areas || "PropTech, Real Estate Technology, SaaS, Startup Building"}
Industries they engage with: ${persona.industries || "Home Builders, Real Estate, PropTech, SaaS"}
${persona.personal_background ? `\nPersonal background: ${persona.personal_background}` : ""}
${persona.recent_milestones ? `\nRecent milestones/news: ${persona.recent_milestones}` : ""}
${persona.hot_takes ? `\nStrong beliefs and hot takes: ${persona.hot_takes}` : ""}
${persona.writing_style ? `\nWriting style notes: ${persona.writing_style}` : ""}
${persona.extra_context ? `\nAdditional context: ${persona.extra_context}` : ""}

COMMENT RULES — NON-NEGOTIABLE:
1. Never use these phrases: ${banned.length > 0 ? banned.join(", ") : "Great post, This resonates, Couldn't agree more, So true"}
2. Always be specific to the actual content of the post — reference real points made
3. Sound like a real thoughtful human, not AI-generated content
4. Have a clear point of view — no wishy-washy fence-sitting
5. 2–4 sentences unless the style calls for shorter
6. Conversational, not corporate
7. Only reference ${persona.company} or PropTech experience when it's genuinely relevant — don't force it
8. Each of the 4 variations must take a distinctly different angle — not just rephrasing the same point

OUTPUT FORMAT:
Return a JSON array of exactly 4 objects. Nothing else — no markdown, no explanation, just the JSON.
[
  { "id": 1, "comment": "..." },
  { "id": 2, "comment": "..." },
  { "id": 3, "comment": "..." },
  { "id": 4, "comment": "..." }
]`;
}

function buildUserPrompt(
  postContent: string,
  style: string,
  tone: string,
  customAngle?: string,
): string {
  const styleDirective = STYLE_DIRECTIVES[style] ?? STYLE_DIRECTIVES.insight;
  const toneDirective  = TONE_DIRECTIVES[tone]   ?? TONE_DIRECTIVES.measured;

  return `POST CONTENT:
${postContent}

STYLE: ${style.toUpperCase()}
${styleDirective}

TONE: ${tone.toUpperCase()}
${toneDirective}
${customAngle ? `\nSPECIFIC ANGLE TO WORK IN: ${customAngle}` : ""}

Generate 4 distinct comment variations. Each must take a different angle within this style.`;
}

export async function POST(req: NextRequest) {
  const { postContent, style, tone, customAngle } = await req.json().catch(() => ({}));

  if (!postContent?.trim()) {
    return NextResponse.json({ error: "Post content is required" }, { status: 400 });
  }

  // Fetch persona
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: persona } = await (supabase.from("linkedin_persona") as any)
    .select("*").limit(1).single();

  const systemPrompt = buildSystemPrompt(persona ?? {});
  const userPrompt   = buildUserPrompt(postContent, style ?? "insight", tone ?? "measured", customAngle);

  try {
    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 1024,
      system:     systemPrompt,
      messages:   [{ role: "user", content: userPrompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";

    let comments: { id: number; comment: string }[] = [];
    try {
      // Strip any accidental markdown code fences
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      comments = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response", raw }, { status: 500 });
    }

    // Save session to DB (best-effort, don't fail the request if this errors)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("linkedin_sessions") as any).insert({
        post_snippet:  postContent.slice(0, 120),
        post_content:  postContent,
        style:         style ?? "insight",
        tone:          tone ?? "measured",
        custom_angle:  customAngle ?? null,
        generated:     comments,
      });
    } catch { /* non-fatal */ }

    return NextResponse.json({ comments });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  // Mark a specific comment as used
  const { sessionId, usedComment } = await req.json().catch(() => ({}));
  if (!sessionId) return NextResponse.json({ ok: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("linkedin_sessions") as any)
    .update({ used_comment: usedComment })
    .eq("id", sessionId);

  return NextResponse.json({ ok: true });
}
