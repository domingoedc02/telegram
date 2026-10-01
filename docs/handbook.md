# TG developer onboarding handbook

Mirrors ORBIT issue TG-21. Source of truth is the ORBIT issue; this file is a static mirror for anyone browsing the repo without ORBIT access, and is updated whenever TG-21 is revised.

## Overview

TG is a self-hosted, Slack/Discord-style team messenger for one client org (~50 people) — the client owns its data/hosting, no per-seat SaaS fees. The product's user-facing name is **Enlinka Chat** (`answer/branding-cutover`) — every screen, email and push title says "Enlinka Chat"; the project key/repo/DB/file naming stays **TG**/`tg`. It runs on the client's Dokploy host: one `app` container (React SPA + Fastify API + WS gateway), dedicated Postgres 16, dedicated Redis 7, TLS via Traefik/Let's Encrypt, daily backups to off-host MinIO. MVP: invite-based auth, DMs, public/private channels, threads, real-time delivery, own-message edit/soft-delete + admin moderation, Web Push, an admin console (audit log, weekly-active), automated backups. Full detail: `spec/overview`.

## Target audience

A single client org, ~50 teammates, all potentially concurrent, on evergreen Chrome/Safari/Firefox/Edge (desktop+mobile). No external users, multi-tenancy, billing or SSO. Two roles: **Member** (chat, DM, channels, threads, own edit/delete, push) and **Admin** (Member plus invites, deactivation, role changes, any-message delete, audit log, weekly-active) — ≥2 admins at launch. A **Sponsor** is the client's scope decision-maker, possibly also an admin. Success: ≥80% weekly-active (≥1 msg incl. thread replies, rolling 7 days) from cutover; old tool retired within 1 month. Full detail: `spec/overview`.

## Features

MoSCoW, signed off 2026-10-01 (threads elevated to Must at sign-off):

- **Must:** invite-by-email auth (SMTP+copy-link fallback), login/reset; 1:1/group DMs; public/private channels, default `#general`; threads; real-time WS (typing, presence, reconnect+backfill); sender edit/soft-delete + admin moderation; Web Push (VAPID) per setting; admin console (roles, moderation, audit log, weekly-active); **staging (committed for MVP)**; daily automated Postgres backups (14-day, off-host, tested restore).
- **Should:** file/image sharing, search. **Could:** emoji reactions.
- **Won't:** voice/video, E2E encryption, SSO, formal compliance certification. Full detail: `spec/overview`.

## Tech stack

| Layer            | Choice                                          | Version           |
| ---------------- | ----------------------------------------------- | ----------------- |
| Runtime/language | Node.js/TypeScript                              | 22 LTS/5.6        |
| Monorepo         | pnpm workspaces                                 | 9.12+             |
| Frontend         | React + Vite                                    | 19.0/6.x          |
| HTTP             | Fastify (+helmet/cors/rate-limit/cookie/static) | 5.x               |
| WebSocket        | `ws`                                            | 8.18              |
| Database         | PostgreSQL + Drizzle ORM/drizzle-kit            | 16/0.36/0.28      |
| Cache/pubsub     | Redis + `ioredis`                               | 7.x/5.4           |
| Validation       | `zod`                                           | 3.23              |
| Passwords        | `argon2` (argon2id)                             | 0.41              |
| Mail             | `nodemailer`                                    | 6.9               |
| Push             | `web-push` (VAPID)                              | 3.6               |
| Logging          | `pino`                                          | 9.5               |
| Containers       | Docker, `node:22-alpine`                        | —                 |
| Tests            | vitest/supertest/testing-library/playwright     | 2.1/7.0/16.x/1.48 |

Full detail: `spec/architecture`, `decision/tech-stack`.

## File structure

pnpm workspace monorepo, `apps/*` + `packages/*`:

```
tg/
  apps/web/src/{main.tsx,app.tsx,sw.ts,pages/,components/,features/{auth,channels,messages,threads,presence,push,admin}/,lib/{api-client,ws-client,storage}.ts}
  apps/server/src/{server.ts,main.ts,config/env.ts,db/{client.ts,schema/*.ts,migrations/},modules/{auth,invites,users,channels,messages,threads,presence,push,audit}/<module>.{routes,service,schemas,repository,test}.ts,ws/{gateway,envelope}.ts,middleware/{request-id,session,csrf,authz,rate-limit,error-handler}.ts,jobs/,lib/{mailer,push-sender,logger}.ts}
  packages/shared/src/{dto/,ws-envelope/,domain/}   # types + zod, no I/O
  infra/docker/{Dockerfile.app,Dockerfile.backup}
  infra/compose/{docker-compose.yml,docker-compose.prod.yml}
  infra/backup/{backup.sh,restore-runbook.md}
  .env.example, pnpm-workspace.yaml, package.json
```

