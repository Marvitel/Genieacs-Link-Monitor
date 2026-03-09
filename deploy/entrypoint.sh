#!/bin/sh
set -e

echo "Running database migrations..."
npx drizzle-kit push --force 2>&1 || echo "Warning: db push failed, tables may already exist"

echo "Creating session table if needed..."
PGPASSWORD=$(echo $DATABASE_URL | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p') \
PGHOST=$(echo $DATABASE_URL | sed -n 's|.*@\([^:]*\):.*|\1|p') \
PGPORT=$(echo $DATABASE_URL | sed -n 's|.*:\([0-9]*\)/.*|\1|p') \
PGDATABASE=$(echo $DATABASE_URL | sed -n 's|.*/\([^?]*\).*|\1|p') \
PGUSER=$(echo $DATABASE_URL | sed -n 's|.*://\([^:]*\):.*|\1|p')

node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(\`
  CREATE TABLE IF NOT EXISTS \"session\" (
    \"sid\" varchar NOT NULL COLLATE \"default\",
    \"sess\" json NOT NULL,
    \"expire\" timestamp(6) NOT NULL,
    CONSTRAINT \"session_pkey\" PRIMARY KEY (\"sid\")
  );
  CREATE INDEX IF NOT EXISTS \"IDX_session_expire\" ON \"session\" (\"expire\");
  CREATE TABLE IF NOT EXISTS \"network_snapshots\" (
    \"id\" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    \"online_count\" integer NOT NULL DEFAULT 0,
    \"offline_count\" integer NOT NULL DEFAULT 0,
    \"warning_count\" integer NOT NULL DEFAULT 0,
    \"total_count\" integer NOT NULL DEFAULT 0,
    \"created_at\" timestamp DEFAULT now()
  );
  ALTER TABLE \"devices\" ADD COLUMN IF NOT EXISTS \"parent_device_id\" varchar;
\`).then(() => {
  console.log('Session + network_snapshots + parent_device_id ready');
  pool.end();
}).catch(err => {
  console.error('Table creation error:', err.message);
  pool.end();
});
"

echo "Starting NetControl ACS..."
exec node dist/index.cjs
