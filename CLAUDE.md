# CLAUDE.md — AccTrack Pro CRM

## Project Overview

**AccTrack Pro** is a CRM web application for tracking corporate accounts, sales opportunities, action items, stakeholders, and revenue forecasts.

Two fully independent applications communicating only through REST APIs:

| App        | Technology                                    | Port  |
|------------|-----------------------------------------------|-------|
| `frontend/`| React 19 + TypeScript + Vite + Tailwind CSS 4 | 5173  |
| `backend/` | NestJS 11 + Express + TypeScript              | 3000  |

---

## Repository Structure

```
account_management_opportunity-tracker/
├── frontend/                   ← React SPA (completely standalone)
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx             BrowserRouter + CRMProvider + InnerLayout + URL sync
│   │   ├── index.css
│   │   ├── vite-env.d.ts       Vite env type declarations
│   │   ├── features/           Feature-based organisation
│   │   │   ├── accounts/components/
│   │   │   ├── opportunities/components/
│   │   │   ├── action-items/components/
│   │   │   ├── stakeholders/components/
│   │   │   ├── dashboard/components/
│   │   │   ├── reports/components/
│   │   │   └── auth/components/
│   │   ├── components/
│   │   │   ├── layout/Sidebar
│   │   │   └── table/ExcelTable, CustomizeColumnsSidebar
│   │   ├── contexts/CRMContext.tsx
│   │   ├── hooks/useCRMData.ts
│   │   ├── api/
│   │   │   ├── apiClient.ts    Axios instance
│   │   │   └── crm.api.ts      Typed API functions
│   │   ├── types/index.ts      Frontend entity types (owned by frontend)
│   │   ├── constants/index.ts
│   │   ├── routes/index.tsx
│   │   └── utils/index.ts
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts          @ alias → src/, /api proxy → localhost:3000
│
└── backend/                    ← NestJS API (completely standalone)
    ├── src/
    │   ├── main.ts             Bootstrap: CORS, ValidationPipe, global filters
    │   ├── app.module.ts       Root module
    │   ├── types/index.ts      Backend entity types (owned by backend)
    │   ├── database/
    │   │   ├── database.module.ts
    │   │   └── database.service.ts  PostgreSQL pool + DDL migration + seed
    │   ├── common/
    │   │   ├── filters/        HttpExceptionFilter (global)
    │   │   └── interceptors/   LoggingInterceptor (global)
    │   └── modules/
    │       ├── accounts/
    │       ├── opportunities/
    │       ├── action-items/
    │       ├── stakeholders/
    │       ├── activities/
    │       ├── comments/
    │       ├── custom-columns/
    │       └── column-configs/
    ├── package.json
    ├── tsconfig.json
    └── .env
```

---

## How to Run

### Prerequisites

- Node.js 18+
- PostgreSQL 13+ running locally (or any reachable instance)
- Create database: `CREATE DATABASE crm_db;`

### Development (two terminals)

```bash
# Terminal 1 — Backend
cd backend
npm install
npm run start:dev     # nodemon + ts-node → http://localhost:3000
                      # DDL + seed runs automatically on first start

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev           # Vite → http://localhost:5173
```

Vite proxies all `/api/*` requests to the backend — no CORS issues in dev.

### Production

```bash
# Backend
cd backend
npm run build         # tsc → dist/
node dist/main.js

# Frontend
cd frontend
VITE_API_URL=https://your-backend.com npm run build   # → dist/
```

---

## Environment Variables

### Backend (`backend/.env`)

