#!/bin/bash

# Planvas - PocketBase Stop Script
# =====================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "🛑 Stopping Planvas PocketBase..."
docker compose down

echo ""
echo "✅ PocketBase stopped."
echo ""
echo "💡 Data is preserved in Docker volume 'tinyplanvas_pocketbase_data'."
echo "   To delete completely: docker compose down -v"
