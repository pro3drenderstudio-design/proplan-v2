import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service-role client bypasses RLS — only used to expose non-sensitive public fields
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ companySlug: string }> }
) {
  const { companySlug } = await params;

  if (!companySlug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("builders")
    .select("id,company_name,logo_url,accent_color,contact_email,phone,billing_address,city,state,zip,website_url")
    .eq("company_slug", companySlug)
    .single();

  if (error || !data) {
    // Not found — return empty so the configurator degrades gracefully
    return NextResponse.json(null, { status: 200 });
  }

  return NextResponse.json(data);
}
