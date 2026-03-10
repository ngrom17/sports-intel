#!/usr/bin/env bash
# Start the FastAPI backend in a local venv.
# Usage: bash backend/start.sh  (from nba-dashboard/ root)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Load .env from project root
ENV_FILE="$SCRIPT_DIR/../.env"
if [ -f "$ENV_FILE" ]; then
  set -a && source "$ENV_FILE" && set +a
fi

# Create venv once
if [ ! -d ".venv" ]; then
  echo "Creating .venv..."
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install -q -r requirements.txt

echo ""
echo "  Backend: http://localhost:8090"
echo "  API docs: http://localhost:8090/docs"
echo ""

uvicorn main:app --host 0.0.0.0 --port 8090 --reload