Rules: `apps/web` never touches Postgres/Redis directly; `apps/server` never imports React; `packages/shared` holds only types/zod/constants, no I/O; a module's `*.service.ts` alone calls another module's service; `ws/gateway.ts` is the sole holder of live sockets. Naming: `kebab-case` files, `snake_case` DB tables. Full detail: `spec/file-structure`.

## Getting started

Prereqs: Node 22.x LTS, pnpm 9.12+, Docker ≥25 + Compose v2.29+, Git ≥2.40, a modern browser.

```
git clone <repo-url> tg && cd tg
corepack enable && corepack prepare pnpm@9.12.3 --activate
cp .env.example .env               # fill DATABASE_URL, REDIS_URL, SESSION_SECRET, SMTP_*, VAPID_*, MINIO_*
docker compose -f infra/compose/docker-compose.yml up -d   # postgres, redis, minio, mailpit
pnpm install
pnpm --filter server run db:migrate
pnpm --filter server run bootstrap:admin -- --email admin@local.test --password ChangeMe123!
pnpm --filter server run seed:demo      # optional
pnpm dev                                 # server (tsx watch) + web (vite)
```

`pnpm dev`: web at `:5173` (proxies `/api`,`/ws` to `:3000`), server at `:3000`. Local services: Postgres, Redis, MinIO (`:9001`), Mailpit (`:8025`, no real SMTP needed). Commands: `pnpm build|lint|typecheck|test`/`db:generate`/`db:migrate` (root); others via `pnpm --filter server run <script>`. Compose file: `infra/compose/docker-compose.yml`. Troubleshooting: `spec/setup`.

## Environment & secrets

Read from `process.env`/`dotenv` in dev, injected as Dokploy env in prod — never baked into the image.

| Var                                            | Secret?       | Notes                                                                                                                                                                                                             |
| ---------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                     | No            | `development`\|`production`; identical (`production`) on staging+prod — build/runtime behavior only                                                                                                               |
| `APP_ENV`                                      | No            | `development`\|`staging`\|`production`, independent of `NODE_ENV` (`decision/staging-seed-env`); `seed:demo` refuses only when `APP_ENV==='production'`, so it still runs on staging                              |
| `APP_URL`                                      | No            | base URL for links, cookie domain, CORS/CSP origin                                                                                                                                                                |
| `PORT`                                         | No            | default 3000, one HTTP+WS port                                                                                                                                                                                    |
| `DATABASE_URL`                                 | **Yes**       | Postgres DSN                                                                                                                                                                                                      |
| `REDIS_URL`                                    | if pw'd       | sessions/presence/pub-sub                                                                                                                                                                                         |
| `SESSION_SECRET`                               | **Yes**       | HMAC-signs session cookie; `openssl rand -hex 32`                                                                                                                                                                 |
| `SMTP_HOST/PORT/SECURE/USER/PASS`, `MAIL_FROM` | `PASS` yes    | client's own SMTP; `MAIL_FROM` = `"Enlinka Chat <notifications@acme.com>"`                                                                                                                                        |
| `VAPID_PUBLIC/PRIVATE_KEY/SUBJECT`             | private yes   | `pnpm dlx web-push generate-vapid-keys`                                                                                                                                                                           |
| `VITE_APP_URL`/`VITE_VAPID_PUBLIC_KEY`         | No            | build-time only, public — baked into the `apps/web` bundle (TG-11)                                                                                                                                                |
| `CUTOVER_DATE`                                 | No            | ISO date, optional (`decision/weekly-active-cutover`); unset ⇒ weekly-active panel's pilot view measures from the first user's creation; set ⇒ measures from that date; redeploy to change, no admin UI by design |
| `MINIO_ENDPOINT/BUCKET/ACCESS/SECRET_KEY`      | yes           | `backup` job container only, absent from `app`                                                                                                                                                                    |
| `BACKUP_RETENTION_DAYS`/`BACKUP_CRON`          | No            | default 14, `0 2 * * *`                                                                                                                                                                                           |
| `ADMIN_BOOTSTRAP_EMAIL/PASSWORD`               | yes while set | one-time first-admin only                                                                                                                                                                                         |

Also tuning-only (not secret), full list in `spec/setup`: session TTLs, argon2 params, `RATE_LIMIT_*`, WS connection/payload caps.

