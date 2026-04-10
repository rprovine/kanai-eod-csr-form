// CSR_EMPLOYEES is now fetched from Supabase at runtime
// This fallback is used if Supabase is not configured
export const CSR_EMPLOYEES_FALLBACK = [
  { id: '', name: 'Select CSR...' },
  { id: 'csr1', name: 'CSR 1' },
  { id: 'csr2', name: 'CSR 2' },
  { id: 'csr3', name: 'CSR 3' },
]

// Supabase table names (prefixed to avoid conflicts with field supervisor project)
export const TABLES = {
  employees: 'csr_employees',
  eod_reports: 'csr_eod_reports',
  jobs_booked: 'csr_eod_jobs_booked',
  email_submissions: 'csr_eod_email_submissions',
  yelp_leads: 'csr_eod_yelp_leads',
  followups: 'csr_eod_followups',
  pay_period_summaries: 'csr_pay_period_summaries',
}

export const SPEED_TO_LEAD_OPTIONS = [
  { value: 'under_5', label: 'Under 5 min' },
  { value: '5_to_10', label: '5-10 min' },
  { value: '10_to_15', label: '10-15 min' },
  { value: 'over_15', label: 'Over 15 min' },
]

export const DISPOSITION_TYPES = [
  { key: 'disp_booked', label: 'Booked', definition: 'Customer committed. Job created in Workiz or Docket.' },
  { key: 'disp_quoted', label: 'Quoted / Estimate Given', definition: 'Customer received pricing but hasn\'t committed. Active follow-up required.' },
  { key: 'disp_followup_required', label: 'Follow-Up Required', definition: 'Customer interested but needs callback (spouse approval, timing, etc.)' },
  { key: 'disp_not_qualified', label: 'Not Qualified', definition: 'Not a real lead (wrong number, spam, out of service area, not our service)' },
  { key: 'disp_lost', label: 'Lost', definition: 'Customer chose not to book. Reason must be noted.' },
  { key: 'disp_voicemail', label: 'Voicemail / No Answer', definition: 'Customer didn\'t answer. Triggers follow-up sequence.' },
]

export const JOB_TYPES = [
  { value: 'junk_removal', label: 'Junk Removal', system: 'Workiz' },
  { value: 'dumpster_rental', label: 'Dumpster Rental', system: 'Docket' },
]

export const LEAD_SOURCES = [
  { value: 'phone', label: 'Phone' },
  { value: 'yelp', label: 'Yelp' },
  { value: 'google', label: 'Google' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'web_form', label: 'Web Form' },
  { value: 'referral', label: 'Referral' },
  { value: 'dumpsters_com', label: 'Dumpsters.com' },
  { value: 'repeat', label: 'Repeat Customer' },
  { value: 'other', label: 'Other' },
]

export const EMAIL_SOURCES = [
  { value: 'email', label: 'Email' },
  { value: 'web_form', label: 'Web Form' },
  { value: 'submission_form', label: 'Submission Form' },
]

export const EMAIL_STATUSES = [
  { value: 'booked', label: 'Booked' },
  { value: 'waiting_reply', label: 'Waiting Reply' },
  { value: 'declined', label: 'Declined' },
  { value: 'followup_scheduled', label: 'Follow-Up Scheduled' },
]

export const YELP_STATUSES = [
  { value: 'booked', label: 'Booked' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'waiting_reply', label: 'Waiting Reply' },
  { value: 'not_qualified', label: 'Not Qualified' },
  { value: 'lost', label: 'Lost' },
]

export const FOLLOWUP_ATTEMPT_OPTIONS = [
  { value: 1, label: '1st Attempt' },
  { value: 2, label: '2nd Attempt' },
  { value: 3, label: '3rd Attempt' },
  { value: 4, label: 'Final Attempt' },
]

export const FOLLOWUP_TIMING_OPTIONS = [
  { value: '2_hours', label: '2 hours after quote' },
  { value: 'next_day', label: 'Next day' },
  { value: 'day_3', label: 'Day 3' },
  { value: 'final', label: 'Final attempt' },
]

