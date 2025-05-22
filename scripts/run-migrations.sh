#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-testuser}" # Matches ci.yml service
PG_PASSWORD="${PG_PASSWORD:-testpassword}" # Matches ci.yml service
PG_DATABASE="${PG_DATABASE:-testdb}" # Matches ci.yml service

export PGPASSWORD="$PG_PASSWORD"

echo "Running migrations from /migrations directory..."

# Check if migrations directory exists and contains SQL files
if [ ! -d "migrations" ] || ! ls migrations/*.sql 1> /dev/null 2>&1; then
  echo "No SQL files found in /migrations directory or directory does not exist."
  exit 0 # Exit successfully if no migrations to run
fi

for MIGRATION_FILE in $(ls migrations/*.sql | sort); do
  echo "Applying migration $MIGRATION_FILE..."
  psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" -v ON_ERROR_STOP=1 -f "$MIGRATION_FILE"
done

echo "All migrations applied successfully."
unset PGPASSWORD
