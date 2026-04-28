import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export async function POST(req: NextRequest) {
  try {
    const { builderId, planId, billingCycle = "monthly" } = await req.json() as {
      builderId:    string;
      planId:       string;
      billingCycle?: "monthly" | "annually";
    };

    if (!builderId || !planId) {
      return NextResponse.json({ error: "builderId and planId required" }, { status: 400 });
    }

    // Fetch plan for the Stripe price ID
    const { data: plan, error: planErr } = await supabase
      .from("plans").select("*").eq("id", planId).single();
    if (planErr || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const storedPriceId = billingCycle === "annually"
      ? plan.stripe_price_id_annually
      : plan.stripe_price_id_monthly;

    if (!storedPriceId) {
      return NextResponse.json({ error: "Stripe price not configured for this billing cycle" }, { status: 400 });
    }

    // Resolve active price — if the stored price was archived (e.g. after a price change),
    // find the latest active recurring price on the same product and update the DB.
    const priceId = await resolveActivePrice(storedPriceId, billingCycle, planId, supabase);

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
      metadata:   { builder_id: builderId, plan_id: planId, billing_cycle: billingCycle },
      success_url: `${APP_URL}/builder/dashboard?subscribed=1`,
      cancel_url:  `${APP_URL}/builder/subscribe?canceled=1`,
      subscription_data: { metadata: { builder_id: builderId, plan_id: planId } },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("stripe/checkout:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Returns an active Stripe price ID for the given plan.
 * If the stored price was archived, finds the most recent active price on the same
 * product and updates the plan DB row so future checkouts use the right ID.
 */
async function resolveActivePrice(
  storedPriceId: string,
  billingCycle: "monthly" | "annually",
  planId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any
): Promise<string> {
  const price = await stripe.prices.retrieve(storedPriceId);

  if (price.active) return price.id;

  // Price is archived — find the newest active price on the same product
  const productId = typeof price.product === "string" ? price.product : price.product.id;
  const interval  = billingCycle === "annually" ? "year" : "month";

  const { data: prices } = await stripe.prices.list({
    product:   productId,
    active:    true,
    recurring: { interval } as { interval: "month" | "year" },
    limit:     10,
  });

  // Sort by created desc, pick the newest
  const sorted   = prices.sort((a, b) => b.created - a.created);
  const activeId = sorted[0]?.id;

  if (!activeId) {
    throw new Error(`No active ${billingCycle} price found for plan. Please re-save pricing in the admin.`);
  }

  // Heal the DB so next checkout doesn't need this lookup
  const col = billingCycle === "annually" ? "stripe_price_id_annually" : "stripe_price_id_monthly";
  await db.from("plans").update({ [col]: activeId }).eq("id", planId);

  return activeId;
}
