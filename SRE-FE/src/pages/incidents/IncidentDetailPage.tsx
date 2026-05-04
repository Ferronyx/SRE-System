import { type ElementType } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import {
  Server, Database, HardDrive, Zap, Globe, Box,
  AlertCircle, ExternalLink, CheckCircle, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { BreadCrumbs } from '@/components/BreadCrumbs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useIncidentById, useResolveIncident, useUpdateIncident } from '@/api/useThresholds'
import { useOrgMembers } from '@/api/useOrgMembers'
import { useCurrentOrgId } from '@/utils/useCurrentOrgId'
import type { OrgIncident } from '@/api/thresholds'

// ─── Constants ────────────────────────────────────────────────────────────────

const FROM_PATH = '/app/incidents/$incidentId' as const

const SERVICE_ICONS: Record<string, ElementType> = {
  ec2: Server, rds: Database, s3: HardDrive, lambda: Zap, elb: Globe,
}

const SERVICE_LABELS: Record<string, string> = {
  ec2: 'EC2', rds: 'RDS', s3: 'S3', lambda: 'Lambda', elb: 'ELB',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString()
}

function getDuration(started: string, resolved: string | null): string {
  const end = resolved ? new Date(resolved).getTime() : Date.now()
  const ms = end - new Date(started).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m`
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`
}

function getServiceIcon(service: string): ElementType {
  return SERVICE_ICONS[service?.toLowerCase()] ?? Box
}

function getServiceLabel(service: string): string {
  return SERVICE_LABELS[service?.toLowerCase()] ?? service?.toUpperCase() ?? '—'
}

const priorityConfig: Record<string, { label: string; cls: string }> = {
  high:   { label: 'High',   cls: 'bg-red-500/15 text-red-400 border border-red-500/20' },
  medium: { label: 'Medium', cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/20' },
  low:    { label: 'Low',    cls: 'bg-muted text-white border border-border' },
}

const PRIORITY_LABELS: Record<string, string> = {
  high: 'High', medium: 'Medium', low: 'Low',
}

// ─── InfoField ────────────────────────────────────────────────────────────────

function InfoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-white">{label}</p>
      <p className={`text-sm font-bold text-white ${mono ? 'font-mono break-all' : ''}`}>{value}</p>
    </div>
  )
}

// ─── SectionCard ─────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 overflow-hidden">
      <div className="px-5 py-3 border-b border-primary/20 bg-primary/10">
        <p className="text-sm font-medium text-white uppercase tracking-widest">{title}</p>
      </div>
      <div className="px-5 py-4">
        {children}
      </div>
    </div>
  )
}

// ─── ManagementCard ──────────────────────────────────────────────────────────

