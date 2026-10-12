#!/usr/bin/env bash
# Checks openbill's e-invoices against the official EN 16931 business rules, with two tools:
#
# 1. The CII Schematron of CEN/TC 434 (ConnectingEurope/eInvoicing-EN16931, release "validation-<version>",
#    EUPL-1.2), run as XSLT with Saxon-HE in a Java container.
# 2. The KoSIT validator (itplr-kosit/validator, Apache-2.0) with its XRechnung configuration
#    (itplr-kosit/validator-configuration-xrechnung): every XML must match the scenario "EN16931 (CII)" (schema plus
#    EN 16931 Schematron, without the German XRechnung rules BR-DE, which openbill does not produce) and be assessed
#    "acceptable". A "reject", another scenario or a missing report fails.
#
# Nothing of it is checked in: the artefacts are downloaded once into storage/framework/testing/einvoice-validator
# (git-ignored) and verified by SHA-256.
#
#   scripts/validate-einvoice.sh            generate the sample XMLs in DDEV (EInvoiceSamplesTest), then validate
#   scripts/validate-einvoice.sh <dir>      validate every *.xml in <dir> (CI: XMLs written by the tests job)
#
# Needs docker, curl and python3 on the host. Exit code 1 when a "fatal" rule fails or KoSIT rejects an XML;
# warnings are only printed.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
CACHE="$ROOT/storage/framework/testing/einvoice-validator"
JAVA_IMAGE=eclipse-temurin:21-jre-noble@sha256:000fd431958bc81a24abe1e8e5f0f0fd3ae365a594bd50aadb20696805f9408c

EN16931_VERSION=1.3.16
EN16931_URL="https://github.com/ConnectingEurope/eInvoicing-EN16931/releases/download/validation-${EN16931_VERSION}/en16931-cii-${EN16931_VERSION}.zip"
EN16931_SHA256=1cd53cb8a84d38aedc82c0caede217da983a7934dd663f793a092fd66443c561
SAXON_URL=https://repo1.maven.org/maven2/net/sf/saxon/Saxon-HE/12.5/Saxon-HE-12.5.jar
SAXON_SHA256=98c3a91e6e5aaf9b3e2b37601e04b214a6e67098493cdd8232fcb705fddcb674
XMLRESOLVER_URL=https://repo1.maven.org/maven2/org/xmlresolver/xmlresolver/5.2.2/xmlresolver-5.2.2.jar
XMLRESOLVER_SHA256=efc92bd7ed32b3e57095e0b3e872051ccfbbdcc980831ef33e89e38161a85222
KOSIT_VERSION=1.6.3
KOSIT_URL="https://github.com/itplr-kosit/validator/releases/download/v${KOSIT_VERSION}/validator-${KOSIT_VERSION}-standalone.jar"
KOSIT_SHA256=799e64befca97d4080e03608c80b85dd5a5ecc5f4ae4f35d1116ec2855b9a7c9
KOSIT_CONFIG_VERSION=2026-08-31
KOSIT_CONFIG_URL="https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/download/v${KOSIT_CONFIG_VERSION}/xrechnung-3.0.2-validator-configuration-${KOSIT_CONFIG_VERSION}.zip"
KOSIT_CONFIG_SHA256=2530cd107c414511c5d0462ec10f886910395abfca820db82e83d70bf01221a8
KOSIT_SCENARIO='EN16931 (CII)'

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

unpack() { # zip directory (both relative to the cache, one directory per version)
    if [ ! -d "$CACHE/$2" ]; then
        (cd "$CACHE" && python3 -c 'import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2] + ".tmp")' "$1" "$2" && mv "$2.tmp" "$2")
    fi
}

