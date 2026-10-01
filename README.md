# Enlinka Chat (TG)

pnpm workspace monorepo: `apps/web` (React 19 + Vite), `apps/server` (Node 22 + Fastify + `ws`),
`packages/shared` (shared TS types/DTOs), `infra/` (Docker, compose, Traefik/Dokploy config).

For prerequisites, every environment variable, the full first-run walkthrough, local services,
seed data, common commands and troubleshooting, see ORBIT team memory `spec/setup` and the
developer onboarding handbook, ORBIT issue **TG-21**.

Quick start (see `spec/setup` for the full version):

```
corepack enable && corepack prepare pnpm@9.12.3 --activate
cp .env.example .env
docker compose -f infra/compose/docker-compose.yml up -d
pnpm install
pnpm dev
```
