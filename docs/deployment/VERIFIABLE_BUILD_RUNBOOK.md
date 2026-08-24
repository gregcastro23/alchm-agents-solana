# Verifiable Anchor Build & Deployment Runbook: AlchmAgentsSolana (`asol_program`)

This runbook details the reproducible compilation, cryptographic verification, and deployment procedures for the **AlchmAgentsSolana** on-chain program (`5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD`).

---

## 1. Deterministic Compilation Architecture

Deterministic builds ensure that any third party can independently compile the open-source repository and produce a byte-for-byte identical `.so` shared object matching on-chain Mainnet bytecode.

### Key Factors Guaranteeing Determinism

1. **Pinned Rust Toolchain (`rust-toolchain.toml`):**
   - Fixed to `channel = "1.79.0"` with minimal profile.
2. **Locked Dependency Tree (`Cargo.lock`):**
   - Tracked directly in git; fixes all crate dependencies and transitive checksums.
3. **Hermetic Release Profile (`Cargo.toml`):**
   - Configures `lto = "fat"`, `codegen-units = 1`, and `overflow-checks = true` to prevent non-deterministic compiler optimizations and parallel code generation variance.
4. **Isolated Docker Build Container:**
   - Standardized container image `backpackapp/build:v0.30.1` providing identical glibc, system headers, and LLVM backend.

---

## 2. Token-2022 Account Space & Rent Exemption Matrix

When initializing Token-2022 mint accounts on Solana, space is allocated in two phases:

- **Creation Space:** Defined by `esms_mint_fixed_account_len()` = `310` bytes (Base Mint + NonTransferable + PermanentDelegate + MetadataPointer + PermissionedBurn TLVs).
- **Rent Exemption Space:** Reallocated by `esms_mint_account_len()` = `314 + 80 + name.len + symbol.len + uri.len` bytes.

### Mainnet Account Parameters (Arweave URI length = 63 bytes)

| Mint Index | Element   | Name             | Symbol           | Value Len | Total Space   | Rent-Exempt Balance                  |
| :--------- | :-------- | :--------------- | :--------------- | :-------- | :------------ | :----------------------------------- |
| **0**      | Spirit    | `Spirit` (6b)    | `SPIRIT` (6b)    | 155 bytes | **469 bytes** | `4,155,120` lamports (~0.004155 SOL) |
| **1**      | Essence   | `Essence` (7b)   | `ESSENCE` (7b)   | 157 bytes | **471 bytes** | `4,169,040` lamports (~0.004169 SOL) |
| **2**      | Matter    | `Matter` (6b)    | `MATTER` (6b)    | 155 bytes | **469 bytes** | `4,155,120` lamports (~0.004155 SOL) |
| **3**      | Substance | `Substance` (9b) | `SUBSTANCE` (9b) | 161 bytes | **475 bytes** | `4,196,880` lamports (~0.004197 SOL) |

> [!IMPORTANT]
> Because `validate_existing_mint` (`programs/asol_program/src/instructions/esms.rs:483`) compares exact byte strings against `ESMS_METADATA_URIS`, any modification to URI length shifts the required rent balance. The test suite (`test/solana/metadata-uris.spec.ts`) pins these exact sizes.

---

## 3. Verifiable Build Step-by-Step

### Prerequisites

- Docker installed and running.
- `solana-verify` CLI installed (`cargo install solana-verify`).
- Bun runtime (`bun --version >= 1.3.13`).

### Step 1: Execute Verifiable Build via Anchor

Run the verifiable build command from the workspace root:

```bash
RUSTC_BOOTSTRAP=1 RUSTUP_TOOLCHAIN=1.79.0 anchor build --verifiable
```

This compiles the program inside the `backpackapp/build:v0.30.1` container and places the reproducible binary in:
`target/verifiable/asol_program.so`

### Step 2: Compute Local Executable Hash

Calculate the SHA256 digest of the verifiable binary:

```bash
solana-verify get-executable-hash target/verifiable/asol_program.so
```

Example Output:

```
Executable Hash: a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0
```

### Step 3: Compare with On-Chain Program Hash

Query the live program bytecode on Mainnet:

```bash
solana-verify get-program-hash \
  -u https://api.mainnet-beta.solana.com \
  5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD
```

If the local executable hash equals the on-chain program hash, the build is **100% verified**.

---

## 4. Remote OtterSec Verification (`verify-from-repo`)

To publish verification to the public OtterSec and Solana Verified Program registries:

```bash
solana-verify verify-from-repo \
  --program-id 5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD \
  --library-name asol_program \
  --mount-path programs/asol_program \
  --commit-hash <PINNED_GIT_COMMIT_SHA> \
  https://github.com/gregcastro23/alchm-agents-solana
```

> [!CAUTION]
> Passing the `--remote` flag submits an on-chain transaction that requires the program's **Upgrade Authority** keypair to sign. This outward-facing step is executed in Phase 7.

---

## 5. Devnet Status & Divergence Documentation (Option a)

During early testing (Phases 1–3), 4 ESMS mints were initialized on Solana Devnet at:

- **Spirit:** `K5kwwomtWYydxJacA7bC5yUEW9TtEuVqBKBoqAWLmhQ`
- **Essence:** `3FcpToU7bj4sLD687uecbesEjzjxBfqYn2EcBXJKPaCf`
- **Matter:** `7naJZozLrknDF3dguAdEWn7Z4MviUkXitjhaAt57Vkb4`
- **Substance:** `6RY6ZG1eJQ2uEvpyA6XK74WyF1MpTYbw97hdhELqDUsa`

### Divergence Rationale

1. The mint accounts are PDAs derived from `[b"esms_mint", &[id]]`.
2. Token-2022 mint accounts without a `CloseAuthority` extension cannot be closed or vacated.
3. Once `constants.rs` is updated to permanent Arweave URIs, invoking `initialize_esms_mints` on Devnet routes into `validate_existing_mint` and fails on the placeholder URI mismatch.
4. **Status:** These 4 Devnet addresses are retired-in-place. All other protocol instructions (`claim_mint_esms`, `redeem_esms`, StarVault, AMM) do not call `validate_existing_mint` and continue to function normally on Devnet.

---

## 6. Failure Triage Guide

If `solana-verify` reports a hash mismatch between local build and on-chain bytecode, investigate in the following priority order:

1. **Toolchain / Compiler Drift:**
   - Verify `rust-toolchain.toml` specifies `channel = "1.79.0"`.
   - Verify Anchor version is `0.30.1` and Docker image is `backpackapp/build:v0.30.1`.
2. **Lockfile Drift:**
   - Run `git status Cargo.lock` to ensure no transitive dependencies were updated or modified.
3. **Release Profile Configuration Drift:**
   - Verify root `Cargo.toml` contains:
     ```toml
     [profile.release]
     overflow-checks = true
     lto = "fat"
     codegen-units = 1
     ```
4. **Git Tree Cleanliness:**
   - Ensure the commit hash passed to `verify-from-repo` exactly matches the tree built locally without untracked files in `programs/asol_program`.
