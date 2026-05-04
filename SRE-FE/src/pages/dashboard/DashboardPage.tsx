import { type ElementType } from 'react'
import { Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Server,
  Database,
  HardDrive,
  Zap,
  Globe,
  Box,
  TrendingDown,
  TrendingUp,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDashboardSummary } from '@/api/useDashboard'
import { useOrgIncidents } from '@/api/useThresholds'
import { useCurrentOrgId } from '@/utils/useCurrentOrgId'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import type { OrgIncident } from '@/api/thresholds'
import { BreadCrumbs } from '@/components/BreadCrumbs'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function getIncidentDuration(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m`
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`
}

// ─── Severity ─────────────────────────────────────────────────────────────────

type DashSeverity = 'CRITICAL' | 'WARNING' | 'LOW'

function incidentSeverity(i: OrgIncident): DashSeverity {
  if (i.priority === 'high' && i.state === 'ALARM') return 'CRITICAL'
  if (i.priority === 'medium') return 'WARNING'
  return 'LOW'
}

const SEVERITY_CONFIG = {
  CRITICAL: {
    badge: 'bg-red-500/15 text-red-400 border-red-500/25',
    border: 'border-l-red-500',
    icon: AlertTriangle,
    iconCls: 'text-red-400',
    dot: 'bg-red-400',
  },
  WARNING: {
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    border: 'border-l-amber-400',
    icon: Info,
    iconCls: 'text-amber-400',
    dot: 'bg-amber-400',
  },
  LOW: {
    badge: 'bg-white/8 text-white border-white/20',
    border: 'border-l-white/20',
    icon: CheckCircle2,
    iconCls: 'text-white',
    dot: 'bg-white/50',
  },
}

// ─── Service icons ────────────────────────────────────────────────────────────

const SERVICE_ICONS: Record<string, ElementType> = {
  ec2: Server,
  rds: Database,
  s3: HardDrive,
  lambda: Zap,
  elb: Globe,
}

const SERVICE_STYLES: Record<string, string> = {
  ec2:    'text-sky-400 bg-sky-500/10 border-sky-500/20',
  rds:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  s3:     'text-orange-400 bg-orange-500/10 border-orange-500/20',
  lambda: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  elb:    'text-pink-400 bg-pink-500/10 border-pink-500/20',
}

// ─── System status ────────────────────────────────────────────────────────────

const SYSTEM_STATUS = {
  healthy:  { dot: 'bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.4)]', label: 'All Systems Nominal' },
  degraded: { dot: 'bg-amber-400 shadow-[0_0_6px_2px_rgba(251,191,36,0.4)]',   label: 'System Degraded'    },
  critical: { dot: 'bg-red-400 shadow-[0_0_6px_2px_rgba(248,113,113,0.4)]',    label: 'Critical Alert'    },
}

// ─── Charts ───────────────────────────────────────────────────────────────────

function UptimeChart({ data }: { data: number[] }) {
  const bars = data.length > 0 ? data : new Array(10).fill(0)
  const max = Math.max(...bars, 1)
  const w = 10
  const gap = 4
  const h = 32

  return (
    <svg width={(w + gap) * bars.length - gap} height={h} className="mt-1">
      {bars.map((v, i) => {
        const barH = Math.max((v / max) * h, 2)
        const isMax = v === max && v > 0
        return (
          <rect
            key={i}
            x={i * (w + gap)}
            y={h - barH}
            width={w}
            height={barH}
            rx={2}
            fill={isMax ? 'oklch(0.72 0.14 192 / 0.55)' : 'oklch(0.72 0.14 192 / 0.18)'}
          />
        )
      })}
    </svg>
  )
}

