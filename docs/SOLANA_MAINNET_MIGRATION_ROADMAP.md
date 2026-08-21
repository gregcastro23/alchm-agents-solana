# AlchmAgentsSolana (`ASOL`) Mainnet Migration Roadmap

**Program ID:** `5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD`  
**Target Networks:** Solana Devnet (Active) ➔ Solana Mainnet-Beta  
**Runtime:** Bun (`bun` and `bun --bun run dev`) | Anchor `0.30.1`  
**Authoritative Ledger:** PostgreSQL / WTEN `Decimal(12,4)` (4-Decimal Precision: $10^4$ raw atoms)

---

## Executive Overview & Milestone Progression

This roadmap provides an execution plan broken down **prompt-by-prompt** into modular phases. Each chunk contains:

1. **Goal & Target Files**
2. **Technical Specifications & Invariants**
3. **Exact Ready-to-Copy Prompt**
4. **Verification & Acceptance Criteria**

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              PHASED EXECUTION PIPELINE                                 │
├──────────────────────────────┬──────────────────────────────┬──────────────────────────┤
│ Phase 1: Governance & KMS    │ Phase 2: Network Resiliency  │ Phase 3: Storefront UI   │
│ Prompt 1: Squads & Cloud KMS │ Prompt 2: Priority Fees & RPC│ Prompt 3: ShopClient.tsx │
├──────────────────────────────┼──────────────────────────────┼──────────────────────────┤
│ Phase 4: Metadata & Build    │ Phase 5: StarVault Staking   │ Phase 6: Constellation   │
│ Prompt 4: Arweave & Verify   │ Prompt 5: Checkpointed Yield │ Prompt 6: AMM & Deeds    │
├──────────────────────────────┴──────────────────────────────┴──────────────────────────┤
│ Phase 7: Mainnet Deployment, Rehearsal & Verification (Prompt 7)                       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Prompt 1 — Governance & Cloud KMS Key Management (Phase 1)

### Objective

Migrate hot settlement and attestor private keys from environment variables and disk (`SOLANA_AGENT_PAYER_KEY`) to **Cloud KMS HSM** (AWS KMS / GCP Cloud KMS), and prepare the **Squads v4 Multisig** governance structure for program upgrade authority.

### Target Files

- `lib/solana/kms-signer.ts` (New)
- `lib/solana/solana-minter.ts`
- `lib/solana/bridge-service.ts`
- `scripts/governance/transfer-upgrade-authority.ts` (New)

### Technical Specifications

- Implement an asymmetric Ed25519 signer client adhering to the `AsolSolanaWallet` interface without exposing private keys.
- Add fallback logic: Cloud KMS in production, local keypair/environment variable in local development.
- Write the Squads v4 multisig transaction builder to manage `set_service_authorities` proposals.

### Copy-Paste Prompt 1

```text
Execute Phase 1 of the Solana Mainnet Migration for AlchmAgentsSolana (ASOL): Cloud KMS and Governance Management.

1. Implement `lib/solana/kms-signer.ts`:
   - Create `KmsSolanaSigner` supporting AWS KMS and GCP Cloud KMS for Ed25519 signing.
   - Implement the `AsolSolanaWallet` interface (`publicKey`, `signTransaction`, `signAllTransactions`).
   - Ensure the raw private key never leaves the HSM boundary; transactions are serialized, hashed, and signed via the KMS API.
   - Provide seamless fallback to `solanaPayerFromEnvironment()` for development and tests when KMS environment variables are not set.

2. Update `lib/solana/solana-minter.ts` and `lib/solana/bridge-service.ts`:
   - Replace direct synchronous keypair dependencies with `getSolanaServiceSigner()`.
   - Maintain full compatibility with existing test suites.

3. Create `scripts/governance/squads-multisig-runbook.ts`:
   - Script to construct and verify a Squads v4 multisig proposal to accept program upgrade authority and update `ProgramConfig` admin/pauser roles.

4. Add unit and integration tests in `test/solana/kms-signer.spec.ts` with mocked KMS responses and run `bun run test:solana`.
```

---

