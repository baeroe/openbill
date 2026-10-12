# Upgrading

Make a [backup](/en/backup) first, then:

```bash
docker compose pull
docker compose up -d
```

On start openbill migrates the database, installs the built-in templates of the new version and rebuilds its caches. Data in the volumes stays. `docker compose restart` alone keeps the old image.

- **Pinned version:** change `OPENBILL_IMAGE` in `.env` first (e.g. `baeroe/openbill:0.2.0`).
- **Compose file:** the notes below say when `docker-compose.yml` changed (for example new MariaDB or Gotenberg versions). Download it again and keep your own changes:
  `curl -fsSLO https://raw.githubusercontent.com/baeroe/openbill/main/docker-compose.yml`
- **MariaDB:** patch versions upgrade themselves on start (`MARIADB_AUTO_UPGRADE`). A new major version only comes with a note here.
- **Going back:** migrations are not rolled back. Restore the backup and pin the old version.

All versions and their changes: https://github.com/baeroe/openbill/releases

## Notes per version

<!-- absolute links only: each section becomes the notes of the GitHub release (scripts/release-notes.sh) -->

### 0.1.0

- First release: quotes, order confirmations, invoices and cancellations with custom fields on every level, line items in groups, Liquid templates (Klar, Kante, Leise and your own, with the template toolkit), EN 16931 e-invoices as PDF/A-3 with embedded XML, a REST API and an MCP server, in English and German.
- Image `baeroe/openbill:0.1.0` for `linux/amd64` and `linux/arm64`. Runs as Docker Compose stack with MariaDB 11.4 and Gotenberg 8, see [Setup](https://github.com/baeroe/openbill/blob/main/docs/en/setup.md).
- Documentation: https://openbill.dev/
