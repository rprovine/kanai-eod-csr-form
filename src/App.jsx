import { useState, useEffect, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Send, Save, RotateCcw, Loader2 } from 'lucide-react'
import FormLayout from './components/layout/FormLayout'
import ProgressIndicator from './components/shared/ProgressIndicator'
import HeaderSection from './components/eod-form/HeaderSection'
import CommunicationsSection from './components/eod-form/CommunicationsSection'
import CallMetricsSection from './components/eod-form/CallMetricsSection'
import DispositionsSection from './components/eod-form/DispositionsSection'
import JobsBookedSection from './components/eod-form/JobsBookedSection'
import EmailSubmissionsSection from './components/eod-form/EmailSubmissionsSection'
import YelpLeadsSection from './components/eod-form/YelpLeadsSection'
import FollowUpsSection from './components/eod-form/FollowUpsSection'
import DocketActivitySection from './components/eod-form/DocketActivitySection'
import WorkizActivitySection from './components/eod-form/WorkizActivitySection'
import PipelineCheckSection from './components/eod-form/PipelineCheckSection'
import NotesSection from './components/eod-form/NotesSection'
import KPIDashboardSection from './components/eod-form/KPIDashboardSection'
import CSRReportsView from './components/reports/CSRReportsView'
import { useEodForm } from './hooks/useEodForm'
import { useAutoSave, clearSavedDraft } from './hooks/useAutoSave'
import { useGhlPrefill } from './hooks/useGhlPrefill'
import { calcAllKPIs } from './lib/kpi-calculations'
import { FORM_SECTIONS, COMMUNICATION_CHANNELS, PIPELINE_CHECKS, CSR_EMPLOYEES_FALLBACK } from './lib/constants'
import { fetchEmployees, saveEodReport } from './lib/supabase-data'

