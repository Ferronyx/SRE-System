import { apiClient } from './client'

export interface AuthUser {
  id: string
  email: string
  fullName: string
}

export interface AuthOrg {
  id: string
  name: string
  slug?: string
}

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer'

// The unwrap interceptor in client.ts strips the { status, data } envelope,
// so these types describe what callers receive after unwrapping.
export interface AuthResponse {
  accessToken: string
  user: AuthUser
  org: AuthOrg
  role?: OrgRole
}

export interface RegisterPayload {
  fullName: string
  email: string
  password: string
  orgName: string
}

export interface LoginPayload {
  email: string
  password: string
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', payload)
  return data
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', payload)
  return data
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout')
}
