import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const { data, error } = await supabase.from("addons").select("*").eq("slug", slug).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const body = await req.json() as Record<string, unknown>;

    const { data: existing, error: fetchErr } = await supabase
      .from("addons").select("*").eq("slug", slug).single();
    if (fetchErr || !existing) return NextResponse.json({ error: "Addon not found" }, { status: 404 });

    // Strip Stripe ID fields — handled separately below
    const { stripe_price_id_monthly: _m, stripe_price_id_annually: _a, ...otherFields } = body;

    const { error: updateErr } = await supabase.from("addons").update(otherFields).eq("slug", slug);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    // Sync Stripe recurring prices if monthly_price_cents changed
    const newPrice = typeof body.monthly_price_cents === "number" ? body.monthly_price_cents : null;
    const priceChanged = newPrice !== null && newPrice !== existing.monthly_price_cents;

    let finalMonthlyId  = existing.stripe_price_id_monthly  as string | null;
    let finalAnnualId   = existing.stripe_price_id_annually as string | null;

    if (priceChanged) {
      const productId = await getOrCreateProduct(
        existing.stripe_price_id_monthly ?? existing.stripe_price_id_annually,
        existing.name as string,
        slug as string
      );
      if (productId) {
        const annualPrice = Math.round(newPrice * 12 * 0.85); // 15% annual discount
        const [mId, aId] = await Promise.all([
          syncStripePrice(existing.stripe_price_id_monthly, newPrice, "month", productId),
          syncStripePrice(existing.stripe_price_id_annually, annualPrice, "year",  productId),
        ]);
        if (mId) finalMonthlyId = mId;
        if (aId) finalAnnualId  = aId;

        await supabase.from("addons").update({
          stripe_price_id_monthly:  finalMonthlyId,
          stripe_price_id_annually: finalAnnualId,
        }).eq("slug", slug);
      }
    }

    // Allow manual Stripe ID overrides
    const manualMonthly = typeof _m === "string" ? _m : null;
    const manualAnnual  = typeof _a === "string" ? _a : null;
    if (manualMonthly !== null || manualAnnual !== null) {
      const stripeUpdate: Record<string, string | null> = {};
      if (manualMonthly !== null) { stripeUpdate.stripe_price_id_monthly  = manualMonthly; finalMonthlyId = manualMonthly; }
      if (manualAnnual  !== null) { stripeUpdate.stripe_price_id_annually = manualAnnual;  finalAnnualId  = manualAnnual; }
      await supabase.from("addons").update(stripeUpdate).eq("slug", slug);
    }

    return NextResponse.json({ ok: true, stripe_price_id_monthly: finalMonthlyId, stripe_price_id_annually: finalAnnualId });
  } catch (err) {
    console.error("admin/addons PATCH error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function getOrCreateProduct(existingPriceId: string | null, addonName: string, slug: string): Promise<string | null> {
  if (existingPriceId) {
    try {
      const price = await stripe.prices.retrieve(existingPriceId);
      return typeof price.product === "string" ? price.product : price.product.id;
    } catch { /* fall through */ }
  }
  try {
    const product = await stripe.products.create({
      name: `ProPlan Studio — ${addonName}`,
      metadata: { addon_slug: slug },
    });
    return product.id;
  } catch (err) {
    console.error("getOrCreateProduct (addon):", err);
    return null;
  }
}

async function syncStripePrice(
  oldPriceId: string | null,
  amountCents: number,
  interval: "month" | "year",
  productId: string
): Promise<string | null> {
  try {
    const newPrice = await stripe.prices.create({
      unit_amount: amountCents,
      currency: "usd",
      recurring: { interval },
      product: productId,
    });
    if (oldPriceId) await stripe.prices.update(oldPriceId, { active: false }).catch(() => {});
    return newPrice.id;
  } catch (err) {
    console.error("syncStripePrice (addon):", err);
    return null;
  }
}
