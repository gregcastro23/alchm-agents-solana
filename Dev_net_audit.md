# Solana Devnet Gate 4 Comprehensive Audit & Execution Runbook

> **Target Repository:** `/Users/cookingwithcastro/Desktop/AlchmAgentsSolana`  
> **Cluster:** Solana Devnet (`https://api.devnet.solana.com`)  
> **Devnet Genesis Hash:** `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`  
> **Program ID:** `5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD`  
> **ProgramData Address:** `7WYfJRuiZG9GsQUUKJoUFVX3yusFVqmbgK8SyTdWtdKg`  
> **ProgramConfig PDA:** `4YCVh9KHrhN6mFSMvybGVqLeGfaRkfUtqrn19mLLJGku` (Exact 140 bytes)  
> **PendingAdmin PDA:** `5PFkkHU53LkbmUyJeaYx2FxqwSWbnRDfo9YzUFv9eyJY`  
> **Operator / Deployer Wallet:** `AhNRjjyhJ4dR6ZSvWyJNSpbJFbFnxhkRdUNMY31fJ3S5` (~12.6 SOL)  
> **Squads v4 Program:** `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`  
> **Squads Multisig PDA (2-of-3):** `4V6oUAf2jm5qfGFkM4LP3NT5MNi5XCx9YWT7xKodq784`  
> **Squads Vault PDA (index 1):** `3DUq9j5STnoF8kuBSJ3VZ8ryEs9b4PhWKF3eQomdtPEU`  
> **Audit Receipt Artifact:** `deployments/solana-devnet-audit-receipt.json`  
> **Governance Artifact:** `deployments/solana-devnet-governance.json`

---

## 1. Executive Summary & Certified Gate 4 State

This runbook documents the verification and operational runbook for **Devnet Gate 4 Readiness**. All three blocking failures and four P0 architectural issues have been resolved:

1. **Bytecode SHA-256 Parity:** On-chain ProgramData was extended to 1,026,048 bytes and deployed. Local binary and on-chain bytecode match byte-for-byte at SHA-256 hash `a964f067f2b455c56fa2b0de8cc500462ac76778ffd00d13f6692500713cf6f8`.
2. **Safe Two-Step Admin Handover:** Implemented `propose_admin` and `accept_admin` via a dedicated `PendingAdmin` PDA (`5PFkkHU53LkbmUyJeaYx2FxqwSWbnRDfo9YzUFv9eyJY`). The core `ProgramConfig` account size remains **exactly 140 bytes**, avoiding breaking account reallocation.
3. **Read-Only Mint Verification:** Live Devnet test suites (`test:solana:devnet`) validate existing Token-2022 mints without re-initializing them.
4. **Constellation AMM Canonical Pools:** All 6 canonical element pairs (0 through 5) are idempotently registered and bootstrapped on Devnet with 30 bps fee and 100,000,000 initial atoms. Live end-to-end drills (add liquidity, swap, replay check, withdrawal) pass with 100% success.
5. **Real Squads v4 Multisig Deployment:** A real 2-of-3 multisig and vault were deployed and tested with an on-chain proposal lifecycle drill on Devnet.
6. **Machine-Readable Audit Receipt:** Generated and validated via `bun run solana:audit:devnet`.

---

## 2. On-Chain Identity & Authority Matrix

| Role / Component         | Devnet Target Address                          | Authority / Owner                             |    Verification Status     |
| :----------------------- | :--------------------------------------------- | :-------------------------------------------- | :------------------------: |
| **Program ID**           | `5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD` | `BPFLoaderUpgradeab1e...`                     |  ✅ Deployed & Executable  |
| **ProgramData**          | `7WYfJRuiZG9GsQUUKJoUFVX3yusFVqmbgK8SyTdWtdKg` | Operator (`AhNRjjyh...`)                      | ✅ SHA-256 Parity Verified |
| **ProgramConfig PDA**    | `4YCVh9KHrhN6mFSMvybGVqLeGfaRkfUtqrn19mLLJGku` | `asol_program`                                | ✅ Strict 140-byte layout  |
| **PendingAdmin PDA**     | `5PFkkHU53LkbmUyJeaYx2FxqwSWbnRDfo9YzUFv9eyJY` | `asol_program`                                |      ✅ Clean / Ready      |
| **Squads Multisig**      | `4V6oUAf2jm5qfGFkM4LP3NT5MNi5XCx9YWT7xKodq784` | `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf` | ✅ 2-of-3 Threshold Active |
| **Squads Vault (idx 1)** | `3DUq9j5STnoF8kuBSJ3VZ8ryEs9b4PhWKF3eQomdtPEU` | `11111111111111111111111111111111`            |  ✅ Funded & Operational   |

---

## 3. Canonical Constellation AMM Pools (Devnet)

All 6 canonical trading pairs are registered and bootstrapped on Devnet:

