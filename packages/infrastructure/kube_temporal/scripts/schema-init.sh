#!/bin/sh
set -e

echo "Creating schemas in the app database..."
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d app \
  -c "CREATE SCHEMA IF NOT EXISTS temporal; CREATE SCHEMA IF NOT EXISTS temporal_visibility;"

echo "Applying temporal schema migrations..."
temporal-sql-tool --plugin postgres12 --ep "$DB_HOST" -p "$DB_PORT" -u "$DB_USER" --pw "$DB_PASSWORD" --db app --ca search_path=temporal setup-schema -v 0.0
temporal-sql-tool --plugin postgres12 --ep "$DB_HOST" -p "$DB_PORT" -u "$DB_USER" --pw "$DB_PASSWORD" --db app --ca search_path=temporal update-schema -d /etc/temporal/schema/postgresql/v12/temporal/versioned/

echo "Applying temporal_visibility schema migrations..."
temporal-sql-tool --plugin postgres12 --ep "$DB_HOST" -p "$DB_PORT" -u "$DB_USER" --pw "$DB_PASSWORD" --db app --ca search_path=temporal_visibility setup-schema -v 0.0
temporal-sql-tool --plugin postgres12 --ep "$DB_HOST" -p "$DB_PORT" -u "$DB_USER" --pw "$DB_PASSWORD" --db app --ca search_path=temporal_visibility update-schema -d /etc/temporal/schema/postgresql/v12/visibility/versioned/

echo "Schema initialization complete."
