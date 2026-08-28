# Phase 5 Review — StarVault Staking & Checkpointed Yield

**Reviewed:** `feat/stitch-profile-dashboard-historical-enrichment`, 2026-08-28
**Scope:** everything Phase 5 added or touched, benchmarked against the parallel
Solana StarVault in Pentacles (`programs/pentacles-solana/src/lib.rs`, branch
`feat/solana-mainnet-conformance`).

Pentacles is **read-only reference** here. Nothing in this report changes it; the
hand-off brief at the end is what goes to that repo afterwards.

---

## Verdict

The headline claim holds. Checkpointing before principal mutation is ordered
correctly in both `stake_star` and `unstake_star`, and the top-up exploit is
genuinely closed. The Ed25519 verifier is the strongest part of the change —
it pins `num_signatures == 1`, requires all three `instruction_index` fields to
be `u16::MAX` so the signature data cannot be sourced from a different
instruction, bounds-checks every offset before slicing, and compares the full
message and the attestor key. That is the part most implementations get wrong.

What did not survive review is the framing that the vulnerability was
_eliminated_. It was eliminated **along the principal axis**. The same bug class
is still open along the **rate** axis, and the invariant the walkthrough sells
hardest — "unstaking is non-pausable, users can always withdraw" — is defeated
by an ordinary configuration value, without touching a pause flag.

Pentacles independently solved five of these. Those fixes should be ported here,
not re-derived.

---

## Ranked findings

### S1 · CRITICAL — an unbounded yield rate permanently freezes principal

