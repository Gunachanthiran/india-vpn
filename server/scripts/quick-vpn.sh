#!/usr/bin/env bash
# Ultra-simple 1-step India WireGuard setup (no Docker, no FastAPI, no domain needed).
# Run on a Mumbai/Indian Ubuntu/Debian VPS and paste the printed config directly into the app.
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root: sudo $0" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"${SCRIPT_DIR}/setup-wireguard.sh"

PUBLIC_IP="$(curl -4 -s https://ifconfig.me || curl -4 -s https://api.ipify.org)"
"${SCRIPT_DIR}/add-peer.sh" myphone 10.8.0.2 "${PUBLIC_IP}"

echo ""
echo "============================================================"
echo "COPY & PASTE THIS INTO THE APP (Setup Config tab):"
echo "============================================================"
cat /etc/wireguard/clients/myphone.conf
echo "============================================================"
