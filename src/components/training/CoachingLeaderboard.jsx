import { Trophy, Loader2 } from 'lucide-react'
import { COACHING_CATEGORIES } from '../../lib/constants'

const MEDAL_DISPLAY = ['text-yellow-400', 'text-slate-300', 'text-amber-600']

function MedalIcon({ rank }) {
  if (rank > 3) return <span className="w-7 text-center text-sm text-slate-500 font-bold">{rank}</span>
  return (
    <span className={`w-7 text-center text-lg ${MEDAL_DISPLAY[rank - 1]}`}>
      {rank === 1 ? '\u{1F947}' : rank === 2 ? '\u{1F948}' : '\u{1F949}'}
    </span>
  )
}

export default function CoachingLeaderboard({ leaderboard, weeks, loading, onWeeksChange }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading leaderboard...
      </div>
    )
  }

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="bg-card-bg border border-card-border rounded-xl p-8 text-center">
        <Trophy className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p className="text-slate-400">No leaderboard data available yet.</p>
      </div>
    )
  }

  const maxScore = Math.max(...leaderboard.map(c => c.avg_overall), 1)

  return (
    <div className="space-y-4">
      {/* Time range toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Show:</span>
        {[
          { label: 'This Week', value: 1 },
          { label: 'Last 4 Weeks', value: 4 },
          { label: 'All Time', value: 12 },
        ].map(opt => (
          <button
            key={opt.value}
            onClick={() => onWeeksChange(opt.value)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              (weeks?.length || 1) === opt.value
                ? 'bg-kanai-blue text-white'
                : 'text-slate-400 hover:text-slate-200 bg-slate-800'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="bg-card-bg border border-card-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-accent-gold" />
          Coaching Leaderboard
        </h3>

        {/* Desktop Table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border">
                <th className="text-left py-2 px-2 text-slate-400 font-medium w-12">Rank</th>
                <th className="text-left py-2 px-2 text-slate-400 font-medium">CSR</th>
                <th className="text-center py-2 px-2 text-slate-400 font-medium">Overall</th>
                {COACHING_CATEGORIES.map(cat => (
                  <th key={cat.key} className="text-center py-2 px-2 text-slate-400 font-medium text-xs">
                    {cat.short}
                  </th>
                ))}
                <th className="text-center py-2 px-2 text-slate-400 font-medium">Calls</th>
                <th className="text-center py-2 px-2 text-slate-400 font-medium">Book %</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((csr, i) => {
                const rank = i + 1
                return (
                  <tr key={csr.csr_employee_id} className="border-b border-card-border/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-2">
                      <MedalIcon rank={rank} />
                    </td>
                    <td className="py-3 px-2 text-slate-200 font-medium">{csr.csr_name}</td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-4 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              csr.avg_overall >= 4 ? 'bg-accent-green' :
                              csr.avg_overall >= 3 ? 'bg-accent-gold' : 'bg-accent-red'
                            }`}
                            style={{ width: `${(csr.avg_overall / maxScore) * 100}%` }}
                          />
                        </div>
                        <span className={`font-bold text-sm ${
                          csr.avg_overall >= 4 ? 'text-accent-green' :
                          csr.avg_overall >= 3 ? 'text-accent-gold' : 'text-accent-red'
                        }`}>
                          {csr.avg_overall.toFixed(1)}
                        </span>
                      </div>
                    </td>
                    {COACHING_CATEGORIES.map(cat => {
                      const score = csr[cat.summaryKey] || 0
                      return (
                        <td key={cat.key} className="py-3 px-2 text-center">
                          <span className={`text-xs font-semibold ${
                            score >= 4 ? 'text-accent-green' :
                            score >= 3 ? 'text-accent-gold' : 'text-accent-red'
                          }`}>
                            {score.toFixed(1)}
                          </span>
                        </td>
                      )
                    })}
                    <td className="py-3 px-2 text-center text-slate-300">{csr.scored_calls}</td>
                    <td className="py-3 px-2 text-center">
                      <span className={`font-semibold ${
                        csr.booking_rate >= 60 ? 'text-accent-green' :
                        csr.booking_rate >= 40 ? 'text-accent-gold' : 'text-accent-red'
                      }`}>
                        {csr.booking_rate}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {leaderboard.map((csr, i) => {
            const rank = i + 1
            return (
              <div key={csr.csr_employee_id} className={`p-4 rounded-lg border transition-colors ${
                rank === 1 ? 'border-yellow-500/30 bg-yellow-500/5' :
                rank === 2 ? 'border-slate-400/20 bg-slate-400/5' :
                rank === 3 ? 'border-amber-600/20 bg-amber-600/5' :
                'border-card-border bg-slate-800/20'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MedalIcon rank={rank} />
                    <span className="text-slate-200 font-semibold">{csr.csr_name}</span>
                  </div>
                  <span className={`text-lg font-bold ${
                    csr.avg_overall >= 4 ? 'text-accent-green' :
                    csr.avg_overall >= 3 ? 'text-accent-gold' : 'text-accent-red'
                  }`}>
                    {csr.avg_overall.toFixed(1)}
                  </span>
                </div>

                {/* Score bar */}
                <div className="h-4 bg-slate-800 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      csr.avg_overall >= 4 ? 'bg-accent-green' :
                      csr.avg_overall >= 3 ? 'bg-accent-gold' : 'bg-accent-red'
                    }`}
                    style={{ width: `${(csr.avg_overall / 5) * 100}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  {COACHING_CATEGORIES.slice(0, 3).map(cat => {
                    const score = csr[cat.summaryKey] || 0
                    return (
                      <div key={cat.key} className="text-center">
                        <p className="text-slate-500">{cat.short}</p>
                        <p className={`font-semibold ${
                          score >= 4 ? 'text-accent-green' :
                          score >= 3 ? 'text-accent-gold' : 'text-accent-red'
                        }`}>{score.toFixed(1)}</p>
                      </div>
                    )
                  })}
                  {COACHING_CATEGORIES.slice(3).map(cat => {
                    const score = csr[cat.summaryKey] || 0
                    return (
                      <div key={cat.key} className="text-center">
                        <p className="text-slate-500">{cat.short}</p>
                        <p className={`font-semibold ${
                          score >= 4 ? 'text-accent-green' :
                          score >= 3 ? 'text-accent-gold' : 'text-accent-red'
                        }`}>{score.toFixed(1)}</p>
                      </div>
                    )
                  })}
                  <div className="text-center">
                    <p className="text-slate-500">Calls</p>
                    <p className="text-slate-200 font-semibold">{csr.scored_calls}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500">Book %</p>
                    <p className={`font-semibold ${
                      csr.booking_rate >= 60 ? 'text-accent-green' :
                      csr.booking_rate >= 40 ? 'text-accent-gold' : 'text-accent-red'
                    }`}>{csr.booking_rate}%</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
