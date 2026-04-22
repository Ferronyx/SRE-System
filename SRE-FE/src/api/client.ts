import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'

// In-memory token store (never localStorage for access token)
let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // required for httpOnly refresh token cookie
})

// Attach access token to every request
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

// Unwrap { status: 1, data: {...} } envelope from all successful responses.
// If the response has sibling fields alongside `data` (e.g. pagination, meta),
// they are preserved: { data, ...rest }. Simple responses unwrap to `data` directly.
// This runs before the 401 error interceptor so retry responses are also unwrapped.
apiClient.interceptors.response.use((res) => {
  const raw = res.data
  if (
    raw !== null &&
    typeof raw === 'object' &&
    (raw as Record<string, unknown>).status === 1 &&
    'data' in (raw as Record<string, unknown>)
  ) {
    const { status: _s, data, ...rest } = raw as Record<string, unknown>
    res.data = Object.keys(rest).length === 0 ? data : { data, ...rest }
  }
  return res
})

// Refresh token on 401, retry once.
// Uses bare axios for the refresh call to avoid re-triggering this interceptor.
// Auth endpoints (/auth/*) are excluded — a 401 there means credentials are invalid.
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token)
  })
  failedQueue = []
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes('/auth/')
    ) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`
        return apiClient(originalRequest)
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      // Refresh token is an httpOnly cookie — no body needed, browser sends it automatically.
      // Using bare axios to bypass this interceptor; manually unwrap the response envelope.
      const { data } = await axios.post<{ status: number; data: { accessToken: string } }>(
        `${BASE_URL}/auth/refresh`,
        null,
        { withCredentials: true },
      )
      const newToken = data.data.accessToken
      accessToken = newToken

      processQueue(null, newToken)
      originalRequest.headers.Authorization = `Bearer ${newToken}`
      return apiClient(originalRequest)
    } catch (err) {
      processQueue(err, null)
      accessToken = null
      window.location.href = '/login'
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  },
)
