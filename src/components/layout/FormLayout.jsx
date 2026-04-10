import { Truck, ClipboardList, BarChart3, GraduationCap, Bot } from 'lucide-react'

export default function FormLayout({ children, view = 'form', onViewChange }) {
  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card-bg/95 backdrop-blur border-b border-card-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-kanai-blue rounded-lg">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-100">Kanai's Roll Off</h1>
              <p className="text-xs text-slate-400">CSR End-of-Day Report</p>
            </div>
          </div>

          {onViewChange && (
            <div className="flex items-center bg-dark-bg rounded-lg p-1 border border-card-border">
              <button
                onClick={() => onViewChange('form')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  view === 'form'
                    ? 'bg-kanai-blue text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                EOD Form
              </button>
              <button
                onClick={() => onViewChange('reports')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  view === 'reports'
                    ? 'bg-kanai-blue text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Reports
              </button>
              <button
                onClick={() => onViewChange('training')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  view === 'training'
                    ? 'bg-kanai-blue text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Training
              </button>
              <button
                onClick={() => onViewChange('ai-ops')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  view === 'ai-ops'
                    ? 'bg-kanai-blue text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                AI Ops
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className={`mx-auto px-4 py-6 ${view === 'form' ? 'max-w-4xl' : 'max-w-6xl'}`}>
        {children}
      </main>
    </div>
  )
}
