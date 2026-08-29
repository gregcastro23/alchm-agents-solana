# Pentacles StarVault — Hand-off Prompt

**From:** AlchmAgentsSolana, `docs/PHASE_5_STARVAULT_REVIEW.md`
**Target:** `Spacetimedbhackathon/Pentacles`, `programs/pentacles-solana/src/lib.rs`
**Status of the source work:** ASOL PR 1 (custody safety) is shipped and verified —
14 Rust unit tests passing, 83 Vitest tests passing, 0 TypeScript errors. The
reference implementations cited below are real code, not proposals.

Paste the XML block at the bottom into a Pentacles session. The findings above it
are the reasoning, so the session can push back on any of them.

---

## Read this first: five things Pentacles already got right

ASOL ported these **from** Pentacles. Do not "fix" them; do not let a reviewer
talk you out of them. The comments explaining each one are load-bearing.

| Pentacles already does                                               | Where            | ASOL now does it too |
| -------------------------------------------------------------------- | ---------------- | -------------------- |
| Net balance-delta measurement on deposit                             | `lib.rs:135-155` | PR 1                 |
| 1:1 shares, with the written rationale for refusing an exchange rate | `lib.rs:159`     | PR 2                 |
| Monotonic checkpoint under a backwards clock                         | `lib.rs:300-305` | PR 1                 |
| `keccak::hash` syscall rather than the `sha3` crate                  | `lib.rs:342`     | PR 3                 |
| Typed `emit!` events instead of `msg!` regex                         | `lib.rs:604-640` | PR 3                 |

Pentacles was ahead on all five. That is why this review produced concrete fixes
instead of a list of maybes.

---

## What is still open in Pentacles

### P1 · CRITICAL — the unconditional withdrawal guarantee is not unconditional

`unstake_star_usdc` carries this doc comment:

> Deliberately unconditional — no pause flag, no admin gate, no activation
> requirement. […] A custody program that can take deposits must always be able
> to return them. — `lib.rs:200-205`

It then calls `checkpoint_position` at `lib.rs:215`, before the transfer. And
`checkpoint_position` is **fallible**: `checked_mul` at `:308-313`,
`u64::try_from(gained)` and `checked_add` at `:315`, each returning
`MathOverflow`. `configure_star_vault` (`lib.rs:66-79`) accepts any `u64` for
`max_rate_atoms_per_usdc_day` with no ceiling.

**Failure scenario.** The intended rate is `50_000`. An admin types `1e13`. A
1,000,000 USDC position (`principal = 1e12`) accrues
`(1e12 × 1e13 × 172_800) / (1e6 × 86_400) = 2e19` over two days, past
`u64::MAX = 1.8e19`. `u64::try_from` fails, `checkpoint_position` errors,
`unstake_star_usdc` reverts. Every staker in that pool is locked out.

The `checked_add` path is worse because it needs no fat-finger — a legitimate
rate and enough elapsed time reaches it, and once `accrued_cap` is near
`u64::MAX` there is no admin action that lowers it. The position can never be
checkpointed again and its principal is stranded permanently.

`accrual_uses_u128_intermediates_without_overflow` proves the intermediates are
`u128`. It does not prove the function cannot return `Err`, which is the property
custody actually depends on.

**Fix (ASOL reference: `programs/asol_program/src/state/staking.rs:47-82`).**

1. `MAX_YIELD_RATE_PER_USDC_DAY` constant, enforced in `configure_star_vault`.
2. Make `checkpoint_position` **infallible** — `saturating_mul` / `saturating_add`,
   and clamp the `u128 → u64` narrowing with `.min(u64::MAX as u128) as u64`.

Keep `checked_add` on the **stake** path (`lib.rs:165-185`). Failing a deposit is
safe; failing a withdrawal is not. Only the checkpoint has to saturate.

---

### P2 · CRITICAL — a rate change applies retroactively

This is `top_up_earns_nothing_retroactively` again, along the **rate** axis
instead of the principal axis.

`checkpoint_position` values the entire elapsed interval at whatever the rate is
**now** (`lib.rs:308-313`). Nothing records what the rate was while that interval
was elapsing, and `configure_star_vault` (`lib.rs:72-73`) overwrites it globally.

**Failure scenario, and it fires on day one.** `initialize_game_authority` sets
`max_rate_atoms_per_usdc_day = 0` (`lib.rs:53`). Positions staked before the
first `configure_star_vault` accrue nothing — correctly. The moment the real rate
is written, every second those positions have been sitting is revalued at it. The
first legitimate configuration call is itself a retroactive grant.

