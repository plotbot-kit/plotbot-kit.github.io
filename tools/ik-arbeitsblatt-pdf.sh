#!/bin/sh
# Druckt die Arbeitsblätter der Seite „Inverse Kinematik verstehen“ als PDF (A4, Maßstab 1:1).
# Vorher: node tools/ik-figuren.js. Braucht Google Chrome oder Chromium. Aufruf aus dem Wurzelverzeichnis.
set -e
CHROME=${CHROME:-google-chrome}
for f in de/kinematik/verstehen/arbeitsblatt en/kinematics/explained/worksheet; do
  "$CHROME" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="$f.pdf" "file://$PWD/$f.html" 2>/dev/null
done
