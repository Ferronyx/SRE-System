# SRE-FE

A modern, open-source SaaS frontend for cloud infrastructure observability — multi-cloud account management, real-time incident tracking, resource monitoring, and organization administration.

Built with React 19, TypeScript, and the TanStack ecosystem.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Routes](#routes)
- [API Reference](#api-reference)
- [Authentication](#authentication)
- [Architecture Notes](#architecture-notes)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

SRE-FE is the frontend layer of an SRE (Site Reliability Engineering) platform. It connects to a REST API backend and gives engineering teams a single interface to:

- Monitor cloud infrastructure health across multiple AWS accounts
- Track, triage, and resolve incidents in real time
- Manage organizations, members, and role-based access
- Configure resource thresholds and receive CloudWatch-driven alerts

This project is intentionally framework-agnostic at the API boundary — it works with any backend that implements the [API contract](./api.md).

---

## Features

### Cloud Account Management
- Add and manage AWS cloud accounts via IAM access keys or role ARN
- Validate credentials and trigger resource discovery syncs
- Poll live sync job status with real-time progress updates
- Support for 32 AWS regions

### Dashboard
- System-wide health status (healthy / degraded / critical)
- Real-time metrics: uptime, latency, error rate
- Sparkline trend charts per metric
- Live active incident feed with severity indicators
- AI-generated recommendations widget

### Incidents
- Paginated incident list with multi-filter support (status, priority, keyword search)
- Severity levels: CRITICAL, WARNING, LOW
- Inline status toggling (open → resolved)
- Assignee management
- Full incident detail view with raw payload inspection

### Resource Browser
- Browse resources across all linked cloud accounts
- Filter by service type, region, status, or free-text search
- Per-resource threshold configuration
- CloudWatch alarm integration
- Resource-level incident history

### Organization Management
- Multi-organization support per user account
- Member role management: viewer, member, admin, owner
- Invite flow and member removal
- Billing tier display

### Authentication
- JWT-based auth with in-memory access tokens and httpOnly cookie refresh tokens
- Automatic silent refresh on 401
- Route-level guards for all protected pages
- Strong password enforcement and inline validation

---

## Tech Stack

| Layer | Library / Tool | Version |
|---|---|---|
| Framework | React + TypeScript (strict) | 19 / ~5.9 |
| Bundler | Vite | 8 |
| Routing | TanStack Router | 1.x |
| Server State | TanStack React Query | 5.x |
| Forms | TanStack React Form | 1.x |
| Tables | TanStack React Table | 8.x |
| Styling | Tailwind CSS | v4 |
| Components | Shadcn UI | latest |
| HTTP | Axios | 1.x |
| Toasts | Sonner | 2.x |
| Icons | Lucide React | 0.577+ |
| Error Tracking | Sentry | 10.x |
| Fonts | Geist + DM Sans (variable) | — |

---

## Project Structure

```
src/
├── api/
│   ├── client.ts              # Axios instance — base URL, auth interceptors, token refresh
│   ├── auth.ts                # Login, register, logout, refresh endpoints
│   ├── orgs.ts                # Organization and member management
│   ├── users.ts               # User profile endpoints
│   ├── cloudAccounts.ts       # Cloud account CRUD, validate, sync, resources
│   ├── thresholds.ts          # Threshold and incident endpoints
│   ├── dashboard.ts           # Dashboard metrics endpoint
│   ├── useCloudAccounts.ts    # React Query hooks for cloud accounts
│   ├── useDashboard.ts        # React Query hooks for dashboard
│   ├── useOrgMembers.ts       # React Query hooks for org members
│   └── useThresholds.ts       # React Query hooks for thresholds and incidents
│
├── components/
│   ├── ui/                    # Shadcn UI primitives — do not modify directly
│   ├── ConfirmDialog.tsx      # Reusable confirmation modal
│   ├── EmptyState.tsx         # Empty state placeholder
│   ├── ErrorBoundary.tsx      # React error boundary
│   ├── LoadingSpinner.tsx     # Loading indicator
│   ├── PageHeader.tsx         # Page title + description header
│   └── ProviderIcon.tsx       # Cloud provider badge / icon
│
├── contexts/
│   └── AuthContext.tsx        # Global auth state — user, org, login/logout/register
│
├── layouts/
│   ├── RootLayout.tsx         # Root wrapper (Sonner toaster)
│   ├── AppLayout.tsx          # Sidebar + main content shell
│   └── AuthLayout.tsx         # Centered card layout for auth pages
│
├── pages/
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   └── RegisterPage.tsx
│   ├── cloud/
│   │   ├── CloudAccountsPage.tsx
│   │   ├── ResourcesPage.tsx
│   │   └── ResourcesView.tsx
│   ├── dashboard/
│   │   └── DashboardPage.tsx
│   ├── incidents/
│   │   ├── IncidentsListPage.tsx
│   │   └── IncidentDetailPage.tsx
│   ├── org/
│   │   ├── OrgListPage.tsx
│   │   └── OrgMembersPage.tsx
│   └── user/
│       └── ProfilePage.tsx
│
├── types/
│   └── index.ts               # Shared TypeScript interfaces and types
│
├── utils/
│   ├── error.ts               # API error message extractor
│   ├── useCurrentOrgId.ts     # Hook to read current org from context
│   ├── useDebounce.ts         # Debounce hook for search inputs
│   └── validation.ts          # Email and password regex patterns
│
├── router.tsx                 # TanStack Router config + route guards
├── main.tsx                   # Entry: StrictMode > QueryClientProvider > AuthProvider > RouterProvider
└── index.css                  # Tailwind base + global CSS variables
```

---

## Getting Started

### Prerequisites

- **Node.js** 18 or later
- **npm** 9 or later
- A running backend that implements the [API contract](./api.md) (default: `http://localhost:8080/api/v1`)

### Installation

```bash
git clone https://github.com/your-org/sre-fe.git
cd sre-fe
npm install
```

### Environment Setup

```bash
cp .env.example .env
```

Edit `.env` with your values (see [Environment Variables](#environment-variables)).

### Running Locally

```bash
npm run dev
```

The dev server starts at `http://localhost:5173` by default.

### Other Commands

```bash
npm run build     # Type-check + production build → dist/
npm run preview   # Preview the production build locally
npm run lint      # Run ESLint across the project
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | Yes | `http://localhost:8080/api/v1` | Backend API base URL |
| `VITE_SENTRY_DSN` | No | — | Sentry DSN for error tracking |

All variables must be prefixed with `VITE_` to be exposed to the browser by Vite.

---

## Routes

| Path | Page | Auth Guard |
|---|---|---|
| `/` | Root redirect | → `/dashboard` if authed, → `/login` if not |
| `/login` | LoginPage | → `/dashboard` if already authed |
| `/register` | RegisterPage | → `/dashboard` if already authed |
| `/dashboard` | DashboardPage | Requires auth |
| `/incidents` | IncidentsListPage | Requires auth |
| `/incidents/:incidentId` | IncidentDetailPage | Requires auth |
| `/cloud-accounts` | CloudAccountsPage | Requires auth |
| `/orgs` | OrgListPage | Requires auth |
| `/orgs/:orgId/members` | OrgMembersPage | Requires auth |
| `/profile` | ProfilePage | Requires auth |

Route guards are defined in `src/router.tsx` using TanStack Router's `beforeLoad` hooks.

---

## API Reference

Full endpoint documentation is in [`api.md`](./api.md).

**Base URL:** `http://localhost:8080/api/v1` (configurable via `VITE_API_URL`)

### Domain Overview

| Module | File | Endpoints |
|---|---|---|
| Auth | `src/api/auth.ts` | Register, login, logout, refresh, logout-all |
| Users | `src/api/users.ts` | Get / update current user profile |
| Organizations | `src/api/orgs.ts` | List orgs, list / manage members |
| Cloud Accounts | `src/api/cloudAccounts.ts` | CRUD, validate, sync, resources, thresholds |
| Incidents | `src/api/thresholds.ts` | List, get, resolve, update incidents |
| Dashboard | `src/api/dashboard.ts` | Aggregated metrics |

All HTTP calls go through the shared Axios instance at `src/api/client.ts`, which handles:
- Base URL injection
- Access token attachment (`Authorization: Bearer`)
- Automatic silent token refresh on 401
- Queuing concurrent requests during a refresh

---

## Authentication

SRE-FE uses a dual-token JWT strategy:

| Token | Storage | Lifetime |
|---|---|---|
| Access token | In-memory only | ~15 minutes |
| Refresh token | httpOnly cookie | 7 days |

**Flow:**
1. On login, the backend returns an access token in the response body and sets a refresh token cookie.
2. The access token is stored in a module-level variable (never `localStorage`) — it disappears on page refresh.
3. On page load, `AuthContext` performs a silent refresh to re-issue the access token from the cookie.
4. The Axios interceptor catches 401 responses, calls `/auth/refresh`, and retries the original request transparently.
5. Concurrent requests during a refresh are queued and replayed once the new token is available.

---

## Architecture Notes

### Data Fetching
Every page that fetches or mutates data has a dedicated hook file in `src/api/` (e.g., `useOrgMembers.ts`). `useQuery` and `useMutation` are never inlined into components. Hook files export named hooks only — no raw Axios calls outside `src/api/`.

TanStack Query is configured with:
- `staleTime: 2 minutes`
- No automatic retry on 401, 403, or 404

### Styling
Tailwind CSS v4 is the single source of truth. No inline `style={{}}` props (except truly dynamic values). Shadcn UI components are used as-is from `src/components/ui/` — customizations are wrapped in new components under `src/components/`.

### State
- **Server state** — TanStack Query (caching, pagination, background refetch)
- **Auth / user state** — React Context (`AuthContext`)
- **UI state** — local `useState` within components

### Error Handling
- API errors are extracted via `src/utils/error.ts` and surfaced as Sonner toasts
- Form validation errors are shown inline, not as toasts
- Unhandled render errors are caught by `<ErrorBoundary />`
- Sentry captures uncaught exceptions in production

---

## Contributing

Contributions are welcome. Please follow the conventions established in the codebase.

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes — keep them focused and minimal
4. Run `npm run lint` and `npm run build` before committing
5. Open a pull request with a clear description of the change

**Guidelines:**
- Follow the folder structure — new API hooks go in `src/api/`, shared components in `src/components/`, types in `src/types/`
- Do not modify files inside `src/components/ui/` — wrap them instead
- No inline logic inside JSX — compute derived values above the `return`
- All user-facing actions should have loading states and toast feedback

---

## License

MIT — see [LICENSE](./LICENSE) for details.
