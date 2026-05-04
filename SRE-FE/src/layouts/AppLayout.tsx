import { useState } from 'react'
import { Outlet, Link, useNavigate } from '@tanstack/react-router'
import {
  Activity,
  AlertCircle,
  Building2,
  Cloud,
  ChevronsLeft,
  ChevronsRight,
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
import { cn } from '@/lib/utils'

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
  const [isCollapsed, setIsCollapsed] = useState(
    () => localStorage.getItem('sre-sidebar-collapsed') === 'true'
  )

  function toggleCollapse() {
    const next = !isCollapsed
    setIsCollapsed(next)
    localStorage.setItem('sre-sidebar-collapsed', String(next))
  }

  async function handleLogout() {
    await logout()
    toast.success('Logged out')
    navigate({ to: '/login' })
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className={cn(
        'flex flex-col shrink-0 bg-sidebar overflow-hidden transition-[width] duration-200 ease-in-out',
        isCollapsed ? 'w-14' : 'w-56',
      )}>

        {/* Brand */}
        <div className={cn(
          'h-16 flex items-center border-b border-border/20 shrink-0',
          isCollapsed ? 'justify-center' : 'px-4 gap-3',
        )}>
          <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 ring-1 ring-primary/25">
            <Activity size={14} className="text-primary" />
          </div>
          {!isCollapsed && (
            <span className="font-semibold text-sm text-foreground tracking-tight whitespace-nowrap">
              SRE System
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className={cn(
          'flex-1 pt-2 pb-2 space-y-0.5',
          isCollapsed ? 'px-2' : 'px-3',
        )}>
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={`${to}-${label}`}
              to={to}
              title={isCollapsed ? label : undefined}
              activeProps={{ className: 'bg-primary/10 text-primary font-medium' }}
              className={cn(
                'group relative flex items-center gap-3 py-2.5 rounded-md text-sm text-muted-foreground transition-all duration-150 hover:bg-sidebar-accent hover:text-foreground',
                isCollapsed ? 'justify-center px-2.5' : 'px-3',
              )}
            >
              <Icon size={16} className="shrink-0 transition-colors duration-150" />
              {!isCollapsed && <span className="truncate">{label}</span>}
            </Link>
          ))}
        </nav>

        {/* Bottom: Settings + Collapse toggle + User */}
        <div className={cn('pb-3 space-y-0.5', isCollapsed ? 'px-2' : 'px-3')}>
          <Link
            to="/profile"
            title={isCollapsed ? 'Settings' : undefined}
            activeProps={{ className: 'bg-primary/10 text-primary font-medium' }}
            className={cn(
              'group flex items-center gap-3 py-2.5 rounded-md text-sm text-muted-foreground transition-all duration-150 hover:bg-sidebar-accent hover:text-foreground',
              isCollapsed ? 'justify-center px-2.5' : 'px-3',
            )}
          >
            <Settings size={16} className="shrink-0" />
            {!isCollapsed && <span>Settings</span>}
          </Link>

          <button
            onClick={toggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex items-center gap-3 py-2 rounded-md text-sm text-muted-foreground transition-all duration-150 hover:bg-sidebar-accent hover:text-foreground w-full',
              isCollapsed ? 'justify-center px-2.5' : 'px-3',
            )}
          >
            {isCollapsed ? <ChevronsRight size={14} /> : (
              <>
                <ChevronsLeft size={14} />
                <span>Collapse</span>
              </>
            )}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  className={cn(
                    'hover:bg-sidebar-accent text-muted-foreground hover:text-foreground',
                    isCollapsed
                      ? 'w-full justify-center h-10 px-0'
                      : 'w-full justify-start gap-2.5 h-10 px-3',
                  )}
                />
              }
            >
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarFallback className="text-xs bg-primary/15 text-primary font-semibold">
                  {initials(user?.fullName)}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left text-sm truncate">{user?.fullName ?? 'Account'}</span>
                  <ChevronDown size={13} className="shrink-0 opacity-50" />
                </>
              )}
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
