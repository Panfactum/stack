#!/bin/sh
set -e

sed "s/@DB_USER_DEFAULT@/$DB_USER_DEFAULT/g; s/@DB_PASSWORD_DEFAULT@/$DB_PASSWORD_DEFAULT/g; s/@DB_USER_VISIBILITY@/$DB_USER_VISIBILITY/g; s/@DB_PASSWORD_VISIBILITY@/$DB_PASSWORD_VISIBILITY/g; s/@POD_IP@/$POD_IP/g" \
  /etc/temporal/config-template/config.yaml >/etc/temporal/config/config.yaml

echo "Rendered config:"
cat /etc/temporal/config/config.yaml