Same shape thereafter: raise the rate 100×, and every un-checkpointed interval
across every position is revalued. Yield that was never earned becomes claimable.

**Fix.** A global accumulator — the MasterChef `accRewardPerShare` shape:

- `GameAuthority` gains `yield_index: u128` and `index_updated_at: i64`.
- `configure_star_vault` settles the index to `now` **at the old rate** before
  writing the new one.
- `StakePosition` gains `index_snapshot: u128`; accrual becomes
  `principal × (index_now − index_snapshot)`.

Rate changes become forward-only by construction, with no per-position sweep.
ASOL is making the identical change in its PR 2 — coordinate the field layout so
one decoder serves both.

---

### P3 · HIGH — the feeder will decode ASOL's events as Pentacles' events

This is the one to read twice, because it breaks on the day ASOL PR 3 deploys and
it breaks **silently**.

Anchor event discriminators are `sha256("event:<Name>")[0..8]` — a function of the
**event name alone**. Not the program id. Not the field layout.

`decodeAnchorEvents` (`feeder/solana-sync-service.ts:170-190`) takes a flat
`logs: string[]`, matches each `Program data:` line against `EVENT_DISCRIMINATORS`
by discriminator only, and has **no program-id scoping** — it does not even know
which program emitted the line.

ASOL PR 3 adds `#[event] StarActivated`, `StarStaked`, `StarUnstaked`. Identical
names, therefore byte-identical discriminators. On a shared cluster, Pentacles'
feeder will decode ASOL's payloads with Pentacles' Borsh layouts and write them
into `star_stake` as if they were its own. The layouts differ today — ASOL's
`StarUnstaked` carries different fields — so the result is well-formed garbage:
no error, no log, wrong rows.

This is precisely the failure mode `lib.rs:604` says the move to typed events was
meant to end:

> the feeder previously reconstructed state by regex over `msg!` strings, so
> rewording a log line silently broke ingestion and no test could catch it.

**Fix (do both — either alone is insufficient).**

1. **Scope by program id.** `decodeAnchorEvents` must receive the emitting program
   id per log line and match `(programId, discriminator)`. Solana log lines carry
   `Program <id> invoke` / `Program <id> success` around each frame, so the
   emitter is recoverable from the same array — parse the frame stack rather than
   flattening it.
2. **Mirror the field layouts anyway**, so a same-named event means the same thing
   in both programs. ASOL PR 3 is specified to copy Pentacles' layout; hold it to
   that, and pin both programs' discriminators **and field order** in
   `tests/solana-instructions.test.ts`.

---

### P4 · MEDIUM — no mint-extension validation at initialization

`initialize_game_authority` (`lib.rs:48-58`) accepts any `usdc_mint` and stores
it. The net-delta measurement at `lib.rs:150-158` protects the **books** against a
`TransferFeeConfig` mint, which is the right defence and ASOL copied it — but it
does not stop a `TransferHook` mint, which can fail or reorder the transfer
itself, or a `PermanentDelegate` mint, whose delegate can drain the vault ATA
outright with the program none the wiser.

**Fix (ASOL reference: `programs/asol_program/src/instructions/staking/mod.rs:29-53`).**
Port `validate_vault_usdc_mint`: pass a classic SPL Token mint through
unconditionally, and for a Token-2022 mint walk the TLV region from offset 166,
rejecting `TransferFeeConfig` (1), `PermanentDelegate` (12) and `TransferHook`
(14). Call it from `initialize_game_authority`.

---

### P5 · MEDIUM — `GameAuthority.authority` cannot be rotated

`initialize_game_authority` sets `auth.authority = payer` (`lib.rs:50`) and
nothing ever changes it. `ConfigureStarVault` gates on `has_one = authority`
(`lib.rs:420`), so losing that key freezes both the Merkle root and the rate
ceiling — which is exactly what turns P1 from recoverable into permanent.

This is **not** `PENDING.md` open item 5. That one is the program _upgrade_
authority moving to Squads v4. This is a separate in-state key with no rotation
path at all, and a program upgrade is the only way to fix it after the fact.

**Fix.** Add `set_game_authority`, callable only by the current authority,
rejecting `Pubkey::default()`. Squads v4 should hold it, alongside the upgrade
authority.

---

### P6 · LOW — `saturating_sub` on the pool aggregates hides desync

`unstake_star_usdc` uses `saturating_sub` on `position.shares` (`:217`),
`pool.total_principal` / `pool.total_shares` (`:220-221`) and
`auth.total_principal` (`:242`).

