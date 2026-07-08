# AccTrack Pro CRM — Production Deployment Guide

## 1. Purpose

This guide describes how to deploy the AccTrack Pro CRM application to a single on-premises Linux server for production use. It is written for the engineer performing the deployment and assumes the items in [IT_HANDOFF_CHECKLIST.md](IT_HANDOFF_CHECKLIST.md) have been provided by the IT infrastructure team.

The deployed architecture:

```
Users ──HTTPS:443──> Nginx ──┬── /            → static React build (/var/www/acctrack)
                             └── /api/*       → 127.0.0.1:3000 (NestJS, systemd service)
                                                      │
                                               PostgreSQL 16 (localhost:5432, db: crm_db)
                                                      │
                                               /var/lib/acctrack/uploads (documents, UPLOAD_DIR)
```

- **Frontend** — React 19 SPA compiled by Vite to static files, served directly by Nginx.
- **Backend** — NestJS 11 API compiled to JavaScript (`dist/`), run as a systemd service on localhost:3000, reachable only through the Nginx reverse proxy under `/api`.
- **Database** — PostgreSQL on the same host, localhost-only.

Frontend and API share one origin (`https://crm.company.local`), so browser CORS is not a factor in production.

Related documents: [INFRASTRUCTURE_REQUIREMENTS.md](INFRASTRUCTURE_REQUIREMENTS.md) (sizing, ports, versions) · [QUESTIONS_FOR_IT.md](QUESTIONS_FOR_IT.md).

---

## 2. Deployment Prerequisites

Before starting, confirm all of the following are in place:

| # | Prerequisite | Notes |
|---|--------------|-------|
| 1 | Linux server provisioned | Ubuntu 24.04 LTS (or approved equivalent), 4 vCPU / 8 GB RAM / 100 GB SSD, static IP |
| 2 | SSH access with sudo | For the deployment engineer |
| 3 | FQDN and DNS record | e.g. `crm.company.local` → server IP, resolvable from all user networks |
| 4 | TLS certificate + private key (PEM) | For the FQDN. **Mandatory** — auth cookies are `Secure` in production; login does not work over plain HTTP |
| 5 | Outbound internet (temporary) | For `apt` and `npm install`; or an internal npm mirror / offline artifact process |
| 6 | Application source code | Git repository access or a source archive |
| 7 | Generated secrets | `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, PostgreSQL app-user password — generated fresh (see §5.1), stored in the corporate vault |
| 8 | Firewall rules approved | 443/80 from user subnets, 22 from admin subnet, 3000/5432 blocked externally |

### Code fixes required before go-live

These issues exist in the current codebase and must be addressed as part of deployment (details in §8):

1. **Do not deploy the committed `backend/.env`** — it contains placeholder JWT secrets and a weak dev database password. The app now **fails fast at startup** if `JWT_SECRET` is missing, shorter than 32 chars, or still contains the `CHANGE-IN-PRODUCTION` placeholder (see §4.4).
2. **Add `trust proxy` to `backend/src/main.ts`** — one line; without it the per-IP rate limiter and audit logging misbehave behind Nginx (§8.1).
3. **Password-reset email is not implemented** — decide with IT: integrate SMTP first, or launch with admin-managed password resets.

> Development seed users (`*@enterprise.com` / `password123`) no longer reach production: they are created only by `npm run seed:dev` (which refuses to run with `NODE_ENV=production`), and migration `014_remove_dev_seed_users.sql` deletes any that exist in an older database.

---

## 3. Server Preparation

Run as a sudo-capable user. Commands are for Ubuntu 24.04; adapt for RHEL.

### 3.1 Install base packages

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install nginx postgresql-16 build-essential python3 curl git
```

`build-essential` and `python3` are required because `npm install` compiles the native `bcrypt` module.

### 3.2 Install Node.js 22 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt -y install nodejs
node -v   # v22.x
npm -v    # 10.x
```

### 3.3 Create the service user and directory layout

```bash
sudo useradd --system --home /opt/acctrack --shell /usr/sbin/nologin acctrack
sudo mkdir -p /opt/acctrack /var/www/acctrack /etc/acctrack /var/backups/acctrack
sudo chown -R acctrack:acctrack /opt/acctrack /var/backups/acctrack
```

### 3.4 Configure the host firewall

```bash
sudo ufw allow 22/tcp     # restrict source to admin subnet per site policy
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Ports 3000 (API) and 5432 (PostgreSQL) must **not** be opened — both services bind to localhost and are reached only via Nginx / local connections.

---

## 4. Database Configuration

### 4.1 Database creation

PostgreSQL 16 listens on localhost by default. Verify, then create a dedicated application role and database:

