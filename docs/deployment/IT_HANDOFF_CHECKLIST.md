# AccTrack Pro CRM — IT Handoff Checklist

Everything the IT infrastructure team must provide **before** deployment can start.
Reference docs: [INFRASTRUCTURE_REQUIREMENTS.md](INFRASTRUCTURE_REQUIREMENTS.md) · [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

## 1. Server & Access

- [ ] Linux server provisioned — Ubuntu 24.04 LTS (or approved equivalent), 4 vCPU / 8 GB RAM / 100 GB SSD
- [ ] Static internal IP assigned
- [ ] SSH access for the deployment engineer(s) — named accounts, key-based auth, sudo rights
- [ ] Temporary **outbound internet access** (or an internal npm mirror / approved artifact-transfer process) for `npm install` during build
- [ ] OS patching schedule / responsibility agreed

## 2. Domain / DNS

- [ ] FQDN decided (e.g. `crm.company.local`) — needed **before** cert issuance and frontend build
- [ ] Internal DNS A record created → server IP
- [ ] Confirmed resolvable from all user networks (office LAN, VPN)

## 3. SSL/TLS Certificate

- [ ] Certificate issued for the FQDN (internal CA or public CA) — **mandatory: the app's auth cookies require HTTPS**
- [ ] Full chain + private key delivered in PEM format
- [ ] If internal CA: root CA already trusted on all user devices (verify on a test machine)
- [ ] Renewal owner & process defined (expiry reminder / automation)

## 4. Firewall Rules

- [ ] Inbound 443 (and 80 for redirect) allowed from user subnets/VPN
- [ ] Inbound 22 restricted to admin/bastion subnet
- [ ] Ports 3000 (API) and 5432 (PostgreSQL) confirmed **blocked externally** — localhost only
- [ ] Host firewall (ufw/firewalld) enabled and rules approved by security

## 5. Reverse Proxy

- [ ] Nginx approved as the web server / TLS terminator on this host
- [ ] `client_max_body_size 60m` acceptable (document uploads up to 50 MB)
- [ ] Config in deployment guide §5 reviewed (SPA fallback + `/api` proxy + `X-Forwarded-For`)

## 6. Database

- [ ] PostgreSQL 16 installed locally (or approved managed/central PG instance reachable from the server)
- [ ] Database `crm_db` creation approved; dedicated role `acctrack_app` as owner (no superuser)
- [ ] Strong DB password generated and stored in the password vault
- [ ] Note: the app auto-runs DDL migrations + seed on startup — no DBA-run scripts required

## 7. SMTP / Email

- [ ] **Decision required:** password-reset email is *not yet implemented* in the app. Choose:
  - [ ] Option A — provide SMTP relay details (host, port, auth, allowed sender address) and schedule dev work to integrate it, **or**
  - [ ] Option B — go live without email; administrators reset passwords manually (document the process, disable "Forgot password" UI)

## 8. File Storage

- [ ] Local disk approved for document uploads (`/opt/acctrack/backend/uploads/`), ≤ 50 MB per file
- [ ] Disk-usage monitoring/alerting on that volume
- [ ] Uploads directory explicitly excluded from any redeploy cleanup scripts

## 9. Backup Strategy

- [ ] Nightly `pg_dump` of `crm_db` scheduled
- [ ] Nightly backup of `uploads/` directory (must be captured together with the DB dump)
- [ ] Off-server backup target provided (NAS/backup server) + retention policy (suggested 14–30 days)
- [ ] Quarterly restore test scheduled and owned

## 10. Monitoring & Logging

- [ ] Uptime check on `https://<fqdn>/` and `https://<fqdn>/api/...` (401 = alive)
- [ ] Alerts: service restarts (`acctrack-api`), disk > 80 %, backup failures, cert expiry
- [ ] Log forwarding (journald + Nginx logs) to central platform, if required by policy
- [ ] logrotate confirmed for Nginx logs (journald handles API logs)

## 11. User / Service Accounts

- [ ] Linux system user `acctrack` (no shell, no sudo) approved for running the API
- [ ] Deploy user/account defined (separate from runtime user)
- [ ] PostgreSQL `acctrack_app` role created
- [ ] Secrets (`JWT_SECRET`, `REFRESH_TOKEN_SECRET`, DB password) generated and stored in the corporate vault
- [ ] No accounts are seeded in production — the first admin registers via `/register` using an email already present in `employee_master` (seeded by migration 013; confirm the initial employee list with the business owner before go-live)

## 12. Security Requirements

- [ ] Security team sign-off on: single-server architecture, localhost-only DB, JWT-cookie auth (HttpOnly/Secure/SameSite=Lax), bcrypt-12 password hashing, rate limiting (200 req/min/IP)
- [ ] Vulnerability-scan / pentest scheduling (if required before go-live)
- [ ] Patching policy for Node.js, Nginx, PostgreSQL agreed
- [ ] Confirmation that `.env` secrets never enter the git repository
- [ ] VPN/network-segmentation requirements for CRM access confirmed
