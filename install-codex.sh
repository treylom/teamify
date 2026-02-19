#!/bin/bash
# teamify_codex installer
# Installs teamify (base) + Codex hybrid mode (teamify_codex command + setup script).
# Run this AFTER teamify base is installed, or it will install both.

set -e

REPO="https://github.com/treylom/teamify"
BRANCH="feature/codex"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Colors ──
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}[OK]${NC} $1"; }
warn() { echo -e "  ${YELLOW}[!!]${NC} $1"; }
info() { echo -e "  ${CYAN}[i]${NC} $1"; }

echo -e "${BOLD}teamify_codex installer${NC}"
echo ""

# ── Detect source ──
if [ -f "$SCRIPT_DIR/commands/teamify_codex.md" ]; then
  SRC="$SCRIPT_DIR"
else
  TEMP=$(mktemp -d)
  echo "Cloning teamify (${BRANCH} branch)..."
  git clone --depth 1 -b "$BRANCH" "$REPO" "$TEMP/teamify" 2>/dev/null
  SRC="$TEMP/teamify"
  CLEANUP=true
fi

# ── Step 1: Install base teamify if missing ──
if [ ! -f ".claude/commands/teamify.md" ]; then
  warn "Base teamify not found. Installing base first..."
  bash "$SRC/install.sh"
  echo ""
fi

# ── Step 2: Install teamify_codex command ──
mkdir -p .claude/commands
cp "$SRC/commands/teamify_codex.md" .claude/commands/
ok ".claude/commands/teamify_codex.md"

# ── Step 3: Install setup script ──
mkdir -p .claude/scripts
cp "$SRC/scripts/setup-teamify-codex.sh" .claude/scripts/
chmod +x .claude/scripts/setup-teamify-codex.sh
ok ".claude/scripts/setup-teamify-codex.sh"

# ── Cleanup ──
if [ "$CLEANUP" = true ]; then
  rm -rf "$TEMP"
fi

echo ""
echo -e "${BOLD}teamify_codex installed successfully!${NC}"
echo ""
echo "Next steps:"
echo ""
echo -e "  1. Run dependency check:"
echo -e "     ${CYAN}bash .claude/scripts/setup-teamify-codex.sh${NC}"
echo ""
echo -e "  2. Auto-install missing dependencies:"
echo -e "     ${CYAN}AUTO_INSTALL=1 bash .claude/scripts/setup-teamify-codex.sh${NC}"
echo ""
echo -e "  3. Start using (in tmux session):"
echo -e "     ${CYAN}claude${NC}  →  ${CYAN}/teamify_codex${NC}"
echo ""
echo "Requirements:"
echo "  - All teamify requirements (tmux, Claude Code, Agent Teams)"
echo "  - Codex CLI:     npm install -g @openai/codex"
echo "  - CLIProxyAPI:   git clone https://github.com/router-for-me/CLIProxyAPI.git ~/CLIProxyAPI"
echo "  - OAuth token:   cd ~/CLIProxyAPI && ./cli-proxy-api (TUI auth)"
echo ""
