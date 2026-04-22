import { useQuery } from '@tanstack/react-query'
import { listMembers } from './orgs'

export function useOrgMembers(orgId: string | undefined) {
  return useQuery({
    queryKey: ['members', orgId],
    queryFn: () => listMembers(orgId!, 1, 100),
    enabled: !!orgId,
  })
}
