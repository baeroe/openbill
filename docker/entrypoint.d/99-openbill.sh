#!/bin/sh
# openbill start-up. serversideup's entrypoint runs every /etc/entrypoint.d/*.sh in order before nginx and PHP-FPM
# start, each sourced in a subshell: exported variables never reach PHP-FPM, which is why the config cache at the
# end (it contains APP_KEY) is what PHP-FPM reads. Any failing step stops the container with a message, so a
# half-migrated instance never serves requests.
set -e
cd /var/www/html

log() { echo "openbill: $*"; }

# 1. data volume (storage/app): folders of the disks local (private), public and archive
mkdir -p storage/app/private storage/app/public storage/app/archive

# 2. APP_KEY from the environment; otherwise generated once and kept in the data volume (survives new containers)
if [ -z "${APP_KEY:-}" ]; then
    KEY_FILE=storage/app/.app-key
    if [ ! -s "$KEY_FILE" ]; then
        (umask 077 && php -r 'echo "base64:".base64_encode(random_bytes(32));' > "$KEY_FILE")
        log "generated APP_KEY in $KEY_FILE (data volume)"
    fi
    APP_KEY=$(cat "$KEY_FILE")
    export APP_KEY
fi

# 3. a config cache from an earlier start of this container would hide changed environment variables
php artisan config:clear --no-interaction > /dev/null

# 4. wait for the database (first start: MariaDB initialises; external databases may be slow)
timeout=${DB_WAIT_TIMEOUT:-60}
waited=0
# shellcheck disable=SC2016 # PHP code, the $ belong to PHP
until php -r '
    $dsn = sprintf("mysql:host=%s;port=%s", getenv("DB_HOST") ?: "mariadb", getenv("DB_PORT") ?: "3306");
    try {
        new PDO($dsn, (string) getenv("DB_USERNAME"), (string) getenv("DB_PASSWORD"), [PDO::ATTR_TIMEOUT => 3]);
    } catch (Throwable $e) {
        fwrite(STDERR, $e->getMessage());
        exit(1);
    }
' 2> /tmp/openbill-db-wait; do
    if [ "$waited" -ge "$timeout" ]; then
        log "database ${DB_HOST:-mariadb}:${DB_PORT:-3306} not reachable after ${timeout}s: $(cat /tmp/openbill-db-wait)" >&2
        exit 1
    fi
    sleep 2
    waited=$((waited + 2))
done

# 5. schema, the built-in templates in the version of this image, the owner account (only created once)
php artisan migrate --force --no-interaction
php artisan app:sync-templates --no-interaction
php artisan app:ensure-admin --no-interaction

# 6. caches for production: config (with APP_KEY), routes, views, events
php artisan optimize --no-interaction
log "ready"
