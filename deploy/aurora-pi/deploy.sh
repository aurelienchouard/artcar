#!/usr/bin/env bash
# From your Mac: publish dist/index.html to aurora-pi and serve it at http://aurora.brc/artcar/
#   ./deploy/aurora-pi/deploy.sh                 # over Tailscale (pi@aurora-pi)
#   ./deploy/aurora-pi/deploy.sh pi@aurora-pi.local   # on the camp network
set -euo pipefail
HOST="${1:-pi@aurora-pi}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
[ -f "$ROOT/dist/index.html" ] || python3 "$ROOT/build.py"
scp -q "$ROOT/dist/index.html" "$HOST:/tmp/artcar-index.html"
scp -q "$HERE/nginx-artcar.conf" "$HERE/setup-pi.sh" "$HOST:/tmp/"
ssh -t "$HOST" 'bash /tmp/setup-pi.sh'
