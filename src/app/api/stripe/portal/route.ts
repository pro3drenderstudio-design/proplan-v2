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
    const { builderId } = await req.json() as { builderId: string };
    if (!builderId) {
      return NextResponse.json({ error: "builderId required" }, { status: 400 });
    }

    const { data: builder } = await supabase
      .from("builders").select("stripe_customer_id").eq("id", builderId).single();

    if (!builder?.stripe_customer_id) {
      return NextResponse.json({ error: "No Stripe customer found for this builder" }, { status: 404 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer:   builder.stripe_customer_id,
      return_url: `${APP_URL}/builder/settings?tab=billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("stripe/portal:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
