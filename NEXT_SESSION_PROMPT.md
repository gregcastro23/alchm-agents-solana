# Next Session Prompt — Solana Mainnet Live Execution Runbook (Gate 4 ➔ Gate 8 & 9)

> **Target Repository:** [`/Users/cookingwithcastro/Desktop/AlchmAgentsSolana`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana)  
> **Target Program ID:** `5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD`  
> **Authoritative Roadmap:** [`docs/SOLANA_MAINNET_MIGRATION_ROADMAP.md`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/docs/SOLANA_MAINNET_MIGRATION_ROADMAP.md) (`v3.0.0-PRODUCTION-READY`)  
> **Mainnet Genesis Hash:** `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`  
> **Runtime / Toolchain:** Bun (`bun` and `bun --bun run dev`) | Anchor `0.30.1` | Solana `1.18.17` | Rust `1.79.0` | Docker `backpackapp/build:v0.30.1`  
> **Current Verification Status:** ✅ **17/17 test files passing (196 tests)** | 42/42 Anchor Rust tests passing | `bun run typecheck:solana` clean (0 errors)  
> **Immediate Execution Goal:** Complete **Gate 4 (Live Arweave Metadata Upload & Constants Pinning)**, execute the **Devnet Dress Rehearsal Drill**, and execute **Gates 8 & 9 (Mainnet Deployment, Idempotent PDA Init, Squads v4 Handoff, Bytecode Verification)**.

---

## 🚀 Execution Context & What Was Accomplished

All **six critical launch blockers** and **four material weaknesses** from the pre-flight readiness audit have been remediated, refactored, and verified in code:

