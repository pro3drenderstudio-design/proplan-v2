// ─── Warmup Pool Email Templates ──────────────────────────────────────────────
// Realistic business emails — no marketing language, no CTAs.
// Used exclusively for inbox-to-inbox warmup pool exchanges.

export interface WarmupTemplate {
  subject: string;
  body: string;
}

export const WARMUP_SEND_TEMPLATES: WarmupTemplate[] = [
  {
    subject: "Quick question about the Q3 timeline",
    body: `Hi,\n\nI wanted to follow up on the Q3 timeline we discussed last week. Do you have an updated estimate for when the deliverables will be ready?\n\nLet me know when you get a chance.\n\nThanks`,
  },
  {
    subject: "Re: Vendor onboarding documents",
    body: `Hi,\n\nJust checking in on the vendor onboarding documents we requested. We're trying to get everything finalized before the end of the month.\n\nCould you send those over when you have a moment?\n\nAppreciate it`,
  },
  {
    subject: "Following up on our call",
    body: `Hi,\n\nIt was great speaking with you earlier this week. I wanted to follow up on a couple of the points we covered.\n\nWould you be available for a brief call Thursday or Friday afternoon to go over the next steps?\n\nLooking forward to it`,
  },
  {
    subject: "Invoice for October services",
    body: `Hi,\n\nPlease find attached the invoice for October services as discussed. Payment terms are net 30 from the invoice date.\n\nLet me know if you have any questions or if anything looks off.\n\nThank you`,
  },
  {
    subject: "Team introduction — new project lead",
    body: `Hi,\n\nI wanted to introduce myself — I've recently taken over as project lead for the ongoing integration work.\n\nI'll be your main point of contact going forward. Looking forward to working together and making sure everything stays on track.\n\nBest`,
  },
  {
    subject: "Updated meeting notes from Tuesday",
    body: `Hi,\n\nAttached are the updated meeting notes from Tuesday's session. I've highlighted the action items and owners for each.\n\nPlease review and let me know if anything needs to be corrected before I circulate to the wider team.\n\nThanks`,
  },
  {
    subject: "Access request for the shared drive",
    body: `Hi,\n\nCould you grant me access to the shared project drive? I've been trying to pull up the latest specs but keep getting a permissions error.\n\nMy email is the one I'm writing from.\n\nAppreciate the help`,
  },
  {
    subject: "Status update on the API integration",
    body: `Hi,\n\nJust a quick status update — we've completed the initial API mapping and are now in testing. We expect to have a working prototype ready by end of next week.\n\nI'll send over a more detailed report once testing wraps up.\n\nCheers`,
  },
  {
    subject: "Checking in — any blockers on your end?",
    body: `Hi,\n\nWanted to check in and see if there are any blockers on your end that might affect the delivery schedule.\n\nWe're on track from our side but wanted to make sure we're aligned before the Thursday sync.\n\nThanks`,
  },
  {
    subject: "Contract renewal — action needed",
    body: `Hi,\n\nOur current service agreement expires at the end of this month. I wanted to reach out early to make sure we have enough time to review and sign the renewal before the deadline.\n\nI've sent over the updated terms separately. Please let me know if you'd like to set up a call to go through them.\n\nBest`,
  },
  {
    subject: "Request for updated contact list",
    body: `Hi,\n\nCould you send over the updated contact list for the project team? We want to make sure our distribution list is current before the next round of communications goes out.\n\nThanks in advance`,
  },
  {
    subject: "Feedback on the latest draft",
    body: `Hi,\n\nI've reviewed the latest draft and have a few minor suggestions. Overall it looks solid — just a couple of sections that could use a bit of tightening.\n\nI'll send over my notes shortly. Let me know if you'd prefer to discuss on a call instead.\n\nThanks`,
  },
  {
    subject: "Reminder: form due by Friday",
    body: `Hi,\n\nJust a quick reminder that the compliance form needs to be submitted by end of day Friday.\n\nIf you've already sent it, please disregard. If not, the link is in the previous email.\n\nLet me know if you run into any issues.\n\nThanks`,
  },
  {
    subject: "Schedule update for next week",
    body: `Hi,\n\nA quick heads up — the team meeting originally planned for Monday has been moved to Wednesday at 2pm.\n\nPlease update your calendar accordingly. The dial-in details remain the same.\n\nSee you then`,
  },
  {
    subject: "Re: Software license renewal",
    body: `Hi,\n\nThanks for sending over the renewal quote. I've reviewed it and it looks reasonable.\n\nI'll need to get sign-off from our finance team before we can proceed. I expect to have an answer for you by early next week.\n\nWill keep you posted`,
  },
  {
    subject: "Quick note on the budget allocation",
    body: `Hi,\n\nI wanted to flag a small discrepancy in the budget allocation spreadsheet you sent over. The Q4 column doesn't seem to add up correctly.\n\nCan you take a look and send a corrected version? Happy to jump on a call if that's easier.\n\nThanks`,
  },
  {
    subject: "Welcome to the team",
    body: `Hi,\n\nJust wanted to reach out and say welcome! We're glad to have you on board.\n\nFeel free to reach out if you have any questions as you get settled in. I'm happy to help with introductions or point you toward the right resources.\n\nLooking forward to working together`,
  },
  {
    subject: "Follow-up: project proposal",
    body: `Hi,\n\nI wanted to follow up on the project proposal I sent over last week. Have you had a chance to review it?\n\nI'm flexible on a few of the scope items if adjustments are needed. Just let me know your thoughts when you get a moment.\n\nBest`,
  },
  {
    subject: "Report attached — please review",
    body: `Hi,\n\nPlease find the monthly report attached. Key highlights are on the first page.\n\nLet me know if you'd like me to walk you through anything in more detail.\n\nThanks`,
  },
  {
    subject: "Confirming our Thursday meeting",
    body: `Hi,\n\nJust confirming our meeting for Thursday at 10am. I've sent a calendar invite to the email on file.\n\nThe agenda will include a brief review of current progress and a discussion of next steps for Q4.\n\nLook forward to connecting`,
  },
  {
    subject: "Quick check-in before the deadline",
    body: `Hi,\n\nWanted to touch base before the end-of-month deadline. We're wrapping up our side of things and just wanted to confirm you haven't run into any issues that might cause a delay.\n\nLet me know if there's anything you need from us.\n\nThanks`,
  },
  {
    subject: "Updated SOW attached",
    body: `Hi,\n\nPlease find the updated Statement of Work attached. We've incorporated the feedback from last week's review — specifically around the revised timeline and the two scope additions we discussed.\n\nLet me know if this looks right before we move to signatures.\n\nBest`,
  },
  {
    subject: "Checking in on the open items",
    body: `Hi,\n\nJust looping back on the open items from our last call. I have three still marked as pending on my end — wanted to make sure none of them are blocked on anything from your side.\n\nHappy to send over the list if that's helpful.\n\nThanks`,
  },
  {
    subject: "New point of contact going forward",
    body: `Hi,\n\nI wanted to let you know that Sarah will be taking over as your main point of contact starting next Monday. She's fully up to speed and will reach out shortly to introduce herself.\n\nIt's been great working with you — please don't hesitate to reach out if you need anything in the meantime.\n\nBest`,
  },
  {
    subject: "Heads up on the system maintenance window",
    body: `Hi,\n\nJust a quick heads up — we have a scheduled maintenance window this Saturday from 11pm to 2am EST. The platform will be unavailable during that time.\n\nNo action needed on your end. We'll send a confirmation once the maintenance is complete.\n\nApologies for any inconvenience`,
  },
  {
    subject: "Following up on the proposal",
    body: `Hi,\n\nI wanted to circle back on the proposal I sent over two weeks ago. I know things get busy — just wanted to make sure it didn't get lost in the shuffle.\n\nHappy to jump on a quick call if you'd like to talk through any of the details.\n\nNo pressure either way — just let me know where things stand.\n\nThanks`,
  },
  {
    subject: "Resource allocation for next quarter",
    body: `Hi,\n\nAs we head into planning for next quarter, I wanted to get a sense of what resourcing you'll need from our team.\n\nAre the current engagement levels still working for you, or do you anticipate needing more bandwidth in any specific area?\n\nWould love to get ahead of this before headcount decisions get finalized.\n\nBest`,
  },
  {
    subject: "Sharing the latest performance data",
    body: `Hi,\n\nAttached is the latest performance report covering the past 30 days. A few highlights worth noting on page 2.\n\nOverall the numbers look solid. There's one metric we're keeping an eye on, which I've flagged in the summary.\n\nLet me know if you'd like to go through it together.\n\nThanks`,
  },
  {
    subject: "Quick note on the deliverable format",
    body: `Hi,\n\nBefore we finalize the deliverable, I wanted to confirm the preferred format on your end. In the past we've used PDF, but I know some teams prefer an editable version for internal review.\n\nJust let me know your preference and we'll get it to you in the right format.\n\nThanks`,
  },
  {
    subject: "Invoice reminder — payment due next week",
    body: `Hi,\n\nThis is a friendly reminder that invoice #4471 for $3,200 is due on Friday. Please let me know if you have any questions about the charges or if there's anything on your end holding things up.\n\nIf payment has already been initiated, please disregard.\n\nThank you`,
  },
  {
    subject: "Revised timeline based on updated requirements",
    body: `Hi,\n\nGiven the scope changes we discussed last week, I've revised the project timeline. The overall delivery date moves from the 18th to the 25th, with a few internal milestones shifted accordingly.\n\nI've attached a redlined version showing what changed and why.\n\nLet me know if this works or if there are hard constraints I should know about.\n\nBest`,
  },
  {
    subject: "Office closed — holiday schedule",
    body: `Hi,\n\nJust a note that our office will be closed from the 24th through the 27th for the holiday. We'll be back and fully operational on the 28th.\n\nAny urgent matters during that time can be directed to the general inbox and someone on call will respond within 24 hours.\n\nHappy holidays`,
  },
  {
    subject: "Requesting a reference letter",
    body: `Hi,\n\nI hope you're doing well. I'm reaching out to see if you'd be willing to provide a reference letter for an upcoming partnership application.\n\nI can send over a summary of the key points to cover if that would make things easier. The deadline is the end of next month.\n\nCompletely understand if timing doesn't work — just wanted to ask.\n\nThank you`,
  },
  {
    subject: "Platform update — new features live",
    body: `Hi,\n\nI wanted to let you know that we've pushed a platform update this morning. Two features you asked about — bulk export and the custom reporting view — are now live.\n\nDocumentation is linked in the release notes I've attached. Let us know if you run into anything unexpected.\n\nThanks for your patience while we got these built out`,
  },
  {
    subject: "Clarification on the audit requirements",
    body: `Hi,\n\nI reviewed the audit checklist you sent and had a couple of clarifying questions before we start pulling documentation.\n\nSpecifically — items 7 and 12 seem to overlap with what we submitted last quarter. Should we resubmit those or will last quarter's documentation carry over?\n\nWant to make sure we don't do double the work unnecessarily.\n\nThanks`,
  },
  {
    subject: "Proposal for process improvement",
    body: `Hi,\n\nI've been thinking about the handoff process between our teams and I think there's an opportunity to reduce the back-and-forth significantly.\n\nI put together a short one-pager with a suggested workflow. Would you be open to reviewing it and sharing your thoughts on a call?\n\nIt's nothing major — just a few tweaks that could save both sides a few hours a week.\n\nBest`,
  },
  {
    subject: "Your account is up for renewal",
    body: `Hi,\n\nYour annual account is set to renew on the 15th of next month. I wanted to reach out in advance in case you'd like to discuss your current plan or explore any adjustments before the renewal processes.\n\nLet me know if you'd like to set up a quick call.\n\nBest`,
  },
  {
    subject: "Welcome back — account reactivated",
    body: `Hi,\n\nGreat to have you back. Your account has been reactivated as requested. Everything should be accessible from your usual login.\n\nIf you notice anything missing or out of place from before, let me know and I'll sort it out right away.\n\nThanks`,
  },
  {
    subject: "Introducing our new partnership program",
    body: `Hi,\n\nI wanted to reach out because based on our work together, I think you might be a strong fit for the partner program we're launching next quarter.\n\nIt's still in early stages but the core benefits include co-marketing opportunities, priority support, and a dedicated account manager.\n\nWould you be open to a 20-minute call to hear more?\n\nBest`,
  },
  {
    subject: "End-of-year review request",
    body: `Hi,\n\nAs we close out the year, I'd love to get your honest feedback on how the engagement has gone. Even a few sentences via email would be incredibly helpful for our team.\n\nSpecifically, I'm curious what went well, what could be improved, and whether you'd continue working with us going forward.\n\nThank you in advance — it genuinely helps us get better.\n\nBest`,
  },
  {
    subject: "Policy update — please review",
    body: `Hi,\n\nWe've made some updates to our data handling and retention policy, effective the first of next month. The changes are fairly minor but we're required to notify all active accounts.\n\nThe updated policy is attached. If you have any questions or concerns, feel free to reach out.\n\nThank you`,
  },
  {
    subject: "Re: Design feedback",
    body: `Hi,\n\nThanks for the detailed feedback on the mockups. A few of your points were really useful — especially the note about the navigation flow.\n\nWe're incorporating the changes now and should have a revised version ready for your review by end of week.\n\nAppreciate you taking the time.\n\nBest`,
  },
  {
    subject: "Sharing a resource you might find useful",
    body: `Hi,\n\nI came across this industry report and thought of you given the work you're doing. It has some useful benchmarks for Q3 that might be relevant for your planning.\n\nNo agenda — just thought it was worth passing along.\n\nHope things are going well on your end.\n\nBest`,
  },
  {
    subject: "Handoff notes from the project",
    body: `Hi,\n\nAs we wrap up this phase of the project, I've put together a handoff document covering everything your team will need going forward — credentials, key contacts, documentation links, and known issues.\n\nPlease review and let me know if anything looks incomplete.\n\nIt's been a pleasure working on this together.\n\nBest`,
  },
  {
    subject: "Request to reschedule Friday's call",
    body: `Hi,\n\nSomething has come up and I need to move Friday's call. Would Tuesday or Wednesday of next week work on your end?\n\nHappy to work around your schedule — just send over a few times that work and I'll confirm.\n\nSorry for the short notice.\n\nThanks`,
  },
  {
    subject: "Quarterly business review — save the date",
    body: `Hi,\n\nWe're scheduling our quarterly business reviews for the first two weeks of next month. I'd like to book 45 minutes with you to go over performance, upcoming goals, and anything you'd like us to prioritize.\n\nI'll send over a scheduling link separately — just wanted to give you a heads up so you can hold some time.\n\nLooking forward to it`,
  },
  {
    subject: "Team offsite — logistics confirmation",
    body: `Hi,\n\nJust confirming the logistics for the offsite next week. The venue is confirmed, catering is set, and the agenda has been finalized.\n\nI've attached the full schedule and a parking/transport guide. Please share with anyone on your team who's attending.\n\nLet me know if you have any last-minute questions.\n\nSee you there`,
  },
  {
    subject: "Following up — decision still pending?",
    body: `Hi,\n\nI know you mentioned a decision would be made by the end of last month — I just wanted to check in and see if there's been any movement or if there's anything I can provide to help move things forward.\n\nNo rush — I just want to make sure the ball isn't sitting in our court without me realizing it.\n\nThanks`,
  },
  {
    subject: "Compliance documentation — annual submission",
    body: `Hi,\n\nIt's that time of year again. I'm gathering the annual compliance documentation for our records and wanted to flag that we'll need the updated certificate of insurance and W-9 on file by the 30th.\n\nIf these haven't changed since last year, a quick confirmation email works too.\n\nThank you`,
  },
];

