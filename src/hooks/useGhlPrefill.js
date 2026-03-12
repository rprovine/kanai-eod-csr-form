import { useState, useCallback, useRef } from 'react'
import { fetchPrefill, fetchPipelineStatus } from '../lib/ghlApi'

// Fields that can be auto-filled from GHL
const GHL_PREFILL_FIELDS = new Set([
  'total_inbound_calls',
  'total_outbound_calls',
  'missed_calls',
  'missed_call_rate',
  'speed_to_lead',
  'speed_to_lead_minutes',
  'total_sms_sent',
  'total_sms_received',
  'total_fb_messages_sent',
  'total_fb_messages_received',
  'total_ig_messages_sent',
  'total_ig_messages_received',
  'total_messages_sent',
  'total_messages_received',
  'disp_booked',
  'disp_quoted',
  'disp_followup_required',
  'disp_not_qualified',
  'disp_lost',
])

export function useGhlPrefill(setFields) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fieldSources, setFieldSources] = useState({}) // { fieldName: 'system' | 'edited' }
  const [ghlValues, setGhlValues] = useState({}) // original GHL values for discrepancy detection
  const [pipelineData, setPipelineData] = useState(null)
  const [locationInbound, setLocationInbound] = useState(null)
  const [speedToLeadDetail, setSpeedToLeadDetail] = useState(null)
  const lastFetchRef = useRef(null)

  // Load GHL data and prefill form fields
  const loadGhlData = useCallback(async (employeeId, date) => {
    if (!employeeId || !date) return

    // Prevent duplicate fetches
    const key = `${employeeId}-${date}`
    if (lastFetchRef.current === key) return
    lastFetchRef.current = key

    setLoading(true)
    setError(null)

    try {
      // Fetch prefill and pipeline data in parallel
      const [prefillResult, pipelineResult] = await Promise.all([
        fetchPrefill(employeeId, date),
        fetchPipelineStatus(employeeId, date),
      ])

      if (prefillResult?.fields && Object.keys(prefillResult.fields).length > 0) {
        // Apply prefill data to form
        setFields(prefillResult.fields)

        // Track which fields came from GHL
        const sources = {}
        for (const field of Object.keys(prefillResult.fields)) {
          sources[field] = 'system'
        }
        setFieldSources(sources)
        setGhlValues({ ...prefillResult.fields })
      }

      if (prefillResult?._counts?.total_location_inbound != null) {
        setLocationInbound(prefillResult._counts.total_location_inbound)
      }

      if (prefillResult?.speed_to_lead_detail) {
        setSpeedToLeadDetail(prefillResult.speed_to_lead_detail)
      }

      if (pipelineResult?.pipeline) {
        setPipelineData(pipelineResult.pipeline)
      }

      if (prefillResult?._warning) {
        setError(prefillResult._warning)
      }
    } catch (err) {
      console.error('GHL prefill error:', err)
      setError('Could not load GHL data')
    } finally {
      setLoading(false)
    }
  }, [setFields])

  // Refresh GHL data (manual trigger)
  const refreshGhlData = useCallback(async (employeeId, date) => {
    lastFetchRef.current = null // Reset to allow re-fetch
    await loadGhlData(employeeId, date)
  }, [loadGhlData])

  // Track when a CSR edits a GHL-prefilled field
  const trackFieldEdit = useCallback((fieldName, newValue) => {
    setFieldSources((prev) => {
      if (!prev[fieldName]) return prev // Not a GHL field, ignore
      return { ...prev, [fieldName]: 'edited' }
    })
  }, [])

  // Get source badge for a field
  const getFieldSource = useCallback((fieldName) => {
    return fieldSources[fieldName] || null
  }, [fieldSources])

  // Check if a field value significantly differs from GHL value (>20%)
  const getDiscrepancy = useCallback((fieldName, currentValue) => {
    if (!ghlValues[fieldName] || !GHL_PREFILL_FIELDS.has(fieldName)) return null
    if (fieldSources[fieldName] !== 'edited') return null

    const ghlVal = parseFloat(ghlValues[fieldName]) || 0
    const curVal = parseFloat(currentValue) || 0

    if (ghlVal === 0) return null
    const deviation = Math.abs(curVal - ghlVal) / ghlVal
    if (deviation > 0.2) {
      return {
        ghlValue: ghlVal,
        currentValue: curVal,
        deviationPercent: Math.round(deviation * 100),
      }
    }
    return null
  }, [ghlValues, fieldSources])

  return {
    loading,
    error,
    fieldSources,
    pipelineData,
    locationInbound,
    speedToLeadDetail,
    ghlValues,
    loadGhlData,
    refreshGhlData,
    trackFieldEdit,
    getFieldSource,
    getDiscrepancy,
  }
}
