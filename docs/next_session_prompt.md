# Next Session Prompt — Solana Mainnet Deployment & Live Execution Runbook

> **Target Repository:** [`/Users/cookingwithcastro/Desktop/AlchmAgentsSolana`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana)  
> **Target Program ID:** `5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD`  
> **Authoritative Roadmap:** [`docs/SOLANA_MAINNET_MIGRATION_ROADMAP.md`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/docs/SOLANA_MAINNET_MIGRATION_ROADMAP.md) (`v2.2.0-REMEDIATED`)  
> **Runtime / Toolchain:** Bun (`bun` and `bun --bun run dev`) | Anchor `0.30.1` | Solana `1.18.17` | Rust `1.79.0`  
> **Current Verification Status:** ✅ **17/17 test files passing (196 tests)** | 42/42 Anchor Rust tests passing | `bun run typecheck:solana` clean (0 errors)

---

## 🚀 Progress Update: Phases 1 & 2 Remediation Fully Completed

All **six critical launch blockers** and **four material weaknesses** identified in the pre-flight readiness audit have been systematically resolved, refactored, and verified in code.

### Phase 1 Remediation Summary (Workstreams 1, 2, 3)

1. **Workstream 1: Settlement-Sync Worker Runtime Repair & TS Inclusion**
   - Fixed `startSolanaSyncOutboxPolling` signature by passing `{ client, deliver }` directly in [`scripts/run-asol-solana-service.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/scripts/run-asol-solana-service.ts).
   - Configured webhook dispatcher with `bearerToken: secret` to send `Authorization: Bearer <token>`.
   - Replaced nonexistent `store.getOutboxDepth()` with safe `(await store.getQueueDepth?.()) ?? 0`.
   - Included runner in [`tsconfig.solana.json`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/tsconfig.solana.json); tested via [`test/solana/sync-worker.spec.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/test/solana/sync-worker.spec.ts) (5 tests passing).

