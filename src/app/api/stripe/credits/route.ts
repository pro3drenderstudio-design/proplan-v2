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
    const { builderId, packType = "ai" } = await req.json() as {
      builderId: string;
      packType?: "ai" | "renders";
    };

    if (!builderId) {
      return NextResponse.json({ error: "builderId required" }, { status: 400 });
    }

    // Fetch builder + their plan
    const { data: builder } = await supabase
      .from("builders")
      .select("id, company_name, contact_email, stripe_customer_id, plan_id")
      .eq("id", builderId)
      .single();

    if (!builder) {
      return NextResponse.json({ error: "Builder not found" }, { status: 404 });
    }

    // Get pack details from plan
    let packQty   = packType === "ai" ? 50  : 10;
    let packPrice = packType === "ai" ? 7500 : 14900; // cents
    let packName  = packType === "ai" ? "AI Render Credits" : "Render Credits";

    if (builder.plan_id) {
      const { data: plan } = await supabase
        .from("plans")
        .select("extra_ai_pack_qty, extra_ai_pack_price, extra_render_pack_qty, extra_render_pack_price, display_name")
        .eq("id", builder.plan_id)
        .single();
      if (plan) {
        if (packType === "ai") {
          packQty   = plan.extra_ai_pack_qty   ?? packQty;
          packPrice = plan.extra_ai_pack_price  ?? packPrice;
        } else {
          packQty   = plan.extra_render_pack_qty   ?? packQty;
          packPrice = plan.extra_render_pack_price ?? packPrice;
        }
      }
    }

    if (packPrice <= 0) {
      return NextResponse.json({ error: "Credits are included in your plan." }, { status: 400 });
    }

    // Create or reuse Stripe customer
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
      mode:       "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency:     "usd",
          unit_amount:  packPrice,
          product_data: {
            name:        `${packQty} ${packName} Top-up`,
            description: `Add ${packQty} ${packName.toLowerCase()} to your ProPlan Studio account.`,
          },
        },
      }],
      metadata: {
        builder_id: builderId,
        type:       `${packType}_credits_topup`,
        qty:        String(packQty),
      },
      success_url: `${APP_URL}/builder/render-studio?credits=success`,
      cancel_url:  `${APP_URL}/builder/render-studio`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("stripe/credits:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
