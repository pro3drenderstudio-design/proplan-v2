import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ builderId: string }> },
) {
  const { builderId } = await params;
  const { action, value } = await req.json().catch(() => ({}));

  if (!action || !value) {
    return NextResponse.json({ error: "action and value are required" }, { status: 400 });
  }

  // Get the profile (auth user ID) for this builder
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile, error: profileError } = await (supabase.from("profiles") as any)
    .select("id")
    .eq("builder_id", builderId)
    .limit(1)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "No auth user found for this builder" }, { status: 404 });
  }

  if (action === "change_email") {
    const { error } = await supabase.auth.admin.updateUserById(profile.id, { email: value });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Also update contact_email on builder profile for consistency
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("builders") as any)
      .update({ contact_email: value })
      .eq("id", builderId);
    return NextResponse.json({ ok: true });
  }

  if (action === "change_password") {
    if (value.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    const { error } = await supabase.auth.admin.updateUserById(profile.id, { password: value });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
