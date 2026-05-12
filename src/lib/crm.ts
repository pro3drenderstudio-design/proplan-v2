import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface LeadPayload {
  name:           string;
  email:          string;
  phone?:         string | null;
  community?:     string | null;
  lot_number?:    string | null;
  home_model?:    string | null;
  configuration?: Record<string, unknown>;
  total_value?:   number;
  source?:        string;
}

async function pushToHubSpot(apiKey: string, lead: LeadPayload): Promise<void> {
  const [firstName, ...rest] = (lead.name ?? "").split(" ");
  const lastName = rest.join(" ") || "";
  const properties: Record<string, string> = {
    email:      lead.email,
    firstname:  firstName,
    lastname:   lastName,
  };
  if (lead.phone)     properties.phone         = lead.phone;
  if (lead.community) properties.company       = lead.community;
  if (lead.source)    properties.lead_source   = lead.source;

  const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body:    JSON.stringify({ properties }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`HubSpot error: ${(body as { message?: string }).message ?? res.status}`);
  }
}

async function pushToFollowUpBoss(apiKey: string, lead: LeadPayload): Promise<void> {
  const encoded = Buffer.from(`${apiKey}:`).toString("base64");
  const body: Record<string, unknown> = {
    source: lead.source ?? "ProPlan Studio",
    people: [{ firstName: lead.name.split(" ")[0], lastName: lead.name.split(" ").slice(1).join(" "), emails: [{ value: lead.email }] }],
  };
  if (lead.phone) (body.people as Record<string, unknown>[])[0].phones = [{ value: lead.phone }];
  if (lead.community) body.propertyAddress = lead.community;

  const res = await fetch("https://api.followupboss.com/v1/events", {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${encoded}` },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Follow Up Boss error: ${res.status}`);
}

async function pushToLasso(apiKey: string, lead: LeadPayload): Promise<void> {
  const res = await fetch("https://api.lassocrm.com/v1/registrants", {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      firstName: lead.name.split(" ")[0],
      lastName:  lead.name.split(" ").slice(1).join(" "),
      email:     lead.email,
      phone:     lead.phone ?? undefined,
      source:    lead.source ?? "ProPlan Studio",
    }),
  });
  if (!res.ok) throw new Error(`Lasso error: ${res.status}`);
}

async function pushToZapier(webhookUrl: string, lead: LeadPayload): Promise<void> {
  const res = await fetch(webhookUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ ...lead, source: lead.source ?? "proplan-studio" }),
  });
  if (!res.ok) throw new Error(`Zapier webhook error: ${res.status}`);
}

export async function pushLeadToCRM(builderId: string, lead: LeadPayload): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: crm } = await (supabase.from("crm_integrations") as any)
    .select("crm_type,api_key,webhook_url,portal_id,enabled")
    .eq("builder_id", builderId)
    .single();

  if (!crm || !crm.enabled) return;

  switch (crm.crm_type) {
    case "hubspot":
      if (crm.api_key) await pushToHubSpot(crm.api_key, lead);
      break;
    case "followupboss":
      if (crm.api_key) await pushToFollowUpBoss(crm.api_key, lead);
      break;
    case "lasso":
      if (crm.api_key) await pushToLasso(crm.api_key, lead);
      break;
    case "zapier":
      if (crm.webhook_url) await pushToZapier(crm.webhook_url, lead);
      break;
    case "csv":
      // CSV: leads are stored in DB, no real-time push
      break;
    default:
      break;
  }
}