## Prompt 2 — Network Resiliency, Dynamic Priority Fees & Geyser Failover (Phase 2)

### Objective

Ensure transactions land reliably during peak network congestion on Solana Mainnet through dynamic compute unit limit profiling, micro-lamport prioritization pricing, and low-latency Yellowstone gRPC Geyser ingestion.

### Target Files

- `lib/solana/priority-fee.ts` (New)
- `lib/solana/rpc-failover.ts`
- `lib/solana/solana-sync-service.ts`
- `lib/solana/asol-solana-client.ts`

### Technical Specifications

- Profile compute unit consumption:
  - `claim_mint_esms`: ~125,000 CU limit.
  - `redeem_esms`: ~75,000 CU limit.
  - `redeem_for_esms` (with Ed25519 precompile): ~110,000 CU limit.
  - `record_persona_commitment`: ~45,000 CU limit.
- Query dynamic priority fees using `getRecentPrioritizationFees` with percentile options (median, 75th percentile) and fallback bounds.
- Integrate Yellowstone gRPC streaming adapter into `solana-sync-service.ts` alongside standard WebSocket logs subscription.

### Copy-Paste Prompt 2

```text
Execute Phase 2 of the Solana Mainnet Migration for AlchmAgentsSolana (ASOL): Dynamic Priority Fees & Geyser Failover.

1. Implement `lib/solana/priority-fee.ts`:
   - Create `estimatePriorityFee(connection, accounts, percentile)` querying `getRecentPrioritizationFees`.
   - Implement `withComputeBudget(instructions, { units, microLamports })` injecting `ComputeBudgetProgram.setComputeUnitLimit` and `ComputeBudgetProgram.setComputeUnitPrice` as the first transaction instructions.
   - Define exact CU profiles for `claim_mint_esms`, `redeem_esms`, `redeem_for_esms`, and `record_persona_commitment`.

2. Enhance `lib/solana/asol-solana-client.ts`:
   - Update `sendInstructions` to automatically attach compute budget and dynamic priority fees before requesting wallet signatures.

3. Enhance `lib/solana/rpc-failover.ts` and `lib/solana/solana-sync-service.ts`:
   - Add Yellowstone gRPC stream subscriber option for Helius / Triton RPC nodes.
   - Implement automatic fallback: Yellowstone gRPC -> WebSocket logsSubscribe -> Polling backfill.

4. Add tests in `test/solana/priority-fee.spec.ts` verifying instruction ordering and CU budgeting, then run `bun run test:solana`.
```

---

## Prompt 3 — Dual-Rail Storefront & Solana Checkout Flow in `ShopClient.tsx` (Phase 3)

### Objective

Wire the native Solana checkout rail in `components/shop/ShopClient.tsx`, enabling users to purchase apothecary boosts, digital items, and sigils via `redeem_for_esms` and detached Ed25519 authorization.

### Target Files

- `components/shop/ShopClient.tsx`
- `app/api/shop/purchase/route.ts`
- `lib/solana/useSolanaShop.ts` (New)
- `components/providers/SolanaWalletProvider.tsx`

### Technical Specifications

- Dual-rail toggle: Users can select whether to pay using Base Sepolia / Base (EVM) or Solana.
- Solana Flow:
  1. Client requests challenge: `POST /api/shop/purchase { itemId, rail: 'solana' }`.
  2. Server generates `orderId`, derives canonical message via `buildRedeemAuthorizationMessage(...)`, and returns challenge.
  3. Client signs the challenge message with their connected Solana wallet (`signMessage`).
  4. Client submits detached signature to server: `POST /api/shop/purchase { itemId, rail: 'solana', signature, deadline, orderId }`.
  5. Backend relayer submits atomic transaction (`Ed25519Program` verify + `redeem_for_esms`).
  6. Server grants purchase entitlement upon finalized transaction receipt.

### Copy-Paste Prompt 3