```
PORT=3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/crm_db
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

### Frontend (`frontend/.env.local`)

```
VITE_API_URL=          # leave empty in dev (Vite proxy handles it)
VITE_APP_TITLE=AccTrack Pro
```

---

## Tech Stack

| Layer       | Technology                                 |
|-------------|--------------------------------------------|
| Frontend    | React 19, Vite 6, Tailwind CSS 4           |
| Icons       | Lucide React                               |
| Animation   | Motion (Framer Motion v12)                 |
| HTTP client | Axios                                      |
| Routing     | React Router v7                            |
| Backend     | NestJS 11 on Express                       |
| TypeScript  | ~5.8                                       |
| DB          | PostgreSQL 13+ via `pg` (node-postgres)    |
| Dev runner  | `ts-node` + `nodemon` (backend dev mode)   |

---

## Important: ts-node (not tsx)

The backend uses **`ts-node`** as the TypeScript runtime, NOT `tsx`.

`tsx` does not emit TypeScript decorator metadata (`emitDecoratorMetadata`), which NestJS's
dependency injection requires at runtime. Without it, injected services are `undefined`
and every request returns 500. `ts-node` respects `emitDecoratorMetadata: true` in
`backend/tsconfig.json` and works correctly with NestJS DI.

---

## Architecture

### Loose Coupling

Frontend and backend are **completely independent** — no shared code, no common package,
no shared folder. The contract is the REST API only. Type definitions are maintained
separately in each app: `frontend/src/types/index.ts` and `backend/src/types/index.ts`.

### State Management (Frontend)

- **Single React Context** (`CRMContext`) — auth, server data, navigation state.
- **`useCRMData` hook** — fetches all entities on mount; CRUD mutations call the backend.
- **Navigation** — state-driven (`currentView`); `InnerLayout` syncs URL via `useNavigate`.
- **localStorage** — login state, sidebar collapsed, selected fiscal year/quarter.

### Routing (Frontend)

State-first with URL sync. Components call `setView('accounts')` from context.
`InnerLayout` observes `currentView` and pushes URL via `useNavigate`.

| View                  | URL Path               |
|-----------------------|------------------------|
| dashboard             | `/`                    |
| accounts              | `/accounts`            |
| account-details       | `/accounts/:id`        |
| opportunities         | `/opportunities`       |
| opportunity-details   | `/opportunities/:id`   |
| actionItems           | `/action-items`        |
| stakeholders          | `/stakeholders`        |
| forecast              | `/forecast`            |
| executive/reports     | `/reports`             |
| performance-evaluation| `/performance`         |
| audit-log             | `/audit-log`           |

### API Endpoints (Backend)

All prefixed `/api/`:

| Endpoint                          | Methods        |
|-----------------------------------|----------------|
| `/api/accounts`                   | GET, POST      |
| `/api/accounts/:id`               | GET, PUT, DEL  |
| `/api/opportunities`              | GET, POST      |
| `/api/opportunities/:id`          | PUT, DEL       |
| `/api/action-items`               | GET, POST      |
| `/api/action-items/:id`           | PUT, DEL       |
| `/api/stakeholders`               | GET, POST      |
| `/api/stakeholders/:id`           | PUT, DEL       |
| `/api/activities`                 | GET, POST      |
| `/api/comments`                   | GET, POST      |
| `/api/comments/:id`               | DEL            |
| `/api/custom-columns`             | GET, POST      |
| `/api/custom-columns/:module/:id` | DEL            |
| `/api/column-configs`             | GET, POST      |

---

## Database Architecture

### Primary Database

**PostgreSQL 13+** is the production database. The `pg` (node-postgres) library provides
direct SQL access — no ORM. `DatabaseService` owns a connection `Pool`, runs DDL migrations
on `onModuleInit`, seeds reference data idempotently (`ON CONFLICT DO NOTHING`), and exposes
a `query()` method injected into every module service.

Connection: `DATABASE_URL=postgresql://user:pass@host:5432/crm_db`

### Design Principles

| Principle | Implementation |
|-----------|---------------|
| **3NF normalisation** | No repeating groups; all non-key fields depend only on the PK |
| **UUID primary keys** | `gen_random_uuid()::TEXT` for all new rows; seed rows keep legacy string IDs (`acc-1`, etc.) |
| **Foreign keys** | `ON DELETE CASCADE` for child entities; `ON DELETE SET NULL` for optional references |
| **Audit fields** | `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()` on all mutable tables |
| **Soft deletes** | `is_deleted BOOLEAN DEFAULT FALSE` on core entities; queries filter `WHERE is_deleted = FALSE` |
| **Partial indexes** | All core indexes use `WHERE is_deleted = FALSE` to skip deleted rows |
| **Numeric precision** | `NUMERIC(15,2)` for monetary/revenue values; parsed as JS `number` via `pg` type parsers |

### Tables

#### Core CRM Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `accounts` | Top-level client companies | `id, name, type, health, owner, revenue, industry, custom_data JSONB` |
| `opportunities` | Sales deals linked to accounts | `id, account_id FK, stage, value, probability, tags TEXT[], team TEXT[], custom_data JSONB` |
| `action_items` | Tasks linked to accounts and optionally opportunities | `id, account_id FK, opportunity_id FK nullable, title, priority, status, custom_data JSONB` |
| `stakeholders` | Contacts at client companies | `id, account_id FK, name, designation, influence, relationship` |

#### Activity / Audit Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `activities` | Append-only audit log of all mutations | `id, type, text, user_name, account_id FK, opportunity_id FK, created_at` |
| `comments` | User notes on accounts, opportunities, or action items | `id, target_type, target_id, user_name, text, created_at` |

`activities` is immutable — no `updated_at`, no `is_deleted`. Every service method
writes an activity row after mutating data.