function ConfirmationModal({ formData, kpis, onConfirm, onCancel, isSubmitting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card-bg border border-card-border rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
        <h3 className="text-lg font-bold text-slate-100 mb-4">Confirm EOD Report Submission</h3>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-card-border">
            <span className="text-slate-400">Booking Rate</span>
            <span className={`font-semibold ${kpis.performanceTier.color}`}>{kpis.bookingRate}%</span>
          </div>
          <div className="flex justify-between py-2 border-b border-card-border">
            <span className="text-slate-400">Missed Call Rate</span>
            <span className="font-semibold text-slate-100">{kpis.missedCallRate}%</span>
          </div>
          <div className="flex justify-between py-2 border-b border-card-border">
            <span className="text-slate-400">Bonus Eligible</span>
            <span className={`font-bold ${kpis.bonusEligible ? 'text-accent-green' : 'text-accent-red'}`}>
              {kpis.bonusEligible ? 'YES' : 'NO'}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-4">
          By submitting, you confirm that all information in this EOD report is accurate and complete.
          This report cannot be edited after submission.
        </p>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg border border-card-border text-slate-300 hover:bg-slate-800 transition-colors text-sm font-medium"
          >
            Go Back
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-lg bg-accent-green text-white font-medium text-sm hover:bg-accent-green/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SubmittedView({ formData, onNewReport }) {
  return (
    <div className="space-y-6">
      <div className="bg-accent-green/10 border border-accent-green/30 rounded-xl p-6 text-center">
        <div className="w-16 h-16 bg-accent-green/20 rounded-full flex items-center justify-center mx-auto mb-3">
          <Send className="w-8 h-8 text-accent-green" />
        </div>
        <h2 className="text-xl font-bold text-accent-green">EOD Report Submitted</h2>
        <p className="text-sm text-slate-400 mt-1">
          {formData.report_date} — Report has been saved successfully
        </p>
      </div>

      <KPIDashboardSection formData={formData} />

      <button
        onClick={onNewReport}
        className="w-full py-3 rounded-xl bg-kanai-blue text-white font-medium hover:bg-kanai-blue/90 transition-colors flex items-center justify-center gap-2"
      >
        <RotateCcw className="w-4 h-4" />
        Start New Report
      </button>
    </div>
  )
}

export default function App() {
  const { formData, setField: rawSetField, setFields, addArrayItem, updateArrayItem, removeArrayItem, loadState, resetForm } = useEodForm()
  const ghl = useGhlPrefill(setFields)
  const [view, setView] = useState('form')
  const [currentSection, setCurrentSection] = useState(1)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [employees, setEmployees] = useState(CSR_EMPLOYEES_FALLBACK)

  // Wrap setField to track GHL edits
  const setField = useCallback((field, value) => {
    ghl.trackFieldEdit(field, value)
    rawSetField(field, value)
  }, [rawSetField, ghl])

  useAutoSave(formData, loadState)

  // Load employees from Supabase on mount
  useEffect(() => {
    fetchEmployees().then((data) => {
      if (data.length > 0) {
        setEmployees([{ id: '', name: 'Select CSR...' }, ...data])
      }
    })
  }, [])

  // Load GHL data when employee and date are both set
  useEffect(() => {
    if (formData.employee_id && formData.report_date) {
      ghl.loadGhlData(formData.employee_id, formData.report_date)
    }
  }, [formData.employee_id, formData.report_date, ghl.loadGhlData])

  const kpis = useMemo(() => calcAllKPIs(formData), [formData])

  const completedSections = useMemo(() => {
    const completed = []
    if (formData.employee_id && formData.shift_start && formData.shift_end) completed.push(1)
    if (COMMUNICATION_CHANNELS.every((ch) => formData[ch.key])) completed.push(2)
    if (formData.total_inbound_calls > 0 || formData.total_outbound_calls > 0) completed.push(3)
    if (formData.disp_booked > 0 || formData.disp_quoted > 0 || formData.disp_followup_required > 0 ||
        formData.disp_not_qualified > 0 || formData.disp_lost > 0 || formData.disp_voicemail > 0) completed.push(4)
    if (formData.jobs_booked.length > 0) completed.push(5)
    if (formData.email_submissions.length > 0) completed.push(6)
    if (formData.yelp_leads.length > 0) completed.push(7)
    if (formData.followups.length > 0) completed.push(8)
    if (formData.docket_clients_created > 0 || formData.docket_agreements_sent > 0 || formData.docket_asset_availability_verified) completed.push(9)
    if (formData.workiz_jobs_created > 0 || formData.workiz_jobs_completed > 0 || formData.workiz_tomorrow_verified) completed.push(10)
    if (PIPELINE_CHECKS.every((ch) => formData[ch.key])) completed.push(11)
    if (formData.issues || formData.management_attention || formData.suggestions || formData.carried_over) completed.push(12)
    completed.push(13)
    return completed
  }, [formData])

  const handleSubmit = useCallback(() => {
    setShowConfirmation(true)
  }, [])

  const handleConfirmSubmit = useCallback(async () => {
    setIsSubmitting(true)
    try {
      const result = await saveEodReport(formData)
      if (result.success) {
        setField('status', 'submitted')
        clearSavedDraft()
        setShowConfirmation(false)
        setIsSubmitted(true)
      } else {
        alert('Error saving report: ' + (result.error || 'Unknown error'))
      }
    } catch (err) {
      alert('Error saving report: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }, [setField, formData])

  const handleNewReport = useCallback(() => {
    resetForm()
    setCurrentSection(1)
    setIsSubmitted(false)
    clearSavedDraft()
  }, [resetForm])

  const formProps = { formData, setField, setFields, addArrayItem, updateArrayItem, removeArrayItem }

  const renderSection = () => {
    switch (currentSection) {
      case 1: return <HeaderSection {...formProps} employees={employees} />
      case 2: return <CommunicationsSection {...formProps} />
      case 3: return <CallMetricsSection {...formProps} ghl={ghl} />
      case 4: return <DispositionsSection {...formProps} ghl={ghl} />
      case 5: return <JobsBookedSection {...formProps} />
      case 6: return <EmailSubmissionsSection {...formProps} />
      case 7: return <YelpLeadsSection {...formProps} />
      case 8: return <FollowUpsSection {...formProps} />
      case 9: return <DocketActivitySection {...formProps} />
      case 10: return <WorkizActivitySection {...formProps} />
      case 11: return <PipelineCheckSection {...formProps} ghl={ghl} />
      case 12: return <NotesSection {...formProps} />
      case 13: return <KPIDashboardSection {...formProps} />
      default: return null
    }
  }

  if (view === 'reports') {
    return (
      <FormLayout view="reports" onViewChange={setView}>
        <CSRReportsView />
      </FormLayout>
    )
  }

  if (isSubmitted) {
    return (
      <FormLayout view="form" onViewChange={setView}>
        <SubmittedView formData={formData} onNewReport={handleNewReport} />
      </FormLayout>
    )
  }

  return (
    <FormLayout view="form" onViewChange={setView}>
      <div className="space-y-4">
        <ProgressIndicator
          currentSection={currentSection}
          onSectionClick={setCurrentSection}
          completedSections={completedSections}
        />

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <Save className="w-3 h-3" />
            Auto-saving draft
          </span>
          <span>
            {completedSections.length - 1}/{FORM_SECTIONS.length - 1} sections with data
          </span>
        </div>

        {renderSection()}

        <div className="flex items-center justify-between gap-3 pt-2 pb-8">
          <button
            onClick={() => setCurrentSection(Math.max(1, currentSection - 1))}
            disabled={currentSection === 1}
            className="flex items-center gap-1 px-4 py-2.5 rounded-lg border border-card-border text-slate-300 hover:bg-slate-800 transition-colors text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          {currentSection === 13 ? (
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-accent-green text-white font-medium text-sm hover:bg-accent-green/90 transition-colors shadow-lg shadow-accent-green/20"
            >
              <Send className="w-4 h-4" />
              Submit EOD Report
            </button>
          ) : (
            <button
              onClick={() => setCurrentSection(Math.min(13, currentSection + 1))}
              className="flex items-center gap-1 px-4 py-2.5 rounded-lg bg-kanai-blue text-white font-medium text-sm hover:bg-kanai-blue/90 transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {showConfirmation && (
        <ConfirmationModal
          formData={formData}
          kpis={kpis}
          onConfirm={handleConfirmSubmit}
          onCancel={() => setShowConfirmation(false)}
          isSubmitting={isSubmitting}
        />
      )}
    </FormLayout>
  )
}
