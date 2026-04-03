import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    name: string;
    slug?: string;
    company_slug?: string | null;
    home_type?: string;
    floors?: number;
    beds?: number;
    baths?: number;
    sqft?: number;
    base_price?: number;
    description?: string;
    status?: string;
  };

  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const slug = body.slug ?? body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const { data, error } = await supabase.from("projects").insert({
    name:          body.name,
    slug,
    company_slug:  body.company_slug  ?? null,
    home_type:     body.home_type     ?? null,
    floors:        body.floors        ?? 1,
    beds:          body.beds          ?? 0,
    baths:         body.baths         ?? 0,
    sqft:          body.sqft          ?? null,
    base_price:    body.base_price    ?? 0,
    description:   body.description   ?? null,
    status:        body.status        ?? "pending_review",
    sketchfab_uid: "",
    camera_defaults: {},
  }).select().single();

  if (error) {
    console.error("POST /api/projects:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
