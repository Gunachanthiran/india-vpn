#!/usr/bin/env bash
set -euo pipefail

WG_INTERFACE="${1:-wg0}"

if ! ip link show "${WG_INTERFACE}" >/dev/null 2>&1; then
  echo "UNHEALTHY: interface ${WG_INTERFACE} is down" >&2
  exit 1
fi

PEER_COUNT="$(wg show "${WG_INTERFACE}" peers | wc -l | tr -d ' ')"
LISTEN_PORT="$(wg show "${WG_INTERFACE}" listen-port)"
echo "OK: ${WG_INTERFACE} up on UDP ${LISTEN_PORT}, configured peers=${PEER_COUNT}"
