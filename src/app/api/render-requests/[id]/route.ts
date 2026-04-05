import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  notifyRenderDateProposal,
  notifyRenderDateAccepted,
  notifyRenderCounterProposed,
  notifyRenderCounterAccepted,
  notifyRenderRevision,
  notifyRenderDeliveryAccepted,
} from "@/lib/notify";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any;

// Service-role client — bypasses RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const body = await req.json() as {
    proposed_completion_date?: string;
    completion_date_status?: string;
    status?: string;
  };

  const { data, error } = await (supabase.from("render_requests") as AnyQuery)
    .update(body as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("render-requests PATCH:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire notifications (non-blocking)
  if (body.completion_date_status === "proposed" && body.proposed_completion_date) {
    notifyRenderDateProposal(id, body.proposed_completion_date).catch(console.error);
  } else if (body.completion_date_status === "accepted" && !body.proposed_completion_date) {
    // Admin accepted builder's counter (no new date in body, keeps existing)
    notifyRenderCounterAccepted(id, data.proposed_completion_date).catch(console.error);
  } else if (body.completion_date_status === "accepted" && body.proposed_completion_date) {
    // Builder accepted admin's proposal
    notifyRenderDateAccepted(id, body.proposed_completion_date).catch(console.error);
  } else if (body.completion_date_status === "counter_proposed" && body.proposed_completion_date) {
    notifyRenderCounterProposed(id, body.proposed_completion_date).catch(console.error);
  }
  if (body.status === "revision_requested") {
    notifyRenderRevision(id).catch(console.error);
  }
  if (body.status === "completed") {
    notifyRenderDeliveryAccepted(id).catch(console.error);
  }

  return NextResponse.json(data);
}
