# Setup

openbill runs as a Docker Compose stack: the app (`baeroe/openbill`, for `linux/amd64` and `linux/arm64`), MariaDB 11.4 and Gotenberg 8, which renders the PDFs. You need Docker with Compose v2 and, for HTTPS, a reverse proxy in front (see [Reverse proxy](/en/reverse-proxy)).

## Files

```bash
mkdir openbill && cd openbill
curl -fsSLO https://raw.githubusercontent.com/baeroe/openbill/main/docker-compose.yml
curl -fsSL -o .env https://raw.githubusercontent.com/baeroe/openbill/main/.env.docker.example
```

## .env

Change every value in `.env` before the first start:

| Variable | Required | Meaning |
|---|---|---|
| `APP_URL` | yes | Public address including `https://`, e.g. `https://invoices.example.com`. Links, the toolkit download and the allowed `Host` header come from it: requests for any other host get `400`. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | yes | Owner account, created on the first start only (password at least 8 characters). Changing them later doesn't touch the existing account. |
| `DB_PASSWORD`, `DB_ROOT_PASSWORD` | yes | MariaDB passwords. MariaDB stores them on the first start; changing them in `.env` afterwards breaks the connection. |
| `OPENBILL_PORT` | no | Host port, default `7739` (the container listens on `8080`). With a reverse proxy on the same host use `127.0.0.1:7739`, so the port isn't reachable from outside. |
| `OPENBILL_IMAGE` | no | Default `baeroe/openbill:latest`. Pin a version with `baeroe/openbill:0.1.0`. |
| `APP_KEY` | no | Encryption key of sessions and cookies. Without it, openbill generates one on the first start and keeps it in the data volume. |

## Start

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

## What lives where

| What | Where |
|---|---|
| Archived PDFs and e-invoice XMLs, template assets, uploaded images and logos, the generated `APP_KEY` (`.app-key`) | volume `openbill-data` (`/var/www/html/storage/app` in the container) |
| Database | volume `openbill-db` (MariaDB) |
| Settings | `.env` next to `docker-compose.yml` |

Containers can be recreated at any time, the volumes stay. `docker compose down -v` deletes them, and with them every document. Back up both volumes, see [Backup](/en/backup).

## Services

- **openbill**: nginx and PHP-FPM on port `8080`, runs as `www-data`.
- **mariadb**: only reachable by openbill (internal network, no published port). It runs with `--log-bin-trust-function-creators=1`: finalized documents are protected by database triggers, and creating triggers needs this switch (or the SUPER privilege) as soon as binary logging is on.
- **gotenberg**: renders HTML to PDF/A-3. Only reachable by openbill and without internet access. Templates can come from untrusted packages, so Chromium runs no JavaScript and loads nothing but Gotenberg's own working files and `data:` URLs.

## Your own MariaDB

To use an existing MariaDB 11.4 instead of the `mariadb` service: remove the service and its `depends_on` entry, set `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME` and `DB_PASSWORD` for openbill, and give the user all privileges on its database (including `TRIGGER`). If binary logging is on there, set `log_bin_trust_function_creators = 1` in the server configuration – otherwise the first migration fails with error 1419 (“You do not have the SUPER privilege and binary logging is enabled”).

## Language

The app is in English and German, English by default. The language is part of the URL (`APP_URL/en/…`, `APP_URL/de/…`); switch it in the menu. Documents have their own language, independent of the app.

## Versions

`latest` follows every release. Pin a version with `OPENBILL_IMAGE=baeroe/openbill:0.1.0` in `.env`. How to update: [Upgrading](/en/upgrading).
