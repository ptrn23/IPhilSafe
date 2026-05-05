#!/bin/bash
set -e

# Write WireGuard config from environment variable
mkdir -p /etc/wireguard
echo "$WG_CONFIG" > /etc/wireguard/wg0.conf
chmod 600 /etc/wireguard/wg0.conf

# Bring up the VPN tunnel
wg-quick up wg0

# Start the FastAPI server
exec uvicorn main:app --host 0.0.0.0 --port 8000
