#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-up}"
WG_IF="${2:-wg0}"
WAN_IF="${3:-$(ip -4 route show default | awk '/default/ {print $5; exit}')}"
WG_PORT="${4:-51820}"

if [[ -z "${WAN_IF}" ]]; then
  echo "ERROR: Could not detect default WAN interface." >&2
  exit 1
fi

apply_rules() {
  # IPv4 forwarding & NAT
  iptables -A FORWARD -i "${WG_IF}" -o "${WAN_IF}" -j ACCEPT
  iptables -A FORWARD -i "${WAN_IF}" -o "${WG_IF}" -m state --state RELATED,ESTABLISHED -j ACCEPT
  iptables -t nat -A POSTROUTING -o "${WAN_IF}" -j MASQUERADE

  # Clamp TCP MSS to PMTU to avoid fragmentation on Indian 4G/5G & broadband PPPoE links
  iptables -t mangle -A FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu

  # IPv6 forwarding & NAT (if IPv6 ULA is configured)
  if command -v ip6tables >/dev/null 2>&1; then
    ip6tables -A FORWARD -i "${WG_IF}" -o "${WAN_IF}" -j ACCEPT
    ip6tables -A FORWARD -i "${WAN_IF}" -o "${WG_IF}" -m state --state RELATED,ESTABLISHED -j ACCEPT
    ip6tables -t nat -A POSTROUTING -o "${WAN_IF}" -j MASQUERADE || true
    ip6tables -t mangle -A FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu || true
  fi
}

remove_rules() {
  iptables -D FORWARD -i "${WG_IF}" -o "${WAN_IF}" -j ACCEPT 2>/dev/null || true
  iptables -D FORWARD -i "${WAN_IF}" -o "${WG_IF}" -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true
  iptables -t nat -D POSTROUTING -o "${WAN_IF}" -j MASQUERADE 2>/dev/null || true
  iptables -t mangle -D FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu 2>/dev/null || true

  if command -v ip6tables >/dev/null 2>&1; then
    ip6tables -D FORWARD -i "${WG_IF}" -o "${WAN_IF}" -j ACCEPT 2>/dev/null || true
    ip6tables -D FORWARD -i "${WAN_IF}" -o "${WG_IF}" -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true
    ip6tables -t nat -D POSTROUTING -o "${WAN_IF}" -j MASQUERADE 2>/dev/null || true
    ip6tables -t mangle -D FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu 2>/dev/null || true
  fi
}

case "${ACTION}" in
  up)
    apply_rules
    ;;
  down)
    remove_rules
    ;;
  *)
    echo "Usage: $0 {up|down} [wg_iface] [wan_iface] [wg_port]" >&2
    exit 1
    ;;
esac
