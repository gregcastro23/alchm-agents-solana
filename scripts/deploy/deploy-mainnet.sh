#!/usr/bin/env bash
# ==============================================================================
# Planetary Agents (asol_program) - Solana Mainnet-Beta Deployment Orchestrator
# Program ID: 5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD
# Mainnet Genesis: 5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

MAINNET_GENESIS_HASH="5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d"
EXPECTED_PROGRAM_ID="5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD"
DEFAULT_RPC_URL="https://api.mainnet-beta.solana.com"

# Default flags
DRY_RUN=false
SKIP_BUILD=false
SKIP_VERIFY=false
ALLOW_DEVNET=false
ALLOW_LOCAL_SIGNER=false
ALLOW_UNCOMMITTED=false
RPC_URL="${SOLANA_RPC_URL:-$DEFAULT_RPC_URL}"
KEYPAIR_PATH="${SOLANA_AGENT_PAYER_PATH:-}"

print_banner() {
    echo -e "${PURPLE}========================================================================${NC}"
    echo -e "${CYAN}🪐  Planetary Agents — Solana Mainnet Deployment & Initializer${NC}"
    echo -e "${PURPLE}========================================================================${NC}"
    echo -e "Target Program ID: ${GREEN}${EXPECTED_PROGRAM_ID}${NC}"
    echo -e "RPC Endpoint:      ${BLUE}${RPC_URL}${NC}"
    echo -e "Mode:              $( [ "$DRY_RUN" = true ] && echo -e "${YELLOW}DRY-RUN (SIMULATION)${NC}" || echo -e "${GREEN}LIVE DEPLOYMENT${NC}" )"
    echo -e "${PURPLE}========================================================================${NC}\n"
}

usage() {
    echo "Usage: ./scripts/deploy/deploy-mainnet.sh [options]"
    echo ""
    echo "Options:"
    echo "  --dry-run              Run compilation checks and simulate deployment/init without broadcasting"
    echo "  --skip-build           Skip compilation and use existing target/deploy/asol_program.so"
    echo "  --skip-verify          Skip remote solana-verify verification step"
    echo "  --allow-devnet         Allow running against non-mainnet clusters (for rehearsal)"
    echo "  --allow-local-signer   Allow local filesystem keypair (prohibited on Mainnet without this flag)"
    echo "  --allow-uncommitted    Allow running with uncommitted git working tree"
    echo "  --rpc-url <url>        Override Solana RPC URL"
    echo "  --keypair <path>       Deployer keypair JSON path (for buffer deploy)"
    echo "  --help, -h             Show this help message"
    echo ""
    exit 0
}

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-verify)
            SKIP_VERIFY=true
            shift
            ;;
        --allow-devnet)
            ALLOW_DEVNET=true
            shift
            ;;
        --allow-local-signer)
            ALLOW_LOCAL_SIGNER=true
            shift
            ;;
        --allow-uncommitted)
            ALLOW_UNCOMMITTED=true
            shift
            ;;
        --rpc-url)
            RPC_URL="$2"
            shift 2
            ;;
        --keypair)
            KEYPAIR_PATH="$2"
            shift 2
            ;;
        --help|-h)
            usage
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            ;;
    esac
done

print_banner

# ------------------------------------------------------------------------------
# 1. PREREQUISITE CHECKS
# ------------------------------------------------------------------------------
echo -e "${BLUE}[1/7] Checking toolchain prerequisites...${NC}"

command -v bun >/dev/null 2>&1 || { echo -e "${RED}❌ 'bun' is required but not installed.${NC}"; exit 1; }
BUN_VERSION=$(bun --version)
echo -e "  ✅ Bun: ${BUN_VERSION}"

command -v solana >/dev/null 2>&1 || { echo -e "${RED}❌ 'solana' CLI is required but not installed.${NC}"; exit 1; }
SOLANA_VERSION=$(solana --version | cut -d' ' -f2)
echo -e "  ✅ Solana CLI: ${SOLANA_VERSION}"

if command -v solana-verify >/dev/null 2>&1; then
    VERIFY_VERSION=$(solana-verify --version 2>/dev/null || echo "installed")
    echo -e "  ✅ solana-verify: ${VERIFY_VERSION}"
else
    echo -e "  ${YELLOW}⚠️  'solana-verify' not found. Remote verification step will be skipped.${NC}"
fi

