import { useState, useEffect } from 'react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Trash2,
  RefreshCw,
  ShieldCheck,
  Cloud,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
  LayoutList,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ProviderIcon, PROVIDER_CONFIG } from '@/components/ProviderIcon'
import { extractApiError } from '@/utils/error'
import {
  useCloudAccounts,
  useAddCloudAccount,
  useDeleteCloudAccount,
  useValidateCloudAccount,
  useTriggerSync,
  useSyncPoller,
} from '@/api/useCloudAccounts'
import { getResources } from '@/api/cloudAccounts'
import type {
  CloudAccount,
  SyncStatus,
  ValidateResult,
  CreateCloudAccountPayload,
} from '@/api/cloudAccounts'
import { ResourcesView } from './ResourcesView'

// ─── Constants ────────────────────────────────────────────────────────────────

const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'af-south-1',
  'ap-east-1', 'ap-south-1', 'ap-south-2',
  'ap-southeast-1', 'ap-southeast-2', 'ap-southeast-3', 'ap-southeast-4', 'ap-southeast-5',
  'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
  'ca-central-1', 'ca-west-1',
  'eu-central-1', 'eu-central-2',
  'eu-west-1', 'eu-west-2', 'eu-west-3',
  'eu-north-1', 'eu-south-1', 'eu-south-2',
  'il-central-1',
  'me-central-1', 'me-south-1',
  'sa-east-1',
] as const

