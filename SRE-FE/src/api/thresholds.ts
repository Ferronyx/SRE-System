import { apiClient } from './client'

export interface Threshold {
  id: string
  metric_name: string
  operator: string
  threshold_value: number
  evaluation_periods: number
  period: number
  alarm_name: string | null
  sns_topic_arn: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface Incident {
  id: string
  metric_name: string
  threshold_value: number
  alarm_arn: string | null
  state: 'ALARM' | 'INSUFFICIENT_DATA'
  started_at: string
  resolved_at: string | null
  created_at: string
}

export interface UpdateThresholdBody {
  operator?: string
  threshold_value?: number
  evaluation_periods?: number
  period?: number
  sns_topic_arn?: string | null
}

export interface AvailableThreshold {
  metric_name: string
  operator: string
  threshold_value: number
  evaluation_periods: number
  period: number
  threshold_type: string
  statistic: string
}

export interface CreateThresholdBody {
  metric_name: string
}

export async function getThresholds(accountId: string, resourceId: string): Promise<Threshold[]> {
  const { data } = await apiClient.get<Threshold[]>(
    `/cloud-accounts/${accountId}/resources/${resourceId}/thresholds`,
  )
  return data
}

export async function updateThreshold(
  accountId: string,
  resourceId: string,
  thresholdId: string,
  body: UpdateThresholdBody,
): Promise<Threshold> {
  const { data } = await apiClient.patch<Threshold>(
    `/cloud-accounts/${accountId}/resources/${resourceId}/thresholds/${thresholdId}`,
    body,
  )
  return data
}

export async function deleteThreshold(
  accountId: string,
  resourceId: string,
  thresholdId: string,
): Promise<void> {
  await apiClient.delete(
    `/cloud-accounts/${accountId}/resources/${resourceId}/thresholds/${thresholdId}`,
  )
}

export async function getAvailableThresholds(
  accountId: string,
  resourceId: string,
): Promise<AvailableThreshold[]> {
  const { data } = await apiClient.get<AvailableThreshold[]>(
    `/cloud-accounts/${accountId}/resources/${resourceId}/thresholds/available`,
  )
  return data
}

export async function createThreshold(
  accountId: string,
  resourceId: string,
  body: CreateThresholdBody,
): Promise<Threshold> {
  const { data } = await apiClient.post<Threshold>(
    `/cloud-accounts/${accountId}/resources/${resourceId}/thresholds`,
    body,
  )
  return data
}

export async function getIncidents(accountId: string, resourceId: string): Promise<Incident[]> {
  const { data } = await apiClient.get<Incident[]>(
    `/cloud-accounts/${accountId}/resources/${resourceId}/incidents`,
  )
  return data
}

// ─── Org-level incidents ───────────────────────────────────────────────────────

export interface OrgIncident {
  id: string
  metric_name: string
  threshold_value: number
  alarm_arn: string | null
  state: 'ALARM' | 'INSUFFICIENT_DATA'
  status: 'open' | 'resolved'
  priority: 'high' | 'medium' | 'low'
  assigned_to: string | null
  started_at: string
  resolved_at: string | null
  created_at: string
  resource_id: string
  resource_name: string
  resource_service: string
  resource_region: string
  cloud_account_id: string
  account_name: string
  raw_payload?: unknown
}

export interface UpdateIncidentBody {
  assigned_to?: string | null
  priority?: 'high' | 'medium' | 'low'
}

export interface OrgIncidentsPagination {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface OrgIncidentsResponse {
  data: OrgIncident[]
  pagination: OrgIncidentsPagination
}

export async function listOrgIncidents(
  orgId: string,
  params: { limit?: number; offset?: number; status?: 'open' | 'resolved' },
): Promise<OrgIncidentsResponse> {
  const { data } = await apiClient.get<OrgIncidentsResponse>(
    `/orgs/${orgId}/incidents`,
    { params },
  )
  return data
}

export async function getIncidentById(orgId: string, incidentId: string): Promise<OrgIncident> {
  const { data } = await apiClient.get<OrgIncident>(
    `/orgs/${orgId}/incidents/${incidentId}`,
  )
  return data
}

export async function resolveIncident(
  incidentId: string,
): Promise<Pick<OrgIncident, 'id' | 'status' | 'resolved_at'>> {
  const { data } = await apiClient.patch(`/incidents/${incidentId}/resolve`)
  return data
}

export async function updateIncident(
  incidentId: string,
  body: UpdateIncidentBody,
): Promise<Pick<OrgIncident, 'id' | 'assigned_to' | 'priority' | 'status'>> {
  const { data } = await apiClient.patch(`/incidents/${incidentId}`, body)
  return data
}
