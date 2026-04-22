import { Loader2 } from 'lucide-react'

interface LoadingSpinnerProps {
  className?: string
}

export function LoadingSpinner({ className = 'h-48' }: LoadingSpinnerProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Loader2 className="animate-spin text-muted-foreground" />
    </div>
  )
}
