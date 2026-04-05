import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  notifyProjectMessageToAdmin,
  notifyProjectMessageToBuilder,
} from "@/lib/notify";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const { data, error } = await (supabase.from("project_messages") as AnyQuery)
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("project-messages GET:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const body = await req.json() as {
    sender_type: "builder" | "admin";
    sender_id:   string;
    sender_name: string;
    body:        string | null;
    attachments: unknown[];
  };

  const { data, error } = await (supabase.from("project_messages") as AnyQuery)
    .insert({
      project_id:  projectId,
      sender_type: body.sender_type,
      sender_id:   body.sender_id,
      sender_name: body.sender_name,
      body:        body.body ?? null,
      attachments: body.attachments ?? [],
    })
    .select()
    .single();

  if (error) {
    console.error("project-messages POST:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire notifications (non-blocking)
  if (body.sender_type === "builder") {
    notifyProjectMessageToAdmin(projectId, body.sender_name, body.body).catch(console.error);
  } else {
    notifyProjectMessageToBuilder(projectId, body.sender_name, body.body).catch(console.error);
  }

  return NextResponse.json(data);
}
