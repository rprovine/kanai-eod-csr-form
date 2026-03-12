import { Clock, User } from 'lucide-react'
import FormCard from '../shared/FormCard'
import { Label, Input, Select } from '../shared/FormField'
export default function HeaderSection({ formData, setField, employees = [] }) {
  return (
    <FormCard title="Shift Information" subtitle="Section 1 of 14" icon={User}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label htmlFor="employee_id">CSR Name</Label>
          <Select
            id="employee_id"
            value={formData.employee_id}
            onChange={(e) => setField('employee_id', e.target.value)}
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="report_date">Date</Label>
          <Input
            id="report_date"
            type="date"
            value={formData.report_date}
            onChange={(e) => setField('report_date', e.target.value)}
          />
        </div>

        <div className="hidden sm:block" />

        <div>
          <Label htmlFor="shift_start">Shift Start</Label>
          <Input
            id="shift_start"
            type="time"
            value={formData.shift_start}
            onChange={(e) => setField('shift_start', e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="shift_end">Shift End</Label>
          <Input
            id="shift_end"
            type="time"
            value={formData.shift_end}
            onChange={(e) => setField('shift_end', e.target.value)}
          />
        </div>

        {formData.total_hours > 0 && (
          <div className="sm:col-span-2">
            <div className="flex items-center gap-2 bg-kanai-blue/10 border border-kanai-blue/30 rounded-lg px-4 py-2.5">
              <Clock className="w-4 h-4 text-kanai-blue-light" />
              <span className="text-sm text-slate-300">
                Total Hours: <span className="font-semibold text-kanai-blue-light">{formData.total_hours} hrs</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </FormCard>
  )
}
