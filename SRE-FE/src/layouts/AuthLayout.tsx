import { Outlet } from '@tanstack/react-router'
import { Activity } from 'lucide-react'

export function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background auth-glow px-4">
      <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
            <Activity size={18} className="text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">SRE System</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5 tracking-widest uppercase font-medium">Precision Ops</p>
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
