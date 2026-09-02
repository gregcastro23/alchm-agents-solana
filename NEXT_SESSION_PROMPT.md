# Next Session Prompt — Solana Mainnet Readiness Campaign: Phase 2 Remediation

> **Target Repository:** [`/Users/cookingwithcastro/Desktop/AlchmAgentsSolana`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana)  
> **Target Program ID:** `5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD`  
> **Authoritative Roadmap:** [`docs/SOLANA_MAINNET_MIGRATION_ROADMAP.md`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/docs/SOLANA_MAINNET_MIGRATION_ROADMAP.md)  
> **Runtime / Toolchain:** Bun (`bun` and `bun --bun run dev`) | Anchor `0.30.1` | Solana `1.18.17` | Rust `1.79.0`  
> **Previous Verification Status:** ✅ **15/15 test files passing (166 tests)** | `bun run typecheck:solana` clean (0 errors)

---

## 🚀 Progress Update: Phase 1 Remediation Completed

In the previous session, **Steps 1, 2, and 3** of the [Recommended Remediation Sequence](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/docs/SOLANA_MAINNET_MIGRATION_ROADMAP.md#25-recommended-remediation-sequence) were fully remediated, typechecked, and verified against the test suite:

### 1. Workstream 1: Settlement-Sync Worker Runtime Repair & TS Inclusion

- **Repaired [`scripts/run-asol-solana-service.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/scripts/run-asol-solana-service.ts):**
  - Fixed `startSolanaSyncOutboxPolling` signature by passing `{ client, deliver }` directly to eliminate undefined Prisma client dereferences.
  - Fixed webhook dispatcher argument to `{ url: webhookUrl, bearerToken: secret }`, ensuring outbound requests send `Authorization: Bearer <secret>`.
  - Replaced nonexistent `store.getOutboxDepth()` with safe `(await store.getQueueDepth?.()) ?? 0`.
  - Aligned heartbeat upsert with the Prisma schema (`connectionStatus` on [`SolanaServiceHeartbeat`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/prisma/schema.prisma#L1766)).
  - Added `--dry-run` flag support enabling automated configuration validation in CI/CD without blocking.
- **Race Condition Fix in [`lib/solana/solana-sync-service.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/solana-sync-service.ts#L455-L490):**
  - Memoized and returned `inFlight` promise during `startSolanaSyncOutboxPolling.tick()`, preventing dropped ticks during concurrent calls.
- **TypeScript Coverage:** Included worker script in [`tsconfig.solana.json`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/tsconfig.solana.json).
- **Test Spec:** Created [`test/solana/sync-worker.spec.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/test/solana/sync-worker.spec.ts) (5 tests passing).

### 2. Workstream 2: Single Typed `SolanaNetworkConfig` Architecture

- **Canonical Module in [`lib/solana/network-config.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/network-config.ts):**
  - Exported [`SolanaNetworkConfig`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/network-config.ts#L18-L45) and [`getSolanaNetworkConfig()`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/network-config.ts#L47-L125).
  - Pinned canonical Mainnet-Beta genesis hash: `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`.
  - Enforced fail-closed production guards: forbids devnet fallback under `NODE_ENV === 'production'` or `SOLANA_NETWORK === 'mainnet-beta'`, requires non-empty RPCs, and asserts cluster genesis hash.
  - Implemented `buildExplorerTxUrl(signature)` dynamically appending `?cluster=devnet` only on Devnet.
- **Refactored Call Sites:**
  - [`components/providers/SolanaWalletProvider.tsx`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/components/providers/SolanaWalletProvider.tsx): Derived RPC URLs, Solflare adapter network, and network badge from `networkConfig`.
  - [`lib/solana/asol-solana-client.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/asol-solana-client.ts): Replaced static Devnet RPC and hardcoded `?cluster=devnet` explorer links with `networkConfig.buildExplorerTxUrl()`.
  - [`app/api/esms/claim/route.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/app/api/esms/claim/route.ts): Dynamically derives `solana-${networkConfig.network}`.
- **Test Spec:** Created [`test/solana/network-config.spec.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/test/solana/network-config.spec.ts) (5 tests passing).

### 3. Workstream 3: Authority Hardening & Attestation Feeder Integrity

- **Dependency Installed:** Added `@aws-sdk/client-kms@3.1124.0` in [`package.json`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/package.json).
- **Server Ephemeris in [`lib/staking/aspects.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/staking/aspects.ts):**
  - Added [`livePlanetsFromDate()`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/staking/aspects.ts#L39-L59) using [`calculateAllPlanets`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/enhanced-astronomical-calculator.ts) for trusted Keplerian ephemeris math.
  - Extended [`planetLongitudes()`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/staking/aspects.ts#L61-L68) and [`aspectPools()`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/staking/aspects.ts#L153-L163) to accept `LivePlanet[] | Date | number`.
- **KMS Signer in [`lib/solana/amm-attestor.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/amm-attestor.ts):**
  - Added [`getAmmAttestorSigner()`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/amm-attestor.ts#L69-L135) to drive Ed25519 signing via Cloud KMS (`KmsSolanaSigner`).
  - Added fail-closed rule prohibiting raw keypair fallback in `NODE_ENV === 'production'`.
  - Upgraded [`signAmmVisibilityAttestation()`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/amm-attestor.ts#L160-L177) to `async`.
- **Feeder Route Hardening in [`app/api/solana/amm-attestation/route.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/app/api/solana/amm-attestation/route.ts):**
  - **Rejects Untrusted Inputs:** Returns 400 if client supplies `planets` in request payload.
  - **Coordinate Validation:** Validates `lat` $\in [-90, 90]$ and `lon` $\in [-180, 180]$.
  - **Abuse Controls:** Added in-memory sliding window rate limiter (max 20 requests per 10s per trader).
  - **Server-Side Ephemeris:** Computes active pool aspects and horizon visibility server-side.
  - **Ed25519 Precompile Attestation:** Signs canonical 170-byte preimage using `signAmmVisibilityAttestation`.
- **Test Spec:** Created [`test/solana/amm-attestation.spec.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/test/solana/amm-attestation.spec.ts) (7 tests passing).

---

## 🎯 Next Targets: Phase 2 Remediation (Steps 4, 5, & 6)

The next session focuses on **executing Steps 4, 5, and 6** of the [Remediation Sequence](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/docs/SOLANA_MAINNET_MIGRATION_ROADMAP.md#25-recommended-remediation-sequence) to clear the remaining launch blockers before production deployment:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PHASE 2 REMEDIATION TARGET WORKSTREAMS                          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Workstream 4: Immutable Metadata Automation & Constants Pinning (Blocker 4)            │
│  - Execute live/mock Irys upload via scripts/metadata/upload-arweave-metadata.ts       │
│  - Commit populated metadata/solana/arweave-manifest.json                             │
│  - Update programs/asol_program/src/constants.rs with immutable Arweave URIs          │
│  - Verify Token-2022 metadata pointer size and rent exemption matrix                   │
│                                           │                                            │
│                                           ▼                                            │
│ Workstream 5: Phase 7 Deployment Scripts & Release Artifacts (Blocker 1 & 7)           │
│  - Implement scripts/deploy/deploy-mainnet.sh (reproducible build & genesis check)     │
│  - Implement scripts/deploy/init-mainnet.ts (idempotent ProgramConfig & mint init)     │
│  - Commit initial deployments/solana-mainnet.json and .env.production.sample          │
│  - Document Squads v4 multisig authority handoff runbook                               │
│                                           │                                            │
│                                           ▼                                            │
│ Workstream 6: Finality Hardening & Reconciliation Safety (Weakness 1 & 3)              │
│  - Upgrade settlement confirmations from 'confirmed' to 'finalized'                    │
│  - Add durable reconciliation between PostgreSQL claims and on-chain supply            │
│  - Implement circuit breakers / daily velocity limit guards on claim routes            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Workstream 4 — Immutable Metadata Automation & Constants Pinning (P0 Launch Blocker 4)

### Context & Root Cause

Anchor `asol_program` has **no metadata update instruction**. The URIs written during `initialize_esms_mints` are permanently immutable. Initializing Mainnet with current constants locks mutable `https://alchm.kitchen/metadata/esms/*.json` URLs forever.
Currently:

1. [`metadata/solana/arweave-manifest.json`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/metadata/solana/arweave-manifest.json) contains all `null`s.
2. [`programs/asol_program/src/constants.rs`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/programs/asol_program/src/constants.rs#L42-L47) points to placeholder `alchm.kitchen` endpoints.

### Required Actions

1. **Execute Upload Workflow:**
   - Run or rehearse [`scripts/metadata/upload-arweave-metadata.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/scripts/metadata/upload-arweave-metadata.ts).
   - Perform the two-pass upload: SVG elemental icons first, patch image URIs into JSON manifests, upload JSON manifests.
   - Run readback verification against `https://arweave.net/<txId>` to verify payload sha256 checksums match local files.
2. **Commit Populated Manifest:**
   - Commit populated [`metadata/solana/arweave-manifest.json`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/metadata/solana/arweave-manifest.json) with permanent transaction IDs.
3. **Pin Constants in Rust:**
   - Update `ESMS_METADATA_URIS` in [`programs/asol_program/src/constants.rs`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/programs/asol_program/src/constants.rs) with the verified Arweave URLs.
4. **Validate Account Rent & Sizes:**
   - Run [`test/solana/metadata-uris.spec.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/test/solana/metadata-uris.spec.ts) and [`test/solana/upload-arweave-metadata.spec.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/test/solana/upload-arweave-metadata.spec.ts).

---

## Workstream 5 — Phase 7 Deployment Scripts & Release Artifacts (P0 Launch Blocker 1 & 7)

### Context & Root Cause

Program `5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD` has no account on Mainnet-Beta. The deploy scripts and initialization scripts required by Phase 7 do not exist in the repository.

### Required Actions

1. **Create [`scripts/deploy/deploy-mainnet.sh`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/scripts/deploy/deploy-mainnet.sh):**
   - Assert cluster genesis hash equals `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`.
   - Execute reproducible Docker build using `backpackapp/build:v0.30.1`.
   - Verify build artifact sha256 hash.
   - Buffer deploy `asol_program.so` to Mainnet-Beta.
2. **Create [`scripts/deploy/init-mainnet.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/scripts/deploy/init-mainnet.ts):**
   - Idempotently initialize `ProgramConfig` PDA with cluster domain and KMS attestor pubkey.
   - Initialize the 4 `EsmsMint` accounts (`Spirit`, `Essence`, `Matter`, `Substance`) with immutable Token-2022 extensions.
   - Verify mint creation space, metadata pointer, and permanent delegate.
3. **Generate Deployment Artifacts:**
   - Create initial [`deployments/solana-mainnet.json`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/deployments/solana-mainnet.json).
   - Create `.env.production.sample` documenting all required Mainnet variables.
4. **Document Squads v4 Multisig Handoff:**
   - Detail the commands to transfer program upgrade authority and `ProgramConfig.admin` authority to the Squads v4 multisig vault.

---

## Workstream 6 — Finality Hardening & Reconciliation Safety (Material Weaknesses 1 & 3)

### Context & Root Cause

1. Client and claim routes await `'confirmed'` commitment, but the indexer expects `'finalized'`, exposing a window for fork rollbacks.
2. The protocol lacks daily velocity caps or circuit breakers on claim minting.

### Required Actions

1. **Enforce `'finalized'` on Settlement Claims:**
   - In [`lib/solana/solana-minter.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/solana-minter.ts#L151) and [`app/api/esms/claim/route.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/app/api/esms/claim/route.ts): require `'finalized'` commitment before updating off-chain claim status in PostgreSQL.
2. **Off-Chain Reconciliation Check:**
   - Add a reconciliation function comparing total atoms claimed in PostgreSQL against on-chain Token-2022 mint supplies.
3. **Velocity Limits & Circuit Breakers:**
   - Add daily atom mint velocity limits and emergency pause handling.

---

## Verification & Acceptance Gates for Next Session

Run these commands in order to verify:

```bash
# 1. Typecheck entire Solana surface
bun run typecheck:solana

# 2. Run all Solana unit tests (currently 166 passing)
bun run test:solana:unit

# 3. Verify metadata tests
bunx vitest run test/solana/metadata-uris.spec.ts \
                test/solana/upload-arweave-metadata.spec.ts \
                --config vitest.solana.config.ts

# 4. Verify dry-run of settlement-sync worker
SOLANA_SYNC_WEBHOOK_URL="http://localhost:3000/api/mock-webhook" \
SOLANA_SYNC_WEBHOOK_SECRET="test-secret" \
bun run scripts/run-asol-solana-service.ts --dry-run
```

---

## File Modification Plan for Next Session

| Priority | Action     | File Path                                                                                                                                    | Scope of Change                                                                   |
| :------- | :--------- | :------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- |
| **P0**   | `[MODIFY]` | [`metadata/solana/arweave-manifest.json`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/metadata/solana/arweave-manifest.json)   | Populate verified Arweave transaction IDs and checksums.                          |
| **P0**   | `[MODIFY]` | [`programs/asol_program/src/constants.rs`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/programs/asol_program/src/constants.rs) | Replace mutable `alchm.kitchen` URLs with permanent `https://arweave.net/<txId>`. |
| **P0**   | `[NEW]`    | [`scripts/deploy/deploy-mainnet.sh`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/scripts/deploy/deploy-mainnet.sh)             | Verifiable Docker build, genesis check, and buffer deploy script.                 |
| **P0**   | `[NEW]`    | [`scripts/deploy/init-mainnet.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/scripts/deploy/init-mainnet.ts)                 | Idempotent initialization script for Mainnet-Beta PDAs and ESMS mints.            |
| **P0**   | `[NEW]`    | [`deployments/solana-mainnet.json`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/deployments/solana-mainnet.json)               | Mainnet deployment manifest recording program ID, mints, and authorities.         |
| **P0**   | `[NEW]`    | [`.env.production.sample`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/.env.production.sample)                                 | Canonical production environment template with fail-closed requirements.          |
| **P1**   | `[MODIFY]` | [`lib/solana/solana-minter.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/solana-minter.ts)                       | Require `'finalized'` commitment on claims to prevent fork rollbacks.             |
| **P1**   | `[MODIFY]` | [`app/api/esms/claim/route.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/app/api/esms/claim/route.ts)                       | Enforce `'finalized'` settlement status before updating PostgreSQL ledger.        |
