#!/bin/sh
set -e

sed "s/@DB_USER@/$DB_USER/g; s/@DB_PASSWORD@/$DB_PASSWORD/g; s/@POD_IP@/$POD_IP/g" \
  /etc/temporal/config-template/config.yaml >/etc/temporal/config/config.yaml

echo "Rendered config:"
cat /etc/temporal/config/config.yaml
