#!/usr/bin/env bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cleanup() {
    echo -e "\n${YELLOW}Shutting down...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
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