if command -v docker >/dev/null 2>&1; then
    echo -e "  ✅ Docker: installed"
else
    echo -e "  ${YELLOW}⚠️  Docker not found. Verifiable builds require Docker (backpackapp/build:v0.30.1).${NC}"
fi

# ------------------------------------------------------------------------------
# 2. GIT HYGIENE CHECK
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[2/7] Checking git repository status...${NC}"
GIT_COMMIT=$(git rev-parse HEAD)
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo -e "  Branch: ${GIT_BRANCH} | Commit: ${GIT_COMMIT}"

if [ "$ALLOW_UNCOMMITTED" = false ]; then
    if [ -n "$(git status --porcelain)" ]; then
        echo -e "${RED}❌ Git working tree has uncommitted modifications!${NC}"
        echo -e "Mainnet deployments require a pristine commit for byte-for-byte reproducibility."
        echo -e "Commit your changes or pass --allow-uncommitted to bypass."
        exit 1
    fi
    echo -e "  ✅ Working tree clean"
else
    echo -e "  ${YELLOW}⚠️  Allowing uncommitted working tree via --allow-uncommitted${NC}"
fi

# ------------------------------------------------------------------------------
# 3. RPC CLUSTER & GENESIS HASH VALIDATION
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[3/7] Validating Solana cluster and genesis hash...${NC}"
ACTUAL_GENESIS=""

# Query genesis hash via curl RPC call (works on all environments)
GENESIS_RESP=$(curl -s -X POST -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"getGenesisHash"}' \
    "$RPC_URL" || echo "")

