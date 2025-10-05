#!/bin/bash
set -e

mkdir -p /etc/nginx/certs

# generate self-signed cert if not present
if [ ! -f /etc/nginx/certs/server.key ] || [ ! -f /etc/nginx/certs/server.crt ]; then
  echo "Generating self-signed certificate..."
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/certs/server.key \
    -out /etc/nginx/certs/server.crt \
    -subj "/C=US/ST=None/L=None/O=Local/OU=Dev/CN=localhost"
fi

exec "$@"
