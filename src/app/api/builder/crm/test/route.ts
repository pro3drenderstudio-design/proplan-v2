import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { crm_type, api_key, portal_id, webhook_url } = await req.json() as {
      crm_type:    string;
      api_key?:    string;
      portal_id?:  string;
      webhook_url?: string;
    };

    switch (crm_type) {
      case "hubspot": {
        if (!api_key) return NextResponse.json({ ok: false, error: "API key required" });
        const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
          headers: { Authorization: `Bearer ${api_key}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          return NextResponse.json({ ok: false, error: body?.message ?? `HubSpot returned ${res.status}` });
        }
        return NextResponse.json({ ok: true });
      }

      case "followupboss": {
        if (!api_key) return NextResponse.json({ ok: false, error: "API key required" });
        const encoded = Buffer.from(`${api_key}:`).toString("base64");
        const res = await fetch("https://api.followupboss.com/v1/people?limit=1", {
          headers: { Authorization: `Basic ${encoded}` },
        });
        if (!res.ok) return NextResponse.json({ ok: false, error: `Follow Up Boss returned ${res.status}` });
        return NextResponse.json({ ok: true });
      }

      case "lasso": {
        if (!api_key) return NextResponse.json({ ok: false, error: "API key required" });
        const res = await fetch("https://api.lassocrm.com/v1/registrants?limit=1", {
          headers: { Authorization: `Bearer ${api_key}` },
        });
        if (!res.ok) return NextResponse.json({ ok: false, error: `Lasso returned ${res.status}` });
        return NextResponse.json({ ok: true });
      }

      case "zapier": {
        if (!webhook_url) return NextResponse.json({ ok: false, error: "Webhook URL required" });
        const res = await fetch(webhook_url, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ test: true, source: "proplan-studio" }),
        });
        if (!res.ok) return NextResponse.json({ ok: false, error: `Webhook returned ${res.status}` });
        return NextResponse.json({ ok: true });
      }

      case "csv":
        return NextResponse.json({ ok: true });

      default:
        return NextResponse.json({ ok: false, error: "Unknown CRM type" });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Test failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