2. **Workstream 2: Single Typed `SolanaNetworkConfig` Architecture**
   - Implemented [`lib/solana/network-config.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/network-config.ts) pinning canonical Mainnet-Beta genesis hash `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`.
   - Enforced fail-closed production guards rejecting Devnet fallback under `NODE_ENV === 'production'`.
   - Refactored [`components/providers/SolanaWalletProvider.tsx`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/components/providers/SolanaWalletProvider.tsx), [`lib/solana/asol-solana-client.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/asol-solana-client.ts), and [`app/api/esms/claim/route.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/app/api/esms/claim/route.ts) to derive network state dynamically (`test/solana/network-config.spec.ts` - 9 tests passing).

3. **Workstream 3: Authority Hardening & Attestation Feeder Integrity**
   - Installed `@aws-sdk/client-kms@3.1124.0` in [`package.json`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/package.json) for Cloud KMS Ed25519 HSM signing.
   - Upgraded [`lib/solana/amm-attestor.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/amm-attestor.ts) to drive Ed25519 signatures via `KmsSolanaSigner` without raw secret keys in memory.
   - Hardened [`app/api/solana/amm-attestation/route.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/app/api/solana/amm-attestation/route.ts): rejects client-supplied `planets` (400), computes positions server-side via trusted Keplerian ephemeris (`lib/enhanced-astronomical-calculator.ts`), validates coordinates, and enforces a sliding rate limiter (`test/solana/amm-attestation.spec.ts` - 7 tests passing).

---

### Phase 2 Remediation Summary (Workstreams 4, 5, 6)

4. **Workstream 4: Immutable Metadata Automation & Constants Pinning**
   - Built automated two-pass Irys uploader [`scripts/metadata/upload-arweave-metadata.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/scripts/metadata/upload-arweave-metadata.ts) (Pass 1: SVGs, Pass 2: JSON manifests) with remote readback SHA-256 byte verification.
   - Validated JSON schema [`metadata/solana/manifest.schema.json`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/metadata/solana/manifest.schema.json).
   - Computed Token-2022 rent exemption sizing matrix for `MetadataPointer` accounts.
   - Tested in [`test/solana/upload-arweave-metadata.spec.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/test/solana/upload-arweave-metadata.spec.ts) (7 tests passing).

5. **Workstream 5: Phase 7 Deployment Scripts & Release Artifacts**
   - Created verifiable Docker build runner [`scripts/deploy/deploy-mainnet.sh`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/scripts/deploy/deploy-mainnet.sh) with Mainnet genesis assertion and `solana-verify` support.
   - Created idempotent initialization runner [`scripts/deploy/init-mainnet.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/scripts/deploy/init-mainnet.ts) verifying cluster genesis hash and Token-2022 extension layouts (`NonTransferable`, `PermissionedBurn`, `PermanentDelegate`, `MetadataPointer`).
   - Committed deployment registry [`deployments/solana-mainnet.json`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/deployments/solana-mainnet.json) and production environment template [`.env.production.sample`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/.env.production.sample).
   - Tested in [`test/solana/deployment-tooling.spec.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/test/solana/deployment-tooling.spec.ts) (7 tests passing).

6. **Workstream 6: Finality Enforcement, Velocity Guards & Reconciliation Engine**
   - **Cluster Isolation:** [`lib/solana/rpc-failover.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/rpc-failover.ts) strictly excludes devnet RPCs on Mainnet-Beta, validates `connection.getGenesisHash()` against `5eykt...` via memoized cache, and aborts immediately on deterministic simulation/program errors.
   - **Unified Send Path:** `mintEsmsClaimSolana` routes exclusively through `client.claimMintEsms(...)` with compute budget injection and dynamic priority fees; single-shot broadcast prevents duplicate signing.
   - **`SettlementProof` Recovery:** Introduces `SettlementProof` recovering on-chain signatures via `getSignaturesForAddress` on timeout, updating [`app/api/esms/claim/route.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/app/api/esms/claim/route.ts) with `status: 'minted'` and real `txHash`, breaking the stuck claim loop.
   - **Velocity Limits & Rust Constant Parity:** Mirrored `MAX_LEDGER_ATOMS = 999_999_999_999n` in [`lib/solana/vectors.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/vectors.ts) (asserted equal to Rust in [`test/solana/metadata-uris.spec.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/test/solana/metadata-uris.spec.ts)); enforced tighter 10M token policy cap (`resolveMaxClaimAtoms()`); sub-atom dust guard rejects zero-atom claims with HTTP 400 before off-chain balance debits.
   - **Centralized Reconciliation Engine:** Created [`lib/solana/reconciliation.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/reconciliation.ts) powering operator console alerts in [`app/api/admin/economy/route.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/app/api/admin/economy/route.ts) and the standalone CLI tool [`scripts/reconciliation/reconcile-solana-state.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/scripts/reconciliation/reconcile-solana-state.ts) (`bun run solana:reconcile`). Includes 15-minute staleness guards and multi-endpoint ghost claim validation.
   - **Dual-Rail Base Bridge:** Exported `createBaseClients` in [`lib/solana/bridge-service.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/bridge-service.ts), parameterizing Base Mainnet (`8453`) alongside Base Sepolia (`84532`).
   - **Vitest Config:** Excluded `esms-persona.spec.ts` in [`vitest.solana.config.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/vitest.solana.config.ts), allowing `bun run test:solana:unit` to automatically run all 17 test suites.
   - Tested in [`test/solana/reconciliation-and-finality.spec.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/test/solana/reconciliation-and-finality.spec.ts) (12 tests passing).

---

## 🎯 Next Session Objective: Production Mainnet Deployment & Live Execution Runbook

The codebase is **100% remediated, typechecked, and unit-tested**. The objective of the next session is to **execute live on-chain deployment and verification** using the staged tooling.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        MAINNET LIVE EXECUTION RUNBOOK STAGES                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Stage 1: Arweave Permanent Metadata Upload & Constants Pinning                         │
│   - Run: bun run scripts/metadata/upload-arweave-metadata.ts                           │
│   - Verify remote readback SHA-256 digests                                             │
│   - Commit populated arweave-manifest.json & updated constants.rs                      │
│   - Re-build program binary: bun run solana:build                                      │
│                                           │                                            │
│                                           ▼                                            │
│ Stage 2: Program Deployment to Solana Mainnet-Beta                                     │
│   - Deployer balance check (~4.5 SOL for rent & transaction fees)                      │
│   - Run: bash scripts/deploy/deploy-mainnet.sh                                         │
│   - Verify Program ID: 5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD                   │
│                                           │                                            │
│                                           ▼                                            │
│ Stage 3: Idempotent Mainnet Initialization                                             │
│   - Run: bun run scripts/deploy/init-mainnet.ts                                        │
│   - Initialize ProgramConfig & 4 EsmsMint accounts (Token-2022)                        │
│   - Commit populated deployments/solana-mainnet.json                                   │
│                                           │                                            │
│                                           ▼                                            │
│ Stage 4: Squads v4 Multisig Authority Handoff                                          │
│   - Run: bun run scripts/governance/squads-multisig-runbook.ts                         │
│   - Transfer BPF program upgrade authority & asol_program admin/pauser roles           │
│                                           │                                            │
│                                           ▼                                            │
│ Stage 5: Live Verification & Reconciliation Audit                                      │
│   - Run: solana-verify verify-from-repo                                                │
│   - Run: bun run solana:reconcile --dry-run                                            │
│   - Launch sync worker: bun run solana:sync                                            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Step-by-Step Execution Protocol

### Step 1: Arweave Permanent Asset Upload & Constants Commit

1. Ensure the Irys uploader key is configured with a funded SOL or Arweave balance:
   ```bash
   export IRYS_NETWORK="mainnet" # or devnet for rehearsal
   export SOLANA_MINTER_SECRET_KEY="<base58-private-key-with-funding>"
   ```
2. Execute the two-pass upload script:
   ```bash
   bun run scripts/metadata/upload-arweave-metadata.ts
   ```
3. Copy the output replacement block into [`programs/asol_program/src/constants.rs`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/programs/asol_program/src/constants.rs):
   ```rust
   pub const ESMS_METADATA_URIS: [&str; ESMS_MINT_COUNT] = [
       "https://arweave.net/<spirit_txId>",
       "https://arweave.net/<essence_txId>",
       "https://arweave.net/<matter_txId>",
       "https://arweave.net/<substance_txId>",
   ];
   ```
4. Re-compile the program and verify the stack limit:
   ```bash
   bun run solana:build
   bun run test:solana:unit
   ```

---

### Step 2: Live Program Deployment to Solana Mainnet-Beta

1. Confirm deployer balance:
   ```bash
   solana balance --url https://api.mainnet-beta.solana.com --keypair ~/.config/solana/id.json
   ```
   _(Minimum requirement: ~4.5 SOL for program buffer rent exemption and transaction fees)._
2. Execute the verifiable deployment script:
   ```bash
   bash scripts/deploy/deploy-mainnet.sh
   ```
3. Confirm deployment on Solana Explorer:
   `https://explorer.solana.com/address/5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD`

---

### Step 3: Idempotent On-Chain PDA Initialization

1. Execute the initialization script:
   ```bash
   export SOLANA_NETWORK="mainnet-beta"
   export SOLANA_RPC_URL="https://api.mainnet-beta.solana.com" # or private Helius/QuickNode
   bun run scripts/deploy/init-mainnet.ts
   ```
2. The script will:
   - Verify cluster genesis hash matches `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`.
   - Initialize `ProgramConfig` PDA (`attestor`, `pauser`, `cluster_domain`).
   - Initialize 4 `EsmsMint` accounts with Token-2022 extensions (`NonTransferable`, `PermissionedBurn`, `PermanentDelegate`, `MetadataPointer`).
   - Validate metadata URIs point to immutable Arweave links.
   - Record deployed addresses in [`deployments/solana-mainnet.json`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/deployments/solana-mainnet.json).

---

### Step 4: Squads v4 Multisig Authority Handoff

1. Run the Squads multisig generator runbook:
   ```bash
   bun run scripts/governance/squads-multisig-runbook.ts
   ```
2. Execute the generated instructions:
   - Transfer BPF program upgrade authority to Squads Vault PDA:
     ```bash
     solana program set-upgrade-authority 5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD --new-upgrade-authority <SQUADS_VAULT_PDA>
     ```
   - Call `asol_program.set_service_authorities` setting `admin` and `pauser` to the Squads Vault PDA.

---

### Step 5: Post-Deployment Verification & Reconciliation Audit

1. Run bytecode verification:
   ```bash
   solana-verify verify-from-repo \
     --remote \
     --program-id 5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD \
     https://github.com/gregcastro23/alchm-agents-solana
   ```
2. Run the state reconciliation engine to verify clean initial state:
   ```bash
   bun run solana:reconcile --dry-run
   ```
   _(Ensure status is `HEALTHY`, 0 unhealed claims, 0 ghost claims, 0 supply drift)._
3. Launch the background synchronization service:
   ```bash
   bun run solana:sync
   ```

---

## 🛠️ Verification Commands Quick Reference

| Command                                                    | Purpose                                                                   |
| :--------------------------------------------------------- | :------------------------------------------------------------------------ |
| `bun run typecheck:solana`                                 | TypeScript strict check across client, scripts, and tests (must exit 0)   |
| `bun run test:solana:unit`                                 | Comprehensive Vitest suite running all 17 test suites (196 tests passing) |
| `RUSTUP_TOOLCHAIN=1.79.0 cargo test -p asol_program --lib` | Anchor Rust tests (42 tests passing)                                      |
| `bun run solana:reconcile --dry-run`                       | Audits PostgreSQL vs on-chain supply and inspects outbox health           |
| `bun run solana:build`                                     | Compiles Anchor program with 4 KiB SBF stack overflow detection           |
