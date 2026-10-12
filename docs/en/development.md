# Development

openbill runs locally in [DDEV](https://ddev.com): PHP 8.4, MariaDB 11.4, Node 24 with pnpm, Vite with hot reload, Mailpit and Gotenberg. You don't need PHP or Composer on your machine.

## Requirements

- DDEV 1.25 or newer with a Docker provider (for example Colima or OrbStack)
- Git

## First start

```bash
git clone https://github.com/baeroe/openbill.git
cd openbill
cp .env.example .env
ddev start
ddev composer install
ddev artisan key:generate
ddev artisan migrate
ddev artisan app:ensure-admin   # creates admin@example.com / password from .env
ddev exec pnpm install
ddev exec pnpm dev              # Vite with hot reload, keep it running
```

Open <https://openbill.ddev.site/en/login> and log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`.

## Services

| What | Where |
|---|---|
| App | `https://openbill.ddev.site` (`/en/…` and `/de/…`) |
| Vite dev server | `https://openbill.ddev.site:5173` |
| Mailpit | `ddev mailpit` |
| Gotenberg (PDF) | `http://gotenberg:3000` inside the containers |
| Database | `ddev mysql`, user/password/database `db` |
| These docs | `ddev exec pnpm --dir docs dev` → `https://openbill.ddev.site:5174/en/` |

Gotenberg runs hardened, because templates may come from untrusted packages: Chromium runs no JavaScript and may load only Gotenberg's own working files and `data:` URLs (`.ddev/docker-compose.gotenberg.yaml`; CI starts it with the same flags). `docker-compose.yml` runs it with the same switches, and all three places (DDEV, CI, Compose) use the same image pinned by digest; `tests/Feature/DockerSetupTest.php` fails when they drift apart.

## Everyday commands

```bash
ddev artisan test                                      # Pest
ddev artisan test --filter=AuthTest                    # one file or test
ddev exec vendor/bin/pint                              # format PHP
ddev exec vendor/bin/phpstan analyse --memory-limit=1G # Larastan, level 6
ddev exec pnpm typecheck                               # TypeScript
ddev exec pnpm test                                    # Vitest (resources/js)
ddev exec 'pnpm --filter "./packages/*" test'          # workspace packages (paged-preview)
ddev exec pnpm --filter @openbill/template-kit build   # template kit only → packages/template-kit/dist/kit (pnpm build does it, too)
pnpm --dir e2e test                                    # Playwright on the Mac against DDEV (incl. the editor flow)
ddev exec pnpm build                                   # production assets and the template kit
ddev exec 'pnpm --filter "./prototypes/*" test'        # clickable prototypes
```

JavaScript dependencies are installed inside the DDEV container, so always run `pnpm` through `ddev exec`. `ddev exec` passes its arguments through a shell inside the container: wrap commands with glob patterns in single quotes, as above. Tests use their own database `testing`, which DDEV creates on start.

`packages/paged-preview` splits the server-rendered parts of a document into pages. The app, the template editor and the template toolkit use it; it has no dependency on the app (no Tailwind, texts come in as props).

`packages/template-kit` is the [template toolkit](/en/template-toolkit): a prebuilt preview page (React, `paged-preview`), the Vite plugin `openbill-render` and the CLI `push`/`pull`/`pack` (`src/tooling`), and the end user's files (`kit-files/`). `pnpm build` assembles it in `packages/template-kit/dist/kit`; the toolkit download zips that folder (`OPENBILL_TOOLKIT_PATH` points elsewhere, the download answers 503 without it). To try a change like a template author: build, unzip a download outside the repository and run `pnpm install && pnpm dev` there.

## Browser tests

Playwright tests live in `e2e/` and run on your machine against the DDEV site (the browsers are native binaries, the `node_modules` of the app belong to the container). `e2e/` is a separate pnpm project with its own lockfile.

```bash
pnpm --dir e2e install                       # once, on the host
pnpm --dir e2e exec playwright install chromium
ddev exec pnpm build                         # or keep `ddev exec pnpm dev` running
pnpm --dir e2e test                          # seeds demo data, then runs the tests
```

The tests log in as `e2e@example.com` (created by `Database\Seeders\E2eUserSeeder`) and replace all business data with the demo data before they start (`E2E_SKIP_SEED=1` skips that). `OPENBILL_URL` points them at another instance. `toolkit.spec.ts` needs the built template kit (`ddev exec pnpm build`; `pnpm dev` alone does not build it), Node 24, pnpm and `unzip` on your machine; it unpacks a download into a temporary folder and starts it with `NODE_OPTIONS=--use-system-ca`, so Node trusts the DDEV certificate.

Against the Docker image instead of DDEV (what the CI job `e2e` does):

```bash
docker build -t openbill:e2e .
e2e/compose.sh up -d --wait --wait-timeout 300   # docker-compose.yml + e2e overrides, http://localhost:7739
OPENBILL_URL=http://localhost:7739 E2E_ARTISAN="e2e/compose.sh exec -T openbill php artisan" pnpm --dir e2e test
e2e/compose.sh down -v
```

`E2E_ARTISAN` is the command the global setup seeds with (default `ddev artisan`). The stack runs with `APP_ENV=e2e`, because the seeders refuse `production`; everything else is the production setup.

## Languages

The interface is English and German. Texts live in `lang/en.json` and `lang/de.json` with the same keys; a test fails if a key is missing in one of them.

## Docker image

`Dockerfile` builds the image in two stages: `assets` (Node 24, pnpm from corepack, `pnpm build` for the app and the template kit) and `app` (`serversideup/php` 8.4 with nginx, extensions `intl`, `bcmath`, `gd`, `apcu`). `docker/entrypoint.d/99-openbill.sh` runs on every start: wait for the database, `APP_KEY`, migrations, built-in templates, owner account, caches.

```bash
docker build -t openbill:local .
# try it like a user: docker-compose.yml + .env from .env.docker.example with OPENBILL_IMAGE=openbill:local
```

Base images are pinned by version and digest (Dockerfile, `docker-compose.yml`, `.ddev/docker-compose.gotenberg.yaml`, `.github/workflows/tests.yml`, `scripts/validate-einvoice.sh`). To update one, look up the new digest and change every place at once:

::: v-pre
```bash
docker buildx imagetools inspect gotenberg/gotenberg:8.38.0 --format '{{json .Manifest.Digest}}'
```
:::

The validators in `scripts/validate-einvoice.sh` (CEN Schematron, Saxon-HE, KoSIT validator and its configuration) are pinned by version and SHA-256 the same way; update URL and checksum together.

Dependabot (`.github/dependabot.yml`) opens weekly, grouped PRs for GitHub Actions, Composer and pnpm (root and `e2e/`). It leaves Docker images alone on purpose: update those by hand as described above.

Releases: a tag `vX.Y.Z` builds `linux/amd64` and `linux/arm64`, pushes `baeroe/openbill:X.Y.Z`, `:X.Y` and `:latest` and creates the GitHub release with the notes of `### X.Y.Z` from `docs/en/upgrading.md` (`scripts/release-notes.sh`; the tag fails without that section in English and German). Pull requests that change the image only build it.
