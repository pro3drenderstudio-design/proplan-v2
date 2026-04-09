// ─── Outreach System Types ────────────────────────────────────────────────────

export type InboxProvider    = "gmail" | "outlook" | "smtp";
export type InboxStatus      = "active" | "paused" | "error";
export type LeadStatus       = "active" | "unsubscribed" | "bounced";
export type UnsubscribeSource = "manual" | "link_click" | "reply" | "bounce" | "admin";
export type CampaignStatus   = "draft" | "active" | "paused" | "completed";
export type SequenceStepType = "email" | "wait";
export type EnrollmentStatus = "active" | "replied" | "bounced" | "unsubscribed" | "completed" | "paused";
export type SendStatus       = "queued" | "sent" | "failed" | "bounced";
export type CrmStatus        = "neutral" | "interested" | "meeting_booked" | "won" | "not_interested" | "ooo" | "follow_up";

export interface OutreachInbox {
  id: string;
  label: string;
  provider: InboxProvider;
  email_address: string;
  // OAuth (encrypted at rest — never expose raw tokens to client)
  oauth_access_token?: string | null;
  oauth_refresh_token?: string | null;
  oauth_expires_at?: string | null;
  // SMTP
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_user?: string | null;
  smtp_pass_encrypted?: string | null;
  imap_host?: string | null;
  imap_port?: number | null;
  // Sending behaviour
  daily_send_limit: number;
  send_window_start: string;  // "HH:MM"
  send_window_end: string;    // "HH:MM"
  timezone: string;
  signature?: string | null;
  // Warmup
  warmup_enabled: boolean;
  warmup_current_daily: number;
  warmup_target_daily: number;
  warmup_ramp_per_week: number;
  // Health
  status: InboxStatus;
  last_error?: string | null;
  gmail_history_id?: string | null;
  gmail_watch_expiry?: string | null;
  ms_subscription_id?: string | null;
  ms_subscription_expiry?: string | null;
  created_at: string;
  updated_at: string;
}

// Safe version without encrypted fields — use for client responses
export type OutreachInboxSafe = Omit<
  OutreachInbox,
  "oauth_access_token" | "oauth_refresh_token" | "smtp_pass_encrypted"
> & { has_oauth?: boolean };

export interface OutreachList {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  // Computed
  lead_count?: number;
}

export interface OutreachLead {
  id: string;
  list_id: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email: string;
  company?: string | null;
  title?: string | null;
  website?: string | null;
  custom_fields: Record<string, string>;
  status: LeadStatus;
  created_at: string;
}

export interface OutreachUnsubscribe {
  id: string;
  email: string;
  source: UnsubscribeSource;
  created_at: string;
}

export interface OutreachCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  inbox_ids: string[];
  list_ids: string[];
  timezone: string;
  send_days: string[];  // ["mon","tue","wed","thu","fri"]
  send_start_time: string;  // "HH:MM"
  send_end_time: string;
  daily_cap: number;
  track_opens: boolean;
  track_clicks: boolean;
  min_delay_seconds: number;
  max_delay_seconds: number;
  stop_on_reply: boolean;
  pause_after_open: boolean;
  reply_to_email?: string | null;
  created_at: string;
  updated_at: string;
  // Computed
  total_enrolled?: number;
  total_sent?: number;
  total_opened?: number;
  total_replied?: number;
  total_completed?: number;
  total_bounced?: number;
  total_unsubscribed?: number;
  total_clicked?: number;
  sequence_steps?: OutreachSequenceStep[];
}

export interface OutreachSequenceStep {
  id: string;
  campaign_id: string;
  step_order: number;
  type: SequenceStepType;
  wait_days: number;
  subject_template?: string | null;
  subject_template_b?: string | null;
  body_template?: string | null;
  created_at: string;
}

export interface OutreachEnrollment {
  id: string;
  campaign_id: string;
  lead_id: string;
  current_step: number;
  status: EnrollmentStatus;
  ab_variant: "a" | "b";
  crm_status: CrmStatus;
  enrolled_at: string;
  completed_at?: string | null;
  next_send_at?: string | null;
  // Joined
  lead?: OutreachLead;
}

export interface OutreachSend {
  id: string;
  enrollment_id: string;
  sequence_step_id: string;
  inbox_id: string;
  to_email: string;
  subject: string;
  body: string;
  status: SendStatus;
  sent_at?: string | null;
  opened_at?: string | null;
  clicked_at?: string | null;
  replied_at?: string | null;
  bounced_at?: string | null;
  message_id?: string | null;
  thread_id?: string | null;
  open_count: number;
  click_count: number;
  created_at: string;
}

export interface OutreachTrackedLink {
  id: string;
  send_id: string;
  link_index: number;
  original_url: string;
}

