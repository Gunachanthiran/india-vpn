# Contributing to India WireGuard VPN

Thank you for contributing to this open-source project!

## Development Checks

Before opening a pull request, please verify:

1. **Backend (`backend/`)**
   ```bash
   cd backend
   python -m venv .venv
   # Activate .venv, then:
   pip install -r requirements.txt
   pytest -v
   ```
2. **Mobile (`mobile/`)**
   ```bash
   cd mobile
   npm install
   npm run typecheck
   npm test
   ```
3. **Server scripts (`server/`)**
   ```bash
   bash -n server/scripts/*.sh server/firewall/iptables-rules.sh
   ```

## Security & Cryptography Notes
- Do not commit `.env`, private keys (`*.key`, `*.pem`), Android release keystores (`*.jks`, `*.keystore`), or SQLite database files.
- Keep `COMPLIANCE_MODE` behavior explicit and tested (`private` vs `cert_in_audit`).
