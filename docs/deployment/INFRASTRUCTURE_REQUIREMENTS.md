# AccTrack Pro CRM — Infrastructure Requirements

**Audience:** IT Infrastructure team
**Scope:** Single on-premises Linux server hosting the React frontend (static files via Nginx), the NestJS API (Node.js service), and PostgreSQL.

---

## 1. Server Requirements

### Operating System

| Item | Requirement |
|------|-------------|
| Recommended OS | **Ubuntu Server 24.04 LTS** (alternatives: Ubuntu 22.04 LTS, RHEL 9 / Rocky Linux 9) |
| Architecture | x86_64 (arm64 also supported by all components) |
| Kernel/security | SELinux (RHEL) or AppArmor (Ubuntu) may stay enforcing; standard contexts suffice |

### Hardware Sizing

| Profile | vCPU | RAM | Storage | Suitable for |
|---------|------|-----|---------|--------------|
| Minimum | 2 | 4 GB | 50 GB SSD | Pilot / < 25 concurrent users |
| **Recommended** | **4** | **8 GB** | **100 GB SSD** | Typical departmental use, headroom for DB + uploads |
| Growth | 8 | 16 GB | 200+ GB SSD | Large user base, heavy document uploads |

Notes:
- The API is a single Node.js process (~150–300 MB RSS). PostgreSQL benefits most from extra RAM.
- Document uploads (max 50 MB/file) are stored on local disk and grow unbounded — size the storage and monitor it.
- The `activities` audit table is append-only and grows indefinitely; plan for DB growth.

### Network

| Item | Requirement |
|------|-------------|
| Static IP | Required (internal), reachable by all CRM users |
| DNS | Internal DNS A record, e.g. `crm.company.local` → server IP |
| Bandwidth | Standard LAN; initial page load ~2–3 MB, API payloads are small JSON |
| Outbound internet | Only needed at **build/install time** (npm registry, OS packages). Runtime requires no outbound access. If the server is fully air-gapped, artifacts must be built on a connected machine and copied over. |

### Open Ports (firewall)

| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 443 | TCP | User LAN/VPN subnets | HTTPS — the only user-facing port |
| 80 | TCP | User LAN/VPN subnets | HTTP → HTTPS redirect only |
| 22 | TCP | Admin/bastion subnet only | SSH administration |
| 3000 | TCP | **localhost only** — do NOT expose | NestJS API (Nginx proxies to it) |
| 5432 | TCP | **localhost only** — do NOT expose | PostgreSQL |

### SSL/TLS

