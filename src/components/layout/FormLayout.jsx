import { Truck, FileText, PenLine } from 'lucide-react'

export default function FormLayout({ children, viewMode = 'form', onToggleMode }) {
  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card-bg/95 backdrop-blur border-b border-card-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="p-2 bg-kanai-blue rounded-lg">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-100">Kanai's Roll Off</h1>
            <p className="text-xs text-slate-400">CSR End-of-Day Report</p>
          </div>
          {onToggleMode && (
            <button
              onClick={onToggleMode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 border border-card-border text-slate-300 hover:bg-slate-700 transition-colors"
            >
              {viewMode === 'form' ? (
                <>
                  <FileText className="w-3.5 h-3.5" />
                  Reports
                </>
              ) : (
                <>
                  <PenLine className="w-3.5 h-3.5" />
                  New Report
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