For custody this is the **right** call and it should stay — P1 says an accounting
quantity must never block a withdrawal, and `saturating_sub` honours that. The
problem is what it does to observability: if the aggregates ever drift from the
sum of positions, the clamp absorbs the difference silently and `StarUnstaked`
then reports a number the chain quietly corrected. A broken invariant becomes
invisible instead of loud.

**Fix.** Keep the saturating arithmetic. Add the applied-vs-requested delta to
`StarUnstaked` (or a separate `PoolAccountingDrift` event) so the feeder can
detect and alarm on drift without anyone's withdrawal being blocked to do it.

---

### P7 · LOW — no proof-depth bound

`verify_star_proof` (`lib.rs:327-341`) iterates the caller's `proof` with no
length limit, so a pathological proof burns the CU budget before failing. The root
guard is already there (`StarRootUnset`, `lib.rs:92`) — this is the other half.

`require!(proof.len() <= 32, …)` costs nothing. ASOL added
`MAX_STAR_PROOF_DEPTH = 32` in PR 1.

---

### P8 · LOW — no rent reclamation

A fully-unstaked `StakePosition` holds the staker's rent forever. Add
`close_stake_position`, gated on `principal == 0 && accrued_cap == 0`,
`close = staker`.

Note `ActivateStar` uses `init` rather than `init_if_needed` (`lib.rs:440`), so a
client retry after a dropped-but-landed activation errors instead of no-opping.
ASOL returns `Ok(())` on an already-activated pool. Pentacles' behaviour is
arguably the safer default — worth a deliberate decision rather than leaving the
divergence unexamined.

---

## Executable prompt

