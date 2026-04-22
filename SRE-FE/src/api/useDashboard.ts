import { useQuery } from '@tanstack/react-query'
import { getDashboardSummary } from './dashboard'

export function useDashboardSummary(orgId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard-summary', orgId],
    queryFn: () => getDashboardSummary(orgId!),
    enabled: !!orgId,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}