const INLINE_POLICY = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sns:CreateTopic",
        "sns:Subscribe",
        "sns:Publish",
        "sns:SetTopicAttributes",
        "sns:GetTopicAttributes"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:PutMetricAlarm",
        "cloudwatch:DeleteAlarms",
        "cloudwatch:DescribeAlarms"
      ],
      "Resource": "*"
    }
  ]
}`

const ACCOUNT_STATUS: Record<SyncStatus, { label: string; dot: string; badge: string }> = {
  done:    { label: 'HEALTHY',  dot: 'bg-emerald-400',          badge: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' },
  failed:  { label: 'WARNING',  dot: 'bg-orange-400',           badge: 'border-orange-500/30 text-orange-400 bg-orange-500/10'   },
  syncing: { label: 'SYNCING',  dot: 'bg-yellow-400 animate-pulse', badge: 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10' },
  idle:    { label: 'IDLE',     dot: 'bg-muted-foreground/60',  badge: 'border-border/50 text-muted-foreground bg-muted/30'      },
}

type PageTab = 'accounts' | 'resources'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function computeLiveStatus(
  base: SyncStatus,
  polling: boolean,
  jobStatus: string | undefined,
): SyncStatus {
  if (!polling) return base
  if (!jobStatus || jobStatus === 'waiting' || jobStatus === 'active' || jobStatus === 'queued') return 'syncing'
  if (jobStatus === 'completed') return 'done'
  if (jobStatus === 'failed') return 'failed'
  return 'syncing'
}

function regionBtnCls(selected: boolean): string {
  return selected
    ? 'text-xs px-2 py-1 rounded-md border border-primary/40 bg-primary/10 text-primary transition-colors duration-150'
    : 'text-xs px-2 py-1 rounded-md border border-border/60 bg-background text-muted-foreground hover:border-border hover:text-foreground transition-colors duration-150'
}

// ─── AccountCard ──────────────────────────────────────────────────────────────

interface AccountCardProps {
  account: CloudAccount
  resourceCount: number | null
  onDeleteRequest: (account: CloudAccount) => void
  onViewResources: (accountId: string) => void
}

function AccountCard({ account, resourceCount, onDeleteRequest, onViewResources }: AccountCardProps) {
  const qc = useQueryClient()
  const [jobId, setJobId] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null)

  const validateMutation = useValidateCloudAccount()
  const syncMutation = useTriggerSync()
  const { data: pollData } = useSyncPoller(account.id, jobId, isPolling)

  useEffect(() => {
    if (!pollData?.status) return
    if (pollData.status === 'completed' || pollData.status === 'failed') {
      setIsPolling(false)
      setJobId(null)
      qc.invalidateQueries({ queryKey: ['cloud-accounts'] })
      if (pollData.status === 'completed') {
        toast.success(`${account.name} synced successfully`)
      } else {
        toast.error(`Sync failed: ${pollData.failReason ?? 'Unknown error'}`)
      }
    }
  }, [pollData?.status, account.name, qc])

  async function handleValidate() {
    setValidateResult(null)
    try {
      const result = await validateMutation.mutateAsync(account.id)
      setValidateResult(result)
      if (result.valid) {
        toast.success('Credentials are valid')
      } else {
        toast.error(result.error ?? 'Validation failed')
      }
    } catch (err) {
      toast.error(extractApiError(err, 'Network error — please try again'))
    }
  }

  async function handleSync() {
    try {
      const job = await syncMutation.mutateAsync(account.id)
      if (job.jobId) {
        setJobId(job.jobId)
        setIsPolling(true)
        toast.info('Sync started')
      } else {
        toast.info('Sync queued')
      }
    } catch (err) {
      toast.error(extractApiError(err, 'Network error — please try again'))
    }
  }

  const liveStatus = computeLiveStatus(account.sync_status, isPolling, pollData?.status)
  const statusConfig = ACCOUNT_STATUS[liveStatus]
  const lastSynced = formatRelativeTime(account.last_synced_at)
  const isValidating = validateMutation.isPending
  const isSyncing = syncMutation.isPending || isPolling
  const isBusy = isValidating || isSyncing
  const providerLabel = PROVIDER_CONFIG[account.provider.toLowerCase()]?.label ?? account.provider.toUpperCase()
  const hasValidateResult = validateResult !== null
  const validateValid = validateResult?.valid ?? false
  const validateResultCls = validateValid
    ? 'flex items-start gap-2 text-xs px-3 py-2 rounded-md bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 transition-all duration-200'
    : 'flex items-start gap-2 text-xs px-3 py-2 rounded-md bg-destructive/10 text-destructive border border-destructive/20 transition-all duration-200'

  return (
    <Card className="border-border/50 bg-card transition-all duration-200 hover:border-border/80 hover:shadow-lg hover:-translate-y-0.5">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <ProviderIcon provider={account.provider} />
          <Badge
            variant="outline"
            className={cn(statusConfig.badge, 'text-[11px] font-semibold tracking-wide gap-1.5 transition-colors duration-300')}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', statusConfig.dot)} />
            {statusConfig.label}
          </Badge>
        </div>

        {/* Identity */}
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-medium">{providerLabel}</p>
          <h3 className="text-xl font-bold text-foreground leading-tight mt-0.5">{account.name}</h3>
          <p className="text-xs text-muted-foreground mt-1 font-mono">ID: {account.credential_display}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 py-1">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Resources</p>
            <p className="text-2xl font-bold text-foreground mt-0.5">
              {resourceCount !== null
                ? resourceCount.toLocaleString()
                : <span className="text-muted-foreground text-base">—</span>
              }
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Regions</p>
            <p className="text-2xl font-bold text-foreground mt-0.5">
              {account.regions?.length > 0
                ? account.regions.length
                : <span className="text-muted-foreground text-base">All</span>
              }
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-border/40 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Last sync: {lastSynced}</p>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              disabled={isBusy} onClick={handleValidate} title="Validate credentials"
            >
              {isValidating ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
            </Button>
            <Button
              variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              disabled={isBusy} onClick={handleSync} title="Sync account"
            >
              {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            </Button>
            <Button
              variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              title="View resources" onClick={() => onViewResources(account.id)}
            >
              <LayoutList size={12} />
            </Button>
            <Button
              variant="ghost" size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150"
              disabled={isSyncing} onClick={() => onDeleteRequest(account)} title="Delete account"
            >
              <Trash2 size={12} />
            </Button>
          </div>
        </div>

        {/* Validate result */}
        {hasValidateResult && (
          <div className={validateResultCls}>
            {validateValid ? (
              <>
                <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
                <span>
                  Valid — Account <strong>{validateResult!.accountId}</strong>
                  {validateResult!.arn && (
                    <> · <span className="font-mono break-all">{validateResult!.arn}</span></>
                  )}
                </span>
              </>
            ) : (
              <>
                <XCircle size={13} className="shrink-0 mt-0.5" />
                <span>{validateResult!.error ?? 'Invalid credentials'}</span>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── AddAccountModal ──────────────────────────────────────────────────────────

interface FormState {
  name: string
  accessKeyId: string
  secretAccessKey: string
  regions: string[]
}

interface FormErrors {
  name?: string
  accessKeyId?: string
  secretAccessKey?: string
}

const INITIAL_FORM: FormState = { name: '', accessKeyId: '', secretAccessKey: '', regions: [] }

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {}
  if (!form.name.trim()) errors.name = 'Name is required'
  if (!form.accessKeyId.trim()) errors.accessKeyId = 'Access Key ID is required'
  if (!form.secretAccessKey.trim()) errors.secretAccessKey = 'Secret Access Key is required'
  return errors
}

function AddAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const addMutation = useAddCloudAccount()

  function handleClose() { setForm(INITIAL_FORM); setErrors({}); onClose() }

  function toggleRegion(region: string) {
    setForm((prev) => ({
      ...prev,
      regions: prev.regions.includes(region)
        ? prev.regions.filter((r) => r !== region)
        : [...prev.regions, region],
    }))
  }

  async function handleSubmit() {
    const errs = validateForm(form)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    const payload: CreateCloudAccountPayload = {
      name: form.name.trim(),
      provider: 'aws',
      authType: 'access_key',
      credentials: { accessKeyId: form.accessKeyId, secretAccessKey: form.secretAccessKey },
      ...(form.regions.length > 0 ? { regions: form.regions } : {}),
    }
    try {
      await addMutation.mutateAsync(payload)
      toast.success('Cloud account added')
      handleClose()
    } catch (err) {
      toast.error(extractApiError(err, 'Network error — please try again'))
    }
  }

  const isPending = addMutation.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="min-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Cloud size={17} /> Add Cloud Account</DialogTitle>
          <DialogDescription>Connect an AWS account using IAM access keys.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3.5 space-y-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Info size={13} className="text-primary shrink-0" /> IAM User Setup
            </p>
            <ol className="space-y-2.5 text-xs text-muted-foreground list-none">
              {[
                <>Go to <strong className="text-foreground">AWS Console → IAM → Users</strong> and create a new user with <strong className="text-foreground">programmatic access</strong>.</>,
                <>Attach the AWS managed policy: <code className="text-foreground bg-muted px-1 py-0.5 rounded text-[11px]">ReadOnlyAccess</code></>,
                <div className="space-y-1.5 min-w-0">
                  <span>Attach the following <strong className="text-foreground">inline policy</strong> for SNS and CloudWatch access:</span>
                  <pre className="text-[10px] font-mono bg-muted rounded-md p-2.5 overflow-x-auto leading-relaxed text-foreground whitespace-pre">{INLINE_POLICY}</pre>
                </div>,
                <>Go to <strong className="text-foreground">Security credentials</strong> and generate an <strong className="text-foreground">Access Key</strong>. Paste it below.</>,
              ].map((content, i) => (
                <li key={i} className="flex gap-2">
                  <span className="h-4 w-4 rounded-full bg-primary/15 text-primary font-semibold flex items-center justify-center shrink-0 text-[10px]">{i + 1}</span>
                  <span>{content}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ca-name">Account Name</Label>
            <Input id="ca-name" placeholder="e.g. Production AWS" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} disabled={isPending} />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ca-key-id">Access Key ID</Label>
            <Input id="ca-key-id" placeholder="AKIAIOSFODNN7EXAMPLE" value={form.accessKeyId} onChange={(e) => setForm((p) => ({ ...p, accessKeyId: e.target.value }))} disabled={isPending} />
            {errors.accessKeyId && <p className="text-xs text-destructive">{errors.accessKeyId}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ca-secret">Secret Access Key</Label>
            <Input id="ca-secret" type="password" placeholder="wJalrXUtnFEMI..." value={form.secretAccessKey} onChange={(e) => setForm((p) => ({ ...p, secretAccessKey: e.target.value }))} disabled={isPending} />
            {errors.secretAccessKey && <p className="text-xs text-destructive">{errors.secretAccessKey}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Regions <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <div className="flex flex-wrap gap-1.5">
              {AWS_REGIONS.map((region) => (
                <button key={region} type="button" disabled={isPending} className={regionBtnCls(form.regions.includes(region))} onClick={() => toggleRegion(region)}>
                  {region}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Add Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── CloudAccountsPage ────────────────────────────────────────────────────────

export default function CloudAccountsPage() {
  const [activeTab, setActiveTab] = useState<PageTab>('accounts')
  const [resourceAccountId, setResourceAccountId] = useState('')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CloudAccount | null>(null)

  const { data: accounts, isLoading, isError } = useCloudAccounts()
  const deleteMutation = useDeleteCloudAccount()
  const syncAllMutation = useTriggerSync()

  const countQueries = useQueries({
    queries: (accounts ?? []).map((account) => ({
      queryKey: ['resources', account.id, 'count'],
      queryFn: () => getResources(account.id, { limit: 1 }),
      enabled: !!accounts && accounts.length > 0,
    })),
  })

  const totalResources = countQueries.reduce((sum, q) => sum + (q.data?.pagination?.total ?? 0), 0)

  function handleViewResources(accountId: string) {
    setResourceAccountId(accountId)
    setActiveTab('resources')
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast.success(`${deleteTarget.name} deleted`)
      setDeleteTarget(null)
    } catch (err) {
      toast.error(extractApiError(err, 'Network error — please try again'))
    }
  }

  async function handleSyncAll() {
    if (!accounts?.length) return
    try {
      await Promise.allSettled(accounts.map((a) => syncAllMutation.mutateAsync(a.id)))
      toast.info('Sync triggered for all accounts')
    } catch {
      // allSettled doesn't throw
    }
  }

  const isEmpty = !isLoading && !isError && accounts?.length === 0

  return (
    <div className="space-y-6">
      {/* Page header with tabs */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-0 border-b border-border/40 pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('accounts')}
            className={cn(
              'flex items-center gap-2 px-1 pb-3 mr-5 text-sm font-medium border-b-2 -mb-px transition-colors duration-150',
              activeTab === 'accounts'
                ? 'text-foreground border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground',
            )}
          >
            <Cloud size={15} className={activeTab === 'accounts' ? 'text-primary' : ''} />
            Cloud Accounts
            {accounts && accounts.length > 0 && (
              <span className="text-[11px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md font-medium">
                {accounts.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('resources')}
            className={cn(
              'flex items-center gap-2 px-1 pb-3 text-sm font-medium border-b-2 -mb-px transition-colors duration-150',
              activeTab === 'resources'
                ? 'text-foreground border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground',
            )}
          >
            <Layers size={15} className={activeTab === 'resources' ? 'text-primary' : ''} />
            Resources
            {totalResources > 0 && (
              <span className="text-[11px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md font-medium">
                {totalResources >= 1000 ? `${(totalResources / 1000).toFixed(1)}k` : totalResources}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline" size="sm" className="gap-1.5"
            onClick={handleSyncAll} disabled={syncAllMutation.isPending || !accounts?.length}
          >
            <RefreshCw size={13} className={syncAllMutation.isPending ? 'animate-spin' : ''} />
            Sync All
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setAddModalOpen(true)}>
            <Plus size={14} />
            Add Account
          </Button>
        </div>
      </div>

      {/* Cloud Accounts tab */}
      {activeTab === 'accounts' && (
        <>
          {isLoading && <LoadingSpinner />}
          {isError && <div className="text-sm text-destructive">Failed to load cloud accounts.</div>}
          {isEmpty && (
            <EmptyState icon={Cloud} title="No cloud accounts yet" description="Add an AWS account to get started" />
          )}
          {accounts && accounts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {accounts.map((account, i) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  resourceCount={countQueries[i]?.data?.pagination?.total ?? null}
                  onDeleteRequest={setDeleteTarget}
                  onViewResources={handleViewResources}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Resources tab */}
      {activeTab === 'resources' && (
        <>
          {isLoading && <LoadingSpinner />}
          {!isLoading && (!accounts || accounts.length === 0) && (
            <EmptyState icon={Cloud} title="No cloud accounts" description="Add a cloud account to browse resources" />
          )}
          {accounts && accounts.length > 0 && (
            <ResourcesView
              accounts={accounts}
              defaultAccountId={resourceAccountId || accounts[0]?.id}
            />
          )}
        </>
      )}

      <AddAccountModal open={addModalOpen} onClose={() => setAddModalOpen(false)} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={<span className="flex items-center gap-2"><Trash2 size={17} /> Delete Cloud Account</span>}
        description={
          <>Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will permanently remove the account and its credentials.</>
        }
        confirmLabel="Delete"
        isPending={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