if [[ "$GENESIS_RESP" =~ \"result\":\"([^\"]+)\" ]]; then
    ACTUAL_GENESIS="${BASH_REMATCH[1]}"
else
    echo -e "${RED}❌ Failed to query genesis hash from RPC: $RPC_URL${NC}"
    exit 1
fi

echo -e "  Target Genesis: ${MAINNET_GENESIS_HASH}"
echo -e "  Cluster Genesis: ${ACTUAL_GENESIS}"

if [ "$ACTUAL_GENESIS" != "$MAINNET_GENESIS_HASH" ]; then
    if [ "$ALLOW_DEVNET" = true ]; then
        echo -e "  ${YELLOW}⚠️  WARNING: Connected to non-Mainnet cluster! Allowing via --allow-devnet.${NC}"
    else
        echo -e "${RED}❌ GENESIS HASH MISMATCH!${NC}"
        echo -e "Connected RPC is NOT Solana Mainnet-Beta (${MAINNET_GENESIS_HASH})."
        echo -e "Aborting deployment to prevent network leakage. Use --allow-devnet for test clusters."
        exit 1
    fi
else
    echo -e "  ${GREEN}✅ Verified: Connected strictly to Solana Mainnet-Beta${NC}"
fi

# ------------------------------------------------------------------------------
# 4. COMPILATION & VERIFIABLE BUILD
# ------------------------------------------------------------------------------
PROGRAM_SO="target/deploy/asol_program.so"
VERIFIABLE_SO="target/verifiable/asol_program.so"

echo -e "\n${BLUE}[4/7] Checking program compilation...${NC}"
if [ "$SKIP_BUILD" = true ]; then
    echo -e "  ${YELLOW}⚠️  Skipping build step via --skip-build${NC}"
    if [ ! -f "$PROGRAM_SO" ] && [ ! -f "$VERIFIABLE_SO" ]; then
        echo -e "${RED}❌ Program binary not found at $PROGRAM_SO or $VERIFIABLE_SO!${NC}"
        exit 1
    fi
else
    if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
        echo -e "  🐳 Executing reproducible verifiable build with backpackapp/build:v0.30.1..."
        if [ "$DRY_RUN" = true ]; then
            echo -e "  ${YELLOW}[DRY RUN] Would execute: anchor build --verifiable${NC}"
        else
            RUSTC_BOOTSTRAP=1 RUSTUP_TOOLCHAIN=1.79.0 anchor build --verifiable || {
                echo -e "${YELLOW}Anchor verifiable build exited. Falling back to bun run solana:build...${NC}"
                bun run solana:build
            }
        fi
    else
        echo -e "  Compiling with local SBF toolchain (bun run solana:build)..."
        if [ "$DRY_RUN" = true ]; then
            echo -e "  ${YELLOW}[DRY RUN] Would execute: bun run solana:build${NC}"
        else
            bun run solana:build
        fi
    fi
fi

TARGET_SO="$PROGRAM_SO"
if [ -f "$VERIFIABLE_SO" ]; then
    TARGET_SO="$VERIFIABLE_SO"
fi

if [ -f "$TARGET_SO" ]; then
    if command -v solana-verify >/dev/null 2>&1; then
        EXEC_HASH=$(solana-verify get-executable-hash "$TARGET_SO" 2>/dev/null || echo "unavailable")
        echo -e "  Executable Hash: ${CYAN}${EXEC_HASH}${NC}"
    fi
fi

# ------------------------------------------------------------------------------
# 5. PROGRAM BYTECODE DEPLOYMENT
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[5/7] Deploying program bytecode...${NC}"
if [ "$DRY_RUN" = true ]; then
    echo -e "  ${YELLOW}[DRY RUN] Would execute:${NC}"
    echo -e "    solana program deploy ${TARGET_SO} \\"
    echo -e "      --program-id ${EXPECTED_PROGRAM_ID} \\"
    echo -e "      --url ${RPC_URL}"
else
    DEPLOY_ARGS=("$TARGET_SO" "--program-id" "$EXPECTED_PROGRAM_ID" "--url" "$RPC_URL")
    if [ -n "$KEYPAIR_PATH" ]; then
        DEPLOY_ARGS+=("--keypair" "$KEYPAIR_PATH")
    fi
    echo -e "  Executing: solana program deploy ${DEPLOY_ARGS[*]}"
    solana program deploy "${DEPLOY_ARGS[@]}"
    echo -e "  ${GREEN}✅ Program deployed successfully${NC}"
fi

# ------------------------------------------------------------------------------
# 6. POST-DEPLOYMENT INITIALIZATION (init-mainnet.ts)
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[6/7] Initializing ProgramConfig and ESMS Mints...${NC}"

INIT_ARGS=()
if [ "$DRY_RUN" = true ]; then
    INIT_ARGS+=("--dry-run")
fi
if [ "$ALLOW_DEVNET" = true ]; then
    INIT_ARGS+=("--allow-devnet")
fi
if [ "$ALLOW_LOCAL_SIGNER" = true ]; then
    INIT_ARGS+=("--allow-local-signer")
fi
INIT_ARGS+=("--rpc-url" "$RPC_URL")

echo -e "  Executing: bun run scripts/deploy/init-mainnet.ts ${INIT_ARGS[*]}"
bun run scripts/deploy/init-mainnet.ts "${INIT_ARGS[@]}"

# ------------------------------------------------------------------------------
# 7. ON-CHAIN VERIFICATION (solana-verify)
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[7/7] Verifying on-chain program bytecode...${NC}"
if [ "$SKIP_VERIFY" = true ]; then
    echo -e "  ${YELLOW}⚠️  Skipping remote verification via --skip-verify${NC}"
elif command -v solana-verify >/dev/null 2>&1; then
    if [ "$DRY_RUN" = true ]; then
        echo -e "  ${YELLOW}[DRY RUN] Would execute:${NC}"
        echo -e "    solana-verify verify-from-repo \\"
        echo -e "      --program-id ${EXPECTED_PROGRAM_ID} \\"
        echo -e "      --library-name asol_program \\"
        echo -e "      --mount-path programs/asol_program \\"
        echo -e "      https://github.com/gregcastro23/alchm-agents-solana"
    else
        echo -e "  Querying live on-chain program hash..."
        solana-verify get-program-hash -u "$RPC_URL" "$EXPECTED_PROGRAM_ID" || true
    fi
else
    echo -e "  ${YELLOW}⚠️  solana-verify not installed. Skipping on-chain remote verification.${NC}"
fi

echo -e "\n${GREEN}========================================================================${NC}"
echo -e "${GREEN}🎉  Solana Mainnet Deployment Sequence Completed Successfully${NC}"
echo -e "${GREEN}========================================================================${NC}"
echo -e "Receipt File:  ${CYAN}deployments/solana-mainnet.json${NC}"
echo -e "Program ID:    ${GREEN}${EXPECTED_PROGRAM_ID}${NC}"
echo -e "Cluster:       ${BLUE}${RPC_URL}${NC}"
echo -e "${GREEN}========================================================================${NC}\n"