```bash
sudo grep listen_addresses /etc/postgresql/16/main/postgresql.conf   # expect: 'localhost'
sudo -u postgres psql
```

```sql
CREATE USER acctrack_app WITH PASSWORD '<GENERATED_DB_PASSWORD>';
CREATE DATABASE crm_db OWNER acctrack_app ENCODING 'UTF8';
\q
```

Design notes:

- `acctrack_app` **owns** `crm_db` but is not superuser. Ownership is required because the application creates and alters its own tables (see 4.2); it grants no rights on other databases.
- No PostgreSQL extensions are required — the schema uses `gen_random_uuid()`, built into PostgreSQL 13+.
- Authentication should be `scram-sha-256` for local TCP connections (`pg_hba.conf`; Ubuntu 24.04 default).

Verify connectivity as the app user:

```bash
psql "postgresql://acctrack_app:<PW>@localhost:5432/crm_db" -c "SELECT 1;"
```

### 4.2 Schema migration mechanism

There is **no separate migration tool or DBA script**. The backend runs versioned SQL migrations on every startup (`onModuleInit`):

- Migration files live in `backend/src/database/migrations/` (`001_initial_schema.sql` … `022_pe_custom_data.sql` at time of writing, and growing — check the directory for the current head) and are copied into `dist/` by `npm run build`.
- Applied versions are tracked in the `schema_migrations` table; each pending migration runs once, inside a transaction, in filename order.
- Statements are written idempotently (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) and migrations are backward compatible — they never drop or destructively rewrite user data.
- **Ignore `backend/migrations/`** (note: no `src/database/`) — it holds two dated files (`2026-07-04-date-driven-fiscal-model.sql`, `2026-07-04-operational-reporting-split.sql`) that duplicate migrations `004` and `011` verbatim. The migration runner never reads this directory; these files exist only as a hand-run reference for a centrally-managed-PostgreSQL scenario (§ QUESTIONS_FOR_IT.md #11) where a DBA runs DDL manually instead of the app. Do not run them against a database this app already manages — harmless (idempotent) but redundant and confusing.

So:

- **First startup** creates the full schema.
- **Every subsequent startup** (including after application upgrades) applies any new pending migrations automatically. No manual migration step exists in the release process.
- Take a `pg_dump` before every application upgrade regardless (see backup schedule in [INFRASTRUCTURE_REQUIREMENTS.md](INFRASTRUCTURE_REQUIREMENTS.md) §4).

### 4.3 Users in production

**No user accounts are seeded in production.**

- The dev-only seed script (`npm run seed:dev`) refuses to run when `NODE_ENV=production`, and migration `014_remove_dev_seed_users.sql` deletes the four legacy `*@enterprise.com` seed accounts from any database that still contains them (their business data is preserved — ownership FKs are `SET NULL`).
- User accounts are created through self-registration (`POST /api/auth/register`), which is **restricted to email addresses present in the `employee_master` table** and rejects duplicate registrations. Authorized emails are managed in the Administration → Employee Master screen (seeded initially by migration `013_employee_master.sql`).

### 4.4 Startup environment validation

Before any module initialises, `main.ts` validates the environment and refuses to start on error (`EnvValidation` log context):

- **Always required:** `DATABASE_URL` (must be a `postgresql://` URL), `JWT_SECRET`.
- **Required in production:** `FRONTEND_URL` (http/https URL), `UPLOAD_DIR` (must point outside the application directory); `JWT_SECRET` must be ≥ 32 chars and must not contain `CHANGE-IN-PRODUCTION`.
- **When set:** `PORT`, `BCRYPT_ROUNDS`, token expiry, lockout and DB-pool variables must be positive integers.

Watch the first startup in the journal to confirm validation, migrations, and readiness:

```bash
journalctl -u acctrack-api -f
# expect: [EnvValidation] NODE_ENV=production, DATABASE_URL=postgresql://acctrack_app:***@..., UPLOAD_DIR=/var/lib/acctrack/uploads ...
#         [EnvValidation] Environment validation passed
#         migration log lines (schema_migrations 001…014), then:
#         ✅ [CRM API] Running at http://localhost:3000/api
```

---

## 5. Application Configuration

### 5.1 Environment variables

Generate secrets first (run `openssl rand -base64 64 | tr -d '\n'` once per secret), then create `/etc/acctrack/backend.env`:

```ini
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://acctrack_app:<GENERATED_DB_PASSWORD>@localhost:5432/crm_db
FRONTEND_URL=https://crm.company.local
UPLOAD_DIR=/var/lib/acctrack/uploads

JWT_SECRET=<generated secret 1>
REFRESH_TOKEN_SECRET=<generated secret 2 — must differ from secret 1>

ACCESS_TOKEN_EXPIRY_SECS=900
REFRESH_TOKEN_EXPIRY_SECS=604800
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=15
BCRYPT_ROUNDS=12
```

| Variable | Purpose / production notes |
|----------|---------------------------|
| `NODE_ENV=production` | **Required.** Enables `Secure` auth cookies and disables dev behaviors (e.g. password-reset tokens written to logs). |
| `PORT` | API port on localhost, behind Nginx. |
| `DATABASE_URL` | Dedicated `acctrack_app` role — never the `postgres` superuser. |
| `FRONTEND_URL` | Exact browser origin (scheme + host, no trailing slash). Used for credentialed CORS. **Required in production** (startup fails without it). |
| `UPLOAD_DIR` | Directory for uploaded documents, **outside the application tree** so redeploys never touch it. **Required in production.** The systemd unit sets it to `/var/lib/acctrack/uploads` (created automatically by `StateDirectory=acctrack`). |
| `JWT_SECRET` / `REFRESH_TOKEN_SECRET` | Freshly generated, 64+ chars, distinct from each other. The values in the committed `.env` are placeholders and must not be used — startup fails if `JWT_SECRET` still contains the placeholder marker. |
| Remaining variables | Sensible defaults shown; tune per security policy. |

Frontend build-time variables (`frontend/.env.production`, created in §6.2):

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_API_URL` | *(empty)* | Same-origin deployment — Nginx proxies `/api`, so no cross-origin URL is needed. |
| `VITE_APP_TITLE` | `AccTrack Pro` | Browser title. |

### 5.2 Required directories

| Path | Purpose | Owner |
|------|---------|-------|
| `/opt/acctrack/app/` | Application source + builds (backend `dist/`) | `acctrack` |
| `/var/lib/acctrack/uploads/` | **Uploaded documents** (≤ 50 MB/file), path set by `UPLOAD_DIR`. Lives outside the application tree so redeploys never touch it. `/var/lib/acctrack` is **created automatically** by `StateDirectory=acctrack` in the service unit; the app creates the `uploads/` subdirectory on first start. Must be included in backups. | `acctrack` |
| `/var/log/acctrack/` | Winston rotating log files (`app-*.log`, `error-*.log`). **Created automatically** by the `LogsDirectory=acctrack` directive in the service unit — no manual `mkdir` required. | `acctrack` |
| `/var/www/acctrack/` | Frontend static build served by Nginx | `root` (read-only content) |
| `/etc/acctrack/` | Environment file with secrets | `acctrack` |
| `/var/backups/acctrack/` | Nightly `pg_dump` + uploads archives staging | `acctrack` |

The API writes structured JSON log files to `/var/log/acctrack/` (`app-YYYY-MM-DD.log` 14-day retention; `error-YYYY-MM-DD.log` 30-day retention) and also streams to **journald** (`journalctl -u acctrack-api`). Nginx logs to `/var/log/nginx/` with distro logrotate.

### 5.3 File permissions

```bash
# Secrets file: readable only by the service user
sudo chown acctrack:acctrack /etc/acctrack/backend.env
sudo chmod 600 /etc/acctrack/backend.env

# Application tree owned by the service user
sudo chown -R acctrack:acctrack /opt/acctrack/app

# Uploads (/var/lib/acctrack) are created by systemd StateDirectory= with the
# correct owner on first start — no manual mkdir/chmod needed. If migrating an
# existing install, move the old files once before the first start:
#   sudo mkdir -p /var/lib/acctrack/uploads
#   sudo mv /opt/acctrack/app/backend/uploads/* /var/lib/acctrack/uploads/ 2>/dev/null || true
#   sudo chown -R acctrack:acctrack /var/lib/acctrack

# Remove any stray dev .env — dotenv loads backend/.env if present and it would
# override nothing but confuse audits; the committed one contains dev placeholders
sudo rm -f /opt/acctrack/app/backend/.env

# Frontend static files: world-readable, owned by root
sudo chown -R root:root /var/www/acctrack
```

The `acctrack` user has no login shell and no sudo; the systemd unit (§6.4) adds sandboxing (`ProtectSystem`, `ProtectHome`, `NoNewPrivileges`) with `/var/lib/acctrack` (uploads) and `/var/log/acctrack` (logs) as the only writable paths.

---

## 6. Deployment Process

### 6.1 Backend deployment

```bash
# Get the code
sudo -u acctrack git clone <REPO_URL> /opt/acctrack/app    # or extract an archive here
cd /opt/acctrack/app/backend

# Apply the trust-proxy fix if not yet merged (see §8.1)

# Install dependencies and compile TypeScript → dist/
sudo -u acctrack npm ci          # use `npm install` if no package-lock.json is committed
sudo -u acctrack npm run build   # tsc -p tsconfig.build.json

# Uploads live in /var/lib/acctrack/uploads (UPLOAD_DIR) — created automatically
# by the systemd unit's StateDirectory= on first start; nothing to do here.
```

The runtime artifact is `dist/main.js`, started with plain `node` (production does not use ts-node/nodemon).

### 6.2 Frontend deployment

```bash
cd /opt/acctrack/app/frontend

cat > .env.production <<'EOF'
VITE_API_URL=
VITE_APP_TITLE=AccTrack Pro
EOF

npm ci
npm run build                    # tsc --noEmit && vite build → dist/

sudo rsync -a --delete dist/ /var/www/acctrack/
sudo chown -R root:root /var/www/acctrack
```

### 6.3 Reverse proxy configuration

Install the TLS certificate and key (e.g. under `/etc/ssl/acctrack/`), then create `/etc/nginx/sites-available/acctrack`:

```nginx
server {
    listen 80;
    server_name crm.company.local;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name crm.company.local;

    ssl_certificate     /etc/ssl/acctrack/crm.company.local.fullchain.pem;
    ssl_certificate_key /etc/ssl/acctrack/crm.company.local.key.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    # Document uploads are capped at 50 MB by the app; allow headroom
    client_max_body_size 60m;

    # ── API ──────────────────────────────────────────────
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # ── React SPA ────────────────────────────────────────
    root /var/www/acctrack;
    index index.html;

    # Hashed build assets: cache aggressively
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    # SPA fallback — all routes serve index.html (client-side routing)
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header Referrer-Policy strict-origin-when-cross-origin;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/acctrack /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 6.4 Service configuration

The production-ready unit file is maintained in the repository at [`deploy/acctrack-api.service`](../../deploy/acctrack-api.service) — install it rather than hand-writing one:

```bash
sudo cp /opt/acctrack/app/deploy/acctrack-api.service /etc/systemd/system/acctrack-api.service
```

Key properties of the unit:

- Runs `node dist/main.js` as the unprivileged `acctrack` user, secrets loaded from `/etc/acctrack/backend.env` (0600).
- `Environment=UPLOAD_DIR=/var/lib/acctrack/uploads` with `StateDirectory=acctrack` — uploads live outside the app tree, created and owned automatically, and survive redeploys.
- `LogsDirectory=acctrack` creates `/var/log/acctrack` for rotating log files.
- Restart on crash only (`Restart=on-failure`, 5 crashes/60 s limit), graceful `SIGTERM` shutdown.
- Full sandboxing: `ProtectSystem=strict`, `ProtectHome`, `NoNewPrivileges`, empty capability set, `SystemCallFilter=@system-service`, memory/file-descriptor/task limits. Verify with `systemd-analyze security acctrack-api`.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now acctrack-api
sudo systemctl status acctrack-api
journalctl -u acctrack-api -f    # watch first boot: env validation + migrations, then "Running at ..."
```

> **PM2 alternative:** if the team prefers PM2 over systemd — `npm i -g pm2`, `pm2 start dist/main.js --name acctrack-api`, `pm2 save`, `pm2 startup systemd`. Choose one process manager; do not run both.

---

## 7. Deployment Verification

Run after §6 completes:

1. **API liveness through the full proxy chain** (a `401 Unauthorized` also proves the stack is up):

   ```bash
   curl -i https://crm.company.local/api/accounts
   ```

2. **Frontend served:**

   ```bash
   curl -s https://crm.company.local/ | grep -i '<title>'
   ```

3. **Internal ports not exposed** — from a *different* machine:

   ```bash
   nmap -p 3000,5432 <server-ip>    # both must be closed/filtered
   ```

4. **Browser end-to-end:** open `https://crm.company.local` and register the first account using an email that is present in the `employee_master` whitelist (seeded by migration 013; managed later via Administration → Employee Master). Confirm registration is **rejected** for a non-whitelisted email, then log in and confirm the dashboard loads data.

   Also confirm startup validation and health in the journal / API:

   ```bash
   journalctl -u acctrack-api | grep EnvValidation   # "Environment validation passed"
   curl -s https://crm.company.local/health           # {"status":"ok","database":"connected",...}
   ```

5. **Cookies:** in browser dev tools, confirm `crm_access` / `crm_refresh` cookies are `HttpOnly`, `Secure`, `SameSite=Lax`. (If login fails while HTTP is used or `NODE_ENV` ≠ production, this is the cause.)

6. **Document upload:** upload a file on an account; confirm it succeeds and appears under `/var/lib/acctrack/uploads/`. Also confirm a renamed file (e.g. a `.zip` renamed to `.pdf`) is **rejected** — uploads are validated against magic bytes, not just the declared MIME type.

7. **SPA deep-link fallback:** browse to `https://crm.company.local/accounts` directly — Nginx must serve the app (HTTP 200), not a 404. (Note the app itself currently restores deep links to the Dashboard — a known limitation, §8.)

8. **Service resilience:** `sudo systemctl restart acctrack-api` and confirm it returns healthy; reboot the server once and confirm Nginx, PostgreSQL, and the API all come back automatically.

9. **Backups configured:** confirm the nightly `pg_dump` + uploads cron jobs exist (see [INFRASTRUCTURE_REQUIREMENTS.md](INFRASTRUCTURE_REQUIREMENTS.md) §4) and run one manually as a test.

---

## 8. Known Production Considerations

### 8.1 Must fix before go-live (blockers)

| # | Issue | Location | Action |
|---|-------|----------|--------|
| 1 | **Secrets committed to the repository** — `backend/.env` contains placeholder JWT secrets and DB password `postgres:1234` | `backend/.env` | Never deploy this file (deleted in §5.3). Generate fresh secrets; add `.env` to `.gitignore`; purge from git history if the repo is shared. |
| 2 | ~~Seeded default users with `password123`~~ **Resolved** | `seed.script.ts` / migration 014 | Dev seeding is `NODE_ENV=production`-guarded, and migration `014_remove_dev_seed_users.sql` deletes legacy seed accounts. Registration is gated by the `employee_master` whitelist. |
| 3 | **`trust proxy` not set** — behind Nginx every request appears to come from 127.0.0.1, so the 200 req/min **per-IP** throttle becomes one shared bucket for all users (effectively a self-inflicted denial of service under normal load), and auth audit logs record the proxy's IP instead of the client's | `backend/src/main.ts` | Add after `NestFactory.create(...)`: `app.getHttpAdapter().getInstance().set('trust proxy', 1);` |
| 4 | **Password-reset email not implemented** — reset tokens are only logged to the console outside production; in production the token is generated but delivered nowhere | `auth.service.ts` (~line 307) | Integrate SMTP before go-live, or launch with admin-managed password resets and hide the "Forgot password" UI. Decision tracked in [QUESTIONS_FOR_IT.md](QUESTIONS_FOR_IT.md) #12. |
| 5 | **No role-based access control is actually enforced anywhere.** A `RolesGuard` and `@Roles()` decorator exist (`auth/roles.guard.ts`, `auth/roles.decorator.ts`) but are never attached to any controller — grep confirms zero usages. The only global guard is `JwtAuthGuard` (authenticated vs not). Concretely: **any logged-in user, regardless of role** (Account Manager, Delivery Manager, Sales Manager, Practice Head), can call every endpoint under `EmployeeMasterController` (`/api/employee-master` — add/edit/delete the registration whitelist) and `AdministrationController` (`/api/administration`) — there is no admin/non-admin distinction at the API layer. | `employee-master.controller.ts`, `administration.controller.ts` | This is an authorization-boundary gap, not just a UI gap — a self-registered user could add an arbitrary email to `employee_master` and let anyone else register. Either add `@Roles('practice-head')` (or an equivalent admin role) + `@UseGuards(RolesGuard)` to both controllers before go-live, or explicitly accept the risk in writing with the business owner if all initial users are trusted. Do not rely on the frontend hiding the Administration menu — it is not an access control. |

### 8.2 Operational considerations

| # | Item | Notes |
|---|------|-------|
| 5 | `FRONTEND_URL` must exactly match the production origin | Credentialed, single-origin CORS. With the same-origin Nginx setup browsers never hit CORS, but set it correctly for any non-browser client. |
| 6 | Uploads directory is configured via `UPLOAD_DIR` (`/var/lib/acctrack/uploads` in production) | Lives outside the application tree, so redeploys never touch it. It must be backed up **together with** the DB dump — file metadata lives in the DB, bytes on disk. |
| 7 | `activities` table is append-only and grows unbounded | Fine initially; consider `RANGE (created_at)` partitioning at scale. Monitor DB size. |
| 8 | Single Node process, no clustering | Adequate for departmental load. Auth is stateless (JWT cookies), so if needed later, run multiple instances on different ports and load-balance in Nginx. |
| 9 | `forbidNonWhitelisted: false` in the ValidationPipe | Intentional — custom column keys are dynamic. Accepted, documented risk. |
| 10 | Known UI gaps (per project docs) | Deep links restore to Dashboard; XLSX export is an `alert()` placeholder; some notification/administration data is hardcoded. Not blockers — communicate to users. |
| 11 | Node.js / Nginx / PostgreSQL patching | Agree ownership and a maintenance window with IT (see [QUESTIONS_FOR_IT.md](QUESTIONS_FOR_IT.md) #4, #23). |

### 8.3 Redeployment procedure (application updates)

```bash
# 0. Safety: dump the DB first
pg_dump -Fc "postgresql://acctrack_app:<PW>@localhost:5432/crm_db" \
  > /var/backups/acctrack/pre_upgrade_$(date +%F).dump

# 1. Update code — uploads live in /var/lib/acctrack/uploads, outside this tree
cd /opt/acctrack/app && sudo -u acctrack git pull    # or extract new archive

# 2. Backend
cd backend && sudo -u acctrack npm ci && sudo -u acctrack npm run build
sudo systemctl restart acctrack-api                  # schema changes auto-apply on startup

# 3. Frontend
cd ../frontend && npm ci && npm run build
sudo rsync -a --delete dist/ /var/www/acctrack/
```

Expected downtime: the few seconds of the API restart. Verify with §7 steps 1–2 after every redeploy.

**Risk / improvement:** `git pull` / `rsync` in place overwrites the previous release with no automatic way to go back to it — see §9 below for what this costs you during rollback. Consider a releases-directory layout (`/opt/acctrack/releases/<timestamp>/`, with `/opt/acctrack/app` as a symlink to `current`) so rollback is an instant symlink swap instead of a re-checkout. Not implemented today; adopt it if redeploy frequency or risk tolerance warrants it.

---

## 9. Rollback Procedure

There is **no down-migration mechanism** — `MigrationRunner` (`backend/src/database/migration-runner.service.ts`) only ever applies new `.sql` files forward and records them in `schema_migrations`; it has no concept of reverting one. This shapes how rollback must work:

- **Code-only rollback** (the new release introduced an application bug but no new migration ran, or its migrations are purely additive and harmless to leave applied): reverting the code is sufficient.
- **Schema-incompatible rollback** (the new release's migration changed/removed something the old code needs, e.g. a renamed or dropped column): the old code will not run correctly against the upgraded schema. You must restore the pre-upgrade database dump, which loses any data written after the upgrade — there is no partial/selective undo.

### 9.1 Code-only rollback

```bash
# 1. Stop the service
sudo systemctl stop acctrack-api

# 2a. If deploying from git — check out the previous known-good commit/tag
cd /opt/acctrack/app
sudo -u acctrack git checkout <previous-good-commit-or-tag>

# 2b. If deploying from an archive — re-extract the previous release archive
#     (this is why keeping the last few release archives in /var/backups/acctrack
#     or similar is worth the disk space)

# 3. Rebuild
cd backend && sudo -u acctrack npm ci && sudo -u acctrack npm run build
cd ../frontend && npm ci && npm run build
sudo rsync -a --delete dist/ /var/www/acctrack/

# 4. Restart and verify
sudo systemctl start acctrack-api
journalctl -u acctrack-api -f    # confirm env validation + "all migrations up to date" + Running
```

Because migrations only ever move forward, `schema_migrations` still shows the newer version's migrations as applied even after the code rolls back. If those migrations were additive (new nullable column, new table, new index), the older code simply ignores the new column/table — harmless. Only revert the DB (§9.2) if the new migration changed something the old code actively depends on.

### 9.2 Full rollback with database restore

```bash
# 1. Stop the API so nothing writes to the DB during restore
sudo systemctl stop acctrack-api

# 2. Restore the pre-upgrade dump taken in §8.3 step 0
dropdb -U acctrack_app crm_db   # or: psql -c "DROP DATABASE crm_db" as a superuser
createdb -U acctrack_app crm_db -O acctrack_app
pg_restore -d "postgresql://acctrack_app:<PW>@localhost:5432/crm_db" \
  /var/backups/acctrack/pre_upgrade_<date>.dump

# 3. Roll back the application code (§9.1 steps 2–3)

# 4. Restore the uploads directory from the matching backup if the bad
#    release deleted/renamed files on disk (documents metadata and bytes
#    must stay consistent — see INFRASTRUCTURE_REQUIREMENTS.md §4)
sudo rsync -a --delete /var/backups/acctrack/uploads_<date>/ /var/lib/acctrack/uploads/

# 5. Start and verify
sudo systemctl start acctrack-api
journalctl -u acctrack-api -f
```

This is destructive to any data entered between the upgrade and the rollback — communicate that window to users before executing it.

---

## 10. Troubleshooting Guide

Always start with `journalctl -u acctrack-api -n 100 --no-pager` — `main.ts` logs environment validation, migration progress, and the final "Running at" line in order, so most failures are visible in the first screen of output.

| Symptom | Likely cause | Fix |
|---|---|---|
| Service fails instantly, log shows `Environment validation failed with N error(s)` | One of `DATABASE_URL` / `JWT_SECRET` is missing or malformed, or (in production) `FRONTEND_URL`/`UPLOAD_DIR` is missing, or `JWT_SECRET` is <32 chars or still contains `CHANGE-IN-PRODUCTION` | Read the exact error line (from `env.validation.ts`) and fix `/etc/acctrack/backend.env`. Then `sudo systemctl restart acctrack-api`. |
| `UPLOAD_DIR (...) is inside the application directory` warning | `UPLOAD_DIR` points inside `/opt/acctrack/app` | Point it at `/var/lib/acctrack/uploads` (or wherever `StateDirectory` created) — otherwise the next redeploy silently wipes uploaded documents. |
| `Error: DATABASE_URL environment variable is required` even though it's in the env file | `EnvironmentFile=` path wrong in the unit, or file not readable by `acctrack`, or a stray `backend/.env` in the app directory is shadowing it via `dotenv.config()` | `sudo -u acctrack cat /etc/acctrack/backend.env` to confirm readability; `sudo rm -f /opt/acctrack/app/backend/.env` (dotenv loads this first if present). |
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL not running, or listening on a different interface/port | `sudo systemctl status postgresql`; check `listen_addresses` in `postgresql.conf`. |
| `password authentication failed for user "acctrack_app"` | Wrong password in `DATABASE_URL`, or `pg_hba.conf` requires a different auth method for local TCP | Confirm the password matches what was set in `CREATE USER`; check `pg_hba.conf` has a `scram-sha-256` (or matching) rule for `host` connections from `127.0.0.1`. |
| `permission denied for schema public` / migration fails with a permissions error | `acctrack_app` is not the owner of `crm_db` | Re-run `ALTER DATABASE crm_db OWNER TO acctrack_app;` — ownership (not just `GRANT`s) is required because the app runs DDL. |
| Migration fails partway (`Migration NNN_xxx.sql failed — rolling back` in the log) | A SQL error in a specific migration file (e.g. hand-edited migration, or a manually-run copy from `backend/migrations/` already applied an equivalent change under a different mechanism, causing a conflict) | The failing migration was rolled back in its own transaction, but the process still exits (fail-fast) and systemd will restart-loop it (`StartLimitBurst=5`/60s) until fixed. Read the full SQL error in the log, fix the migration file or the DB state by hand, then `sudo systemctl reset-failed acctrack-api && sudo systemctl start acctrack-api`. |
| Service repeatedly restarts, then goes to `failed` state | 5 crashes within 60s tripped `StartLimitBurst` | Fix the underlying error first (see the crash reason above it in the journal), then `sudo systemctl reset-failed acctrack-api && sudo systemctl start acctrack-api`. |
| `curl https://.../api/accounts` → 502 Bad Gateway | Node process not listening on 127.0.0.1:3000 | `systemctl status acctrack-api`; `ss -ltnp | grep 3000` (should show `node`). Check `PORT` in the env file matches Nginx's `proxy_pass`. |
| Browsing `/accounts` directly returns Nginx's 404 | Missing SPA fallback | Confirm `location / { try_files $uri $uri/ /index.html; }` is present and `nginx -t && systemctl reload nginx` was run. |
| Large document upload fails with `413 Request Entity Too Large` from Nginx | `client_max_body_size` unset or too low | Set `client_max_body_size 60m;` (app's own limit is 50 MB, per `documents.service.ts`) inside the `server {}` block and reload Nginx. |
| Upload rejected with "content ... does not match its declared type" | Client sent a file whose bytes don't match its extension/MIME (e.g. a renamed file) — this is intentional, not a bug | Working as designed (`file-signature.util.ts` magic-byte check). Verify with a genuine file of that type. |
| Login succeeds over `curl` locally but the browser never gets a session / cookie not set | Site loaded over `http://`, or `NODE_ENV` isn't `production` on the server | Cookies use `Secure: NODE_ENV==='production'` (`auth.service.ts`) — they are silently dropped by the browser over plain HTTP. Confirm `NODE_ENV=production` in the env file and the site is served over HTTPS. |
| Ordinary users get logged out / rate-limited (`429 Too Many Requests`) far sooner than the documented 200 req/min, especially under moderate concurrent load | `app.set('trust proxy', ...)` is not called in `main.ts` — behind Nginx, every request's socket address is `127.0.0.1`, so Express's `req.ip` (which the global `ThrottlerGuard` keys on) collapses **all users into one shared bucket** | This is blocker #3 in §8.1 — add `app.getHttpAdapter().getInstance().set('trust proxy', 1);` in `main.ts` after `NestFactory.create(...)` and redeploy. (Note: this does *not* affect the `auth_audit_log` IP column — `auth.controller.ts`'s `clientIp()` already reads `X-Forwarded-For` manually, independent of Express's trust-proxy setting.) |
| Any logged-in user can add/remove emails in Administration → Employee Master | No role check exists on `EmployeeMasterController`/`AdministrationController` (see blocker #5 in §8.1) | Not a deployment misconfiguration — it's an application gap. Patch the controllers with `RolesGuard`/`@Roles()` or explicitly accept the risk before go-live. |
| `npm install` fails compiling `bcrypt` | Missing build toolchain | `sudo apt -y install build-essential python3` (Ubuntu) or `sudo dnf groupinstall "Development Tools"` (RHEL), then retry. |
| Nginx fails to start / reload after adding the site | Duplicate `server_name`/`default_server`, or a syntax error | `sudo nginx -t` prints the exact file/line; confirm `/etc/nginx/sites-enabled/default` was removed if it also binds port 443. |

---

## 11. Production Go-Live Checklist

Distinct from [IT_HANDOFF_CHECKLIST.md](IT_HANDOFF_CHECKLIST.md) (what IT must provide *before* deployment starts) — this is the final sign-off immediately before opening access to real users.

- [ ] `backend/.env` (the committed dev file, containing `postgres:1234` and placeholder JWT secrets) does **not** exist anywhere under `/opt/acctrack/app` — `/etc/acctrack/backend.env` is the only source of runtime config
- [ ] `JWT_SECRET` and `REFRESH_TOKEN_SECRET` are freshly generated (`openssl rand -base64 64`), ≥32 chars, different from each other, and do not contain `CHANGE-IN-PRODUCTION`
- [ ] `acctrack_app` PostgreSQL password is unique to this environment, not reused from dev
- [ ] `trust proxy` fix (§8.1 #3) is merged and deployed — verify by confirming rate limiting no longer collapses all users into one bucket under concurrent load
- [ ] RBAC gap (§8.1 #5) is either patched (`RolesGuard` applied to Employee Master / Administration controllers) or formally accepted as a risk by the business owner in writing
- [ ] Password-reset decision (§8.1 #4 / IT_HANDOFF §7) made and implemented: SMTP integrated, or "Forgot password" UI hidden with a documented admin-reset process
- [ ] `journalctl -u acctrack-api | grep EnvValidation` shows `Environment validation passed` with no warnings about `UPLOAD_DIR` being inside the app directory
- [ ] `journalctl -u acctrack-api | grep -i "migration"` shows all expected migrations applied (compare the count to `ls backend/src/database/migrations/*.sql | wc -l`) with none failed
- [ ] `curl -i https://<fqdn>/health` returns `{"status":"ok","database":"connected"}`
- [ ] `nmap -p 3000,5432 <server-ip>` from a separate host shows both ports closed/filtered
- [ ] Cookies inspected in a real browser: `crm_access`/`crm_refresh` are `HttpOnly`, `Secure`, `SameSite=Lax`
- [ ] Registration correctly rejects an email not present in `employee_master`, and succeeds for one that is
- [ ] A renamed file upload (e.g. `.zip` renamed to `.pdf`) is rejected; a genuine file of the declared type succeeds and appears under `/var/lib/acctrack/uploads/`
- [ ] SPA deep link (`/accounts`, `/opportunities/:id`, etc.) loads via direct browser navigation, not just in-app routing
- [ ] `systemctl restart acctrack-api` and a full server reboot both result in Nginx, PostgreSQL, and the API auto-recovering with no manual intervention
- [ ] Nightly `pg_dump` + uploads backup cron jobs exist and one manual run has been verified end-to-end (including a test restore into a scratch database)
- [ ] Monitoring/alerting is wired to at least: `acctrack-api` restarts, disk usage on `/var/lib/acctrack` and the PostgreSQL data directory, and TLS certificate expiry
- [ ] `systemd-analyze security acctrack-api` reviewed — no unexpected `UNSAFE` items beyond what the unit file already accepts
- [ ] Rollback plan (§9) reviewed with whoever is on-call for the first week of go-live
