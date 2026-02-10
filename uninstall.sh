#!/bin/bash
# uninstall.sh - Remove Smriti
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/zero8dotdev/smriti/main/uninstall.sh | bash
#
# Environment variables:
#   SMRITI_DIR       - Install directory (default: ~/.smriti)
#   SMRITI_BIN_DIR   - Binary directory (default: ~/.local/bin)
#   SMRITI_PURGE     - Set to 1 to also remove the database and hook state

set -euo pipefail

SMRITI_DIR="${SMRITI_DIR:-$HOME/.smriti}"
SMRITI_BIN_DIR="${SMRITI_BIN_DIR:-$HOME/.local/bin}"

info()  { printf "\033[1;34m==>\033[0m \033[1m%s\033[0m\n" "$*"; }
ok()    { printf "\033[1;32m==>\033[0m %s\n" "$*"; }
warn()  { printf "\033[1;33mwarning:\033[0m %s\n" "$*"; }

info "Uninstalling Smriti..."

# --- Remove binary ------------------------------------------------------------

if [ -f "$SMRITI_BIN_DIR/smriti" ]; then
  rm "$SMRITI_BIN_DIR/smriti"
  ok "Removed $SMRITI_BIN_DIR/smriti"
else
  warn "Binary not found at $SMRITI_BIN_DIR/smriti"
fi

# --- Remove install directory -------------------------------------------------

if [ -d "$SMRITI_DIR" ]; then
  rm -rf "$SMRITI_DIR"
  ok "Removed $SMRITI_DIR"
else
  warn "Install directory not found at $SMRITI_DIR"
fi

# --- Remove Claude Code hook --------------------------------------------------

HOOK_SCRIPT="$HOME/.claude/hooks/save-memory.sh"
if [ -f "$HOOK_SCRIPT" ]; then
  rm "$HOOK_SCRIPT"
  ok "Removed Claude Code hook: $HOOK_SCRIPT"
  warn "The hook entry in ~/.claude/settings.json was left in place."
  echo "  Edit ~/.claude/settings.json to remove the save-memory.sh reference if desired."
fi

# --- Purge data (optional) ----------------------------------------------------

if [ "${SMRITI_PURGE:-0}" = "1" ]; then
  info "Purging data..."

  # Remove hook state
  if [ -d "$HOME/.cache/qmd/memory-hooks" ]; then
    rm -rf "$HOME/.cache/qmd/memory-hooks"
    ok "Removed hook state: ~/.cache/qmd/memory-hooks"
  fi

  # The SQLite database is shared with QMD, so we warn instead of deleting
  DB_PATH="${QMD_DB_PATH:-$HOME/.cache/qmd/index.sqlite}"
  if [ -f "$DB_PATH" ]; then
    warn "Database at $DB_PATH is shared with QMD and was NOT removed."
    echo "  To remove it manually: rm $DB_PATH"
  fi
fi

# --- Done ---------------------------------------------------------------------

echo ""
ok "Smriti uninstalled."
echo ""
if [ "${SMRITI_PURGE:-0}" != "1" ]; then
  echo "  Your data was kept. To also remove hook state, re-run with:"
  echo "    SMRITI_PURGE=1 bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/zero8dotdev/smriti/main/uninstall.sh)\""
  echo ""
fi
