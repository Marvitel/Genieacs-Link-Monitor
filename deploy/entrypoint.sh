#!/bin/sh
set -e

echo "Running database migrations..."
npx drizzle-kit push --force 2>&1 || echo "Warning: db push failed, tables may already exist"

echo "Starting NetControl ACS..."
exec node dist/index.cjs
