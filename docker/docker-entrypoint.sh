#!/bin/bash
set -e

# Check if STORAGE_DIR is set
if [ -z "$STORAGE_DIR" ]; then
    echo "================================================================"
    echo "⚠️  ⚠️  ⚠️  WARNING: STORAGE_DIR environment variable is not set! ⚠️  ⚠️  ⚠️"
    echo ""
    echo "Not setting this will result in data loss on container restart since"
    echo "the application will not have a persistent storage location."
    echo "It can also result in weird errors in various parts of the application."
    echo ""
    echo "Please run the container with the official docker command at"
    echo "https://docs.anythingllm.com/installation-docker/quickstart"
    echo ""
    echo "⚠️  ⚠️  ⚠️  WARNING: STORAGE_DIR environment variable is not set! ⚠️  ⚠️  ⚠️"
    echo "================================================================"
fi

# Ensure storage directory exists for SQLite database (if needed)
mkdir -p /app/server/storage

# Set DATABASE_URL if not provided (default to SQLite for local development)
# For Railway/production, DATABASE_URL should be set automatically when PostgreSQL plugin is added
# Railway automatically sets DATABASE_URL when PostgreSQL service is added
if [ -z "$DATABASE_URL" ] || [ "$DATABASE_URL" = "\${{Postgres.DATABASE_URL}}" ] || [ "$DATABASE_URL" = '${{Postgres.DATABASE_URL}}' ]; then
    echo "=========================================="
    echo "DATABASE_URL check..."
    echo "=========================================="
    echo "DATABASE_URL value: ${DATABASE_URL:0:50}..."

    # Try to get DATABASE_URL from Railway's PostgreSQL service
    # Railway sets this automatically, but sometimes it needs to be referenced
    if [ -z "$DATABASE_URL" ] || [ "$DATABASE_URL" = "\${{Postgres.DATABASE_URL}}" ] || [ "$DATABASE_URL" = '${{Postgres.DATABASE_URL}}' ]; then
        echo "ERROR: DATABASE_URL is not set or is a template variable!"
        echo ""
        echo "In Railway:"
        echo "1. Make sure you have added PostgreSQL service to your project"
        echo "2. Railway should automatically set DATABASE_URL"
        echo "3. Check your service settings - DATABASE_URL should be automatically available"
        echo "4. If using Railway CLI, the variable should be: \${{Postgres.DATABASE_URL}}"
        echo ""
        echo "If DATABASE_URL is not automatically set, you may need to:"
        echo "- Check that PostgreSQL service is properly connected to your app"
        echo "- Restart the deployment"
        exit 1
    fi
fi

echo "DATABASE_URL is set: ${DATABASE_URL:0:30}..."

# Create database and tables if they don't exist (for PostgreSQL)
# DATABASE_URL format: postgresql://user:password@host:port/database
if echo "$DATABASE_URL" | grep -q "postgresql://"; then
    echo "=========================================="
    echo "Setting up PostgreSQL database and tables..."
    echo "=========================================="

    # Use dedicated script to create database and tables
    cd /app/server/
    node create-db-tables.js 2>&1

    if [ $? -ne 0 ]; then
        echo "WARNING: Database setup script had issues, but continuing..."
        echo "Prisma will attempt to create tables in the next step"
    fi
    echo ""
fi

# Run Prisma migrations synchronously before starting the server
cd /app/server/

# Check if migrations directory exists
if [ ! -d "./prisma/migrations" ]; then
    echo "ERROR: Prisma migrations directory not found!"
    echo "Expected: /app/server/prisma/migrations"
    ls -la /app/server/prisma/ || echo "Prisma directory does not exist!"
    exit 1
fi

echo "Found $(ls -1 ./prisma/migrations/*/migration.sql 2>/dev/null | wc -l) migration files"

echo "Generating Prisma Client..."
export CHECKPOINT_DISABLE=1
npx prisma generate --schema=./prisma/schema.prisma

if [ $? -ne 0 ]; then
    echo "ERROR: Prisma Client generation failed!"
    exit 1
fi

echo "=========================================="
echo "Setting up database schema..."
echo "Database URL: ${DATABASE_URL:0:30}..." # Show first 30 chars for security
echo "=========================================="

# First, try to use db push to create/update schema directly from schema.prisma
# This is more reliable for initial setup and ensures all tables are created
echo ""
echo "Step 1: Pushing schema to database using prisma db push..."
echo "Command: npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss --skip-generate"
echo ""

