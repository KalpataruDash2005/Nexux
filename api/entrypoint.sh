#!/bin/sh
set -e

echo "=========================================================="
echo " Starting NEXAURA / CareerOS Backend..."
echo "=========================================================="

# 1. Wait for MySQL to become ready and accept connections
echo "[STARTUP] Verifying MySQL connection..."
python - << 'EOF'
import sys
import time
import os
import pymysql

host = os.environ.get("MYSQL_HOST", "mysql")
port = int(os.environ.get("MYSQL_PORT", "3306"))
user = os.environ.get("MYSQL_USER", "careeros_user")
password = os.environ.get("MYSQL_PASSWORD", "careeros_pass")
db = os.environ.get("MYSQL_DATABASE", "careeros_db")

max_retries = 30
for attempt in range(1, max_retries + 1):
    try:
        conn = pymysql.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=db,
            connect_timeout=3
        )
        conn.close()
        print(f"[STARTUP] MySQL connection verified at {host}:{port}/{db}")
        sys.exit(0)
    except Exception as exc:
        print(f"[STARTUP] Waiting for MySQL ({host}:{port}/{db}) - Attempt {attempt}/{max_retries}: {exc}")
        time.sleep(2)

print("[STARTUP] ERROR: Could not connect to MySQL within timeout.", file=sys.stderr)
sys.exit(1)
EOF

# 2. Run idempotent database table creation / schema verification
echo "[STARTUP] Verifying database schema and initializing missing tables..."
python - << 'EOF'
import sys
try:
    from app.core.database import init_db
    init_db()
    print("[STARTUP] Database tables verified successfully.")
except Exception as exc:
    print(f"[STARTUP] Error during database initialization: {exc}", file=sys.stderr)
    sys.exit(1)
EOF

# 3. Launch Uvicorn
echo "[STARTUP] Starting Uvicorn server on 0.0.0.0:8000..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
