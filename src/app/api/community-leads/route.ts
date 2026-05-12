import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      community_id?:   string | null;
      community_name?: string | null;
      community_slug?: string | null;
      lot_id?:         string | null;
      lot_number?:     string | null;
      project_id?:     string | null;
      first_name:      string;
      last_name:       string;
      email:           string;
      phone?:          string | null;
      message?:        string | null;
    };

    if (!body.first_name?.trim() || !body.email?.trim()) {
      return NextResponse.json({ error: "first_name and email are required" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lead, error } = await (supabase.from("leads") as any).insert({
      project_id:     body.project_id     ?? null,
      first_name:     body.first_name.trim(),
      last_name:      body.last_name?.trim() ?? "",
      email:          body.email.trim(),
      phone:          body.phone          ?? null,
      configuration:  { message: body.message ?? null, source: "site_map_contact" },
      total_value:    0,
      status:         "new",
      lot_number:     body.lot_number     ?? null,
      community_slug: body.community_slug ?? null,
      community_name: body.community_name ?? null,
    }).select("id").single();

    if (error) {
      console.error("POST /api/community-leads:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Push to builder's CRM if configured (best-effort, non-blocking)
    if (body.project_id) {
      try {
        const { data: proj } = await supabase
          .from("projects")
          .select("builder_id:company_slug")
          .eq("id", body.project_id)
          .single();

        if (proj) {
          // CRM push via lib once crm.ts is implemented
          // pushLeadToCRM(proj.builder_id, { ... })
        }
      } catch { /* non-critical */ }
    }

    return NextResponse.json({ id: lead.id }, { status: 201 });
  } catch (err) {
    console.error("POST /api/community-leads error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
