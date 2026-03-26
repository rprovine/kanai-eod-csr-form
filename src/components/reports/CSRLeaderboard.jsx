import { Trophy, Medal, Clock, DollarSign, TrendingUp } from 'lucide-react'

const MEDAL_COLORS = ['text-yellow-400', 'text-slate-300', 'text-amber-600']

function MedalIcon({ rank }) {
  if (rank > 3) return <span className="w-7 text-center text-sm text-slate-500 font-bold">{rank}</span>
  return (
    <span className={`w-7 text-center text-lg ${MEDAL_COLORS[rank - 1]}`}>
      {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
    </span>
  )
}

function computeRevPerHr(csrName, csrRevenue, reportsData) {
  if (!reportsData || reportsData.length === 0) return null
  const csrReports = reportsData.filter(r => {
    const name = r.csr_employees?.name || ''
    return name === csrName
  })
  let totalHours = 0
  for (const r of csrReports) {
    if (r.shift_start && r.shift_end) {
      const [sh, sm] = r.shift_start.split(':').map(Number)
      const [eh, em] = r.shift_end.split(':').map(Number)
      let diff = (eh + em / 60) - (sh + sm / 60)
      if (diff < 0) diff += 24
      totalHours += diff
    }
  }
  if (totalHours <= 0) return null
  return csrRevenue / totalHours
}

export default function CSRLeaderboard({ csrPerformance, reportsData }) {
  if (!csrPerformance || csrPerformance.length < 2) return null

  const sorted = [...csrPerformance].sort((a, b) => b.avgBookingRate - a.avgBookingRate)
  const maxRate = Math.max(...sorted.map(c => c.avgBookingRate), 1)

  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-accent-gold" />
        CSR Leaderboard
      </h3>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border">
              <th className="text-left py-2 px-2 text-slate-400 font-medium w-12">Rank</th>
              <th className="text-left py-2 px-2 text-slate-400 font-medium">CSR</th>
              <th className="text-center py-2 px-2 text-slate-400 font-medium">Booking Rate</th>
              <th className="text-center py-2 px-2 text-slate-400 font-medium">Qualified</th>
              <th className="text-center py-2 px-2 text-slate-400 font-medium">Booked</th>
              <th className="text-center py-2 px-2 text-slate-400 font-medium">Revenue</th>
              <th className="text-center py-2 px-2 text-slate-400 font-medium">Rev/Hr</th>
              <th className="text-center py-2 px-2 text-slate-400 font-medium">Avg STL</th>
              <th className="text-center py-2 px-2 text-slate-400 font-medium">Tier</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((csr, i) => {
              const rank = i + 1
              return (
                <tr key={csr.name} className="border-b border-card-border/50 hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-2">
                    <MedalIcon rank={rank} />
                  </td>
                  <td className="py-3 px-2 text-slate-200 font-medium">{csr.name}</td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2 justify-center">
                      <div className="w-24 h-5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            csr.avgBookingRate >= 70 ? 'bg-accent-green' :
                            csr.avgBookingRate >= 60 ? 'bg-kanai-blue-light' :
                            csr.avgBookingRate >= 50 ? 'bg-accent-gold' : 'bg-accent-red'
                          }`}
                          style={{ width: `${(csr.avgBookingRate / maxRate) * 100}%` }}
                        />
                      </div>
                      <span className={`font-bold text-sm ${csr.tier.color}`}>{csr.avgBookingRate}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center text-slate-300">{csr.totalQualified || '--'}</td>
                  <td className="py-3 px-2 text-center text-slate-100 font-semibold">{csr.totalBooked}</td>
                  <td className="py-3 px-2 text-center text-slate-300">${csr.totalRevenue.toLocaleString()}</td>
                  <td className="py-3 px-2 text-center text-slate-300">
                    {(() => {
                      const revHr = computeRevPerHr(csr.name, csr.totalRevenue, reportsData)
                      return revHr != null ? `$${Math.round(revHr).toLocaleString()}` : '--'
                    })()}
                  </td>
                  <td className="py-3 px-2 text-center">
                    {csr.avgStl != null ? (
                      <span className={`font-semibold ${csr.avgStl < 5 ? 'text-accent-green' : csr.avgStl < 10 ? 'text-accent-gold' : 'text-accent-red'}`}>
                        {csr.avgStl}m
                      </span>
                    ) : (
                      <span className="text-slate-500">--</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      csr.tier.tier === 'elite' ? 'bg-accent-green/15 text-accent-green' :
                      csr.tier.tier === 'standard' ? 'bg-kanai-blue/15 text-kanai-blue-light' :
                      csr.tier.tier === 'developing' ? 'bg-accent-gold/15 text-accent-gold' :
                      'bg-accent-red/15 text-accent-red'
                    }`}>
                      {csr.tier.label}
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
        {sorted.map((csr, i) => {
          const rank = i + 1
          return (
            <div key={csr.name} className={`p-4 rounded-lg border transition-colors ${
              rank === 1 ? 'border-yellow-500/30 bg-yellow-500/5' :
              rank === 2 ? 'border-slate-400/20 bg-slate-400/5' :
              rank === 3 ? 'border-amber-600/20 bg-amber-600/5' :
              'border-card-border bg-slate-800/20'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MedalIcon rank={rank} />
                  <span className="text-slate-200 font-semibold">{csr.name}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  csr.tier.tier === 'elite' ? 'bg-accent-green/15 text-accent-green' :
                  csr.tier.tier === 'standard' ? 'bg-kanai-blue/15 text-kanai-blue-light' :
                  csr.tier.tier === 'developing' ? 'bg-accent-gold/15 text-accent-gold' :
                  'bg-accent-red/15 text-accent-red'
                }`}>
                  {csr.tier.label}
                </span>
              </div>

              {/* Booking Rate Bar */}
              <div className="mb-3">
                <div className="h-5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      csr.avgBookingRate >= 70 ? 'bg-accent-green' :
                      csr.avgBookingRate >= 60 ? 'bg-kanai-blue-light' :
                      csr.avgBookingRate >= 50 ? 'bg-accent-gold' : 'bg-accent-red'
                    }`}
                    style={{ width: `${(csr.avgBookingRate / maxRate) * 100}%` }}
                  />
                </div>
                <div className={`text-right text-sm font-bold mt-1 ${csr.tier.color}`}>{csr.avgBookingRate}%</div>
              </div>

              <div className="grid grid-cols-5 gap-3 text-xs">
                <div className="text-center">
                  <p className="text-slate-500">Qualified</p>
                  <p className="text-slate-200 font-semibold">{csr.totalQualified || '--'}</p>
                </div>
                <div className="text-center">
                  <p className="text-slate-500">Booked</p>
                  <p className="text-slate-200 font-semibold">{csr.totalBooked}</p>
                </div>
                <div className="text-center">
                  <p className="text-slate-500">Revenue</p>
                  <p className="text-slate-200 font-semibold">${csr.totalRevenue.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-slate-500">Rev/Hr</p>
                  <p className="text-slate-200 font-semibold">
                    {(() => {
                      const revHr = computeRevPerHr(csr.name, csr.totalRevenue, reportsData)
                      return revHr != null ? `$${Math.round(revHr).toLocaleString()}` : '--'
                    })()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-slate-500">Avg STL</p>
                  <p className={`font-semibold ${
                    csr.avgStl == null ? 'text-slate-500' :
                    csr.avgStl < 5 ? 'text-accent-green' :
                    csr.avgStl < 10 ? 'text-accent-gold' : 'text-accent-red'
                  }`}>
                    {csr.avgStl != null ? `${csr.avgStl}m` : '--'}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