#### Dynamic Custom Columns

| Table | Purpose |
|-------|---------|
| `custom_columns` | Schema definitions (key, name, type) per user per module — each user owns their own custom columns (`user_id FK → users`, `UNIQUE(user_id, key)`) |
| `accounts / opportunities / action_items`.`custom_data JSONB` | Runtime values for custom columns stored on each entity row |

When an entity is read, `custom_data` is spread into the response object so the frontend
can access `entity[columnKey]` transparently. When an entity is written, unknown fields
(not in the known-field set) are extracted and stored in `custom_data`.

#### UI Configuration

| Table | Purpose |
|-------|---------|
| `column_configs` | Per-user, per-module column visibility/order config stored as JSONB array; one row per `(user_id, module)` — the logged-in user is derived from the JWT server-side |

### Relationships

```
accounts ──< opportunities        (1:N, CASCADE DELETE)
accounts ──< action_items         (1:N, CASCADE DELETE)
accounts ──< stakeholders         (1:N, CASCADE DELETE)
accounts ──< activities           (1:N, SET NULL on delete)
opportunities ──< action_items    (1:N, SET NULL on delete)
opportunities ──< activities      (1:N, SET NULL on delete)
```

`comments` references `target_type + target_id` (string-based polymorphic reference)
rather than nullable FK columns, preserving the existing API contract.

### Naming Conventions

| Convention | Example |
|------------|---------|
| Table names | `snake_case`, plural | `action_items` |
| Column names | `snake_case` | `account_id`, `allocation_end_date` |
| API response fields | `camelCase` (mapped in service row-mappers) | `accountId`, `allocationEndDate` |
| PK | Always `id TEXT` | |
| FK | `{table_singular}_id` | `account_id`, `opportunity_id` |
| Timestamps | `created_at`, `updated_at` | |
| Soft-delete flag | `is_deleted BOOLEAN` | |

### Indexes

```sql
idx_opp_account     ON opportunities(account_id)        WHERE is_deleted = FALSE
idx_ai_account      ON action_items(account_id)         WHERE is_deleted = FALSE
idx_ai_opportunity  ON action_items(opportunity_id)     WHERE is_deleted = FALSE
idx_stk_account     ON stakeholders(account_id)         WHERE is_deleted = FALSE
idx_act_account     ON activities(account_id)
idx_act_created     ON activities(created_at DESC)
idx_cmt_target      ON comments(target_type, target_id)
idx_cc_module       ON custom_columns(module)
```

### Migration Strategy (JSON → PostgreSQL)

The migration was performed in-place:

1. `pg` package added to `backend/package.json`
2. `DatabaseService` rewritten: JSON file I/O removed, `pg.Pool` added, DDL embedded
3. All module services rewritten as `async` using parameterized SQL queries
4. Row-mapper functions convert `snake_case` DB columns → `camelCase` API responses
5. `custom_data JSONB` column introduced on `accounts`, `opportunities`, `action_items`
   to store dynamic custom-column values without schema changes
6. Activities now store real `TIMESTAMPTZ` instead of relative strings like `'Just now'`
7. Seed data migrated from `src/data/seed.ts` into the embedded `SEED` SQL constant in
   `DatabaseService`, run idempotently (`ON CONFLICT (id) DO NOTHING`) on every startup
8. `crm_db.json` and `src/data/seed.ts` removed

### Future Scalability Considerations

- **Row-Level Security**: `owner` field on accounts/opportunities is a string today; replace
  with a `users` table FK + PostgreSQL RLS policies for multi-user isolation.
- **Table partitioning**: `activities` is append-only and will grow unbounded — partition
  `RANGE (created_at)` by month at scale.
- **Full-text search**: Add `tsvector` GIN index on `accounts(name, description)` and
  `opportunities(name, description)` for global CRM search.
- **Junction tables**: `tags TEXT[]` and `team TEXT[]` on opportunities can be extracted to
  proper junction tables (`opportunity_tags`, `opportunity_team_members`) when tag-based
  filtering or team-member queries become performance bottlenecks.
- **Multi-tenancy**: Add `tenant_id TEXT NOT NULL` to all core tables and filter in every
  query to support multiple organisations in a single database.
- **Connection pooling**: For production, replace the local `pg.Pool` with PgBouncer or
  a managed connection pooler (e.g. Supabase Pooler, RDS Proxy).

---

## Known Issues

- **No deep-link support** — direct URL navigation restores to Dashboard.
- **Notifications/Administration** — hardcoded mock data.
- **`forbidNonWhitelisted: false`** in ValidationPipe — custom column keys are dynamic.