function ManagementCard({ incident, orgId }: { incident: OrgIncident; orgId: string }) {
  const { data: membersData } = useOrgMembers(orgId)
  const resolveIncidentMutation = useResolveIncident(orgId)
  const updateIncidentMutation = useUpdateIncident(orgId)

  const members = membersData?.data ?? []
  const isResolved = incident.status === 'resolved'
  const assigneeName = incident.assigned_to
    ? (members.find(m => m.id === incident.assigned_to)?.full_name ?? incident.assigned_to)
    : null

  async function handleResolve() {
    try {
      await resolveIncidentMutation.mutateAsync(incident.id)
      toast.success('Incident marked as resolved')
    } catch {
      toast.error('Failed to resolve incident')
    }
  }

  async function handlePriorityChange(priority: string | null) {
    if (!priority) return
    try {
      await updateIncidentMutation.mutateAsync({
        incidentId: incident.id,
        body: { priority: priority as OrgIncident['priority'] },
      })
      toast.success('Priority updated')
    } catch {
      toast.error('Failed to update priority')
    }
  }

  async function handleAssigneeChange(value: string | null) {
    if (value === null) return
    const assigned_to = value === '__unassigned__' ? null : value
    try {
      await updateIncidentMutation.mutateAsync({
        incidentId: incident.id,
        body: { assigned_to },
      })
      toast.success('Assignee updated')
    } catch {
      toast.error('Failed to update assignee')
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 overflow-hidden">
      <div className="px-5 py-3 border-b border-primary/20 bg-primary/10">
        <p className="text-sm font-medium text-white uppercase tracking-widest">Management</p>
      </div>
      <div className="px-5 py-4 space-y-5">

        {/* Status */}
        <div className="space-y-2">
          <p className="text-sm text-white">Status</p>
          {isResolved ? (
            <div className="flex items-center gap-2 text-sm text-emerald-400 font-medium">
              <CheckCircle size={14} />
              Resolved
            </div>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="h-9 gap-2 text-sm w-full justify-center font-semibold shadow-md shadow-primary/30 hover:shadow-primary/50 transition-shadow"
              disabled={resolveIncidentMutation.isPending}
              onClick={handleResolve}
            >
              {resolveIncidentMutation.isPending
                ? <Loader2 size={13} className="animate-spin" />
                : <CheckCircle size={14} />
              }
              Mark as Resolved
            </Button>
          )}
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <p className="text-sm text-white">Priority</p>
          <Select
            value={incident.priority}
            onValueChange={handlePriorityChange}
            disabled={updateIncidentMutation.isPending || isResolved}
          >
            <SelectTrigger className="h-8 text-sm w-full text-white">
              <SelectValue>{PRIORITY_LABELS[incident.priority?.toLowerCase()] ?? incident.priority}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Assignee */}
        <div className="space-y-2">
          <p className="text-sm text-white">Assigned To</p>
          <Select
            value={incident.assigned_to ?? '__unassigned__'}
            onValueChange={handleAssigneeChange}
            disabled={updateIncidentMutation.isPending}
          >
            <SelectTrigger className="h-8 text-sm w-full text-white">
              <SelectValue>{assigneeName ?? 'Unassigned'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__unassigned__">Unassigned</SelectItem>
              {members.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

      </div>
    </div>
  )
}

// ─── IncidentDetailPage ───────────────────────────────────────────────────────

export default function IncidentDetailPage() {
  const { incidentId } = useParams({ from: FROM_PATH })
  const orgId = useCurrentOrgId()

  const { data: incident, isLoading, isError, refetch } = useIncidentById(orgId, incidentId)

  if (!orgId || isLoading) {
    return <LoadingSpinner className="py-32" />
  }

  if (isError || !incident) {
    return (
      <div className="flex-1 flex flex-col -m-6 lg:-m-8">
        <div className="px-6 lg:px-8 py-4 border-b border-border/40">
          <Link
            to="/incidents"
            search={{ offset: 0 }}
            className="flex items-center gap-1.5 text-sm text-white hover:text-white transition-colors w-fit"
          >
            ← Incidents
          </Link>
        </div>
        <div className="m-6 flex items-center gap-3 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <AlertCircle size={15} className="shrink-0" />
          <span>Failed to load incident.</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 text-sm text-destructive hover:bg-destructive/10"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const ServiceIcon = getServiceIcon(incident.resource_service)
  const serviceLabel = getServiceLabel(incident.resource_service)
  const duration = getDuration(incident.started_at, incident.resolved_at)
  const priority = priorityConfig[incident.priority?.toLowerCase()] ?? priorityConfig.low
  const rawJson = incident.raw_payload != null
    ? JSON.stringify(incident.raw_payload, null, 2)
    : null

  const stateLabel = incident.state === 'ALARM' ? 'Alarm' : 'Insufficient Data'
  const stateCls = incident.state === 'ALARM'
    ? 'bg-red-500/15 text-red-400 border border-red-500/20'
    : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'

  const statusCls = incident.status === 'open'
    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
    : 'bg-muted text-white border border-border'

  return (
    <div className="flex-1 flex flex-col -m-6 lg:-m-8">

      {/* Breadcrumb bar */}
      <div className="flex items-center justify-between px-6 lg:px-8 py-4 bg-card/80 backdrop-blur-sm border-b border-border/60 shrink-0">
        <BreadCrumbs
          items={[
            { label: 'Incidents', url: '/incidents' },
            { label: incident.metric_name },
          ]}
        />

        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-sm text-white hover:text-white"
          render={<Link to="/incidents" search={{ offset: 0 }} />}
        >
          ← Back
        </Button>
      </div>

      {/* Incident header */}
      <div className="px-6 lg:px-8 py-5 border-b border-border/60 bg-card/60 backdrop-blur-sm shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <h1 className="text-xl font-semibold text-white">{incident.metric_name}</h1>
            <div className="flex items-center gap-1.5 text-sm text-white">
              <ServiceIcon size={13} className="shrink-0" />
              <span>{incident.resource_name || incident.resource_id}</span>
              {incident.resource_region && (
                <>
                  <span className="opacity-30">·</span>
                  <span>{incident.resource_region}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center text-sm font-medium px-2.5 py-0.5 rounded-full border lowercase tracking-wide ${statusCls}`}>
                {incident.status}
              </span>
              <span className={`inline-flex items-center text-sm font-medium px-2.5 py-0.5 rounded-full border lowercase tracking-wide ${stateCls}`}>
                {stateLabel}
              </span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full lowercase tracking-wide ${priority.cls}`}>
                {priority.label}
              </span>
              {incident.status === 'open' && (
                <span className="flex items-center gap-1.5 text-sm text-red-400 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                  Active · {duration}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

            {/* Left: info sections */}
            <div className="space-y-6">

              {/* Alert Details */}
              <SectionCard title="Alert Details">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                  <InfoField label="Metric" value={incident.metric_name} />
                  <InfoField label="Threshold Value" value={String(incident.threshold_value)} />
                  <InfoField label="State" value={stateLabel} />
                  <InfoField label="Duration" value={duration} />
                  <InfoField label="Recorded" value={formatDateTime(incident.created_at)} />
                  <InfoField
                    label="Alarm ARN"
                    value={incident.alarm_arn ?? 'Not linked'}
                    mono={!!incident.alarm_arn}
                  />
                </div>
              </SectionCard>

              {/* Timeline */}
              <SectionCard title="Timeline">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <InfoField label="Started" value={formatDateTime(incident.started_at)} />
                  <div className="space-y-1">
                    <p className="text-sm text-white">Resolved</p>
                    {incident.resolved_at
                      ? <p className="text-sm text-white">{formatDateTime(incident.resolved_at)}</p>
                      : <p className="text-sm text-red-400 font-medium">Not resolved</p>
                    }
                  </div>
                </div>
              </SectionCard>

              {/* Source */}
              <SectionCard title="Source">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                  <div className="space-y-1">
                    <p className="text-sm text-white">Resource</p>
                    <Link
                      to="/cloud-accounts"
                      className="flex items-center gap-1.5 text-sm text-primary hover:underline w-fit"
                    >
                      <ServiceIcon size={13} />
                      <span>{incident.resource_name || incident.resource_id}</span>
                      <ExternalLink size={11} />
                    </Link>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-white">Service</p>
                    <div className="flex items-center gap-1.5 text-sm font-bold text-white">
                      <ServiceIcon size={13} className="text-white" />
                      {serviceLabel}
                    </div>
                  </div>
                  <InfoField label="Region" value={incident.resource_region} />
                  <InfoField label="Account" value={incident.account_name} />
                  <InfoField label="Account ID" value={incident.cloud_account_id} mono />
                  <InfoField label="Resource ID" value={incident.resource_id} mono />
                </div>
              </SectionCard>

              {/* Raw Payload */}
              {rawJson && (
                <SectionCard title="Raw Payload">
                  <pre className="text-sm font-mono text-white bg-muted/40 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                    {rawJson}
                  </pre>
                </SectionCard>
              )}
            </div>

            {/* Right: management */}
            <div className="lg:sticky lg:top-6">
              <ManagementCard incident={incident} orgId={orgId} />
            </div>

          </div>
        </div>
      </div>

    </div>
  )
}
