#!/usr/bin/env bash
# Lossless PNG compression of the docs screenshots (oxipng in Docker, pinned by digest): about a fifth smaller, so
# every regenerated set weighs less in the git history. Part of `pnpm --dir e2e docs:screenshots`.
set -euo pipefail

OXIPNG_IMAGE=ghcr.io/shssoichiro/oxipng:v9.1.5@sha256:e1623b0da9f14b63b242ffb78e4eef4ba0f09c9159880d238665af4654c75b4f
SHOTS=$(cd "$(dirname "$0")/../docs/public/screenshots" && pwd)

docker run --rm -v "$SHOTS:/shots" "$OXIPNG_IMAGE" --opt 4 --strip safe --alpha --recursive --quiet /shots
