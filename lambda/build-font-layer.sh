#!/usr/bin/env bash
# Builds fonts-layer.zip for AWS Lambda. Unzips under /opt → /opt/fonts/...
# Attach as a layer + set FONTCONFIG_FILE=/opt/fonts/fonts.conf on the function.
set -euo pipefail
cd "$(dirname "$0")"
rm -f fonts-layer.zip
docker run --rm -v "$PWD":/work -w /work public.ecr.aws/amazonlinux/amazonlinux:2023 bash -c "
set -e
dnf install -y zip dejavu-sans-fonts fontconfig
rm -rf layer-staging
mkdir -p layer-staging/fonts
# AL2023 uses dejavu-sans-fonts/ (not older dejavu/). Copy as fonts/dejavu for fonts.conf <dir>/opt/fonts/dejavu</dir>
cp -a /usr/share/fonts/dejavu-sans-fonts layer-staging/fonts/dejavu
cp /work/font-layer/minimal-fonts.conf layer-staging/fonts/fonts.conf
cd layer-staging
zip -r /work/fonts-layer.zip .
"
echo "Created $(pwd)/fonts-layer.zip — upload as a Lambda layer, attach to your function, set FONTCONFIG_FILE=/opt/fonts/fonts.conf"
