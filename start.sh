#!/bin/sh
set -e

if [ -n "${GOOGLE_APPLICATION_CREDENTIALS_JSON}" ]; then
    echo "GOOGLE_APPLICATION_CREDENTIALS_JSON found, decoding to file..."
    echo "${GOOGLE_APPLICATION_CREDENTIALS_JSON}" | base64 -d > /tmp/gcp-service-account.json
    export GOOGLE_APPLICATION_CREDENTIALS=/tmp/gcp-service-account.json
elif [ -n "${GOOGLE_APPLICATION_CREDENTIALS}" ]; then
    echo "GOOGLE_APPLICATION_CREDENTIALS found (file path), using as-is"
fi

if [ -n "${TAILSCALE_AUTHKEY}" ]; then
    /app/tailscaled --state=/var/lib/tailscale/tailscaled.state --socket=/var/run/tailscale/tailscaled.sock &
    /app/tailscale up --authkey="${TAILSCALE_AUTHKEY}" --hostname=data-portrait &
else
    echo "TAILSCALE_AUTHKEY not set, skipping Tailscale setup"
fi

echo "Starting Node app..."
npm start
