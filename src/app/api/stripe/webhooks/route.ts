import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";
import { notifyAdminsNewProjectRequest } from "@/lib/notify";

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
    ai_credits_remaining:     plan.ai_credits_monthly,
    ai_credits_total:         plan.ai_credits_monthly,
    max_projects:             plan.max_projects === -1 ? 9999 : plan.max_projects,
    max_communities:          plan.max_communities ?? -1,
    seats_included:           plan.seats_included,
    max_storage_gb:           plan.max_storage_gb,
  }).eq("id", builderId);
}

// Reset monthly credits for a builder based on their current plan.
// Preserves any purchased top-up credits that exceed the monthly allotment.
async function resetMonthlyCredits(builderId: string) {
  const { data: builder } = await supabase
    .from("builders").select("plan_id, ai_credits_remaining").eq("id", builderId).single();
  if (!builder?.plan_id) return;
  const { data: plan } = await supabase.from("plans")
    .select("rendering_credits_monthly, ai_credits_monthly")
    .eq("id", builder.plan_id).single();
  if (!plan) return;
  // For AI credits, preserve top-up credits: give them at least the monthly allotment
  // but don't reduce if they have more from a purchased pack.
  const currentAiRemaining = builder.ai_credits_remaining ?? 0;
  await supabase.from("builders").update({
    rendering_credits:    plan.rendering_credits_monthly,
    ai_credits_remaining: Math.max(currentAiRemaining, plan.ai_credits_monthly),
  }).eq("id", builderId);
}

