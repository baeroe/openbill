# Backup

A backup has three parts: the database (volume `openbill-db`), the files (volume `openbill-data`: archived PDFs and XMLs, template assets, uploads, the generated `APP_KEY` in `.app-key`) and your `.env`. Database and files belong together: openbill checks the SHA-256 of every archived PDF against the database when it delivers it.

Run the commands next to `docker-compose.yml`, the stack keeps running.

## Back up

Database first, then the files – so every document in the dump has its file:

```bash
# 1. database: consistent snapshot including the triggers that protect finalized documents
docker compose exec -T mariadb sh -c 'exec mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" --single-transaction --routines --triggers openbill' > openbill-db-$(date +%F).sql

# 2. files of the data volume
docker compose exec -T openbill tar czf - -C /var/www/html/storage/app . > openbill-data-$(date +%F).tar.gz
```

Keep both files and a copy of `.env` somewhere else than the server. For a nightly backup put both commands into a script and run it from cron.

## Restore

A restore replaces everything. On a new server: copy `docker-compose.yml` and `.env` there first. On the existing server, remove the old data (this deletes it!):

```bash
docker compose down -v
```

Then:

```bash
# 1. empty database (MariaDB creates the database "openbill" and its user from .env)
docker compose up -d --wait mariadb
docker compose exec -T mariadb sh -c 'exec mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" openbill' < openbill-db-2026-10-12.sql

# 2. files into the data volume
docker compose run --rm --no-deps -T --entrypoint tar openbill xzf - -C /var/www/html/storage/app < openbill-data-2026-10-12.tar.gz

# 3. start openbill
docker compose up -d
```

openbill finds the restored `APP_KEY` in the data volume, so existing sessions stay valid. Then open one finalized document's PDF as a check: if the files don't match the database, the download fails instead of delivering a different file.

## Notes

- Keep the database user `openbill` (from `docker-compose.yml`): the triggers in the dump are defined for it.
- `docker compose down -v` deletes both volumes. Without `-v`, `down` keeps them.
- Moving to a new server is backup on the old one plus restore on the new one, with the same `.env`.
- `app:prune-images` deletes images for good – run it after a backup.
