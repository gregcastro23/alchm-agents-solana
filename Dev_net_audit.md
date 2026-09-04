# Solana Devnet ESMS Coin & Program On-Chain Audit Runbook

> **Target Repository:** `/Users/cookingwithcastro/Desktop/AlchmAgentsSolana`  
> **Cluster:** Solana Devnet (`https://api.devnet.solana.com`)  
> **Devnet Genesis Hash:** `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`  
> **Program ID:** `5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD`  
> **ProgramConfig PDA:** `4YCVh9KHrhN6mFSMvybGVqLeGfaRkfUtqrn19mLLJGku`  
> **Devnet Funder / Operator Wallet:** `AhNRjjyhJ4dR6ZSvWyJNSpbJFbFnxhkRdUNMY31fJ3S5` (~13.08 SOL)  
> **Token Program:** `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` (SPL Token-2022)  
> **Objective:** Exhaustively audit the 4 Devnet ESMS coins, Token-2022 extension invariants, claim issuance, replay guards, and AMM attestation flows to guarantee 100% consistent, flawless behavior _before_ funding the Mainnet burner wallet.

---

## 📋 Comprehensive Devnet Audit Prompt

_Copy and execute the prompt below to run a complete Devnet on-chain audit of the current state:_

```markdown
Run a comprehensive, end-to-end on-chain audit of the ASOL Solana Devnet program and ESMS Token-2022 coins in ~/Desktop/AlchmAgentsSolana.

Goals:

1. Verify Devnet Cluster Genesis Hash matches EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG and operator wallet AhNRjjyhJ4dR6ZSvWyJNSpbJFbFnxhkRdUNMY31fJ3S5 has sufficient gas (> 1 SOL).
2. Audit Program 5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD and ProgramConfig PDA 4YCVh9KHrhN6mFSMvybGVqLeGfaRkfUtqrn19mLLJGku on Devnet.
3. Validate all 4 ESMS Token-2022 mint accounts (Spirit, Essence, Matter, Substance) against the on-chain TLV extension layout (NonTransferable, PermanentDelegate, MetadataPointer, TokenMetadata, PermissionedBurn).
4. Execute the live Token-2022 security drill to confirm that direct transfers fail (soulbound), unauthorized burns fail, and authorized burns succeed.
5. Dry-run the initialization engine (bun run scripts/deploy/init-mainnet.ts --dry-run --allow-devnet --allow-local-signer).
6. Run the automated Devnet audit runner (bun run solana:audit:devnet).
7. Report the full findings, confirming whether all Devnet operations run flawlessly and the protocol is cleared for Mainnet Gate 4 funding.
```

---

## 🔬 Audit Stages & Execution Checklist

### Stage 1: Cluster Pre-flight & Operator Wallet Verification

Verify the Devnet RPC endpoint, cluster genesis hash, and local keypair funding.

```bash
# 1. Assert Devnet Genesis Hash
solana genesis-hash --url https://api.devnet.solana.com
# Expected: EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG

# 2. Check Operator Keypair & Devnet Balance
solana address --keypair ~/.config/solana/id.json
# Expected: AhNRjjyhJ4dR6ZSvWyJNSpbJFbFnxhkRdUNMY31fJ3S5

solana balance AhNRjjyhJ4dR6ZSvWyJNSpbJFbFnxhkRdUNMY31fJ3S5 --url devnet
# Expected: >= 1.0 SOL (Confirmed current: ~13.08 SOL)
```

---

### Stage 2: Program Identity & PDA Authorization Audit

Verify that the Anchor program is deployed, owned by the BPF Upgradeable Loader, and that `ProgramConfig` is initialized.

```bash
# 1. Inspect Program Account
solana account 5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD --url devnet
# Checks:
# - Owner: BPFLoaderUpgradeab1e11111111111111111111111
# - Executable: true

# 2. Inspect ProgramConfig PDA
solana account 4YCVh9KHrhN6mFSMvybGVqLeGfaRkfUtqrn19mLLJGku --url devnet
# Checks:
# - Owner: 5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD
# - Length: 140 bytes (contains admin, attestor, pauser, cluster_domain, is_paused)

# 3. Verify Squads v4 Multisig Governance Runbook
bun run scripts/governance/squads-multisig-runbook.ts
# Checks:
# - Multisig PDA: C3pmNGtdRfgGsZFnvFxcXWxUBswpZuwgssW9QcmvPxGm
# - Vault PDA:    DxgjU414Adq4BCyFsvrLkVs3a9ecxtMwh7gjzKjV4muA
```