```text
Execute Phase 3 of the Solana Mainnet Migration for AlchmAgentsSolana (ASOL): Dual-Rail Storefront Checkout.

1. Implement `lib/solana/useSolanaShop.ts`:
   - Hook to coordinate Solana ESMS burning: request challenge, sign detached Ed25519 authorization via `useSolanaWalletState()`, and submit to backend.

2. Update `app/api/shop/purchase/route.ts`:
   - Add support for `rail: 'solana'`.
   - When rail is Solana:
     a. Validate user's bound Solana wallet in `VerifiedSolanaWallet` table.
     b. Read Solana ESMS Token-2022 balances using `AsolSolanaClient.readEsmsBalances()`.
     c. Verify balance sufficiency against 4-decimal catalog pricing.
     d. Challenge phase: return `orderId`, `deadline`, `clusterDomain`, and canonical message payload.
     e. Execution phase: execute `redeemEsmsFor()` using backend relayer, submit `redeem_for_esms` transaction, confirm receipt, and call `grantPurchase()`.

3. Update `components/shop/ShopClient.tsx`:
   - Add Payment Rail Selector ("Base (EVM)" vs "Solana Token-2022").
   - Display both EVM and Solana ESMS balances side-by-side or based on active tab.
   - Connect the purchase button to `buyDigitalSolana()` when the Solana rail is selected.
   - Emit transaction toast with Solana Explorer link upon confirmation.

4. Test the complete flow and verify all existing Vitest suites pass.
```

---

## Prompt 4 — Mainnet Token-2022 Metadata & Verifiable Anchor Build (Phase 4)

### Objective

Create and register permanent, decentralized metadata on Arweave for the 4 ESMS mints and establish reproducible, verifiable Anchor program builds.

### Target Files

- `metadata/solana/spirit.json` (New)
- `metadata/solana/essence.json` (New)
- `metadata/solana/matter.json` (New)
- `metadata/solana/substance.json` (New)
- `scripts/metadata/upload-arweave-metadata.ts` (New)
- `Anchor.toml`
- `programs/asol_program/Cargo.toml`

### Technical Specifications

- Metadata format: Standard Token-2022 Metadata schema embedded directly into the mint accounts via `MetadataPointer`.
- Permanent decentralized hosting on Arweave (via Irys/Bundlr) for JSON schemas and elemental SVG/PNG assets.
- Verifiable build configuration: `anchor build --verifiable` with Solana 1.18.17 / Anchor 0.30.1 Docker image.

### Copy-Paste Prompt 4

```text
Execute Phase 4 of the Solana Mainnet Migration for AlchmAgentsSolana (ASOL): Metadata Registration and Verifiable Build.

1. Create permanent Token-2022 JSON metadata manifests in `metadata/solana/`:
   - `spirit.json`, `essence.json`, `matter.json`, `substance.json`.
   - Include element traits, alchemical axis (Fire, Water, Earth, Air), 4-decimal precision specification, and soulbound non-transferability attributes.

2. Create `scripts/metadata/upload-arweave-metadata.ts`:
   - Script to upload metadata files and icons to Arweave using Irys / Bundlr.
   - Script to update on-chain `TokenMetadata` pointers on the 4 Token-2022 mints via program authority.

3. Update `Anchor.toml` and documentation for Verifiable Build:
   - Configure mainnet cluster parameters in `Anchor.toml`.
   - Create `docs/deployment/VERIFIABLE_BUILD_RUNBOOK.md` detailing exact `anchor build --verifiable` commands and `solana-verify` validation steps.

4. Run `bun test:solana` to ensure all vector and IDL generation assertions remain green.
```

---

## Prompt 5 — StarVault Staking & Checkpointed Yield Accrual (Parity Port)

### Objective

Port Arc EVM's `StarVault` staking protocol to Solana, remediating the historical retroactive timestamp accrual vulnerability with a zero-loss checkpointed accumulator.

### Target Files

- `programs/asol_program/src/instructions/staking/mod.rs` (New)
- `programs/asol_program/src/state/staking.rs` (New)
- `lib/solana/star-vault.ts` (New)
- `test/solana/star-vault.spec.ts` (New)

### Technical Specifications

- Accounts: `StarVaultState` (`["star-vault"]`), `StarPool` (`["star-pool", star_id]`), `StakePosition` (`["stake", star_id, staker]`).
- Checkpointed Yield Math:
  $$\text{accrued\_cap} \mathrel{+}= \frac{\text{old\_principal} \times \text{max\_rate} \times (\text{now} - \text{last\_checkpoint})}{10^6 \times 86400}$$
  $$\text{last\_checkpoint} = \text{now}$$
