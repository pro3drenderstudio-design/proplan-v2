import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ builderId: string }> },
) {
  const { builderId } = await params;

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

  // Get the user's email from auth.users
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(profile.id);
  if (userError || !userData?.user?.email) {
    return NextResponse.json({ error: "Could not retrieve builder email" }, { status: 500 });
  }

  // Generate magic link
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/builder/dashboard` },
  });

  if (linkError || !linkData) {
    return NextResponse.json({ error: linkError?.message ?? "Failed to generate link" }, { status: 500 });
  }

  return NextResponse.json({
    link: linkData.properties?.action_link,
    email: userData.user.email,
  });
}
