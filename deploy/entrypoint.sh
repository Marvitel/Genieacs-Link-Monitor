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
\`).then(() => {
  console.log('Session table ready');
  pool.end();
}).catch(err => {
  console.error('Session table error:', err.message);
  pool.end();
});
"

echo "Starting NetControl ACS..."
exec node dist/index.cjs
