import { apiClient } from './client'

export type AuthType = 'access_key' | 'role_arn'
export type SyncStatus = 'idle' | 'syncing' | 'done' | 'failed'

export interface CloudAccount {
  id: string
  org_id: string
  name: string
  provider: string
  auth_type: AuthType
  regions: string[]
  sync_status: SyncStatus
  last_synced_at: string | null
  credential_display: string
  created_at: string
  updated_at: string
}

export interface AccessKeyCredentials {
  accessKeyId: string
  secretAccessKey: string
}

export interface RoleArnCredentials {
  roleArn: string
  externalId?: string
}

export interface CreateCloudAccountPayload {
  name: string
  provider: string
  authType: AuthType
  credentials: AccessKeyCredentials | RoleArnCredentials
  regions?: string[]
}

export interface ValidateResult {
  valid: boolean
  accountId?: string
  arn?: string
  userId?: string
  error?: string
}

export interface SyncJobResponse {
  jobId: string | null
  status: string
  accountId?: string
}

export interface SyncStatusResponse {
  syncStatus?: string
  jobId?: string
  status?: string
  progress?: number
  failReason?: string
  returnValue?: unknown
}

export async function listCloudAccounts(): Promise<CloudAccount[]> {
  const { data } = await apiClient.get<CloudAccount[]>('/cloud-accounts')
  return data
}

export async function createCloudAccount(payload: CreateCloudAccountPayload): Promise<CloudAccount> {
  const { data } = await apiClient.post<CloudAccount>('/cloud-accounts', payload)
  return data
}

export async function deleteCloudAccount(id: string): Promise<void> {
  await apiClient.delete(`/cloud-accounts/${id}`)
}

export async function validateCloudAccount(id: string): Promise<ValidateResult> {
  const { data } = await apiClient.post<ValidateResult>(`/cloud-accounts/${id}/validate`)
  return data
}

export async function triggerSync(id: string): Promise<SyncJobResponse> {
  const { data } = await apiClient.post<SyncJobResponse>(`/cloud-accounts/${id}/sync`)
  return data
}

export async function getSyncStatus(id: string, jobId: string): Promise<SyncStatusResponse> {
  const { data } = await apiClient.get<SyncStatusResponse>(
    `/cloud-accounts/${id}/sync-status`,
    { params: { jobId } },
  )
  return data
}

// ─── Resources ────────────────────────────────────────────────────────────────

export interface Resource {
  id: string
  service: string
  external_id: string
  name: string
  region: string
  status: string
  metadata: Record<string, unknown>
  last_seen_at: string | null
  created_at: string
}

export interface ResourcesPagination {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface ResourcesResponse {
  data: Resource[]
  pagination: ResourcesPagination
}

export interface ResourcesParams {
  limit?: number
  offset?: number
  service?: string
  region?: string
  status?: string
  search?: string
}

export async function getResources(
  accountId: string,
  params: ResourcesParams,
): Promise<ResourcesResponse> {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
  )
  const { data } = await apiClient.get<ResourcesResponse>(
    `/cloud-accounts/${accountId}/resources`,
    { params: cleanParams },
  )
  return data
}

export async function getResource(accountId: string, resourceId: string): Promise<Resource> {
  const { data } = await apiClient.get<Resource>(
    `/cloud-accounts/${accountId}/resources/${resourceId}`,
  )
  return data
}
