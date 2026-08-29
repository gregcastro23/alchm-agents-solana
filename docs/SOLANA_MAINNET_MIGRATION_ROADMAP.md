# AlchmAgentsSolana (`ASOL`) Mainnet Migration Roadmap & Prompt-by-Prompt Execution Blueprint

**Document Version:** `2.0.0-PROD`  
**Program ID:** `5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD`  
**Cluster Target:** Solana Devnet ➔ Solana Mainnet-Beta  
**Runtime & Toolchain:** Bun (`bun` and `bun --bun run dev`) | Anchor `0.30.1` | Solana `1.18.17` | Rust `1.79.0`  
**Authoritative Ledger:** PostgreSQL / WTEN `Decimal(12,4)` ($10^4$ raw atoms / 4-decimal Token-2022 precision)

---

## 1. Executive Overview & System Topology

The **AlchmAgentsSolana (`ASOL`)** architecture orchestrates high-throughput, low-cost native settlement for Planetary Agents, the 4-element ESMS Alchemical Economy (Spirit, Essence, Matter, Substance), and JEPA (Joint Embedding Predictive Architecture) persona commitment anchoring.

### Core Architectural Invariants

1. **Ledger-Coordinated Dual-Rail Settlement:** Every claim and redemption is assigned an immutable target chain (`eip155:84532` Base Sepolia / Base or `solana:devnet` / `solana:mainnet-beta`).
2. **Lossless $10^4$ Integer Boundary:** Rust Anchor contracts use native `u64` raw atoms and `u128` intermediate arithmetic. JavaScript/TypeScript never passes token units or slots through IEEE-754 `number`.
3. **Token-2022 Soulbound & Permissioned Burn Security:** All 4 ESMS mints enforce `NonTransferable` + `PermissionedBurn` + `PermanentDelegate` + `MetadataPointer`. Standard holder burning is disallowed; burns require co-signing by the `EsmsMintAuthority` PDA.
4. **Sysvar Introspection for Sponsored Redemptions:** `redeem_for_esms` inspects `SYSVAR_INSTRUCTIONS_PUBKEY` to verify preceding `Ed25519Program` signatures over canonical `ASOL_ESMS_REDEEM_V1` messages.
5. **Monotonic JEPA Anchoring:** Persona commitments enforce strictly increasing sequence numbers ($\text{seq}_{n+1} = \text{seq}_n + 1$), non-zero SHA-256 digests, and canonical float/JSON serialization.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              PHASED EXECUTION PIPELINE                                 │
├──────────────────────────────┬──────────────────────────────┬──────────────────────────┤
│ Phase 1: Governance & KMS    │ Phase 2: Network Resiliency  │ Phase 3: Storefront UI   │
│ Prompt 1: Squads & Cloud KMS │ Prompt 2: Priority Fees & RPC│ Prompt 3: ShopClient.tsx │
│ [STATUS: COMPLETED (PR #4)]  │ [STATUS: COMPLETED (PR #5)]  │ [STATUS: COMPLETED (PR#6)]│
├──────────────────────────────┼──────────────────────────────┼──────────────────────────┤
│ Phase 4: Metadata & Build    │ Phase 5: StarVault Staking   │ Phase 6: Constellation   │
│ Prompt 4: Arweave & Verify   │ Prompt 5: Checkpointed Yield │ Prompt 6: AMM & Deeds    │
│ [STATUS: COMPLETED (PR #7)]  │ [STATUS: READY / NEXT]       │ [STATUS: QUEUED]         │
├──────────────────────────────┴──────────────────────────────┴──────────────────────────┤
│ Phase 7: Mainnet Deployment, Live Rehearsal & Verification Runbook (Prompt 7) [QUEUED] │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Migration Progress & Phase Status

| Phase       | Title                                  | Target Scope                                            | Status        | References / PR                                                                        |
| :---------- | :------------------------------------- | :------------------------------------------------------ | :------------ | :------------------------------------------------------------------------------------- |
| **Phase 1** | Governance & Cloud KMS Key Management  | AWS KMS / GCP KMS HSM Signer, Squads v4 Runbook         | **COMPLETED** | [PR #4](https://github.com/gregcastro23/alchm-agents-solana/pull/4) / Commit `aa782d3` |
| **Phase 2** | Network Resiliency & Dynamic Fees      | CU Budgeting, Priority Fees, Yellowstone Geyser         | **COMPLETED** | [PR #5](https://github.com/gregcastro23/alchm-agents-solana/pull/5) / Commit `563a807` |
| **Phase 3** | Storefront & Detached Checkout         | Dual-rail Shop, detached Ed25519 redeem_for_esms        | **COMPLETED** | [PR #6](https://github.com/gregcastro23/alchm-agents-solana/pull/6) / Commit `565d768` |
| **Phase 4** | Token-2022 Metadata & Verifiable Build | Arweave metadata, reproducible Docker Anchor build      | **COMPLETED** | [PR #7](https://github.com/gregcastro23/alchm-agents-solana/pull/7) / Commit `499afee` |
| **Phase 5** | StarVault Staking & Yield Claims       | Checkpointed yield accumulator, Hipparcos star pools    | **COMPLETED** | [PR #9](https://github.com/gregcastro23/alchm-agents-solana/pull/9) / Commit `8a52479` |
| **Phase 6** | Constellation AMM & LP Deed Positions  | Constant-product AMM, owner-seeded LP position PDAs     | **COMPLETED** | `programs/asol_program/src/instructions/amm/mod.rs`                                    |
| **Phase 7** | Mainnet Deployment & Live Rehearsal    | Mainnet deployment runbook, Genesis check, Verification | **QUEUED**    | `scripts/deploy/deploy-mainnet.sh`                                                     |

---

## Prompt 1 — Governance & Cloud KMS Key Management (Phase 1) [COMPLETED — PR #4]

### Context & Architectural Seams

The backend minter ([`lib/solana/solana-minter.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/solana-minter.ts)) and bridge service ([`lib/solana/bridge-service.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/bridge-service.ts)) historically read raw private key bytes from `SOLANA_AGENT_PAYER_KEY` or disk (`~/.config/solana/id.json`). For Mainnet production, private keys must never touch application memory or persistent disk.

Phase 1 introduced **Cloud KMS HSM** (AWS KMS / GCP Cloud KMS) via asymmetric Ed25519 signing APIs, while establishing the **Squads v4 Multisig** governance transition runbook.

### Implemented Deliverables

- `[NEW]` [`lib/solana/kms-signer.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/kms-signer.ts) — Cloud KMS Ed25519 signer implementing `AsolSolanaWallet` for `aws`, `gcp`, and `local` keypair fallback with production guards.
- `[MODIFY]` [`lib/solana/solana-minter.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/solana-minter.ts) — Migrated `mintEsmsClaimSolana` to use `getSolanaServiceSigner()` with asynchronous `signer.signTransaction(tx)`.
- `[MODIFY]` [`lib/solana/bridge-service.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/bridge-service.ts) — Exported `resolveSolanaBridgeSigner` and `createSolanaBridgeClient` for Cloud KMS bridge relays.
- `[MODIFY]` [`scripts/run-asol-solana-service.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/scripts/run-asol-solana-service.ts) — Wired KMS signer resolution into service runners.
- `[MODIFY]` [`lib/jepa/onchain-sync.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/jepa/onchain-sync.ts) — Cleaned client imports for dual-chain JEPA anchoring.
- `[NEW]` [`scripts/governance/squads-multisig-runbook.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/scripts/governance/squads-multisig-runbook.ts) — Squads v4 proposal & PDA generator, BPF Loader Upgradeable authority transfer instruction, and `asol_program.set_service_authorities` Anchor instruction builder.
- `[NEW]` [`test/solana/kms-signer.spec.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/test/solana/kms-signer.spec.ts) — 11 unit & integration tests validating AWS KMS, GCP KMS, TweetNaCl verification, fallback guards, and Squads v4 PDAs.

### Architectural Insights & Lessons Learned

1. **Lightweight Pluggable KMS Clients Without Bloat:**
   - Dynamic optional imports (`@aws-sdk/client-kms`, `@google-cloud/kms`) allow runtime instantiation without imposing heavy mandatory bundle dependencies.
   - Injectable client interfaces (`AwsKmsClientLike`, `GcpKmsClientLike`) ensure 100% test isolation without requiring active cloud credentials during CI.

2. **Dual Transaction Serialization Invariants:**
   - **Legacy `Transaction`:** Uses `tx.serializeMessage()`, submits raw message bytes to Ed25519 `Sign`, and applies signature via `tx.addSignature(publicKey, signature)`.
   - **`VersionedTransaction` (v0):** Uses `tx.message.serialize()`, locates the public key index in `tx.message.staticAccountKeys`, and assigns the 64-byte signature into `tx.signatures[signerIndex]`.

3. **Zero-Secret In-Memory Rule in Production:**
   - `getSolanaServiceSigner()` throws an explicit error if running under `NODE_ENV=production` without `AWS_KMS_KEY_ID` or `GCP_KMS_KEY_NAME`, preventing accidental secret key leaks.
   - In non-production environments, it smoothly falls back to local keypair resolution (`SOLANA_AGENT_PAYER_KEY` or `~/.config/solana/id.json`) to maintain local test and development velocity.

4. **Squads v4 Multisig Invariants:**
   - Program ID: `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pcf`.
   - Multisig PDA: `seeds = [b"multisig", create_key]`.
   - Vault PDA: `seeds = [b"multisig", multisig_pda, &[vault_index]]`.
   - Proposal PDA: `seeds = [b"multisig", multisig_pda, b"proposal", &u64_le]`.
   - Transaction PDA: `seeds = [b"multisig", multisig_pda, b"transaction", &u64_le]`.
   - BPF Loader Upgradeable `ProgramData` address: `findProgramAddressSync([program_id], BPFLoaderUpgradeab1e11111111111111111111111)`.
   - `asol_program.set_service_authorities` discriminator: `[42, 156, 68, 130, 225, 158, 43, 33]`.

### Prompt 1 (XML Structured)

```xml
<prompt id="asol-phase-1-kms-governance" status="completed" pr="4">
  <context>
    <repository>AlchmAgentsSolana (ASOL)</repository>
    <program_id>5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD</program_id>
    <runtime>Bun (bun and bun --bun run dev)</runtime>
    <description>
      Phase 1 of the Solana Mainnet Migration: Implement Cloud KMS (AWS KMS &amp; GCP Cloud KMS)
      HSM signing for backend services and establish the Squads v4 multisig governance transition.
    </description>
  </context>

  <task>
    Implement production-grade Cloud KMS signing and Squads v4 multisig authority transition tooling.
  </task>

  <target_files>
    <file action="create">lib/solana/kms-signer.ts</file>
    <file action="modify">lib/solana/solana-minter.ts</file>
    <file action="modify">lib/solana/bridge-service.ts</file>
    <file action="create">scripts/governance/squads-multisig-runbook.ts</file>
    <file action="create">test/solana/kms-signer.spec.ts</file>
  </target_files>

  <technical_specifications>
    <kms_signer>
      1. Define `KmsSignerConfig`:
         - `provider`: 'aws' | 'gcp' | 'local'
         - `keyId`: string (AWS Key ARN or GCP Key Resource Path)
         - `publicKey`: PublicKey
      2. Implement `KmsSolanaSigner` satisfying `AsolSolanaWallet`:
         - `publicKey: PublicKey`
         - `signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T>`
         - `signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]>`
      3. For legacy `Transaction`: serialize message via `tx.serializeMessage()`, submit digest to KMS Ed25519 `Sign`, append signature with `tx.addSignature(publicKey, signature)`.
      4. For `VersionedTransaction`: serialize message via `tx.message.serialize()`, sign digest, append signature via `tx.signatures[0] = signature`.
      5. Implement `getSolanaServiceSigner()`:
         - If `AWS_KMS_KEY_ID` or `GCP_KMS_KEY_NAME` is set, instantiate `KmsSolanaSigner`.
         - Otherwise, fall back to `solanaPayerFromEnvironment()` with warning in non-production.
    </kms_signer>

    <squads_governance>
      1. Create `scripts/governance/squads-multisig-runbook.ts`:
         - Derive Squads v4 vault PDA and proposal PDAs.
         - Construct instructions to:
           a. Transfer Solana program upgrade authority (`solana program set-upgrade-authority`).
           b. Execute `asol_program.set_service_authorities` setting `admin` and `pauser` to the Squads Vault.
    </squads_governance>
  </technical_specifications>

  <testing_and_verification>
    1. In `test/solana/kms-signer.spec.ts`:
       - Mock AWS KMS `SignCommand` and GCP KMS `asymmetricSign`.
       - Verify that both legacy `Transaction` and `VersionedTransaction` instances receive valid 64-byte Ed25519 signatures.
       - Verify that the local fallback works seamlessly when environment variables are absent.
    2. Run full test suite:
       `bun test:solana && bunx vitest run test/solana/kms-signer.spec.ts test/solana/solana-minter.spec.ts --config vitest.solana.config.ts`
  </testing_and_verification>
</prompt>
```

---

## Prompt 2 — Network Resiliency, Dynamic Priority Fees & Geyser Failover (Phase 2) [COMPLETED — PR #5]

### Context & Architectural Seams

During high Mainnet traffic, fixed-fee Solana transactions risk starvation or block expiration. Furthermore, reliance on a single public or private RPC creates single-point-of-failure vulnerabilities. This phase introduces dynamic compute unit budgeting, real-time priority fee estimation, and Yellowstone gRPC Geyser stream failover into [`lib/solana/rpc-failover.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/rpc-failover.ts) and [`lib/solana/solana-sync-service.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/solana-sync-service.ts).

### Implemented Deliverables

- `[NEW]` [`lib/solana/priority-fee.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/priority-fee.ts) — Profiled CU limits (`CLAIM_MINT_CU_LIMIT = 135_000`, `REDEEM_SELF_CU_LIMIT = 80_000`, `REDEEM_SPONSORED_CU_LIMIT = 115_000`, `RECORD_PERSONA_CU_LIMIT = 50_000`), dynamic 65th percentile prioritization fee estimator (`estimatePriorityFee`), and compute budget instruction injector (`injectComputeBudgetInstructions`).
- `[MODIFY]` [`lib/solana/rpc-failover.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/rpc-failover.ts) — Multi-tier streaming failover supervisor (`createResilientStreamSubscription`) supporting Yellowstone gRPC (Tier 1) -> WebSocket `onLogs` (Tier 2) -> Polling backfill (Tier 3) with `activeTier` observability.
- `[MODIFY]` [`lib/solana/solana-sync-service.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/solana-sync-service.ts) — Real-time event ingestion wired to `createResilientStreamSubscription` with durable slot tracking and Yellowstone Geyser failover.
- `[MODIFY]` [`lib/solana/asol-solana-client.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/asol-solana-client.ts) — Auto-injects compute unit limits and dynamic priority fee budget into `sendInstructions` before wallet signing.
- `[NEW]` [`test/solana/priority-fee.spec.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/test/solana/priority-fee.spec.ts) — 12 unit and integration tests validating CU profiling, index 0/1 instruction ordering, fee percentile calculation, bounds clamping (5k to 2M), client transaction injection, and multi-tier stream failover.

### Architectural Insights & Lessons Learned

1. **Deterministic CU Profiling Prevents Fee Waste & Block Rejection:**
   - Default Solana transactions request 200,000 to 1,400,000 CU, wasting block space and increasing fees.
   - Profiled limits (`claim`: 135k, `redeem`: 80k, `redeemFor`: 115k with Ed25519 precompile, `persona`: 50k) guarantee optimal transaction scheduling and minimal compute fees without risk of compute exhaustion (`InstructionError::Custom(6000)`).

2. **Strict Instruction Indexing Order (Indices 0 and 1):**
   - Solana validators evaluate compute unit limits and priority fee prices from `ComputeBudgetProgram` instructions placed at the beginning of the transaction.
   - `injectComputeBudgetInstructions` strips any pre-existing budget instructions and strictly places `setComputeUnitLimit` at index 0 and `setComputeUnitPrice` at index 1 before any business instructions (including preceding Ed25519 precompile verification).

3. **Robust Percentile Estimation with Safe Clamping:**
   - `estimatePriorityFee` filters non-zero fees across `lockedWritableAccounts` and computes the 65th percentile.
   - Fees are clamped between `minMicroLamports` (5,000) and `maxMicroLamports` (2,000,000) to ensure reliability during both low-activity periods and extreme network congestion spikes.
   - Graceful fallback returns `minMicroLamports` if the RPC fails or returns no recent prioritization fee data.

4. **Multi-Tier Stream Ingestion Supervisor:**
   - **Tier 1 (Yellowstone gRPC Geyser):** Low-latency sub-slot push via Yellowstone gRPC filtered by program ID (`ASOL_SOLANA_PROGRAM_ID`).
   - **Tier 2 (WebSocket `onLogs`):** Resilient WebSocket log subscription with automatic exponential backoff reconnection across multi-tier RPC fallback list.
   - **Tier 3 (Polling Backfill):** Finalized signature polling via `getSignaturesForAddress` when WebSockets are degraded or disconnected.

### Prompt 2 (XML Structured)

```xml
<prompt id="asol-phase-2-priority-fees-geyser" status="completed" pr="5">
  <context>
    <repository>AlchmAgentsSolana (ASOL)</repository>
    <program_id>5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD</program_id>
    <runtime>Bun</runtime>
    <description>
      Phase 2 of the Solana Mainnet Migration: Implement dynamic compute unit limits,
      prioritization fee micro-lamport budgeting, and Yellowstone gRPC Geyser failover.
    </description>
  </context>

  <task>
    Implement dynamic priority fee estimation and Yellowstone Geyser failover ingestion.
  </task>

  <target_files>
    <file action="create">lib/solana/priority-fee.ts</file>
    <file action="modify">lib/solana/rpc-failover.ts</file>
    <file action="modify">lib/solana/solana-sync-service.ts</file>
    <file action="modify">lib/solana/asol-solana-client.ts</file>
    <file action="create">test/solana/priority-fee.spec.ts</file>
  </target_files>

  <technical_specifications>
    <compute_budget>
      1. Define profiled instruction CU limits in `lib/solana/priority-fee.ts`:
         - `CLAIM_MINT_CU_LIMIT = 135_000`
         - `REDEEM_SELF_CU_LIMIT = 80_000`
         - `REDEEM_SPONSORED_CU_LIMIT = 115_000` (accounts for Ed25519 precompile verification)
         - `RECORD_PERSONA_CU_LIMIT = 50_000`
      2. Implement `estimatePriorityFee(connection: Connection, accounts: PublicKey[], options?: { percentile?: number; minMicroLamports?: number; maxMicroLamports?: number }): Promise<bigint>`:
         - Call `connection.getRecentPrioritizationFees({ lockedWritableAccounts: accounts })`.
         - Sort non-zero fees and compute target percentile (default: 65th percentile).
         - Clamp between `minMicroLamports` (default: 5,000) and `maxMicroLamports` (default: 2,000,000).
      3. Implement `injectComputeBudgetInstructions(instructions: TransactionInstruction[], config: { units: number; microLamports: bigint }): TransactionInstruction[]`:
         - Prepend `ComputeBudgetProgram.setComputeUnitLimit({ units })` and `ComputeBudgetProgram.setComputeUnitPrice({ microLamports })`.
         - Ensure compute budget instructions are placed at indices 0 and 1.
    </compute_budget>

    <geyser_and_rpc_failover>
      1. In `lib/solana/rpc-failover.ts`:
         - Support gRPC Geyser endpoint configuration (`SOLANA_GEYSER_ENDPOINT`, `SOLANA_GEYSER_X_TOKEN`).
         - Implement `createResilientStreamSubscription()`:
           * Primary: Yellowstone gRPC stream filtered by `ASOL_SOLANA_PROGRAM_ID`.
           * Secondary fallback: WebSocket `onLogs` subscription.
           * Tertiary fallback: Polling backfill via `getSignaturesForAddress`.
      2. Record failover state in `SolanaServiceHeartbeat` model (`prisma/schema.prisma`).
    </geyser_and_rpc_failover>
  </technical_specifications>

  <testing_and_verification>
    1. In `test/solana/priority-fee.spec.ts`:
       - Verify compute budget instructions are placed strictly before business instructions.
       - Verify percentile fee calculation and bounds clamping.
    2. Run tests:
       `bunx vitest run test/solana/priority-fee.spec.ts test/solana/production-integration.spec.ts --config vitest.solana.config.ts`
  </testing_and_verification>
</prompt>
```

---

## Prompt 3 — Dual-Rail Storefront Wiring & Detached Ed25519 Solana Burn Checkout (Phase 3) [COMPLETED — PR #6]

### Context & Architectural Seams

The digital shop ([`components/shop/ShopClient.tsx`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/components/shop/ShopClient.tsx) and [`app/api/shop/purchase/route.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/app/api/shop/purchase/route.ts)) currently executes sponsored burns exclusively against the Base Sepolia ERC-1155 contract via EIP-712 challenges. This phase wires the native Solana checkout flow using `redeem_for_esms`, detached Ed25519 wallet signing, and the multi-chain wallet facade ([`lib/web3/multi-chain-wallet.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/web3/multi-chain-wallet.ts)).

### Target Files

- `[NEW]` `lib/solana/useSolanaShop.ts` — React hook coordinating the Solana detached burn challenge flow.
- `[MODIFY]` `app/api/shop/purchase/route.ts` — Support `rail: 'solana'` with Token-2022 balance checks and relayer burn.
- `[MODIFY]` `components/shop/ShopClient.tsx` — Dual-rail payment selector and wallet balance strip.
- `[MODIFY]` `lib/solana/asol-solana-client.ts` — Support detached redeem submission.
- `[NEW]` `test/solana/shop-checkout.spec.ts` — Integration test covering challenge generation, detached signing, and relayer redemption.

### Prompt 3 (XML Structured)

```xml
<prompt id="asol-phase-3-storefront-checkout">
  <context>
    <repository>AlchmAgentsSolana (ASOL)</repository>
    <program_id>5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD</program_id>
    <runtime>Bun</runtime>
    <description>
      Phase 3 of the Solana Mainnet Migration: Implement native Solana Token-2022 checkout in
      ShopClient.tsx and app/api/shop/purchase/route.ts using detached Ed25519 signatures and redeem_for_esms.
    </description>
  </context>

  <task>
    Wire native Solana checkout rail into the storefront and backend purchase API.
  </task>

  <target_files>
    <file action="create">lib/solana/useSolanaShop.ts</file>
    <file action="modify">app/api/shop/purchase/route.ts</file>
    <file action="modify">components/shop/ShopClient.tsx</file>
    <file action="create">test/solana/shop-checkout.spec.ts</file>
  </target_files>

  <technical_specifications>
    <backend_purchase_route>
      1. In `app/api/shop/purchase/route.ts`:
         - Accept optional `rail?: 'evm' | 'solana'` in POST body (defaults to 'evm' for backwards compatibility).
         - When `rail === 'solana'`:
           a. Query `VerifiedSolanaWallet` for `userId` to obtain authenticated `solanaPubKey`. If not found, return 400 (`no_solana_wallet`).
           b. Read 4 Token-2022 balances via `AsolSolanaClient.readEsmsBalances(solanaPubKey)`.
           c. Check affordability against `item.esms` scaled by $10^4$ raw atoms (`toSolanaOnchainAmounts`).
           d. If `signature` is absent:
              - Generate `orderId = shopOrderId(userId, item.id, nonce)`.
              - Set `deadline = BigInt(Math.floor(Date.now() / 1000) + 600)`.
              - Derive `clusterDomain` from `ProgramConfig.cluster_domain`.
              - Call `buildRedeemAuthorizationMessage({ programId, clusterDomain, holder: solanaPubKey, orderId, amounts, deadline })`.
              - Return JSON `{ mode: 'sign_solana', itemId, orderId, deadline: deadline.toString(), messageBase64: message.toString('base64'), challengeDomain: 'ASOL_ESMS_REDEEM_V1' }`.
           e. If `signature` is present:
              - Verify deadline has not expired.
              - Submit sponsored transaction via `AsolSolanaClient.redeemForEsms({ orderId, amounts, holder: solanaPubKey, holderSignature: bs58.decode(signature), clusterDomain, deadline })`.
              - Await confirmation, record `txHash`, and grant entitlement via `grantPurchase({ userId, item, orderId, txHash })`.
              - Return JSON `{ ok: true, itemId, orderId, txHash, rail: 'solana' }`.
    </backend_purchase_route>

    <frontend_shop_client>
      1. Create `lib/solana/useSolanaShop.ts`:
         - Coordinates challenge request, signing via `useSolanaWalletState().wallet.signMessage`, and submission to `/api/shop/purchase`.
      2. Update `components/shop/ShopClient.tsx`:
         - Add payment rail toggle: "Base (EVM)" vs "Solana Token-2022".
         - In `WalletStrip`: render Solana balances from `useSolanaWalletState().balances` alongside EVM balances.
         - Connect `ItemCard` button to `buyDigitalSolana(item)` when Solana rail is active.
         - Dispatch `ASOL_SOLANA_TRANSACTION_CONFIRMED_EVENT` on success to trigger toast with Solana Explorer link.
    </frontend_shop_client>
  </technical_specifications>

  <testing_and_verification>
    1. In `test/solana/shop-checkout.spec.ts`:
       - Verify message serialization matches Rust Anchor `instructions::esms::tests::redeem_authorization_serialization_is_unambiguous`.
       - Test signature verification against detached TweetNaCl keypair.
       - Simulate purchase flow with mocked relayer and verify entitlement granting.
    2. Run test suite:
       `bunx vitest run test/solana/shop-checkout.spec.ts test/solana/sync-and-wallet.spec.ts --config vitest.solana.config.ts`
  </testing_and_verification>
</prompt>
```

---

## Prompt 4 — Mainnet Token-2022 Metadata & Verifiable Anchor Builds (Phase 4) [COMPLETED]

> **Pull Request:** [#7](https://github.com/gregcastro23/alchm-agents-solana/pull/7)

### Context & Architectural Seams

The 4 ESMS mints carry placeholder URIs (`https://alchm.kitchen/metadata/esms/*.json`) in `programs/asol_program/src/constants.rs:24`. Mainnet requires permanent Arweave URIs uploaded via Irys before Mainnet mints are initialized.

**Consensus-Critical Invariants:**

1. `validate_existing_mint` (`instructions/esms.rs:483`) asserts `metadata.uri == ESMS_METADATA_URIS[mint_id]`, and `initialize_mints` routes every initialized mint through it.
2. The program exposes **no metadata-update instruction** (`lib.rs` has 8 instructions; none calls `token_metadata_update_field`). A URI written at init is permanent.
3. `esms_mint_fixed_account_len()` defines creation space (310 bytes), while `esms_mint_account_len()` (469–475 bytes with Arweave URIs) determines the rent-exempt funding basis.
4. **Devnet Divergence Accepted (Option a):** The 4 ESMS mints on Devnet are PDAs at `[b"esms_mint", &[id]]` (`K5kwwomtWYydxJacA7bC5yUEW9TtEuVqBKBoqAWLmhQ`, `3FcpToU7bj4sLD687uecbesEjzjxBfqYn2EcBXJKPaCf`, `7naJZozLrknDF3dguAdEWn7Z4MviUkXitjhaAt57Vkb4`, `6RY6ZG1eJQ2uEvpyA6XK74WyF1MpTYbw97hdhELqDUsa`). Without a `CloseAuthority` extension, these cannot be closed or re-initialized with new URIs. Once `constants.rs` points to permanent Arweave URIs, `initialize_esms_mints` will permanently fail `validate_existing_mint` on Devnet. Devnet divergence is documented as retired-in-place. `claim_mint_esms` and `redeem_esms` remain fully functional because they do not call `validate_existing_mint`.

### Implemented Deliverables

- `[NEW]` [`metadata/solana/manifest.schema.json`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/metadata/solana/manifest.schema.json) — Token-2022 JSON Schema Draft-07 validator supporting honest `null` images pre-upload and strict Arweave regex format.
- `[NEW]` [`metadata/solana/tokens/{spirit,essence,matter,substance}.json`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/metadata/solana/tokens/) — Off-chain manifests matching on-chain Token-2022 name/symbol byte parity.
- `[NEW]` [`metadata/solana/icons/{spirit,essence,matter,substance}.svg`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/metadata/solana/icons/) — Self-contained Techno-Occult SVG icons enforcing zero `<script>`, zero `<foreignObject>`, and zero external links.
- `[NEW]` [`metadata/solana/arweave-manifest.json`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/metadata/solana/arweave-manifest.json) — Committed upload receipt tracking SHA-256 digests, txIds, and remote URIs.
- `[NEW]` [`lib/solana/irys-signer-adapter.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/irys-signer-adapter.ts) — Signer adapter bridging `KmsSolanaSigner` Ed25519 signatures to Irys's raw message bundle contract.
- `[NEW]` [`scripts/metadata/upload-arweave-metadata.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/scripts/metadata/upload-arweave-metadata.ts) — Two-pass Arweave uploader (SVGs first, manifests second) with Prettier-first normalization, dry-run mode, and fail-closed Cloud KMS enforcement.
- `[NEW]` [`test/solana/metadata-uris.spec.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/test/solana/metadata-uris.spec.ts) — Non-tautological rent calculation pin (`310b` fixed space, `453b`..`462b` current / `469b`..`475b` Arweave), AJV schema validation, and SVG security tests.
- `[NEW]` [`test/solana/upload-arweave-metadata.spec.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/test/solana/upload-arweave-metadata.spec.ts) — Comprehensive unit tests with mocked Irys uploader verifying two-pass ordering, readback mismatch detection, and `os.tmpdir()` isolation.
- `[NEW]` [`docs/deployment/VERIFIABLE_BUILD_RUNBOOK.md`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/docs/deployment/VERIFIABLE_BUILD_RUNBOOK.md) — Reproducible Docker Anchor build runbook (`backpackapp/build:v0.30.1`), `solana-verify` commands, and Devnet retirement policy.
- `[MODIFY]` [`Anchor.toml`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/Anchor.toml) — Added `[programs.mainnet]` entry mapping `asol_program`.
- `[MODIFY]` [`lib/solana/vectors.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/vectors.ts) — Exported `ESMS_NAMES`, `ESMS_SYMBOLS`, `ESMS_METADATA_URIS`.
- `[MODIFY]` [`.github/workflows/ci.yml`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/.github/workflows/ci.yml) — Added dedicated `solana-program` Rust `cargo test` job and `test:solana:unit` runner.

### Architectural Insights & Lessons Learned

1. **Consensus-Critical Immutability & Two-Pass Upload Order:**
   - In Anchor Token-2022 programs without `token_metadata_update_field`, URIs written during `initialize_esms_mints` are permanently immutable.
   - The upload process strictly follows a two-pass order: Pass 1 uploads the 4 elemental SVGs to obtain permanent Arweave transaction IDs; Pass 2 patches those URLs into `image` fields, canonicalizes formatting via Prettier, and uploads the 4 JSON manifests to obtain the final metadata URIs.

2. **Cloud KMS Bridging for Arweave Data Bundles:**
   - Arweave/Irys data bundles require detached 64-byte Ed25519 signatures (signature type 2).
   - `KmsIrysSignerAdapter` directly wraps `KmsSolanaSigner.signMessage()` to ensure live mainnet uploads utilize HSM-backed keys without exposing secrets in memory.
   - A fail-closed check enforces `signer.provider !== 'local'` on live mainnet executions.

3. **Non-Tautological Token-2022 Account Rent Derivation:**
   - Creation space is strictly 310 bytes (`esms_mint_fixed_account_len()`).
   - Value length (`80 + name + symbol + uri`) dynamically accounts for URI lengths (e.g. 63 bytes for `https://arweave.net/<43-char-txid>`), resulting in total account sizes of 469B (Spirit/Matter), 471B (Essence), and 475B (Substance).
   - Tests dynamically derive rent assertions from `ESMS_METADATA_URIS` rather than hardcoding static assumptions.

4. **Verifiable Docker Anchor Builds & Devnet Divergence:**
   - Anchor binaries are compiled inside `backpackapp/build:v0.30.1` (`Solana 1.18.17`, `Rust 1.79.0`) to guarantee deterministic SHA-256 hash matching for `solana-verify` and OtterSec verified builds.
   - Devnet divergence (Option a) retires existing Devnet placeholder mints in-place rather than breaking initialization idempotency assumptions.

### Prompt 4 (XML Structured)

```xml
<prompt id="asol-phase-4-metadata-verifiable-build" status="completed" pr="7">
  <context>
    <repository>AlchmAgentsSolana (ASOL)</repository>
    <repository_url>https://github.com/gregcastro23/alchm-agents-solana</repository_url>
    <program_id>5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD</program_id>
    <runtime>Bun 1.3.13 | Anchor 0.30.1 | Solana 1.18.17 | Rust 1.79.0</runtime>
    <description>
      Phase 4 of the Solana Mainnet Migration: Create permanent Token-2022 Arweave metadata
      manifests in tokens/, upload tooling via Irys with KMS adapter, cross-language URI pinning test suite,
      and reproducible verifiable Anchor build runbook.
    </description>
  </context>

  <task>
    Produce permanent Arweave metadata assets and a reproducible, independently verifiable Mainnet build.
  </task>

  <invariants>
    <invariant id="uri-immutability">
      On-chain TokenMetadata is written once at init and has no update path in this program.
      The Arweave upload MUST complete and be committed before Mainnet mints are initialized.
    </invariant>
    <invariant id="empty-additional-metadata">
      `esms.rs:484` requires `metadata.additional_metadata.is_empty()`. Element traits, soulbound
      flags and burn-authority notes belong ONLY in the off-chain JSON. Never write them on-chain.
    </invariant>
    <invariant id="decimals-source-of-truth">
      `ESMS_DECIMALS = 4` lives on the mint account. A `decimals` field in the JSON is a wallet-display
      hint that must mirror the mint, never define it.
    </invariant>
    <invariant id="account-space">
      Longer Arweave URIs increase `esms_metadata_value_len`. Recompute and report the new per-mint
      rent-exempt lamports; do not assume Devnet's figure carries to Mainnet.
    </invariant>
  </invariants>
</prompt>
```

---

## Prompt 5 — StarVault Staking & Checkpointed Yield Accrual Engine (Phase 5) [COMPLETED — PR #9]

### Context & Architectural Seams

On Circle Arc EVM, `StarVault.sol` allowed users to stake 6-decimal USDC into celestial star pools identified by Hipparcos star IDs and claim ESMS yield. However, Arc EVM's contract contained a critical vulnerability: `lastClaimAt` was only initialized when shares were zero, allowing a user to top-up principal and retroactively earn yield over past elapsed time on new capital. The Solana implementation ports StarVault with a **checkpointed yield accumulator** that permanently eliminates this flaw while replicating OpenZeppelin `StandardMerkleTree` uint32 leaf verification.

Phase 5 was audited in [`docs/PHASE_5_STARVAULT_REVIEW.md`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/docs/PHASE_5_STARVAULT_REVIEW.md) and hardened under **PR 1: Custody Safety** with infallible saturating yield math, rate ceiling enforcement, monotonic clock protection, net-delta balance measurement, and Token-2022 extension validation.

### Implemented Deliverables

- `[NEW]` [`programs/asol_program/src/state/staking.rs`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/programs/asol_program/src/state/staking.rs) — `StarVaultState`, `StarPool`, and `StakePosition` accounts with infallible `calculate_accrued_yield_cap` and monotonic `checkpoint_yield`.
- `[NEW]` [`programs/asol_program/src/instructions/staking/mod.rs`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/programs/asol_program/src/instructions/staking/mod.rs) — `initialize_star_vault`, `set_star_vault_config`, `activate_star`, `stake_star`, `unstake_star`, and `claim_star_yield` with Ed25519 attestations, net balance delta validation, and Token-2022 TLV extension checks.
- `[MODIFY]` [`programs/asol_program/src/lib.rs`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/programs/asol_program/src/lib.rs) — Exposed Anchor staking entrypoints.
- `[NEW]` [`lib/solana/star-vault.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/star-vault.ts) — TypeScript SDK client for StarVault staking, PDA derivations, leaf hashes, and Ed25519 authorization message builders.
- `[NEW]` [`test/solana/star-vault.spec.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/test/solana/star-vault.spec.ts) — Test suite proving 0 retroactive accrual on top-ups, OpenZeppelin leaf compatibility, monotonic clock protection, and non-pausable withdrawals.
- `[NEW]` [`docs/PHASE_5_STARVAULT_REVIEW.md`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/docs/PHASE_5_STARVAULT_REVIEW.md) — Comprehensive architectural review and 3-PR remediation campaign (PR 1 Custody Safety, PR 2 Accounting Model, PR 3 Provability).

### Prompt 5 (XML Structured)

```xml
<prompt id="asol-phase-5-starvault-staking">
  <context>
    <repository>AlchmAgentsSolana (ASOL)</repository>
    <program_id>5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD</program_id>
    <runtime>Bun</runtime>
    <description>
      Phase 5 of the Solana Migration: Port StarVault staking from Arc EVM to Solana with
      checkpointed yield accrual and OpenZeppelin Merkle tree leaf verification.
    </description>
  </context>

  <task>
    Implement StarVault staking accounts and instructions with checkpointed yield accrual.
  </task>

  <target_files>
    <file action="create">programs/asol_program/src/state/staking.rs</file>
    <file action="create">programs/asol_program/src/instructions/staking/mod.rs</file>
    <file action="modify">programs/asol_program/src/lib.rs</file>
    <file action="create">lib/solana/star-vault.ts</file>
    <file action="create">test/solana/star-vault.spec.ts</file>
  </target_files>

  <technical_specifications>
    <state_and_math>
      1. Define accounts in `programs/asol_program/src/state/staking.rs`:
         - `StarVaultState` (`seeds = [b"star-vault"]`): `version`, `admin`, `usdc_mint`, `vault_usdc_ata`, `total_principal`, `star_root`, `max_yield_rate_per_usdc_day`, `bump`.
         - `StarPool` (`seeds = [b"star-pool", star_id.to_le_bytes()]`): `version`, `star_id: u32`, `activated: bool`, `total_principal: u64`, `total_shares: u64`, `bump: u8`.
         - `StakePosition` (`seeds = [b"stake", star_id.to_le_bytes(), staker.key()]`):
           `version`, `staker: Pubkey`, `star_id: u32`, `shares: u64`, `principal: u64`, `accrued_cap: u64`, `last_checkpoint: i64`, `claim_nonce: u64`, `bump: u8`.
      2. Yield Math Formula (Infallible Saturating Math):
         $$\Delta\text{Cap} = \frac{\text{principal} \times \text{max\_yield\_rate\_per\_usdc\_day} \times (\text{now} - \text{last\_checkpoint})}{10^6 \times 86400}$$
         Before any stake or unstake changes principal:
         $$\text{accrued\_cap} = \text{accrued\_cap}.\text{saturating\_add}(\Delta\text{Cap})$$
         $$\text{last\_checkpoint} = \text{now}.\text{max}(\text{last\_checkpoint})$$
    </state_and_math>

    <instructions>
      1. `activate_star`: Verify OpenZeppelin `StandardMerkleTree` proof for `uint32 starId` against `StarVaultState.star_root` (bounded to depth <= 32).
      2. `stake_star`: Checkpoint yield, transfer SPL USDC from staker to vault PDA, measure net balance increase delta, update shares and principal.
      3. `unstake_star`: Checkpoint yield, burn shares, transfer USDC from vault PDA back to staker (always enabled, non-pausable).
      4. `claim_star_yield`: Validate Ed25519 attestor signature over `(staker, star_id, element_id, amount, nonce, deadline)`.
         Assert `amount <= accrued_cap + current_interval_cap`. Mint Token-2022 ESMS atoms to staker, increment nonce, rollover remainder (`accrued_cap = total_claimable - amount`).
    </instructions>
  </technical_specifications>

  <testing_and_verification>
    1. In `test/solana/star-vault.spec.ts`:
       - Verify OpenZeppelin leaf vector matching `openZeppelinStarLeaf(677)`.
       - Test: User stakes 10 USDC for 10 days, tops up 1000 USDC on day 10, and claims on day 10 + 1 second.
       - Prove that the claim cap strictly reflects 10 USDC over the 10 days, not 1010 USDC over 10 days (500,000,000 atom over-mint prevented).
       - Test: Backwards clock timestamps never rewind checkpoint or credit illegitimate yield.
       - Test: Unstake functions normally even when `pause_claims == true`.
    2. Run test suite: `bun test:solana` and `RUSTUP_TOOLCHAIN=1.79.0 cargo test -p asol_program --lib`.
  </testing_and_verification>
</prompt>
```

---

## Phase 6 — Constellation Virtual-Reserve AMM & LP Deed Positions (as built)

Executable spec and the findings behind it: [`PHASE_6_AMM_PLAN.md`](./PHASE_6_AMM_PLAN.md),
[`PHASE_6_AMM_PLAN_REVIEW.md`](./PHASE_6_AMM_PLAN_REVIEW.md).

### Context & Architectural Seams

On Circle Arc EVM, `ConstellationAMM.sol` and `ConstellationDeed.sol` provide
constant-product swapping between soulbound ESMS tokens. Arc's `seedInitial` can be
called repeatedly without burning tokens, which lets an admin mint unbacked
withdrawable Deeds. The Solana port closes that hole with **one-time bootstrapping
whose shares are permanently locked**, and diverges from Arc on the position itself.

### The one divergence a reader has to know

**Solana LP positions are not transferable.** `ConstellationDeed` is a transferable
ERC-721 by explicit design -- the tradable trophy. On Solana the position is an
**owner-seeded `DeedPosition` PDA**, `seeds = [b"deed", pool_id, owner]`, which no
instruction can move to another wallet.

The rent and compute savings are the implementation detail (~0.0012 SOL in one
account instead of ~0.0047 across a mint, an ATA and a position; `add_liquidity`
measured at 61k CU rather than the ~260k a Token-2022 NFT mint would need). The
fact a reader needs is the divergence: an integration that expected to list, price,
or trade an LP position cannot do so here. Re-adding transferability later is
additive -- a `transfer_position` instruction requiring both signatures -- but
positions written before that stay non-portable.

Two smaller divergences follow from the same model:

- There is **one position per `(owner, pool)`**. A repeat add accumulates into it
  rather than minting a second Deed; a full exit closes it and refunds its rent.
- Aggregate ESMS is **not conserved per swap**, because virtual reserves were never
  funded by a burn. Reserves `(100 in, 10_000 out)` burn 10 to mint 909. It is
  conserved across closed round trips, where fees make it net-deflationary. The
  permanently unbacked component is capped by `MAX_BOOTSTRAP_RESERVE` (100,000 ESMS
  per element).

### What shipped

| Path                                                          | Role                                                                                                    |
| :------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------ |
| `programs/asol_program/src/state/amm.rs`                      | `ConstellationPool`, `PoolTraderNonce`, checked `u128` math, six events                                 |
| `programs/asol_program/src/state/deed.rs`                     | `DeedPosition`                                                                                          |
| `programs/asol_program/src/instructions/amm/mod.rs`           | `register_pool`, `bootstrap_pool`, `set_pool_pause`, `add_liquidity`, `swap_esms`, `withdraw_liquidity` |
| `programs/asol_program/src/instructions/amm/runtime_tests.rs` | litesvm suite against the compiled `.so` and the real Token-2022 binary                                 |
| `programs/asol_program/src/instructions/ed25519.rs`           | Shared precompile verifier; `esms.rs` and `staking/` now delegate to it                                 |
| `lib/solana/constellation-amm.ts`                             | PDAs, math mirror, instruction and transaction builders, account decoders                               |
| `lib/solana/amm-attestor.ts`                                  | Server-side Ed25519 attestation signer                                                                  |
| `app/api/solana/amm-attestation/route.ts`                     | Sky-gated feeder: aspect + horizon gates, on-chain nonce, signed preimage                               |
| `test/solana/constellation-amm.spec.ts`                       | Preimage vector, IDL-conformance, math mirror, PDA derivations                                          |
| `tsconfig.solana.json`                                        | Type checks a surface the root `tsconfig.json` excludes (Phase 5 **S8**)                                |

### Load-bearing decisions

1. **Pause is per-pool, not global.** `ProgramConfig` is live on devnet at exactly
   `8 + INIT_SPACE = 140` bytes with no slack. Adding a field to it EOFs borsh on
   the existing account and bricks `claim_mint_esms`, `redeem_esms` and
   `claim_star_yield`. `ConstellationPool.paused` carries the flag instead.
2. **Withdrawal is never gated.** No attestation, no pause check: liquidity can
   always leave. `share_bps` (`1..=10_000`) is a fraction of the caller's own
   position.
3. **`fee_bps <= MAX_FEE_BPS = 1_000`.** Arc validated only `<= 10_000`, at which
   `in_with_fee` is zero and every swap reverts with no update path.
4. **One attestor, two domains.** `ASOL_AMM_VISIBILITY_V1` is verified against
   `ProgramConfig.attestor` -- necessarily the same key that signs
   `ASOL_STAR_YIELD_V1`, since the account has one attestor field. Domain
   separation keeps the messages unforgeable across surfaces. **The Arc attestor
   key cannot be reused:** it is secp256k1 signing EIP-712, and this path needs the
   Ed25519 keypair `config.attestor` names (`SOLANA_ATTESTOR_KEYPAIR`).
5. **Mints are derived from pool state, never from a caller argument.**
   `seeds = [ESMS_MINT_SEED, &[pool.element_a]]`. `in_element` only _selects_
   between two already-verified mints.

### The bug the runtime suite caught

`AddLiquidity::try_accounts` and `WithdrawLiquidity::try_accounts` overflowed the
4 KiB SBF stack frame by 64 and 200 bytes. The linker reported it and **`anchor
build` exited 0 and wrote a `.so` anyway**; the program then faulted with `Access
violation in unknown section at address 0x0` on every call to either instruction.
No unit test, type check, or IDL build notices this. The accounts are now boxed, and
`bun run solana:build` goes through `scripts/build-solana-program.mjs`, which fails
the build when the linker reports a stack overflow.

### Verification

```bash
bun run solana:build        # BPF build + IDL, fails loudly on stack overflow
bun run solana:idl:sync     # refresh lib/solana/idl from target/
bun run test:solana         # typecheck:solana + TS unit suite + cargo (incl. litesvm)
bun run test:solana:runtime # build, then the litesvm suite alone with CU output
```

Never call `anchor build` directly: it exits 0 when the SBF linker reports a
stack-frame overflow and writes a `.so` that faults on every call to the affected
instruction. `solana:build` wraps it and fails on that. The full workflow and its
traps are recorded in `CLAUDE.md` under **Solana Program & Client**.

Still outstanding before Phase 7: one devnet end-to-end pass
(`register -> bootstrap -> add -> swap -> partial withdraw -> full withdraw`)
driven through the SDK builders against the live Token-2022 program.

---

## Prompt 7 — Mainnet Deployment, Rehearsal & Verification Runbook (Phase 7)

### Context & Architectural Seams

The final phase executes the Mainnet deployment of `asol_program`, initializes the `ProgramConfig` and the 4 `EsmsMint` accounts on Solana Mainnet-Beta, performs deterministic bytecode verification via `solana-verify`, and switches production environment configurations.

### Target Files

- `[NEW]` `scripts/deploy/deploy-mainnet.sh` — Verifiable build and deployment runner.
- `[NEW]` `scripts/deploy/init-mainnet.ts` — Idempotent Mainnet PDA initialization script.
- `[NEW]` `deployments/solana-mainnet.json` — Deployment artifact registry.
- `[MODIFY]` `.env.production.sample` — Production environment template.

### Prompt 7 (XML Structured)

```xml
<prompt id="asol-phase-7-mainnet-deployment">
  <context>
    <repository>AlchmAgentsSolana (ASOL)</repository>
    <program_id>5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD</program_id>
    <runtime>Bun</runtime>
    <description>
      Phase 7 of the Solana Migration: Execute the live production deployment of asol_program
      to Solana Mainnet-Beta, run idempotent initialization, and verify on-chain bytecode.
    </description>
  </context>

  <task>
    Implement Mainnet deployment automation, idempotent initialization, and bytecode verification.
  </task>

  <target_files>
    <file action="create">scripts/deploy/deploy-mainnet.sh</file>
    <file action="create">scripts/deploy/init-mainnet.ts</file>
    <file action="create">deployments/solana-mainnet.json</file>
    <file action="modify">.env.production.sample</file>
  </target_files>

  <technical_specifications>
    <deployment_script>
      1. Create `scripts/deploy/deploy-mainnet.sh`:
         - Checks prerequisites: `bun`, `solana-cli` (1.18.17), `anchor` (0.30.1), `solana-verify`.
         - Verifies cluster endpoint genesis hash matches Mainnet-Beta (`5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`).
         - Executes `anchor build --verifiable`.
         - Deploys program binary to `5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD`.
         - Executes `bun run scripts/deploy/init-mainnet.ts`.
         - Runs `solana-verify verify-from-repo` and outputs verification hash.
    </deployment_script>

    <initialization_script>
      1. Create `scripts/deploy/init-mainnet.ts`:
         - Loads deployer keypair from explicit secure path or Cloud KMS.
         - Asserts cluster genesis hash is Mainnet-Beta.
         - Derives `ProgramConfig` PDA (`seeds = [b"program_authority"]`).
         - If `ProgramConfig` is uninitialized, calls `initialize_config` with:
           * `attestor`: Squads multisig vault or configured attestor public key.
           * `pauser`: Squads multisig vault.
           * `cluster_domain`: `sha256("ASOL_MAINNET_V1")`.
         - If `EsmsMint` accounts are uninitialized, calls `initialize_esms_mints`.
         - Asserts all 4 Token-2022 mint accounts exist and match expected extension layout (`NonTransferable`, `PermissionedBurn`, `PermanentDelegate`, `MetadataPointer`).
         - Writes verified public addresses to `deployments/solana-mainnet.json`.
    </initialization_script>
  </technical_specifications>

  <testing_and_verification>
    1. Perform full dry-run simulation against Localnet / Devnet:
       `ANCHOR_PROVIDER_URL=https://api.devnet.solana.com bun run scripts/deploy/init-mainnet.ts --dry-run`
    2. Confirm all unit and integration tests pass:
       `bun test:solana && bunx vitest run test/solana/golden-vectors.spec.ts test/solana/solana-minter.spec.ts test/solana/kms-signer.spec.ts test/solana/sync-and-wallet.spec.ts test/solana/production-integration.spec.ts --config vitest.solana.config.ts`
  </testing_and_verification>
</prompt>
```

---

## 5. Verification & Test Run Matrix

To guarantee continuous quality across all prompts, maintain the following testing matrix:

```bash
# Vector and Rust Anchor tests
bun run test:solana

# Full TypeScript Vitest suite
bunx vitest run test/solana/golden-vectors.spec.ts \
                test/solana/priority-fee.spec.ts \
                test/solana/solana-minter.spec.ts \
                test/solana/kms-signer.spec.ts \
                test/solana/sync-and-wallet.spec.ts \
                test/solana/production-integration.spec.ts \
                --config vitest.solana.config.ts
```

| Verification Check     | Target Standard                 | Expected Outcome                                                                       |
| :--------------------- | :------------------------------ | :------------------------------------------------------------------------------------- |
| **Rust Unit Tests**    | 6 Anchor Program Tests          | All 6 tests pass in $< 0.1\text{s}$                                                    |
| **Vitest Suite**       | 51+ Integration Tests           | All tests pass in $< 1.5\text{s}$                                                      |
| **Integer Scaling**    | Lossless $10^4$ Conversion      | Zero rounding dust, no JS `number` precision leaks                                     |
| **KMS HSM Signing**    | Ed25519 Message Authentication  | Private keys never touch memory in production; 64-byte Ed25519 signatures verified     |
| **CU & Priority Fees** | Dynamic Profiling & 65th Pct    | CU limits at index 0, priority fee at index 1, bounds clamped [5k, 2M] micro-lamports  |
| **Geyser Failover**    | 3-Tier Resilient Ingestion      | Sub-slot push via Yellowstone gRPC with automatic WebSocket & polling failover         |
| **Extensions**         | Token-2022 Protocol Constraints | `NonTransferable`, `PermissionedBurn`, `PermanentDelegate`, `MetadataPointer` enforced |
| **Replay Guards**      | Permanent PDAs                  | `ClaimReceipt` and `OrderReceipt` accounts prevent double-settlement                   |
