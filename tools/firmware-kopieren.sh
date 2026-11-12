#!/usr/bin/env bash
# Copies the ESP32 firmware for the web flasher (de/flashen.html, en/flash.html)
# from the main project into firmware/ and writes the version into the manifest
# and onto both flasher pages.
#
# Usage: tools/firmware-kopieren.sh [path to the zeichenroboter repo]
# Build first:  cd ~/projects/zeichenroboter/firmware && pio run -e esp32
set -euo pipefail

SRC="${1:-$HOME/projects/zeichenroboter}"
SITE="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$SRC/firmware/.pio/build/esp32"
BOOT_APP0="${BOOT_APP0:-${PLATFORMIO_CORE_DIR:-$HOME/.platformio}/packages/framework-arduinoespressif32/tools/partitions/boot_app0.bin}"
CONFIG="$SRC/firmware/src/config.h"

for f in "$BUILD/bootloader.bin" "$BUILD/partitions.bin" "$BUILD/firmware.bin" "$BOOT_APP0" "$CONFIG"; do
  [ -f "$f" ] || { echo "Fehlt: $f (erst 'pio run -e esp32' im Hauptprojekt; boot_app0.bin anderswo: BOOT_APP0=<Pfad>)" >&2; exit 1; }
done

VERSION="$(sed -n 's/^#define FIRMWARE_VERSION "\(.*\)"/\1/p' "$CONFIG")"
[ -n "$VERSION" ] || { echo "FIRMWARE_VERSION nicht gefunden in $CONFIG" >&2; exit 1; }
grep -qaF "$VERSION" "$BUILD/firmware.bin" || { echo "firmware.bin enthält $VERSION nicht – bitte neu bauen" >&2; exit 1; }

mkdir -p "$SITE/firmware"
cp "$BUILD/bootloader.bin" "$BUILD/partitions.bin" "$BUILD/firmware.bin" "$SITE/firmware/"
cp "$BOOT_APP0" "$SITE/firmware/"

sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$SITE/firmware/manifest.json"
for page in "$SITE/de/flashen.html" "$SITE/en/flash.html"; do
  sed -i "s|<span class=\"firmware-version\">[^<]*</span>|<span class=\"firmware-version\">$VERSION</span>|g" "$page"
done

echo "Firmware $VERSION kopiert:"
ls -l "$SITE/firmware/"*.bin
