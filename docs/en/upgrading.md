# Upgrading

Make a [backup](/en/backup) first, then:

```bash
docker compose pull
docker compose up -d
```

With the [standalone compose file](/en/setup#quick-start-paste-and-deploy) in Dockge or Portainer: update the stack (Dockge: Update) or pull the image again and redeploy it (Portainer).

On start openbill migrates the database, installs the built-in templates of the new version and rebuilds its caches. Data in the volumes stays. `docker compose restart` alone keeps the old image.

- **Pinned version:** change `OPENBILL_IMAGE` in `.env` first (e.g. `baeroe/openbill:0.2.0`), or the `image:` line of the standalone compose file.
- **Compose file:** the notes below say when `docker-compose.yml` changed (for example new MariaDB or Gotenberg versions). Download it again and keep your own changes:
  `curl -fsSLO https://raw.githubusercontent.com/baeroe/openbill/main/docker-compose.yml`
  With the standalone compose file, paste the new [docker-compose.standalone.yml](https://github.com/baeroe/openbill/blob/main/docker-compose.standalone.yml) and copy your values from the block at the top into it.
- **MariaDB:** patch versions upgrade themselves on start (`MARIADB_AUTO_UPGRADE`). A new major version only comes with a note here.
- **Going back:** migrations are not rolled back. Restore the backup and pin the old version.

All versions and their changes: https://github.com/baeroe/openbill/releases

## Notes per version

<!-- absolute links only: each section becomes the notes of the GitHub release (scripts/release-notes.sh) -->

### 0.3.1

- **Security update:** PHP 8.4.27 fixes two critical remote code execution vulnerabilities in PHP itself (CVE-2026-109618, CVE-2026-109619) that can be exploited without logging in. Update now: https://www.php.net/archive/2026.php#2026-10-21-5
- The image is now based on `serversideup/php` v5.0.2 (before: v4.5.1, PHP 8.4.23). It also brings nginx 1.30.6 with fixes for five nginx vulnerabilities.
- `TRUSTED_PROXY=off`: nginx no longer rewrites the client IP itself, only `TRUSTED_PROXIES` decides about forwarded headers, as before. No change for setups with a reverse proxy in front: https://openbill.dev/en/reverse-proxy
- Upgrade: `docker compose pull && docker compose up -d`
- No changes to the compose files.

### 0.3.0

- **GiroCode on invoices:** templates get `document.payment_qr`, an EPC QR code (SVG data URL) that banking apps scan to fill in the SEPA transfer: your organization name and IBAN/BIC, the total and the invoice number as reference. It is only filled for finalized invoices with a total above zero and an IBAN in the organization settings. The built-in templates do not print it; add it to your own template: https://openbill.dev/en/templates#girocode
- New Liquid filter `iban` prints an IBAN in groups of four (`org.iban | iban`).
- `payment_qr` is now a reserved key for document fields: a custom document field with this key is hidden by the GiroCode in templates.
- No changes to the compose files.

### 0.2.1

- The **New document** dialog only offers the types you can create there (offer, order confirmation, invoice). Cancellations still come from an invoice; the greyed-out card is gone, and the remaining cards have room for their names.
- Template gallery: the buttons of a card wrap on narrow cards instead of running out of the card.
- No changes to the compose files.

### 0.2.0

- **Customer numbers are configurable:** new section Settings → Customers with a number range like the document types (placeholders `{YYYY}`, `{YY}`, `{MM}`, `{0000}`, optional yearly reset, next value, live preview). New customers without a number get the next number of this range; numbers typed by hand stay as they are. On update the range continues the numbers handed out so far (for example `K-1004` → `K-{0000}` from 1005, otherwise `C-{0000}` from 1001), so nothing changes until you change the pattern. Details: https://openbill.dev/en/settings#customers
- REST API: `GET/PATCH /api/customer-numbering` and `GET /api/customer-numbering/preview`; the MCP tool `get-settings` also returns `customer_numbering`.
- The next number shown in the document type settings now skips numbers that already exist, like finalizing does.
- No changes to the compose files.

### 0.1.1

- **Compose file changed:** openbill's port `7739` is now published on all addresses of the host (as `7739:8080`), not only on `127.0.0.1`. A reverse proxy in a container, like Nginx Proxy Manager in Dockge, can now forward to `<server>:7739` (before, it got `502 Bad Gateway`). Download `docker-compose.yml` or paste the new `docker-compose.standalone.yml` again. With `OPENBILL_BIND=127.0.0.1` in your `.env`, the port stays local. Hardening options: https://openbill.dev/en/reverse-proxy
- Documentation: disclaimer (no tax or legal advice, no warranty) in the README, setup and e-invoice pages.

### 0.1.0

- First release: quotes, order confirmations, invoices and cancellations with custom fields on every level, line items in groups, Liquid templates (Klar, Kante, Leise and your own, with the template toolkit), EN 16931 e-invoices as PDF/A-3 with embedded XML, a REST API and an MCP server, in English and German.
- Image `baeroe/openbill:0.1.0` for `linux/amd64` and `linux/arm64`. Runs as Docker Compose stack with MariaDB 11.4 and Gotenberg 8, see [Setup](https://github.com/baeroe/openbill/blob/main/docs/en/setup.md).
- Documentation: https://openbill.dev/
