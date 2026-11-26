#!/usr/bin/env bash
# Add a WireGuard peer to a running wg0 interface without dropping existing sessions.
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root (sudo $0)" >&2
  exit 1
fi

PEER_NAME="${1:?Usage: $0 <peer_name> <client_ipv4> <server_endpoint> [wg_iface]}"
CLIENT_IPV4="${2:?Usage: $0 <peer_name> <client_ipv4> <server_endpoint> [wg_iface]}"
SERVER_ENDPOINT="${3:?Usage: $0 <peer_name> <client_ipv4> <server_endpoint> [wg_iface]}"
WG_INTERFACE="${4:-wg0}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
WG_CONF="/etc/wireguard/${WG_INTERFACE}.conf"
SERVER_PUB="$(cat "/etc/wireguard/keys/${WG_INTERFACE}.pub")"
WG_PORT="$(awk -F'= ' '/ListenPort/{print $2; exit}' "${WG_CONF}")"

umask 077
CLIENT_PRIV="$(wg genkey)"
CLIENT_PUB="$(printf '%s' "${CLIENT_PRIV}" | wg pubkey)"
CLIENT_PSK="$(wg genpsk)"

PSK_FILE="/etc/wireguard/keys/${PEER_NAME}.psk"
printf '%s\n' "${CLIENT_PSK}" > "${PSK_FILE}"

cat >> "${WG_CONF}" <<EOF

# BEGIN_PEER ${PEER_NAME}
[Peer]
PublicKey = ${CLIENT_PUB}
PresharedKey = ${CLIENT_PSK}
AllowedIPs = ${CLIENT_IPV4}/32
# END_PEER ${PEER_NAME}
EOF

wg set "${WG_INTERFACE}" peer "${CLIENT_PUB}" preshared-key "${PSK_FILE}" allowed-ips "${CLIENT_IPV4}/32"

OUT_CONF="/etc/wireguard/clients/${PEER_NAME}.conf"
sed \
  -e "s|{{CLIENT_PRIVATE_KEY}}|${CLIENT_PRIV}|g" \
  -e "s|{{CLIENT_ADDRESS_V4}}|${CLIENT_IPV4}|g" \
  -e "s|{{WG_DNS}}|1.1.1.1,9.9.9.9|g" \
  -e "s|{{WG_MTU}}|1420|g" \
  -e "s|{{SERVER_PUBLIC_KEY}}|${SERVER_PUB}|g" \
  -e "s|{{PRESHARED_KEY}}|${CLIENT_PSK}|g" \
  -e "s|{{SERVER_ENDPOINT}}|${SERVER_ENDPOINT}|g" \
  -e "s|{{WG_PORT}}|${WG_PORT:-51820}|g" \
  "${SERVER_DIR}/templates/client.conf.template" > "${OUT_CONF}"

echo "Peer '${PEER_NAME}' provisioned (${CLIENT_IPV4}/32). Config written to ${OUT_CONF}"
if command -v qrencode >/dev/null 2>&1; then
  qrencode -t ansiutf8 < "${OUT_CONF}"
fi
