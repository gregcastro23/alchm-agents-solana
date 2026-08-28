# Implementation Plan — Constellation Virtual-Reserve AMM & LP Deed Positions (Phase 6)

Port the Constellation constant-product AMM from Arc EVM (`ConstellationAMM.sol`,
`ConstellationDeed.sol`) to Solana `asol_program`, enforcing locked one-time
bootstrap virtual reserves, owner-seeded `DeedPosition` PDAs with zero rent leak,
per-pool pause guards, sky-gated single-use Ed25519 attestations, and complete
account-substitution constraints.

Findings and rationale: [`PHASE_6_AMM_PLAN_REVIEW.md`](./PHASE_6_AMM_PLAN_REVIEW.md).
This document is the executable spec and supersedes that review's "Corrected
plan" section.

> **Status: implemented 2026-08-28.** See [As built](#as-built--2026-08-28) at the
> end for where reality differed from this plan, the two silent-failure defects the
> work surfaced, and the measured compute-unit figures that replace the estimates
> below.

---

## Resolved Architectural Decisions

1. **LP positions are owner-seeded PDAs (`DeedPosition`), not NFTs.**
   - `seeds = [b"deed", &pool_id.to_le_bytes(), owner.key().as_ref()]` — one
     position per `(owner, pool)`.
   - Deletes the per-position Deed mint, its ATA, the `CloseAuthority`
     extension, and the Deed mint/burn CPIs.
   - `add_liquidity` drops from ~260k to ~120k CU; rent drops from ~0.0047 SOL
     across three accounts to ~0.0012 SOL in one.
   - Repeat adds accumulate under `init_if_needed` with the `version == 0`
     first-touch pattern used by `stake_star`.
   - **Divergence from Arc:** `ConstellationDeed` is a transferable ERC-721 by
     explicit design. Solana LP positions are **not transferable**. Re-adding
     transferability later is additive (a `transfer_position` instruction
     requiring both signatures), but positions written before that stay
     non-portable.
2. **One attestor, two domains.** Verified against `ProgramConfig.attestor`,
   which is necessarily the same key that signs `ASOL_STAR_YIELD_V1` — the
   account has one attestor field and cannot grow a second (see §4).
   `ASOL_AMM_VISIBILITY_V1` domain separation keeps the messages unforgeable
   across surfaces. **The Arc attestor key cannot be reused:** it is secp256k1
   signing EIP-712; this path needs the Ed25519 keypair `config.attestor` names.
3. **Locked bootstrap, and what it exposes.** One-time, admin-only
   (`!pool.bootstrapped`), all shares permanently locked, no position created.
   Closes Arc's repeatable-`seedInitial` withdrawal hole. Because virtual
   reserves were never funded by burned ESMS, **aggregate ESMS is not conserved
   per swap** — reserves `(100 in, 10_000 out)` burn 10 to mint 909. It is
   conserved across closed round trips, where fees make it net-deflationary.
   Per-element minting is bounded by that element's reserve; the permanent
   unbacked component is capped at `MAX_BOOTSTRAP_RESERVE = 100_000_0000`
   (100,000 ESMS). No further guard.
4. **Per-pool pause.** `ProgramConfig` is live on devnet at exactly
   `8 + INIT_SPACE = 140` bytes with no slack, so adding a field EOFs borsh on
   the existing account and bricks `claim_mint_esms` / `redeem_esms` /
   `claim_star_yield`. `ConstellationPool.paused: bool`, gated by
   `config.can_pause(&authority)`.
5. **Partial withdrawal.** `share_bps: u16` (`1..=10_000`) decrements `shares`;
   the account closes only at `shares == 0`. Unconditional — no attestation,
   never paused.
6. **Canonical pairs and fee ceiling.** `element_a < element_b <= 3`,
   `pool_id <= 5`, `fee_bps <= MAX_FEE_BPS = 1_000` (10%). Strict ordering
   prevents both orderings of a pair being registered as divergent pools, and
   matches `constIdForPair` in `lib/staking/amm.ts`, which already sorts.
7. **Runtime verification is in scope.** litesvm as a CI gate plus one devnet
   end-to-end pass before Phase 7. See §Verification.

---

## Canonical Attestation Preimage

`ASOL_AMM_VISIBILITY_V1` is **170 bytes**. The field order is normative and is
pinned as a hex vector in `vectors.rs`; the Rust and TypeScript builders are
asserted byte-identical against it (Phase 5 finding **S9**).

| Offset | Field            | Bytes | Notes                                  |
| -----: | ---------------- | ----: | -------------------------------------- |
|      0 | domain           |    22 | `b"ASOL_AMM_VISIBILITY_V1"`            |
|     22 | `program_id`     |    32 | binds the message to this deployment   |
|     54 | `cluster_domain` |    32 | from `ProgramConfig`                   |
|     86 | `trader`         |    32 |                                        |
|    118 | `pool_id`        |     2 | `u16` LE                               |
|    120 | `op`             |     1 | `0 = add_liquidity`, `1 = swap`        |
|    121 | `region_commit`  |    32 | observer-region commitment             |
|    153 | `visible_stars`  |     1 |                                        |
|    154 | `nonce`          |     8 | `u64` LE, must equal `PoolTraderNonce` |
|    162 | `deadline`       |     8 | `i64` LE                               |
|    170 | —                |       | **total**                              |

`op` is checked against the executing instruction, so an attestation issued for
an add cannot be spent on a swap. `region_commit` and `visible_stars` are not
verifiable on chain — they are carried so the emitted event can be audited
against the feeder's own sky model.

---

## Complete Account Validation & Constraint Tables

> **As built:** every `Account` / `InterfaceAccount` in `AddLiquidity`, `SwapEsms`
> and `WithdrawLiquidity` is wrapped in `Box<...>`. The constraints below are
> unchanged, but written inline they overflowed the 4 KiB SBF stack frame and the
> program faulted at runtime on every call — see [As built](#as-built--2026-08-28).

### 1. `RegisterPool<'info>`

```rust
#[derive(Accounts)]
#[instruction(pool_id: u16, element_a: u8, element_b: u8, fee_bps: u16)]
pub struct RegisterPool<'info> {
    #[account(seeds = [PROGRAM_AUTHORITY_SEED], bump = program_config.bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(mut, constraint = admin.key() == program_config.admin @ AsolError::Unauthorized)]
    pub admin: Signer<'info>,
    // `init`, never `init_if_needed`: `init_if_needed` would let an admin zero
    // reserves and total_shares on a live pool with positions outstanding.
    #[account(
        init,
        payer = admin,
        space = 8 + ConstellationPool::INIT_SPACE,
        seeds = [CONSTELLATION_POOL_SEED, &pool_id.to_le_bytes()],
        bump
    )]
    pub pool: Account<'info, ConstellationPool>,
    pub system_program: Program<'info, System>,
}
```

### 2. `BootstrapPool<'info>`

```rust
#[derive(Accounts)]
#[instruction(pool_id: u16, reserve_a: u64, reserve_b: u64)]
pub struct BootstrapPool<'info> {
    #[account(seeds = [PROGRAM_AUTHORITY_SEED], bump = program_config.bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(mut, constraint = admin.key() == program_config.admin @ AsolError::Unauthorized)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [CONSTELLATION_POOL_SEED, &pool_id.to_le_bytes()],
        bump = pool.bump,
        constraint = !pool.bootstrapped @ AsolError::PoolAlreadyBootstrapped
    )]
    pub pool: Account<'info, ConstellationPool>,
}
```

### 3. `SetPoolPause<'info>`

```rust
#[derive(Accounts)]
#[instruction(pool_id: u16, paused: bool)]
pub struct SetPoolPause<'info> {
    #[account(seeds = [PROGRAM_AUTHORITY_SEED], bump = program_config.bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(constraint = program_config.can_pause(&authority.key()) @ AsolError::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [CONSTELLATION_POOL_SEED, &pool_id.to_le_bytes()],
        bump = pool.bump
    )]
    pub pool: Account<'info, ConstellationPool>,
}
```

### 4. `AddLiquidity<'info>`

```rust
#[derive(Accounts)]
#[instruction(
    pool_id: u16,
    amt_a: u64,
    amt_b: u64,
    min_shares: u64,
    region_commit: [u8; 32],
    visible_stars: u8,
    nonce: u64,
    deadline: i64
)]
pub struct AddLiquidity<'info> {
    #[account(seeds = [PROGRAM_AUTHORITY_SEED], bump = program_config.bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(
        mut,
        seeds = [CONSTELLATION_POOL_SEED, &pool_id.to_le_bytes()],
        bump = pool.bump,
        constraint = pool.bootstrapped @ AsolError::PoolNotBootstrapped,
        constraint = !pool.paused @ AsolError::PoolPaused
    )]
    pub pool: Account<'info, ConstellationPool>,
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(
        init_if_needed,
        payer = trader,
        space = 8 + PoolTraderNonce::INIT_SPACE,
        seeds = [AMM_NONCE_SEED, &pool_id.to_le_bytes(), trader.key().as_ref()],
        bump
    )]
    pub nonce_account: Account<'info, PoolTraderNonce>,
    // Both mints are derived from POOL STATE, never from a caller argument.
    #[account(mut, seeds = [ESMS_MINT_SEED, &[pool.element_a]], bump)]
    pub mint_a: InterfaceAccount<'info, Mint>,
    #[account(mut, seeds = [ESMS_MINT_SEED, &[pool.element_b]], bump)]
    pub mint_b: InterfaceAccount<'info, Mint>,
    // Source ATAs must pre-exist — the trader is burning from them.
    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = trader,
        associated_token::token_program = token_2022_program
    )]
    pub trader_mint_a_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint_b,
        associated_token::authority = trader,
        associated_token::token_program = token_2022_program
    )]
    pub trader_mint_b_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = trader,
        space = 8 + DeedPosition::INIT_SPACE,
        seeds = [DEED_POSITION_SEED, &pool_id.to_le_bytes(), trader.key().as_ref()],
        bump
    )]
    pub deed_position: Account<'info, DeedPosition>,
    /// CHECK: address-equality checked against the instructions sysvar ID; read
    /// only by `verify_preceding_ed25519_instruction`.
    #[account(constraint = instructions.key() == anchor_lang::solana_program::sysvar::instructions::ID @ AsolError::InvalidInstructionsSysvar)]
    pub instructions: UncheckedAccount<'info>,
    pub token_2022_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}
```

### 5. `SwapEsms<'info>`

```rust
#[derive(Accounts)]
#[instruction(
    pool_id: u16,
    in_element: u8,
    in_amount: u64,
    min_out: u64,
    region_commit: [u8; 32],
    visible_stars: u8,
    nonce: u64,
    deadline: i64
)]
pub struct SwapEsms<'info> {
    #[account(seeds = [PROGRAM_AUTHORITY_SEED], bump = program_config.bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(
        mut,
        seeds = [CONSTELLATION_POOL_SEED, &pool_id.to_le_bytes()],
        bump = pool.bump,
        constraint = pool.bootstrapped @ AsolError::PoolNotBootstrapped,
        constraint = !pool.paused @ AsolError::PoolPaused
    )]
    pub pool: Account<'info, ConstellationPool>,
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(
        init_if_needed,
        payer = trader,
        space = 8 + PoolTraderNonce::INIT_SPACE,
        seeds = [AMM_NONCE_SEED, &pool_id.to_le_bytes(), trader.key().as_ref()],
        bump
    )]
    pub nonce_account: Account<'info, PoolTraderNonce>,
    #[account(mut, seeds = [ESMS_MINT_SEED, &[pool.element_a]], bump)]
    pub mint_a: InterfaceAccount<'info, Mint>,
    #[account(mut, seeds = [ESMS_MINT_SEED, &[pool.element_b]], bump)]
    pub mint_b: InterfaceAccount<'info, Mint>,
    // `in_element` only SELECTS between two already-verified mints; it never
    // derives one. The handler pins this ATA to the selected input mint.
    #[account(mut, constraint = trader_in_ata.owner == trader.key() @ AsolError::InvalidTokenAccount)]
    pub trader_in_ata: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: the output mint is selected at runtime, so `associated_token::mint`
    /// cannot be written statically. The handler MUST assert, before any CPI:
    ///   require_keys_eq!(
    ///       trader_out_ata.key(),
    ///       get_associated_token_address_with_program_id(
    ///           &trader.key(), &out_mint.key(), &token_2022_program.key()),
    ///       AsolError::InvalidTokenAccount);
    /// then create it idempotently with payer = trader.
    #[account(mut)]
    pub trader_out_ata: UncheckedAccount<'info>,
    /// CHECK: address-equality checked against the instructions sysvar ID.
    #[account(constraint = instructions.key() == anchor_lang::solana_program::sysvar::instructions::ID @ AsolError::InvalidInstructionsSysvar)]
    pub instructions: UncheckedAccount<'info>,
    pub token_2022_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
```

### 6. `WithdrawLiquidity<'info>`

```rust
#[derive(Accounts)]
#[instruction(pool_id: u16, share_bps: u16)]
pub struct WithdrawLiquidity<'info> {
    #[account(seeds = [PROGRAM_AUTHORITY_SEED], bump = program_config.bump)]
    pub program_config: Account<'info, ProgramConfig>,
    // No pause constraint, no attestation: liquidity can always leave.
    #[account(
        mut,
        seeds = [CONSTELLATION_POOL_SEED, &pool_id.to_le_bytes()],
        bump = pool.bump
    )]
    pub pool: Account<'info, ConstellationPool>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, seeds = [ESMS_MINT_SEED, &[pool.element_a]], bump)]
    pub mint_a: InterfaceAccount<'info, Mint>,
    #[account(mut, seeds = [ESMS_MINT_SEED, &[pool.element_b]], bump)]
    pub mint_b: InterfaceAccount<'info, Mint>,
    // Both output mints are static here, so both ATAs are constraint-enforced
    // rather than hand-validated. Matches `esms.rs:814-820`.
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint_a,
        associated_token::authority = owner,
        associated_token::token_program = token_2022_program
    )]
    pub owner_mint_a_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint_b,
        associated_token::authority = owner,
        associated_token::token_program = token_2022_program
    )]
    pub owner_mint_b_ata: InterfaceAccount<'info, TokenAccount>,
    // The seed IS the authorization. `owner` and `pool_id` are re-checked as
    // defence in depth; the pool_id check is what stops a position from pool 0
    // being redeemed against pool 1's reserves.
    #[account(
        mut,
        seeds = [DEED_POSITION_SEED, &pool_id.to_le_bytes(), owner.key().as_ref()],
        bump = deed_position.bump,
        constraint = deed_position.pool_id == pool.pool_id @ AsolError::InvalidDeedOwner,
        constraint = deed_position.owner == owner.key() @ AsolError::InvalidDeedOwner
    )]
    pub deed_position: Account<'info, DeedPosition>,
    pub token_2022_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
```

---

## Handler-Side Requirements

Not expressible as account constraints, and therefore easy to omit:

- **`register_pool`** — `require!(element_a < element_b, InvalidPoolElements)`,
  `require!(element_b <= 3, InvalidPoolElements)`,
  `require!(pool_id <= 5, InvalidPoolElements)`,
  `require!(fee_bps <= MAX_FEE_BPS, FeeExceedsMaximum)`. `fee_bps == 10_000`
  would zero `in_with_fee` and brick every swap with no update path.
- **`bootstrap_pool`** — `require!(reserve_a <= MAX_BOOTSTRAP_RESERVE && reserve_b <= MAX_BOOTSTRAP_RESERVE, ReserveCeilingExceeded)`;
  `require!(integer_sqrt(a·b) > MINIMUM_LIQUIDITY, InsufficientLiquidity)`
  (this is the **only** use of `MINIMUM_LIQUIDITY` — the admin-only, one-shot
  bootstrap subsumes Arc's empty-pool first-depositor branch, which must not be
  reintroduced). Sets `total_shares = integer_sqrt(a·b)`, all locked, no
  `DeedPosition` created.
- **`add_liquidity` / `swap_esms`** — verify the attestation before any state
  mutation: `deadline >= Clock::unix_timestamp`, `nonce == nonce_account.nonce`,
  `op` matches the instruction, then
  `ed25519::verify_preceding_ed25519_instruction`. Increment
  `nonce_account.nonce` on success.
- **`swap_esms`** — `require!(in_element == pool.element_a || in_element == pool.element_b, InvalidElementForPool)`;
  pin `trader_in_ata.mint` to the selected input mint; assert the ATA derivation
  for `trader_out_ata` as documented in its `/// CHECK`.
- **All reserve mutations** — `u128` intermediates, `checked_*` at the `u64`
  boundary, and a **post-state** ceiling check
  `require!(new_reserve <= MAX_LEDGER_ATOMS, ReserveCeilingExceeded)`. Reserves
  accumulate; validating only the input is insufficient.
- **All divisions floor toward the pool.** `out_amt`, `shares`
  (`lo = min(sA, sB)`), and both withdrawal legs. Unsigned `/` floors in Rust,
  so this is free — but it is an asserted invariant, not an accident.
- **`add_liquidity` first touch** — on `deed_position.version == 0`, initialize
  (`version`, `pool_id`, `owner`, `created_slot`, `bump`, `shares = 0`);
  otherwise accumulate `shares`. Same shape as `stake_star`.
- **`withdraw_liquidity` conditional close** — `close = owner` cannot be used,
  because the close is conditional. After decrementing, if `shares == 0`, call
  `deed_position.close(owner.to_account_info())?` in the handler. Without this
  the rent leaks and finding **C4** is only half-fixed.
- **Every instruction emits its event.** No `msg!`-parsed state.

---

## Proposed Changes

### Solana Program

#### [NEW] `programs/asol_program/src/state/amm.rs`

- `ConstellationPool`: `version: u8`, `pool_id: u16`, `element_a: u8`,
  `element_b: u8`, `fee_bps: u16`, `reserve_a: u64`, `reserve_b: u64`,
  `total_shares: u64`, `bootstrapped: bool`, `paused: bool`, `bump: u8`.
- `PoolTraderNonce`: `version: u8`, `pool_id: u16`, `trader: Pubkey`,
  `nonce: u64`, `bump: u8`.
- Checked `u128` math: `integer_sqrt`, `quote_swap`, `compute_add_shares` (1%
  ratio tolerance), `compute_withdrawal` (`share_bps`, flooring toward the pool).
- Events: `PoolRegistered`, `PoolBootstrapped`, `PoolPauseToggled`,
  `LiquidityAdded`, `Swapped`, `LiquidityWithdrawn`. `LiquidityAdded` and
  `LiquidityWithdrawn` carry the `deed_position` address; `Swapped` carries
  `region_commit`, `visible_stars`, and post-swap `reserve_a` / `reserve_b`.

#### [NEW] `programs/asol_program/src/state/deed.rs`

- `DeedPosition`: `version: u8`, `pool_id: u16`, `owner: Pubkey`, `shares: u64`,
  `created_slot: u64`, `bump: u8`. `owner` is redundant with the seed but kept
  for events and indexing, as `StakePosition` keeps `staker`.

#### [MODIFY] `programs/asol_program/src/state.rs`

- Re-export `amm` and `deed`.

#### [MODIFY] `programs/asol_program/src/constants.rs`

- Seeds: `CONSTELLATION_POOL_SEED = b"constellation_pool"`,
  `DEED_POSITION_SEED = b"deed"`, `AMM_NONCE_SEED = b"amm_nonce"`.
- Domain: `AMM_VISIBILITY_AUTHORIZATION_DOMAIN = b"ASOL_AMM_VISIBILITY_V1"`.
- `MAX_FEE_BPS = 1_000`, `MAX_BOOTSTRAP_RESERVE = 100_000_0000`,
  `MINIMUM_LIQUIDITY = 1_000`, `RATIO_TOLERANCE_BPS = 100`,
  `BPS_DENOMINATOR = 10_000`, `AMM_OP_ADD_LIQUIDITY = 0`, `AMM_OP_SWAP = 1`.

#### [MODIFY] `programs/asol_program/src/errors.rs`

- `PoolAlreadyBootstrapped`, `PoolNotBootstrapped`, `PoolPaused`,
  `InvalidPoolElements`, `FeeExceedsMaximum`, `InvalidElementForPool`,
  `OffRatioDeposit`, `SlippageExceeded`, `InsufficientOutput`,
  `InsufficientLiquidity`, `InvalidDeedOwner`, `InvalidPoolNonce`,
  `InvalidShareBps`, `ReserveCeilingExceeded`.

#### [NEW] `programs/asol_program/src/instructions/ed25519.rs`

- Shared `verify_preceding_ed25519_instruction`, extracted so this does not
  become the program's third copy.

#### [NEW] `programs/asol_program/src/instructions/amm/mod.rs`

- Handlers: `register_pool`, `bootstrap_pool`, `set_pool_pause`,
  `add_liquidity`, `swap_esms`, `withdraw_liquidity`.
- In-module tests: quote curve, ratio tolerance, `share_bps` withdrawal,
  round-trip invariant, event discriminators, plus the litesvm suite below.

#### [MODIFY] `programs/asol_program/src/instructions/mod.rs`

- Export `amm` and `ed25519`.

#### [MODIFY] `programs/asol_program/src/instructions/esms.rs` and `.../staking/mod.rs`

- Refactor both onto the shared `ed25519::verify_preceding_ed25519_instruction`.

#### [MODIFY] `programs/asol_program/src/vectors.rs`

- Add `amm_visibility_authorization_message` with the field order from
  §Canonical Attestation Preimage, and pin the full **170-byte** hex vector in a
  Rust test beside `serializes_canonical_redeem_authorization_vector`.

#### [MODIFY] `programs/asol_program/src/lib.rs`

- Expose all six instructions.

#### [MODIFY] `programs/asol_program/Cargo.toml`

- Add `[dev-dependencies] litesvm` for the runtime suite. **Pin against the
  solana 1.18.17 / anchor 0.30.1 toolchain and verify this first** — if the
  available litesvm line does not support 1.18, fall back to
  `solana-program-test = "=1.18.17"`, which is guaranteed compatible. Do not
  start the runtime suite before this resolves.

---

### Client SDK, Route, Types & Documentation

#### [MODIFY] `lib/solana/priority-fee.ts`

- `ADD_LIQUIDITY_CU_LIMIT = 120_000`, `SWAP_ESMS_CU_LIMIT = 150_000`,
  `WITHDRAW_LIQUIDITY_CU_LIMIT = 110_000`. **Measured from the runtime suite,
  not estimated** — replace these figures with observed values before merge.

#### [NEW] `lib/solana/constellation-amm.ts`

- PDA helpers: `getConstellationPoolAddress`, `getDeedPositionAddress(poolId, owner)`,
  `getPoolTraderNonceAddress`.
- Pure math mirror: `quoteAmmSwap`, `calculateAddLiquidityShares`,
  `calculateWithdrawalAmounts`, `integerSqrt`.
- `buildAmmVisibilityAuthorizationMessage` — asserted byte-identical to the
  Rust vector.
- Instruction and transaction builders: `buildRegisterPoolInstruction`,
  `buildBootstrapPoolInstruction`, `buildSetPoolPauseInstruction`,
  `buildAddLiquidityTransaction`, `buildSwapEsmsTransaction` (emits the adjacent
  Ed25519 precompile + swap pair and injects the CU limit),
  `buildWithdrawLiquidityInstruction`.
- Re-export `ASOL_SOLANA_PROGRAM_ID` (Phase 5 **S8**: the star-vault client did
  not, and a test silently passed `programId: undefined`).

#### [NEW] `app/api/solana/amm-attestation/route.ts`

- Sky gate via `eclipticToHorizontal` and planetary aspects.
- Reads the trader's on-chain `PoolTraderNonce`.
- Signs the 170-byte preimage with the **Ed25519** attestor keypair
  (`SOLANA_ATTESTOR_KEYPAIR`), which must match `ProgramConfig.attestor`.
  `ARC_ATTESTOR_PRIVATE_KEY` is secp256k1 signing EIP-712 and is **not** usable
  on this path.

#### [NEW] `tsconfig.solana.json`

- Covers `lib/solana/**` and `test/solana/**`, which the root `tsconfig.json`
  excludes. Phase 5 **S8** prescribed this and it was never created.

#### [NEW] `test/solana/constellation-amm.spec.ts`

- Byte-identical hex assertion against the Rust vector (170 bytes).
- Constant-product $x \cdot y = k$ non-decreasing across swaps.
- Add-then-immediate-withdraw round trip: withdrawn $\le$ deposited, both legs.
- Partial withdrawal at `share_bps = 5000`.
- Ratio tolerance (1%) and fee ceiling ($\le$ 10%).
- One position per `(owner, pool)`; a repeat add accumulates; two pools for one
  owner derive to distinct PDAs.
- PDA derivations and event discriminators.

#### [NEW] Runtime suite (litesvm, in `amm/mod.rs`, CI gate)

1. Swap with a substituted output mint → fails.
2. Ed25519 instruction at `index − 2` → fails.
3. `in_element` outside the pool's pair → fails.
4. Withdraw by a non-owner → fails.
5. A pool-0 position presented against pool 1 → fails.
6. Second `bootstrap_pool` → fails.
7. Add → immediate full withdraw → returns $\le$ deposited, position closed,
   rent refunded.

#### [MODIFY] `package.json`

- Add `test/solana/constellation-amm.spec.ts` to `test:solana:unit`.
- Add `typecheck:solana`: `tsc --noEmit -p tsconfig.solana.json`.

#### [MODIFY] Documentation

- `docs/SOLANA_MAINNET_MIGRATION_ROADMAP.md` (Phase 6 spec still requires a Deed
  NFT with a transferability test), `STAR_STAKING.md` ("the Deed NFT is the
  position"), `SUBMISSION.md` ("LP-position NFT for zone pools"), and
  `WEB3_STATUS.md`. All four describe the LP position as a transferable NFT.
  The change to record is that **Solana LP positions are not transferable** —
  the rent and compute savings are the implementation detail, the divergence
  from Arc is the fact a reader needs.

---

## Verification Plan

```bash
# 1. Rust unit tests, canonical vectors, and the litesvm runtime suite
RUSTUP_TOOLCHAIN=1.79.0 cargo test -p asol_program --lib

# 2. BPF build + IDL generation (cargo test does neither)
bun run solana:build

# 3. Typecheck the Solana surface the root tsconfig excludes
bunx tsc --noEmit -p tsconfig.solana.json

# 4. TypeScript pure math and the cross-language hex vector
bun run test:solana:unit

# 5. Combined gate (unit + cargo)
bun run test:solana

# 6. Devnet end-to-end, once, before Phase 7:
#    register -> bootstrap -> add -> swap -> partial withdraw -> full withdraw,
#    driven through the SDK builders against the live Token-2022 program.
bun run test:solana:devnet
```

Steps 1 and 6 are the ones that can fail for a reason the program would fail
for. Steps 3–5 are a TypeScript re-implementation checked against itself and
against the pinned vector — necessary, but not sufficient on their own.

---

## As built — 2026-08-28

The plan above is what was implemented. This section records where reality
differed, and the two defects the work surfaced.

### Toolchain question, resolved first as the plan required

**litesvm `=0.2.1`** is the last line built on solana `~1.18`; `0.3.0` moved to
solana `2.0.5`, which cannot coexist with anchor-lang 0.30.1's 1.18.26 tree. The
`solana-program-test` fallback was not needed.

Two things the plan did not anticipate:

1. **litesvm 0.2.1 registers no account for the Ed25519 precompile.** Its account
   loader rejects any transaction containing one with `InvalidProgramForExecution`
   before execution begins, which would have made every attested instruction
   untestable. The runtime never _runs_ a precompile —
   `MessageProcessor::process_message` branches on `is_precompile` and calls
   `process_precompile`, which is what verifies the signature — so the harness
   plants an executable ELF at `ed25519_program::ID` purely to satisfy the loader's
   "executable and owned by a loader" check. `tx.verify_precompiles` and
   `process_precompile` still do the real cryptography;
   `attestation_signed_by_a_non_attestor_fails` would pass vacuously otherwise.
2. **litesvm bundles `spl_token_2022-1.0.0.so`, which predates Permissioned Burn**,
   so every ESMS burn CPI would fail against it. The Devnet Token-2022 binary
   (which does carry extension type 28) is vendored at
   `programs/asol_program/tests/fixtures/spl_token_2022.so` and loaded over it. See
   that directory's README for provenance and how to re-dump it.

`Cargo.lock` also needed four MSRV pins to keep the litesvm dev-dependency tree on
rustc 1.79 (`idna_adapter`, `jobserver`, `async-compression`,
`enum-iterator-derive`), plus **`proc-macro2 = 1.0.86`**. That last one is
load-bearing and not obvious: `anchor build` runs its IDL pass with
`RUSTFLAGS=--cfg procmacro2_semver_exempt`, and under `proc-macro2 1.0.107` that
combination stops providing `From<proc_macro::Span>`, which
`proc-macro-error 1.0.4` needs. `proc-macro-error` is unavoidable —
`anchor-lang-idl → borsh 1.5 → borsh-derive → syn_derive → proc-macro-error`, and
every `borsh-derive` 1.x depends on `syn_derive`. A future `cargo update` that
un-pins `proc-macro2` breaks `bun run solana:build`'s IDL step, loudly.

### The defect the runtime suite caught

`AddLiquidity::try_accounts` and `WithdrawLiquidity::try_accounts` overflowed the
4 KiB SBF stack frame by 64 and 200 bytes. The linker reported it and **`anchor
build` exited 0 and wrote a `.so` anyway**. Every call to either instruction faulted
with `Access violation in unknown section at address 0x0 of size 8` — after the
account inits, before the first CPI, with no Anchor error to read.

Nothing else in the verification plan would have found it. The Rust unit tests
exercise pure functions, the TypeScript suite is a re-implementation, the IDL built
cleanly, and `tsc` had nothing to say. It took executing the compiled program.

Fixed by boxing every deserialized account in the three heavy contexts, matching
`esms.rs`, which already boxes for the same reason. And made non-recurring:
`bun run solana:build` now runs `scripts/build-solana-program.mjs`, which fails the
build when the linker reports a stack overflow and prints the offending function
with the fix. Its guard is verified to fire.

### The second silent failure: a stale shipped IDL

`lib/solana/idl/asol_program.json` — the copy the app and scripts actually import —
had drifted to **8 instructions** while `target/idl` had 20. It was missing every
StarVault (Phase 5) instruction as well as all six AMM ones, so "expose all six
instructions" was not done by generating the IDL. `bun run solana:idl:sync` now
copies `target/` into `lib/solana/idl/` and preserves the `AaeSolana` alias the
generator does not emit.

### Measured, not estimated

The plan's CU figures were high across the board. Observed at first touch, where
the instruction also pays to create its nonce account and position:

| instruction          | planned | measured | published limit |
| :------------------- | ------: | -------: | --------------: |
| `register_pool`      |       — |   11,586 |          20,000 |
| `bootstrap_pool`     |       — |   12,850 |          20,000 |
| `set_pool_pause`     |       — |    7,343 |          15,000 |
| `add_liquidity`      | 120,000 |   61,034 |          85,000 |
| `swap_esms`          | 150,000 |   49,350 |          75,000 |
| `withdraw_liquidity` | 110,000 |   36,164 |          95,000 |

`profiles_compute_units` asserts each instruction against the limit
`lib/solana/priority-fee.ts` publishes, so the two cannot drift.
`withdraw_liquidity`'s limit carries deliberate headroom: its two `init_if_needed`
output ATAs cannot be first-touched in the harness, because `add_liquidity` requires
both ATAs to already exist. The headroom covers the one reachable case — an owner
who closed an emptied ATA between adding and withdrawing.

### Other changes from the plan

- **One preimage builder, not two.** `lib/solana/vectors.ts` owns the byte layout
  (mirroring `vectors.rs`); `constellation-amm.ts` wraps it with a typed,
  validating interface rather than re-serialising it.
- **The TypeScript suite checks against generated artefacts, not only itself.**
  Every instruction's discriminator _and_ full ordered account list is asserted
  against the IDL, so an account inserted or reordered in a Rust
  `#[derive(Accounts)]` struct fails in `bun run test:solana:unit` rather than on
  devnet. Verified by perturbation.
- **`tsconfig.solana.json` surfaced 31 pre-existing type errors** across four Phase
  4/5 specs — the debt Phase 5 **S8** predicted. All fixed (`.accounts()` →
  `.accountsPartial()` for Anchor 0.30 PDA resolution, a generic `signTransaction`
  mock, two control-flow narrowing casts, `Buffer` → `Uint8Array` for `BodyInit`).
  The gate ships green; a gate known to be red gets ignored.
- **`set_pool_pause` is a sixth instruction**, and the SDK, IDL and tests all carry
  it.

### Suite as it stands

36 Rust tests, of which **16 are litesvm runtime cases** executing the compiled
`.so`: the six negative cases the plan named, plus nonce replay, op substitution,
attestor substitution, mint substitution, pause behaviour, re-registration, both
happy paths and the compute-unit profile. 56 new TypeScript cases (139 across
`test:solana:unit`). Zero type errors and zero lint errors on the Solana surface.

### Still outstanding

**Verification step 6 has not been run.** One devnet end-to-end pass —
`register → bootstrap → add → swap → partial withdraw → full withdraw` driven
through the SDK builders against the live Token-2022 program — is still required
before Phase 7. It needs a funded devnet keypair with upgrade authority, and
`initialize_config` there must name an Ed25519 `SOLANA_ATTESTOR_KEYPAIR`.
