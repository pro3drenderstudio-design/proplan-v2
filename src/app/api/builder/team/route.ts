import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// POST — create team member + send invite
export async function POST(req: NextRequest) {
  try {
    const { builderId, name, email, role } = await req.json() as {
      builderId: string;
      name:      string;
      email:     string;
      role:      "builder_admin" | "builder_member";
    };

    if (!builderId || !name || !email || !role) {
      return NextResponse.json({ error: "builderId, name, email, role required" }, { status: 400 });
    }

    // Check seat limit
    const { data: builder } = await supabase
      .from("builders")
      .select("seats_included, seats_used, company_name")
      .eq("id", builderId)
      .single();

    if (!builder) return NextResponse.json({ error: "Builder not found" }, { status: 404 });
    if (builder.seats_used >= builder.seats_included) {
      return NextResponse.json({ error: "Seat limit reached. Upgrade your plan to add more team members." }, { status: 403 });
    }

    // Check for duplicate email within this builder
    const { data: existing } = await supabase
      .from("team_members")
      .select("id")
      .eq("builder_id", builderId)
      .eq("email", email)
      .single();

    if (existing) {
      return NextResponse.json({ error: "This email has already been invited." }, { status: 409 });
    }

    // Generate invite token
    const token = crypto.randomUUID();

    // Create team_member record
    const { data: member, error: insertErr } = await supabase
      .from("team_members")
      .insert({
        name,
        email,
        role,
        builder_id:    builderId,
        invite_token:  token,
        invite_status: "pending",
        invite_sent_at: new Date().toISOString(),
        permissions:   {},
        last_activity: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertErr || !member) {
      return NextResponse.json({ error: insertErr?.message ?? "Failed to create member" }, { status: 500 });
    }

    // Increment seats_used
    await supabase
      .from("builders")
      .update({ seats_used: builder.seats_used + 1 })
      .eq("id", builderId);

    // Send invite email via existing route (reuse)
    const inviteUrl = `${APP_URL}/auth/invite?token=${token}`;
    const roleLabel = role === "builder_admin" ? "Admin" : "Team Member";

    try {
      const { Resend } = await import("resend");
      const resendKey  = process.env.RESEND_API_KEY;
      const fromEmail  = process.env.RESEND_FROM_EMAIL ?? "noreply@proplan.app";

      if (resendKey) {
        const resend = new Resend(resendKey);
        await resend.emails.send({
          from:    fromEmail,
          to:      email,
          subject: `You've been invited to join ${builder.company_name} on ProPlan Studio`,
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#0f172a;">
              <div style="background:#0f172a;padding:32px;border-radius:12px 12px 0 0;text-align:center;">
                <img src="${APP_URL}/logo_light.png" alt="ProPlan Studio" style="height:36px;object-fit:contain;" />
              </div>
              <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;">
                <h2 style="margin:0 0 8px;font-size:20px;">Hi ${name},</h2>
                <p style="color:#475569;margin:0 0 24px;">
                  <strong style="color:#1e293b;">${builder.company_name}</strong> has invited you to join their team on ProPlan Studio as a
                  <strong style="color:#1e293b;">${roleLabel}</strong>.
                </p>
                <a href="${inviteUrl}"
                  style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;">
                  Accept Invitation &amp; Set Password
                </a>
                <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">
                  This link expires in 7 days. If you didn't expect this invitation, you can safely ignore this email.
                </p>
              </div>
            </div>
          `,
        });
      }
    } catch (emailErr) {
      console.warn("Failed to send invite email:", emailErr);
      // Don't fail the request — return invite URL so they can share manually
    }

    return NextResponse.json({ success: true, memberId: member.id, inviteUrl });
  } catch (err) {
    console.error("POST /api/builder/team:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE — remove a team member
export async function DELETE(req: NextRequest) {
  try {
    const { memberId, builderId } = await req.json() as { memberId: string; builderId: string };
    if (!memberId || !builderId) {
      return NextResponse.json({ error: "memberId and builderId required" }, { status: 400 });
    }

    // Verify the member belongs to this builder
    const { data: member } = await supabase
      .from("team_members")
      .select("id, invite_status")
      .eq("id", memberId)
      .eq("builder_id", builderId)
      .single();

    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    // Soft-delete by clearing invite token and marking inactive
    await supabase.from("team_members").delete().eq("id", memberId);

    // Decrement seats_used
    const { data: builder } = await supabase
      .from("builders").select("seats_used").eq("id", builderId).single();
    if (builder && builder.seats_used > 0) {
      await supabase.from("builders").update({ seats_used: builder.seats_used - 1 }).eq("id", builderId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/builder/team:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
