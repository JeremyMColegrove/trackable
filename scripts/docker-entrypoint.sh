#!/bin/sh

set -eu

umask 027

echo "Setting up database roles..."
node ./scripts/setup-db-roles.mjs

echo "Running Drizzle migrations..."
node ./scripts/run-migrations.mjs

echo "Starting standalone server..."
exec node server.js
