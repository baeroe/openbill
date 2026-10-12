#!/usr/bin/env bash
# Release notes of one version for the GitHub release (.github/workflows/docker.yml): the section "### <version>" of
# docs/en/upgrading.md. Every tag needs that section in docs/en/upgrading.md and docs/de/upgrading.md (spec 9), so
# this fails without one – the workflow runs it before anything is pushed. Pre-releases (0.2.0-rc.1) use the section
# of their final version.
#
#   scripts/release-notes.sh 0.1.0
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
VERSION=${1:?usage: scripts/release-notes.sh <version without v, e.g. 0.1.0>}
VERSION=${VERSION%%-*}

for lang in en de; do
    if ! grep -qxF "### ${VERSION}" "$ROOT/docs/$lang/upgrading.md"; then
        echo "docs/$lang/upgrading.md has no section \"### ${VERSION}\"" >&2
        exit 1
    fi
done

# lines after the heading up to the next heading of level 2 or 3, without leading and trailing blank lines
awk -v heading="### ${VERSION}" '
    $0 == heading { found = 1; next }
    found && /^##/ { exit }
    found { lines[++n] = $0 }
    END {
        first = 1
        while (first <= n && lines[first] == "") first++
        last = n
        while (last >= first && lines[last] == "") last--
        for (i = first; i <= last; i++) print lines[i]
    }
' "$ROOT/docs/en/upgrading.md"
