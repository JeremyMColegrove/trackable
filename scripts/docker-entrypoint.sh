#!/bin/sh

set -eu

echo "Running Drizzle migrations..."
npm run db:migrate

echo "Starting standalone server..."
exec node server.js
