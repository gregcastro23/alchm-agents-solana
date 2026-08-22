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
├──────────────────────────────┼──────────────────────────────┼──────────────────────────┤
│ Phase 4: Metadata & Build    │ Phase 5: StarVault Staking   │ Phase 6: Constellation   │
│ Prompt 4: Arweave & Verify   │ Prompt 5: Checkpointed Yield │ Prompt 6: AMM & Deeds    │
├──────────────────────────────┴──────────────────────────────┴──────────────────────────┤
│ Phase 7: Mainnet Deployment, Live Rehearsal & Verification Runbook (Prompt 7)          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Prompt 1 — Governance & Cloud KMS Key Management (Phase 1)

### Context & Architectural Seams

Currently, the backend minter ([`lib/solana/solana-minter.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/solana-minter.ts)) and bridge service ([`lib/solana/bridge-service.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/bridge-service.ts)) read raw private key bytes from `SOLANA_AGENT_PAYER_KEY` or disk (`~/.config/solana/id.json`). For Mainnet production, private keys must never touch application memory or persistent disk. Instead, automated workers use **Cloud KMS HSM** (AWS KMS / GCP Cloud KMS) via asymmetric Ed25519 signing APIs, while program ownership is transferred to a **Squads v4 Multisig** vault.

### Target Files

- `[NEW]` `lib/solana/kms-signer.ts` — Cloud KMS Ed25519 signer implementing `AsolSolanaWallet`.
- `[MODIFY]` `lib/solana/solana-minter.ts` — Use KMS signer with devnet fallback.
- `[MODIFY]` `lib/solana/bridge-service.ts` — Use KMS signer for relay transactions.
- `[NEW]` `scripts/governance/squads-multisig-runbook.ts` — Squads v4 proposal generator for authority handover.
- `[NEW]` `test/solana/kms-signer.spec.ts` — Unit & integration tests with mocked KMS client.

### Prompt 1 (XML Structured)

```xml
<prompt id="asol-phase-1-kms-governance">
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

## Prompt 2 — Network Resiliency, Dynamic Priority Fees & Geyser Failover (Phase 2)

### Context & Architectural Seams

During high Mainnet traffic, fixed-fee Solana transactions risk starvation or block expiration. Furthermore, reliance on a single public or private RPC creates single-point-of-failure vulnerabilities. This phase introduces dynamic compute unit budgeting, real-time priority fee estimation, and Yellowstone gRPC Geyser stream failover into [`lib/solana/rpc-failover.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/rpc-failover.ts) and [`lib/solana/solana-sync-service.ts`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/lib/solana/solana-sync-service.ts).

### Target Files

- `[NEW]` `lib/solana/priority-fee.ts` — Dynamic CU profiling and prioritization fee estimator.
- `[MODIFY]` `lib/solana/rpc-failover.ts` — Enhanced multi-tier RPC fallback and Yellowstone gRPC streaming.
- `[MODIFY]` `lib/solana/solana-sync-service.ts` — Real-time event ingestion with Geyser failover.
- `[MODIFY]` `lib/solana/asol-solana-client.ts` — Auto-inject compute budget into `sendInstructions`.
- `[NEW]` `test/solana/priority-fee.spec.ts` — Validation of instruction ordering and fee calculations.

### Prompt 2 (XML Structured)

```xml
<prompt id="asol-phase-2-priority-fees-geyser">
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

## Prompt 3 — Dual-Rail Storefront Wiring & Detached Ed25519 Solana Burn Checkout (Phase 3)

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

## Prompt 4 — Mainnet Token-2022 Metadata & Verifiable Anchor Builds (Phase 4)

### Context & Architectural Seams

The 4 ESMS mints on Devnet currently point to placeholder URIs (`https://alchm.kitchen/metadata/esms/*.json`). For Mainnet, metadata schemas and elemental iconography must be permanently registered on **Arweave** (via Irys/Bundlr) and embedded in the Token-2022 mint accounts. Furthermore, the Anchor program bytecode must be reproducibly built and verified using `solana-verify`.

### Target Files

