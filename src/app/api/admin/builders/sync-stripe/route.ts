import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { builder_id } = await req.json() as { builder_id: string };
  if (!builder_id) return NextResponse.json({ error: "Missing builder_id" }, { status: 400 });

  const { data: builder } = await supabase
    .from("builders")
    .select("id, stripe_customer_id")
    .eq("id", builder_id)
    .single();

  if (!builder) return NextResponse.json({ error: "Builder not found" }, { status: 404 });
  if (!builder.stripe_customer_id) return NextResponse.json({ error: "No Stripe customer on file" }, { status: 400 });

  const customer = await stripe.customers.retrieve(builder.stripe_customer_id, {
    expand: ["invoice_settings.default_payment_method"],
  }) as Stripe.Customer;

  if (customer.deleted) {
    return NextResponse.json({ error: "Stripe customer not found or deleted" }, { status: 404 });
  }

  const update: Record<string, string | null> = {};

  if (customer.email) update.billing_email = customer.email;
  if (customer.address?.line1) {
    update.billing_address = [customer.address.line1, customer.address.line2].filter(Boolean).join(" ");
  }
  if (customer.address?.city)        update.city  = customer.address.city;
  if (customer.address?.state)       update.state = customer.address.state;
  if (customer.address?.postal_code) update.zip   = customer.address.postal_code;

  const pm = customer.invoice_settings?.default_payment_method as Stripe.PaymentMethod | null;
  if (pm?.card) {
    update.payment_method_last4  = pm.card.last4;
    update.payment_method_type   = pm.card.brand.charAt(0).toUpperCase() + pm.card.brand.slice(1);
    update.payment_method_expiry = `${String(pm.card.exp_month).padStart(2, "0")}/${String(pm.card.exp_year).slice(-2)}`;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ message: "No billing data found in Stripe" });
  }

  const { error } = await supabase.from("builders").update(update).eq("id", builder_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, updated: update });
}
