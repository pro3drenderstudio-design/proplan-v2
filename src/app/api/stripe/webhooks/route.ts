import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

// Apply plan limits from the plans table to a builder record
async function applyPlanLimits(builderId: string, planId: string) {
  const { data: plan } = await supabase.from("plans").select("*").eq("id", planId).single();
  if (!plan) return;
  await supabase.from("builders").update({
    plan_id:                  planId,
    plan_tier:                plan.name,
    rendering_credits:        plan.rendering_credits_monthly,
    rendering_credits_total:  plan.rendering_credits_monthly,
    max_projects:             plan.max_projects === -1 ? 9999 : plan.max_projects,
    seats_included:           plan.seats_included,
    max_storage_gb:           plan.max_storage_gb,
  }).eq("id", builderId);
}

// Reset monthly render credits for a builder based on their current plan
async function resetMonthlyCredits(builderId: string) {
  const { data: builder } = await supabase
    .from("builders").select("plan_id").eq("id", builderId).single();
  if (!builder?.plan_id) return;
  const { data: plan } = await supabase.from("plans").select("rendering_credits_monthly, ai_credits_monthly").eq("id", builder.plan_id).single();
  if (!plan) return;
  await supabase.from("builders").update({
    rendering_credits: plan.rendering_credits_monthly,
  }).eq("id", builderId);
}

export async function POST(req: NextRequest) {
  const body      = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {

      case "checkout.session.completed": {
        const session  = event.data.object as Stripe.Checkout.Session;
        const builderId = session.metadata?.builder_id;
        const planId    = session.metadata?.plan_id;
        if (!builderId || !planId) break;

        const subId = typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

        const sub = subId ? await stripe.subscriptions.retrieve(subId) : null;

        await supabase.from("builders").update({
          stripe_subscription_id:    subId ?? null,
          stripe_subscription_status: sub?.status ?? "active",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          current_period_end:         sub ? new Date((sub as any).current_period_end * 1000).toISOString() : null,
          status: "active",
        }).eq("id", builderId);

        await applyPlanLimits(builderId, planId);
        break;
      }

      case "customer.subscription.updated": {
        const sub       = event.data.object as Stripe.Subscription;
        const builderId = sub.metadata?.builder_id;
        const planId    = sub.metadata?.plan_id;
        if (!builderId) break;

        await supabase.from("builders").update({
          stripe_subscription_status: sub.status,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          current_period_end:         new Date((sub as any).current_period_end * 1000).toISOString(),
        }).eq("id", builderId);

        // If plan changed (metadata updated), re-apply limits
        if (planId) await applyPlanLimits(builderId, planId);
        break;
      }

      case "customer.subscription.deleted": {
        const sub       = event.data.object as Stripe.Subscription;
        const builderId = sub.metadata?.builder_id;
        if (!builderId) break;

        await supabase.from("builders").update({
          stripe_subscription_status: "canceled",
          status: "inactive",
        }).eq("id", builderId);
        break;
      }

      case "invoice.paid": {
        const invoice   = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;

        const { data: builder } = await supabase
          .from("builders").select("id").eq("stripe_customer_id", customerId).single();
        if (!builder) break;

        // Reset credits on each successful billing cycle
        await resetMonthlyCredits(builder.id);

        await supabase.from("builders").update({
          stripe_subscription_status: "active",
        }).eq("id", builder.id);
        break;
      }

      case "invoice.payment_failed": {
        const invoice    = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;

        const { data: builder } = await supabase
          .from("builders").select("id").eq("stripe_customer_id", customerId).single();
        if (!builder) break;

        await supabase.from("builders").update({
          stripe_subscription_status: "past_due",
        }).eq("id", builder.id);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`Error handling event ${event.type}:`, err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