export const FOLLOWUP_CHANNELS = [
  { value: 'ghl_sms', label: 'GHL SMS' },
  { value: 'ghl_call', label: 'GHL Call' },
  { value: 'ghl_email', label: 'GHL Email' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
]

export const FOLLOWUP_RESULTS = [
  { value: 'booked', label: 'Booked' },
  { value: 'rescheduled', label: 'Rescheduled Callback' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'declined', label: 'Declined' },
  { value: 'moved_to_lost', label: 'Moved to Lost' },
]

export const COMMUNICATION_CHANNELS = [
  { key: 'comms_ghl_calls_chats', label: 'Responded to all incoming calls/chats in GHL' },
  { key: 'comms_ghl_emails', label: 'Responded to all GHL email inquiries' },
  { key: 'comms_workiz_messages', label: 'Replied to all Workiz messages' },
  { key: 'comms_yelp', label: 'Replied to all Yelp leads/messages' },
  { key: 'comms_facebook_instagram', label: 'Responded to all Facebook/Instagram messages in GHL' },
  { key: 'comms_sms_text', label: 'Responded to all SMS/text inquiries in GHL' },
  { key: 'comms_web_forms', label: 'Checked and responded to all web form submissions' },
  { key: 'comms_docket', label: 'Checked Docket for any dumpster-related messages/notifications' },
]

export const PIPELINE_CHECKS = [
  { key: 'pipeline_new_leads_contacted', label: 'All new leads contacted or in active follow-up sequence' },
  { key: 'pipeline_no_stale_leads', label: 'No leads stuck in "New Lead" stage for more than 5 minutes without attempt' },
  { key: 'pipeline_booked_updated', label: 'All booked jobs have GHL pipeline stage updated to "Booked" or "Scheduled"' },
  { key: 'pipeline_lost_updated', label: 'All lost leads moved to "Lost" with reason noted' },
  { key: 'pipeline_quoted_followup_scheduled', label: 'All quoted leads have follow-up task scheduled' },
  { key: 'pipeline_stages_match', label: 'GHL pipeline stages match actual job status in Workiz/Docket' },
]

export const COACHING_CATEGORIES = [
  { key: 'greeting_professionalism', summaryKey: 'avg_greeting', label: 'Greeting & Professionalism', short: 'Greeting' },
  { key: 'needs_discovery', summaryKey: 'avg_needs_discovery', label: 'Needs Discovery', short: 'Discovery' },
  { key: 'pricing_confidence', summaryKey: 'avg_pricing_confidence', label: 'Pricing Confidence', short: 'Pricing' },
  { key: 'objection_handling', summaryKey: 'avg_objection_handling', label: 'Objection Handling', short: 'Objections' },
  { key: 'close_attempt', summaryKey: 'avg_close_attempt', label: 'Close Attempt', short: 'Closing' },
]

export const BADGE_CONFIG = {
  top_scorer: { label: 'Top Scorer', color: 'text-accent-gold', bg: 'bg-accent-gold/10', border: 'border-accent-gold/20' },
  most_improved: { label: 'Most Improved', color: 'text-accent-green', bg: 'bg-accent-green/10', border: 'border-accent-green/20' },
  booking_champ: { label: 'Booking Champ', color: 'text-kanai-blue-light', bg: 'bg-kanai-blue/10', border: 'border-kanai-blue/20' },
  perfect_greeting: { label: 'Perfect Greeting', color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' },
  streak_3: { label: '3-Week Streak', color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20' },
  streak_5: { label: '5-Week Streak', color: 'text-accent-red', bg: 'bg-accent-red/10', border: 'border-accent-red/20' },
}

export const FORM_SECTIONS = [
  { id: 1, title: 'Shift Info', shortTitle: 'Shift' },
  { id: 2, title: 'Communications', shortTitle: 'Comms' },
  { id: 3, title: 'Call Metrics', shortTitle: 'Calls' },
  { id: 4, title: 'Dispositions', shortTitle: 'Disps' },
  { id: 5, title: 'Jobs Booked', shortTitle: 'Jobs' },
  { id: 6, title: 'Emails & Forms', shortTitle: 'Emails' },
  { id: 7, title: 'Yelp Leads', shortTitle: 'Yelp' },
  { id: 8, title: 'Follow-Ups', shortTitle: 'F/U' },
  { id: 9, title: 'Docket Activity', shortTitle: 'Docket' },
  { id: 10, title: 'Workiz Activity', shortTitle: 'Workiz' },
  { id: 11, title: 'GHL Pipeline', shortTitle: 'GHL' },
  { id: 12, title: 'Notes', shortTitle: 'Notes' },
  { id: 13, title: 'Bonus Tracking', shortTitle: 'Bonus' },
  { id: 14, title: 'KPI Dashboard', shortTitle: 'KPIs' },
]