- `[NEW]` `metadata/solana/spirit.json` — Token-2022 Metadata manifest for Spirit (Fire).
- `[NEW]` `metadata/solana/essence.json` — Token-2022 Metadata manifest for Essence (Water).
- `[NEW]` `metadata/solana/matter.json` — Token-2022 Metadata manifest for Matter (Earth).
- `[NEW]` `metadata/solana/substance.json` — Token-2022 Metadata manifest for Substance (Air).
- `[NEW]` `scripts/metadata/upload-arweave-metadata.ts` — Arweave upload automation via Irys.
- `[NEW]` `docs/deployment/VERIFIABLE_BUILD_RUNBOOK.md` — Reproducible Docker build guide.
- `[MODIFY]` `Anchor.toml` — Mainnet configuration and verifiable settings.

### Prompt 4 (XML Structured)

```xml
<prompt id="asol-phase-4-metadata-verifiable-build">
  <context>
    <repository>AlchmAgentsSolana (ASOL)</repository>
    <program_id>5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD</program_id>
    <runtime>Bun</runtime>
    <description>
      Phase 4 of the Solana Mainnet Migration: Create permanent Token-2022 Arweave metadata
      manifests, upload tooling via Irys, and configure verifiable Anchor builds with solana-verify.
    </description>
  </context>

  <task>
    Create permanent Arweave metadata assets and configure verifiable Anchor builds for Mainnet.
  </task>

  <target_files>
    <file action="create">metadata/solana/spirit.json</file>
    <file action="create">metadata/solana/essence.json</file>
    <file action="create">metadata/solana/matter.json</file>
    <file action="create">metadata/solana/substance.json</file>
    <file action="create">scripts/metadata/upload-arweave-metadata.ts</file>
    <file action="create">docs/deployment/VERIFIABLE_BUILD_RUNBOOK.md</file>
    <file action="modify">Anchor.toml</file>
  </target_files>

  <technical_specifications>
    <metadata_schemas>
      1. Create JSON manifests in `metadata/solana/` for all 4 elements adhering to Token-2022 standards:
         - `name`: "Spirit (ESMS)", "Essence (ESMS)", "Matter (ESMS)", "Substance (ESMS)"
         - `symbol`: "SPIRIT", "ESSENCE", "MATTER", "SUBSTANCE"
         - `description`: Detailed description of the element, alchemical axis, psychological and JEPA persona properties.
         - `decimals`: 4
         - `attributes`: `[{ "trait_type": "Element", "value": "..." }, { "trait_type": "Decimals", "value": 4 }, { "trait_type": "Soulbound", "value": "Non-Transferable" }, { "trait_type": "BurnAuthority", "value": "Permissioned" }]`
      2. Implement `scripts/metadata/upload-arweave-metadata.ts`:
         - Uses `@irys/sdk` to upload SVG icons and JSON manifests to Arweave.
         - Returns permanent `https://arweave.net/<HASH>` URLs.
         - Generates updated constants for `programs/asol_program/src/constants.rs`.
    </metadata_schemas>

    <verifiable_build>
      1. Update `Anchor.toml`:
         - Set `[programs.mainnet] asol_program = "5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD"`.
         - Pin solana version `1.18.17` and anchor version `0.30.1`.
      2. Create `docs/deployment/VERIFIABLE_BUILD_RUNBOOK.md`:
         - Step-by-step instructions for `anchor build --verifiable`.
         - Step-by-step instructions for `solana-verify verify-from-repo --program-id 5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD https://github.com/gregcastro23/AlchmAgentsSolana --mount-path programs/asol_program`.
    </verifiable_build>
  </technical_specifications>

  <testing_and_verification>
    1. Verify JSON syntax and schemas with `bunx prettier --check metadata/solana/*.json`.
    2. Run golden vector tests to ensure URI constants match: `bun run test:solana`.
  </testing_and_verification>
