import { cn } from '@/lib/utils'

export const PROVIDER_CONFIG: Record<string, {
  icon: string
  bg: string
  border: string
  shadow: string
  label: string
}> = {
  aws: {
    icon: 'https://ap-south-1.signin.aws.amazon.com/v2/assets/_next/static/media/aws-logo@2x.7c50e6f9.png',
    bg: 'bg-[#FFFFFF]/40',
    border: 'border-[#FF9900]/30',
    shadow: 'shadow-[0_0_12px_rgba(255,153,0,0.15)]',
    label: 'AWS',
  },
  gcp: {
    icon: 'https://www.gstatic.com/cgc/super_cloud.png',
    bg: 'bg-gradient-to-br from-[#4285F4]/20 to-[#34A853]/10',
    border: 'border-[#4285F4]/30',
    shadow: 'shadow-[0_0_12px_rgba(66,133,244,0.15)]',
    label: 'GCP',
  },
  azure: {
    icon: 'https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/acom_social_icon_azure',
    bg: 'bg-gradient-to-br from-[#0078D4]/20 to-[#50E6FF]/10',
    border: 'border-[#0078D4]/30',
    shadow: 'shadow-[0_0_12px_rgba(0,120,212,0.15)]',
    label: 'Azure',
  },
}

interface ProviderIconProps {
  provider: string
  size?: 'sm' | 'md'
}

export function ProviderIcon({ provider, size = 'md' }: ProviderIconProps) {
  const config = PROVIDER_CONFIG[provider.toLowerCase()] ?? {
    icon: '',
    bg: 'bg-muted/30',
    border: 'border-border/50',
    shadow: '',
    label: provider.toUpperCase().slice(0, 2),
  }

  const containerCls = size === 'sm'
    ? 'w-7 h-7 rounded-lg'
    : 'w-14 h-14 rounded-2xl'
  const imgCls = size === 'sm' ? 'w-4 h-4' : 'w-8 h-8'

  return (
    <div
      className={cn(
        containerCls,
        config.bg,
        'border',
        config.border,
        config.shadow,
        'flex items-center justify-center shrink-0 transition-all duration-200',
      )}
    >
      {config.icon ? (
        <img src={config.icon} alt={config.label} className={cn(imgCls, 'object-contain')} />
      ) : (
        <span className={cn('font-bold text-foreground', size === 'sm' ? 'text-[9px]' : 'text-xs')}>
          {config.label.slice(0, 2)}
        </span>
      )}
    </div>
  )
}
