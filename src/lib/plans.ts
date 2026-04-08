/**
 * Server-safe plan helpers — usable in both server and client components.
 * The `plans` table has a public SELECT policy so the anon key is sufficient.
 */

import { Plan } from "@/types/database";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Fetch the single active plan (lowest sort_order). Returns null if none active. */
export async function fetchActivePlan(): Promise<Plan | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/plans?is_active=eq.true&order=sort_order.asc&limit=1`,
    {
      headers: {
        apikey:        SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        Accept:        "application/json",
      },
      next: { revalidate: 60 },
    }
  );
  if (!res.ok) return null;
  const data = await res.json() as Plan[];
  return data[0] ?? null;
}

/** Fetch all active plans ordered by sort_order. */
export async function fetchActivePlans(): Promise<Plan[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/plans?is_active=eq.true&order=sort_order.asc`,
    {
      headers: {
        apikey:        SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        Accept:        "application/json",
      },
      next: { revalidate: 60 },
    }
  );
  if (!res.ok) return [];
  return (await res.json()) as Plan[];
}

/** Build the marketing feature list for a plan — used on pricing, subscribe, and landing pages. */
export function buildPlanFeatures(plan: Plan): string[] {
  const models =
    plan.max_projects === -1 || plan.max_projects >= 9999
      ? "Unlimited home model configurators"
      : `Up to ${plan.max_projects} home model configurator${plan.max_projects !== 1 ? "s" : ""}`;

  const renders =
    plan.rendering_credits_monthly === -1
      ? "Unlimited traditional 3D renders / mo"
      : `${plan.rendering_credits_monthly.toLocaleString()} traditional 3D renders / mo`;

  const ai = `${plan.ai_credits_monthly.toLocaleString()} AI concept renders / mo`;

  return [
    models,
    renders,
    ai,
    ...(plan.includes_sitemaps ? ["Unlimited interactive site maps"] : []),
    "Lead CRM + analytics + exports",
    "Brand customization (logo + colors)",
    "Priority support",
  ];
}

/** Format cents → "$1,500" */
export function fmtUSD(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
