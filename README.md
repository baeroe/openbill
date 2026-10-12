# openbill

[![Tests](https://github.com/baeroe/openbill/actions/workflows/tests.yml/badge.svg)](https://github.com/baeroe/openbill/actions/workflows/tests.yml)
[![Docker Hub](https://img.shields.io/docker/v/baeroe/openbill?sort=semver&label=docker%20hub)](https://hub.docker.com/r/baeroe/openbill)

Open, self-hosted quotes, order confirmations, invoices and cancellations. Your own fields on every level, line items in groups, PDF templates in Liquid and EN 16931 e-invoices (ZUGFeRD/Factur-X) – in the browser, over a REST API and for AI agents over MCP.

**Docs: [openbill.dev](https://openbill.dev)** (English and German)

![The document editor: a draft invoice with groups of positions, custom fields, the compliance check and the live preview (the demo company writes its invoices in German)](https://openbill.dev/screenshots/en/editor.png)

## Features

- Quotes, order confirmations, invoices and cancellations, converted along the chain with one click; numbers are assigned when you finalize
- Custom fields on the organization, customers, contacts, documents and line items
- Line items in groups with subtotals, optional items in quotes, suggestions from earlier documents
- Templates in HTML, CSS and Liquid, rendered to PDF by Gotenberg: three built in, a toolkit with live preview for your own
- E-invoices after EN 16931 as PDF/A-3 with embedded XML; VAT for regular taxation, small businesses (§ 19 UStG), EU reverse charge and third countries
- REST API (OpenAPI) and an MCP server with scoped tokens
- English and German, light and dark

## Quickstart

You need Docker with Compose v2.

```bash
mkdir openbill && cd openbill
curl -fsSLO https://raw.githubusercontent.com/baeroe/openbill/main/docker-compose.yml
curl -fsSL -o .env https://raw.githubusercontent.com/baeroe/openbill/main/.env.docker.example
# edit .env: APP_URL, ADMIN_EMAIL and the passwords ADMIN_PASSWORD, DB_PASSWORD, DB_ROOT_PASSWORD
# (empty in the template: docker compose refuses to start until the database ones are set)
docker compose up -d                              # start
docker compose pull && docker compose up -d       # update
```

openbill listens on `127.0.0.1:7739`. Put a reverse proxy with HTTPS in front, set `APP_URL` to its address and log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` (then remove `ADMIN_PASSWORD` from `.env`; passwords are changed in the app).

- [Setup](https://openbill.dev/en/setup) and [Reverse proxy](https://openbill.dev/en/reverse-proxy)
- [Backup](https://openbill.dev/en/backup) and [Upgrading](https://openbill.dev/en/upgrading)
- [Templates](https://openbill.dev/en/templates), [E-invoices](https://openbill.dev/en/e-invoice), [REST API](https://openbill.dev/en/api), [MCP](https://openbill.dev/en/mcp)

Images: `baeroe/openbill` on Docker Hub for `linux/amd64` and `linux/arm64`, tagged `X.Y.Z`, `X.Y` and `latest`.

## Development

Local development runs in [DDEV](https://ddev.com) (PHP 8.4, MariaDB 11.4, Node 24 with pnpm, Gotenberg); the guide is [Development](https://openbill.dev/en/development). The docs live in [`docs/`](docs) (VitePress): `ddev exec pnpm --dir docs dev`.

The clickable prototypes in [`prototypes/`](prototypes) (`clickdummy` and `clickdummy-v2` with its `DESIGN.md`) are the design reference the app was built from; they are not part of the app.

## Release

A tag `vX.Y.Z` builds the image for amd64 and arm64, pushes it to Docker Hub and creates a GitHub release with the notes from [`docs/en/upgrading.md`](docs/en/upgrading.md).

## License

[MIT](LICENSE)
