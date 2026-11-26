#!/usr/bin/env bash
# Remove a WireGuard peer cleanly from the live interface and wg0.conf.
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root (sudo $0)" >&2
  exit 1
fi

PEER_NAME="${1:?Usage: $0 <peer_name> [wg_iface]}"
WG_INTERFACE="${2:-wg0}"
WG_CONF="/etc/wireguard/${WG_INTERFACE}.conf"

PUB_KEY="$(awk "/# BEGIN_PEER ${PEER_NAME}$/{flag=1} flag && /^PublicKey/{print \$3; exit}" "${WG_CONF}")"
if [[ -n "${PUB_KEY}" ]]; then
  wg set "${WG_INTERFACE}" peer "${PUB_KEY}" remove || true
fi

TMP_CONF="$(mktemp)"
awk "/# BEGIN_PEER ${PEER_NAME}$/{skip=1} !skip{print} /# END_PEER ${PEER_NAME}$/{skip=0}" "${WG_CONF}" > "${TMP_CONF}"
mv "${TMP_CONF}" "${WG_CONF}"
chmod 0600 "${WG_CONF}"

rm -f "/etc/wireguard/keys/${PEER_NAME}.psk" "/etc/wireguard/clients/${PEER_NAME}.conf"
echo "Removed peer '${PEER_NAME}' from ${WG_INTERFACE}."
