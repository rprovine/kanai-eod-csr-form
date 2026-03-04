import { cn } from '../../lib/utils'

export default function FormCard({ title, subtitle, icon: Icon, children, className }) {
  return (
    <div className={cn('bg-card-bg border border-card-border rounded-xl p-5 sm:p-6', className)}>
      {(title || Icon) && (
        <div className="flex items-start gap-3 mb-5">
          {Icon && (
            <div className="p-2 bg-kanai-blue/20 rounded-lg shrink-0">
              <Icon className="w-5 h-5 text-kanai-blue-light" />
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
            {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}
