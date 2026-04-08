import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  try {
    const { requestId } = await req.json() as { requestId: string };
    if (!requestId) {
      return NextResponse.json({ error: "requestId required" }, { status: 400 });
    }

    // Fetch the project request
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: request, error: reqErr } = await (supabase.from("project_requests") as any)
      .select("project_name, builder_id, status")
      .eq("id", requestId)
      .single();

    if (reqErr || !request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (request.status !== "awaiting_payment") {
      return NextResponse.json({ error: "Payment not required for this request" }, { status: 400 });
    }
    if (!request.builder_id) {
      return NextResponse.json({ error: "Builder not associated with this request" }, { status: 400 });
    }

    // Fetch builder for Stripe customer + their plan's model_setup_fee
    const { data: builder } = await supabase
      .from("builders")
      .select("id, company_name, contact_email, stripe_customer_id, plan_id")
      .eq("id", request.builder_id)
      .single();

    if (!builder) {
      return NextResponse.json({ error: "Builder not found" }, { status: 404 });
    }

    // Resolve setup fee: prefer plan DB value, fall back to env var, then $1,000 default
    let setupFeeUnitAmount = 100000; // $1,000 in cents
    if (builder.plan_id) {
      const { data: plan } = await supabase
        .from("plans")
        .select("model_setup_fee")
        .eq("id", builder.plan_id)
        .single();
      if (plan?.model_setup_fee) setupFeeUnitAmount = plan.model_setup_fee;
    } else if (process.env.STRIPE_SETUP_FEE_PRICE_ID) {
      // Legacy: if a Stripe price ID is configured use it via line_items
      const priceId = process.env.STRIPE_SETUP_FEE_PRICE_ID;
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
        customer:   customerId,
        mode:       "payment",
        line_items: [{ price: priceId, quantity: 1 }],
        metadata:   { project_request_id: requestId, builder_id: builder.id },
        success_url: `${APP_URL}/builder/projects?payment=success`,
        cancel_url:  `${APP_URL}/builder/projects?payment=canceled&request=${requestId}`,
      });
      return NextResponse.json({ url: session.url });
    }

    // Create or reuse Stripe customer
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

    // Create ad-hoc checkout using the plan's model_setup_fee amount
    const session = await stripe.checkout.sessions.create({
      customer:   customerId,
      mode:       "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency:     "usd",
          unit_amount:  setupFeeUnitAmount,
          product_data: {
            name:        `Model Setup Fee — ${request.project_name}`,
            description: "One-time fee to build and configure your 3D home model configurator.",
          },
        },
      }],
      metadata:    { project_request_id: requestId, builder_id: builder.id },
      success_url: `${APP_URL}/builder/projects?payment=success`,
      cancel_url:  `${APP_URL}/builder/projects?payment=canceled&request=${requestId}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("stripe/setup-fee:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
