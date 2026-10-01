# Local verification (required alongside GitHub Actions CI)

The client's later decision (`decision/no-github-actions`, superseded
2026-10-01) restored automatic GitHub Actions after the billing issue was
fixed. `.github/workflows/ci.yml` now runs on pushes to `main`, pull requests
targeting `main`, and `v*` tags, with `workflow_dispatch` retained for manual
runs. The staging load-test workflow remains manual until TG-8 provides a real
staging deployment and TG-16 provides the load-test script.

**Local verification remains a required pre-push gate, and GitHub Actions is a
second merge gate.** The author runs the commands below before opening or
updating a PR; the reviewer reruns them before approving. A green Actions run
must also be present before merge. This protects development when Actions is
unavailable and keeps the local feedback loop fast.

## 1. Before opening or updating a PR (the author's job)

From the repo root, with the dev stack up (`docker compose -f
infra/compose/docker-compose.yml up -d` — see `spec/setup`):

```
pnpm verify
```

This runs, in order, exactly what the retired CI pipeline ran: `pnpm install
--frozen-lockfile` (fails if `pnpm-lock.yaml` is out of date with any
`package.json`), `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`
(the last two run against the real Postgres/Redis from the compose stack for
any integration test, same as before). Paste the output — or at minimum,
confirm each of the five steps exited 0 — into the PR body.

## 2. Before approving a PR (the reviewer's job)

Fetch the branch and re-run the exact same command on it:

```
git fetch origin
git switch <branch>
pnpm verify
```

A reviewer approves only after seeing this pass locally themselves — the PR
author's own report is necessary but not sufficient, same standard a green
GitHub check used to meet. Do not approve on the strength of the author's
report alone.

## 3. Image vulnerability scan (local, replaces the old `scan` CI job)

The current `infra/docker/Dockerfile.app` is a temporary CI image definition; TG-8
must replace it with the production Dokploy runtime image before deployment:

```
docker buildx build -t tg-app:local -f infra/docker/Dockerfile.app .
trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 tg-app:local
pnpm audit --prod --audit-level=high
```

- `trivy image` — install via `brew install trivy` (macOS) or see
  <https://aquasecurity.github.io/trivy/latest/getting-started/installation/>
  for Linux. `--ignore-unfixed` matches the old CI job's behaviour (only
  fails on a HIGH/CRITICAL CVE that actually has a fix available).
  `--exit-code 1` makes a finding fail the command, same as the retired CI
  gate.
- `pnpm audit --prod --audit-level=high` — no install needed, ships with
  pnpm; catches JS-ecosystem advisories Trivy's OS/image-layer scan doesn't
  cover.

Run both before merging any PR that changes `apps/server`'s or
`apps/web`'s dependencies, and again before cutting a release. Paste the
result (clean, or the specific findings and why they're accepted) in the PR
body or the release checklist.

## 4. Deploy — Dokploy builds from git, no Actions webhook

Per `decision/no-github-actions`: Dokploy's `app` service is configured with
source = **Git repository** (`domingoedc02/telegram`, branch `main` for
staging / a `v*` tag for prod), not Docker Image via a push-triggered
webhook. Dokploy clones the repo itself and runs the build
(`infra/docker/Dockerfile.app`) on its own host when a deploy is triggered —
either manually from the Dokploy UI, or by Dokploy's own git-polling/webhook
feature pointed at GitHub (a GitHub webhook calling Dokploy, which is the
reverse direction of what the old `deploy-staging`/`deploy-prod` Actions jobs
did, and does not require GitHub Actions to be usable).
`ops/runbooks/ci-pipeline-setup.md`'s Actions-specific secrets
(`DOKPLOY_API_TOKEN` etc. for a `curl`-the-webhook step) are no longer
needed; TG-8 (not yet planned) will define the exact Dokploy git-source
configuration.

## Why keep the workflow files at all?

They remain accurate documentation of what a CI pipeline for this stack
looks like (install → lint → typecheck → test → build → build-image → scan
→ push → deploy), and `workflow_dispatch` means a human can still run them
by hand from the Actions tab if useful (e.g. once the GitHub billing lock is
resolved, to sanity-check the YAML still works) without any of it
auto-triggering. Deleting them would lose that reference for no operational
benefit.

See `spec/operations` for the full (now-local) verification story,
`spec/setup` for the local dev stack, and `spec/conventions` for the
updated meaning of "CI green."
