import { supabase, isSupabaseConfigured } from './supabase'
import { TABLES } from './constants'

export async function fetchEmployees() {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from(TABLES.employees)
    .select('id, name, email, role')
    .eq('is_active', true)
    .order('name')
  if (error) {
    console.error('Error fetching employees:', error)
    return []
  }
  return data || []
}

export async function fetchReports({ startDate, endDate, employeeId } = {}) {
  if (!isSupabaseConfigured()) return []

  let query = supabase
    .from(TABLES.eod_reports)
    .select('id, employee_id, report_date, shift_start, shift_end, submitted_at, status, total_inbound_calls, total_outbound_calls, total_qualified_calls, missed_calls, speed_to_lead, disp_booked, disp_quoted, disp_followup_required, disp_not_qualified, disp_lost, disp_voicemail, docket_clients_created, docket_agreements_sent, workiz_jobs_created, workiz_jobs_completed')
    .eq('status', 'submitted')
    .order('report_date', { ascending: false })

  if (startDate) query = query.gte('report_date', startDate)
  if (endDate) query = query.lte('report_date', endDate)
  if (employeeId) query = query.eq('employee_id', employeeId)

  const { data, error } = await query
  if (error) {
    console.error('Error fetching reports:', error)
    return []
  }

  // Attach employee names
  if (data?.length > 0) {
    const employeeIds = [...new Set(data.map(r => r.employee_id).filter(Boolean))]
    if (employeeIds.length > 0) {
      const { data: employees } = await supabase
        .from(TABLES.employees)
        .select('id, name')
        .in('id', employeeIds)
      const nameMap = Object.fromEntries((employees || []).map(e => [e.id, e.name]))
      data.forEach(r => { r.employee_name = nameMap[r.employee_id] || 'Unknown' })
    }
  }

  return data || []
}

export async function fetchReportDetail(reportId) {
  if (!isSupabaseConfigured()) return null

  const { data: report, error } = await supabase
    .from(TABLES.eod_reports)
    .select('*')
    .eq('id', reportId)
    .single()

  if (error) {
    console.error('Error fetching report detail:', error)
    return null
  }

  // Fetch child records
  const [jobsRes, emailsRes, yelpRes, followupsRes] = await Promise.all([
    supabase.from(TABLES.jobs_booked).select('*').eq('eod_report_id', reportId),
    supabase.from(TABLES.email_submissions).select('*').eq('eod_report_id', reportId),
    supabase.from(TABLES.yelp_leads).select('*').eq('eod_report_id', reportId),
    supabase.from(TABLES.followups).select('*').eq('eod_report_id', reportId),
  ])

  // Fetch employee name
  if (report.employee_id) {
    const { data: emp } = await supabase
      .from(TABLES.employees)
      .select('name')
      .eq('id', report.employee_id)
      .single()
    report.employee_name = emp?.name || 'Unknown'
  }

  return {
    ...report,
    jobs_booked: jobsRes.data || [],
    email_submissions: emailsRes.data || [],
    yelp_leads: yelpRes.data || [],
    followups: followupsRes.data || [],
  }
}

export async function saveEodReport(formData) {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured — report saved locally only')
    return { success: true, local: true }
  }

  // Separate main report fields from child records
  const { jobs_booked, email_submissions, yelp_leads, followups, ...reportFields } = formData

  // Remove client-side-only fields
  delete reportFields.daily_booking_rate
  delete reportFields.disposition_logging_rate
  delete reportFields.missed_call_rate
  delete reportFields.total_hours
  delete reportFields.status

  // Add server-side metadata
  const reportData = {
    ...reportFields,
    submitted_at: new Date().toISOString(),
    status: 'submitted',
  }

  try {
    // Upsert main report
    const { data: report, error: reportError } = await supabase
      .from(TABLES.eod_reports)
      .upsert(reportData, { onConflict: 'employee_id,report_date' })
      .select()
      .single()

    if (reportError) throw reportError

    const reportId = report.id

    // Save child records (delete existing first, then insert new)
    if (jobs_booked?.length > 0) {
      await supabase.from(TABLES.jobs_booked).delete().eq('eod_report_id', reportId)
      const jobRows = jobs_booked.map(({ id, ...job }) => ({ ...job, eod_report_id: reportId }))
      const { error } = await supabase.from(TABLES.jobs_booked).insert(jobRows)
      if (error) console.error('Error saving jobs:', error)
    }

    if (email_submissions?.length > 0) {
      await supabase.from(TABLES.email_submissions).delete().eq('eod_report_id', reportId)
      const rows = email_submissions.map(({ id, ...item }) => ({ ...item, eod_report_id: reportId }))
      const { error } = await supabase.from(TABLES.email_submissions).insert(rows)
      if (error) console.error('Error saving emails:', error)
    }

    if (yelp_leads?.length > 0) {
      await supabase.from(TABLES.yelp_leads).delete().eq('eod_report_id', reportId)
      const rows = yelp_leads.map(({ id, ...item }) => ({ ...item, eod_report_id: reportId }))
      const { error } = await supabase.from(TABLES.yelp_leads).insert(rows)
      if (error) console.error('Error saving yelp leads:', error)
    }

    if (followups?.length > 0) {
      await supabase.from(TABLES.followups).delete().eq('eod_report_id', reportId)
      const rows = followups.map(({ id, ...item }) => ({ ...item, eod_report_id: reportId }))
      const { error } = await supabase.from(TABLES.followups).insert(rows)
      if (error) console.error('Error saving followups:', error)
    }

    return { success: true, reportId }
  } catch (error) {
    console.error('Error saving EOD report:', error)
    return { success: false, error: error.message }
  }
}