mkdir -p "$CACHE"
fetch "$EN16931_URL" "$EN16931_SHA256" "$CACHE/en16931-cii-$EN16931_VERSION.zip"
fetch "$SAXON_URL" "$SAXON_SHA256" "$CACHE/saxon-he.jar"
fetch "$XMLRESOLVER_URL" "$XMLRESOLVER_SHA256" "$CACHE/xmlresolver.jar"
fetch "$KOSIT_URL" "$KOSIT_SHA256" "$CACHE/kosit-validator-$KOSIT_VERSION.jar"
fetch "$KOSIT_CONFIG_URL" "$KOSIT_CONFIG_SHA256" "$CACHE/kosit-config-$KOSIT_CONFIG_VERSION.zip"
# one directory per version: after raising a version the new rules are unpacked, never the old ones reused
CII="cii-$EN16931_VERSION"
if [ ! -f "$CACHE/$CII/xslt/EN16931-CII-validation.xslt" ]; then
    rm -rf "$CACHE/$CII"
    unpack "en16931-cii-$EN16931_VERSION.zip" "$CII"
fi
KOSIT_CONFIG="kosit-config-$KOSIT_CONFIG_VERSION"
if [ ! -f "$CACHE/$KOSIT_CONFIG/scenarios.xml" ]; then
    rm -rf "$CACHE/$KOSIT_CONFIG"
    unpack "$KOSIT_CONFIG.zip" "$KOSIT_CONFIG"
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

# 1. CEN Schematron
rm -rf "$SAMPLES/svrl"
mkdir -p "$SAMPLES/svrl"
docker run --rm -v "$CACHE:/validator:ro" -v "$SAMPLES:/samples" "$JAVA_IMAGE" \
    java -cp /validator/saxon-he.jar:/validator/xmlresolver.jar net.sf.saxon.Transform \
    -s:/samples -o:/samples/svrl "-xsl:/validator/$CII/xslt/EN16931-CII-validation.xslt" '-ext:off' >/dev/null

schematron=0
python3 - "$SAMPLES" "$EN16931_VERSION" <<'PY' || schematron=1
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

# 2. KoSIT validator, scenario "EN16931 (CII)"
rm -rf "$SAMPLES/kosit"
mkdir -p "$SAMPLES/kosit"
# its exit code is not used: the reports decide (and say why)
docker run --rm -v "$CACHE:/validator:ro" -v "$SAMPLES:/samples" "$JAVA_IMAGE" \
    sh -c "java -jar /validator/kosit-validator-$KOSIT_VERSION.jar -s /validator/$KOSIT_CONFIG/scenarios.xml -r /validator/$KOSIT_CONFIG -o /samples/kosit /samples/*.xml" >/dev/null || true

kosit=0
python3 - "$SAMPLES" "$KOSIT_VERSION" "$KOSIT_CONFIG_VERSION" "$KOSIT_SCENARIO" <<'PY' || kosit=1
import glob, os, sys
import xml.etree.ElementTree as ET

samples, version, config, scenario = sys.argv[1:5]
ns = {'rep': 'http://www.xoev.de/de/validator/varl/1', 's': 'http://www.xoev.de/de/validator/framework/1/scenarios'}
rejected = 0
for path in sorted(glob.glob(os.path.join(samples, '*.xml'))):
    name = os.path.basename(path)
    report = os.path.join(samples, 'kosit', name[:-4] + '-report.xml')
    if not os.path.isfile(report):
        print(f"FAIL {name}: no KoSIT report")
        rejected += 1
        continue
    root = ET.parse(report).getroot()
    matched = root.findtext('rep:scenarioMatched/s:scenario/s:name', '', ns)
    accepted = root.find('rep:assessment/rep:accept', ns) is not None
    ok = accepted and matched == scenario
    print(f"{'ok  ' if ok else 'FAIL'} {name}: {'acceptable' if accepted else 'reject'} (scenario \"{matched or 'none'}\")")
    for message in root.findall('.//rep:message', ns):
        text = ' '.join((message.text or '').split())
        print(f"     {message.get('level', '?'):7} {message.get('code', '')}: {text[:200]}")
    rejected += 0 if ok else 1
print(f"KoSIT validator {version}, configuration {config}, scenario {scenario}: {rejected} rejected")
sys.exit(1 if rejected else 0)
PY

exit $((schematron || kosit))