async function resetAddonCredits(builderId: string) {
  const { data: builderAddons } = await supabase
    .from("builder_addons")
    .select("addon_slug")
    .eq("builder_id", builderId)
    .eq("status", "active");
  if (!builderAddons?.length) return;

  const slugs = builderAddons.map(a => a.addon_slug);
  const { data: addons } = await supabase
    .from("addons").select("slug, included_units").in("slug", slugs);
  if (!addons) return;

  for (const addon of addons) {
    if (addon.included_units === null) continue; // unlimited — no reset needed
    await supabase.from("builder_addons").update({
      credits_remaining: addon.included_units,
      credits_reset_at:  new Date().toISOString(),
    }).eq("builder_id", builderId).eq("addon_slug", addon.slug);
  }
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
        const session = event.data.object as Stripe.Checkout.Session;

        // ── AI credit top-up ──────────────────────────────────────────────────
        if (session.mode === "payment" && session.metadata?.type === "ai_credits_topup") {
          const builderId = session.metadata?.builder_id;
          const qty       = parseInt(session.metadata?.qty ?? "0", 10);
          if (!builderId || qty <= 0) break;

          // Add credits (cap at 10× monthly allotment to prevent abuse)
          const { data: builder } = await supabase
            .from("builders")
            .select("ai_credits_remaining, ai_credits_total, plan_id")
            .eq("id", builderId).single();
          if (!builder) break;

          const newRemaining = (builder.ai_credits_remaining ?? 0) + qty;
          await supabase.from("builders").update({
            ai_credits_remaining: newRemaining,
            ai_credits_total:     (builder.ai_credits_total ?? 0) + qty,
          }).eq("id", builderId);
          break;
        }

        // ── Site map request setup fee ────────────────────────────────────────
        if (session.mode === "payment" && session.metadata?.site_map_request_id) {
          const smRequestId = session.metadata.site_map_request_id;
          const builderId   = session.metadata.builder_id;
          if (!smRequestId || !builderId) break;

          await supabase.from("site_map_requests")
            .update({ status: "pending_review" })
            .eq("id", smRequestId);

          // Notify admins (best-effort)
          try {
            const { notifyAdminsSiteMapRequest } = await import("@/lib/notify");
            await notifyAdminsSiteMapRequest(smRequestId);
          } catch { /* notify is optional */ }
          break;
        }

        // ── One-time setup fee payment ────────────────────────────────────────
        if (session.mode === "payment") {
          const requestId = session.metadata?.project_request_id;
          const builderId = session.metadata?.builder_id;
          if (!requestId || !builderId) break;

          // Fetch the project request
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: request } = await (supabase.from("project_requests") as any)
            .select("*").eq("id", requestId).single();
          if (!request) break;

          // Flip status to pending_review
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from("project_requests") as any)
            .update({ status: "pending_review" }).eq("id", requestId);

          // Get builder's company_slug for the project record
          const { data: builder } = await supabase
            .from("builders").select("company_slug").eq("id", builderId).single();

          const slug = (request.project_name as string)
            .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

          // Mirror to projects table
          const { data: project } = await supabase.from("projects").insert({
            name:            request.project_name,
            slug,
            company_slug:    builder?.company_slug ?? null,
            home_type:       request.home_type      ?? null,
            floors:          request.floors          ?? 1,
            beds:            request.beds            ?? 0,
            baths:           request.baths           ?? 0,
            sqft:            request.square_footage  ?? null,
            base_price:      request.starting_price  ?? 0,
            description:     request.description     ?? null,
            status:          "pending_review",
            sketchfab_uid:   `pending-${requestId}`,
            camera_defaults: {},
          }).select().single();

          // Attach any pre-uploaded files to the new project
          if (project) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from("project_files") as any)
              .update({ project_id: project.id })
              .eq("request_id", requestId)
              .is("project_id", null);

            await notifyAdminsNewProjectRequest(project.id);
          }
          break;
        }

        // ── Addon subscription checkout ───────────────────────────────────────
        if (session.metadata?.addon_slugs) {
          const builderId  = session.metadata.builder_id;
          const addonSlugs = JSON.parse(session.metadata.addon_slugs) as string[];
          const crmConfig  = session.metadata.crm_config ? JSON.parse(session.metadata.crm_config) : null;
          if (!builderId || !addonSlugs.length) break;

          const subId = typeof session.subscription === "string"
            ? session.subscription
            : (session.subscription as Stripe.Subscription | null)?.id;

          // Fetch subscription items to get per-addon Stripe item IDs
          const sub = subId ? await stripe.subscriptions.retrieve(subId) : null;
          const itemMap: Record<string, string> = {};
          if (sub) {
            for (const item of sub.items.data) {
              const productId = typeof item.price.product === "string" ? item.price.product : item.price.product?.id;
              if (!productId) continue;
              // Match via product metadata
              try {
                const product = await stripe.products.retrieve(productId);
                const slug = product.metadata?.addon_slug;
                if (slug) itemMap[slug] = item.id;
              } catch { /* skip */ }
            }
          }

          // Fetch addon credit defaults
          const { data: addonRows } = await supabase
            .from("addons").select("slug, included_units").in("slug", addonSlugs);

          const creditMap: Record<string, number | null> = {};
          for (const a of (addonRows ?? [])) creditMap[a.slug] = a.included_units;

          // Upsert builder_addons rows
          for (const slug of addonSlugs) {
            await supabase.from("builder_addons").upsert({
              builder_id:                  builderId,
              addon_slug:                  slug,
              stripe_subscription_item_id: itemMap[slug] ?? null,
              status:                      "active",
              credits_remaining:           creditMap[slug] ?? null,
              credits_reset_at:            sub ? new Date((sub as any).current_period_end * 1000).toISOString() : null,
            }, { onConflict: "builder_id,addon_slug" });
          }

          // Save CRM config if provided
          if (crmConfig?.crm_type && crmConfig.crm_type !== "skip") {
            await supabase.from("crm_integrations").upsert({
              builder_id:  builderId,
              crm_type:    crmConfig.crm_type,
              api_key:     crmConfig.api_key   ?? null,
              portal_id:   crmConfig.portal_id ?? null,
              webhook_url: crmConfig.webhook_url ?? null,
              enabled:     true,
            }, { onConflict: "builder_id" });
          }

          // Update builder subscription state
          const customerId = typeof session.customer === "string" ? session.customer : (session.customer as Stripe.Customer | null)?.id ?? null;
          await supabase.from("builders").update({
            stripe_subscription_id:     subId ?? null,
            stripe_subscription_status: sub?.status ?? "active",
            stripe_customer_id:         customerId ?? undefined,
            current_period_end:         sub ? new Date((sub as any).current_period_end * 1000).toISOString() : null,
            status:                     "active",
          }).eq("id", builderId);
          break;
        }

        // ── Legacy plan subscription checkout ─────────────────────────────────
        const builderId = session.metadata?.builder_id;
        const planId    = session.metadata?.plan_id;
        if (!builderId || !planId) break;

        const subId = typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

        const sub = subId ? await stripe.subscriptions.retrieve(subId) : null;

        // Pull billing details from Stripe customer + payment method
        const billingUpdate: Record<string, string | null> = {};
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
        if (customerId) {
          const customer = await stripe.customers.retrieve(customerId, {
            expand: ["invoice_settings.default_payment_method"],
          }) as Stripe.Customer;
          if (customer && !customer.deleted) {
            if (customer.email) billingUpdate.billing_email = customer.email;
            if (customer.address?.line1) {
              billingUpdate.billing_address = [customer.address.line1, customer.address.line2].filter(Boolean).join(" ");
            }
            if (customer.address?.city)    billingUpdate.city  = customer.address.city;
            if (customer.address?.state)   billingUpdate.state = customer.address.state;
            if (customer.address?.postal_code) billingUpdate.zip = customer.address.postal_code;
            const pm = customer.invoice_settings?.default_payment_method as Stripe.PaymentMethod | null;
            if (pm?.card) {
              billingUpdate.payment_method_last4  = pm.card.last4;
              billingUpdate.payment_method_type   = pm.card.brand.charAt(0).toUpperCase() + pm.card.brand.slice(1);
              billingUpdate.payment_method_expiry = `${String(pm.card.exp_month).padStart(2, "0")}/${String(pm.card.exp_year).slice(-2)}`;
            }
          }
        }

        await supabase.from("builders").update({
          stripe_subscription_id:     subId ?? null,
          stripe_subscription_status: sub?.status ?? "active",
          stripe_customer_id:         customerId ?? undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          current_period_end: sub ? new Date((sub as any).current_period_end * 1000).toISOString() : null,
          status: "active",
          ...billingUpdate,
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
        await resetAddonCredits(builder.id);

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