function LatencyChart({ data }: { data: number[] }) {
  const pts = data.length >= 2 ? data : new Array(10).fill(32)
  const max = Math.max(...pts, 1)
  const W = 138
  const H = 36
  const step = W / (pts.length - 1)

  const coords = pts.map((v, i) => ({
    x: i * step,
    y: H - 3 - ((v / max) * (H - 8)),
  }))

  let d = `M${coords[0].x},${coords[0].y}`
  for (let i = 1; i < coords.length; i++) {
    const c1x = coords[i - 1].x + step / 2
    const c2x = coords[i].x - step / 2
    d += ` C${c1x},${coords[i - 1].y} ${c2x},${coords[i].y} ${coords[i].x},${coords[i].y}`
  }
  const area = `${d} L${coords[coords.length - 1].x},${H} L0,${H} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="36" className="mt-1">
      <defs>
        <linearGradient id="lat-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.72 0.14 192)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="oklch(0.72 0.14 192)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#lat-fill)" />
      <path d={d} fill="none" stroke="oklch(0.72 0.14 192)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const orgId = useCurrentOrgId()
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary(orgId)
  const { data: incidentsData, isLoading: incidentsLoading } = useOrgIncidents(orgId, { limit: 5, status: 'open' })

  if (summaryLoading || incidentsLoading) {
    return <LoadingSpinner className="flex-1" />
  }

  const incidents = incidentsData?.data ?? []
  const statusKey = summary?.system_status ?? 'healthy'
  const statusCfg = SYSTEM_STATUS[statusKey]

  const uptimeDisplay = summary?.uptime_percent != null ? `${summary.uptime_percent.toFixed(3)}%` : '—'
  const latencyDisplay = summary?.p99_latency_ms != null ? summary.p99_latency_ms : null
  const errorDisplay = summary?.error_rate_24h_percent != null ? `${summary.error_rate_24h_percent.toFixed(2)}%` : '—'
  const errorChange = summary?.error_rate_change_percent ?? null
  const errorBarPct = summary?.error_rate_24h_percent != null
    ? `${Math.min(summary.error_rate_24h_percent * 10, 100)}%`
    : '0%'

  return (
    <div className="flex-1 flex flex-col -m-6 lg:-m-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 lg:px-8 py-4 border-b border-white/10">
        <BreadCrumbs items={[{ label: 'Dashboard', url: '/dashboard' }]} />
      </div>

      {/* ── Status banner ──────────────────────────────────────────────────── */}
      <div className={cn(
        'flex items-center gap-2.5 px-6 lg:px-8 py-2 border-b text-sm font-medium shrink-0',
        statusKey === 'healthy'  ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-400' :
        statusKey === 'degraded' ? 'bg-amber-500/5 border-amber-500/15 text-amber-400' :
                                   'bg-red-500/5 border-red-500/15 text-red-400',
      )}>
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', statusCfg.dot)} />
        <span>{statusCfg.label}</span>
        <span className="ml-auto text-muted-foreground text-sm font-normal">
          {summary?.active_incident_count ?? 0} active · {summary?.resolved_last_24h_count ?? 0} resolved today
        </span>
      </div>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 px-6 lg:px-8 py-6 space-y-5">

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-4">
          {/* Uptime */}
          <div className="bg-card rounded-xl overflow-hidden">
            <div className="p-5 space-y-2">
              <p className="text-sm text-emerald-400 uppercase tracking-widest font-medium">Global Uptime</p>
              <p className="text-[2.1rem] font-bold text-white tracking-tight leading-none">{uptimeDisplay}</p>
              <UptimeChart data={summary?.uptime_sparkline ?? []} />
            </div>
          </div>

          {/* Latency */}
          <div className="bg-card rounded-xl overflow-hidden">
            <div className="p-5 space-y-2">
              <p className="text-sm text-primary uppercase tracking-widest font-medium">P99 Latency</p>
              <p className="text-[2.1rem] font-bold text-white tracking-tight leading-none">
                {latencyDisplay != null
                  ? <>{latencyDisplay}<span className="text-lg font-normal text-white ml-1">ms</span></>
                  : '—'}
              </p>
              <LatencyChart data={summary?.latency_sparkline ?? []} />
            </div>
          </div>

          {/* Error Rate */}
          <div className="bg-card rounded-xl overflow-hidden">
            <div className="h-[2px] bg-gradient-to-r from-red-500 via-red-400/60 to-transparent" />
            <div className="p-5 space-y-2">
              <p className="text-sm text-white uppercase tracking-widest font-medium">Error Rate · 24h</p>
              <div className="flex items-end gap-2">
                <p className="text-[2.1rem] font-bold text-red-400 tracking-tight leading-none">{errorDisplay}</p>
                {errorChange != null && (
                  <span className={cn(
                    'flex items-center gap-0.5 text-sm font-medium pb-1.5',
                    errorChange < 0 ? 'text-emerald-400' : 'text-red-400',
                  )}>
                    {errorChange < 0 ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                    {Math.abs(errorChange).toFixed(0)}%
                  </span>
                )}
              </div>
              <div className="space-y-1.5 mt-1">
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all duration-700"
                    style={{ width: errorBarPct }}
                  />
                </div>
                <p className="text-sm text-white">vs previous week</p>
              </div>
            </div>
          </div>
        </div>

        {/* Incidents + Prevention */}
        <div className="grid grid-cols-[1fr_288px] gap-4">

          {/* ── Incident Feed ──────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Active Incidents</h2>
                {incidents.length > 0 && (
                  <span className="text-sm font-semibold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">
                    {incidents.length}
                  </span>
                )}
              </div>
              <Link
                to="/incidents"
                search={{ offset: 0 }}
                className="text-sm text-white font-medium hover:text-white/70 transition-colors"
              >
                View all →
              </Link>
            </div>

            <div className="space-y-2">
              {incidents.length === 0 ? (
                <div className="bg-card rounded-xl p-8 flex flex-col items-center gap-2">
                  <CheckCircle2 size={22} className="text-emerald-400" />
                  <p className="text-sm font-medium text-white">No active incidents</p>
                  <p className="text-sm text-white">Everything is running normally</p>
                </div>
              ) : (
                incidents.map((incident) => {
                  const sev = incidentSeverity(incident)
                  const cfg = SEVERITY_CONFIG[sev]
                  const SevIcon = cfg.icon
                  const serviceKey = incident.resource_service?.toLowerCase()
                  const ServiceIcon = SERVICE_ICONS[serviceKey] ?? Box
                  const serviceCls = SERVICE_STYLES[serviceKey] ?? 'text-white bg-white/5 border-white/10'
                  const duration = getIncidentDuration(incident.started_at)
                  const assignee = incident.assigned_to ? incident.assigned_to.slice(0, 8) : 'Unassigned'

                  return (
                    <Link
                      key={incident.id}
                      to="/incidents/$incidentId"
                      params={{ incidentId: incident.id }}
                      className={cn(
                        'block bg-card rounded-xl p-4 border-l-[3px]',
                        cfg.border,
                        'hover:brightness-110 transition-all duration-150',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn('h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5', serviceCls)}>
                          <ServiceIcon size={14} />
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-semibold text-white leading-snug truncate">
                              {incident.metric_name}
                            </span>
                            <span className={cn(
                              'shrink-0 flex items-center gap-1 text-sm font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide',
                              cfg.badge,
                            )}>
                              <span className={cn('h-1 w-1 rounded-full shrink-0', cfg.dot)} />
                              {sev}
                            </span>
                          </div>

                          <p className="text-sm text-white font-mono truncate">
                            {incident.resource_name || incident.resource_id}
                          </p>

                          <div className="flex items-center gap-3 pt-0.5">
                            <span className="text-sm text-white uppercase tracking-wide">
                              {incident.resource_service?.toUpperCase()} · {incident.resource_region}
                            </span>
                            <span className="text-white/20">·</span>
                            <span className="text-sm text-white truncate">{incident.account_name}</span>
                          </div>

                          <div className="flex items-center justify-between pt-0.5">
                            <span className="text-sm text-white">{formatRelativeTime(incident.started_at)}</span>
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1 text-sm text-white">
                                <Clock size={11} />
                                {duration}
                              </span>
                              <span className="flex items-center gap-1 text-sm text-white">
                                <SevIcon size={11} className={cfg.iconCls} />
                                {assignee}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </div>

          {/* ── Prevention Hub ─────────────────────────────────────────────── */}
          {/* <div className="space-y-3">
            <h2 className="text-base font-semibold text-white">Prevention Hub</h2>

            <div className="p-[1px] rounded-xl bg-gradient-to-br from-violet-500/50 via-fuchsia-500/25 to-blue-600/30">
              <div className="bg-[#0d0f16] rounded-xl p-4 space-y-3.5">

                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500/30 to-fuchsia-600/20 border border-violet-500/30 flex items-center justify-center shrink-0 shadow-[0_0_14px_rgba(139,92,246,0.35)]">
                    <Sparkles size={13} className="text-violet-300" />
                  </div>
                  <span className="text-sm font-bold uppercase tracking-widest bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                    AI Recommendation
                  </span>
                </div>

                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-white leading-snug">
                    Optimize Load Balancer Distribution
                  </p>
                  <p className="text-sm text-white leading-relaxed">
                    Traffic patterns show 14% inefficiency in eu-central-1. Adjusting weighted round-robin could reduce p99 latency by ~18ms.
                  </p>
                </div>

                <button className="w-full py-2 text-sm font-bold tracking-widest uppercase rounded-lg bg-gradient-to-r from-violet-600/20 to-blue-600/15 border border-violet-500/30 text-violet-300 hover:from-violet-600/30 hover:to-blue-600/25 hover:border-violet-500/50 hover:text-violet-200 transition-all duration-200">
                  Execute Auto-Balance
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-card rounded-xl p-3.5 space-y-1">
                <p className="text-sm text-white uppercase tracking-widest font-medium">Active</p>
                <p className="text-2xl font-bold text-white">{summary?.active_incident_count ?? '—'}</p>
                <p className="text-sm text-white">incidents</p>
              </div>
              <div className="bg-card rounded-xl p-3.5 space-y-1">
                <p className="text-sm text-white uppercase tracking-widest font-medium">Resolved</p>
                <p className="text-2xl font-bold text-emerald-400">{summary?.resolved_last_24h_count ?? '—'}</p>
                <p className="text-sm text-white">last 24h</p>
              </div>
            </div>
          </div> */}

        </div>
      </div>      
    </div>
  )
}