export interface OutreachCrmNote {
  id: string;
  lead_id: string;
  author_id?: string | null;
  body: string;
  created_at: string;
}

// ─── CRM Reply Thread (joined view) ──────────────────────────────────────────
export interface CrmThread {
  enrollment_id: string;
  lead: OutreachLead;
  campaign: Pick<OutreachCampaign, "id" | "name">;
  latest_send:  OutreachSend;
  latest_reply: OutreachReply | null;
  replied_at:   string;
  crm_status:   CrmStatus;
  notes:        OutreachCrmNote[];
}

// ─── Blacklist ────────────────────────────────────────────────────────────────
export interface OutreachBlacklistDomain {
  id: string;
  domain: string;
  reason?: string | null;
  created_at: string;
}

// ─── Campaign Stats ───────────────────────────────────────────────────────────
export interface CampaignStats {
  total_enrolled: number;
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  total_replied: number;
  total_bounced: number;
  total_unsubscribed: number;
  open_rate: number;
  reply_rate: number;
  click_rate: number;
}

// ─── CSV Import ───────────────────────────────────────────────────────────────
export interface CsvFieldMapping {
  csv_column: string;
  db_field: keyof Pick<OutreachLead, "first_name" | "last_name" | "email" | "company" | "title" | "website"> | `custom:${string}`;
}

export interface ImportResult {
  imported: number;
  skipped_unsubscribed: number;
  skipped_duplicate: number;
  errors: string[];
}

export interface InboxImportResult {
  imported: number;
  skipped_duplicate: number;
  failed_verification: number;
  errors: Array<{ row: number; email: string; message: string }>;
}

// ─── Warmup Pool ──────────────────────────────────────────────────────────────
export interface OutreachWarmupSend {
  id: string;
  from_inbox_id: string;
  to_inbox_id: string;
  message_id?: string | null;
  thread_id?: string | null;
  subject?: string | null;
  replied_at?: string | null;
  rescued_from_spam: boolean;
  sent_at?: string | null;
  created_at: string;
}

export interface WarmupPoolStats {
  pool_size: number;
  sent_today: number;
  rescued_from_spam_7d: number;
  reply_rate_7d: number;
}

// ─── Campaign Analytics ───────────────────────────────────────────────────────
export interface CampaignAnalytics {
  funnel: {
    enrolled: number;
    active: number;
    sent: number;
    opened: number;
    replied: number;
    completed: number;
    bounced: number;
    unsubscribed: number;
  };
  per_step: Array<{
    step_order: number;
    type: "email" | "wait";
    subject_template: string;
    subject_template_b: string | null;
    sent: number;
    opened: number;
    open_rate: number;
    replied: number;
    reply_rate: number;
    bounced: number;
  }>;
  daily_activity: Array<{
    date: string;
    sent: number;
    opened: number;
    replied: number;
  }>;
  ab_test: {
    enabled: boolean;
    a: { sent: number; opened: number; open_rate: number; replied: number; reply_rate: number };
    b: { sent: number; opened: number; open_rate: number; replied: number; reply_rate: number };
  };
  recent_activity: Array<{
    send_id: string;
    lead_name: string;
    lead_email: string;
    company: string | null;
    subject: string;
    status: string;
    step_order: number;
    sent_at: string | null;
    opened_at: string | null;
    replied_at: string | null;
  }>;
  upcoming_queue: Array<{
    enrollment_id: string;
    lead_name: string;
    lead_email: string;
    company: string | null;
    current_step: number;
    next_send_at: string | null;
    crm_status: string;
  }>;
}

// ─── Inbound Reply ────────────────────────────────────────────────────────────
export interface OutreachReply {
  id:            string;
  inbox_id:      string | null;
  send_id:       string | null;
  enrollment_id: string | null;
  from_email:    string;
  from_name:     string | null;
  subject:       string | null;
  body_text:     string | null;
  message_id:    string | null;
  in_reply_to:   string | null;
  received_at:   string;
  ai_category:   string | null;
  ai_confidence: number | null;
  is_filtered:   boolean;
  filter_reason: string | null;
  created_at:    string;
  // Joined
  inbox?: { id: string; label: string | null; email_address: string };
}

// ─── CRM Filter Rule ──────────────────────────────────────────────────────────
export interface OutreachCrmFilter {
  id:          string;
  name:        string;
  type:        'phrase' | 'subject_phrase' | 'sender_email' | 'sender_domain';
  value:       string;
  action:      'exclude' | 'auto_status';
  auto_status: string | null;
  created_at:  string;
}

// ─── Template Library ─────────────────────────────────────────────────────────
export interface OutreachTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  created_at: string;
}
