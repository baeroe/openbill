# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------------------------------------------------
# assets: Vite build of the app (public/build) and the template kit (packages/template-kit/dist/kit).
# Runs on the platform of the build machine: the output is plain JS/CSS, the same for amd64 and arm64.
# ---------------------------------------------------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM node:24-alpine3.24@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS assets
WORKDIR /app
ENV CI=true \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# pnpm in exactly the version of "packageManager" in package.json
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && corepack install

# every manifest of the workspace, so the frozen lockfile matches (docs and prototypes are installed, not built)
COPY packages/paged-preview/package.json packages/paged-preview/
COPY packages/template-kit/package.json packages/template-kit/
COPY docs/package.json docs/
COPY prototypes/clickdummy/package.json prototypes/clickdummy/
COPY prototypes/clickdummy-v2/package.json prototypes/clickdummy-v2/
RUN --mount=type=cache,id=openbill-pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --store-dir /pnpm-store

COPY vite.config.ts tsconfig.json ./
COPY resources ./resources
COPY packages ./packages
# app assets and the template kit (root script "build")
RUN pnpm build

# ---------------------------------------------------------------------------------------------------------------------
# app: PHP-FPM + nginx (serversideup), runs as www-data on port 8080
# ---------------------------------------------------------------------------------------------------------------------
FROM serversideup/php:8.4.27-fpm-nginx-v5.0.2@sha256:579494c30b36935ce5f1d125f96499b7f14d6e74668bbe3229b8da188bc10de8 AS app

LABEL org.opencontainers.image.title="openbill" \
      org.opencontainers.image.description="Self-hosted quotes and invoices with custom fields, Liquid templates and EN 16931 e-invoices." \
      org.opencontainers.image.source="https://github.com/baeroe/openbill" \
      org.opencontainers.image.licenses="MIT"

# Template uploads carry up to 30 MB (config openbill.api.max_template_body_bytes): nginx and PHP must let them through
# to LimitApiBody. Rendering may add 128 MB (openbill.rendering.max_memory_bytes) on top of the request: 512M.
# TRUSTED_PROXY=off: nginx keeps the TCP peer as REMOTE_ADDR (serversideup v5 defaults to trusting Cloudflare), so
# Laravel's TRUSTED_PROXIES stays the only place that decides about forwarded headers (docs/en/reverse-proxy.md).
# OPcache (v5: no timestamp checks) is fine: the code is baked into the image, caches are built before PHP-FPM starts.
ENV AUTORUN_ENABLED=false \
    SSL_MODE=off \
    TRUSTED_PROXY=off \
    PHP_OPCACHE_ENABLE=1 \
    PHP_MEMORY_LIMIT=512M \
    PHP_POST_MAX_SIZE=32M \
    PHP_UPLOAD_MAX_FILE_SIZE=32M \
    NGINX_CLIENT_MAX_BODY_SIZE=32M \
    APP_NAME=openbill \
    APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    LOG_LEVEL=info \
    DB_CONNECTION=mariadb \
    DB_HOST=mariadb \
    DB_PORT=3306 \
    DB_DATABASE=openbill \
    DB_USERNAME=openbill \
    SESSION_DRIVER=database \
    CACHE_STORE=database \
    QUEUE_CONNECTION=sync \
    MAIL_MAILER=log \
    GOTENBERG_URL=http://gotenberg:3000

USER root
# intl (numbering, slugs), bcmath (brick/math), gd (fpdf inside horstoeko/zugferd), apcu (API Platform metadata cache);
# pdo_mysql, zip, dom, simplexml, fileinfo, mbstring come with the base image
RUN install-php-extensions intl bcmath gd apcu
# start-up: wait for the database, APP_KEY, migrations, built-in templates, owner, caches
COPY --chmod=755 docker/entrypoint.d/ /etc/entrypoint.d/
WORKDIR /var/www/html

# The code belongs to root and is read-only for PHP (www-data): a write bug in the app can't turn into code
# execution. Only storage/ (the data volume is storage/app) and bootstrap/cache (config, routes, events) are writable.
# Modes are set explicitly, so a local checkout with restrictive modes (e.g. 600 from composer) builds the same image.
# dependencies first (cached while composer.lock is unchanged), the autoloader after the code is in place
COPY --chmod=644 composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --no-scripts --no-autoloader

COPY artisan ./
COPY app ./app
COPY bootstrap ./bootstrap
COPY config ./config
COPY database ./database
COPY lang ./lang
COPY public ./public
COPY resources ./resources
COPY routes ./routes
# read at runtime by the MCP resource openbill://docs/liquid-reference
COPY docs/en/templates.md ./docs/en/templates.md
COPY --from=assets /app/public/build ./public/build
COPY --from=assets /app/packages/template-kit/dist/kit ./packages/template-kit/dist/kit

# storage/app is the data volume: created here and owned by www-data, so a new named volume starts out that way.
# dump-autoload runs the post-autoload-dump scripts (package discovery, Swagger UI assets in public/vendor).
RUN mkdir -p storage/app storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && composer dump-autoload --no-dev --optimize --no-interaction \
    && chown root:root . \
    && chmod -R a+rX,go-w artisan app bootstrap config database lang public resources routes docs packages \
    && chown -R www-data:www-data storage bootstrap/cache
USER www-data