| Pool ID | Pair Elements                               | Pool PDA Address                               | Initial Virtual Reserves  |  Fee   | Bootstrapped |
| :-----: | :------------------------------------------ | :--------------------------------------------- | :------------------------ | :----: | :----------: |
|  **0**  | Spirit (0) $\leftrightarrow$ Essence (1)    | `FaKBUSnWPTmHKxB4qMxMobjg7SGPPtCUyWxSUNG8zFhE` | 100,000,000 / 100,000,000 | 30 bps |      ✅      |
|  **1**  | Spirit (0) $\leftrightarrow$ Matter (2)     | `8dRxFCCszoMXdB5GRGWgipWZPVfwqxhy9RndFaJNscuh` | 100,000,000 / 100,000,000 | 30 bps |      ✅      |
|  **2**  | Spirit (0) $\leftrightarrow$ Substance (3)  | `B8YowtV7BDa6HX1mC7CbjNAoMfn2cdVYYXeg1N8xz68Q` | 100,000,000 / 100,000,000 | 30 bps |      ✅      |
|  **3**  | Essence (1) $\leftrightarrow$ Matter (2)    | `GpCH31W1HkNaUwL5HhmaKrUW1XuZk9pxeKxfG2QNyU3R` | 100,000,000 / 100,000,000 | 30 bps |      ✅      |
|  **4**  | Essence (1) $\leftrightarrow$ Substance (3) | `2NAqUx8jMATkdeq3RCRNkQTQsBa3sWBCA8pa8eDWSzPY` | 100,000,000 / 100,000,000 | 30 bps |      ✅      |
|  **5**  | Matter (2) $\leftrightarrow$ Substance (3)  | `GK3ogtXDaBJ3QUjsXmpE95JDYqpygXQ1XekGxvABE32p` | 100,000,000 / 100,000,000 | 30 bps |      ✅      |

---

## 4. Audit Execution & Verification Commands

All commands use `bun` runtime in adherence to Apple Silicon and zero-zombie-process constraints:

### 1. Comprehensive Devnet Invariant & Parity Audit

```bash
bun run solana:audit:devnet
```

_Outputs certified audit report to `deployments/solana-devnet-audit-receipt.json`._

### 2. Live Devnet Core Integration Suite (10 tests)

```bash
bun run test:solana:devnet
```

_Executes `test/solana/esms-persona.spec.ts` (8 tests) and `test/solana/devnet-amm.spec.ts` (2 tests) sequentially against Solana Devnet._

### 3. AMM Pool Verification & Ephemeral Trading Drill

```bash
bun run test:solana:devnet:amm
# OR directly execute the initialization/drill runner:
bun run scripts/devnet/init-devnet-amm.ts
```

### 4. Squads v4 Multisig Deployment & Governance Drill

```bash
bun run scripts/governance/init-devnet-multisig.ts
```

_Deploys or verifies 2-of-3 Squads multisig and executes on-chain vault transaction with multi-signer approval._

### 5. Unit & Invariant Test Suite (197 tests)

```bash
bun run test:solana:unit
```

---

## 5. Governance Handover & Rollback Playbook

### 5.1 Program Upgrade Authority Handover

To transfer BPF Upgrade Authority to Squads Vault (`3DUq9j5STnoF8kuBSJ3VZ8ryEs9b4PhWKF3eQomdtPEU`):

```bash
solana program set-upgrade-authority 5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD \
  --new-upgrade-authority 3DUq9j5STnoF8kuBSJ3VZ8ryEs9b4PhWKF3eQomdtPEU \
  --keypair ~/.config/solana/id.json \
  --url devnet
```

### 5.2 Two-Step Protocol Admin Handover

To hand over `ProgramConfig` admin authority:

1. **Current Admin Proposes Squads Vault:**
   ```ts
   await program.methods.proposeAdmin(squadsVaultPda).accounts({ ... }).rpc()
   ```
2. **Squads Vault Accepts Role:**
   Create and execute a Squads transaction calling `acceptAdmin` with Squads Vault as signer:
   ```ts
   await program.methods.acceptAdmin().accounts({ ... }).rpc()
   ```

### 5.3 Emergency Protocol Pause

The designated `pauser` key (or Squads Vault) can instantly freeze claims and redemptions:

```ts
await program.methods.setServiceAuthorities(attestor, pauser).accounts({ ... }).rpc()
await program.methods.pause().accounts({ ... }).rpc()
```

---

## 6. Audit Receipt Summary

```json
{
  "cluster": "devnet",
  "genesisHash": "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
  "genesisMatch": true,
  "program": {
    "id": "5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD",
    "isDeployed": true,
    "bytecodeParity": true,
    "localBytecodeSha256": "a964f067f2b455c56fa2b0de8cc500462ac76778ffd00d13f6692500713cf6f8",
    "onChainBytecodeSha256": "a964f067f2b455c56fa2b0de8cc500462ac76778ffd00d13f6692500713cf6f8"
  },
  "programConfig": {
    "pda": "4YCVh9KHrhN6mFSMvybGVqLeGfaRkfUtqrn19mLLJGku",
    "sizeValid": true,
    "expectedDataLength": 140,
    "dataLength": 140
  },
  "pendingAdmin": {
    "pda": "5PFkkHU53LkbmUyJeaYx2FxqwSWbnRDfo9YzUFv9eyJY",
    "exists": false,
    "pendingAdmin": null
  },
  "ammPoolsCount": 6,
  "allAmmPoolsBootstrapped": true,
  "governance": {
    "configured": true,
    "multisigPda": "4V6oUAf2jm5qfGFkM4LP3NT5MNi5XCx9YWT7xKodq784",
    "vaultPda": "3DUq9j5STnoF8kuBSJ3VZ8ryEs9b4PhWKF3eQomdtPEU",
    "threshold": 2,
    "memberCount": 3,
    "multisigValid": true,
    "vaultValid": true,
    "lifecycleExecuted": true
  },
  "status": "PASSED"
}
```
