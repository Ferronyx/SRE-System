import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, User } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { PageHeader } from '@/components/PageHeader'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { getMe, updateMe, type UpdateProfilePayload } from '@/api/users'

function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
}

export default function ProfilePage() {
  const qc = useQueryClient()

  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
  })

  const [form, setForm] = useState({ fullName: '', email: '', password: '' })
  const [formReady, setFormReady] = useState(false)

  // Initialise form once user loads
  if (user && !formReady) {
    setForm({ fullName: user.fullName, email: user.email, password: '' })
    setFormReady(true)
  }

  const mutation = useMutation({
    mutationFn: (payload: UpdateProfilePayload) => updateMe(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] })
      setFormReady(false) // re-sync with new data
      toast.success('Profile updated')
    },
    onError: () => toast.error('Failed to update profile'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const payload: UpdateProfilePayload = {}
    if (form.fullName !== user?.fullName) payload.fullName = form.fullName
    if (form.email !== user?.email) payload.email = form.email
    if (form.password) payload.password = form.password
    if (Object.keys(payload).length === 0) {
      toast.info('No changes to save')
      return
    }
    mutation.mutate(payload)
  }

  if (isLoading) {
    return <LoadingSpinner className="h-64" />
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Profile" description="Manage your account details" />

      <Card>
        <CardHeader className="flex flex-row items-center gap-4 pb-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="text-lg">
              {initials(user?.fullName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-base">{user?.fullName}</CardTitle>
            <CardDescription>{user?.email}</CardDescription>
            <p className="text-xs text-muted-foreground mt-0.5">
              Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
            </p>
          </div>
        </CardHeader>
        <Separator />
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
              />
            </div>
            <Separator />
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Leave blank to keep current"
                autoComplete="new-password"
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <User size={14} /> Account info
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <div className="flex justify-between">
            <span>User ID</span>
            <span className="font-mono text-xs">{user?.id}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
