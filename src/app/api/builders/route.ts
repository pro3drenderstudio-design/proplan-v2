import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyBuilderWelcome, notifyAdminNewBuilder } from "@/lib/notify";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    user_id:      string;
    email:        string;
    full_name:    string;
    company_name: string;
    company_slug: string;
    phone?:       string | null;
    location?:    string | null;
  };

  if (!body.user_id || !body.email || !body.company_name || !body.company_slug) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: builder, error: builderErr } = await supabase
    .from("builders")
    .insert({
      company_name:            body.company_name,
      company_slug:            body.company_slug,
      primary_contact_name:    body.full_name,
      contact_email:           body.email,
      phone:                   body.phone ?? null,
      location:                body.location ?? null,
      plan_tier:               "starter",
      billing_cycle:           "monthly",
      status:                  "trial",
      accent_color:            "#3B82F6",
      seats_included:          10,
      seats_used:              1,
      rendering_credits:       250,
      rendering_credits_total: 250,
      max_projects:            5,
      max_monthly_quotes:      25,
      max_storage_gb:          10,
      active_projects_count:   0,
      monthly_quotes_count:    0,
      storage_used_gb:         0,
    })
    .select()
    .single();

  if (builderErr || !builder) {
    console.error("POST /api/builders:", builderErr?.message);
    return NextResponse.json({ error: builderErr?.message ?? "Failed to create builder" }, { status: 500 });
  }

  // Create profile linking auth user → builder
  await supabase.from("profiles").insert({
    id:         body.user_id,
    email:      body.email,
    full_name:  body.full_name,
    role:       "builder_admin",
    builder_id: builder.id,
  });

  // Fire notifications (best-effort — never block signup on email failure)
  Promise.all([
    notifyBuilderWelcome(builder.id),
    notifyAdminNewBuilder(builder.id, body.company_name, body.email),
  ]).catch(err => console.error("Signup notifications failed:", err));

  return NextResponse.json({ id: builder.id }, { status: 201 });
}
