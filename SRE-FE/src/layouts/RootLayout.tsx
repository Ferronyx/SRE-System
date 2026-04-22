import { Outlet } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/sonner'

export function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster position="top-right" richColors />
    </>
  )
}
