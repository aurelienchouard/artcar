#!/usr/bin/env bash
# Runs on aurora-pi (deploy.sh copies it over). Idempotent: safe to run again for each update.
set -euo pipefail
PI_IP="${PI_IP:-192.168.0.1}"    # the Pi's address on the Aurora network (eth0 static IP)

# 1. The page
sudo mkdir -p /var/www/artcar
sudo install -m 644 /tmp/artcar-index.html /var/www/artcar/index.html

# 2. A web server on port 80
if ! command -v nginx >/dev/null 2>&1; then
  if sudo ss -ltnH '( sport = :80 )' | grep -q .; then
    echo "Port 80 is already taken by something other than nginx:" >&2
    sudo ss -ltnp '( sport = :80 )' >&2
    echo "Serve /var/www/artcar/index.html from that app at /artcar/ instead (see README), then rerun with SKIP_WEB=1." >&2
    [ "${SKIP_WEB:-0}" = 1 ] || exit 1
  else
    echo "Installing nginx (needs internet: do this before the playa)"
    sudo apt-get update -qq && sudo apt-get install -y -qq nginx
  fi
fi
if command -v nginx >/dev/null 2>&1 && [ "${SKIP_WEB:-0}" != 1 ]; then
  sudo install -m 644 /tmp/nginx-artcar.conf /etc/nginx/sites-available/artcar
  sudo ln -sf /etc/nginx/sites-available/artcar /etc/nginx/sites-enabled/artcar
  sudo nginx -t
  sudo systemctl enable --now nginx >/dev/null 2>&1 || true
  sudo systemctl reload nginx
fi

# 3. The name: aurora.brc points at this Pi for everyone on the Aurora Wi-Fi (dnsmasq already hands out DHCP here)
LINE="address=/aurora.brc/${PI_IP}"
if ! sudo grep -qsF "$LINE" /etc/dnsmasq.conf /etc/dnsmasq.d/*.conf; then
  printf '\n# Art Car Studio: http://aurora.brc/artcar/\n%s\n' "$LINE" | sudo tee -a /etc/dnsmasq.conf >/dev/null
fi
if sudo grep -qE '^[[:space:]]*port=0' /etc/dnsmasq.conf; then
  echo "WARNING: dnsmasq has DNS switched off (port=0), so aurora.brc won't resolve until that line goes." >&2
fi
sudo systemctl restart dnsmasq

# 4. Check it from the Pi itself
if curl -fsS -o /dev/null -H 'Host: aurora.brc' http://127.0.0.1/artcar/; then
  echo "Live: http://aurora.brc/artcar/  (on the Aurora Wi-Fi; type the http:// part)"
else
  echo "The page didn't answer on port 80; check 'sudo nginx -t' and 'sudo systemctl status nginx'." >&2
  exit 1
fi
