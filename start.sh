#!/usr/bin/env bash
# start.sh - Start RAG-Anything Web UI
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Build frontend if not already built
if [ ! -d "webui/dist" ]; then
    echo "Building frontend..."
    cd webui && npm install && npm run build && cd ..
fi

# Start backend
echo "Starting backend..."
source .venv/bin/activate
python -m backend
