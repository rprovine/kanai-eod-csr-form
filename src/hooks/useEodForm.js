import { useReducer, useCallback } from 'react'
import { getDefaultFormState } from '../lib/form-defaults'
import { calcTotalHours, calcMissedCallRate, calcBookingRate, calcDispositionLoggingRate } from '../lib/kpi-calculations'

function recalculate(state) {
  const totalHours = calcTotalHours(state.shift_start, state.shift_end)
  const missedCallRate = calcMissedCallRate(state.missed_calls, state.total_inbound_calls)
  const bookingRate = calcBookingRate(
    state.disp_booked || 0,
    state.disp_quoted || 0,
    state.disp_followup_required || 0,
    state.disp_lost || 0
  )
  const dispositionRate = calcDispositionLoggingRate(state)

  return {
    ...state,
    total_hours: totalHours,
    missed_call_rate: Math.round(missedCallRate * 10) / 10,
    daily_booking_rate: Math.round(bookingRate * 10) / 10,
    disposition_logging_rate: Math.round(dispositionRate * 10) / 10,
  }
}

function formReducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD': {
      const updated = { ...state, [action.field]: action.value }
      return recalculate(updated)
    }
    case 'SET_FIELDS': {
      const updated = { ...state, ...action.fields }
      return recalculate(updated)
    }
    case 'ADD_ARRAY_ITEM': {
      return {
        ...state,
        [action.field]: [...state[action.field], action.item],
      }
    }
    case 'UPDATE_ARRAY_ITEM': {
      return {
        ...state,
        [action.field]: state[action.field].map((item) =>
          item.id === action.itemId ? { ...item, [action.key]: action.value } : item
        ),
      }
    }
    case 'REMOVE_ARRAY_ITEM': {
      return {
        ...state,
        [action.field]: state[action.field].filter((item) => item.id !== action.itemId),
      }
    }
    case 'LOAD_STATE': {
      return recalculate({ ...getDefaultFormState(), ...action.state })
    }
    case 'RESET': {
      return recalculate(getDefaultFormState())
    }
    default:
      return state
  }
}

export function useEodForm(initialState) {
  const [formData, dispatch] = useReducer(
    formReducer,
    initialState || getDefaultFormState(),
    (init) => recalculate(init)
  )

  const setField = useCallback((field, value) => {
    dispatch({ type: 'SET_FIELD', field, value })
  }, [])

  const setFields = useCallback((fields) => {
    dispatch({ type: 'SET_FIELDS', fields })
  }, [])

  const addArrayItem = useCallback((field, item) => {
    dispatch({ type: 'ADD_ARRAY_ITEM', field, item })
  }, [])

  const updateArrayItem = useCallback((field, itemId, key, value) => {
    dispatch({ type: 'UPDATE_ARRAY_ITEM', field, itemId, key, value })
  }, [])

  const removeArrayItem = useCallback((field, itemId) => {
    dispatch({ type: 'REMOVE_ARRAY_ITEM', field, itemId })
  }, [])

  const loadState = useCallback((state) => {
    dispatch({ type: 'LOAD_STATE', state })
  }, [])

  const resetForm = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  return {
    formData,
    setField,
    setFields,
    addArrayItem,
    updateArrayItem,
    removeArrayItem,
    loadState,
    resetForm,
  }
}
