import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyNewLead } from "@/lib/notify";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      project_id:    string;
      first_name:    string;
      last_name:     string;
      email:         string;
      phone?:        string | null;
      configuration: Record<string, unknown>;
      total_value:   number;
      lot_number?:   string | null;
      community_slug?: string | null;
      community_name?: string | null;
    };

    if (!body.project_id || !body.first_name || !body.email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Insert lead
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lead, error } = await (supabase.from("leads") as any)
      .insert({
        project_id:     body.project_id,
        first_name:     body.first_name,
        last_name:      body.last_name,
        email:          body.email,
        phone:          body.phone ?? null,
        configuration:  body.configuration,
        total_value:    body.total_value,
        status:         "new",
        lot_number:     body.lot_number     ?? null,
        community_slug: body.community_slug ?? null,
        community_name: body.community_name ?? null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("POST /api/leads:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fire notification (non-blocking — don't fail the request if email fails)
    notifyNewLead(body.project_id, {
      firstName:  body.first_name,
      lastName:   body.last_name,
      email:      body.email,
      phone:      body.phone ?? null,
      totalValue: body.total_value,
    }).catch(err => console.error("notifyNewLead failed:", err));

    return NextResponse.json({ id: lead.id }, { status: 201 });
  } catch (err) {
    console.error("POST /api/leads error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
