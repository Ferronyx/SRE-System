import type { ElementType, ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'

interface EmptyStateProps {
  icon: ElementType
  title: string
  description?: string
  action?: ReactNode
  variant?: 'card' | 'bare'
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'bare',
}: EmptyStateProps) {
  const inner = (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
        <Icon size={18} className="text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium text-sm">{title}</p>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  )

  if (variant === 'card') {
    return (
      <Card>
        <CardContent className="p-0">{inner}</CardContent>
      </Card>
    )
  }

  return inner
}