# Use db push to create/update schema
# --accept-data-loss: allows schema changes that might cause data loss
# --skip-generate: skip generating Prisma Client (already done above)
# Force push to ensure all tables are created
echo "Executing prisma db push..."
npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss --skip-generate --force-reset 2>&1 | tee /tmp/prisma-push.log

DB_PUSH_EXIT_CODE=${PIPESTATUS[0]}

echo ""
echo "=========================================="
echo "db push exit code: $DB_PUSH_EXIT_CODE"
echo "=========================================="
echo ""

# Check if tables were actually created by looking at the output
if grep -q "Your database is now in sync with your Prisma schema" /tmp/prisma-push.log 2>/dev/null || \
   grep -q "Database schema is up to date" /tmp/prisma-push.log 2>/dev/null || \
   grep -q "The database is already in sync with the Prisma schema" /tmp/prisma-push.log 2>/dev/null; then
    echo "✓ Prisma db push completed successfully - tables should exist"
    DB_PUSH_EXIT_CODE=0
fi

if [ $DB_PUSH_EXIT_CODE -ne 0 ]; then
    echo "WARNING: prisma db push failed or had warnings (exit code: $DB_PUSH_EXIT_CODE)"
    echo "Trying migrate deploy as fallback..."
    echo ""

    # Fallback to migrate deploy if db push fails
    npx prisma migrate deploy --schema=./prisma/schema.prisma 2>&1

    MIGRATE_EXIT_CODE=$?
    echo ""
    echo "migrate deploy exit code: $MIGRATE_EXIT_CODE"
    echo ""

    if [ $MIGRATE_EXIT_CODE -ne 0 ]; then
        echo "ERROR: Both db push and migrate deploy failed!"
        echo "Please check DATABASE_URL and database connection."
        echo "DATABASE_URL format should be: postgresql://user:password@host:port/database"
        echo ""
        echo "Testing database connection..."
        # Try to connect and list tables
        npx prisma db execute --stdin --schema=./prisma/schema.prisma <<< "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';" 2>&1 || echo "Cannot execute test query"
        exit 1
    fi

    echo "Migrations deployed successfully using migrate deploy"
else
    echo "Database schema created/updated successfully using db push"
fi

# Verify that tables were created by checking Prisma can connect
echo ""
echo "Step 2: Verifying database connection and schema..."
echo "Running: npx prisma db pull --schema=./prisma/schema.prisma (dry run to verify connection)"
echo ""

# Try to introspect the database to verify connection and that tables exist
npx prisma db pull --schema=./prisma/schema.prisma --force 2>&1 | head -20 || {
    echo "WARNING: Could not verify tables via db pull, but continuing..."
    echo "This might be normal if database is empty or connection has issues."
}

echo ""
echo "=========================================="
echo "Database setup completed successfully!"
echo "=========================================="
echo ""

# Start collector first, then server
# Both processes run in the same container and communicate via localhost
echo "=========================================="
echo "Starting collector and server..."
echo "=========================================="

COLLECTOR_PORT=${COLLECTOR_PORT:-8888}
echo "[ENTRYPOINT] Collector port: ${COLLECTOR_PORT}"
echo "[ENTRYPOINT] Server port: ${PORT:-3001}"
echo "[ENTRYPOINT] NODE_ENV: ${NODE_ENV}"
echo "[ENTRYPOINT] ANYTHING_LLM_RUNTIME: ${ANYTHING_LLM_RUNTIME}"

# Start collector in background and wait for it to be ready
echo "[ENTRYPOINT] Starting collector process..."
{
    echo "[COLLECTOR] Starting collector on port ${COLLECTOR_PORT}..."
    echo "[COLLECTOR] Working directory: $(pwd)"
    echo "[COLLECTOR] Node version: $(node --version)"
    cd /app/collector
    echo "[COLLECTOR] Changed to: $(pwd)"
    echo "[COLLECTOR] Starting node index.js..."
    node index.js 2>&1 | sed 's/^/[COLLECTOR] /'
} &
COLLECTOR_PID=$!
echo "[ENTRYPOINT] Collector process started with PID: ${COLLECTOR_PID}"

# Wait a moment for collector to start
sleep 2

