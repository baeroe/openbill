# Setup with Docker Compose

openbill runs as a Docker Compose stack: the app (`baeroe/openbill`, for `linux/amd64` and `linux/arm64`), MariaDB 11.4 and Gotenberg 8, which renders the PDFs. You need Docker with Compose v2 and, for HTTPS, a reverse proxy in front (see [Reverse proxy](/en/reverse-proxy)).

::: tip Your instance, your responsibility
openbill is no tax or legal advice and comes without warranty (MIT License). Whether your invoices and your archive meet the rules that apply to you (e.g. GoBD), check with your tax advisor; see [E-invoices](/en/e-invoice).
:::

## Quick start: paste and deploy

One compose file with everything in it, no `.env`:

1. Paste the block below into a new stack in Dockge or Portainer, or save it as `compose.yaml` on your server.
2. Change the four values at the top: `APP_URL` (the https address of your reverse proxy), `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `DB_PASSWORD`. openbill refuses to start while a password is still `change-me`.
3. Deploy (Dockge/Portainer) or run `docker compose up -d`. Wait for `openbill: ready` in the logs of `openbill`, then open `APP_URL`. openbill listens on port `7739` of the server: point your reverse proxy at `http://<server>:7739` (see [Reverse proxy](/en/reverse-proxy)).

The owner account is created on the first start; afterwards you can delete the `ADMIN_PASSWORD` line. Keep `DB_PASSWORD` as it is: MariaDB stores it on the first start. MariaDB's root password is random and not needed (backups use the `openbill` user).

<<< @/../docker-compose.standalone.yml{yaml}

If you prefer the settings in a separate `.env` next to the compose file (for example to keep the compose file unchanged on updates), use the way below instead.

## Files

```bash
mkdir openbill && cd openbill
curl -fsSLO https://raw.githubusercontent.com/baeroe/openbill/main/docker-compose.yml
curl -fsSL -o .env https://raw.githubusercontent.com/baeroe/openbill/main/.env.docker.example
```

## .env

Fill in `.env` before the first start. The passwords are empty in the template on purpose: until the database passwords are set, `docker compose up` stops with `DB_PASSWORD missing` (or `DB_ROOT_PASSWORD`), and without `ADMIN_PASSWORD` the first start creates no owner (the log says `nobody can log in`).

| Variable | Required | Meaning |
|---|---|---|
| `APP_URL` | yes | Public address including `https://`, e.g. `https://invoices.example.com`. Links, the toolkit download and the allowed `Host` header come from it: requests for any other host get `400`. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | first start | Owner account (the template leaves the password empty), created on the first start only (password at least 8 characters). Changing them later doesn't touch the existing account. Remove `ADMIN_PASSWORD` from `.env` once you have logged in, see [Passwords](#passwords). |
| `DB_PASSWORD`, `DB_ROOT_PASSWORD` | yes | MariaDB passwords (empty in the template). MariaDB stores them on the first start; changing them in `.env` afterwards breaks the connection. |
| `OPENBILL_BIND`, `OPENBILL_PORT` | no | Host address and port, default `0.0.0.0` and `7739` (the container listens on `8080`). `OPENBILL_BIND=127.0.0.1` keeps the port local, for a proxy on the same host (not in a container), see [Reverse proxy](/en/reverse-proxy). |
| `TRUSTED_PROXIES` | no | IP addresses or CIDR networks (no host names) whose `X-Forwarded-*` headers openbill believes, comma-separated. Default: localhost and the private networks. Optionally narrow it to your proxy, see [Reverse proxy](/en/reverse-proxy). |
| `OPENBILL_IMAGE` | no | Default `baeroe/openbill:latest`. Pin a version with `baeroe/openbill:0.1.0`. |
| `APP_KEY` | no | Encryption key of sessions and cookies. Without it, openbill generates one on the first start and keeps it in the data volume. |

## Start

![The login of a fresh instance](/screenshots/en/login.png)

```bash
docker compose up -d
docker compose logs -f openbill    # wait for "openbill: ready", then Ctrl+C
```

Open `APP_URL` and log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

On every start the container:

1. waits up to 60 seconds for the database (`DB_WAIT_TIMEOUT`); if it isn't reachable, it stops with `openbill: database … not reachable` and Docker restarts it,
2. generates the `APP_KEY` once, unless you set one,
3. migrates the database,
4. installs the built-in templates (Klar, Kante, Leise) in the version of the image,
5. creates the owner account if it doesn't exist yet,
6. builds its caches.

## Passwords

`ADMIN_PASSWORD` is only needed for the first start. Once you have logged in, delete the line from `.env` and run `docker compose up -d`, so the password no longer sits in the file and in the container environment. Without it the container skips creating the owner; it only warns in the log when no account exists at all.

Everyone changes their own password under **Settings → Your account** (see [Settings](/en/settings#your-account)). A forgotten password is reset on the server; the command asks for the new one twice without showing it:

```bash
docker compose exec openbill php artisan app:reset-password owner@example.com
```

Without a terminal it reads the first line of its input instead, e.g. `docker compose exec -T openbill php artisan app:reset-password owner@example.com < new-password.txt`. The password is never an argument, so it doesn't end up in the shell history. Resetting signs the account out everywhere; its API tokens stay valid.

## What lives where

| What | Where |
|---|---|
| Archived PDFs and e-invoice XMLs, template assets, uploaded images and logos, the generated `APP_KEY` (`.app-key`) | volume `openbill-data` (`/var/www/html/storage/app` in the container) |
| Database | volume `openbill-db` (MariaDB) |
| Settings | `.env` next to `docker-compose.yml`, or the block at the top of the standalone compose file |

Containers can be recreated at any time, the volumes stay. `docker compose down -v` deletes them, and with them every document. Back up both volumes, see [Backup](/en/backup).

## Services

- **openbill**: nginx and PHP-FPM on port `8080`, runs as `www-data`; the code in the image is read-only for it. It counts as healthy once Laravel answers `/up` for the host of `APP_URL`.
- **mariadb**: only reachable by openbill (internal network, no published port). It runs with `--log-bin-trust-function-creators=1`: finalized documents are protected by database triggers, and creating triggers needs this switch (or the SUPER privilege) as soon as binary logging is on.
- **gotenberg**: renders HTML to PDF/A-3. Only reachable by openbill and without internet access. Templates can come from untrusted packages, so Chromium runs no JavaScript and loads nothing but Gotenberg's own working files and `data:` URLs.

## Your own MariaDB

To use an existing MariaDB 11.4 instead of the `mariadb` service: remove the service and its `depends_on` entry, set `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME` and `DB_PASSWORD` for openbill, and give the user all privileges on its database (including `TRIGGER`). If binary logging is on there, set `log_bin_trust_function_creators = 1` in the server configuration – otherwise the first migration fails with error 1419 (“You do not have the SUPER privilege and binary logging is enabled”).

## Language

The app is in English and German, English by default. The language is part of the URL (`APP_URL/en/…`, `APP_URL/de/…`); switch it in the menu. Documents have their own language, independent of the app.

## Versions

`latest` follows every release. Pin a version with `OPENBILL_IMAGE=baeroe/openbill:0.1.0` in `.env`. How to update: [Upgrading](/en/upgrading).

## docker-compose.yml

The complete compose file, the same one `curl` downloads above from the main branch. Usually you leave it as it is: everything you set goes into `.env`.

<<< @/../docker-compose.yml{yaml}
