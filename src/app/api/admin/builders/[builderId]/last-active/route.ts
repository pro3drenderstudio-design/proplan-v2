import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ builderId: string }> },
) {
  const { builderId } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase.from("profiles") as any)
    .select("id")
    .eq("builder_id", builderId)
    .limit(1)
    .single();

  if (!profile) return NextResponse.json({ lastSignIn: null, email: null });

  const { data: userData } = await supabase.auth.admin.getUserById(profile.id);
  return NextResponse.json({
    lastSignIn: userData?.user?.last_sign_in_at ?? null,
    email:      userData?.user?.email ?? null,
    createdAt:  userData?.user?.created_at ?? null,
  });
}
