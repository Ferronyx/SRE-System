# SRE Platform — Backend

REST API backend for the SRE monitoring platform. Handles auth, org management, cloud account integration, resource syncing, and alerting.

## Tech Stack

- **Runtime:** Node.js + Express 5
- **Database:** PostgreSQL (via Knex)
- **Queue:** Bull + Redis
- **Cloud:** AWS SDK v3 (EC2, RDS, S3, Lambda, ELB, CloudWatch, SNS)
- **Auth:** JWT + refresh tokens
- **Monitoring:** Sentry, New Relic

## Project Structure

```
main/
  index.js          # App entry point
  db.js             # Knex DB instance
  db/               # DB helpers
  route/            # Express routers
  service/          # Business logic layer
  middleware/       # Auth, role checks, error handler
  lib/              # Shared utilities (asyncHandler, roles, AWS credentials)
workers/
  index.js          # Bull worker entry point
  resourceSync.js   # Cloud resource sync job
migrations/         # Knex migration files
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL
- Redis

### Setup

```bash
# Install dependencies
npm install

# Copy env file and fill in values
cp .env.example .env

# Run migrations
npm run migrate

# Start dev server (port 8080)
npm run dev
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Secret for signing JWTs |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `ENCRYPTION_KEY` | Key for encrypting cloud credentials at rest |
| `SENTRY_DSN` | Sentry DSN (optional) |
| `NEW_RELIC_LICENSE_KEY` | New Relic license key (optional) |

## API Reference

See [API.md](./API.md) for the full endpoint reference.

Base URL: `/api/v1`
Auth: `Authorization: Bearer <token>`

### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Register user + org |
| POST | `/auth/login` | Login |
| POST | `/auth/refresh` | Refresh JWT |
| GET | `/users/me` | Current user |
| GET | `/orgs/me` | User's orgs |
| GET | `/orgs/:orgId/members` | List org members |
| POST | `/orgs/:orgId/cloud-accounts` | Add cloud account |
| GET | `/orgs/:orgId/cloud-accounts` | List cloud accounts |
| POST | `/cloud-accounts/:id/sync` | Trigger resource sync |

## Database Migrations

```bash
# Run all pending migrations
npm run migrate

# Rollback last batch
npm run migrate:rollback

# Create a new migration
npm run migrate:make -- <migration_name>
```

## Role Hierarchy

| Role | Level | Permissions |
|------|-------|-------------|
| viewer | 1 | Read-only |
| member | 2 | Basic actions |
| admin | 3 | Manage accounts, remove members |
| owner | 4 | All actions including role changes |
