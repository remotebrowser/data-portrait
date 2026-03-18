#!/bin/sh
set -e

if [ -n "${GOOGLE_APPLICATION_CREDENTIALS_JSON}" ]; then
    echo "GOOGLE_APPLICATION_CREDENTIALS_JSON found, decoding to file..."
    echo "${GOOGLE_APPLICATION_CREDENTIALS_JSON}" | base64 -d > /tmp/gcp-service-account.json
    export GOOGLE_APPLICATION_CREDENTIALS=/tmp/gcp-service-account.json
elif [ -n "${GOOGLE_APPLICATION_CREDENTIALS}" ]; then
    echo "GOOGLE_APPLICATION_CREDENTIALS found (file path), using as-is"
fi

if [ -n "${WG_CONFIG}" ]; then
    echo "Setting up WireGuard tunnel..."
    mkdir -p /etc/wireguard
    echo "${WG_CONFIG}" | base64 -d | grep -v "^DNS" > /etc/wireguard/wg0.conf
    wg-quick up wg0
    # Add Fly internal DNS for .flycast resolution
    FLY_DNS=$(echo "${WG_CONFIG}" | base64 -d | grep "^DNS" | cut -d= -f2 | tr -d ' ')
    if [ -n "$FLY_DNS" ]; then
        echo "nameserver $FLY_DNS" >> /etc/resolv.conf
    fi
    echo "WireGuard tunnel established"
else
    echo "WG_CONFIG not set, skipping WireGuard setup"
fi

if [ -n "${TAILSCALE_AUTHKEY}" ]; then
    /app/tailscaled --state=/var/lib/tailscale/tailscaled.state --socket=/var/run/tailscale/tailscaled.sock &
    /app/tailscale up --authkey="${TAILSCALE_AUTHKEY}" --hostname=data-portrait &
else
    echo "TAILSCALE_AUTHKEY not set, skipping Tailscale setup"
fi

echo "Starting Node app..."
npm start
