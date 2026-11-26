#!/usr/bin/env bash
# Ubuntu (22.04/24.04) & Debian (12+) WireGuard VPN Server Provisioner
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root (sudo $0)" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

WG_INTERFACE="${WG_INTERFACE:-wg0}"
WG_PORT="${WG_PORT:-51820}"
WG_ADDRESS_V4="${WG_ADDRESS_V4:-10.8.0.1/24}"
WG_ADDRESS_V6="${WG_ADDRESS_V6:-fd08:8::1/64}"
WG_MTU="${WG_MTU:-1420}"
WAN_INTERFACE="${WAN_INTERFACE:-$(ip -4 route show default | awk '/default/ {print $5; exit}')}"

if [[ -z "${WAN_INTERFACE}" ]]; then
  echo "ERROR: Unable to determine default WAN interface. Set WAN_INTERFACE=... and retry." >&2
  exit 1
fi

echo "==> Installing WireGuard, iptables, qrencode, and curl..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y wireguard wireguard-tools iptables iproute2 qrencode ufw curl ca-certificates

echo "==> Configuring kernel forwarding and BBR congestion control..."
cat >/etc/sysctl.d/99-india-wireguard.conf <<'EOF'
net.ipv4.ip_forward=1
net.ipv6.conf.all.forwarding=1
net.core.default_qdisc=fq
net.ipv4.tcp_congestion_control=bbr
net.ipv4.conf.all.rp_filter=1
net.ipv4.tcp_mtu_probing=1

# Gaming / real-time UDP buffer tuning to prevent micro-burst packet loss
net.core.rmem_max=26214400
net.core.wmem_max=26214400
net.core.rmem_default=1048576
net.core.wmem_default=1048576
net.core.netdev_max_backlog=5000
net.ipv4.udp_rmem_min=16384
net.ipv4.udp_wmem_min=16384
EOF
sysctl --system

echo "==> Installing firewall helper scripts..."
mkdir -p /etc/wireguard/firewall /etc/wireguard/keys /etc/wireguard/clients
install -m 0750 "${SERVER_DIR}/firewall/iptables-rules.sh" /etc/wireguard/firewall/iptables-rules.sh

KEY_FILE="/etc/wireguard/keys/${WG_INTERFACE}.key"
PUB_FILE="/etc/wireguard/keys/${WG_INTERFACE}.pub"

if [[ ! -f "${KEY_FILE}" ]]; then
  umask 077
  wg genkey | tee "${KEY_FILE}" | wg pubkey > "${PUB_FILE}"
fi

SERVER_PRIVATE_KEY="$(cat "${KEY_FILE}")"
SERVER_PUBLIC_KEY="$(cat "${PUB_FILE}")"

WG_CONF="/etc/wireguard/${WG_INTERFACE}.conf"
if [[ -f "${WG_CONF}" ]]; then
  cp "${WG_CONF}" "${WG_CONF}.bak.$(date +%Y%m%d%H%M%S)"
fi

echo "==> Writing ${WG_CONF} from template..."
sed \
  -e "s|{{WG_ADDRESS_V4}}|${WG_ADDRESS_V4}|g" \
  -e "s|{{WG_ADDRESS_V6}}|${WG_ADDRESS_V6}|g" \
  -e "s|{{WG_PORT}}|${WG_PORT}|g" \
  -e "s|{{SERVER_PRIVATE_KEY}}|${SERVER_PRIVATE_KEY}|g" \
  -e "s|{{WG_MTU}}|${WG_MTU}|g" \
  -e "s|{{WG_INTERFACE}}|${WG_INTERFACE}|g" \
  -e "s|{{WAN_INTERFACE}}|${WAN_INTERFACE}|g" \
  "${SERVER_DIR}/templates/wg0.conf.template" > "${WG_CONF}"
chmod 0600 "${WG_CONF}"

echo "==> Configuring UFW firewall (SSH, WireGuard UDP ${WG_PORT}, HTTPS 443)..."
ufw allow OpenSSH
ufw allow "${WG_PORT}/udp"
ufw allow 443/tcp
ufw --force enable

echo "==> Enabling and starting wg-quick@${WG_INTERFACE}..."
systemctl enable "wg-quick@${WG_INTERFACE}"
systemctl restart "wg-quick@${WG_INTERFACE}"

echo "============================================================"
echo "WireGuard ${WG_INTERFACE} is active!"
echo "WAN Interface : ${WAN_INTERFACE}"
echo "Listen Port   : ${WG_PORT}/udp"
echo "Server PubKey : ${SERVER_PUBLIC_KEY}"
echo "============================================================"
