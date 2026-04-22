import { Outlet, Link, useNavigate } from '@tanstack/react-router'
import {
  Activity,
  AlertCircle,
  Building2,
  Cloud,
  Layers,
  LayoutDashboard,
  LogOut,
  Settings,
  User,
  ChevronDown,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

const navItems = [
  { to: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/incidents',      icon: AlertCircle,     label: 'Incidents' },
  { to: '/cloud-accounts', icon: Cloud,           label: 'Cloud Accounts' },
  { to: '/orgs',           icon: Building2,       label: 'Organization' },
]

function initials(name?: string | null) {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    toast.success('Logged out')
    navigate({ to: '/login' })
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-60 flex flex-col shrink-0 bg-sidebar">
        {/* Brand */}
        <div className="h-16 flex items-center px-4 gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 ring-1 ring-primary/30">
            <Activity size={15} className="text-primary" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-sm text-white tracking-tight">SRE System</span>
            <span className="text-sm text-muted-foreground tracking-widest uppercase font-medium">Precision Ops</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pt-2 pb-4 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={`${to}-${label}`}
              to={to}
              activeProps={{ className: 'text-blue-400 bg-primary font-medium' }}
              className="group relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-muted-foreground transition-all duration-200 hover:bg-accent/50"
            >
              <Icon size={16} className="shrink-0 transition-colors duration-200" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Settings + User footer */}
        <div className="px-3 pb-3 space-y-0.5">
          <Link
            to="/profile"
            activeProps={{ className: 'text-blue-400 bg-primary font-medium' }}
            className="group flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-muted-foreground transition-all duration-200 hover:bg-accent/50"
          >
            <Settings size={16} className="shrink-0" />
            Settings
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" className="w-full justify-start gap-2.5 h-10 px-3 hover:bg-accent/50 text-muted-foreground" />
              }
            >
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarFallback className="text-sm bg-primary/20 text-primary font-semibold">
                  {initials(user?.fullName)}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 text-left text-sm truncate">{user?.fullName ?? 'Account'}</span>
              <ChevronDown size={13} className="shrink-0 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                render={<Link to="/profile" />}
                className="flex items-center gap-2"
              >
                <User size={13} /> Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive flex items-center gap-2"
                onSelect={handleLogout}
              >
                <LogOut size={13} /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col overflow-y-auto p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