export const WARMUP_REPLY_TEMPLATES: WarmupTemplate[] = [
  { subject: "", body: "Thanks for the update. I'll review and get back to you shortly." },
  { subject: "", body: "Got it, noted. Will follow up once I've had a chance to look this over." },
  { subject: "", body: "Appreciate the heads up. Looks good from my end." },
  { subject: "", body: "Thanks — I'll check with the team and come back to you." },
  { subject: "", body: "Received. I'll get back to you by end of week." },
  { subject: "", body: "Thanks for sending this over. Will review and confirm." },
  { subject: "", body: "All noted. I'll make sure this gets actioned on our side." },
  { subject: "", body: "Perfect, thank you. I'll pass this along." },
  { subject: "", body: "Sounds good. Let's connect Thursday to go over the details." },
  { subject: "", body: "Thanks for following up. I'll get you a response by tomorrow." },
  { subject: "", body: "Got it — that works for me. I'll update our records accordingly." },
  { subject: "", body: "Thanks for the heads up. I've flagged this for our team and we'll make sure it's handled." },
  { subject: "", body: "Appreciate you looping me in. I'll take a look at the attachment and reach back out if I have questions." },
  { subject: "", body: "Noted, thank you. We'll align on our end and follow up before the deadline." },
  { subject: "", body: "That all makes sense. I'll confirm with the relevant people here and get back to you by Wednesday." },
  { subject: "", body: "Thanks for the reminder. I'll get this sorted today." },
  { subject: "", body: "Sounds like a plan. I'll block the time and send confirmation shortly." },
  { subject: "", body: "Good to know — I'll keep this in mind as we move forward. Thanks for the context." },
  { subject: "", body: "Received, thank you. We'll review internally and come back to you with any questions." },
  { subject: "", body: "Appreciate the detail here. A few things to digest but I'll get back to you once I've had a chance to read through properly." },
  { subject: "", body: "Thanks — timing works on my end. I'll make sure the right people are looped in." },
  { subject: "", body: "Got it. I'll take this to our finance team and let you know what they say." },
  { subject: "", body: "Thanks for the context. Helpful to know — I'll adjust our approach accordingly." },
  { subject: "", body: "All good on our end. Let's plan to reconnect after the deadline passes." },
  { subject: "", body: "Noted. I'll hold the time and confirm by end of day." },
  { subject: "", body: "Thanks for the quick turnaround on this. I'll review it today and follow up if anything looks off." },
  { subject: "", body: "Appreciate you staying on top of this. I'll do the same on our side and keep you posted." },
  { subject: "", body: "Got it — that's a reasonable ask. I'll see what I can pull together and get it to you by Friday." },
  { subject: "", body: "Thanks for the update. No blockers on our end — we're tracking well against the plan." },
  { subject: "", body: "Makes sense. I'll loop in the rest of the team and we can finalize on the call." },
];

/**
 * Deterministically select a template based on a seed string.
 * Same inbox pair always picks from the same rotation bucket,
 * but different pairs get different templates.
 */
export function selectSendTemplate(seed: string): WarmupTemplate {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % WARMUP_SEND_TEMPLATES.length;
  return WARMUP_SEND_TEMPLATES[idx];
}

export function selectReplyTemplate(seed: string): WarmupTemplate {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % WARMUP_REPLY_TEMPLATES.length;
  return WARMUP_REPLY_TEMPLATES[idx];
}
