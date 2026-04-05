import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyRenderMessageToAdmin, notifyRenderMessageToBuilder, notifyRenderDelivery } from "@/lib/notify";

export const dynamic = "force-dynamic";

// Service-role client — bypasses RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await params;

  const { data, error } = await (supabase.from("render_messages") as AnyQuery)
    .select("*")
    .eq("render_request_id", requestId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("render-messages GET:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await params;

  const body = await req.json() as {
    sender_type: "builder" | "admin";
    sender_id:   string;
    sender_name: string;
    body:        string | null;
    attachments: unknown[];
    is_delivery: boolean;
  };

  const { data, error } = await (supabase.from("render_messages") as AnyQuery)
    .insert({
      render_request_id: requestId,
      sender_type:       body.sender_type,
      sender_id:         body.sender_id,
      sender_name:       body.sender_name,
      body:              body.body ?? null,
      attachments:       body.attachments ?? [],
      is_delivery:       body.is_delivery ?? false,
    })
    .select()
    .single();

  if (error) {
    console.error("render-messages POST:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If this is a delivery message, also update render_request status
  if (body.is_delivery) {
    const { error: updateErr } = await (supabase.from("render_requests") as AnyQuery)
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("id", requestId);
    if (updateErr) {
      console.warn("render-messages: failed to update request status:", updateErr.message);
    }
    notifyRenderDelivery(requestId).catch(console.error);
  } else {
    if (body.sender_type === "builder") {
      notifyRenderMessageToAdmin(requestId, body.sender_name, body.body).catch(console.error);
    } else {
      notifyRenderMessageToBuilder(requestId, body.sender_name, body.body).catch(console.error);
    }
  }

  return NextResponse.json(data);
}
