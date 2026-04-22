import { apiClient } from './client'

export interface User {
  id: string
  email: string
  fullName: string
  createdAt: string
  isVerified?: boolean
  lastLoginAt?: string
}

export interface UpdateProfilePayload {
  fullName?: string
  email?: string
  password?: string
}

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<User>('/users/me')
  return data
}

export async function updateMe(payload: UpdateProfilePayload): Promise<User> {
  const { data } = await apiClient.patch<User>('/users/me', payload)
  return data
}
