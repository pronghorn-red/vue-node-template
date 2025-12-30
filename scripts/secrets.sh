#!/bin/bash
# =============================================================================
# Pronghorn Secrets Generator - Unix/Mac Shell Script
# =============================================================================
# This script generates cryptographically secure secrets and updates .env
# Usage: ./secrets.sh [--force]
# =============================================================================

echo ""
echo "======================================"
echo " Pronghorn Secrets Generator v3.0.0"
echo "======================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check for --force flag
FORCE_FLAG=""
if [[ "$1" == "--force" || "$1" == "-f" ]]; then
    FORCE_FLAG="--force"
fi

# Run the Node.js secrets generator
node "${SCRIPT_DIR}/generate-secrets.js" --write $FORCE_FLAG

echo ""
echo "Done!"
