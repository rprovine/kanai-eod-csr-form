import { useState, useCallback } from 'react'
import { fetchWorkizJobs, fetchGhlAttributions } from '../lib/ghlApi'
import { LEAD_SOURCES } from '../lib/constants'

// Map GHL attribution source values to LEAD_SOURCES dropdown values
const SOURCE_MAP = {
  'google': 'google',
  'google ads': 'google',
  'google lsa': 'google',
  'yelp': 'yelp',
  'facebook': 'facebook',
  'facebook ads': 'facebook',
  'instagram': 'instagram',
  'referral': 'referral',
  'direct': 'direct',
  'web form': 'web_form',
  'website': 'web_form',
  'dumpsters.com': 'dumpsters_com',
  'repeat': 'repeat',
  'repeat customer': 'repeat',
  'phone': 'phone',
}

function mapGhlSourceToLeadSource(ghlSource) {
  if (!ghlSource) return ''
  const key = ghlSource.toLowerCase().trim()
  if (SOURCE_MAP[key]) return SOURCE_MAP[key]
  // Check if any LEAD_SOURCES value matches directly
  const directMatch = LEAD_SOURCES.find(
    (ls) => ls.value === key || ls.label.toLowerCase() === key
  )
  if (directMatch) return directMatch.value
  return 'other'
}

export function useWorkizImport(addArrayItem) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastImport, setLastImport] = useState(null)

  const importJobs = useCallback(async (date) => {
    if (!date) {
      setError('No date selected')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Step 1: Fetch completed jobs from Workiz
      const workizResult = await fetchWorkizJobs(date)
      if (!workizResult?.jobs || workizResult.jobs.length === 0) {
        setError('No completed Workiz jobs found for this date')
        setLoading(false)
        return
      }

      const jobs = workizResult.jobs

      // Step 2: Collect all customer phones for GHL attribution lookup
      const phones = jobs
        .map((j) => j.customerPhone)
        .filter(Boolean)

      let attributions = {}
      if (phones.length > 0) {
        const attrResult = await fetchGhlAttributions(phones)
        attributions = attrResult?.attributions || {}
      }

      // Step 3: Create job entries from Workiz data + GHL attribution
      let importCount = 0
      for (const job of jobs) {
        const ghlSource = job.customerPhone ? attributions[job.customerPhone] : null
        const leadSource = mapGhlSourceToLeadSource(ghlSource)

        const entry = {
          id: crypto.randomUUID(),
          job_number: job.jobNumber || '',
          customer_name: job.customerName || '',
          job_type: 'junk_removal',
          system: 'Workiz',
          estimated_revenue: job.revenue || '',
          scheduled_date: job.scheduledDate || date,
          lead_source: leadSource,
          ghl_pipeline_updated: false,
          notes: ghlSource ? `Marketing: ${ghlSource} (from GHL)` : 'Imported from Workiz',
        }

        addArrayItem('jobs_booked', entry)
        importCount++
      }

      setLastImport({ count: importCount, date })
    } catch (err) {
      console.error('Workiz import error:', err)
      setError('Failed to import Workiz jobs')
    } finally {
      setLoading(false)
    }
  }, [addArrayItem])

  return {
    loading,
    error,
    lastImport,
    importJobs,
  }
}
