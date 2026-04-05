import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  try {
    const { builderId, planId, billingCycle } = await req.json() as {
      builderId: string;
      planId:    string;
      billingCycle: "monthly" | "annually";
    };

    if (!builderId || !planId || !billingCycle) {
      return NextResponse.json({ error: "builderId, planId and billingCycle required" }, { status: 400 });
    }

    // Fetch plan for the Stripe price ID
    const { data: plan, error: planErr } = await supabase
      .from("plans").select("*").eq("id", planId).single();
    if (planErr || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const priceId = billingCycle === "annually"
      ? plan.stripe_price_id_annually
      : plan.stripe_price_id_monthly;

    if (!priceId) {
      return NextResponse.json({ error: "Stripe price not configured for this plan" }, { status: 400 });
    }

    // Fetch or create Stripe customer
    const { data: builder } = await supabase
      .from("builders").select("id, company_name, contact_email, stripe_customer_id").eq("id", builderId).single();
    if (!builder) {
      return NextResponse.json({ error: "Builder not found" }, { status: 404 });
    }

    let customerId: string = builder.stripe_customer_id ?? "";
    if (!customerId) {
      const customer = await stripe.customers.create({
        email:    builder.contact_email ?? undefined,
        name:     builder.company_name,
        metadata: { builder_id: builderId },
      });
      customerId = customer.id;
      await supabase.from("builders").update({ stripe_customer_id: customerId }).eq("id", builderId);
    }

    const session = await stripe.checkout.sessions.create({
      customer:   customerId,
      mode:       "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata:   { builder_id: builderId, plan_id: planId },
      success_url: `${APP_URL}/builder/dashboard?subscribed=1`,
      cancel_url:  `${APP_URL}/builder/subscribe?canceled=1`,
      subscription_data: {
        metadata: { builder_id: builderId, plan_id: planId },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("stripe/checkout:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
