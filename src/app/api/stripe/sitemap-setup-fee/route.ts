import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export async function POST(req: NextRequest) {
  try {
    const { requestId } = await req.json() as { requestId: string };
    if (!requestId) return NextResponse.json({ error: "requestId required" }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: request, error: reqErr } = await (supabase.from("site_map_requests") as any)
      .select("community_name, builder_id, status, setup_fee_cents")
      .eq("id", requestId)
      .single();

    if (reqErr || !request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if (request.status !== "awaiting_payment") {
      return NextResponse.json({ error: "Payment not required for this request" }, { status: 400 });
    }

    const { data: builder } = await supabase
      .from("builders")
      .select("id, company_name, contact_email, stripe_customer_id")
      .eq("id", request.builder_id)
      .single();

    if (!builder) return NextResponse.json({ error: "Builder not found" }, { status: 404 });

    let customerId: string = builder.stripe_customer_id ?? "";
    if (!customerId) {
      const customer = await stripe.customers.create({
        email:    builder.contact_email ?? undefined,
        name:     builder.company_name,
        metadata: { builder_id: builder.id },
      });
      customerId = customer.id;
      await supabase.from("builders").update({ stripe_customer_id: customerId }).eq("id", builder.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode:     "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency:     "usd",
          unit_amount:  request.setup_fee_cents,
          product_data: {
            name:        `Interactive Site Map Setup — ${request.community_name}`,
            description: "One-time setup fee to build your interactive plat map with lot management.",
          },
        },
      }],
      metadata: {
        site_map_request_id: requestId,
        builder_id:          builder.id,
      },
      success_url: `${APP_URL}/builder/communities?tab=requests&payment=success`,
      cancel_url:  `${APP_URL}/builder/communities?tab=requests&payment=canceled`,
    });

    // Save session ID on the request
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("site_map_requests") as any)
      .update({ stripe_session_id: session.id })
      .eq("id", requestId);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("stripe/sitemap-setup-fee:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
