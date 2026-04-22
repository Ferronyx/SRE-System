import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { login as apiLogin, logout as apiLogout, register as apiRegister } from '@/api/auth'
import type { LoginPayload, RegisterPayload, AuthUser, AuthOrg, OrgRole } from '@/api/auth'
import { getMyOrgs } from '@/api/orgs'
import { setAccessToken, apiClient } from '@/api/client'
import { router } from '@/router'

interface AuthState {
  user: AuthUser | null
  org: AuthOrg | null
  role: OrgRole | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  login: (payload: LoginPayload) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    org: null,
    role: null,
    isAuthenticated: false,
    isLoading: true,
  })

  // On mount: attempt silent refresh using the httpOnly cookie.
  // No localStorage check needed — the browser sends the cookie automatically.
  // The /auth/ URL exclusion in the 401 interceptor prevents refresh loops.
  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await apiClient.post<{ accessToken: string }>('/auth/refresh')
        setAccessToken(data.accessToken)

        const { data: user } = await apiClient.get<AuthUser>('/users/me')
        const orgs = await getMyOrgs()
        const firstOrg = orgs?.[0]
        const org: AuthOrg | null = firstOrg ? { id: firstOrg.id, name: firstOrg.name, slug: firstOrg.slug } : null
        const role: OrgRole | null = firstOrg?.role ?? null
        setState({ user, org, role, isAuthenticated: true, isLoading: false })
      } catch {
        setState({ user: null, org: null, role: null, isAuthenticated: false, isLoading: false })
      }
    })()
  }, [])

  const login = useCallback(async (payload: LoginPayload) => {
    const res = await apiLogin(payload)
    setAccessToken(res.accessToken)
    setState({
      user: res.user,
      org: res.org,
      role: res.role ?? null,
      isAuthenticated: true,
      isLoading: false,
    })
    router.navigate({ to: '/orgs' })
  }, [])

  // Register returns auth data — log the user in directly, no need to pass through /login.
  const register = useCallback(async (payload: RegisterPayload) => {
    const res = await apiRegister(payload)
    setAccessToken(res.accessToken)
    setState({
      user: res.user,
      org: res.org,
      role: res.role ?? null,
      isAuthenticated: true,
      isLoading: false,
    })
    router.navigate({ to: '/orgs' })
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } catch {
      // ignore — clear locally regardless
    }
    setAccessToken(null)
    setState({ user: null, org: null, role: null, isAuthenticated: false, isLoading: false })
    router.navigate({ to: '/login' })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
