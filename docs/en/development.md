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
ddev exec pnpm build                                   # production assets
ddev exec 'pnpm --filter "./prototypes/*" test'        # clickable prototypes
```

JavaScript dependencies are installed inside the DDEV container, so always run `pnpm` through `ddev exec`. `ddev exec` passes its arguments through a shell inside the container: wrap commands with glob patterns in single quotes, as above. Tests use their own database `testing`, which DDEV creates on start.

## Languages

The interface is English and German. Texts live in `lang/en.json` and `lang/de.json` with the same keys; a test fails if a key is missing in one of them.
