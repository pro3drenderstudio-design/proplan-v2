import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await context.params;
    const body = await req.json() as Record<string, unknown>;

    // Fetch current plan to compare prices
    const { data: plan, error: fetchErr } = await supabase
      .from("plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (fetchErr || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // ── Persist all non-Stripe-ID fields ─────────────────────────────────────
    // Strip out stripe_price_id fields — those get their own targeted update below
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { stripe_price_id_monthly: _m, stripe_price_id_annually: _a, ...otherFields } = body as Record<string, unknown>;

    const { error: updateErr } = await (supabase.from("plans") as any)
      .update(otherFields)
      .eq("id", planId);

    if (updateErr) {
      console.error("admin/plans PATCH (fields):", updateErr.message);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // ── Sync Stripe prices if amounts changed ─────────────────────────────────
    const newMonthly = typeof body.price_monthly === "number" ? body.price_monthly : null;
    const newAnnual  = typeof body.price_annually === "number" ? body.price_annually : null;

    const monthlyChanged = newMonthly !== null && newMonthly !== plan.price_monthly;
    const annualChanged  = newAnnual  !== null && newAnnual  !== plan.price_annually;

    let finalMonthlyId = plan.stripe_price_id_monthly as string | null;
    let finalAnnualId  = plan.stripe_price_id_annually as string | null;

    if (monthlyChanged || annualChanged) {
      const productId = await getOrCreateProduct(
        plan.stripe_price_id_monthly ?? plan.stripe_price_id_annually,
        plan.display_name as string
      );

      if (productId) {
        if (monthlyChanged) {
          const id = await syncStripePrice(plan.stripe_price_id_monthly, newMonthly!, "month", productId);
          if (id) finalMonthlyId = id;
        }
        if (annualChanged) {
          const id = await syncStripePrice(plan.stripe_price_id_annually, newAnnual!, "year", productId);
          if (id) finalAnnualId = id;
        }

        // Write updated Stripe price IDs as a dedicated update
        const stripeIdUpdate: Record<string, string | null> = {};
        if (monthlyChanged && finalMonthlyId !== plan.stripe_price_id_monthly) stripeIdUpdate.stripe_price_id_monthly  = finalMonthlyId;
        if (annualChanged  && finalAnnualId  !== plan.stripe_price_id_annually)  stripeIdUpdate.stripe_price_id_annually = finalAnnualId;

        if (Object.keys(stripeIdUpdate).length > 0) {
          const { error: stripeErr } = await (supabase.from("plans") as any)
            .update(stripeIdUpdate)
            .eq("id", planId);
          if (stripeErr) console.error("admin/plans PATCH (stripe IDs):", stripeErr.message);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      stripe_price_id_monthly:  finalMonthlyId,
      stripe_price_id_annually: finalAnnualId,
    });
  } catch (err) {
    console.error("admin/plans PATCH error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/** Resolve the Stripe Product ID from an existing price, or create a new product. */
async function getOrCreateProduct(existingPriceId: string | null, planDisplayName: string): Promise<string | null> {
  // Try to extract product from existing price first
  if (existingPriceId) {
    try {
      const price = await stripe.prices.retrieve(existingPriceId);
      return typeof price.product === "string" ? price.product : price.product.id;
    } catch {
      // Price ID invalid or not found — fall through to create a new product
    }
  }

  // Create a fresh Stripe product for this plan
  try {
    const product = await stripe.products.create({
      name: `ProPlan Studio — ${planDisplayName}`,
      metadata: { plan_name: planDisplayName },
    });
    return product.id;
  } catch (err) {
    console.error("getOrCreateProduct: failed to create product:", err);
    return null;
  }
}

/** Create a new Stripe price on the product, archive the old one if it exists. */
async function syncStripePrice(
  oldPriceId: string | null,
  newAmountCents: number,
  interval: "month" | "year",
  productId: string
): Promise<string | null> {
  try {
    const newPrice = await stripe.prices.create({
      unit_amount: newAmountCents,
      currency: "usd",
      recurring: { interval },
      product: productId,
    });

    // Archive old price (best-effort)
    if (oldPriceId) {
      await stripe.prices.update(oldPriceId, { active: false }).catch(() => {});
    }

    return newPrice.id;
  } catch (err) {
    console.error("syncStripePrice failed:", err);
    return null;
  }
}
