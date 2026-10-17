#!/bin/sh
# Packages apps/extension as apps/web/public/boranois-extensao.zip (served by the "Baixar" button).
set -e
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
cp -R apps/extension "$tmp/boranois-extensao"
mkdir -p apps/web/public
rm -f apps/web/public/boranois-extensao.zip
(cd "$tmp" && zip -qr - boranois-extensao) > apps/web/public/boranois-extensao.zip
rm -rf "$tmp"
echo "Wrote apps/web/public/boranois-extensao.zip"
