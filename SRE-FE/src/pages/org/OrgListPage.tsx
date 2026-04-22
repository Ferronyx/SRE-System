import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LayoutGrid,
  Search,
  UserPlus,
  MoreVertical,
  ShieldCheck,
  Trash2,
  UserCog,
  Loader2,
  Building2,
  Target,
  Users,
  Shield,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import {
  getMyOrgs,
  listMembers,
  changeMemberRole,
  removeMember,
  type OrgMember,
  type OrgRole,
} from '@/api/orgs'

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES: OrgRole[] = ['viewer', 'member', 'admin', 'owner']
const LIMIT = 20

const ROLE_BADGE: Record<OrgRole, string> = {
  owner: 'border-blue-500/50 text-blue-400 bg-blue-500/10',
  admin: 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10',
  member: 'border-border/60 text-muted-foreground bg-muted/30',
  viewer: 'border-border/60 text-muted-foreground bg-muted/30',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
}

// ─── ToggleSwitch ─────────────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
        checked ? 'bg-emerald-500' : 'bg-muted/80 border border-border/60',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 mt-0.5',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string
  value: string
  sub?: string
  subColor?: 'green' | 'red' | 'default'
  accent?: string
}

function StatCard({ title, value, sub, subColor = 'default', accent }: StatCardProps) {
  const subCls = subColor === 'green'
    ? 'text-emerald-400'
    : subColor === 'red'
    ? 'text-destructive'
    : 'text-muted-foreground'

  return (
    <div className={cn(
      'rounded-xl border bg-card p-5 transition-all duration-200 hover:border-border/80',
      accent ? `border-l-2 ${accent} border-t-border/50 border-r-border/50 border-b-border/50` : 'border-border/50',
    )}>
      <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-medium">{title}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-foreground">{value}</span>
        {sub && <span className={cn('text-sm font-medium', subCls)}>{sub}</span>}
      </div>
    </div>
  )
}

// ─── MemberRow ────────────────────────────────────────────────────────────────

interface MemberRowProps {
  member: OrgMember
  onChangeRole: (m: OrgMember) => void
  onRemove: (m: OrgMember) => void
}