</prompt>
```

---

## Prompt 5 — StarVault Staking & Checkpointed Yield Accrual Engine (Parity Port)

### Context & Architectural Seams

On Circle Arc EVM, `StarVault.sol` allows users to stake 6-decimal USDC into celestial star pools identified by Hipparcos star IDs and claim ESMS yield. However, Arc EVM's contract contains a critical vulnerability: `lastClaimAt` is only initialized when shares are zero, allowing a user to top-up principal and retroactively earn yield over past elapsed time on new capital. The Solana implementation ports StarVault with a **checkpointed yield accumulator** that permanently eliminates this flaw while replicating OpenZeppelin `StandardMerkleTree` uint32 leaf verification.

### Target Files

- `[NEW]` `programs/asol_program/src/state/staking.rs` — `StarVaultState`, `StarPool`, `StakePosition` accounts.
- `[NEW]` `programs/asol_program/src/instructions/staking/mod.rs` — `activate_star`, `stake_star`, `unstake_star`, `claim_star_yield`.
- `[MODIFY]` `programs/asol_program/src/lib.rs` — Expose staking instructions.
- `[NEW]` `lib/solana/star-vault.ts` — TypeScript SDK client for StarVault staking.
- `[NEW]` `test/solana/star-vault.spec.ts` — Anchor & TypeScript test suite proving zero retroactive accrual.

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
         - `StarVaultState` (`seeds = [b"star-vault"]`): `usdc_mint`, `vault_usdc_ata`, `total_principal`, `star_root`, `bump`.
         - `StarPool` (`seeds = [b"star-pool", star_id.to_le_bytes()]`): `star_id: u32`, `activated: bool`, `total_principal: u64`, `total_shares: u64`, `bump: u8`.
         - `StakePosition` (`seeds = [b"stake", star_id.to_le_bytes(), staker.key()]`):
           `staker: Pubkey`, `star_id: u32`, `shares: u64`, `principal: u64`, `accrued_cap: u64`, `last_checkpoint: i64`, `claim_nonce: u64`, `bump: u8`.
      2. Yield Math Formula with `u128` intermediates:
         $$\Delta\text{Cap} = \frac{\text{old\_principal} \times \text{max\_rate\_esms\_atoms\_per\_usdc\_day} \times (\text{now} - \text{last\_checkpoint})}{10^6 \times 86400}$$
         Before any stake or unstake changes principal:
         $$\text{accrued\_cap} \mathrel{+}= \Delta\text{Cap}$$
         $$\text{last\_checkpoint} = \text{now}$$
    </state_and_math>

    <instructions>
      1. `activate_star`: Verify OpenZeppelin `StandardMerkleTree` proof for `uint32 starId` against `StarVaultState.star_root`.
      2. `stake_star`: Checkpoint yield, transfer SPL USDC from staker to vault PDA, update shares and principal.
      3. `unstake_star`: Checkpoint yield, burn shares, transfer USDC from vault PDA back to staker (always enabled, non-pausable).
      4. `claim_star_yield`: Validate Ed25519 attestor signature over `(staker, star_id, element_id, amount, nonce, deadline)`.
         Assert `amount <= accrued_cap + current_interval_cap`. Mint Token-2022 ESMS atoms to staker, consume nonce, reset `accrued_cap = 0`.
    </instructions>
  </technical_specifications>

  <testing_and_verification>
    1. In `test/solana/star-vault.spec.ts`:
       - Verify OpenZeppelin leaf vector matching `openZeppelinStarLeaf(677)`.
       - Test: User stakes 10 USDC for 10 days, tops up 1000 USDC on day 10, and claims on day 10 + 1 second.
       - Prove that the claim cap strictly reflects 10 USDC over the 10 days, not 1010 USDC over 10 days.
       - Test: Unstake functions normally even when `pause_claims == true`.
    2. Run test suite: `bun test:solana`.
  </testing_and_verification>
</prompt>
```

---

## Prompt 6 — Constellation Virtual-Reserve AMM & LP Deed NFTs (Parity Port)

### Context & Architectural Seams

On Circle Arc EVM, `ConstellationAMM.sol` and `ConstellationDeed.sol` provide constant-product swapping between soulbound ESMS tokens. However, Arc EVM's `seedInitial` instruction can be called repeatedly without burning tokens, allowing an admin to mint unbacked withdrawable Deeds. The Solana implementation fixes this by enforcing **one-time bootstrapping with permanently locked unbacked shares** and issuing **Token-2022 Deed NFTs** (`supply = 1`, `decimals = 0`).

### Target Files

- `[NEW]` `programs/asol_program/src/state/amm.rs` — `ConstellationPool`, `PoolTraderNonce`.
- `[NEW]` `programs/asol_program/src/state/deed.rs` — `DeedPosition` state.
- `[NEW]` `programs/asol_program/src/instructions/amm/mod.rs` — `register_pool`, `bootstrap_pool`, `add_liquidity`, `swap_esms`, `withdraw_liquidity`.
- `[MODIFY]` `programs/asol_program/src/lib.rs` — Expose AMM instructions.
- `[NEW]` `lib/solana/constellation-amm.ts` — TypeScript SDK client for Constellation AMM.
- `[NEW]` `test/solana/constellation-amm.spec.ts` — Comprehensive AMM test suite.

### Prompt 6 (XML Structured)

