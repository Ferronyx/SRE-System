import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { getMyOrgs } from '@/api/orgs'

export function useCurrentOrgId(): string | undefined {
  const { org } = useAuth()
  const orgsQuery = useQuery({
    queryKey: ['orgs'],
    queryFn: getMyOrgs,
    enabled: !org?.id,
  })

  console.log("orgsQuery", orgsQuery)
  return org?.id ?? orgsQuery.data?.[0]?.id
}
