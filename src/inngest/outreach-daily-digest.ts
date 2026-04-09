import { createClient } from "@supabase/supabase-js";
import { inngest } from "@/lib/inngest";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type CampaignStats = { sent: number; opened: number; replied: number; bounced: number };

export const outreachDailyDigest = inngest.createFunction(
  {
    id:       "outreach-daily-digest",
    name:     "Outreach: Daily Stats Digest",
    triggers: [{ cron: "0 8 * * *" }],
  },
  async ({ step }) => {
    await step.run("send-digest", async () => {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (!adminEmail) {
        console.log("ADMIN_EMAIL not set — skipping daily digest");
        return;
      }

      const db = supabase();

      const yesterdayStart = new Date();
      yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
      yesterdayStart.setUTCHours(0, 0, 0, 0);
      const yesterdayEnd = new Date(yesterdayStart);
      yesterdayEnd.setUTCDate(yesterdayEnd.getUTCDate() + 1);

      // Pull yesterday's sends with enrollment → campaign join
      const { data: sends } = await db
        .from("outreach_sends")
        .select("status, opened_at, replied_at, bounced_at, enrollment_id")
        .gte("sent_at", yesterdayStart.toISOString())
        .lt("sent_at", yesterdayEnd.toISOString());

      if (!sends?.length) {
        console.log("No sends yesterday — skipping digest");
        return;
      }

      // Resolve enrollment → campaign
      const enrollmentIds = [...new Set(sends.map((s) => s.enrollment_id))];
      const { data: enrollments } = await db
        .from("outreach_enrollments")
        .select("id, campaign_id")
        .in("id", enrollmentIds.slice(0, 1000));

      const { data: campaigns } = await db
        .from("outreach_campaigns")
        .select("id, name");

      const enrollToCampaign = new Map(
        (enrollments ?? []).map((e: { id: string; campaign_id: string }) => [e.id, e.campaign_id]),
      );
      const campaignNames = new Map(
        (campaigns ?? []).map((c: { id: string; name: string }) => [c.id, c.name]),
      );

      // Aggregate stats per campaign
      const campaignStats = new Map<string, CampaignStats>();
      for (const send of sends) {
        const cid = enrollToCampaign.get(send.enrollment_id) ?? "unknown";
        if (!campaignStats.has(cid)) campaignStats.set(cid, { sent: 0, opened: 0, replied: 0, bounced: 0 });
        const s = campaignStats.get(cid)!;
        s.sent++;
        if (send.opened_at)  s.opened++;
        if (send.replied_at) s.replied++;
        if (send.bounced_at || send.status === "bounced") s.bounced++;
      }

      const totalSent    = sends.length;
      const totalOpened  = sends.filter((s) => s.opened_at).length;
      const totalReplied = sends.filter((s) => s.replied_at).length;

      const date = yesterdayStart.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

      const tableRows = [...campaignStats.entries()]
        .sort((a, b) => b[1].sent - a[1].sent)
        .map(([cid, s]) => {
          const name      = campaignNames.get(cid) ?? cid.slice(0, 8);
          const openRate  = s.sent > 0 ? `${Math.round((s.opened  / s.sent) * 100)}%` : "—";
          const replyRate = s.sent > 0 ? `${Math.round((s.replied / s.sent) * 100)}%` : "—";
          return `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a">${name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;text-align:center">${s.sent}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;text-align:center">${openRate}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;text-align:center">${replyRate}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;text-align:center;color:#f87171">${s.bounced || "—"}</td>
          </tr>`;
        })
        .join("");

      const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0f0f0f;color:#e0e0e0;padding:32px;max-width:640px;margin:0 auto">
  <h2 style="color:#fff;margin-bottom:4px">ProPlan Outreach — Daily Digest</h2>
  <p style="color:#666;margin-top:0">${date}</p>
  <div style="display:flex;gap:16px;margin:24px 0">
    <div style="flex:1;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:16px;text-align:center">
      <p style="margin:0;font-size:28px;font-weight:700;color:#fff">${totalSent}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#666">Sent</p>
    </div>
    <div style="flex:1;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:16px;text-align:center">
      <p style="margin:0;font-size:28px;font-weight:700;color:#3b82f6">${totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0}%</p>
      <p style="margin:4px 0 0;font-size:12px;color:#666">Open Rate</p>
    </div>
    <div style="flex:1;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:16px;text-align:center">
      <p style="margin:0;font-size:28px;font-weight:700;color:#22c55e">${totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0}%</p>
      <p style="margin:4px 0 0;font-size:12px;color:#666">Reply Rate</p>
    </div>
  </div>
  <table style="width:100%;border-collapse:collapse;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden">
    <thead><tr style="background:#222">
      <th style="padding:10px 12px;text-align:left;font-size:11px;color:#666;text-transform:uppercase">Campaign</th>
      <th style="padding:10px 12px;text-align:center;font-size:11px;color:#666;text-transform:uppercase">Sent</th>
      <th style="padding:10px 12px;text-align:center;font-size:11px;color:#666;text-transform:uppercase">Opens</th>
      <th style="padding:10px 12px;text-align:center;font-size:11px;color:#666;text-transform:uppercase">Replies</th>
      <th style="padding:10px 12px;text-align:center;font-size:11px;color:#666;text-transform:uppercase">Bounces</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <p style="color:#444;font-size:11px;margin-top:24px;text-align:center">ProPlan Studio · Outreach Engine</p>
</body></html>`;

      const resendKey = process.env.RESEND_API_KEY;
      if (!resendKey) {
        console.log("RESEND_API_KEY not set — digest not sent. Stats:", { totalSent, totalOpened, totalReplied });
        return;
      }

      const res = await fetch("https://api.resend.com/emails", {
        method:  "POST",
        headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body:    JSON.stringify({
          from:    "ProPlan Outreach <outreach@proplanstudio.com>",
          to:      adminEmail,
          subject: `Outreach Daily Digest — ${date} · ${totalSent} sent · ${totalReplied} replies`,
          html,
        }),
      });

      if (!res.ok) {
        console.error("Resend API error:", await res.text());
      } else {
        console.log(`Daily digest sent to ${adminEmail}`);
      }
    });
  },
);
