#!/bin/sh
# docker compose for the Playwright stack: the production docker-compose.yml plus e2e/docker-compose.e2e.yml, with its
# own project name and env file, so neither the .env of DDEV nor another stack gets in the way.
#
#   docker build -t openbill:e2e .
#   e2e/compose.sh up -d --wait --wait-timeout 300
#   OPENBILL_URL=http://localhost:7739 E2E_ARTISAN="e2e/compose.sh exec -T openbill php artisan" pnpm --dir e2e test
#   e2e/compose.sh down -v
set -e
cd "$(dirname "$0")/.."
exec docker compose -p openbill-e2e --env-file e2e/compose.env -f docker-compose.yml -f e2e/docker-compose.e2e.yml "$@"
