# openbill

Open, self-hosted quotes and invoices. Define your own fields for documents and line items, write your own PDF templates in Liquid, and get German/EU e-invoices (EN 16931, ZUGFeRD/XRechnung) out of the box.

> **Status:** under construction. The Laravel app is being built in phases; phase 1 (foundation: login, English/German UI, tooling, docs) is in place. The clickable prototypes in `prototypes/` show where it is going.

## What it does (planned)

- Four document types: quote, order confirmation, invoice, cancellation, with simple statuses and one-click conversion along the chain
- A fixed core plus **custom fields** on every level: organisation, customer, contact, document, line item
- Line items in **groups** with subtotals
- **Compliance profiles** per document type: *Basic* (international) or *E-Invoice EN 16931* with required fields and embedded XML
- VAT handling: regular, small business (§ 19 UStG), EU reverse charge, third countries
- **Templates** as portable packages (HTML + CSS + Liquid + manifest), rendered to PDF with Gotenberg, with a local toolkit for live preview
- REST API and MCP server for agents
- Runs as a Docker Compose stack

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

## Prototypes

```bash
ddev exec 'pnpm --filter "./prototypes/*" test'
```

`prototypes/clickdummy-v2` is the current design reference (see its [`DESIGN.md`](prototypes/clickdummy-v2/DESIGN.md)); `prototypes/clickdummy` is the first draft.

Design spec: [`docs/superpowers/specs/2026-10-11-openbill-app-design.md`](docs/superpowers/specs/2026-10-11-openbill-app-design.md)

## License

[MIT](LICENSE)
