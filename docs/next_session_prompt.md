# Next Session Prompt — Solana Mainnet Production Readiness & Live Execution Runbook

> **Target Repository:** [`/Users/cookingwithcastro/Desktop/AlchmAgentsSolana`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana)  
> **Active Branch:** `feat/lean-formal-proofs-plan` (Tracking: `origin/feat/lean-formal-proofs-plan`)  
> **Target Program ID:** `5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD`  
> **Cluster Target:** Solana Mainnet-Beta (`5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`)  
> **Authoritative Roadmap:** [`docs/SOLANA_MAINNET_MIGRATION_ROADMAP.md`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/docs/SOLANA_MAINNET_MIGRATION_ROADMAP.md) (`v3.0.0-PRODUCTION-READY`)  
> **Toolchains:**
>
> - Runtime: Bun (`bun` and `bun --bun run dev`) | Apple Silicon M5 / 16GB RAM
> - Solana: Anchor `0.30.1` | Solana CLI `1.18.17` | Rust `1.79.0` | Docker `backpackapp/build:v0.30.1`
> - Formal Proofs: Lean 4 `v4.13.0` | Lake `5.0.0`  
>   **Current Verification Status:**
> - ✅ **17/17 TypeScript test files passing (198 tests)** (`bun run test:solana:unit`)
> - ✅ **42/42 Anchor Rust tests passing** (`RUSTUP_TOOLCHAIN=1.79.0 cargo test -p asol_program --lib`)
> - ✅ **TypeScript strict typecheck clean (0 errors)** (`bun run typecheck:solana`)
> - ✅ **Lean 4 Formal Verification Suite:** 100% Machine-Checked (134 declarations, 0 `sorry`, 0 custom axioms via kernel-level `AxiomGate.lean`, green CI)
> - 🟡 **Live Mainnet-Beta Operations:** **STAGED FOR OPERATOR EXECUTION** (Awaiting funded deployer & Irys keys)

---

## 🚀 Executive Summary & System Milestones

The **AlchmAgentsSolana (`ASOL`)** protocol has achieved **complete engineering, cryptographic, and mathematical readiness**. All prerequisite code refactorings, vulnerability remediations, security hardenings, and formal mathematical proofs are 100% complete and passing across CI.