- HTTPS is **mandatory**, not optional: the app sets `Secure` auth cookies when `NODE_ENV=production`, so **login will not work over plain HTTP** in production mode.
- Certificate options (pick one):
  1. Certificate from the **internal enterprise CA** for `crm.company.local` (typical for on-prem) — must be trusted by all user browsers/devices.
  2. Public CA cert (e.g. Let's Encrypt) if a public DNS name resolves internally.
- TLS terminates at Nginx. TLS 1.2+ only. Provide cert + key + chain in PEM format, plus the renewal process/owner.

---

## 2. Software Prerequisites

| Software | Version | Notes |
|----------|---------|-------|
| **Node.js** | **22 LTS** (minimum 20 LTS) | NestJS 11 requires Node ≥ 20. Install via NodeSource repo or nvm for the service user. |
| **npm** | v10+ (bundled with Node) | Project uses npm (`package-lock.json` conventions); yarn/pnpm not required. |
| **PostgreSQL** | **16** (minimum 13) | 13+ required — schema uses `gen_random_uuid()`, built into PG 13+. No extensions needed on 13+; on older versions `pgcrypto` would be required (don't use older versions). |
| **Nginx** | 1.24+ (distro package) | Serves frontend static files, terminates TLS, reverse-proxies `/api` to the Node process. Apache httpd works too but Nginx is recommended. |
| **systemd** | (part of OS) | **Recommended** process manager for the API — see deployment guide for the unit file. PM2 is an acceptable alternative if the team prefers it (`npm i -g pm2`), but adds a global dependency. |
| **Git** | any recent | Only needed if deploying from a repository; not needed if artifacts are copied as archives. |
| Build tools | `build-essential` (Ubuntu) / `Development Tools` (RHEL) + `python3` | Required for `npm install` to compile the native `bcrypt` module. |
| Misc | `curl`, `unzip`, `logrotate` (usually preinstalled) | Operational tooling. |

No Redis, no message broker, no container runtime required. Docker is **not** used by this project.

---

## 3. Environment Requirements

### Backend environment variables (`/etc/acctrack/backend.env` or `backend/.env`)

| Variable | Required | Example / Production value | Notes |
|----------|----------|---------------------------|-------|
| `NODE_ENV` | **Yes** | `production` | Enables `Secure` cookies; suppresses dev-only behavior (e.g. password-reset tokens being written to logs). |
| `PORT` | Yes | `3000` | API listen port (localhost, behind Nginx). |
| `DATABASE_URL` | **Yes** | `postgresql://acctrack_app:<STRONG_PW>@localhost:5432/crm_db` | Use a dedicated DB user, **not** `postgres`. |
| `FRONTEND_URL` | **Yes** | `https://crm.company.local` | Exact browser origin; used for CORS with credentials. Must match the site URL exactly (scheme + host, no trailing slash). |
| `JWT_SECRET` | **Yes — generate** | 64+ random chars | Signs access JWTs. The value in the repo is a placeholder and **must be replaced**. |
| `REFRESH_TOKEN_SECRET` | **Yes — generate** | 64+ random chars, different from `JWT_SECRET` | Signs/derives refresh tokens. |
| `ACCESS_TOKEN_EXPIRY_SECS` | No | `900` (15 min) | |
| `REFRESH_TOKEN_EXPIRY_SECS` | No | `604800` (7 days) | |
| `MAX_LOGIN_ATTEMPTS` | No | `5` | Account lockout threshold. |
| `LOCKOUT_DURATION_MINUTES` | No | `15` | |
| `BCRYPT_ROUNDS` | No | `12` | Password hash cost. |

**Secrets to generate** (never reuse the committed placeholders):

```bash
# Run twice — once per secret
openssl rand -base64 64 | tr -d '\n'
```

Also generate: PostgreSQL `acctrack_app` user password.

### Frontend build-time variables (`frontend/.env.production`)

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_API_URL` | *(leave empty)* | Recommended setup serves frontend and API from the **same origin** via Nginx (`/api` proxied), so no cross-origin URL is needed. |
| `VITE_APP_TITLE` | `AccTrack Pro` | Browser title. |

### Filesystem locations

| Path | Purpose | Notes |
|------|---------|-------|
| `/opt/acctrack/backend/` | Backend code + `dist/` build | Owned by service user `acctrack`. |
| `/opt/acctrack/backend/uploads/` | **Uploaded documents** (PDF/Office/images/zip, ≤ 50 MB each) | Path is fixed relative to the app directory. Must be writable by the service user, persisted across deployments (do not wipe on redeploy), and included in backups. |
| `/var/www/acctrack/` | Frontend static build (`dist/` contents) | Read-only for Nginx. |
| `/etc/acctrack/backend.env` | Environment file with secrets | `chmod 600`, owned by `acctrack`. |
| `/var/log/acctrack/` | API stdout/stderr if using file logging; with systemd, logs go to **journald** | The app logs to stdout (request logging interceptor + Nest logger). Use `journalctl -u acctrack-api`. |
| `/var/log/nginx/` | Nginx access/error logs | Rotated by distro logrotate. |
| `/var/backups/acctrack/` | DB dumps + uploads backup staging | See backup section. |

---

## 4. Database Requirements

### Setup

- PostgreSQL 16 installed locally, listening on `localhost:5432` only (`listen_addresses = 'localhost'`).
- Database: `crm_db` (UTF8).
- Authentication: `scram-sha-256` in `pg_hba.conf` for local TCP connections.

### Database user and permissions

The application **runs its own DDL migrations and seeding on startup** (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, idempotent seed inserts). The app user therefore needs schema-level create rights — but not superuser:

```sql
CREATE USER acctrack_app WITH PASSWORD '<STRONG_PW>';
CREATE DATABASE crm_db OWNER acctrack_app ENCODING 'UTF8';
```

Making `acctrack_app` the database owner is the simplest correct setup: it can create/alter its own tables but has no rights on other databases and is not superuser.

### Extensions

- **None required on PostgreSQL 13+.** The schema uses `gen_random_uuid()`, which is built-in since PG 13.

### Migration / seed process

- **No separate migration step.** On every startup (`DatabaseBootstrap.onModuleInit`) the API runs any pending versioned SQL migrations from `backend/src/database/migrations/` (currently `001_initial_schema.sql` … `022_pe_custom_data.sql`, and growing) tracked in a `schema_migrations` table, then backfills a few FK columns. This creates the full schema on first run and applies only new files on every subsequent run.
- **No user accounts are created automatically, in development or production.** The 4 sample users (john.smith@ / sarah.johnson@ / mike.brown@ / lisa.davis@ `enterprise.com`, password `password123`) are only inserted by the separate, manually-invoked `npm run seed:dev` script — which itself refuses to run when `NODE_ENV=production`. Do not run `seed:dev` against the production database.
- In production, the **only** way to create a user is self-registration (`POST /api/auth/register`), which is rejected unless the email is present in the `employee_master` table (seeded initially by migration `013_employee_master.sql`, managed afterwards via Administration → Employee Master).
- Migration `014_remove_dev_seed_users.sql` deletes the 4 legacy `*@enterprise.com` accounts from any database that still has them (from earlier dev/test use), preserving their business data via `SET NULL` ownership.
- Subsequent startups are idempotent; redeployments require no DB action.
- Two extra files live in `backend/migrations/` (note: different path — no `src/database/`, dated filenames): `2026-07-04-date-driven-fiscal-model.sql` and `2026-07-04-operational-reporting-split.sql`. These are **not read by the migration runner** (which only scans `backend/src/database/migrations/`) and duplicate migrations `004` and `011` verbatim. They exist only as a hand-run reference for a scenario where DDL must be executed by a DBA against a centrally managed PostgreSQL instance instead of by the app (see Q11 in `QUESTIONS_FOR_IT.md`). If that scenario doesn't apply, they are inert and can be ignored — do not run them against a database the app already manages, since they are redundant (harmless due to `IF NOT EXISTS`/idempotency, but confusing).

### Backup and restore

| Item | Recommendation |
|------|----------------|
| Logical backup | Nightly `pg_dump -Fc crm_db` (custom format), retain 14–30 days |
| Uploads backup | Nightly rsync/tar of `/opt/acctrack/backend/uploads/` — **DB and uploads must be backed up together** (document metadata lives in the DB, file bytes on disk) |
| Off-server copy | Ship both to NAS/backup server — a backup on the same disk is not a backup |
| Restore test | Quarterly restore drill into a scratch database |
| Restore command | `pg_restore -d crm_db --clean --if-exists backup.dump` then restore the uploads directory |
| PITR (optional) | For stricter RPO, enable WAL archiving (e.g. pgBackRest); nightly dumps give up to 24 h data-loss window |

Example cron (run as `postgres` / `acctrack`):

```cron
15 1 * * * pg_dump -Fc crm_db > /var/backups/acctrack/crm_db_$(date +\%F).dump
30 1 * * * tar czf /var/backups/acctrack/uploads_$(date +\%F).tar.gz -C /opt/acctrack/backend uploads
45 1 * * * find /var/backups/acctrack -mtime +21 -delete
```

---

## 5. Service Accounts

| Account | Type | Purpose |
|---------|------|---------|
| `acctrack` | Linux system user (no login shell, no sudo) | Runs the Node API service; owns `/opt/acctrack` and `uploads/` |
| `acctrack_app` | PostgreSQL role | Application DB access (owner of `crm_db`) |
| Deploy user | Linux user with sudo (or CI deploy key) | Performs deployments; separate from the runtime user |

---

## 6. Monitoring & Logging Expectations

- **Process**: systemd auto-restart (`Restart=always`); alert on repeated restarts.
- **Health check**: `GET https://crm.company.local/api/...` (any authenticated 401 response proves the API is up); or TCP check on 127.0.0.1:3000 locally. Ask the dev team to add a dedicated unauthenticated `/api/health` endpoint if the monitoring platform needs one (see questions doc).
- **Logs**: API request logs → journald; Nginx access/error logs → `/var/log/nginx/`. Forward to the central log platform (Wazuh/Graylog/Splunk/ELK) if one exists.
- **Metrics to watch**: disk usage (uploads + DB + WAL), memory, DB connections, 5xx rate in Nginx logs, backup job success.
