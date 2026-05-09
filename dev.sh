#!/usr/bin/env bash
set -e
set -m  # enable job control for process groups

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Kill any leftover process on port 3000
EXISTING_PID=$(lsof -ti :3000 2>/dev/null || true)
if [ -n "$EXISTING_PID" ]; then
    echo -e "${YELLOW}Killing existing process on port 3000 (PID: $EXISTING_PID)...${NC}"
    kill $EXISTING_PID 2>/dev/null || true
    sleep 1
    # Force kill if still alive
    kill -9 $EXISTING_PID 2>/dev/null || true
fi

cleanup() {
    echo -e "\n${YELLOW}Shutting down...${NC}"
    # Kill entire process groups (catches cargo/npm children, not just sed)
    kill -- -$BACKEND_PID -$FRONTEND_PID 2>/dev/null || true
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    echo -e "${GREEN}Done.${NC}"
}
trap cleanup EXIT INT TERM

# Check .env
if [ ! -f .env ]; then
    echo -e "${RED}.env file missing. Copy .env.example and fill in values:${NC}"
    echo "  cp .env.example .env"
    exit 1
fi

# Check dependencies
command -v cargo >/dev/null 2>&1 || { echo -e "${RED}cargo not found. Install Rust: https://rustup.rs${NC}"; exit 1; }
command -v npm >/dev/null 2>&1   || { echo -e "${RED}npm not found. Install Node.js: https://nodejs.org${NC}"; exit 1; }

# Install frontend deps if needed
if [ ! -d frontend/node_modules ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    (cd frontend && npm install)
fi

echo -e "${GREEN}Starting backend (cargo run) on :3000...${NC}"
cargo run 2>&1 | sed 's/^/[backend] /' &
BACKEND_PID=$!

echo -e "${GREEN}Starting frontend (vite) on :5173...${NC}"
(cd frontend && npm run dev) 2>&1 | sed 's/^/[frontend] /' &
FRONTEND_PID=$!

echo -e "${GREEN}
  Backend:  http://localhost:3000
  Frontend: http://localhost:5173  (proxies /api, /auth, /webhooks -> backend)
${NC}"

wait