Rules: no secret committed; pino redacts `SECRET|PASSWORD|KEY|TOKEN`; prod errors never leak stack traces; least privilege (MinIO creds never on `app`); rotating `SESSION_SECRET`/VAPID forces re-login/re-subscription. Full detail: `spec/setup`, `spec/security`.

## Middleware

Fastify hook chain, every `/api/v1/*` request, in order: (1) request-id + pino logging; (2) `@fastify/helmet`; (3) `@fastify/cors`, locked to exact `APP_URL`; (4) `bodyLimit` (1 MiB); (5) `@fastify/rate-limit`, Redis-backed; (6) session cookie → Redis `sess:<id>` — 401 if invalid; (7) CSRF header **`X-Requested-With: XMLHttpRequest`** on POST/PUT/PATCH/DELETE — 403 `CSRF_REQUIRED` if absent; the one and only CSRF header name anywhere in the system, no `X-TG-CSRF` exists (`decision/csrf-header-name`); (8) authz guard (`requireAdmin`, `requireChannelMember`, `requireOwnerOrAdmin`) — 403; (9) `zod` validation — 400; (10) handler; (11) `setErrorHandler` → `{error:{code,message,details?}}`.

WS upgrade (`GET /ws`) runs steps 1-2, then `Origin` check (exact match, reject before `101`), per-IP connect rate limit, session→Redis check, then the gateway registers the socket and replays backfill. No CSRF on the upgrade (Origin check is the mitigation). Full detail: `spec/architecture`, `spec/security/authz`.

## API structure

REST+JSON, base path `/api/v1`, `camelCase` fields, ISO-8601 UTC, UUID ids. Lists: `{data:[...], meta:{nextCursor,hasMore}}`, cursor pagination (default 50, max 100). Errors: `{error:{code,message,details?}}`. CSRF header on every state-changing request: `X-Requested-With: XMLHttpRequest`.

| Area         | Key routes                                                                                                 | Auth                |
| ------------ | ---------------------------------------------------------------------------------------------------------- | ------------------- |
| Auth         | login, logout, me, forgot/reset-password                                                                   | public/session      |
| Invites      | `/invites/:token` accept (public); create/list/resend/delete (admin)                                       | mixed               |
| Users        | `/users(/:id)`, `/users/me(/password)`                                                                     | session             |
| Admin        | role, deactivate/reactivate, `GET /admin/users`, `/admin/messages/:id`(+restore), audit-log, weekly-active | admin               |
| Channels/DMs | `/conversations`, `/channels`, join/leave, `/dms`                                                          | session/owner/admin |
| Members      | `/conversations/:id/members(/:userId)`                                                                     | member/owner/admin  |
| Messages     | `/conversations/:id/messages`, `/messages/:id`, `/sync?after=`                                             | member/sender/admin |
| Threads      | `/messages/:id/replies`                                                                                    | member              |
| Read state   | `/conversations/:id/read`, `/unread-counts`                                                                | member              |
| Push         | `/push/vapid-public-key`, `/push/subscriptions`                                                            | session             |
| WebSocket    | `wss://<APP_URL>/ws`, subprotocol `tg-v1`                                                                  | cookie at handshake |

This table is the target reference from `spec/api`.

Idempotency: message-create carries `clientMessageId`, unique-indexed — a retried POST returns the existing message (200) not a dup (201).
**Rate limits — verbatim from `spec/security`'s canonical table:** global default 100 req/min (session or IP); `POST /auth/login` 5 failed/15min per (email,IP) + 20/15min per IP; `POST /auth/reset-request` 3/hour per email + 10/hour per IP; `POST /admin/invites` 20/hour per admin; `POST /invites/:token/accept` 5/hour per token + 20/hour per IP (`decision/invite-accept-rate-limit`); message send (REST+WS) token bucket 3/sec sustained, burst to 10; **WS inbound (any msg type) 20 msg/sec/connection hard cap → close `1008`**; WS concurrent connections 5/user (oldest dropped on the 6th); **WS frame size `maxPayload` 16 KiB → close `1009`**; admin moderation actions — global default, role-gated and audited. Full reference: `spec/api`, `spec/security`.

## API flows

Canonical send-message sequence:

1. Client sends WS `message.send {conversationId, body, parentMessageId?}` with a client `clientMessageId`.
2. Server validates the sender is a member of `conversationId`; rejects otherwise.
3. Server inserts a `messages` row and publishes it to Redis pub/sub `conv:<id>`.
4. Every subscribed `app` replica pushes it over WS to each connected member.
5. Server fans out notifications for offline/push-enabled recipients — DMs/@mentions unconditional, channel per setting.
6. Sender's client reconciles its optimistic copy against the server's ack (id+`seq`); other clients append + update unread badges.
   Failure: WS disconnected at Send → client queues, retries over REST once reconnected (same `clientMessageId`, no dup).

Other sequences (WS connect/auth, reconnect+backfill via `GET /sync?after=<seq>`, edit/delete, thread-reply notify, admin actions) are in `spec/flows/realtime`, `/user-b`, `/admin`. Index + failure-path table: `spec/flows`.

## User flows

Numbered sign-in (full):

1. Member opens sign-in, enters email + password; client POSTs `POST /api/v1/auth/login`.
2. Server looks up by lower-cased email, verifies the argon2id hash; 401 generic "invalid credentials" if not found, wrong password, or deactivated.
3. Server creates a session id, writes `sess:<id>` to Redis (30-day sliding TTL), sets an `HttpOnly; Secure; SameSite=Lax` cookie.
4. Client redirects to the last-visited conversation or `#general`, then opens the WS connection using the same cookie.
   Failure: wrong password/unknown/deactivated → one generic 401 (no enumeration); password correct but account deactivated → 403 with a specific message (safe once proven correct).

All other Must-scope journeys are numbered in the sub-keys: auth/channels/DM (`spec/flows/user-a`), messaging/threads (`/user-b`), WS/presence/push (`/realtime`), admin (`/admin`), backup/restore (`/jobs`).

## Security flow

Every successful authentication (invite-accept, login) issues a **brand-new** session id — never reuses a pre-auth session. Password reset and any role change **revoke every existing session**. Deactivation revokes every session **and** force-closes every live WS connection synchronously via an in-process `userId → Set<connection>` registry — close code `4003`. Login/reset responses are generic against enumeration; the exception is a deactivated account after a _correct_ password (403, specific).

Session: Redis `sess:<id>`, sliding 30-day TTL, absolute 90-day cap. Cookie: `HttpOnly; Secure; SameSite=Lax`, scoped to `APP_URL`, HMAC-signed with `SESSION_SECRET`. CSRF: `X-Requested-With: XMLHttpRequest` on state-changing calls — the sole CSRF header name in the system (`decision/csrf-header-name`). WS auth reuses the cookie, validated against Redis before the upgrade; `Origin` also checked. Passwords: argon2id (19 MiB/2/1, OWASP baseline). Invite/reset tokens: 256-bit random, `sha256`-hashed, single-use, 7-day/1-hour expiry. Full detail: `spec/security/auth`, `spec/security/authz`, `threat-model/tg`.

## Security setup

Before go-live, a deployer verifies (full checklist `spec/security`): WS upgrade live; Postgres/Redis not host-published; `REDIS_PASSWORD`/`SESSION_SECRET` fresh; invite/reset emails verified in staging; VAPID keys backed up; MinIO creds only on `backup`; backup+restore tested; `audit_log` has no write grant; disk encryption at rest; headers/CORS/WS-origin verified live; rate limits active; ≥2 active admins; secrets excluded from git/image; dependencies scanned clean.

## Operations

**Environments:** local (dev compose); **staging — committed for MVP** (`answer/environments-ci`), a second Dokploy stack, own Postgres/Redis + subdomain, synthetic data only, redeployed from `main` after local checks pass; prod (`chat.<client-domain>`, real data, single `app` replica, accepted SPOF), deploys only from a tagged release after manual approval.

**CI/CD:** **GitHub Actions is not used** (`decision/no-github-actions` — billing-locked; client confirmed local-only is fine). Every PR's gate is local: install → lint → typecheck → build → test (+ integration vs. the local compose stack), run by author and reviewer, pasted into the PR body — never waiting on a GitHub check. `ci.yml`/`staging-load-test.yml` (TG-6) stay as manual (`workflow_dispatch`) references only; scan (`trivy`/`pnpm audit`) and the k6 load test (50 VUs, p95<500ms/<1% error) run manually pre-release.

**Deploy/rollback:** entrypoint runs `db:migrate` before serving (failure → previous container kept). `/healthz`/`/readyz` gate Traefik routing. Rollback = redeploy previous image, safe only if additive; re-verify after.

**Observability:** `pino` JSON logs, correlation ids, no message content logged; 60s heartbeat; external uptime check; alerts on health-check/backup failure, crash-restart, disk >85%, load-test gate failure.

