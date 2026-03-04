import { useEffect, useRef } from 'react'

const STORAGE_KEY = 'kanai-eod-draft'
const DEBOUNCE_MS = 2000

export function useAutoSave(formData, loadState) {
  const timeoutRef = useRef(null)
  const isInitialLoad = useRef(true)

  // Load saved draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && parsed.status === 'draft') {
          loadState(parsed)
        }
      }
    } catch {
      // Ignore parse errors
    }
    isInitialLoad.current = false
  }, [loadState])

  // Auto-save on changes (debounced)
  useEffect(() => {
    if (isInitialLoad.current) return
    if (formData.status !== 'draft') return

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(formData))
      } catch {
        // Storage full or unavailable
      }
    }, DEBOUNCE_MS)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [formData])
}

export function clearSavedDraft() {
  localStorage.removeItem(STORAGE_KEY)
}

export function hasSavedDraft() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return !!saved
  } catch {
    return false
  }
}