The objective of the upcoming session is to transition from **code staging to live on-chain operator execution** on **Solana Mainnet-Beta**.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          READINESS MILESTONES COMPLETED                                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Phase 1-6 Engineering Remediation:                                                  │
│    • 6 Launch Blockers & 4 Material Weaknesses Resolved                               │
│    • AWS/GCP Cloud KMS Ed25519 HSM Signer Integration                                  │
│    • Strict Mainnet-Beta Cluster Genesis Guard (5eykt...9d)                            │
│    • Token-2022 Extensions (NonTransferable, PermanentDelegate, PermissionedBurn)     │
│    • Dual-Rail Base/Solana Reconciliation Engine with Ghost-Claim Guards               │
│                                                                                        │
│ 2. Phase 26 Lean 4 Formal Mathematical Verification (PR #26):                         │
│    • 134 Machine-Checked Theorems & Corollaries across 4 Modules                       │
│    • Exact AMM Invariant Proof (k' ≥ k) matching Rust integer division (amm.rs:119)    │
│    • Discretization Error Bounds & 1-Atom Rounding Extraction Immunity                 │
│    • 64-Dimensional JEPA Memory Contraction Mapping & Stability (τ = 0.99)             │
│    • Kernel-Level Axiom Reflection Gate (AxiomGate.lean) guaranteeing 0 custom axioms  │
│                                                                                        │
│ 3. Phase 7 Deployment Tooling Staged:                                                  │
│    • Verifiable Docker Runner: scripts/deploy/deploy-mainnet.sh                        │
│    • Idempotent Initializer: scripts/deploy/init-mainnet.ts                            │
│    • Squads v4 Multisig Handoff: scripts/governance/squads-multisig-runbook.ts         │
│    • Live Reconciliation Engine: scripts/reconciliation/reconcile-solana-state.ts      │
│    • Daemon Background Worker: scripts/run-asol-solana-service.ts                      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏛️ Mathematical Verification Foundation (Lean 4 Campaign Recap)

The on-chain programs and client settlement libraries are backed by machine-checked proofs in Lean 4 (`proofs/lean/`):

1. **Constellation AMM Invariant Conservation (`Proofs.ConstellationAMM`)**:
   - **Integer Truncation Fidelity:** Verifies the exact integer math of [`programs/asol_program/src/amm.rs`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/programs/asol_program/src/amm.rs) L119-122:
     $$\Delta y = \lfloor \Delta x \cdot (10000 - \text{fee}) / 10000 \rfloor, \quad \text{out} = \lfloor (\Delta y \cdot R_x) / (R_y + \Delta y) \rfloor$$
   - **Monotonicity:** Formally proves that constant-product invariant $k' \ge k$ holds monotonically under integer division truncation and fees.
   - **Universal Ratio Lemma & Cyclic Arbitrage Protection:** Proves $\text{outAmt} \cdot R_{\text{in}} \le \Delta x \cdot R_{\text{out}}$, guaranteeing that multi-hop cyclic swaps (Spirit $\to$ Essence $\to$ Matter $\to$ Substance $\to$ Spirit) cannot extract phantom value from pools.
   - **Strict Slippage Bound Rejection:** Proves that any swap where $\text{out} < \text{min\_out}$ aborts execution.

2. **Token-2022 Discretization & Dust Rounding Safety (`Proofs.Discretization`)**:
   - **Euclidean Remainder Invariant:** Proves integer division yields exact remainder $0 \le R < E$, bounding discretization error to $< 10^{-4}$ BPS.
   - **1-Atom Extraction Immunity:** Proves that an economic adversary cannot drain reserves through infinitesimal single-atom round-trip swaps.

3. **Celestial Waveharmonics & Persona Memory (`Proofs.Wavefunction`, `Proofs.JEPAPersona`)**:
   - Proves harmonic wavefunctions remain strictly bounded in $[-2, 2]$ and $[-20000, 20000]$ BPS with economic positivity guarantees ($\text{Cost}_a > 0$).
   - Proves 64-dimensional EMA persona matrix divergence decays exponentially ($\tau^n \to 0$ for $\tau = 0.99$), ensuring on-chain JEPA anchoring remains numerically stable.

4. **Kernel-Level Axiom Gate (`proofs/lean/AxiomGate.lean`)**:
   - Environment-walking metaprogram checks all declarations in the `Proofs` namespace directly in the Lean kernel, ensuring zero custom axioms are admitted (allowing only Lean core primitives: `propext`, `Classical.choice`, `Quot.sound`).

---

## 🎯 Primary Session Objective: Live Mainnet-Beta Execution Runbook

The upcoming session focuses on operator execution of the **5-Stage Mainnet Deployment Pipeline**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        MAINNET LIVE EXECUTION RUNBOOK STAGES                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Stage 1: Arweave Permanent Metadata Upload & Constants Pinning                         │
│   - Run: bun run scripts/metadata/upload-arweave-metadata.ts                           │
│   - Remote readback SHA-256 byte verification                                          │
│   - Commit populated arweave-manifest.json & constants.rs (if newly uploaded)          │
│   - Re-build program binary: bun run solana:build                                      │
│                                           │                                            │
│                                           ▼                                            │
│ Stage 2: Program Deployment to Solana Mainnet-Beta                                     │
│   - Deployer balance verification (~4.5 SOL for rent & txn fees)                       │
│   - Execute: bash scripts/deploy/deploy-mainnet.sh                                     │
│   - Verify Program ID: 5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD                   │
│                                           │                                            │
│                                           ▼                                            │
│ Stage 3: Idempotent Mainnet Initialization                                             │
│   - Execute: bun run scripts/deploy/init-mainnet.ts                                    │
│   - Initialize ProgramConfig & 4 EsmsMint accounts (Token-2022)                        │
│   - Validate extensions: NonTransferable, PermanentDelegate, PermissionedBurn          │
│   - Update deployments/solana-mainnet.json                                             │
│                                           │                                            │
│                                           ▼                                            │
│ Stage 4: Squads v4 Multisig Authority Handoff                                          │
│   - Execute: bun run scripts/governance/squads-multisig-runbook.ts                     │
│   - Transfer BPF program upgrade authority to Squads Vault PDA                         │
│   - Invoke asol_program.set_service_authorities (admin & pauser roles)                 │
│                                           │                                            │
│                                           ▼                                            │
│ Stage 5: Live Verification & Reconciliation Audit                                      │
│   - Bytecode verification: solana-verify verify-from-repo                              │
│   - Initial state audit: bun run solana:reconcile --dry-run                            │
│   - Launch daemon: bun run solana:sync                                                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Step-by-Step Execution Protocol

### Stage 1: Arweave Permanent Asset Upload & Constants Pinning

1. **Configure Environment:**
   Ensure the uploader key has funded SOL or Arweave balance:

   ```bash
   export IRYS_NETWORK="mainnet" # or "devnet" for rehearsal
   export SOLANA_MINTER_SECRET_KEY="<base58-private-key-with-funding>"
   ```

2. **Execute Two-Pass Uploader:**

   ```bash
   bun run scripts/metadata/upload-arweave-metadata.ts
   ```

   - **Pass 1:** Uploads SVG icons (`icons/spirit.svg`, `icons/essence.svg`, etc.).
   - **Pass 2:** Injects permanent image URLs into manifests (`tokens/spirit.json`, etc.) and uploads manifests.
   - **Pass 3:** Performs remote readback SHA-256 byte digest verification against `https://arweave.net/<txId>`.

3. **Verify Constants:**
   Confirm that [`programs/asol_program/src/constants.rs`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/programs/asol_program/src/constants.rs) matches the uploaded URIs:

   ```rust
   pub const ESMS_METADATA_URIS: [&str; ESMS_MINT_COUNT] = [
       "https://arweave.net/BP4XXynxmnRB4ZSqTAvvjdZARPpGD6Kxgcj2YH1tXpWE",
       "https://arweave.net/HdtPTVqm9GdKFX2F7a7je1vApcXSuEcpVXMS353kDhAo",
       "https://arweave.net/5AGdZFaNba8A5Zke23j7K85oPihQzUmpn7QKoz4dGgFe",
       "https://arweave.net/3xzDcPZn1h9Ss91kaTeCWjSBsPBWczcETECFfvJe68YY",
   ];
   ```

4. **Recompile & Check SBF Stack Limit:**
   ```bash
   bun run solana:build
   bun run test:solana:unit
   ```

---

### Stage 2: Program Deployment to Solana Mainnet-Beta

1. **Verify Deployer Keypair & Balance:**

   ```bash
   solana balance --url https://api.mainnet-beta.solana.com --keypair ~/.config/solana/id.json
   ```

   _(Minimum required: ~4.5 SOL for program buffer rent exemption and transaction fees)._

2. **Run Verifiable Deployment Script:**

   ```bash
   # Dry-run rehearsal first
   bash scripts/deploy/deploy-mainnet.sh --dry-run

   # Live deployment
   bash scripts/deploy/deploy-mainnet.sh --keypair ~/.config/solana/id.json
   ```

   - Verifies target genesis hash `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`.
   - Builds program deterministically via Docker (`backpackapp/build:v0.30.1`).
   - Deploys bytecode to Program ID `5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD`.

3. **Confirm on Solana Explorer:**
   `https://explorer.solana.com/address/5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD`

---

### Stage 3: Idempotent On-Chain PDA Initialization

1. **Execute Initialization Script:**

   ```bash
   export SOLANA_NETWORK="mainnet-beta"
   export SOLANA_RPC_URL="https://api.mainnet-beta.solana.com" # or private Helius / Triton RPC
   export AWS_REGION="us-east-1"
   export AWS_KMS_KEY_ID="alias/asol-solana-signer"

   # Dry-run first
   bun run scripts/deploy/init-mainnet.ts --dry-run

   # Live execution
   bun run scripts/deploy/init-mainnet.ts
   ```

2. **Initialization Assertions:**
   - Asserts Mainnet genesis hash matches `5eykt...9d`.
   - Initializes `ProgramConfig` PDA (`attestor`, `pauser`, `cluster_domain`).
   - Initializes 4 `EsmsMint` accounts with Token-2022 extensions:
     - `NonTransferable` (Type 9)
     - `PermanentDelegate` (Type 12) $\to$ `ProgramConfig` PDA
     - `MetadataPointer` (Type 18) $\to$ `ProgramConfig` PDA + Mint Address
     - `TokenMetadata` (Type 19) $\to$ Verified Arweave URIs
     - `PermissionedBurn` (Type 28) $\to$ `ProgramConfig` PDA
   - Records deployed addresses in [`deployments/solana-mainnet.json`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/deployments/solana-mainnet.json).

---

### Stage 4: Squads v4 Multisig Authority Handoff

1. **Generate Multisig Instructions:**

   ```bash
   bun run scripts/governance/squads-multisig-runbook.ts
   ```

2. **Execute Authority Transfers:**
   - **BPF Program Upgrade Authority:**
     ```bash
     solana program set-upgrade-authority 5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD \
       --new-upgrade-authority <SQUADS_VAULT_PDA> \
       --keypair ~/.config/solana/id.json
     ```
   - **Service Authorities (`admin` & `pauser`):**
     Execute instruction generated by `squads-multisig-runbook.ts` invoking `asol_program.set_service_authorities` to assign roles to `<SQUADS_VAULT_PDA>`.

---

### Stage 5: Live Verification, Reconciliation Audit & Service Daemon

1. **Verifiable Remote Bytecode Verification:**

   ```bash
   solana-verify verify-from-repo \
     --remote \
     --program-id 5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD \
     https://github.com/gregcastro23/alchm-agents-solana
   ```

2. **State Reconciliation Audit:**

   ```bash
   bun run solana:reconcile --dry-run
   ```

   - Verifies:
     - On-chain total supply vs off-chain database balances.
     - 0 unhealed claims.
     - 0 ghost claims.
     - Outbox queue depth and dead-letter queue (DLQ) health.

3. **Activate Settlement Daemon:**
   ```bash
   bun run solana:sync
   ```

   - Initiates outbox polling, event delivery to webhook endpoints, and transaction finality tracking.

---

## 🔐 Operator Credentials & Environment Matrix

| Environment Variable            | Required For          | Recommended Production Setting                            |
| :------------------------------ | :-------------------- | :-------------------------------------------------------- |
| `SOLANA_NETWORK`                | All live commands     | `mainnet-beta` (strictly fail-closed)                     |
| `SOLANA_RPC_URL`                | All live commands     | Private Helius or Triton endpoint with stake-weighted QoS |
| `SOLANA_FALLBACK_RPC_URLS`      | RPC failover          | Comma-separated secondary endpoints (e.g. QuickNode)      |
| `SOLANA_AGENT_PAYER_PATH`       | Deployer              | Path to deployer keypair with $\ge 4.5\text{ SOL}$        |
| `SOLANA_MINTER_SECRET_KEY`      | Irys upload           | Base58 private key funded for Arweave uploads             |
| `AWS_KMS_KEY_ID` / `AWS_REGION` | Attestations & Mints  | AWS KMS Ed25519 HSM Key ID (or GCP equivalent)            |
| `SQUADS_MULTISIG_VAULT`         | Stage 4 governance    | Derived Squads v4 Vault PDA                               |
| `DATABASE_URL`                  | Sync & reconciliation | Production PostgreSQL connection string                   |
| `SETTLEMENT_WEBHOOK_SECRET`     | Sync worker dispatch  | Cryptographic shared secret for HMAC / Bearer auth        |

---

## 🛠️ Verification & Diagnostics Command Reference

### Pre-Flight Code Quality & Tests

```bash
# TypeScript strict typecheck across client, scripts, and tests
bun run typecheck:solana

# Vitest test suite (17 passed files, 198 tests)
bun run test:solana:unit

# Anchor Rust contract unit tests (42 tests)
RUSTUP_TOOLCHAIN=1.79.0 cargo test -p asol_program --lib

# Combined Solana check runner
bun run test:solana
```

### Formal Mathematical Verification (Lean 4)

```bash
cd proofs/lean

# Build all 4 formal proof modules
lake build

# Execute kernel-level axiom reflection gate
lake exe axiom_gate
```

### Deployment & Live Operations

```bash
# Build Anchor program with 4 KiB SBF stack overflow detection
bun run solana:build

# Stage 1: Arweave metadata upload
bun run scripts/metadata/upload-arweave-metadata.ts

# Stage 2: Program deployment
bash scripts/deploy/deploy-mainnet.sh --dry-run
bash scripts/deploy/deploy-mainnet.sh --keypair ~/.config/solana/id.json

# Stage 3: ProgramConfig & EsmsMint initialization
bun run scripts/deploy/init-mainnet.ts --dry-run
bun run scripts/deploy/init-mainnet.ts

# Stage 4: Squads v4 multisig authority handoff
bun run scripts/governance/squads-multisig-runbook.ts

# Stage 5: State reconciliation & sync daemon
bun run solana:reconcile --dry-run
bun run solana:sync
```

### Process Hygiene & Diagnostics (Apple Silicon / Bun)

```bash
# Check and kill lingering processes on dev ports before launching services
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
```
