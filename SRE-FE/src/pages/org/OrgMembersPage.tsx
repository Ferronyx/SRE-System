import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import {
  ChevronLeft,
  Loader2,
  MoreHorizontal,
  ShieldCheck,
  Trash2,
  UserCog,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import {
  listMembers,
  changeMemberRole,
  removeMember,
  type OrgMember,
  type OrgRole,
} from '@/api/orgs'

const ROLES: OrgRole[] = ['viewer', 'member', 'admin', 'owner']

const ROLE_VARIANT: Record<OrgRole, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  owner: 'default',
  admin: 'secondary',
  member: 'outline',
  viewer: 'outline',
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
}

export default function OrgMembersPage() {
  const { orgId } = useParams({ strict: false }) as { orgId: string }
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const LIMIT = 20

  const { data, isLoading, isError } = useQuery({
    queryKey: ['members', orgId, page],
    queryFn: () => listMembers(orgId, page, LIMIT),
  })

  // Role change dialog
  const [roleTarget, setRoleTarget] = useState<OrgMember | null>(null)
  const [selectedRole, setSelectedRole] = useState<OrgRole>('member')

  const roleChangeMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrgRole }) =>
      changeMemberRole(orgId, userId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', orgId] })
      setRoleTarget(null)
      toast.success('Role updated')
    },
    onError: () => toast.error('Failed to update role'),
  })

  // Remove member dialog
  const [removeTarget, setRemoveTarget] = useState<OrgMember | null>(null)

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeMember(orgId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', orgId] })
      setRemoveTarget(null)
      toast.success('Member removed')
    },
    onError: () => toast.error('Failed to remove member'),
  })

  const totalPages = data ? Math.ceil(data.meta.total / LIMIT) : 1

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" render={<Link to="/orgs" />}>
          <ChevronLeft size={18} />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground">Manage who has access to this organisation</p>
        </div>
      </div>

      {isLoading && <LoadingSpinner />}

      {isError && (
        <div className="text-sm text-destructive">Failed to load members.</div>
      )}

      {data && (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-xs">
                            {initials(member.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{member.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {member.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ROLE_VARIANT[member.role]}>{member.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="icon" className="h-7 w-7" />}
                        >
                          <MoreHorizontal size={14} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              setRoleTarget(member)
                              setSelectedRole(member.role)
                            }}
                          >
                            <ShieldCheck size={14} className="mr-2" />
                            Change role
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setRemoveTarget(member)}
                          >
                            <Trash2 size={14} className="mr-2" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {data.meta.total} member{data.meta.total !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span>
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Change Role Dialog */}
      <Dialog open={!!roleTarget} onOpenChange={(open) => !open && setRoleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog size={18} /> Change role
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
            <Button variant="outline" onClick={() => setRoleTarget(null)}>
              Cancel
            </Button>
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
        title={<span className="flex items-center gap-2"><Trash2 size={18} /> Remove member</span>}
        description={<>Are you sure you want to remove <strong>{removeTarget?.full_name}</strong> from this organisation? This cannot be undone.</>}
        confirmLabel="Remove"
        isPending={removeMutation.isPending}
        onConfirm={() => removeTarget && removeMutation.mutate(removeTarget.id)}
      />
    </div>
  )
}
