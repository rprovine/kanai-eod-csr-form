import { supabase, isSupabaseConfigured } from './supabase'
import { TABLES } from './constants'

export async function fetchEmployees(includeHireDate = false) {
  if (!isSupabaseConfigured()) return []
  const fields = includeHireDate ? 'id, name, email, role, hire_date' : 'id, name, email, role'
  const { data, error } = await supabase
    .from(TABLES.employees)
    .select(fields)
    .eq('is_active', true)
    .order('name')
  if (error) {
    console.error('Error fetching employees:', error)
    return []
  }
  return data || []
}

export async function fetchReports({ startDate, endDate, employeeId } = {}) {
  if (!isSupabaseConfigured()) return { reports: [], jobsBooked: [] }

  let query = supabase
    .from(TABLES.eod_reports)
    .select('*, csr_employees!csr_eod_reports_employee_id_fkey(name)')
    .eq('status', 'submitted')
    .order('report_date', { ascending: true })

  if (startDate) query = query.gte('report_date', startDate)
  if (endDate) query = query.lte('report_date', endDate)
  if (employeeId) query = query.eq('employee_id', employeeId)

  const { data, error } = await query
  if (error) {
    console.error('Error fetching reports:', error)
    return { reports: [], jobsBooked: [] }
  }

  const reports = data || []

  // Fetch jobs booked for these reports
  let jobsBooked = []
  if (reports.length > 0) {
    const reportIds = reports.map(r => r.id)
    const { data: jobs, error: jobsError } = await supabase
      .from(TABLES.jobs_booked)
      .select('*')
      .in('eod_report_id', reportIds)
    if (!jobsError) jobsBooked = jobs || []
  }

  return { reports, jobsBooked }
}

export async function saveEodReport(formData, { ghlSuggestions } = {}) {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured — report saved locally only')
    return { success: true, local: true }
  }

  // Separate main report fields from child records
  const { jobs_booked, email_submissions, yelp_leads, followups, ...reportFields } = formData

  // Remove client-side-only computed fields
  delete reportFields.daily_booking_rate
  delete reportFields.disposition_logging_rate
  delete reportFields.missed_call_rate
  delete reportFields.total_hours
  delete reportFields.status
  delete reportFields.speed_to_lead_conversations

  // Add GHL suggestion audit data if available
  if (ghlSuggestions) {
    reportFields.ghl_suggested_disp_booked = ghlSuggestions.disp_booked ?? null
    reportFields.ghl_suggested_disp_lost = ghlSuggestions.disp_lost ?? null
  }

  // Convert empty time strings to null (PostgreSQL time columns reject empty strings)
  if (reportFields.shift_start === '') reportFields.shift_start = null
  if (reportFields.shift_end === '') reportFields.shift_end = null

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
