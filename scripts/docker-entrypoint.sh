#!/bin/sh

set -eu

umask 027

echo "Running Drizzle migrations..."
node ./scripts/run-migrations.mjs

echo "Starting standalone server..."
exec node server.js