1. **Phase 1 & 2 Remediation:** AWS KMS HSM Ed25519 signer integration (`@aws-sdk/client-kms`), dynamic 65th percentile prioritization fees, compute budget injection (indices 0 and 1), and multi-tier streaming failover.
2. **Unified Single Source of Network Truth:** [`lib/solana/network-config.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/network-config.ts) pinned to Mainnet genesis hash `5eykt...`, with fail-closed production guards rejecting Devnet RPC fallback.
3. **Hardened Feeder & Dual-Rail Storefront:** Dynamic `SolanaWalletProvider.tsx`, detached Ed25519 `redeem_for_esms` flow, `hasOrderReceipt` idempotency guards, and server-side Keplerian celestial ephemeris.
4. **Phase 7 Deployment & Verification Tooling:** [`deploy-mainnet.sh`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/scripts/deploy/deploy-mainnet.sh), [`init-mainnet.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/scripts/deploy/init-mainnet.ts), [`deployments/solana-mainnet.json`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/deployments/solana-mainnet.json), and [`.env.production.sample`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/.env.production.sample) fully tested (7 tests).
5. **Settlement Sync Worker & Durable Reconciliation Engine:** Webhook authentication, depth monitoring, `SettlementProof` signature recovery, protocol `MAX_LEDGER_ATOMS` parity, and 15-minute staleness audits via [`reconcile-solana-state.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/scripts/reconciliation/reconcile-solana-state.ts) (12 tests).
6. **Roadmap Modernization:** Upgraded [`docs/SOLANA_MAINNET_MIGRATION_ROADMAP.md`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/docs/SOLANA_MAINNET_MIGRATION_ROADMAP.md) to `v3.0.0-PRODUCTION-READY`, incorporating Jito Block Engine MEV protection, Stake-Weighted QoS (SWQoS) topology, Token-2022 account rent matrices, and Squads v4 multisig runbooks.

---

## 🎯 Next Session Objective: Live Mainnet Execution Blueprint

The codebase is **100% code-complete, typechecked, and verified**. The next session is dedicated to **live operator execution** on Arweave and Solana Mainnet-Beta.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        MAINNET LIVE EXECUTION WORKFLOW                                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Priority 1: Gate 4 — Live Arweave Metadata Upload & Constants Pinning                  │
│   - Fund Irys uploader (~0.05 SOL)                                                     │
│   - Execute: bun run scripts/metadata/upload-arweave-metadata.ts --confirm             │
│   - Commit populated arweave-manifest.json & patch constants.rs                        │
│   - Re-compile with SBF 4 KiB stack overflow check: bun run solana:build               │
│                                           │                                            │
│                                           ▼                                            │
│ Priority 2: Pre-Mainnet Devnet End-to-End Dress Rehearsal                              │
│   - Dry-run deployer & initializer on Devnet                                           │
│   - Live Devnet AMM lifecycle drill (register -> bootstrap -> add -> swap -> withdraw)│
│   - Baseline reconciliation audit check (bun run solana:reconcile --dry-run)           │
│                                           │                                            │
│                                           ▼                                            │
│ Priority 3: Gate 8 — Live Program Deployment to Solana Mainnet-Beta                    │
│   - Verify deployer key balance (>= 14.5 SOL peak rent requirement)                    │
│   - Execute verifiable Docker deploy: bash scripts/deploy/deploy-mainnet.sh            │
│   - Confirm Program ID: 5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD                   │
│                                           │                                            │
│                                           ▼                                            │
│ Priority 4: Gate 8 — Idempotent On-Chain PDA Initialization                            │
│   - Execute: bun run scripts/deploy/init-mainnet.ts                                    │
│   - Initialize ProgramConfig & 4 Token-2022 EsmsMints with immutable Arweave URIs     │
│   - Commit populated deployments/solana-mainnet.json                                   │
│                                           │                                            │
│                                           ▼                                            │
│ Priority 5: Squads v4 Multisig Authority Handoff & Emergency Pauser                    │
│   - Run: bun run scripts/governance/squads-multisig-runbook.ts                         │
│   - Transfer BPF upgrade authority to Squads Vault PDA                                 │
│   - Call set_service_authorities for admin role & configure KMS emergency pauser       │
│                                           │                                            │
│                                           ▼                                            │
│ Priority 6: Gate 9 — Remote Bytecode Verification (solana-verify)                      │
│   - Execute: solana-verify verify-from-repo --remote                                   │
│   - Confirm on-chain bytecode matches GitHub commit SHA                                │
│                                           │                                            │
│                                           ▼                                            │
│ Priority 7: Production Reconciliation Daemon & Settlement Sync Launch                  │
│   - Clean state audit: bun run solana:reconcile --dry-run                              │
│   - Background worker launch: bun run solana:sync                                      │
│   - Schedule 15-minute crontab daemon for ongoing reconciliation                       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🤖 Next Session Autonomous Agent Prompt (XML Structured)

Copy and execute the following structured prompt to drive the next session:

```xml
<prompt id="asol-mainnet-live-execution-runbook" status="ready-for-live-broadcast">
  <context>
    <repository>AlchmAgentsSolana (ASOL)</repository>
    <target_directory>/Users/cookingwithcastro/Desktop/AlchmAgentsSolana</target_directory>
    <program_id>5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD</program_id>
    <mainnet_genesis_hash>5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d</mainnet_genesis_hash>
    <token_program>Token-2022 (TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb)</token_program>
    <squads_program>Squads v4 (SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pcf)</squads_program>
    <runtime>Bun 1.3.13 | Anchor 0.30.1 | Solana 1.18.17 | Rust 1.79.0</runtime>
    <authoritative_roadmap>docs/SOLANA_MAINNET_MIGRATION_ROADMAP.md (v3.0.0-PRODUCTION-READY)</authoritative_roadmap>
    <verification_baseline>17 test suites (196 tests passing), 42 cargo tests, clean typecheck</verification_baseline>
  </context>

  <task>
    Execute the live Solana Mainnet-Beta rollout of the ASOL protocol across Gates 4, 8, and 9:
    1. Upload immutable Token-2022 metadata via Irys/Arweave, re-verify remote byte hashes, and patch constants.rs.
    2. Re-compile program with SBF 4 KiB stack overflow detection and verify unit tests.
    3. Run Devnet pre-flight rehearsal drill (dry runs and AMM lifecycle).
    4. Deploy program binary to Solana Mainnet-Beta using verifiable Docker tooling.
    5. Execute idempotent on-chain PDA initialization (ProgramConfig + 4 EsmsMints).
    6. Transition program authority to Squads v4 multisig vault with an emergency KMS pauser role.
    7. Verify on-chain bytecode using solana-verify against the repository commit.
    8. Activate continuous 15-minute reconciliation daemon and settlement sync supervisor.
  </task>

  <invariants>
    <invariant id="token-2022-immutability">
      The Anchor program has NO metadata-update instruction. URIs set at mint initialization
      are permanently immutable. Arweave upload MUST be executed, committed to arweave-manifest.json,
      and patched into programs/asol_program/src/constants.rs BEFORE running init-mainnet.ts.
    </invariant>
    <invariant id="cluster-isolation">
      Under NODE_ENV=production or SOLANA_NETWORK=mainnet-beta, RPC endpoints MUST match genesis
      hash 5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d. Devnet fallback is strictly rejected.
    </invariant>
    <invariant id="zero-secret-production">
      In production, signing MUST use Cloud KMS (AWS or GCP HSM). Local filesystem private keys
      are prohibited unless explicit test flags (--allow-local-signer) are provided.
    </invariant>
    <invariant id="stack-frame-budget">
      All Anchor SBF instructions MUST remain strictly under the 4,096-byte stack limit.
      Always compile via `bun run solana:build` (scripts/build-solana-program.mjs).
    </invariant>
    <invariant id="lossless-math-boundary">
      All Token-2022 balances and claims use 10^4 integer raw atoms. Never pass amounts
      or slots through JavaScript floating-point numbers.
    </invariant>
  </invariants>

  <execution_plan>
    <!-- PRIORITY 1: GATE 4 - ARWEAVE UPLOAD & CONSTANTS PATCH -->
    <stage id="1" name="gate-4-arweave-metadata-upload">
      <step 1>
        Generate and fund throwaway burner keypair for Irys upload (Path B):
        `solana-keygen new --no-bip39-passphrase -o ~/.config/solana/irys-funder.json`
        `solana transfer --from ~/.config/solana/id.json $(solana address -k ~/.config/solana/irys-funder.json) 0.05 --url mainnet-beta`
        `solana balance --url https://api.mainnet-beta.solana.com --keypair ~/.config/solana/irys-funder.json`
      </step 1>
      <step 2>
        Execute two-pass upload script with gateway retry backoff:
        `export IRYS_NETWORK="mainnet"`
        `export SOLANA_AGENT_PAYER_PATH="$HOME/.config/solana/irys-funder.json"`
        `bun run scripts/metadata/upload-arweave-metadata.ts --confirm --allow-local-payer`
        (Pass 1: SVGs -> Pass 2: JSON Manifests -> Pass 3: Remote SHA-256 byte readback with 120s backoff).
      </step 2>
      <step 3>
        Commit populated `metadata/solana/arweave-manifest.json` containing permanent transaction IDs.
      </step 3>
      <step 4>
        Replace `ESMS_METADATA_URIS` array in `programs/asol_program/src/constants.rs` with the
        generated Arweave URIs (`https://arweave.net/<txId>`).
      </step 4>
      <step 5>
        THE REBUILD IMPERATIVE: Re-compile program to bake permanent Arweave URIs into SBF binary:
        `bun run solana:build`
        `bun run test:solana:unit`
      </step 5>
    </stage>

    <!-- PRIORITY 2: PRE-MAINNET DEVNET DRESS REHEARSAL -->
    <stage id="2" name="pre-mainnet-devnet-rehearsal">
      <step 1>
        Run deployment script in dry-run mode against Devnet:
        `SOLANA_NETWORK=devnet bash scripts/deploy/deploy-mainnet.sh --dry-run --allow-devnet --allow-local-signer`
      </step 1>
      <step 2>
        Run initialization script in dry-run mode against Devnet:
        `SOLANA_NETWORK=devnet bun run scripts/deploy/init-mainnet.ts --dry-run --allow-devnet --allow-local-signer`
      </step 2>
      <step 3>
        Execute AMM lifecycle rehearsal drill (`register -> bootstrap -> add -> swap -> withdraw`):
        `bun run test/solana/amm-attestation.spec.ts`
      </step 3>
      <step 4>
        Run state reconciliation audit against Devnet:
        `SOLANA_NETWORK=devnet bun run solana:reconcile --dry-run`
        (Confirm status is HEALTHY).
      </step 4>
    </stage>

    <!-- PRIORITY 3: GATE 8 - LIVE MAINNET PROGRAM DEPLOYMENT -->
    <stage id="3" name="gate-8-mainnet-program-deployment">
      <step 1>
        Verify Mainnet deployer keypair balance:
        `solana balance --url https://api.mainnet-beta.solana.com --keypair ~/.config/solana/id.json`
        (Minimum requirement: >= 14.5 SOL peak allocation for concurrent temporary buffer and ProgramData rent exemption).
      </step 1>
      <step 2>
        Execute verifiable deployment script:
        `export SOLANA_NETWORK="mainnet-beta"`
        `export SOLANA_RPC_URL="https://mainnet.helius-rpc.com/?api-key=YOUR_KEY"`
        `bash scripts/deploy/deploy-mainnet.sh --keypair ~/.config/solana/id.json`
      </step 2>
      <step 3>
        Verify deployed program on Solana Explorer:
        `https://explorer.solana.com/address/5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD`
      </step 3>
    </stage>

    <!-- PRIORITY 4: GATE 8 - IDEMPOTENT MAINNET PDA INITIALIZATION -->
    <stage id="4" name="gate-8-idempotent-mainnet-initialization">
      <step 1>
        Execute initialization runner with production KMS configuration:
        `export NODE_ENV="production"`
        `export AWS_KMS_KEY_ID="arn:aws:kms:us-east-1:123456789012:key/asol-authority"`
        `export SOLANA_RPC_URL="https://mainnet.helius-rpc.com/?api-key=YOUR_KEY"`
        `bun run scripts/deploy/init-mainnet.ts`
      </step 1>
      <step 2>
        The script will:
        - Assert cluster genesis hash is strictly `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`.
        - Initialize `ProgramConfig` PDA (`attestor`, `pauser`, `cluster_domain = sha256("ASOL_MAINNET_V1")`).
        - Initialize 4 Token-2022 `EsmsMint` accounts (`Spirit`, `Essence`, `Matter`, `Substance`).
        - Validate extension layouts (`NonTransferable`, `PermanentDelegate`, `MetadataPointer`, `TokenMetadata`, `PermissionedBurn`).
        - Validate that on-chain metadata URIs match permanent Arweave URLs.
        - Write verified deployment addresses to `deployments/solana-mainnet.json`.
      </step 2>
      <step 3>
        Commit populated `deployments/solana-mainnet.json`.
      </step 3>
    </stage>

    <!-- PRIORITY 5: SQUADS V4 MULTISIG GOVERNANCE HANDOFF -->
    <stage id="5" name="squads-v4-multisig-handoff">
      <step 1>
        Generate Squads v4 multisig transaction instructions:
        `bun run scripts/governance/squads-multisig-runbook.ts`
      </step 1>
      <step 2>
        Transfer BPF program upgrade authority to Squads Vault PDA:
        `solana program set-upgrade-authority 5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD \
           --new-upgrade-authority <SQUADS_VAULT_PDA> \
           --keypair ~/.config/solana/id.json \
           --url "$SOLANA_RPC_URL"`
      </step 2>
      <step 3>
        Execute Anchor instruction `set_service_authorities` setting `admin` to `<SQUADS_VAULT_PDA>`
        and `pauser` to the KMS Emergency Pauser key.
      </step 3>
    </stage>

    <!-- PRIORITY 6: GATE 9 - ON-CHAIN BYTECODE VERIFICATION -->
    <stage id="6" name="gate-9-solana-verify-bytecode">
      <step 1>
        Run remote bytecode verification against repository commit hash:
        `solana-verify verify-from-repo \
           --remote \
           --program-id 5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD \
           https://github.com/gregcastro23/alchm-agents-solana`
      </step 1>
      <step 2>
        Confirm that the SHA-256 build hash inside `backpackapp/build:v0.30.1` matches the deployed on-chain binary.
      </step 2>
    </stage>

    <!-- PRIORITY 7: TELEMETRY, RECONCILIATION DAEMON & WORKER LAUNCH -->
    <stage id="7" name="production-telemetry-and-reconciliation">
      <step 1>
        Execute baseline state reconciliation check:
        `bun run solana:reconcile --dry-run`
        (Verify `status: "HEALTHY"`, `unhealedDebitedClaims: 0`, `ghostClaims: 0`, `supplyDrift: 0n`).
      </step 1>
      <step 2>
        Launch background synchronization supervisor:
        `bun run solana:sync`
      </step 2>
      <step 3>
        Configure 15-minute cron daemon for automated reconciliation:
        `*/15 * * * * cd /app && bun run solana:reconcile >> /var/log/asol-reconcile.log 2>&1`
      </step 3>
    </stage>
  </execution_plan>

  <verification_matrix>
    <command name="typecheck">bun run typecheck:solana</command>
    <command name="unit_tests">bun run test:solana:unit</command>
    <command name="reconciliation">bun run solana:reconcile --dry-run</command>
    <command name="rust_tests">RUSTUP_TOOLCHAIN=1.79.0 cargo test -p asol_program --lib</command>
    <command name="build">bun run solana:build</command>
  </verification_matrix>
</prompt>
```

---

## 🛠️ Step-by-Step Operator CLI Blueprint

### Stage 1: Arweave Permanent Metadata Upload & Constants Pinning (Gate 4 - Path B: Local Burner)

1. **Generate & Fund Throwaway Burner Keypair (~0.05 SOL):**
   ```bash
   solana-keygen new --no-bip39-passphrase -o ~/.config/solana/irys-funder.json
   solana transfer --from ~/.config/solana/id.json $(solana address -k ~/.config/solana/irys-funder.json) 0.05 --url mainnet-beta
   solana balance --url https://api.mainnet-beta.solana.com --keypair ~/.config/solana/irys-funder.json
   ```
2. **Execute Two-Pass Uploader with Gateway Retry Loop:**
   ```bash
   export IRYS_NETWORK="mainnet"
   export SOLANA_AGENT_PAYER_PATH="$HOME/.config/solana/irys-funder.json"
   bun run scripts/metadata/upload-arweave-metadata.ts --confirm --allow-local-payer
   ```
3. **Commit Manifest & Patch `constants.rs`:**
   Paste the generated URIs into [`programs/asol_program/src/constants.rs`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/programs/asol_program/src/constants.rs):
   ```rust
   pub const ESMS_METADATA_URIS: [&str; ESMS_MINT_COUNT] = [
       "https://arweave.net/<spirit_txId>",
       "https://arweave.net/<essence_txId>",
       "https://arweave.net/<matter_txId>",
       "https://arweave.net/<substance_txId>",
   ];
   ```
4. **THE REBUILD IMPERATIVE: Recompile & Validate Suite:**
   ```bash
   bun run solana:build
   bun run test:solana:unit
   ```

---

### Stage 2: Pre-Mainnet Devnet Dress Rehearsal

```bash
# 1. Rehearsal deploy runner in dry-run mode
SOLANA_NETWORK=devnet bash scripts/deploy/deploy-mainnet.sh --dry-run --allow-devnet --allow-local-signer

# 2. Rehearsal initializer in dry-run mode
SOLANA_NETWORK=devnet bun run scripts/deploy/init-mainnet.ts --dry-run --allow-devnet --allow-local-signer

# 3. AMM lifecycle test suite
bunx vitest run test/solana/amm-attestation.spec.ts --config vitest.solana.config.ts

# 4. State reconciliation dry run
SOLANA_NETWORK=devnet bun run solana:reconcile --dry-run
```

---

### Stage 3: Live Program Deployment to Solana Mainnet-Beta (Gate 8)

1. **Verify Deployer Balance (>= 14.5 SOL Peak Rent Requirement):**
   ```bash
   solana balance --url https://api.mainnet-beta.solana.com --keypair ~/.config/solana/id.json
   ```
   _(971 KiB binary concurrently allocates ~6.92 SOL buffer + ~6.92 SOL ProgramData. Buffer is refunded post-deploy)._
2. **Execute Verifiable Deployment Runner:**
   ```bash
   export SOLANA_NETWORK="mainnet-beta"
   export SOLANA_RPC_URL="https://mainnet.helius-rpc.com/?api-key=YOUR_KEY"
   bash scripts/deploy/deploy-mainnet.sh --keypair ~/.config/solana/id.json
   ```
3. **Confirm Program Account:**
   ```bash
   solana program show 5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD --url "$SOLANA_RPC_URL"
   ```

---

### Stage 4: Idempotent Mainnet Initialization (Gate 8)

```bash
export NODE_ENV="production"
export AWS_KMS_KEY_ID="arn:aws:kms:us-east-1:123456789012:key/asol-authority"
export SOLANA_RPC_URL="https://mainnet.helius-rpc.com/?api-key=YOUR_KEY"
bun run scripts/deploy/init-mainnet.ts
```

_Commit populated [`deployments/solana-mainnet.json`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/deployments/solana-mainnet.json)._

---

### Stage 5: Squads v4 Multisig Authority Handoff

1. **Generate Governance Plan:**
   ```bash
   bun run scripts/governance/squads-multisig-runbook.ts
   ```
2. **Transfer Upgrade Authority:**
   ```bash
   solana program set-upgrade-authority 5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD \
     --new-upgrade-authority <SQUADS_VAULT_PDA> \
     --keypair ~/.config/solana/id.json \
     --url "$SOLANA_RPC_URL"
   ```
3. **Set Admin Role to Multisig Vault:**
   Execute Anchor instruction `set_service_authorities` setting `admin` to `<SQUADS_VAULT_PDA>`.

---

### Stage 6: Remote Bytecode Verification (Gate 9)

```bash
solana-verify verify-from-repo \
  --remote \
  --program-id 5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD \
  https://github.com/gregcastro23/alchm-agents-solana
```

---

### Stage 7: Telemetry, Reconciliation Daemon & Sync Worker Launch

```bash
# 1. Baseline reconciliation check
bun run solana:reconcile --dry-run

# 2. Launch background sync service
bun run solana:sync

# 3. Crontab 15-minute scheduled daemon
# Add to production crontab:
# */15 * * * * cd /app && bun run solana:reconcile >> /var/log/asol-reconcile.log 2>&1
```

---

## 📋 Verification Commands Reference

| Command                                                    | Target Standard        | Expected Outcome                                                   |
| :--------------------------------------------------------- | :--------------------- | :----------------------------------------------------------------- |
| `bun run typecheck:solana`                                 | TypeScript Strict Mode | Clean exit code 0; 0 type errors across client, scripts, and tests |
| `bun run test:solana:unit`                                 | Vitest Unit Suite      | 17/17 test files passing (196 tests) in $< 2.5\text{s}$            |
| `RUSTUP_TOOLCHAIN=1.79.0 cargo test -p asol_program --lib` | Anchor Rust Suite      | 42/42 cargo tests passing; checked math and stack limit valid      |
| `bun run solana:reconcile --dry-run`                       | Ledger State Audit     | Health status `HEALTHY`; 0 unhealed debits; 0 ghost claims         |
| `bun run solana:build`                                     | SBF Compiler + Linker  | Stack frame <= 4,096 bytes; writes target/deploy/asol_program.so   |