---

### Stage 3: The 4 ESMS Token-2022 Devnet Mint Accounts Audit

Audit the 4 pinned Devnet ESMS mints. All four are deterministic PDAs derived from seed `[b"esms_mint", [mint_index]]` and owned by SPL Token-2022.

| Elemental Coin | Mint Address                                   | Decimals | Required TLV Extensions                                                                                                |
| :------------- | :--------------------------------------------- | :------: | :--------------------------------------------------------------------------------------------------------------------- |
| **Spirit**     | `K5kwwomtWYydxJacA7bC5yUEW9TtEuVqBKBoqAWLmhQ`  |    4     | `NonTransferable` (9), `PermanentDelegate` (12), `MetadataPointer` (18), `TokenMetadata` (19), `PermissionedBurn` (28) |
| **Essence**    | `3FcpToU7bj4sLD687uecbesEjzjxBfqYn2EcBXJKPaCf` |    4     | `NonTransferable` (9), `PermanentDelegate` (12), `MetadataPointer` (18), `TokenMetadata` (19), `PermissionedBurn` (28) |
| **Matter**     | `7naJZozLrknDF3dguAdEWn7Z4MviUkXitjhaAt57Vkb4` |    4     | `NonTransferable` (9), `PermanentDelegate` (12), `MetadataPointer` (18), `TokenMetadata` (19), `PermissionedBurn` (28) |
| **Substance**  | `6RY6ZG1eJQ2uEvpyA6XK74WyF1MpTYbw97hdhELqDUsa` |    4     | `NonTransferable` (9), `PermanentDelegate` (12), `MetadataPointer` (18), `TokenMetadata` (19), `PermissionedBurn` (28) |

```bash
# Automated Single-Command Invariant Audit
bun run solana:audit:devnet
```

**Expected Passing Telemetry:**

```
=============================================================
🪐 SOLANA DEVNET ESMS COIN & PROGRAM ON-CHAIN AUDIT REPORT
=============================================================
Timestamp:       2026-09-04T15:32:40.850Z
Cluster:         devnet
RPC URL:         https://api.devnet.solana.com
Genesis Hash:    EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG (✅ MATCH)
-------------------------------------------------------------
Program ID:      5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD
  • Deployed:    ✅ YES
  • Executable:  ✅ YES
  • Owner:       BPFLoaderUpgradeab1e11111111111111111111111
  • Balance:     0.00114144 SOL
-------------------------------------------------------------
ProgramConfig:   4YCVh9KHrhN6mFSMvybGVqLeGfaRkfUtqrn19mLLJGku
  • Initialized: ✅ YES
  • Owner:       5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD
  • Balance:     0.00186528 SOL
-------------------------------------------------------------
ESMS Token-2022 Mint Invariants:
  🪙 Spirit (SPIRIT) -> K5kwwomtWYydxJacA7bC5yUEW9TtEuVqBKBoqAWLmhQ
     - Extensions: NonTransferable=true | PermanentDelegate=true | MetadataPointer=true | PermissionedBurn=true
     - Metadata URI: https://alchm.kitchen/metadata/esms/spirit.json
     - Decimals: 4 | Length: 453 bytes | Balance: 0.00404376 SOL
     - Valid Layout: ✅ PASS
  🪙 Essence (ESSENCE) -> 3FcpToU7bj4sLD687uecbesEjzjxBfqYn2EcBXJKPaCf
     - Extensions: NonTransferable=true | PermanentDelegate=true | MetadataPointer=true | PermissionedBurn=true
     - Metadata URI: https://alchm.kitchen/metadata/esms/essence.json
     - Decimals: 4 | Length: 456 bytes | Balance: 0.00406464 SOL
     - Valid Layout: ✅ PASS
  🪙 Matter (MATTER) -> 7naJZozLrknDF3dguAdEWn7Z4MviUkXitjhaAt57Vkb4
     - Extensions: NonTransferable=true | PermanentDelegate=true | MetadataPointer=true | PermissionedBurn=true
     - Metadata URI: https://alchm.kitchen/metadata/esms/matter.json
     - Decimals: 4 | Length: 453 bytes | Balance: 0.00404376 SOL
     - Valid Layout: ✅ PASS
  🪙 Substance (SUBSTANCE) -> 6RY6ZG1eJQ2uEvpyA6XK74WyF1MpTYbw97hdhELqDUsa
     - Extensions: NonTransferable=true | PermanentDelegate=true | MetadataPointer=true | PermissionedBurn=true
     - Metadata URI: https://alchm.kitchen/metadata/esms/substance.json
     - Decimals: 4 | Length: 462 bytes | Balance: 0.0041064 SOL
     - Valid Layout: ✅ PASS
=============================================================
🎉 AUDIT STATUS: ALL DEVNET OPERATIONS & INVARIANTS PASSING
=============================================================
```

