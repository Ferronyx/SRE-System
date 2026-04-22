import { apiClient } from './client'

export interface DashboardSummary {
  uptime_percent: number | null
  p99_latency_ms: number | null
  error_rate_24h_percent: number | null
  error_rate_change_percent: number | null
  system_status: 'healthy' | 'degraded' | 'critical'
  active_incident_count: number
  resolved_last_24h_count: number
  uptime_sparkline: number[]
  latency_sparkline: number[]
}

export async function getDashboardSummary(orgId: string): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary>(`/orgs/${orgId}/dashboard/summary`)
  return data
}
