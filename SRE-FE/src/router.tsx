import {
  createRouter,
  createRoute,
  createRootRouteWithContext,
  redirect,
} from '@tanstack/react-router'
import { RootLayout } from '@/layouts/RootLayout'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import ProfilePage from '@/pages/user/ProfilePage'
import OrgListPage from '@/pages/org/OrgListPage'
import OrgMembersPage from '@/pages/org/OrgMembersPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import CloudAccountsPage from '@/pages/cloud/CloudAccountsPage'
import IncidentsListPage from '@/pages/incidents/IncidentsListPage'
import IncidentDetailPage from '@/pages/incidents/IncidentDetailPage'

export interface RouterContext {
  auth: {
    isAuthenticated: boolean
  }
}

// ─── Root ────────────────────────────────────────────────────────────────────
const rootRoute = createRootRouteWithContext<RouterContext>()({ component: RootLayout })

// ─── Auth routes (public) ────────────────────────────────────────────────────
const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth',
  component: AuthLayout,
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) throw redirect({ to: '/dashboard' })
  },
})

const loginRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/login',
  component: LoginPage,
})

const registerRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/register',
  component: RegisterPage,
})

// ─── App routes (protected) ──────────────────────────────────────────────────
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  component: AppLayout,
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) throw redirect({ to: '/login' })
  },
})

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/dashboard',
  component: DashboardPage,
})

const profileRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/profile',
  component: ProfilePage,
})

const orgListRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/orgs',
  component: OrgListPage,
})

const orgMembersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/orgs/$orgId/members',
  component: OrgMembersPage,
})

const cloudAccountsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/cloud-accounts',
  component: CloudAccountsPage,
})

const incidentsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/incidents',
  validateSearch: (search: Record<string, unknown>) => ({
    offset: typeof search.offset === 'number' ? search.offset : 0,
  }),
  component: IncidentsListPage,
})

const incidentDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/incidents/$incidentId',
  component: IncidentDetailPage,
})

// ─── Index redirect ──────────────────────────────────────────────────────────
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: ({ context }) => {
    throw redirect({ to: context.auth.isAuthenticated ? '/dashboard' : '/login' })
  },
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  authRoute.addChildren([loginRoute, registerRoute]),
  appRoute.addChildren([
    dashboardRoute,
    profileRoute,
    orgListRoute,
    orgMembersRoute,
    cloudAccountsRoute,
    incidentsRoute,
    incidentDetailRoute,
  ]),
])

export const router = createRouter({
  routeTree,
  context: { auth: { isAuthenticated: false } },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