```xml
<prompt id="asol-phase-6-constellation-amm">
  <context>
    <repository>AlchmAgentsSolana (ASOL)</repository>
    <program_id>5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD</program_id>
    <runtime>Bun</runtime>
    <description>
      Phase 6 of the Solana Migration: Port Constellation constant-product AMM and Deed NFTs
      to Solana with locked bootstrap liquidity and Token-2022 NFT positions.
    </description>
  </context>

  <task>
    Implement Constellation AMM pools, atomic swap instructions, and Token-2022 Deed NFT positions.
  </task>

  <target_files>
    <file action="create">programs/asol_program/src/state/amm.rs</file>
    <file action="create">programs/asol_program/src/state/deed.rs</file>
    <file action="create">programs/asol_program/src/instructions/amm/mod.rs</file>
    <file action="modify">programs/asol_program/src/lib.rs</file>
    <file action="create">lib/solana/constellation-amm.ts</file>
    <file action="create">test/solana/constellation-amm.spec.ts</file>
  </target_files>

  <technical_specifications>
    <amm_state>
      1. `ConstellationPool` (`seeds = [b"constellation", pool_id.to_le_bytes()]`):
         - `pool_id: u16`, `element_a: u8`, `element_b: u8`, `fee_bps: u16` (strictly $\le 10_000$)
         - `reserve_a: u64`, `reserve_b: u64`, `total_shares: u64`, `bootstrapped: bool`, `bump: u8`
      2. `DeedPosition` (`seeds = [b"deed", deed_mint.key()]`):
         - `pool_id: u16`, `shares: u64`, `created_slot: u64`, `active: bool`, `bump: u8`
    </amm_state>

    <instructions>
      1. `register_pool`: Admin registers a pool with distinct elements `element_a != element_b` and `fee_bps <= 10_000`.
      2. `bootstrap_pool`: Admin injects initial virtual reserves. Bootstrapped shares are credited to a locked program PDA and cannot be withdrawn. Callable exactly once (`require!(!pool.bootstrapped)`).
      3. `add_liquidity`: User deposits ESMS amounts; contract burns both Token-2022 ESMS inputs via CPI, computes shares with 1% ratio tolerance, and mints a Token-2022 Deed NFT (`decimals = 0`, `supply = 1`) to the user.
      4. `swap_esms`: Validates trader visibility attestation, performs $x \cdot y = k$ checked math with `u128` intermediates, burns input element from user, and mints output element to user.
      5. `withdraw_liquidity`: Always enabled. Verifies caller holds the Deed NFT, burns the Deed NFT, updates virtual reserves, and mints owed ESMS tokens back to the caller.
    </instructions>
  </technical_specifications>

  <testing_and_verification>
    1. In `test/solana/constellation-amm.spec.ts`:
       - Verify repeated `bootstrap_pool` attempts revert.
       - Verify swaps maintain $k$ invariant minus fees.
       - Verify Deed NFT minting, transferability, and burn-on-withdrawal.
       - Verify fee overflow protection (`fee_bps > 10_000` reverts).
    2. Run test suite: `bun test:solana`.
  </testing_and_verification>
</prompt>
```

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
    2. Confirm all 34 unit and integration tests pass:
       `bun test:solana && bunx vitest run test/solana/golden-vectors.spec.ts test/solana/solana-minter.spec.ts test/solana/sync-and-wallet.spec.ts test/solana/production-integration.spec.ts --config vitest.solana.config.ts`
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
                test/solana/solana-minter.spec.ts \
                test/solana/sync-and-wallet.spec.ts \
                test/solana/production-integration.spec.ts \
                --config vitest.solana.config.ts
```

| Verification Check  | Target Standard                 | Expected Outcome                                                                       |
| :------------------ | :------------------------------ | :------------------------------------------------------------------------------------- |
| **Rust Unit Tests** | 6 Anchor Program Tests          | All 6 tests pass in $< 0.1\text{s}$                                                    |
| **Vitest Suite**    | 28+ Integration Tests           | All tests pass in $< 1.0\text{s}$                                                      |
| **Integer Scaling** | Lossless $10^4$ Conversion      | Zero rounding dust, no JS `number` precision leaks                                     |
| **Extensions**      | Token-2022 Protocol Constraints | `NonTransferable`, `PermissionedBurn`, `PermanentDelegate`, `MetadataPointer` enforced |
| **Replay Guards**   | Permanent PDAs                  | `ClaimReceipt` and `OrderReceipt` accounts prevent double-settlement                   |
