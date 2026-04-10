import { useState, useEffect, useCallback } from 'react'

const API_BASE = '/api/coaching'

async function fetchApi(endpoint, params = {}) {
  const url = new URL(endpoint, window.location.origin)
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, v)
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export function useCoachingData() {
  const [selectedEmployee, setSelectedEmployee] = useState('all')
  const [weeklySummaries, setWeeklySummaries] = useState([])
  const [calls, setCalls] = useState([])
  const [selectedCall, setSelectedCall] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [badges, setBadges] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [leaderboardWeeks, setLeaderboardWeeks] = useState([])
  const [loading, setLoading] = useState({
    summaries: false,
    calls: false,
    callDetail: false,
    assignments: false,
    badges: false,
    leaderboard: false,
  })

  const setLoadingKey = (key, value) => {
    setLoading(prev => ({ ...prev, [key]: value }))
  }

  const loadWeeklySummaries = useCallback(async () => {
    setLoadingKey('summaries', true)
    try {
      const params = { weeks: '12' }
      if (selectedEmployee !== 'all') params.employee_id = selectedEmployee
      const { summaries } = await fetchApi(`${API_BASE}/weekly-summary`, params)
      setWeeklySummaries(summaries || [])
    } catch (err) {
      console.error('Failed to load weekly summaries:', err)
      setWeeklySummaries([])
    } finally {
      setLoadingKey('summaries', false)
    }
  }, [selectedEmployee])

  const loadCalls = useCallback(async (startDate, endDate) => {
    setLoadingKey('calls', true)
    try {
      const params = { limit: '50' }
      if (selectedEmployee !== 'all') params.employee_id = selectedEmployee
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate
      const { calls: data } = await fetchApi(`${API_BASE}/calls`, params)
      setCalls(data || [])
    } catch (err) {
      console.error('Failed to load calls:', err)
      setCalls([])
    } finally {
      setLoadingKey('calls', false)
    }
  }, [selectedEmployee])

  const loadCallDetail = useCallback(async (callId) => {
    if (!callId) { setSelectedCall(null); return }
    setLoadingKey('callDetail', true)
    try {
      const { call } = await fetchApi(`${API_BASE}/call-detail`, { call_id: callId })
      setSelectedCall(call)
    } catch (err) {
      console.error('Failed to load call detail:', err)
      setSelectedCall(null)
    } finally {
      setLoadingKey('callDetail', false)
    }
  }, [])

  const loadAssignments = useCallback(async () => {
    setLoadingKey('assignments', true)
    try {
      const params = {}
      if (selectedEmployee !== 'all') params.employee_id = selectedEmployee
      const { assignments: data } = await fetchApi(`${API_BASE}/assignments`, params)
      setAssignments(data || [])
    } catch (err) {
      console.error('Failed to load assignments:', err)
      setAssignments([])
    } finally {
      setLoadingKey('assignments', false)
    }
  }, [selectedEmployee])

  const loadBadges = useCallback(async () => {
    setLoadingKey('badges', true)
    try {
      const params = {}
      if (selectedEmployee !== 'all') params.employee_id = selectedEmployee
      const { badges: data } = await fetchApi(`${API_BASE}/badges`, params)
      setBadges(data || [])
    } catch (err) {
      console.error('Failed to load badges:', err)
      setBadges([])
    } finally {
      setLoadingKey('badges', false)
    }
  }, [selectedEmployee])

  const loadLeaderboard = useCallback(async (weeks = 1) => {
    setLoadingKey('leaderboard', true)
    try {
      const { leaderboard: data, weeks: weeksData } = await fetchApi(`${API_BASE}/leaderboard`, { weeks })
      setLeaderboard(data || [])
      setLeaderboardWeeks(weeksData || [])
    } catch (err) {
      console.error('Failed to load leaderboard:', err)
      setLeaderboard([])
    } finally {
      setLoadingKey('leaderboard', false)
    }
  }, [])

  // Load overview data when employee changes
  useEffect(() => {
    loadWeeklySummaries()
    loadAssignments()
    loadBadges()
  }, [loadWeeklySummaries, loadAssignments, loadBadges])

  return {
    selectedEmployee,
    setSelectedEmployee,
    weeklySummaries,
    calls,
    selectedCall,
    assignments,
    badges,
    leaderboard,
    leaderboardWeeks,
    loading,
    loadWeeklySummaries,
    loadCalls,
    loadCallDetail,
    loadAssignments,
    loadBadges,
    loadLeaderboard,
    setSelectedCall,
  }
}
