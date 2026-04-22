import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  getThresholds,
  getAvailableThresholds,
  createThreshold,
  updateThreshold,
  deleteThreshold,
  getIncidents,
  listOrgIncidents,
  getIncidentById,
  resolveIncident,
  updateIncident,
  type UpdateThresholdBody,
  type CreateThresholdBody,
  type UpdateIncidentBody,
} from './thresholds'

export function useThresholds(accountId: string, resourceId: string) {
  return useQuery({
    queryKey: ['thresholds', accountId, resourceId],
    queryFn: () => getThresholds(accountId, resourceId),
    enabled: !!accountId && !!resourceId,
  })
}

export function useAvailableThresholds(accountId: string, resourceId: string) {
  return useQuery({
    queryKey: ['available-thresholds', accountId, resourceId],
    queryFn: () => getAvailableThresholds(accountId, resourceId),
    enabled: !!accountId && !!resourceId,
  })
}

export function useCreateThreshold(accountId: string, resourceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateThresholdBody) => createThreshold(accountId, resourceId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['thresholds', accountId, resourceId] })
      qc.invalidateQueries({ queryKey: ['available-thresholds', accountId, resourceId] })
    },
  })
}

export function useUpdateThreshold(accountId: string, resourceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ thresholdId, body }: { thresholdId: string; body: UpdateThresholdBody }) =>
      updateThreshold(accountId, resourceId, thresholdId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['thresholds', accountId, resourceId] })
    },
  })
}

export function useDeleteThreshold(accountId: string, resourceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (thresholdId: string) => deleteThreshold(accountId, resourceId, thresholdId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['thresholds', accountId, resourceId] })
    },
  })
}

export function useIncidents(accountId: string, resourceId: string) {
  return useQuery({
    queryKey: ['incidents', accountId, resourceId],
    queryFn: () => getIncidents(accountId, resourceId),
    enabled: !!accountId && !!resourceId,
  })
}

export function useOrgIncidents(orgId: string | undefined, params: { limit?: number; offset?: number; status?: 'open' | 'resolved' }) {
  return useQuery({
    queryKey: ['org-incidents', orgId, params],
    queryFn: () => listOrgIncidents(orgId!, params),
    enabled: !!orgId,
    placeholderData: keepPreviousData,
  })
}

export function useIncidentById(orgId: string | undefined, incidentId: string) {
  return useQuery({
    queryKey: ['incident', orgId, incidentId],
    queryFn: () => getIncidentById(orgId!, incidentId),
    enabled: !!orgId && !!incidentId,
  })
}

export function useResolveIncident(orgId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (incidentId: string) => resolveIncident(incidentId),
    onSuccess: (_data, incidentId) => {
      qc.invalidateQueries({ queryKey: ['incident', orgId, incidentId] })
      qc.invalidateQueries({ queryKey: ['org-incidents', orgId] })
    },
  })
}

export function useUpdateIncident(orgId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ incidentId, body }: { incidentId: string; body: UpdateIncidentBody }) =>
      updateIncident(incidentId, body),
    onSuccess: (_data, { incidentId }) => {
      qc.invalidateQueries({ queryKey: ['incident', orgId, incidentId] })
      qc.invalidateQueries({ queryKey: ['org-incidents', orgId] })
    },
  })
}
