import { useState, type ElementType } from 'react'
import { useSearch, useNavigate } from '@tanstack/react-router'
import {
  Server, Database, HardDrive, Zap, Globe, Box,
  Activity, ChevronLeft, ChevronRight, AlertCircle, Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { BreadCrumbs } from '@/components/BreadCrumbs'
import { EmptyState } from '@/components/EmptyState'
import { cn } from '@/lib/utils'
import { useOrgIncidents, useResolveIncident, useUpdateIncident } from '@/api/useThresholds'
import { useOrgMembers } from '@/api/useOrgMembers'
import type { OrgIncident } from '@/api/thresholds'
import type { OrgMember } from '@/api/orgs'
import { useCurrentOrgId } from '@/utils/useCurrentOrgId'

// ─── Constants ────────────────────────────────────────────────────────────────

const LIMIT = 20
const FROM_PATH = '/app/incidents' as const
const NAV_PATH  = '/incidents'      as const

const STATUS_LABELS: Record<string, string> = {
  all: 'All Status', open: 'Open', resolved: 'Resolved',
}
const PRIORITY_LABELS: Record<string, string> = {
  all: 'All Priority', high: 'High', medium: 'Medium', low: 'Low',
}

const SERVICE_ICONS: Record<string, ElementType> = {
  ec2: Server, rds: Database, s3: HardDrive, lambda: Zap, elb: Globe,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getServiceIcon(service: string): ElementType {
  return SERVICE_ICONS[service?.toLowerCase()] ?? Box
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function assigneeInitials(name: string): string {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

const priorityConfig: Record<string, { label: string; cls: string; dot: string; rowBorder: string }> = {
  high:   { label: 'High',   cls: 'bg-red-500/15 text-red-400 border border-red-500/20',       dot: 'bg-red-400',            rowBorder: 'border-l-4 border-l-red-500/60' },
  medium: { label: 'Medium', cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/20', dot: 'bg-amber-400',          rowBorder: 'border-l-4 border-l-amber-500/50' },
  low:    { label: 'Low',    cls: 'bg-muted text-white border border-border',                  dot: 'bg-muted-foreground/40', rowBorder: 'border-l-4 border-l-border/40' },
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="grid grid-cols-[1fr_160px_110px_110px_100px_140px_160px_150px] gap-4 px-5 py-3.5 border-b border-border/40">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-3 w-full bg-muted animate-pulse rounded" />
      ))}
    </div>
  )
}

// ─── Incident row ─────────────────────────────────────────────────────────────

function IncidentRow({
  incident,
  orgId,
  members,
}: {
  incident: OrgIncident
  orgId: string | undefined
  members: OrgMember[]
}) {
  const navigate = useNavigate()
  const ServiceIcon = getServiceIcon(incident.resource_service)
  const priority = priorityConfig[incident.priority] ?? priorityConfig.low
  const resolveIncidentMutation = useResolveIncident(orgId)
  const updateIncidentMutation = useUpdateIncident(orgId)

  function handleStatusChange(value: string | null) {
    if (value === 'resolved' && incident.status === 'open') {
      resolveIncidentMutation.mutate(incident.id, {
        onSuccess: () => toast.success('Incident resolved'),
        onError:   () => toast.error('Failed to resolve incident'),
      })
    }
  }

  function handleAssigneeChange(value: string | null) {
    const assignedTo = value === '__unassigned__' || value === null ? null : value
    updateIncidentMutation.mutate(
      { incidentId: incident.id, body: { assigned_to: assignedTo } },
      {
        onSuccess: () => toast.success('Assignee updated'),
        onError:   () => toast.error('Failed to update assignee'),
      },
    )
  }

  const statusTriggerCls = incident.status === 'open'
    ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15'
    : 'border-border text-white/60 bg-muted/40 hover:bg-muted/60'

  const assigneeName = incident.assigned_to
    ? (members.find(m => m.id === incident.assigned_to)?.full_name ?? incident.assigned_to)
    : null

  return (
    <div
      className={cn(
        'grid grid-cols-[1fr_160px_110px_110px_100px_140px_160px_150px] gap-4 px-5 py-3 border-b border-border/40 bg-card hover:bg-card/60 transition-colors duration-150 cursor-pointer group' )}
      onClick={() => navigate({ to: '/incidents/$incidentId', params: { incidentId: incident.id } })}
    >
      {/* Name */}
      <div className="min-w-0 self-center">
        <p className="text-sm font-medium text-white truncate group-hover:text-primary transition-colors duration-150">
          {incident.metric_name}
        </p>
      </div>

      {/* Resource */}
      <div className="flex items-center gap-1.5 self-center min-w-0">
        <ServiceIcon size={13} className="shrink-0 text-white" />
        <span className="text-sm text-white truncate">
          {incident.resource_name || incident.resource_id}
        </span>
      </div>

      {/* Region */}
      <div className="self-center">
        <span className="text-sm text-white">{incident.resource_region || '—'}</span>
      </div>

      {/* Threshold */}
      <div className="self-center">
        <span className="text-sm text-white font-mono">{incident.threshold_value}</span>
      </div>

      {/* Priority */}
      <div className="self-center">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full lowercase tracking-wide ${priority.cls}`}>
          {priority.label}
        </span>
      </div>

      {/* Status dropdown */}
      <div className="self-center" onClick={e => e.stopPropagation()}>
        <Select
          value={incident.status}
          onValueChange={handleStatusChange}
          disabled={incident.status === 'resolved' || resolveIncidentMutation.isPending}
        >
          <SelectTrigger className={`h-7 text-sm px-2 w-full font-medium uppercase tracking-wide transition-colors ${statusTriggerCls}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assignee dropdown */}
      <div className="self-center" onClick={e => e.stopPropagation()}>
        <Select
          value={incident.assigned_to ?? '__unassigned__'}
          onValueChange={handleAssigneeChange}
          disabled={updateIncidentMutation.isPending}
        >
          <SelectTrigger className="h-7 text-sm px-2 w-full text-white">
            <div className="flex items-center gap-1.5 min-w-0">
              {assigneeName ? (
                <>
                  <div className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-semibold text-primary">{assigneeInitials(assigneeName)}</span>
                  </div>
                  <span className="truncate text-white">{assigneeName}</span>
                </>
              ) : (
                <span className="text-white">Unassigned</span>
              )}
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__unassigned__">Unassigned</SelectItem>
            {members.map(m => (
              <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date */}
      <div className="self-center space-y-0.5">
        <p className="text-sm text-white">{formatDate(incident.created_at)}</p>
        {incident.resolved_at && (
          <p className="text-xs text-emerald-400">↳ {formatDate(incident.resolved_at)}</p>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IncidentsListPage() {
  const { offset } = useSearch({ from: FROM_PATH })
  const navigate = useNavigate()
  const orgId = useCurrentOrgId()

  const [search, setSearch]               = useState('')
  const [statusFilter, setStatusFilter]   = useState<'all' | 'open' | 'resolved'>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')

  const { data, isLoading, isError, refetch } = useOrgIncidents(orgId, { limit: LIMIT, offset })
  const { data: membersData } = useOrgMembers(orgId)

  const members    = membersData?.data ?? []
  const pagination = data?.pagination
  const total      = pagination?.total ?? 0
  const hasMore    = pagination?.hasMore ?? false
  const rawIncidents = data?.data ?? []

  const incidents = rawIncidents
    .filter(inc => {
      const matchesSearch = !search ||
        inc.metric_name.toLowerCase().includes(search.toLowerCase()) ||
        (inc.resource_name || inc.resource_id).toLowerCase().includes(search.toLowerCase())
      const matchesStatus   = statusFilter === 'all'   || inc.status   === statusFilter
      const matchesPriority = priorityFilter === 'all' || inc.priority === priorityFilter
      return matchesSearch && matchesStatus && matchesPriority
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const currentStart    = total === 0 ? 0 : offset + 1
  const currentEnd      = Math.min(offset + LIMIT, total)
  const isEmpty         = !!orgId && !isLoading && !isError && rawIncidents.length === 0
  const isFilteredEmpty = !isLoading && !isError && rawIncidents.length > 0 && incidents.length === 0
  const canGoPrev       = offset > 0
  const canGoNext       = hasMore || offset + LIMIT < total

  function setPage(newOffset: number) {
    navigate({ to: NAV_PATH, search: { offset: newOffset }, replace: true })
  }

  return (
    <div className="flex-1 flex flex-col -m-6 lg:-m-8">

      {/* Breadcrumb bar */}
      <div className="flex items-center justify-between px-6 lg:px-8 py-4 bg-card/80 backdrop-blur-sm border-b border-border/60 shrink-0">
        <BreadCrumbs items={[{ label: 'Incidents' }]} />

        {total > 0 && (
          <span className="text-sm text-white font-medium">{total} incidents</span>
        )}
      </div>

      {/* Search + Filter bar */}
      <div className="flex items-center gap-3 px-6 lg:px-8 py-3 border-b border-border/50 bg-card/50 backdrop-blur-sm shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or resource…"
            className="pl-8 h-8 text-sm bg-card border-border/60"
          />
        </div>

        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="h-8 w-40 text-sm">
            <SelectValue>{STATUS_LABELS[statusFilter]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={v => setPriorityFilter(v as typeof priorityFilter)}>
          <SelectTrigger className="h-8 w-40 text-sm">
            <SelectValue>{PRIORITY_LABELS[priorityFilter]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="flex-1 flex flex-col overflow-hidden mx-8">

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_160px_110px_110px_100px_140px_160px_150px] gap-4 px-5 py-2.5 border-b border-primary/20 bg-primary shrink-0">
          {['Name', 'Resource', 'Region', 'Threshold', 'Priority', 'Status', 'Assigned', 'Date'].map(h => (
            <span key={h} className="text-sm text-white uppercase tracking-widest font-medium">
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto">
          {isError && (
            <div className="m-5 flex items-center gap-3 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              <AlertCircle size={14} className="shrink-0" />
              <span>Failed to load incidents.</span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 text-xs text-destructive hover:bg-destructive/10"
                onClick={() => refetch()}
              >
                Retry
              </Button>
            </div>
          )}

          {!isError && (isLoading || !orgId)
            ? Array.from({ length: 10 }, (_, i) => <SkeletonRow key={i} />)
            : incidents.map(incident => (
                <IncidentRow
                  key={incident.id}
                  incident={incident}
                  orgId={orgId}
                  members={members}
                />
              ))
          }

          {isEmpty && (
            <EmptyState
              icon={Activity}
              title="No incidents recorded"
              description="Incidents will appear here when CloudWatch alarms fire"
            />
          )}

          {isFilteredEmpty && (
            <EmptyState
              icon={Search}
              title="No matches found"
              description="Try adjusting your search or filters"
            />
          )}
        </div>

        {/* Pagination */}
        {!isLoading && !isError && total > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border/60 bg-card/80 backdrop-blur-sm shrink-0">
            <span className="text-sm text-white">
              {currentStart}–{currentEnd} of {total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={!canGoPrev}
                onClick={() => setPage(Math.max(0, offset - LIMIT))}
              >
                <ChevronLeft size={12} /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={!canGoNext}
                onClick={() => setPage(offset + LIMIT)}
              >
                Next <ChevronRight size={12} />
              </Button>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
