# CI pipeline setup (one-time, needs repo admin)

The workflows in `.github/workflows/` run automatically on pushes to `main`,
pull requests targeting `main`, and `v*` tags; `workflow_dispatch` is also
available for manual runs. No repository setup is needed for
`install`/`lint`/`typecheck`/`test`/`build`. The steps below need repo-admin
access this agent does not have (`repos.create`/`repos.list` tokens are scoped
to ORBIT's webhook integration, not GitHub repo settings), so a human with
admin on `domingoedc02/telegram` must do them. The `scan` and `push` jobs run
as part of the normal pipeline once the Dockerfile is present. The deploy jobs
remain skipped until TG-8 stands up the `tg-staging`/`tg-prod` Dokploy
applications and a human sets the corresponding readiness variables.

## 1. Branch protection on `main`

Settings → Branches → add a rule for `main`:

- Require a pull request before merging (no direct pushes, the bootstrap
  commit on `main` was the one deliberate exception per the sprint plan).
- Require status checks to pass before merging — select, once each has run
  at least once so GitHub offers it as a choice: `Lint`, `Typecheck`, `Test`,
  `Build`, `Scan`.
- Require branches to be up to date before merging.
- Require at least 1 approving review (matches `spec/conventions`' one
  reviewer per PR, never the author).
- Do not allow bypassing the above, including for admins, if the client wants
  the rule to actually hold.

This repo's token (ORBIT's git credentials) cannot set this — it has no
GitHub repo-admin scope, only push/PR access.

## 2. Repository secrets (Settings → Secrets and variables → Actions)

| Secret                   | Used by                         | Source                                                                                   |
| ------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------- |
| `DOKPLOY_URL`            | `deploy-staging`, `deploy-prod` | TG-8's Dokploy instance base URL                                                         |
| `DOKPLOY_STAGING_APP_ID` | `deploy-staging`                | TG-8, once the `tg-staging` Dokploy application exists                                   |
| `DOKPLOY_PROD_APP_ID`    | `deploy-prod`                   | TG-8, once the `tg-prod` Dokploy application exists                                      |
| `DOKPLOY_API_TOKEN`      | both                            | Dokploy's own API token, scoped to deploy-webhook calls only if Dokploy supports scoping |

`GITHUB_TOKEN` needs no setup — GitHub injects it per-run, scoped by this
workflow's own `permissions: contents: read, packages: write` block.

## 3. GitHub Environment `production` (Settings → Environments → New)

- Name it exactly `production` (the `deploy-prod` job's `environment:` key
  must match).
- Required reviewers: add the team lead and/or project manager — a human
  reviews the latest `staging-load-test` run's result before approving.
- No deployment branch restriction is needed beyond the workflow's own
  `if: startsWith(github.ref, 'refs/tags/v')` guard, but restricting the
  environment to tag refs matching `v*` is a reasonable belt-and-suspenders
  addition if the GitHub plan supports it.
- A `staging` environment is optional (the `deploy-staging` job references
  one for consistency/visibility in the Actions UI) — add it with no
  required reviewers if you want staging deploys to show up under
  Environments too.

## 4. GHCR package visibility

`ghcr.io/domingoedc02/telegram` inherits the repo's default visibility
(private, since the repo is private). No separate GHCR account or
visibility change is needed — confirm once an image has actually been
pushed that Settings → Packages shows it linked to this repo.

## 5. Verifying the pipeline end-to-end

After this branch is merged:

1. Push a small follow-up or open a throwaway PR — confirm `Lint`/`Typecheck`/
   `Test`/`Build` all run and report status. The Docker image build and scan
   also run when `infra/docker/Dockerfile.app` is present.
2. Once TG-8 lands the real Dockerfile and the `tg-staging`/`tg-prod` Dokploy
   apps plus secrets above exist, set `DOKPLOY_STAGING_READY=true` and/or
   `DOKPLOY_PROD_READY=true` as repository variables. Merge to `main` and
   confirm `build-image` → `scan` → `push` → `deploy-staging` all go green and
   `tg-staging` actually redeploys.
3. Run `staging-load-test.yml` manually once staging exists and TG-16 lands
   `infra/loadtest/soak.js`; supply the real staging URL as the required
   `staging_url` input (the workflow has no placeholder host).
4. Tag a `v0.0.1` test release and confirm `deploy-prod` pauses for manual
   approval in the `production` environment rather than running unattended.

See `spec/operations` for the full CI/CD table, deployment/rollback,
observability and backup/restore design this pipeline implements.
