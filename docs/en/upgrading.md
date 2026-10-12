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

### 0.1.1

- **Compose file changed:** openbill's port `7739` is now published on all addresses of the host (as `7739:8080`), not only on `127.0.0.1`. A reverse proxy in a container, like Nginx Proxy Manager in Dockge, can now forward to `<server>:7739` (before, it got `502 Bad Gateway`). Download `docker-compose.yml` or paste the new `docker-compose.standalone.yml` again. With `OPENBILL_BIND=127.0.0.1` in your `.env`, the port stays local. Hardening options: https://openbill.dev/en/reverse-proxy
- Documentation: disclaimer (no tax or legal advice, no warranty) in the README, setup and e-invoice pages.

### 0.1.0

- First release: quotes, order confirmations, invoices and cancellations with custom fields on every level, line items in groups, Liquid templates (Klar, Kante, Leise and your own, with the template toolkit), EN 16931 e-invoices as PDF/A-3 with embedded XML, a REST API and an MCP server, in English and German.
- Image `baeroe/openbill:0.1.0` for `linux/amd64` and `linux/arm64`. Runs as Docker Compose stack with MariaDB 11.4 and Gotenberg 8, see [Setup](https://github.com/baeroe/openbill/blob/main/docs/en/setup.md).
- Documentation: https://openbill.dev/
