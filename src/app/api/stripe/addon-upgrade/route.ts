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
    const { builderId, addonSlug } = await req.json() as { builderId: string; addonSlug: string };
    if (!builderId || !addonSlug) {
      return NextResponse.json({ error: "builderId and addonSlug required" }, { status: 400 });
    }

    // Fetch addon pricing
    const { data: addon } = await supabase
      .from("addons")
      .select("name, stripe_price_id_monthly, monthly_price_cents")
      .eq("slug", addonSlug)
      .eq("is_active", true)
      .single();

    if (!addon) return NextResponse.json({ error: "Addon not found" }, { status: 404 });

    // Fetch builder
    const { data: builder } = await supabase
      .from("builders")
      .select("company_name, contact_email, stripe_customer_id, stripe_subscription_id")
      .eq("id", builderId)
      .single();

    if (!builder) return NextResponse.json({ error: "Builder not found" }, { status: 404 });

    // Get or create Stripe customer
    let customerId = builder.stripe_customer_id ?? "";
    if (!customerId) {
      const customer = await stripe.customers.create({
        email:    builder.contact_email ?? undefined,
        name:     builder.company_name,
        metadata: { builder_id: builderId },
      });
      customerId = customer.id;
      await supabase.from("builders").update({ stripe_customer_id: customerId }).eq("id", builderId);
    }

    // If builder has an existing subscription, add the new addon as a subscription item
    if (builder.stripe_subscription_id) {
      // Resolve the price ID
      const priceId = addon.stripe_price_id_monthly;
      if (!priceId) {
        // Fall back to creating an ad-hoc Stripe Checkout session
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode:     "subscription",
          line_items: [{
            quantity: 1,
            price_data: {
              currency:     "usd",
              unit_amount:  addon.monthly_price_cents,
              recurring:    { interval: "month" },
              product_data: {
                name:     addon.name,
                metadata: { addon_slug: addonSlug },
              },
            },
          }],
          metadata:    { builder_id: builderId, addon_slugs: JSON.stringify([addonSlug]) },
          success_url: `${APP_URL}/builder/dashboard?addon=success`,
          cancel_url:  `${APP_URL}/builder/dashboard`,
        });
        return NextResponse.json({ url: session.url });
      }

      // Add item to existing subscription
      const item = await stripe.subscriptionItems.create({
        subscription: builder.stripe_subscription_id,
        price:        priceId,
        quantity:     1,
        metadata:     { builder_id: builderId, addon_slug: addonSlug },
      });

      // Immediately upsert builder_addons (webhook will also fire, but this is faster)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("builder_addons") as any).upsert({
        builder_id:                  builderId,
        addon_slug:                  addonSlug,
        stripe_subscription_item_id: item.id,
        status:                      "active",
      }, { onConflict: "builder_id,addon_slug" });

      return NextResponse.json({ ok: true, itemId: item.id });
    }

    // No existing subscription — redirect to full addon-checkout wizard
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode:     "subscription",
      line_items: [{
        quantity: 1,
        ...(addon.stripe_price_id_monthly
          ? { price: addon.stripe_price_id_monthly }
          : {
              price_data: {
                currency:    "usd",
                unit_amount: addon.monthly_price_cents,
                recurring:   { interval: "month" },
                product_data: { name: addon.name, metadata: { addon_slug: addonSlug } },
              },
            }),
      }],
      metadata:    { builder_id: builderId, addon_slugs: JSON.stringify([addonSlug]) },
      success_url: `${APP_URL}/builder/dashboard?addon=success`,
      cancel_url:  `${APP_URL}/builder/dashboard`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("stripe/addon-upgrade:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
