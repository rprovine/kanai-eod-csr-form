import { FORM_SECTIONS } from '../../lib/constants'
import { cn } from '../../lib/utils'
import { Check } from 'lucide-react'

export default function ProgressIndicator({ currentSection, onSectionClick, completedSections = [] }) {
  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex gap-1 min-w-max px-1">
        {FORM_SECTIONS.map((section) => {
          const isActive = currentSection === section.id
          const isCompleted = completedSections.includes(section.id)

          return (
            <button
              key={section.id}
              onClick={() => onSectionClick(section.id)}
              className={cn(
                'flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                isActive
                  ? 'bg-kanai-blue text-white shadow-lg shadow-kanai-blue/30'
                  : isCompleted
                    ? 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                    : 'bg-card-bg text-slate-400 border border-card-border hover:border-slate-500 hover:text-slate-300'
              )}
            >
              {isCompleted && <Check className="w-3 h-3" />}
              <span className="hidden sm:inline">{section.shortTitle}</span>
              <span className="sm:hidden">{section.id}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
