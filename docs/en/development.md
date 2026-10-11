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

Gotenberg runs hardened, because templates may come from untrusted packages: Chromium runs no JavaScript and may load only Gotenberg's own working files and `data:` URLs (`.ddev/docker-compose.gotenberg.yaml`; CI starts it with the same flags). Run it the same way in production:

```bash
gotenberg --chromium-disable-javascript=true \
  '--chromium-deny-list=^file:(?!//\/tmp/).*' '--chromium-deny-list=^(?!(file|data):).*' \
  --chromium-deny-private-ips=true --chromium-deny-public-ips=true
```

## Everyday commands

```bash
ddev artisan test                                      # Pest
ddev artisan test --filter=AuthTest                    # one file or test
ddev exec vendor/bin/pint                              # format PHP
ddev exec vendor/bin/phpstan analyse --memory-limit=1G # Larastan, level 6
ddev exec pnpm typecheck                               # TypeScript
ddev exec pnpm test                                    # Vitest (resources/js)
ddev exec 'pnpm --filter "./packages/*" test'          # workspace packages (paged-preview)
pnpm --dir e2e test                                    # Playwright on the Mac against DDEV (incl. the editor flow)
ddev exec pnpm build                                   # production assets
ddev exec 'pnpm --filter "./prototypes/*" test'        # clickable prototypes
```

JavaScript dependencies are installed inside the DDEV container, so always run `pnpm` through `ddev exec`. `ddev exec` passes its arguments through a shell inside the container: wrap commands with glob patterns in single quotes, as above. Tests use their own database `testing`, which DDEV creates on start.

`packages/paged-preview` splits the server-rendered parts of a document into pages. The app, the template editor and the template toolkit use it; it has no dependency on the app (no Tailwind, texts come in as props).

## Browser tests

Playwright tests live in `e2e/` and run on your machine against the DDEV site (the browsers are native binaries, the `node_modules` of the app belong to the container). `e2e/` is a separate pnpm project with its own lockfile.

```bash
pnpm --dir e2e install                       # once, on the host
pnpm --dir e2e exec playwright install chromium
ddev exec pnpm build                         # or keep `ddev exec pnpm dev` running
pnpm --dir e2e test                          # seeds demo data, then runs the tests
```

The tests log in as `e2e@example.com` (created by `Database\Seeders\E2eUserSeeder`) and replace all business data with the demo data before they start (`E2E_SKIP_SEED=1` skips that). `OPENBILL_URL` points them at another instance.

## Languages

The interface is English and German. Texts live in `lang/en.json` and `lang/de.json` with the same keys; a test fails if a key is missing in one of them.