**Backup & restore:** daily `pg_dump -Fc` + secrets tarball to MinIO, 14-day retention, RPO≈24h, RTO≤60min (measured by drill), rehearsed pre-launch then quarterly.

## Testing

Risk-based pyramid: ~65% unit, ~18% integration, ~8% API/WS contract, ~7% E2E, ~2% load/a11y/restore. Extra attention: real-time latency, authorization, soft-delete leak prevention, last-admin guard, reconnect/backfill (no dupes/gaps).

Levels: **Unit** (Vitest, no real DB/Redis). **Integration** (Testcontainers, real Postgres/Redis). **API contract** (Fastify `app.inject()`). **WS protocol** (real `ws` client vs server — no-gap/no-dup backfill is the signature test). **E2E** (Playwright, 3 engines). **Accessibility** (`@axe-core/playwright`, WCAG 2.1 AA, zero serious/critical is a merge gate). **Load** (k6, 50 virtual WS users, 10-min soak, p95<500ms/<1% error, against staging pre-release). **Restore drill** (pre-launch, then monthly).

Definition of Done (`spec/testing`): every AC maps to a named test; ≥80% server/≥70% web diff coverage; integration tests green vs real Postgres/Redis; new endpoints/WS events have a contract test; user-facing changes have a green Playwright spec; new screens pass axe; no open P0/P1; security-relevant behaviour has an explicit test.

## Conventions

**Branching/commits:** trunk-based `main`, one branch per issue (`tg-<issue-number>-<slug>`); Conventional Commits via commitlint+Husky; squash merge only; never force-push `main`.

**Code review:** exactly one reviewer, never the author; `security`-labelled issues also need `security-eng`. Gate: local checks green (author+reviewer both run install/lint/typecheck/build/test — no GitHub Actions, `decision/no-github-actions`), ≥1 non-author approval, no unresolved comments, rebased. Checklist: AC match, no `any` widening, zod at every boundary, explicit error handling, no secrets/PII, happy+failure tests, additive migrations.

**Definition of Ready:** plan approved by every planner but its author; active sprint; estimated; assignee+reviewer set; Given/When/Then ACs; dependencies sequenced; subtasks ≤1 day.

**Coding standards:** TS `strict`; no unjustified `any`/`!`; ESLint (type-checked, incl. `no-floating-promises`; `eslint-plugin-react`/`react-hooks` for `apps/web`) +Prettier; zod at every boundary; typed `AppError`; `pino` logs, no PII; one React component per file; migrations forward-only. Full detail: `spec/conventions`.

## Glossary

- **Enlinka Chat** — the product's user-facing brand name (title, manifest `name`/`short_name`, email, push); **TG**/`tg` is the unchanged internal project key/repo/DB naming.
- **Member/Admin** — the two roles; channel **owner** is a per-channel attribute, not a role.
- **Conversation** — a DM or channel; `conv:<id>` is its Redis pub/sub channel.
- **Thread** — a reply (`thread_root_id`), one level deep, denormalized reply-count/last-reply-time.
- **Soft delete** — `body` retained; non-admins see a placeholder, admins view/restore via audit.
- **Session** — a Redis-backed, cookie-referenced login record; the sole auth mechanism.
- **`seq`** — the global monotonic message sequence used as the WS/backfill cursor.
- **`clientMessageId`** — a client-generated UUID making message-create idempotent under retry.
- **VAPID** — the keypair scheme `web-push` uses to sign payloads, no third-party SDK.
- **Last-admin guard** — ≥1 active admin always exists, enforced in-app and by a DB trigger.
- **Audit log** — append-only, admin-only-readable record of admin actions.
- **RPO/RTO** — recovery point/time (~24h/≤60min). **PWA** — home-screen-install mode iOS needs for Web Push.

## Spec index

- `spec/overview`, `spec/architecture`, `spec/file-structure`, `spec/data-model`, `spec/api` — product/personas/MoSCoW; tech stack/components/pipeline; repo layout; Postgres schema/triggers/migrations; full REST+WS reference.
- `spec/flows` (+sub-keys) — every numbered flow + failure-path table.
- `spec/security` (+sub-keys) + `threat-model/tg` (STRIDE).
- `spec/setup`, `spec/operations`, `spec/testing`, `spec/conventions` — prereqs/env/first run; environments/deploy/observability; test strategy/DoD; branching/review/DoR/standards.
- `brief/requirements` — the signed-off client brief; `decision/*` — every ADR; `plan/raid` — the RAID log.
