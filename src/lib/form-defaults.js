export function getDefaultFormState() {
  const today = new Date().toISOString().split('T')[0]

  return {
    // Section 1: Header
    employee_id: '',
    report_date: today,
    shift_start: '',
    shift_end: '',
    total_hours: 0,

    // Section 2: Communications
    comms_ghl_calls_chats: false,
    comms_ghl_emails: false,
    comms_workiz_messages: false,
    comms_yelp: false,
    comms_facebook_instagram: false,
    comms_sms_text: false,
    comms_web_forms: false,
    comms_docket: false,

    // Section 3: Call & Messaging Metrics
    total_inbound_calls: 0,
    total_outbound_calls: 0,
    missed_calls: 0,
    missed_call_rate: 0,
    speed_to_lead: '',
    speed_to_lead_minutes: null,
    speed_to_lead_conversations: 0,
    total_sms_sent: 0,
    total_sms_received: 0,
    total_fb_messages_sent: 0,
    total_fb_messages_received: 0,
    total_ig_messages_sent: 0,
    total_ig_messages_received: 0,
    total_messages_sent: 0,
    total_messages_received: 0,

    // Section 4: Dispositions
    disp_booked: 0,
    disp_quoted: 0,
    disp_followup_required: 0,
    disp_not_qualified: 0,
    disp_lost: 0,
    disp_voicemail: 0,
    daily_booking_rate: 0,

    // Section 5: Jobs Booked (array of entries)
    jobs_booked: [],

    // Section 6: Emails & Web Forms (array of entries)
    email_submissions: [],

    // Section 7: Yelp Leads (array of entries)
    yelp_leads: [],

    // Section 8: Follow-Ups (array of entries)
    followups: [],

    // Section 9: Docket Activity
    docket_clients_created: 0,
    docket_agreements_sent: 0,
    docket_agreements_signed: 0,
    docket_tasks_created: 0,
    docket_dumpsters_com_orders: 0,
    docket_followups: 0,
    docket_asset_availability_verified: false,
    docket_notes: '',

    // Section 10: Workiz Activity
    workiz_jobs_created: 0,
    workiz_jobs_completed: 0,
    workiz_payments_count: 0,
    workiz_payments_total: 0,
    workiz_tomorrow_verified: false,
    workiz_followup_needed: false,
    workiz_notes: '',

    // Section 11: GHL Pipeline
    pipeline_new_leads_contacted: false,
    pipeline_no_stale_leads: false,
    pipeline_booked_updated: false,
    pipeline_lost_updated: false,
    pipeline_quoted_followup_scheduled: false,
    pipeline_stages_match: false,

    // Section 12: Notes
    issues: '',
    management_attention: '',
    suggestions: '',
    carried_over: '',

    // Section 13: Bonus Tracking
    upsell_count: 0,
    review_assists: 0,
    winback_bookings: 0,
    cancellation_count: 0,
    noshow_count: 0,

    // Metadata
    status: 'draft',
  }
}

export function getDefaultJobEntry() {
  return {
    id: crypto.randomUUID(),
    job_number: '',
    customer_name: '',
    job_type: '',
    system: '',
    estimated_revenue: '',
    scheduled_date: '',
    lead_source: '',
    ghl_pipeline_updated: false,
    notes: '',
  }
}

export function getDefaultEmailEntry() {
  return {
    id: crypto.randomUUID(),
    customer_name: '',
    source: '',
    status: '',
    notes: '',
  }
}

export function getDefaultYelpEntry() {
  return {
    id: crypto.randomUUID(),
    customer_name: '',
    status: '',
    followup_needed: false,
    notes: '',
  }
}

export function getDefaultFollowupEntry() {
  return {
    id: crypto.randomUUID(),
    job_number: '',
    customer_name: '',
    attempt_number: '',
    followup_timing: '',
    channel: '',
    result: '',
    notes: '',
  }
}
