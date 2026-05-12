import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import { CrmType } from "@/types/database";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export interface CrmConfig {
  crm_type:    CrmType;
  api_key?:    string;
  webhook_url?: string;
  portal_id?:  string;
}

export async function POST(req: NextRequest) {
  try {
    const { builderId, addonSlugs, billingCycle = "monthly", crmConfig } = await req.json() as {
      builderId:    string;
      addonSlugs:   string[];
      billingCycle?: "monthly" | "annually";
      crmConfig?:   CrmConfig | null;
    };

    if (!builderId || !addonSlugs?.length) {
      return NextResponse.json({ error: "builderId and at least one addonSlug required" }, { status: 400 });
    }

    // Fetch selected addons
    const { data: addons, error: addonsErr } = await supabase
      .from("addons")
      .select("slug, name, stripe_price_id_monthly, stripe_price_id_annually, monthly_price_cents")
      .in("slug", addonSlugs)
      .eq("is_active", true);

    if (addonsErr || !addons?.length) {
      return NextResponse.json({ error: "One or more addons not found or inactive" }, { status: 404 });
    }

    // Fetch builder
    const { data: builder } = await supabase
      .from("builders")
      .select("id, company_name, contact_email, stripe_customer_id")
      .eq("id", builderId)
      .single();
    if (!builder) return NextResponse.json({ error: "Builder not found" }, { status: 404 });

    // Ensure Stripe customer exists
    let customerId = builder.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email:    builder.contact_email ?? undefined,
        name:     builder.company_name,
        metadata: { builder_id: builderId },
      });
      customerId = customer.id;
      await supabase.from("builders").update({ stripe_customer_id: customerId }).eq("id", builderId);
    }

    // Build line items — one per addon
    const lineItems = [];
    for (const addon of addons) {
      const storedId = billingCycle === "annually"
        ? addon.stripe_price_id_annually
        : addon.stripe_price_id_monthly;

      if (!storedId) {
        return NextResponse.json(
          { error: `Stripe price not configured for addon: ${addon.slug}` },
          { status: 400 }
        );
      }

      // Verify price is active
      try {
        const price = await stripe.prices.retrieve(storedId);
        if (!price.active) throw new Error("archived");
        lineItems.push({ price: price.id, quantity: 1 });
      } catch {
        return NextResponse.json(
          { error: `Stripe price for "${addon.name}" is not active. Re-save in admin.` },
          { status: 400 }
        );
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer:   customerId,
      mode:       "subscription",
      line_items: lineItems,
      metadata: {
        builder_id:   builderId,
        addon_slugs:  JSON.stringify(addonSlugs),
        billing_cycle: billingCycle,
        crm_config:   crmConfig ? JSON.stringify(crmConfig) : "",
      },
      subscription_data: {
        metadata: { builder_id: builderId, addon_slugs: JSON.stringify(addonSlugs) },
      },
      success_url: `${APP_URL}/builder/dashboard?subscribed=1`,
      cancel_url:  `${APP_URL}/builder/subscribe?canceled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("stripe/addon-checkout:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
