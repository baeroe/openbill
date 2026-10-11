#!/usr/bin/env bash
# Checks openbill's e-invoices against the official EN 16931 business rules (Schematron).
#
# The CII Schematron of CEN/TC 434 (ConnectingEurope/eInvoicing-EN16931, release "validation-<version>",
# EUPL-1.2) runs as XSLT with Saxon-HE in a Java container. Nothing of it is checked in: the artefacts are
# downloaded once into storage/framework/testing/einvoice-validator (git-ignored) and verified by SHA-256.
#
#   scripts/validate-einvoice.sh            generate the sample XMLs in DDEV (EInvoiceSamplesTest), then validate
#   scripts/validate-einvoice.sh <dir>      validate every *.xml in <dir> (CI: XMLs written by the tests job)
#
# Needs docker, curl and python3 on the host. Exit code 1 when a "fatal" rule fails; warnings are only printed.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
CACHE="$ROOT/storage/framework/testing/einvoice-validator"
JAVA_IMAGE=eclipse-temurin:21-jre

EN16931_VERSION=1.3.16
EN16931_URL="https://github.com/ConnectingEurope/eInvoicing-EN16931/releases/download/validation-${EN16931_VERSION}/en16931-cii-${EN16931_VERSION}.zip"
EN16931_SHA256=1cd53cb8a84d38aedc82c0caede217da983a7934dd663f793a092fd66443c561
SAXON_URL=https://repo1.maven.org/maven2/net/sf/saxon/Saxon-HE/12.5/Saxon-HE-12.5.jar
SAXON_SHA256=98c3a91e6e5aaf9b3e2b37601e04b214a6e67098493cdd8232fcb705fddcb674
XMLRESOLVER_URL=https://repo1.maven.org/maven2/org/xmlresolver/xmlresolver/5.2.2/xmlresolver-5.2.2.jar
XMLRESOLVER_SHA256=efc92bd7ed32b3e57095e0b3e872051ccfbbdcc980831ef33e89e38161a85222

sha256() {
    if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

fetch() { # url sha256 target
    if [ ! -f "$3" ] || [ "$(sha256 "$3")" != "$2" ]; then
        curl -fsSL -o "$3" "$1"
    fi
    if [ "$(sha256 "$3")" != "$2" ]; then
        echo "Checksum mismatch for $1" >&2
        exit 2
    fi
}

mkdir -p "$CACHE"
fetch "$EN16931_URL" "$EN16931_SHA256" "$CACHE/en16931-cii.zip"
fetch "$SAXON_URL" "$SAXON_SHA256" "$CACHE/saxon-he.jar"
fetch "$XMLRESOLVER_URL" "$XMLRESOLVER_SHA256" "$CACHE/xmlresolver.jar"
if [ ! -f "$CACHE/cii/xslt/EN16931-CII-validation.xslt" ]; then
    rm -rf "$CACHE/cii"
    (cd "$CACHE" && python3 -c 'import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])' en16931-cii.zip cii)
fi

SAMPLES=${1:-}
if [ -z "$SAMPLES" ]; then
    SAMPLES="$ROOT/storage/framework/testing/einvoice"
    rm -rf "$SAMPLES"
    ddev exec 'EINVOICE_SAMPLES_DIR=/var/www/html/storage/framework/testing/einvoice php artisan test --filter=EInvoiceSamplesTest'
    ddev mutagen sync >/dev/null 2>&1 || true
fi
SAMPLES=$(cd "$SAMPLES" && pwd)
if ! ls "$SAMPLES"/*.xml >/dev/null 2>&1; then
    echo "No XML files in $SAMPLES" >&2
    exit 2
fi

rm -rf "$SAMPLES/svrl"
mkdir -p "$SAMPLES/svrl"
docker run --rm -v "$CACHE:/validator:ro" -v "$SAMPLES:/samples" "$JAVA_IMAGE" \
    java -cp /validator/saxon-he.jar:/validator/xmlresolver.jar net.sf.saxon.Transform \
    -s:/samples -o:/samples/svrl -xsl:/validator/cii/xslt/EN16931-CII-validation.xslt '-ext:off' >/dev/null

python3 - "$SAMPLES" "$EN16931_VERSION" <<'PY'
import glob, os, sys
import xml.etree.ElementTree as ET

ns = {'svrl': 'http://purl.oclc.org/dsdl/svrl'}
samples, version = sys.argv[1], sys.argv[2]
fatal = 0
for path in sorted(glob.glob(os.path.join(samples, 'svrl', '*.xml'))):
    name = os.path.basename(path)
    asserts = ET.parse(path).getroot().findall('.//svrl:failed-assert', ns)
    errors = [a for a in asserts if a.get('flag', 'fatal') == 'fatal']
    print(f"{'FAIL' if errors else 'ok  '} {name}" + (f" ({len(asserts) - len(errors)} warning(s))" if len(asserts) > len(errors) else ''))
    for a in asserts:
        text = ' '.join((a.findtext('svrl:text', '', ns) or '').split())
        print(f"     {a.get('flag', 'fatal'):7} {a.get('id')}: {text[:200]}")
    fatal += len(errors)
print(f"EN 16931 CII Schematron {version}: {fatal} fatal error(s)")
sys.exit(1 if fatal else 0)
PY
