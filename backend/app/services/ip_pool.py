import ipaddress
from collections.abc import Iterable


class IPPoolExhaustedError(RuntimeError):
    """Raised when a WireGuard server subnet has no remaining assignable client IPs."""


def allocate_next_ip(subnet_cidr: str, used_ips: Iterable[str]) -> str:
    """Allocate the lowest unused host IPv4 address from subnet_cidr, reserving the .1 gateway."""
    network = ipaddress.IPv4Network(subnet_cidr, strict=False)
    used_set = {ipaddress.IPv4Address(ip.split("/")[0]) for ip in used_ips}

    hosts = list(network.hosts())
    if len(hosts) < 2:
        raise IPPoolExhaustedError(f"Subnet {subnet_cidr} is too small for VPN peer allocation")

    # Reserve the first usable host (.1) as the WireGuard server tunnel gateway.
    gateway_ip = hosts[0]
    for candidate in hosts[1:]:
        if candidate != gateway_ip and candidate not in used_set:
            return str(candidate)

    raise IPPoolExhaustedError(f"No free IP addresses left in subnet {subnet_cidr}")