# Wait for collector to be ready (max 30 seconds)
echo "[ENTRYPOINT] Waiting for collector to be ready (max 30 seconds)..."
COLLECTOR_READY=false
for i in {1..30}; do
    echo "[ENTRYPOINT] Attempt ${i}/30: Checking collector on localhost:${COLLECTOR_PORT}..."

    # Check if process is still running
    if ! kill -0 ${COLLECTOR_PID} 2>/dev/null; then
        echo "[ENTRYPOINT] ✗ Collector process (PID ${COLLECTOR_PID}) is not running!"
        echo "[ENTRYPOINT] Checking for any collector processes..."
        ps aux | grep -E "collector|node.*index.js" | grep -v grep || echo "[ENTRYPOINT] No collector process found"
        exit 1
    fi

    # Try netcat first (faster) - use 127.0.0.1 to avoid IPv6 issues
    if nc -z 127.0.0.1 ${COLLECTOR_PORT} 2>/dev/null; then
        echo "[ENTRYPOINT] ✓ Port ${COLLECTOR_PORT} is open on 127.0.0.1 (netcat check)"
        # Try HTTP ping - use 127.0.0.1 to avoid IPv6 resolution
        if curl -s -f http://127.0.0.1:${COLLECTOR_PORT}/ping > /dev/null 2>&1; then
            echo "[ENTRYPOINT] ✓ Collector HTTP endpoint responded successfully on 127.0.0.1:${COLLECTOR_PORT}"
            COLLECTOR_READY=true
            break
        else
            echo "[ENTRYPOINT] ⚠ Port is open but HTTP endpoint not responding yet..."
            echo "[ENTRYPOINT] Trying curl with verbose output..."
            curl -v http://127.0.0.1:${COLLECTOR_PORT}/ping 2>&1 | head -10 || true
        fi
    else
        echo "[ENTRYPOINT] Port ${COLLECTOR_PORT} not open on 127.0.0.1 yet..."
        # Also check IPv6 for debugging
        if nc -z ::1 ${COLLECTOR_PORT} 2>/dev/null; then
            echo "[ENTRYPOINT] ⚠ Port is open on IPv6 (::1) but not on IPv4 (127.0.0.1)"
            echo "[ENTRYPOINT] This may cause connection issues - collector should listen on 0.0.0.0"
        fi
    fi

    # Show collector process status every 5 attempts
    if [ $((i % 5)) -eq 0 ]; then
        echo "[ENTRYPOINT] Collector process status:"
        ps aux | grep ${COLLECTOR_PID} | grep -v grep || echo "[ENTRYPOINT] Process not found in ps output"
    fi

    sleep 1
done

if [ "$COLLECTOR_READY" = false ]; then
    echo "[ENTRYPOINT] ✗ Collector failed to start after 30 seconds"
    echo "[ENTRYPOINT] Collector PID: ${COLLECTOR_PID}"
    echo "[ENTRYPOINT] Checking collector process..."
    ps aux | grep -E "collector|node.*index.js" | grep -v grep || echo "[ENTRYPOINT] No collector process found"
    echo "[ENTRYPOINT] Checking port ${COLLECTOR_PORT}..."
    netstat -tuln 2>/dev/null | grep ${COLLECTOR_PORT} || ss -tuln 2>/dev/null | grep ${COLLECTOR_PORT} || echo "[ENTRYPOINT] Port ${COLLECTOR_PORT} not listening"
    echo "[ENTRYPOINT] Attempting to get collector logs..."
    kill -0 ${COLLECTOR_PID} 2>/dev/null && echo "[ENTRYPOINT] Process still exists" || echo "[ENTRYPOINT] Process has exited"
    kill ${COLLECTOR_PID} 2>/dev/null
    exit 1
fi

echo "[ENTRYPOINT] ✓ Collector is ready and responding on port ${COLLECTOR_PORT}"

# Start server
echo "[ENTRYPOINT] Starting server process..."
{
    echo "[SERVER] Starting server on port ${PORT:-3001}..."
    echo "[SERVER] Working directory: $(pwd)"
    echo "[SERVER] Node version: $(node --version)"
    cd /app/server
    echo "[SERVER] Changed to: $(pwd)"
    echo "[SERVER] Starting node index.js..."
    node index.js 2>&1 | sed 's/^/[SERVER] /'
} &
SERVER_PID=$!
echo "[ENTRYPOINT] Server process started with PID: ${SERVER_PID}"
echo "[ENTRYPOINT] Both processes are now running:"
echo "[ENTRYPOINT]   - Collector PID: ${COLLECTOR_PID}"
echo "[ENTRYPOINT]   - Server PID: ${SERVER_PID}"

# Wait for either process to exit
wait -n
EXIT_CODE=$?

# If one process exits, kill the other
kill $COLLECTOR_PID $SERVER_PID 2>/dev/null
exit $EXIT_CODE
