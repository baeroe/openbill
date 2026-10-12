# openbill

Open, self-hosted quotes and invoices. Define your own fields for documents and line items, write your own PDF templates in Liquid, and get German/EU e-invoices (EN 16931, ZUGFeRD/XRechnung) out of the box.

> **Status:** feature-complete for a first release (0.1.0 in preparation). Feedback welcome in the issues.

## What it does

- Four document types: quote, order confirmation, invoice, cancellation, with simple statuses and one-click conversion along the chain
- A fixed core plus **custom fields** on every level: organisation, customer, contact, document, line item
- Line items in **groups** with subtotals
- **Compliance profiles** per document type: *Basic* (international) or *E-Invoice EN 16931* with required fields and embedded XML
- VAT handling: regular, small business (§ 19 UStG), EU reverse charge, third countries
- **Templates** as portable packages (HTML + CSS + Liquid + manifest), rendered to PDF/A-3 with Gotenberg, with a local toolkit for live preview
- REST API and MCP server for agents
- Runs as a Docker Compose stack (app, MariaDB, Gotenberg)

## Quickstart

You need Docker with Compose v2.

```bash
mkdir openbill && cd openbill
curl -fsSLO https://raw.githubusercontent.com/baeroe/openbill/main/docker-compose.yml
curl -fsSL -o .env https://raw.githubusercontent.com/baeroe/openbill/main/.env.docker.example
# edit .env: APP_URL, ADMIN_EMAIL and the passwords ADMIN_PASSWORD, DB_PASSWORD, DB_ROOT_PASSWORD
# (empty in the template: docker compose refuses to start until they are set)
docker compose up -d
```

openbill listens on `127.0.0.1:7739`; put a reverse proxy with HTTPS in front on the same host and set `APP_URL` to its address (proxy on another host: `OPENBILL_BIND` and `TRUSTED_PROXIES`, see the reverse proxy guide). Then log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

- Setup: [`docs/en/setup.md`](docs/en/setup.md)
- Reverse proxy: [`docs/en/reverse-proxy.md`](docs/en/reverse-proxy.md)
- Backup: [`docs/en/backup.md`](docs/en/backup.md)
- Upgrading: [`docs/en/upgrading.md`](docs/en/upgrading.md)

Images: `baeroe/openbill` on Docker Hub for `linux/amd64` and `linux/arm64`, tagged `X.Y.Z`, `X.Y` and `latest`.

## Development

Local development runs in [DDEV](https://ddev.com) (PHP 8.4, MariaDB 11.4, Node 24 with pnpm, Gotenberg):

```bash
cp .env.example .env
ddev start
ddev composer install
ddev artisan key:generate && ddev artisan migrate
ddev artisan app:ensure-admin
ddev exec pnpm install
ddev exec pnpm dev          # https://openbill.ddev.site/en/login
ddev artisan test
```

Full guide: [`docs/en/development.md`](docs/en/development.md) (German: [`docs/de/development.md`](docs/de/development.md)).

## License

[MIT](LICENSE)
