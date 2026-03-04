import { Truck } from 'lucide-react'

export default function FormLayout({ children }) {
  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card-bg/95 backdrop-blur border-b border-card-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="p-2 bg-kanai-blue rounded-lg">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100">Kanai's Roll Off</h1>
            <p className="text-xs text-slate-400">CSR End-of-Day Report</p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
