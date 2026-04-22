import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  listCloudAccounts,
  createCloudAccount,
  deleteCloudAccount,
  validateCloudAccount,
  triggerSync,
  getSyncStatus,
  getResources,
  type CreateCloudAccountPayload,
  type ResourcesParams,
} from './cloudAccounts'

const TERMINAL_JOB_STATUSES = new Set(['completed', 'failed'])

export function useCloudAccounts() {
  return useQuery({
    queryKey: ['cloud-accounts'],
    queryFn: listCloudAccounts,
  })
}

export function useAddCloudAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateCloudAccountPayload) => createCloudAccount(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cloud-accounts'] })
    },
  })
}

export function useDeleteCloudAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCloudAccount(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cloud-accounts'] })
    },
  })
}

export function useValidateCloudAccount() {
  return useMutation({
    mutationFn: (id: string) => validateCloudAccount(id),
  })
}

export function useTriggerSync() {
  return useMutation({
    mutationFn: (id: string) => triggerSync(id),
  })
}

export function useResources(accountId: string, params: ResourcesParams) {
  return useQuery({
    queryKey: ['resources', accountId, params],
    queryFn: () => getResources(accountId, params),
    placeholderData: keepPreviousData,
    enabled: !!accountId,
  })
}

export function useSyncPoller(
  accountId: string,
  jobId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['sync-status', accountId, jobId],
    queryFn: () => getSyncStatus(accountId, jobId!),
    enabled: enabled && !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status && TERMINAL_JOB_STATUSES.has(status)) return false
      return 3000
    },
    retry: false,
  })
}