```xml
<prompt id="pentacles-starvault-hardening">
  <context>
    <repository>Pentacles (Spacetimedbhackathon/Pentacles)</repository>
    <program>programs/pentacles-solana/src/lib.rs</program>
    <runtime>Bun + Anchor</runtime>
    <source>
      Derived from AlchmAgentsSolana docs/PHASE_5_STARVAULT_REVIEW.md.
      ASOL PR 1 shipped the P1/P4/P7 fixes already — 14 Rust tests passing.
      Reference implementations:
        programs/asol_program/src/state/staking.rs:47-82        (infallible saturating checkpoint)
        programs/asol_program/src/instructions/staking/mod.rs:29-53  (TLV mint-extension validation)
        programs/asol_program/src/constants.rs:18-24            (rate ceiling + proof depth)
    </source>
    <do_not_touch>
      Five things Pentacles already got right, which ASOL ported FROM here:
      the net-delta deposit measurement (lib.rs:135-155), the 1:1 share model and
      its rationale (lib.rs:159), the monotonic checkpoint (lib.rs:300-305), the
      keccak syscall (lib.rs:342), and typed emit! events (lib.rs:604-640).
      Preserve the comments explaining each — they are the reason this review
      produced fixes instead of guesses.
    </do_not_touch>
  </context>

  <pr id="1" title="custody safety">
    <change file="programs/pentacles-solana/src/lib.rs">
      Add MAX_RATE_ATOMS_PER_USDC_DAY and MAX_STAR_PROOF_DEPTH = 32 consts.
      Derive the rate ceiling from the highest astronomically-justified rate times
      a safety factor and state the derivation in a comment.

      Make checkpoint_position INFALLIBLE (lib.rs:295-320): saturating_mul,
      saturating_add, and clamp the u128 to u64 narrowing with
      .min(u64::MAX as u128) as u64. Keep the monotonic-clock guard exactly as is.
      Leave the checked_add calls on the stake path (lib.rs:165-185) alone —
      failing a deposit is safe, failing a withdrawal is not.

      Enforce the rate ceiling in configure_star_vault (RateExceedsCeiling).
      Bound proof.len() in activate_star (ProofTooDeep).

      Port validate_vault_usdc_mint from ASOL and call it from
      initialize_game_authority: pass classic SPL Token through, and for
      Token-2022 walk the TLV region from offset 166 rejecting TransferFeeConfig
      (1), PermanentDelegate (12) and TransferHook (14).

      Add error variants: RateExceedsCeiling, ProofTooDeep, InvalidVaultMintExtensions.
    </change>
    <verify>
      cargo test --manifest-path programs/pentacles-solana/Cargo.toml
      New tests alongside the existing six:
        - unstake_star_usdc succeeds with rate = u64::MAX after 100 years
          (this is the test accrual_uses_u128_intermediates_without_overflow
           does NOT currently make — it proves u128 intermediates, not Ok-ness)
        - configure_star_vault rejects a rate above the ceiling
        - activate_star rejects a 33-node proof
        - initialize_game_authority rejects a TransferHook mint
    </verify>
  </pr>

  <pr id="2" title="forward-only rate changes">
    <change file="programs/pentacles-solana/src/lib.rs">
      Add yield_index: u128 and index_updated_at: i64 to GameAuthority; bump
      GameAuthority::LEN. Add index_snapshot: u128 to StakePosition; bump
      StakePosition::LEN.

      configure_star_vault settles yield_index to now AT THE OLD RATE before
      writing the new rate.

      checkpoint_position accrues principal * (index_now - index_snapshot)
      instead of reading the live rate. A rate change then cannot reach backwards
      into an interval that already elapsed.

      Add set_game_authority, callable only by the current authority, rejecting
      Pubkey::default().

      Add close_stake_position, gated on principal == 0 && accrued_cap == 0,
      close = staker.

      Coordinate the field layout with ASOL PR 2, which makes the identical change.
    </change>
    <verify>
      New test: a 100x rate increase credits NOTHING to an interval that elapsed
      before the change — the rate-axis analogue of top_up_earns_nothing_retroactively.
      New test: a position staked before the first configure_star_vault (when
      max_rate is still 0) accrues nothing for that pre-configuration window.
    </verify>
  </pr>

  <pr id="3" title="feeder event scoping">
    <change file="feeder/solana-sync-service.ts">
      decodeAnchorEvents currently matches on the 8-byte discriminator alone with
      no program-id scoping. Anchor discriminators are sha256("event:<Name>")[0..8]
      — a function of the event NAME only — so once ASOL emits StarStaked /
      StarUnstaked / StarActivated on the same cluster, this decoder will read
      ASOL's payloads with Pentacles' Borsh layouts and write the result into
      star_stake with no error.

      Parse the Program <id> invoke / success frame stack so each "Program data:"
      line is attributed to its emitting program, and match on
      (programId, discriminator). Ignore events from any program id other than
      pentacles_solana.
    </change>
    <change file="tests/solana-instructions.test.ts">
      Pin both the discriminators AND the field order for every event. A layout
      change in either program must fail this test, not corrupt ingestion.
      Add a regression case: an ASOL-shaped StarStaked payload must be ignored,
      not decoded.
    </change>
    <change file="programs/pentacles-solana/src/lib.rs">
      Add the applied-vs-requested delta to StarUnstaked so the saturating_sub
      clamps at lib.rs:217-242 become observable. Keep the saturating arithmetic —
      an accounting quantity must never block a withdrawal.
    </change>
    <verify>
      bun test tests/
      bun run test:omnichain
      bun scripts/dryrun-star-staking.test.mjs
    </verify>
  </pr>

  <pr id="4" title="conformance doc">
    <change file="docs/SOLANA_MAINNET_CONFORMANCE.md">
      Open item 1 scopes ASOL claim integration to claim_mint_esms and its
      claim-receipt PDA. ASOL Phase 5 added a SECOND ESMS mint path,
      claim_star_yield, whose replay protection is a per-position claim_nonce
      rather than a receipt PDA. Any feeder reconciling ASOL mints has to handle
      both, and until ASOL PR 3 ships there are no events to reconcile against —
      only Token-2022 balance deltas, which carry no star id, position or nonce.

      Add a new open item for P3: the feeder's discriminator collision with ASOL,
      and the program-id scoping that fixes it.

      Note that P1 and P2 are shared findings — the same two flaws exist in ASOL
      and are being fixed in both repos, so the conformance record should say so
      rather than implying Pentacles inherited them.
    </change>
  </pr>
</prompt>
```

---

## Sequencing across the two repos

PR 3 here and ASOL PR 3 are the same integration seam approached from both sides.
Neither program should deploy events to a shared cluster until the feeder is
program-id scoped, or the first ASOL `StarStaked` corrupts `star_stake` silently.

| Order | Repo      | Work                                                                                 |
| ----- | --------- | ------------------------------------------------------------------------------------ |
| 1     | Pentacles | PR 1 — custody safety. Independent, no coordination needed.                          |
| 2     | ASOL      | PR 2 — accumulator + 1:1 shares + `unstake(amount)`. Fixes the signature divergence. |
| 3     | Pentacles | PR 2 — accumulator, matching ASOL's field layout.                                    |
| 4     | Pentacles | PR 3 — feeder scoping. **Must precede any ASOL event deploy.**                       |
| 5     | ASOL      | PR 3 — events, SDK builders, cross-language vectors.                                 |
| 6     | Pentacles | PR 4 — conformance doc.                                                              |