`initialize_star_vault` and [`set_star_vault_config`](../programs/asol_program/src/instructions/staking/mod.rs#L54)
accept any `u64` for `max_yield_rate_per_usdc_day`. No ceiling, no sanity bound.

[`checkpoint_yield`](../programs/asol_program/src/state/staking.rs#L69) is
**fallible**: `u64::try_from(cap)` at line 65 and `accrued_cap.checked_add(delta)`
at line 79 both return `ArithmeticOverflow`. And
[`unstake_star`](../programs/asol_program/src/instructions/staking/mod.rs#L205)
calls it _before_ every withdrawal.

**Failure scenario.** The intended rate is `50_000` (5.0000 ESMS/USDC/day). An
admin types `1e13`. A 1,000,000 USDC position (`principal = 1e12`) accrues
`(1e12 × 1e13 × 172_800) / (1e6 × 86_400) = 2e19` over two days — past
`u64::MAX = 1.8e19`. `u64::try_from` fails, `checkpoint_yield` errors,
`unstake_star` reverts. Every staker in that pool is locked out until the rate is
lowered — and per **S12** the admin key that can lower it is not rotatable.

The `checked_add` path is worse, because it is reachable at a _legitimate_ rate
given enough time and has no admin remedy: once `accrued_cap` is near `u64::MAX`
you cannot lower it, so the position can never be checkpointed again and its
principal is stranded permanently.

**Fix.** Two changes, both needed:

1. Bound the rate on write. `MAX_YIELD_RATE_PER_USDC_DAY` in `constants.rs`,
   enforced in `initialize_star_vault` and `set_star_vault_config`.
2. **Make accrual infallible.** A cap that overflows should clamp at `u64::MAX`,
   not block a withdrawal. Swap `checked_*` for `saturating_*` inside
   `checkpoint_yield` and clamp the `u128 → u64` narrowing. An accounting
   quantity must never be able to hold custody hostage.

Add a Rust test: `unstake_star` succeeds with `rate = u64::MAX` after 100 years.

---

### S2 · CRITICAL — raising the rate applies retroactively

This is the _same bug the phase claims to have fixed_, with `rate` substituted
for `principal`.

`checkpoint_yield` values the entire elapsed interval at whatever the rate is
**now**. Nothing records what the rate was while that interval was elapsing.

**Failure scenario.** Positions were last checkpointed 90 days ago (no stake, no
unstake, no claim — the common case for a hold). The rate is raised 100×. All 90
days are instantly revalued at the new rate. Yield that was never earned becomes
claimable, and the on-chain cap check passes, so the attestor's signature is the
only thing standing between that and minted ESMS. A compromised attestor plus a
compromised admin is an unbounded mint; either one alone is already a large one.

Structurally identical to `lastClaimAt` not being reset — the exploit is just
reached through config instead of through a deposit.

**Fix.** A global accumulator, the MasterChef `accRewardPerShare` shape:

- `StarVaultState` gains `yield_index: u128` and `index_updated_at: i64`.
- `set_star_vault_config` settles the index to `now` **at the old rate** before
  storing the new one.
- `StakePosition` stores `index_snapshot: u128`; accrual is
  `principal × (index_now − index_snapshot)`.

Rate changes become forward-only by construction, and no per-position migration
sweep is required. Pentacles' `configure_star_vault` has the identical flaw — it
goes in the hand-off brief.

---

### S3 · HIGH — `stake_star` credits the requested amount, not the received amount

[`stake_star`](../programs/asol_program/src/instructions/staking/mod.rs#L143-L167)
adds `usdc_amount` to `pool.total_principal`, `position.principal` and
`vault.total_principal`, then transfers. It never checks what actually landed.

`token_program: Interface<'info, TokenInterface>` accepts Token-2022, and neither
`usdc_mint` nor `vault_usdc_ata` is pinned to a specific mint address — the vault
mint is whatever the admin passed at `initialize_star_vault`. A mint carrying
`TransferFeeConfig` delivers less than was sent, so booked principal exceeds the
vault balance and the **last unstaker's `transfer_checked` fails** with funds
stranded. A `TransferHook` mint is worse: it can reorder or fail asymmetrically.

Pentacles already handles this and says why:

> Measure the net balance delta rather than trusting `amount`: a mint carrying
> the TransferFee extension delivers less than was sent, and crediting the
> requested amount would book principal the vault never received.
> — `programs/pentacles-solana/src/lib.rs:135`

**Fix.** Both halves:

1. Port the delta measurement — capture `vault_usdc_ata.amount`, transfer,
   `reload()`, credit the difference, `require!(net > 0)`.
2. Reject `TransferFeeConfig` / `TransferHook` / `PermanentDelegate` on the vault
   mint at `initialize_star_vault`. `esms.rs:validate_existing_mint` is already
   the pattern to copy.

---

### S4 · HIGH — the pro-rata share model is dead machinery guarding nothing

[`stake_star`](../programs/asol_program/src/instructions/staking/mod.rs#L136)
mints shares pro-rata; [`unstake_star`](../programs/asol_program/src/instructions/staking/mod.rs#L214)
redeems pro-rata and then does `position.principal.checked_sub(usdc_amount)` at
line 230.

Today `pool.total_principal == pool.total_shares` **always**. Deposits move both
by the same amount; withdrawals divide by a ratio that is exactly 1, so every
floor division is exact and no dust accumulates. The exchange rate cannot drift
because nothing distributes principal into the pool. The pro-rata code is, right
now, an elaborate way to write `shares = amount`.

Nothing asserts that invariant. The moment anything credits principal without
shares — an S3 transfer fee, a fee switch, a donation path, a Phase 6 LP hook —
`P` and `S` diverge, `usdc_amount` can exceed `position.principal`, and the
`checked_sub` at line 230 reverts. **That is a withdrawal DoS reached through the
accounting layer**, and it will be introduced by a change that looks unrelated.

Pentacles made the opposite call and wrote down the reasoning:

> Shares track principal one-for-one. The pool distributes no principal yield, so
> there is no exchange rate to drift and no rounding to exploit; yield is minted
> from a separate ESMS supply against the cap.
> — `programs/pentacles-solana/src/lib.rs:159`

**Fix.** Collapse to 1:1 and take `amount` rather than `shares` in
`unstake_star`, matching `unstake_star_usdc(star_id, amount)`. This also removes
a live cross-repo signature disagreement — the two StarVaults currently expose
incompatible withdrawal semantics for the same product.

If the exchange rate is genuinely wanted for Phase 6, then derive
`position.principal` from shares instead of tracking both, and assert
`P == S` in a test until the day something legitimately breaks it.

---

### S5 · HIGH — no events, so the Pentacles feeder cannot see any of this

There is not one `emit!` anywhere in `programs/asol_program/src`.

Pentacles' feeder decodes Anchor events structurally against pinned
discriminators — `StarStaked`, `StarUnstaked`, `StarActivated`
(`feeder/solana-sync-service.ts:135-190`) — and falls back to raw token-balance
deltas for ESMS specifically "because ASOL owns ESMS issuance, and Pentacles has
no IDL for its events" (`:196`).

Consequences today: ASOL's `stake_star` / `unstake_star` / `activate_star` are
**invisible** to the feeder, and `claim_star_yield` mints arrive as anonymous
`mint` rows carrying no star id, no position and no nonce — nothing to reconcile
a claim against. Pentacles' `confirm_yield_claim` was just hardened to be
owner-gated and chain-scoped precisely so a self-declared number cannot drive a
mint; ASOL emitting nothing forces it back onto inference.

Pentacles also recorded why they moved off `msg!`:

> The feeder previously reconstructed state by regex over `msg!` strings, so
> rewording a log line silently broke ingestion and no test could catch it.
> — `programs/pentacles-solana/src/lib.rs:604`

**Fix.** Add `#[event] StarActivated / StarStaked / StarUnstaked /
StarYieldClaimed`. Mirror Pentacles' field layout where it already exists so one
decoder serves both programs; `StarYieldClaimed` additionally carries
`element_id`, `nonce` and `accrued_cap_remaining`. Pin the 8-byte discriminators
in a Rust test **and** in `star-vault.spec.ts`, so a field rename cannot silently
break ingestion.

---

### S6 · HIGH — a backwards clock rewinds the checkpoint

[`state/staking.rs:82`](../programs/asol_program/src/state/staking.rs#L82) and
[`mod.rs:329`](../programs/asol_program/src/instructions/staking/mod.rs#L329)
both assign `last_checkpoint = now` unconditionally. `Clock::unix_timestamp` is
a stake-weighted median of validator timestamps and **can move backwards**.

**Failure scenario.** Checkpoint lands at `T`. The next call observes `T − 30`;
the `now > last_checkpoint` guard correctly skips accrual, but line 82 still
writes `last_checkpoint = T − 30`. A call at `T + 1` then accrues 31 seconds
where 1 elapsed. Small per event, unbounded in aggregate, and free to grind by
spamming 1-atom stakes.

Pentacles fixed exactly this:

> A backwards clock must not rewind the checkpoint; move it forward only.
> — `programs/pentacles-solana/src/lib.rs:302`

**Fix.** `position.last_checkpoint = now.max(position.last_checkpoint)` in both
`checkpoint_yield` and `claim_star_yield`.

---

### S7 · MEDIUM — on-chain Keccak uses the `sha3` crate instead of the syscall

[`mod.rs:13`](../programs/asol_program/src/instructions/staking/mod.rs#L13) and
`vectors.rs:65` put software Keccak on the `activate_star` hot path: two hashes
for the leaf plus one per proof node. Pentacles uses
`anchor_lang::solana_program::keccak::hash` — the `sol_keccak256` syscall
(`lib.rs:340`).

Cheaper per node and a materially smaller `.so`, which matters for the
`solana-verify` reproducible build in Phase 4.

**Fix.** Use the syscall on the on-chain path. Keep the `sha3` implementation
behind `#[cfg(test)]` — an independent implementation cross-checking the pinned
`3faa6d40…` vector is worth keeping, it just should not ship in the binary.

---

### S8 · MEDIUM — two TypeScript errors in the new files, hidden by tsconfig scope

`tsconfig.json` excludes `test` and `**/*.spec.ts`. `bun run typecheck:errors`
reports `0` because **the new spec is not on the typechecked surface**. Compiled
explicitly, it fails:

```
test/solana/star-vault.spec.ts(9,3): error TS2459: Module '@/lib/solana/star-vault'
  declares 'ASOL_SOLANA_PROGRAM_ID' locally, but it is not exported.
test/solana/star-vault.spec.ts(20,3): error TS2305: Module '@/lib/solana/star-vault'
  has no exported member 'USRAM_SCALE'.
```

`USRAM_SCALE` is a typo for `USDC_RAW_SCALE`, imported as `_` and unused —
harmless once fixed.

The first one is not harmless. Confirmed at runtime: the spec's
`ASOL_SOLANA_PROGRAM_ID` is **`undefined`**. It is passed as
`buildStarYieldAuthorizationMessage({ programId: ASOL_SOLANA_PROGRAM_ID, … })`,
where the destructuring default silently substitutes the real id. The test that
exists to prove the canonical authorization message binds the program id never
exercises the value it claims to pass — and it is green.

**Fix.** Re-export `ASOL_SOLANA_PROGRAM_ID` from `star-vault.ts`, fix the typo,
and add a `tsconfig.solana.json` covering `lib/solana/**` + `test/solana/**` that
CI runs. Without the last part this class of error stays invisible.

---

### S9 · MEDIUM — no cross-language pin on the yield authorization message

`test_star_yield_authorization_serialization` asserts the domain prefix and the
byte length. The TypeScript test asserts the same two things. Neither pins a hex
vector; neither compares against the other.

`vectors.rs` already does this properly for redeem —
`serializes_canonical_redeem_authorization_vector` pins the full hex string — and
Pentacles pins its leaf hash against a JS-computed value explicitly "so the two
languages cannot drift."

**Failure scenario.** Swap `nonce` and `deadline` in one language. Both suites
stay green, length is unchanged, prefix is unchanged. Every claim then fails on
chain — _after_ the attestor has signed, which is the expensive place to find out.

**Fix.** Move `star_yield_authorization_message` into `vectors.rs` beside the
redeem vector, pin a hex vector in Rust, assert the byte-identical hex in
`star-vault.spec.ts`.

---

### S10 · MEDIUM — the "SDK client" has no instruction builders

`lib/solana/star-vault.ts` imports `Connection`, `Ed25519Program`,
`SystemProgram`, `Transaction`, `TransactionInstruction`,
`SYSVAR_INSTRUCTIONS_PUBKEY`, `ASSOCIATED_TOKEN_PROGRAM_ID`, `TOKEN_PROGRAM_ID`,
`TOKEN_2022_PROGRAM_ID`, `getEsmsMintAddresses` and `getProgramConfigAddress` —
and **uses none of them**. What ships is PDA derivation, a message serializer, a
mirror of the yield math, and a Merkle verifier. There is no client.

So the `claim_star_yield` flow — whose entire security rests on an
`Ed25519Program` instruction sitting at exactly `index − 1` — has never been
constructed, let alone submitted. Every "Ed25519" assertion in the spec is
`nacl.sign.detached` in isolation; the on-chain verifier's offset parsing, the
adjacency requirement and the `u16::MAX` self-containment checks are untested.

The whole suite is a TypeScript re-implementation checked against itself. It
cannot fail for any reason the program would fail for.

**Fix.** Add `buildActivateStarInstruction`, `buildStakeStarInstruction`,
`buildUnstakeStarInstruction`, and `buildClaimStarYieldTransaction` — the last
emitting the ed25519 instruction and the claim as an adjacent pair — then drive
them against `litesvm` or `solana-test-validator` under `test:solana:devnet`.

One such test would have caught S1, S3, S4, S6 and S9.

---

### S11 · LOW — no rent reclamation

A fully-unstaked `StakePosition` holds the staker's rent forever. Add
`close_stake_position`, gated on `shares == 0 && accrued_cap == 0`,
`close = staker`.

---

### S12 · LOW — neither admin key can be rotated

`config.rs` has `set_service_authorities` for attestor and pauser but **no admin
rotation**; `ProgramConfig.admin` is write-once. `initialize_star_vault` then
copies it into `StarVaultState.admin`, creating a _second_ write-once key that
`set_star_vault_config` authorizes against — so rotating one would not move the
other anyway.

Lose either and the Merkle root and rate ceiling are frozen, which is what turns
S1 from recoverable into permanent.

**Fix.** Drop `StarVaultState.admin` and authorize against `program_config.admin`
(one key, one meaning), then add rotation for it. Squads v4 should hold it —
Pentacles tracks the same as its open item 5.

---

### S13 · LOW — unset Merkle root, unbounded proof length

`initialize_star_vault` and `set_star_vault_config` accept `[0u8; 32]` as the
root. Every `activate_star` then fails with `InvalidStarProof`, which points the
operator at the proof instead of at the unset root. Pentacles raises
`StarRootUnset` (`lib.rs:92`).

`verify_merkle_proof` also has no depth bound, so a pathological proof burns the
CU budget before failing. `require!(proof.len() <= 32, …)` costs nothing.

---

### S14 · LOW — cleanups

- `ED25519_OFFSETS_SIZE` (`constants.rs:23`) is defined and never used; the
  handler hardcodes `data.len() >= 16`. Use `2 + ED25519_OFFSETS_SIZE` or delete
  the constant.
- `stake_star:144` returns `ZeroAmount` when `shares == 0`, which reads as "you
  sent nothing" when the real cause is a rounding wipe-out. Give it its own
  error — and note it becomes unreachable once S4 lands.
- `ClaimStarYield` declares `associated_token_program` and `system_program` and
  uses neither. They inflate the IDL and imply the ATA gets created when it must
  already exist.
- `instructions: AccountInfo` is validated in the handler.
  `#[account(address = sysvar::instructions::ID)]` puts it in the declarative
  layer where a reader will find it.

---

### S15 · Doc drift in the roadmap

The Phase 5 spec says `claim_star_yield` should "consume nonce, reset
`accrued_cap = 0`". The code carries the remainder forward
(`mod.rs:330`, `accrued_cap = total_claimable − amount`), which is **correct** —
a partial claim must not forfeit the rest — and matches Pentacles' rule that a
sub-atom remainder returns to `accrued_essence` rather than being written off.

Update the roadmap to match the implementation. The spec's `StarVaultState` also
omits `admin` and `max_yield_rate_per_usdc_day`, both of which shipped.

---

## Suggested order

Ship as three PRs; do not fold them together.

| PR                       | Contents                 | Why this grouping                                                                                                                                |
| ------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1 — custody safety**   | S1, S6, S3, S13          | Everything that can strand or over-credit principal. Smallest diff, highest value, no state-layout change.                                       |
| **2 — accounting model** | S2, S4, S11, S12, S15    | Changes `StarVaultState` / `StakePosition` layout and the `unstake_star` signature. Must land before any devnet deploy that takes real deposits. |
| **3 — provability**      | S5, S8, S9, S10, S7, S14 | Events, the real SDK, cross-language vectors, typecheck coverage. This is what makes PRs 1 and 2 verifiable rather than asserted.                |

PR 2 changes account layouts. If a devnet vault already exists, it needs a
re-deploy and re-init, not a migration.

---

## Executable prompt

Matches the `<prompt>` convention in `docs/SOLANA_MAINNET_MIGRATION_ROADMAP.md`.
Run one `<pr>` block per session.

```xml
<prompt id="asol-phase-5-remediation">
  <context>
    <repository>AlchmAgentsSolana (ASOL)</repository>
    <program_id>5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD</program_id>
    <runtime>Bun</runtime>
    <reference>
      Pentacles programs/pentacles-solana/src/lib.rs solved S1/S3/S4/S6/S7 already.
      READ ONLY — do not modify any file under Spacetimedbhackathon/Pentacles.
    </reference>
  </context>

  <pr id="1" title="custody safety">
    <change file="programs/asol_program/src/constants.rs">
      Add MAX_YIELD_RATE_PER_USDC_DAY. Pick the ceiling from the highest
      astronomically-justified rate times a safety factor, and state the
      derivation in a comment.
    </change>
    <change file="programs/asol_program/src/state/staking.rs">
      Make checkpoint_yield infallible: saturating_mul / saturating_add, clamp the
      u128 to u64 narrowing at u64::MAX. An accrual that overflows must clamp,
      never block a withdrawal.
      Make the checkpoint monotonic: last_checkpoint = now.max(last_checkpoint).
    </change>
    <change file="programs/asol_program/src/instructions/staking/mod.rs">
      Enforce MAX_YIELD_RATE_PER_USDC_DAY in initialize_star_vault and
      set_star_vault_config. Reject a zero star_root with a dedicated
      StarRootUnset error. Bound proof.len() at 32 in activate_star.
      In stake_star, measure the received amount: read vault_usdc_ata.amount
      before transfer_checked, reload() after, credit the delta, require net > 0.
      In initialize_star_vault, reject a vault mint carrying TransferFeeConfig,
      TransferHook or PermanentDelegate — follow esms.rs::validate_existing_mint.
      Apply the monotonic checkpoint in claim_star_yield too.
    </change>
    <verify>
      Rust tests: unstake_star succeeds with rate = u64::MAX after 100 years;
      a backwards clock never rewinds last_checkpoint; a transfer-fee mint is
      rejected at init. Run: RUSTUP_TOOLCHAIN=1.79.0 cargo test -p asol_program --lib
    </verify>
  </pr>

  <pr id="2" title="accounting model">
    <change file="programs/asol_program/src/state/staking.rs">
      Add yield_index: u128 and index_updated_at: i64 to StarVaultState.
      Add index_snapshot: u128 to StakePosition.
      Accrual becomes principal * (index_now - index_snapshot); a rate change
      settles the index at the OLD rate first, so it can only ever apply forward.
      Collapse shares to 1:1 with principal.
    </change>
    <change file="programs/asol_program/src/instructions/staking/mod.rs">
      set_star_vault_config settles yield_index to now at the old rate before
      writing the new rate.
      unstake_star takes `amount: u64` (USDC), not `shares`. Require
      position.principal >= amount. Drop the pro-rata division entirely.
      Drop StarVaultState.admin; authorize set_star_vault_config against
      program_config.admin.
      Add close_stake_position, gated on shares == 0 && accrued_cap == 0,
      close = staker.
    </change>
    <change file="programs/asol_program/src/instructions/config.rs">
      Add set_admin, callable only by the current admin, rejecting Pubkey::default().
    </change>
    <change file="programs/asol_program/src/lib.rs">
      Expose close_stake_position and set_admin. Update the unstake_star signature.
    </change>
    <change file="docs/SOLANA_MAINNET_MIGRATION_ROADMAP.md">
      Fix the Phase 5 spec: claim carries the remainder forward, it does not reset
      accrued_cap to 0. Add admin and max_yield_rate_per_usdc_day to the documented
      StarVaultState.
    </change>
    <verify>
      Rust test: a 100x rate increase credits NOTHING to an interval that elapsed
      before the change — the S2 analogue of the existing S-shaped top-up test.
      Rust test: P == S holds across an interleaved stake/unstake sequence.
    </verify>
  </pr>

  <pr id="3" title="provability">
    <change file="programs/asol_program/src/instructions/staking/mod.rs">
      Add #[event] StarActivated / StarStaked / StarUnstaked / StarYieldClaimed.
      Mirror the Pentacles field layout where one exists so a single decoder
      serves both programs; StarYieldClaimed adds element_id, nonce and
      accrued_cap_remaining. emit! at the end of each instruction.
      Replace sha3::Keccak256 with anchor_lang::solana_program::keccak::hash on
      the on-chain path; keep the sha3 implementation under #[cfg(test)] as an
      independent cross-check of the pinned vector.
      Use 2 + ED25519_OFFSETS_SIZE instead of the literal 16.
      Constrain `instructions` with #[account(address = sysvar::instructions::ID)].
      Drop the unused associated_token_program / system_program from ClaimStarYield.
    </change>
    <change file="programs/asol_program/src/vectors.rs">
      Move star_yield_authorization_message here beside the redeem vector and pin
      a full hex test vector, matching serializes_canonical_redeem_authorization_vector.
    </change>
    <change file="lib/solana/star-vault.ts">
      Re-export ASOL_SOLANA_PROGRAM_ID. Add real instruction builders:
      buildActivateStarInstruction, buildStakeStarInstruction,
      buildUnstakeStarInstruction, and buildClaimStarYieldTransaction — the last
      MUST emit the Ed25519Program instruction immediately before the claim.
      Remove every unused import.
    </change>
    <change file="test/solana/star-vault.spec.ts">
      Fix USRAM_SCALE -> USDC_RAW_SCALE. Assert the authorization message hex is
      byte-identical to the Rust vector. Pin the four event discriminators.
      Assert buildClaimStarYieldTransaction places the ed25519 instruction at
      exactly index - 1.
    </change>
    <change file="tsconfig.solana.json">
      New project covering lib/solana/** and test/solana/**. Wire it into
      `bun run check` so a broken import in a spec can never pass typecheck again.
    </change>
    <verify>
      bunx tsc -p tsconfig.solana.json  (must be 0 errors)
      bun run test:solana
      A litesvm or solana-test-validator run exercising stake -> accrue ->
      ed25519-attested claim -> unstake end to end.
    </verify>
  </pr>
</prompt>
```

---

## Hand-off brief for Pentacles

Read-only findings from this review that apply to
`programs/pentacles-solana/src/lib.rs`. Nothing here was changed in that repo.

1. **S2 applies verbatim.** `configure_star_vault` sets
   `max_rate_atoms_per_usdc_day` globally, and `checkpoint_position` values the
   whole elapsed interval at the current rate. A rate increase retroactively
   revalues every un-checkpointed interval — the same class as the top-up bug
   `top_up_earns_nothing_retroactively` proves is closed. The accumulator fix
   applies unchanged.

2. **S1 applies verbatim.** `checkpoint_position` is fallible
   (`checked_add`, `u64::try_from`) and `unstake_star_usdc` calls it before
   withdrawing. That defeats the "deliberately unconditional" withdrawal
   guarantee the function's own doc comment makes — via an accounting value
   rather than a gate. Bound the rate and make the accrual saturate.

3. **What Pentacles should keep and ASOL is porting:** the net-delta transfer
   measurement, the 1:1 share model and its written rationale, the monotonic
   checkpoint, the syscall Keccak, and typed events with pinned discriminators.
   Five for five — the reasoning in those comments is why this review has
   concrete fixes instead of a list of maybes.

4. **Cross-repo divergences to settle before either deploys.** Instruction
   semantics disagree today: ASOL `unstake_star(star_id, shares)` vs Pentacles
   `unstake_star_usdc(star_id, amount)`. ASOL PR 2 moves to the Pentacles
   signature. Seeds also differ (`star-vault` / `star-pool` / `stake` vs
   `game_authority` / …) — fine while they are separate programs, but the feeder
   and any shared client need one derivation table.

5. **Open item 1 in `SOLANA_MAINNET_CONFORMANCE.md` needs an update.** It scopes
   ASOL claim integration to `claim_mint_esms` and its claim-receipt PDA. Phase 5
   added a **second** ESMS mint path, `claim_star_yield`, which has no receipt
   account — replay protection is a per-position `claim_nonce`, not a PDA. Any
   feeder reconciling ASOL mints has to handle both, and until ASOL PR 3 lands
   there are no events to reconcile against.