- Proof Verification: Replicate OpenZeppelin `StandardMerkleTree` uint32 leaf verification on-chain (`openZeppelinStarLeaf`).
- Unstake: Always available, never pausable.

### Copy-Paste Prompt 5

```text
Execute Phase 5 of the Solana Migration for AlchmAgentsSolana (ASOL): StarVault Staking & Checkpointed Yield Engine.

1. Implement `programs/asol_program/src/state/staking.rs`:
   - `StarVaultState`, `StarPool`, and `StakePosition` accounts.
   - Include `accrued_cap`, `last_checkpoint`, `shares`, `principal`, and claim nonce.

2. Implement Anchor instructions in `programs/asol_program/src/instructions/staking/`:
   - `activate_star`: Verify OpenZeppelin StandardMerkleTree proof against `GlobalConfig.star_root`.
   - `stake_star`: Checkpoint accrued yield cap using old principal, transfer USDC to vault PDA, and mint shares.
   - `unstake_star`: Checkpoint yield, burn shares, and transfer USDC back (non-pausable).
   - `claim_star_yield`: Validate Ed25519 attestor signature, clamp amount to accrued cap, consume nonce, and mint Token-2022 ESMS.

3. Implement TypeScript client SDK in `lib/solana/star-vault.ts`.

4. Add unit and integration tests in `test/solana/star-vault.spec.ts` proving:
   - Proof verification matches OpenZeppelin golden vector.
   - Top-up attacks cannot retroactively earn yield on un-staked time.
   - Unstake functions during paused claim state.
   - Run `bun test:solana`.
```

---

## Prompt 6 — Constellation Virtual-Reserve AMM & LP Deeds (Parity Port)

### Objective

Port Arc EVM's `ConstellationAMM` to Solana, locking bootstrap liquidity permanently and binding LP positions to non-fungible Token-2022 Deed NFTs.

### Target Files

- `programs/asol_program/src/instructions/amm/mod.rs` (New)
- `programs/asol_program/src/state/amm.rs` (New)
- `programs/asol_program/src/state/deed.rs` (New)
- `lib/solana/constellation-amm.ts` (New)
- `test/solana/constellation-amm.spec.ts` (New)

### Technical Specifications

- Virtual-Reserve Constant Product: $x \cdot y = k$ with `u128` intermediates.
- Reentrancy & Mint Guard: One-time pool bootstrapping; initial unbacked shares are permanently locked in a non-withdrawable PDA.
- LP Deed NFT: Token-2022 mint (`decimals = 0`, `supply = 1`, Non-Transferable = FALSE).
- Swaps: Burns input ESMS and mints output ESMS atomically.
- Withdrawals: Always available, burns Deed NFT, and mints owed ESMS reserves.

### Copy-Paste Prompt 6

```text
Execute Phase 6 of the Solana Migration for AlchmAgentsSolana (ASOL): Constellation AMM & LP Deed NFTs.

1. Implement `programs/asol_program/src/state/amm.rs` and `deed.rs`:
   - `ConstellationPool` (`["constellation", pool_id]`): virtual reserves, shares, fee BPS ($\le 10,000$), element pair.
   - `DeedPosition` (`["deed", deed_mint]`): owner, shares, created slot.

2. Implement Anchor instructions in `programs/asol_program/src/instructions/amm/`:
   - `register_pool`: Validate distinct elements and fee BPS.
   - `bootstrap_pool`: One-time initialization; locks bootstrap shares in a non-withdrawable PDA.
   - `add_liquidity`: Burns ESMS inputs, verifies slippage/ratio tolerance, and mints a Token-2022 Deed NFT.
   - `swap_esms`: Requires visibility attestation, performs u128 constant-product math, burns input element, and mints output element.
   - `withdraw_liquidity`: Always available; verifies Deed ownership, burns Deed NFT, and mints underlying ESMS reserves.

3. Implement TypeScript client SDK in `lib/solana/constellation-amm.ts`.

4. Add unit and integration tests in `test/solana/constellation-amm.spec.ts` and run `bun test:solana`.
```