---

### Stage 4: Live Token-2022 Extension Security Drill

Execute live transactions on Devnet testing extension constraints:

1. **Soulbound Invariant:** Direct user-to-user ATA transfers MUST be rejected by Token-2022 (`NonTransferable`).
2. **Permissioned Burn Invariant:** Direct user burns without ProgramConfig authorization MUST fail (`PermissionedBurn`).
3. **Permanent Delegate Burn:** Authorized burn via `PermanentDelegate` MUST succeed and correctly debit the balance.

```bash
bun run test:solana:extensions
```

**Expected Live Output:**

```
initialize mint and extensions: brTEW493JSDCBDGjMsUP8z1XdWYuRfh9rmtBwR88YNVG4h7hgfWB59bpVDPgppjevo1MXY7HpJxNKGeV2Fse5Gc
direct Token-2022 transfer: rejected as expected (Simulation failed. )
direct holder burn without AAE permission: rejected as expected (Simulation failed. )
permissioned burn with unauthorized co-signer: rejected as expected (Simulation failed. )
sponsored redeem_for burn: 25MgSbBu9GeZB71octYbhoGaj7DQXLfeF68VBGJ3gCpvT3z6kNLQfRZDA8zaPM5zcm48KDpTimTog13JpraGuJd7
{
  "cluster": "devnet",
  "verified": {
    "nonTransferable": true,
    "unauthorizedBurnRejected": true,
    "permanentDelegateSponsoredBurn": true,
    "metadataPointer": "..."
  }
}
```

---

### Stage 5: Idempotent Deployment Engine Devnet Drill

Simulate the production deployment receipt and verification engine against Devnet:

```bash
bun run scripts/deploy/init-mainnet.ts \
  --dry-run \
  --allow-devnet \
  --allow-local-signer \
  --rpc-url https://api.devnet.solana.com
```

**Audit Checks:**

- Asserts genesis hash is `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`.
- Resolves operator signer: `AhNRjjyhJ4dR6ZSvWyJNSpbJFbFnxhkRdUNMY31fJ3S5`.
- Identifies all 4 mint accounts on-chain.
- Writes verified receipt to `deployments/solana-devnet.json`.

---

### Stage 6: Unit Test Matrix Verification

Ensure all 17 unit test suites remain 100% green:

```bash
bun run test:solana:unit
```

- Total test files: **17 passed**
- Total tests: **197 passed**
- Invariant tests: metadata URIs, rent matrices, velocity guards, priority fees, and outbox reconciliation.

---

## 🚦 Audit Sign-Off Matrix

Before funding the Mainnet burner wallet (`AhNRjjyhJ4dR6ZSvWyJNSpbJFbFnxhkRdUNMY31fJ3S5`):

| #   | Invariant / Drill                               | Command                                      | Status |
| --- | :---------------------------------------------- | :------------------------------------------- | :----: |
| 1   | Devnet Genesis Hash & RPC Health                | `solana genesis-hash --url devnet`           |   ✅   |
| 2   | Operator Keypair Balance ($\ge 1.0\text{ SOL}$) | `solana balance AhNRjjyh... --url devnet`    |   ✅   |
| 3   | Program Deployment & Config PDA Ownership       | `solana account 5Qheuqaic... --url devnet`   |   ✅   |
| 4   | 4 Token-2022 ESMS Mints TLV Layout              | `bun run solana:audit:devnet`                |   ✅   |
| 5   | Token-2022 Transfer & Burn Constraints Drill    | `bun run test:solana:extensions`             |   ✅   |
| 6   | Idempotent Initializer Dry-Run                  | `bun run scripts/deploy/init-mainnet.ts ...` |   ✅   |
| 7   | Full Unit Test Suite (17 files, 197 tests)      | `bun run test:solana:unit`                   |   ✅   |

**Conclusion:** When all 7 items are checked ✅, the protocol behavior on Solana is certified as consistent, robust, and running flawlessly. The operator may safely proceed to fund the Mainnet burner wallet.
