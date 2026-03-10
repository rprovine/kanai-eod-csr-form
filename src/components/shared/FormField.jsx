import { cn } from '../../lib/utils'

export function SourceBadge({ source }) {
  if (!source) return null
  if (source === 'system') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-accent-green/15 text-accent-green border border-accent-green/30 ml-1.5">
        GHL
      </span>
    )
  }
  if (source === 'edited') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 ml-1.5">
        Edited
      </span>
    )
  }
  return null
}

export function Label({ children, htmlFor, className, source }) {
  return (
    <label htmlFor={htmlFor} className={cn('flex items-center text-sm font-medium text-slate-300 mb-1.5', className)}>
      {children}
      <SourceBadge source={source} />
    </label>
  )
}

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'w-full bg-slate-800 border border-card-border rounded-lg px-3 py-2 text-sm text-slate-100',
        'placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-kanai-blue focus:border-transparent',
        'transition-colors',
        className
      )}
      {...props}
    />
  )
}

export function Select({ children, className, ...props }) {
  return (
    <select
      className={cn(
        'w-full bg-slate-800 border border-card-border rounded-lg px-3 py-2 text-sm text-slate-100',
        'focus:outline-none focus:ring-2 focus:ring-kanai-blue focus:border-transparent',
        'transition-colors',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        'w-full bg-slate-800 border border-card-border rounded-lg px-3 py-2 text-sm text-slate-100',
        'placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-kanai-blue focus:border-transparent',
        'transition-colors resize-y min-h-[80px]',
        className
      )}
      {...props}
    />
  )
}

export function Checkbox({ label, checked, onChange, className }) {
  return (
    <label className={cn('flex items-start gap-3 cursor-pointer group', className)}>
      <div className="relative mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="sr-only peer"
        />
        <div className="w-5 h-5 rounded border-2 border-card-border bg-slate-800 peer-checked:bg-kanai-blue peer-checked:border-kanai-blue transition-colors flex items-center justify-center">
          {checked && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
      <span className="text-sm text-slate-300 group-hover:text-slate-100 transition-colors leading-relaxed">{label}</span>
    </label>
  )
}

export function NumberInput({ value, onChange, min = 0, className, ...props }) {
  return (
    <Input
      type="number"
      min={min}
      value={value || ''}
      onChange={(e) => onChange(parseInt(e.target.value) || 0)}
      className={cn('text-center', className)}
      {...props}
    />
  )
}

export function DollarInput({ value, onChange, className, ...props }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={value || ''}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={cn('pl-7', className)}
        {...props}
      />
    </div>
  )
}
