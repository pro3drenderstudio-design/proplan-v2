import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const { project_id, project_name, note } = await req.json();

  if (!project_id) {
    return NextResponse.json({ error: "project_id required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("project_requests") as any)
    .insert({
      project_id,
      project_name: project_name ?? null,
      description: note ?? null,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("project_requests insert:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
