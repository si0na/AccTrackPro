# AccTrack Pro CRM — Questions for the IT Team (Pre-Deployment)

Please answer before we schedule deployment. Grouped by topic; the **bold** ones are blocking.

## Server & OS

1. **Which Linux distribution/version is your standard for application servers** (we recommend Ubuntu 24.04 LTS; RHEL 9 also fine)?
2. **Can you provision a VM with 4 vCPU / 8 GB RAM / 100 GB SSD?** If not, what is available?
3. Is the server allowed **temporary outbound internet access** for `npm install` during builds, or do you require an internal npm mirror / offline artifact transfer?
4. Who owns OS patching and reboots for this server, and what is the maintenance window?

## Network, DNS & TLS

5. **What FQDN should the CRM use** (e.g. `crm.company.local`)? We need it before building the frontend and issuing the certificate.
6. **Can you issue a TLS certificate for that FQDN from the internal CA** (or provide a public cert)? HTTPS is mandatory — login cookies are `Secure` and will not work over HTTP.
7. Is the internal CA root already trusted on all employee devices (Windows/macOS/mobile)?
8. Which user networks (subnets, VPN ranges) need access, for firewall rule scoping?
9. Any corporate policy requiring a central reverse proxy / WAF in front of the server, or may Nginx on the host terminate TLS?

## Database

10. **May we run PostgreSQL 16 locally on the same server** (recommended), or must we use a centrally managed PostgreSQL instance? If central: connection details, version (must be ≥ 13), and whether the app role can own its database (the app runs its own DDL migrations on startup).
11. Any DBA policies that forbid applications executing DDL (`CREATE TABLE`) at runtime? If so, we need to discuss exporting the schema for a one-time DBA-run script.

## Email / SMTP

12. **Is an internal SMTP relay available** (host, port, TLS, auth, permitted from-address)? Context: the app's password-reset flow currently has no email delivery — we will either integrate SMTP before go-live or launch with admin-managed password resets. Which do you prefer?

## Backups

13. What backup infrastructure exists (NAS target, backup agent, Veeam, etc.) that we should ship nightly `pg_dump` + uploads archives to?
14. What retention period does policy require for business data backups?
15. Who owns/verifies backup jobs and periodic restore tests?

## Monitoring & Logging

16. What monitoring platform is in use (Zabbix/PRTG/Nagios/Prometheus/other), and can it do HTTPS checks + disk/service alerts on this server? Do you need a dedicated unauthenticated `/api/health` endpoint from us?
17. Is centralized log collection required (Splunk/ELK/Wazuh)? If yes, how do we forward journald + Nginx logs?

## Access & Security

18. How should the deployment engineer get access — named SSH account via bastion/VPN? Key-based only?
19. Where should application secrets (JWT secrets, DB password) be stored — which corporate vault?
20. Does security require a vulnerability scan or pentest before go-live, and what lead time is needed?
21. Are there compliance constraints on where CRM data (customer/opportunity/financial data, uploaded documents) may reside or who may access the server?

## Operations

22. Who is on-call / responsible for this server after go-live (restarts, disk alerts), and what is the escalation path to the dev team?
23. What is the agreed maintenance window for application updates (we redeploy with ~1–2 min of downtime)?
