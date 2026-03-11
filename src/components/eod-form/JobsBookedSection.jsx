import { useState } from 'react'
import { Briefcase, Sparkles, Download, Loader2, AlertCircle } from 'lucide-react'
import FormCard from '../shared/FormCard'
import RepeatableEntry from '../shared/RepeatableEntry'
import { Label, Input, Select, DollarInput, Checkbox } from '../shared/FormField'
import { JOB_TYPES, LEAD_SOURCES } from '../../lib/constants'
import { getDefaultJobEntry } from '../../lib/form-defaults'

const TEAM_LEADS = [
  { value: 'Zakea', label: 'Zakea' },
  { value: 'Rey', label: 'Rey' },
  { value: 'Xavier', label: 'Xavier' },
]

function GhlSuggestions({ pipelineData, existingJobs, onAddSuggestion }) {
  if (!pipelineData?.opportunities?.length) return null

  // Filter to opportunities that look like bookings and aren't already added
  const bookedOpps = pipelineData.opportunities.filter((opp) => {
    const stage = (opp.stage || '').toLowerCase()
    const isBooked = stage.includes('book') || stage.includes('won') || stage.includes('schedul')
    if (!isBooked) return false
    // Check if already in jobs list by name match
    const alreadyAdded = existingJobs.some((j) =>
      j.customer_name && opp.name && j.customer_name.toLowerCase() === opp.name.toLowerCase()
    )
    return !alreadyAdded
  })

  if (bookedOpps.length === 0) return null

  return (
    <div className="mb-4 bg-ghl-purple/10 border border-ghl-purple/30 rounded-lg px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-ghl-purple" />
        <span className="text-sm font-medium text-ghl-purple">GHL Pipeline Suggestions</span>
      </div>
      <p className="text-xs text-slate-400 mb-3">
        These opportunities were moved to "Booked" in GHL today:
      </p>
      <div className="space-y-2">
        {bookedOpps.slice(0, 5).map((opp, i) => (
          <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
            <div>
              <span className="text-sm text-slate-200">{opp.name || 'Unknown'}</span>
              {opp.value > 0 && (
                <span className="text-xs text-slate-400 ml-2">${opp.value.toLocaleString()}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onAddSuggestion(opp)}
              className="text-xs px-2.5 py-1 rounded bg-ghl-purple/20 text-ghl-purple hover:bg-ghl-purple/30 transition-colors"
            >
              + Add
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function WorkizImportButton({ workizImport, reportDate }) {
  const [selectedLead, setSelectedLead] = useState('')

  if (!workizImport) return null

  const { loading, error, lastImport, importJobs } = workizImport

  return (
    <div className="mb-4 bg-slate-800/40 border border-card-border rounded-lg px-4 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selectedLead}
          onChange={(e) => setSelectedLead(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800 border border-card-border text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-kanai-blue"
        >
          <option value="">Select Team Lead...</option>
          {TEAM_LEADS.map((tl) => (
            <option key={tl.value} value={tl.value}>{tl.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => importJobs(reportDate, selectedLead || null)}
          disabled={loading || !selectedLead}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-kanai-blue/20 border border-kanai-blue/40 text-kanai-blue-light text-sm font-medium hover:bg-kanai-blue/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {loading ? 'Importing...' : 'Import from Workiz'}
        </button>
        {lastImport && (
          <span className="text-xs text-slate-400">
            Imported {lastImport.count} job{lastImport.count !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {error && (
        <div className="mt-2 flex items-center gap-2 text-xs text-amber-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}

export default function JobsBookedSection({ formData, addArrayItem, updateArrayItem, removeArrayItem, ghl, workizImport }) {
  const totalRevenue = formData.jobs_booked.reduce(
    (sum, job) => sum + (parseFloat(job.estimated_revenue) || 0), 0
  )

  const handleAddGhlSuggestion = (opp) => {
    const entry = {
      ...getDefaultJobEntry(),
      customer_name: opp.name || '',
      estimated_revenue: opp.value || '',
      ghl_pipeline_updated: true,
      notes: `From GHL pipeline — ${opp.stage || 'Booked'}`,
    }
    addArrayItem('jobs_booked', entry)
  }

  return (
    <FormCard title="Jobs Booked Today" subtitle="Section 5 of 13" icon={Briefcase}>
      <WorkizImportButton workizImport={workizImport} reportDate={formData.report_date} />

      <GhlSuggestions
        pipelineData={ghl?.pipelineData}
        existingJobs={formData.jobs_booked}
        onAddSuggestion={handleAddGhlSuggestion}
      />

      <RepeatableEntry
        title="Job"
        items={formData.jobs_booked}
        onAdd={() => addArrayItem('jobs_booked', getDefaultJobEntry())}
        onRemove={(id) => removeArrayItem('jobs_booked', id)}
        emptyMessage="No jobs booked yet. Click + to add a booking."
        renderItem={(item) => (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Job Number</Label>
              <Input
                value={item.job_number}
                onChange={(e) => updateArrayItem('jobs_booked', item.id, 'job_number', e.target.value)}
                placeholder="WZ-1234 or DK-5678"
              />
            </div>
            <div>
              <Label>Customer Name</Label>
              <Input
                value={item.customer_name}
                onChange={(e) => updateArrayItem('jobs_booked', item.id, 'customer_name', e.target.value)}
                placeholder="Customer name"
              />
            </div>
            <div>
              <Label>Job Type</Label>
              <Select
                value={item.job_type}
                onChange={(e) => {
                  const jt = e.target.value
                  const system = JOB_TYPES.find((j) => j.value === jt)?.system || ''
                  updateArrayItem('jobs_booked', item.id, 'job_type', jt)
                  updateArrayItem('jobs_booked', item.id, 'system', system)
                }}
              >
                <option value="">Select type...</option>
                {JOB_TYPES.map((jt) => (
                  <option key={jt.value} value={jt.value}>{jt.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>System</Label>
              <Input value={item.system || '—'} disabled className="opacity-60" />
            </div>
            <div>
              <Label>Estimated Revenue</Label>
              <DollarInput
                value={item.estimated_revenue}
                onChange={(v) => updateArrayItem('jobs_booked', item.id, 'estimated_revenue', v)}
              />
            </div>
            <div>
              <Label>Scheduled Date</Label>
              <Input
                type="date"
                value={item.scheduled_date}
                onChange={(e) => updateArrayItem('jobs_booked', item.id, 'scheduled_date', e.target.value)}
              />
            </div>
            <div>
              <Label>Lead Source</Label>
              <Select
                value={item.lead_source}
                onChange={(e) => updateArrayItem('jobs_booked', item.id, 'lead_source', e.target.value)}
              >
                <option value="">Select source...</option>
                {LEAD_SOURCES.map((ls) => (
                  <option key={ls.value} value={ls.value}>{ls.label}</option>
                ))}
              </Select>
            </div>
            <div className="flex items-end">
              <Checkbox
                label="GHL Pipeline Updated"
                checked={item.ghl_pipeline_updated}
                onChange={(e) => updateArrayItem('jobs_booked', item.id, 'ghl_pipeline_updated', e.target.checked)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Input
                value={item.notes}
                onChange={(e) => updateArrayItem('jobs_booked', item.id, 'notes', e.target.value)}
                placeholder="Additional notes..."
              />
            </div>
          </div>
        )}
      />

      {formData.jobs_booked.length > 0 && (
        <div className="mt-4 flex items-center justify-between bg-accent-green/10 border border-accent-green/30 rounded-lg px-4 py-2.5">
          <span className="text-sm text-accent-green font-medium">
            {formData.jobs_booked.length} job{formData.jobs_booked.length !== 1 ? 's' : ''} booked
          </span>
          <span className="text-sm text-accent-green font-semibold">
            ${totalRevenue.toLocaleString()}
          </span>
        </div>
      )}
    </FormCard>
  )
}