---

## Prompt 7 — Mainnet Deployment, Rehearsal & Verification Runbook (Phase 7)

### Objective

Execute the live production deployment of `asol_program` to Solana Mainnet-Beta, initialize configuration PDAs and Token-2022 mints, verify on-chain bytecode, and switch the frontend connection.

### Target Files

- `scripts/deploy/deploy-mainnet.sh` (New)
- `scripts/deploy/init-mainnet.ts` (New)
- `deployments/solana-mainnet.json` (New)
- `.env.production`

### Checklist & Steps

1. **Pre-Flight Funding:** Ensure deployer keypair has sufficient SOL (~5.5 SOL for program buffer + rent for PDAs and 4 Token-2022 mints).
2. **Deterministic Program Deployment:** Deploy `asol_program` via Anchor CLI.
3. **Idempotent Initialization:** Run `init-mainnet.ts` to create `ProgramConfig` and the 4 `EsmsMint` Token-2022 accounts.
4. **Authority Handover:** Transfer upgrade authority to the Squads v4 Multisig.
5. **Bytecode Verification:** Run `solana-verify` to register verified source status on Solana Explorer / SolanaFM.
6. **Sync Service Activation:** Launch `solana-sync-service` worker pointing to Mainnet Yellowstone / RPC.

### Copy-Paste Prompt 7

```text
Execute Phase 7 of the Solana Migration for AlchmAgentsSolana (ASOL): Mainnet Deployment & Verification Runbook.

1. Implement `scripts/deploy/init-mainnet.ts`:
   - Idempotent script that checks RPC cluster genesis hash to guarantee execution on Mainnet-Beta.
   - Derives and checks all PDAs (`ProgramConfig`, 4 `EsmsMint` accounts).
   - Initializes config with Squads multisig attestor/pauser and sets cluster domain to `ASOL_MAINNET_V1`.
   - Initializes the 4 Token-2022 mints with `NonTransferable`, `PermissionedBurn`, `PermanentDelegate`, and `MetadataPointer`.
   - Saves deployment receipt to `deployments/solana-mainnet.json`.

2. Create `scripts/deploy/deploy-mainnet.sh`:
   - Verifies Bun runtime and Solana CLI tools.
   - Runs `anchor build --verifiable`.
   - Deploys program to Mainnet-Beta.
   - Executes `init-mainnet.ts`.
   - Submits `solana-verify` build verification.

3. Update production environment configuration in `.env.production.sample` with Mainnet RPC endpoints and program addresses.

4. Run dry-run simulation against localnet/devnet and verify zero regressions across the test suite with `bun test:solana`.
```

---

## 4. Test Execution & Quality Assurance Standards

Before moving between prompts, the following test suite must always be run and verified:

```bash
# 1. Fast vector and Rust program tests
bun run test:solana

# 2. Comprehensive Vitest Solana test suite
bunx vitest run test/solana/golden-vectors.spec.ts \
                test/solana/solana-minter.spec.ts \
                test/solana/sync-and-wallet.spec.ts \
                test/solana/production-integration.spec.ts \
                --config vitest.solana.config.ts
```

### Protocol Invariant Checklist

- [x] **Decimal Integrity:** All token units strictly use 4 decimals ($10^4$ raw atoms / `Decimal(12,4)`). No floating-point or JS `number` conversions for on-chain integers.
- [x] **Soulbound Security:** `NonTransferable` + `PermissionedBurn` extensions prevent unauthorized wallet transfers and holder-side out-of-band burns.
- [x] **Detached Ed25519 Authentication:** Sysvar introspection guarantees holder authorization message, deadline, and cluster domain match exactly.
- [x] **Monotonic State Anchoring:** JEPA commitments verify sequential updates ($\text{seq}_{n+1} = \text{seq}_n + 1$) and non-zero SHA-256 digests.
- [x] **Durable Indexing:** `SolanaProcessedTx` and transactional outbox guard against duplicate processing or dropped events across network hiccups.
