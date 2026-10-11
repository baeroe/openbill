# openbill

Open, self-hosted quotes and invoices. Define your own fields for documents and line items, write your own PDF templates in Liquid, and get German/EU e-invoices (EN 16931, ZUGFeRD/XRechnung) out of the box.

> **Status:** concept phase. The clickable prototypes live in `prototypes/`; the real Laravel app is being built in phases.

## What it does (planned)

- Four document types: quote, order confirmation, invoice, cancellation, with simple statuses and one-click conversion along the chain
- A fixed core plus **custom fields** on every level: organisation, customer, contact, document, line item, catalog
- **Compliance profiles** per document type: *Basic* (international) or *E-Invoice EN 16931* with required fields and embedded XML
- VAT handling: regular, small business (§ 19 UStG), EU reverse charge, third countries
- Catalog with units (UN/ECE codes), categories and text blocks
- **Templates** as portable packages (HTML + CSS + Liquid + manifest), rendered to PDF with Gotenberg
- Runs as a Docker Compose stack

## Clickdummy

```bash
cd prototypes/clickdummy-v2
pnpm install
pnpm dev     # http://localhost:5173
pnpm test    # domain logic tests
```

Any login works; all data stays in your browser's `localStorage`. Use *Demo-Daten zurücksetzen* in the sidebar to start over.

Design spec: [`docs/superpowers/specs/2026-10-04-openbill-clickdummy-design.md`](docs/superpowers/specs/2026-10-04-openbill-clickdummy-design.md)

## License

[MIT](LICENSE)