function MemberRow({ member, onChangeRole, onRemove }: MemberRowProps) {
  const joinedAgo = formatRelativeTime(member.joined_at)

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-border/20 hover:bg-muted/20 transition-colors duration-150 group last:border-b-0">
      {/* Identity */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="text-xs font-semibold bg-primary/15 text-primary">
            {initials(member.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{member.full_name}</p>
          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
        </div>
      </div>

      {/* Role */}
      <div className="w-24 shrink-0">
        <Badge
          variant="outline"
          className={cn('text-[10px] font-semibold tracking-wide uppercase', ROLE_BADGE[member.role])}
        >
          {member.role}
        </Badge>
      </div>

      {/* Status */}
      <div className="w-28 shrink-0 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
        <span className="text-xs text-foreground/80">Active</span>
      </div>

      {/* Telemetry */}
      <div className="w-36 shrink-0 hidden lg:block">
        <span className="text-xs text-muted-foreground">Joined: {joinedAgo}</span>
      </div>

      {/* Actions */}
      <div className="shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
              />
            }
          >
            <MoreVertical size={13} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onChangeRole(member)}>
              <ShieldCheck size={13} className="mr-2" />
              Change role
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => onRemove(member)}
            >
              <Trash2 size={13} className="mr-2" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

// ─── OrgListPage ──────────────────────────────────────────────────────────────

export default function OrgListPage() {
  const { org: authOrg } = useAuth()
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [enforce2FA, setEnforce2FA] = useState(true)
  const [ssoRestriction, setSsoRestriction] = useState(false)

  // Role change dialog
  const [roleTarget, setRoleTarget] = useState<OrgMember | null>(null)
  const [selectedRole, setSelectedRole] = useState<OrgRole>('member')

  // Remove member dialog
  const [removeTarget, setRemoveTarget] = useState<OrgMember | null>(null)

  const orgsQuery = useQuery({
    queryKey: ['orgs'],
    queryFn: getMyOrgs,
  })

  const currentOrg = orgsQuery.data?.find((o) => o.id === authOrg?.id) ?? orgsQuery.data?.[0]
  const orgId = currentOrg?.id ?? authOrg?.id

  const membersQuery = useQuery({
    queryKey: ['members', orgId, page],
    queryFn: () => listMembers(orgId!, page, LIMIT),
    enabled: !!orgId,
  })

  const roleChangeMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrgRole }) =>
      changeMemberRole(orgId!, userId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', orgId] })
      setRoleTarget(null)
      toast.success('Role updated')
    },
    onError: () => toast.error('Failed to update role'),
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeMember(orgId!, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', orgId] })
      setRemoveTarget(null)
      toast.success('Member removed')
    },
    onError: () => toast.error('Failed to remove member'),
  })

  // Computed values
  const isLoading = orgsQuery.isLoading || membersQuery.isLoading
  const members = membersQuery.data?.data ?? []
  const totalMembers = membersQuery.data?.meta.total ?? 0
  const totalPages = membersQuery.data ? Math.ceil(membersQuery.data.meta.total / LIMIT) : 1

  const adminCount = members.filter((m) => m.role === 'admin' || m.role === 'owner').length
  const adminRatio = totalMembers > 0
    ? ((adminCount / totalMembers) * 100).toFixed(1)
    : '0.0'

  const filteredMembers = search.trim()
    ? members.filter(
        (m) =>
          m.full_name.toLowerCase().includes(search.toLowerCase()) ||
          m.email.toLowerCase().includes(search.toLowerCase()),
      )
    : members

  if (isLoading) return <LoadingSpinner />

  if (!orgId || !currentOrg) {
    return (
      <EmptyState
        icon={Building2}
        title="No organisation found"
        description="You are not a member of any organisation yet."
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 items-start">

        {/* Left: Org Profile */}
        <div className="rounded-xl border border-border/50 bg-card p-6 space-y-5">
          <h2 className="flex items-center gap-2.5 text-base font-semibold text-foreground">
            <LayoutGrid size={17} className="text-primary" />
            Org Profile
          </h2>

          {/* Organization Name */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
              Organization Name
            </p>
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2.5">
              <span className="text-sm font-mono text-foreground">{currentOrg.name}</span>
            </div>
          </div>

          {/* Primary Domain */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
              Primary Domain
            </p>
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2.5">
              <span className="text-sm font-mono text-foreground">{currentOrg.slug}</span>
            </div>
          </div>

          {/* Billing Tier */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
              Billing Tier
            </p>
            <div className="rounded-md border border-border/60 bg-muted/20 p-3 flex items-start gap-3">
              <div className="h-8 w-8 rounded-md bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                <Target size={14} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {currentOrg.plan ?? 'Free'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {currentOrg.role === 'owner' || currentOrg.role === 'admin'
                    ? 'Manage your subscription'
                    : 'Contact admin to upgrade'}
                </p>
              </div>
              {(currentOrg.role === 'owner' || currentOrg.role === 'admin') && (
                <button
                  type="button"
                  className="text-xs text-primary hover:text-primary/70 font-medium transition-colors duration-150 shrink-0"
                >
                  Upgrade
                </button>
              )}
            </div>
          </div>

          {/* Security Policy */}
          <div className="space-y-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium flex items-center gap-1.5">
              <Shield size={11} />
              Security Policy
            </p>
            <div className="space-y-0">
              <div className="flex items-center justify-between py-3 border-b border-border/30">
                <span className="text-sm text-foreground">Enforce 2FA</span>
                <ToggleSwitch checked={enforce2FA} onChange={setEnforce2FA} />
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-foreground">SSO Restriction</span>
                <ToggleSwitch checked={ssoRestriction} onChange={setSsoRestriction} />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Active Members */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            {/* Members header */}
            <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-border/40">
              <h2 className="flex items-center gap-2.5 text-base font-semibold text-foreground whitespace-nowrap">
                <Users size={17} className="text-primary" />
                Active Members
              </h2>
              <div className="flex items-center gap-2 flex-1 justify-end">
                <div className="relative max-w-[200px] w-full">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Filter members..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                <Button size="sm" className="gap-1.5 h-8 shrink-0">
                  <UserPlus size={13} />
                  Invite
                </Button>
              </div>
            </div>

            {/* Column headers */}
            <div className="flex items-center gap-4 px-5 py-2 border-b border-border/20 bg-muted/10">
              <div className="flex-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Identity</div>
              <div className="w-24 text-[10px] font-medium text-muted-foreground uppercase tracking-wider shrink-0">Role</div>
              <div className="w-28 text-[10px] font-medium text-muted-foreground uppercase tracking-wider shrink-0">Status</div>
              <div className="w-36 text-[10px] font-medium text-muted-foreground uppercase tracking-wider shrink-0 hidden lg:block">Telemetry</div>
              <div className="w-7 shrink-0" />
            </div>

            {/* Members list */}
            {membersQuery.isLoading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {search ? 'No members match your search' : 'No members yet'}
              </div>
            ) : (
              <div>
                {filteredMembers.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    onChangeRole={(m) => { setRoleTarget(m); setSelectedRole(m.role) }}
                    onRemove={setRemoveTarget}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && !search && (
              <div className="px-5 py-3 border-t border-border/30 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {totalMembers} member{totalMembers !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground px-1">{page} / {totalPages}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              title="Total Seats"
              value={totalMembers.toString()}
              accent="border-l-primary/60"
            />
            <StatCard
              title="Admin Ratio"
              value={`${adminRatio}%`}
              sub={parseFloat(adminRatio) < 25 ? 'Optimal' : 'High'}
              subColor={parseFloat(adminRatio) < 25 ? 'green' : 'red'}
              accent="border-l-emerald-500/60"
            />
            <StatCard
              title="Your Role"
              value={currentOrg.role.charAt(0).toUpperCase() + currentOrg.role.slice(1)}
              sub={currentOrg.role === 'owner' || currentOrg.role === 'admin' ? 'Full Access' : 'Limited'}
              subColor={currentOrg.role === 'owner' || currentOrg.role === 'admin' ? 'green' : 'default'}
              accent="border-l-blue-500/60"
            />
          </div>
        </div>
      </div>

      {/* Change Role Dialog */}
      <Dialog open={!!roleTarget} onOpenChange={(open) => !open && setRoleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog size={18} /> Change Role
            </DialogTitle>
            <DialogDescription>
              Update the role for <strong>{roleTarget?.full_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as OrgRole)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleTarget(null)}>Cancel</Button>
            <Button
              disabled={roleChangeMutation.isPending}
              onClick={() =>
                roleTarget && roleChangeMutation.mutate({ userId: roleTarget.id, role: selectedRole })
              }
            >
              {roleChangeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={<span className="flex items-center gap-2"><Trash2 size={18} /> Remove Member</span>}
        description={
          <>Are you sure you want to remove <strong>{removeTarget?.full_name}</strong> from this organisation? This cannot be undone.</>
        }
        confirmLabel="Remove"
        isPending={removeMutation.isPending}
        onConfirm={() => removeTarget && removeMutation.mutate(removeTarget.id)}
      />
    </div>
  )
}
