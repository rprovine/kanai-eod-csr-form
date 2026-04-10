import { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw, AlertTriangle, CheckCircle, Eye, Zap, Phone, MessageSquare, Bot, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const SYSTEM_COLORS = {
  sms_router: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  reengage_cron: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  auto_close: 'bg-red-500/10 text-red-400 border-red-500/30',
  auto_assign: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  kai_voice: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  customer_profile_api: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
};

const SYSTEM_ICONS = {
  sms_router: MessageSquare,
  reengage_cron: Clock,
  auto_close: AlertTriangle,
  auto_assign: Zap,
  kai_voice: Phone,
  customer_profile_api: Eye,
};

const SYSTEM_LABELS = {
  sms_router: 'SMS Router',
  reengage_cron: 'Re-engage Cron',
  auto_close: 'Auto-Close',
  auto_assign: 'Auto-Assign',
  kai_voice: 'Kai Voice',
  customer_profile_api: 'Profile API',
};

function SystemBadge({ system }) {
  const colors = SYSTEM_COLORS[system] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  const Icon = SYSTEM_ICONS[system] || Activity;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors}`}>
      <Icon className="w-3 h-3" />
      {SYSTEM_LABELS[system] || system}
    </span>
  );
}

function DecisionBadge({ decision }) {
  let colors = 'bg-slate-500/10 text-slate-400';
  if (decision.includes('injected')) colors = 'bg-emerald-500/10 text-emerald-400';
  else if (decision.includes('no_useful')) colors = 'bg-slate-500/10 text-slate-400';
  else if (decision.includes('killed')) colors = 'bg-red-500/10 text-red-400';
  else if (decision.includes('failed') || decision.includes('threw')) colors = 'bg-red-500/10 text-red-400';
  else if (decision.includes('skipped')) colors = 'bg-amber-500/10 text-amber-400';
  else if (decision.includes('extracted')) colors = 'bg-blue-500/10 text-blue-400';
  else if (decision.includes('profile_lookup')) colors = 'bg-cyan-500/10 text-cyan-400';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono ${colors}`}>
      {decision}
    </span>
  );
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AIOpsView() {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);
  const [systemFilter, setSystemFilter] = useState('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('ai_orchestration_events')
      .select('*')
      .gte('timestamp', since)
      .order('timestamp', { ascending: false })
      .limit(200);

    if (systemFilter !== 'all') {
      query = query.eq('system', systemFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Failed to load AI ops events:', error);
      setLoading(false);
      return;
    }

    setEvents(data || []);

    // Compute stats
    const bySystem = {};
    const byDecision = {};
    let errors = 0;
    for (const e of (data || [])) {
      bySystem[e.system] = (bySystem[e.system] || 0) + 1;
      byDecision[e.decision] = (byDecision[e.decision] || 0) + 1;
      if (e.decision.includes('failed') || e.decision.includes('threw') || e.decision.includes('killed')) {
        errors++;
      }
    }
    setStats({ total: (data || []).length, bySystem, byDecision, errors });
    setLoading(false);
  }, [hours, systemFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-kanai-blue/20 rounded-lg">
            <Bot className="w-6 h-6 text-kanai-blue" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">AI Operations</h2>
            <p className="text-sm text-slate-400">Real-time observability across all AI systems</p>
          </div>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-card-bg border border-card-border rounded-lg text-sm text-slate-300 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="px-3 py-2 bg-card-bg border border-card-border rounded-lg text-sm text-slate-300"
        >
          <option value={1}>Last 1 hour</option>
          <option value={6}>Last 6 hours</option>
          <option value={24}>Last 24 hours</option>
          <option value={72}>Last 3 days</option>
          <option value={168}>Last 7 days</option>
        </select>
        <select
          value={systemFilter}
          onChange={(e) => setSystemFilter(e.target.value)}
          className="px-3 py-2 bg-card-bg border border-card-border rounded-lg text-sm text-slate-300"
        >
          <option value="all">All Systems</option>
          <option value="kai_voice">Kai Voice</option>
          <option value="sms_router">SMS Router</option>
          <option value="reengage_cron">Re-engage Cron</option>
          <option value="auto_close">Auto-Close</option>
          <option value="auto_assign">Auto-Assign</option>
          <option value="customer_profile_api">Profile API</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-card-bg border border-card-border rounded-xl">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Total Events</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{stats.total || 0}</p>
        </div>
        <div className="p-4 bg-card-bg border border-card-border rounded-xl">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Systems Active</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{Object.keys(stats.bySystem || {}).length}</p>
        </div>
        <div className="p-4 bg-card-bg border border-card-border rounded-xl">
          <p className="text-xs text-emerald-400 uppercase tracking-wider">Context Injected</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{(stats.byDecision || {})['injected_customer_context'] || 0}</p>
        </div>
        <div className="p-4 bg-card-bg border border-card-border rounded-xl">
          <p className="text-xs text-red-400 uppercase tracking-wider">Errors / Failures</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{stats.errors || 0}</p>
        </div>
      </div>

      {/* System breakdown */}
      <div className="p-4 bg-card-bg border border-card-border rounded-xl">
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Events by System</p>
        <div className="flex flex-wrap gap-3">
          {Object.entries(stats.bySystem || {}).sort((a, b) => b[1] - a[1]).map(([sys, count]) => (
            <button
              key={sys}
              onClick={() => setSystemFilter(sys === systemFilter ? 'all' : sys)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                sys === systemFilter ? 'border-kanai-blue bg-kanai-blue/10' : 'border-card-border hover:border-slate-500'
              }`}
            >
              <SystemBadge system={sys} />
              <span className="text-sm font-bold text-slate-200">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Event stream */}
      <div className="p-4 bg-card-bg border border-card-border rounded-xl">
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Event Stream ({events.length} events)</p>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {events.map((e) => (
            <div key={e.id} className="flex flex-wrap items-start gap-2 p-3 bg-dark-bg rounded-lg border border-card-border/50">
              <span className="text-xs text-slate-500 font-mono w-16 shrink-0">{timeAgo(e.timestamp)}</span>
              <SystemBadge system={e.system} />
              <DecisionBadge decision={e.decision} />
              {e.contact_phone && (
                <span className="text-xs text-slate-400 font-mono">{e.contact_phone}</span>
              )}
              {e.reason && (
                <p className="w-full text-xs text-slate-500 mt-1 ml-16 truncate">{e.reason}</p>
              )}
              {e.context?.context_block && (
                <p className="w-full text-xs text-emerald-500/70 mt-1 ml-16 truncate italic">{e.context.context_block}</p>
              )}
            </div>
          ))}
          {events.length === 0 && !loading && (
            <p className="text-sm text-slate-500 text-center py-8">No events in this time range</p>
          )}
        </div>
      </div>
    </div>
  );
}
