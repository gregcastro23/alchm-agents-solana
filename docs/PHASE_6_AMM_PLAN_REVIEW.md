# Phase 6 Plan Review — Constellation AMM & LP Deed NFTs

Review of the proposed implementation plan for porting `ConstellationAMM.sol` /
`ConstellationDeed.sol` to `programs/asol_program`. Read against the Arc EVM
source (`contracts/src/`), the live program state, and
[`PHASE_5_STARVAULT_REVIEW.md`](./PHASE_5_STARVAULT_REVIEW.md).

> **The executable spec is now [`PHASE_6_AMM_PLAN.md`](./PHASE_6_AMM_PLAN.md).**
> This document is the record of findings; the "Corrected plan" section below is
> superseded by it.

---

## Verdict

The two headline design changes are correct and are genuine improvements over
the EVM contract:

- **One-shot locked bootstrap.** `seedInitial` on Arc is `onlyRole(ADMIN_ROLE)`
  but otherwise unbounded — repeatable, mints the admin a Deed, and burns no
  ESMS. The admin can therefore withdraw against reserves that never existed.
  Making bootstrap single-shot with permanently locked shares and no Deed closes
  that. The arithmetic holds: for an on-ratio add of `a`, minted shares are
  `s = a·S₀/rA₀`, so `s/(S₀+s) = a/(rA₀+a)` exactly and a withdrawal returns
  exactly `a`. No ESMS is created from nothing on the LP path.
- **Strict fee bound at registration.** Arc's `registerPool` validates `feeBps`
  not at all and relies on 0.8.x underflow to revert at swap time.

What does not survive review is the plan's coverage. It specifies instruction
_behaviour_ in full and instruction _account validation_ nowhere — which on
Solana is where the entire security boundary lives. Five findings are blocking.
Separately, four of the plan's items reproduce findings the team already
accepted one phase ago (S5, S9, S10, S11); the Phase 5 review's closing line on
S10 was _"One such test would have caught S1, S3, S4, S6 and S9."_ That test
still does not exist, and Phase 6 introduces the first instruction in this
program that mints ESMS to a user along a direction the **user** chooses.

---

## Ranked findings

| #   | Sev      | Finding                                                            |
| --- | -------- | ------------------------------------------------------------------ |
| A1  | BLOCKING | No account-substitution constraints specified anywhere             |
| A2  | BLOCKING | Partial withdrawal (`shareBps`) silently dropped                   |
| A3  | BLOCKING | `fee_bps <= 10_000` admits a pool that bricks its own swaps        |
| A4  | BLOCKING | No pause on swap/add — and `ProgramConfig` cannot grow to add one  |
| A5  | BLOCKING | Zero events (repeat of S5), and worse here than in Phase 5         |
| B1  | HIGH     | Test plan reproduces S10 verbatim — TS checked against itself      |
| B2  | HIGH     | SDK ships no instruction builders (S10 again)                      |
| B3  | HIGH     | No attestation-issuing API route — the program ships dark          |
| B4  | HIGH     | Attestation drops `regionCommit` / `visibleStars`                  |
| B5  | HIGH     | Message binds no operation discriminator                           |
| B6  | HIGH     | No cross-language hex vector for the new message (S9 again)        |
| B7  | HIGH     | Locked bootstrap is a permanent per-element mint allowance         |
| C1  | MEDIUM   | `MINIMUM_LIQUIDITY` has nowhere to be used in this design          |
| C2  | MEDIUM   | Reserve ceiling and `u128` intermediates unstated                  |
| C3  | MEDIUM   | Rounding direction unstated; round-trip test missing               |
| C4  | MEDIUM   | Rent leak per position (S11 again) — and Deed mints need a close   |
| C5  | MEDIUM   | Output ATA may not exist on a trader's first swap of a pair        |
| C6  | MEDIUM   | `init` vs `init_if_needed` on the pool unstated                    |
| C7  | MEDIUM   | Pair not canonicalised — both orderings registrable                |
| C8  | MEDIUM   | `add_liquidity` will exceed the 200k default compute budget        |
| D1  | LOW      | Would become the third copy of the Ed25519 verifier                |
| D2  | LOW      | New spec lands off the typechecked surface (S8's fix never landed) |
| D3  | LOW      | Seed naming, `version`, `created_slot` cleanups                    |
| D4  | LOW      | Verification plan omits `anchor build` and typecheck               |

---

## A · Blocking

### A1 — No account-substitution constraints specified anywhere

The plan describes what each instruction _computes_ and never states how
`element_mint_a`, `element_mint_b`, `deed_mint`, `deed_position`, or any ATA is
**constrained**. On Solana an unconstrained mint account passed to a `mint_to`
CPI signed by the program's own PDA is an unbounded mint of any token that PDA
holds authority over. This is the single highest-value target in the program and
the plan is silent on it.

Phase 5 got this right in `ClaimStarYield`:

```rust
#[account(mut, seeds = [ESMS_MINT_SEED, &[element_id]], bump)]
pub element_mint: InterfaceAccount<'info, Mint>,
```

— but there `element_id` is an instruction arg _bound into the attestation the
attestor signed_. In `swap_esms` the direction comes from the trader, so the
seed argument must come from **pool state**, not from the caller:

```rust
#[derive(Accounts)]
#[instruction(pool_id: u16, in_element: u8)]
pub struct SwapEsms<'info> {
    #[account(mut, seeds = [CONSTELLATION_POOL_SEED, &pool_id.to_le_bytes()], bump = pool.bump)]
    pub pool: Account<'info, ConstellationPool>,
    #[account(mut, seeds = [ESMS_MINT_SEED, &[pool.element_a]], bump)]
    pub mint_a: InterfaceAccount<'info, Mint>,
    #[account(mut, seeds = [ESMS_MINT_SEED, &[pool.element_b]], bump)]
    pub mint_b: InterfaceAccount<'info, Mint>,
    ...
}
```

Anchor resolves `pool` before the mint seeds, so this compiles and binds both
mints to the pool's frozen pair. `in_element` is then validated
(`require!(in_element == pool.element_a || in_element == pool.element_b,
InvalidElementForPool)`) and used only to _select_ between two already-verified
accounts — never to derive one.

The same applies to `withdraw_liquidity`, which must additionally bind the
position to the pool:

```rust
#[account(
    mut,
    seeds = [DEED_POSITION_SEED, deed_mint.key().as_ref()],
    bump = deed_position.bump,
    constraint = deed_position.pool_id == pool.pool_id @ AsolError::InvalidDeedOwner,
)]
pub deed_position: Account<'info, DeedPosition>,
#[account(
    constraint = owner_deed_ata.mint == deed_mint.key(),
    constraint = owner_deed_ata.owner == owner.key(),
    constraint = owner_deed_ata.amount == 1 @ AsolError::InvalidDeedOwner,
)]
pub owner_deed_ata: InterfaceAccount<'info, TokenAccount>,
```

Without the `pool_id` cross-check, a Deed minted against the cheap
Spirit–Essence pool is redeemable against the deep Spirit–Matter one.

**The plan must enumerate every account and its constraint per instruction.**
That table is the deliverable, not the math.

### A2 — Partial withdrawal is silently dropped

`ConstellationAMM.withdraw(deedId, shareBps)` takes `1..10_000` bps and calls
`deed.setShares(deedId, shares - pull)` when `pull != shares`. The plan's
`withdraw_liquidity` "burns Deed NFT ... closes/deactivates `DeedPosition`" —
full exit only, and this is not flagged as a deliberate cut.

It matters more on Solana than on Arc. Each position costs a Deed mint + a Deed
ATA + a `DeedPosition` in rent (C4), and re-entering requires a fresh
attestation. Forcing full exit to rebalance means paying all of that twice.

**Fix.** Take `share_bps: u16`, validate `1..=BPS_DENOMINATOR`, compute
`pull = shares * share_bps / BPS`, `require!(pull > 0)`, and burn + close only
when `pull == shares`; otherwise decrement `deed_position.shares`. Six lines.

### A3 — `fee_bps <= 10_000` admits a self-bricking pool

At `fee_bps == 10_000`: `in_with_fee = in_amt · (10_000 − 10_000) / 10_000 = 0`,
so `out_amt = 0` and every swap reverts `InsufficientOutput`. The pool is
permanently unswappable, and the plan copies Arc's "register once, no update
path" (`PoolExists` → Anchor `init`), so there is no remedy.

**Fix.** `pub const MAX_FEE_BPS: u16 = 1_000;` (10%) and
`require!(fee_bps <= MAX_FEE_BPS, FeeExceedsMaximum)`. A 100%-fee pool is not a
configuration anyone wants; a >10% one is not either.

### A4 — No pause on swap / add_liquidity, and `ProgramConfig` cannot grow

Arc gates `seedLiquidity` and `swap` with `whenNotPaused` under `PAUSER_ROLE`.
The plan preserves only the second half of that design ("withdrawals are never
paused") and drops the first. `swap_esms` mints ESMS on user-chosen direction —
it is the instruction most likely to need an emergency stop.

The obvious fix is a `pause_swaps` flag on `ProgramConfig`. **It will not work.**
`ProgramConfig` is `#[derive(InitSpace)]` and is live on devnet (Phase 4 records
the four ESMS mint PDAs as deployed and non-reinitializable). Its allocation is
`8 + 1 + 32·4 + 1 + 1 + 1 = 140` bytes. Adding one `bool` needs 141, and
`Account<ProgramConfig>` deserialisation would then fail against the existing
account — bricking `claim_mint_esms`, `redeem_esms`, and `claim_star_yield`
along with it, on a program with no realloc path.

**Fix.** Put `paused: bool` on `ConstellationPool` and gate it with the existing
`config.can_pause(&authority)`. Add `set_pool_pause(pool_id, paused)`. This is
strictly better than the EVM's global flag — one bad pool can be halted without
freezing the other five — and costs no migration. `withdraw_liquidity` ignores
the flag, unchanged.

### A5 — Zero events (S5, again — and worse here)

Arc emits `PoolRegistered`, `PoolSeeded`, `Swapped`, `LiquidityWithdrawn`. The
plan emits nothing, and `grep -rn '#\[event\]\|emit!' programs/asol_program/src`
returns nothing today. That is Phase 5 finding **S5**, accepted and not fixed.

It is materially worse in Phase 6. A swap burns from one ESMS mint and mints
from another **in the same transaction**. The Pentacles feeder's documented
fallback for ASOL is raw token-balance deltas "because ASOL owns ESMS issuance,
and Pentacles has no IDL for its events" — so a swap arrives as two unexplained
opposing balance mutations with no pool id, no direction, no fee, and no way to
distinguish it from a claim and a redemption that happened to land together.

**Fix.** `#[event] PoolRegistered / PoolBootstrapped / LiquidityAdded / Swapped
/ LiquidityWithdrawn`, carrying `pool_id`, trader, amounts, `shares`,
`deed_mint`, and post-swap `reserve_a`/`reserve_b`. Pin the 8-byte
discriminators in a Rust test **and** in the vitest spec so a field rename
cannot silently break ingestion.

---

## B · High

### B1 — The test plan reproduces S10 verbatim

Phase 5's review, on `star-vault.spec.ts`:

> The whole suite is a TypeScript re-implementation checked against itself. It
> cannot fail for any reason the program would fail for.

The Phase 6 plan proposes the identical shape: pure math in
`lib/solana/constellation-amm.ts`, mirrored assertions in a vitest spec,
`tweetnacl` signing verified in isolation. Walk the plan's own test list against
the findings above — **not one of them can catch A1, A2, A3, A4, or A5.** Nor the
CPI burn/mint authority wiring, nor the Ed25519 adjacency requirement, nor a PDA
constraint that does not compile the way it reads.

`bun run test:solana` today is `vitest run <pure specs> && cargo test --lib`.
Neither half executes the program.

**Fix.** Add a runtime lane — `litesvm` in Rust, or drive the existing
`test:solana:devnet` script — covering at minimum:

1. swap with a substituted output mint → fails
2. swap with the Ed25519 instruction at `index − 2` → fails
3. swap where `in_element` is not in the pool's pair → fails
4. withdraw by a wallet that does not hold the Deed → fails
5. withdraw a Deed against a different pool's `ConstellationPool` → fails
6. `bootstrap_pool` twice → fails
7. add → immediate full withdraw → returns ≤ deposited, both elements

### B2 — The SDK ships no instruction builders (S10, again)

The plan's `lib/solana/constellation-amm.ts` is PDA derivation + pure math + a
message builder. That is byte-for-byte the shape the Phase 5 review summarised
as _"There is no client."_

`swap_esms`'s entire security rests on an `Ed25519Program` instruction sitting at
exactly `index − 1`. If nothing in the repo ever _builds_ that pair, the
invariant is asserted only in prose.

**Fix.** `buildRegisterPoolInstruction`, `buildBootstrapPoolInstruction`,
`buildAddLiquidityTransaction`, `buildSwapEsmsTransaction` (emitting the ed25519

- swap adjacent pair), `buildWithdrawLiquidityInstruction`. These are also what
  B1's runtime tests drive, so B1 and B2 are one piece of work.

### B3 — No attestation-issuing route: the program ships dark

The EVM path has [`app/api/staking/pool-attestation/route.ts`](../app/api/staking/pool-attestation/route.ts),
which computes horizon visibility from `eclipticToHorizontal` and returns a
signed `VisibilityAttestation`. Nothing in the plan signs `ASOL_AMM_VISIBILITY_V1`.
Without it, `swap_esms` and `add_liquidity` are unreachable from the app on day
one — deployed and uncallable.

**Fix.** `app/api/solana/amm-attestation/route.ts`, reusing
`lib/staking/aspects.ts` + `lib/staking/astro.ts` for the sky gate and the
existing attestor key, but signing the Ed25519 **byte message** rather than an
EIP-712 digest. It must read the trader's current `PoolTraderNonce` from chain
(the EVM route reads `usedNonce` for exactly this reason).

### B4 — The attestation drops `regionCommit` and `visibleStars`

Arc's typehash binds `(trader, constellationId, regionCommit, visibleStars,
nonce, deadline)`. The plan's message binds domain, trader, pool, nonce,
deadline. Dropping `regionCommit` and `visibleStars` removes _where the trader
was_ and _how much of the constellation was up_ — the attestation degenerates
into "the attestor said yes," which the nonce alone already conveys.

**Fix.** Keep both in the signed preimage (32 + 1 bytes) and put them in the
`Swapped` event, so the feeder can audit a swap against its own sky model.

### B5 — The message binds no operation discriminator

`add_liquidity` and `swap_esms` share one nonce space (`PoolTraderNonce`) and, as
specified, one message layout. An attestation the app issued for a liquidity add
is spendable on a swap. The nonce makes it one-or-the-other, not the-intended-one.

**Fix.** One `op` byte in the preimage (`0 = add_liquidity`, `1 = swap`),
checked against the instruction being executed.

### B6 — No cross-language hex vector for the new message (S9, again)

The plan's test list says "Ed25519 visibility attestation serialization" — which
is precisely what Phase 5 shipped and what S9 rejected:

> Neither pins a hex vector; neither compares against the other. [...] Swap
> `nonce` and `deadline` in one language. Both suites stay green.

`vectors.rs` already does this correctly for redeem
(`serializes_canonical_redeem_authorization_vector`).

**Fix.** Put `amm_visibility_authorization_message` in `vectors.rs`, pin the full
hex string in a Rust test, assert the byte-identical hex in the vitest spec.

### B7 — The locked bootstrap is a permanent per-element mint allowance

The plan's User Review block frames the locked bootstrap purely as a safety win.
It has a second consequence that should be stated before an admin picks the
numbers.

Because the AMM burns input and mints output, and bootstrap reserves were never
backed by burned ESMS, a trader converts across the pair against depth nobody
paid for. Concretely, for a Spirit–Matter pool bootstrapped at (1M, 1M): burning
500k Spirit mints ≈332k Matter. Aggregate ESMS is not inflated (500k destroyed,
332k created) but **per-element supply is not conserved** — 332k Matter entered
circulation that no one earned.

Making the bootstrap permanent and unwithdrawable — the improvement — also makes
that allowance permanent. On Arc the admin could withdraw the virtual reserves
and shut it off; here nobody can. If the shop or redemption pricing treats the
four elements as independently scarce, `bootstrap_pool`'s arguments are a
per-element mint budget being set once, forever, by one transaction.

**Fix.** No code change required — state it in the User Review block, and
consider a `MAX_BOOTSTRAP_RESERVE` ceiling so the budget cannot be set by typo
(the same reasoning that produced `MAX_YIELD_RATE_PER_USDC_DAY` after S1).

---

## C · Medium

### C1 — `MINIMUM_LIQUIDITY` has nowhere to live in this design

Arc needs it because a _user_ can be the first depositor into an empty pool
(`_addReserves` branches on `totalShares == 0`). This design makes bootstrap
admin-only, one-shot, and locked, which subsumes the entire purpose. Listing the
constant invites a reader to re-introduce the empty-pool branch.

**Fix.** Either drop it, or repurpose it as the floor on bootstrap shares
(`require!(integer_sqrt(a·b) > MINIMUM_LIQUIDITY, InsufficientLiquidity)`) and
say so. Either way, `add_liquidity` and `swap_esms` must both hard-require
`pool.bootstrapped` so the `total_shares == 0` branch is unreachable by
construction. The plan lists `PoolNotBootstrapped` but never says who enforces it.

### C2 — Reserve ceiling and `u128` intermediates unstated

The roadmap's XML spec says "checked math with `u128` intermediates"; the plan's
prose dropped it. `reserve_out · in_with_fee` overflows `u64` at realistic
depths — this must be explicit, not inferred.

Separately: every other ESMS amount in this program is bounded by
`MAX_LEDGER_ATOMS = 999_999_999_999` (the `Decimal(12,4)` ledger domain), but
**reserves accumulate**. The check belongs on the post-state reserve, not just
the input: `require!(new_reserve <= MAX_LEDGER_ATOMS, AmountOutOfRange)`.

### C3 — Rounding direction unstated; the round-trip test is missing

Every division must floor _toward the pool_: `out_amt`, `shares`
(`lo = min(sA, sB)` already does), and both withdrawal legs. Rust's `/` on
unsigned floors, so this is free — but it must be an asserted invariant, not an
accident of the language.

The plan tests "k invariant minus fee," which is the swap half. The missing half
is where LP accounting bugs actually live: **add then immediately withdraw the
same position returns ≤ what was deposited, in both elements.** Add it, and
assert `k` is non-decreasing across any swap.

### C4 — Rent leak per position (S11, again), and Deed mints need a close authority

`DeedPosition` carries `active: bool` and the plan says "closes/deactivates."
Pick close. Phase 5's **S11** was the same finding on `StakePosition`.

The cost is higher here because it recurs per liquidity add: a Deed mint
(~0.0015 SOL) + a Deed ATA (~0.002 SOL) + a `DeedPosition` (~0.0012 SOL).

Note the mint specifically. Phase 4 already recorded this regret:

> Without a `CloseAuthority` extension, these cannot be closed or re-initialized

That was a one-time four-account mistake on the ESMS mints. Repeating it on a
mint created _on every liquidity add_ strands rent permanently and without
bound. **Initialize each Deed mint with the `CloseAuthority` extension set to the
program config PDA**, and on full withdrawal: burn the NFT, close the ATA, close
the mint, `close = owner` the position.

### C5 — Output ATA may not exist on a trader's first swap of a pair

`swap_esms` mints the output element to the trader. Phase 5's `ClaimStarYield`
requires a pre-existing `staker_element_ata` with `token::mint` / `token::authority`
constraints and no `init_if_needed` — defensible there, because the staker chose
the element. Here the output element is forced by the pool, so the first swap of
any pair fails for every trader who has never held that element.

**Fix.** `init_if_needed` with `associated_token::mint` / `::authority` /
`::token_program` constraints, payer = trader.

### C6 — `init` vs `init_if_needed` on the pool is unstated

Anchor `init` on `[b"constellation", pool_id]` is what reproduces Arc's
`PoolExists` revert. `init_if_needed` here would let an admin reset `reserve_a`,
`reserve_b`, and `total_shares` to zero **on a live pool with Deeds outstanding**
— instant total loss for every LP. The plan does not say which is used. Say
`init`, and say why.

### C7 — The pair is not canonicalised

Arc checks only `elemA != elemB`, so both `(Spirit, Matter)` and
`(Matter, Spirit)` are registrable as separate pools with independently drifting
prices. The existing TS client already assumes canonical ordering —
`constIdForPair` in [`lib/staking/amm.ts`](../lib/staking/amm.ts) sorts
`lo = min(a,b)`, `hi = max(a,b)` before its lookup.

**Fix.** `require!(element_a < element_b, InvalidPoolElements)`. Also bound
`pool_id`: six pools is `C(4,2)`, and `u16` admits 65,536.

### C8 — `add_liquidity` will exceed the default compute budget

One `add_liquidity` performs: 2 permissioned-burn CPIs, a system `create_account`
for the Deed mint, `initialize_mint2` + `CloseAuthority` init, ATA creation,
`mint_to`, and `DeedPosition` init. That will not fit in the 200k default.

`lib/solana/priority-fee.ts` already exists for this and carries a
`PROFILED_CU_LIMITS` map (`CLAIM_MINT_CU_LIMIT = 135_000`, etc.). Profile the new
instructions and add `ADD_LIQUIDITY_CU_LIMIT`, `SWAP_ESMS_CU_LIMIT`,
`WITHDRAW_LIQUIDITY_CU_LIMIT` — the builders in B2 must inject them.

---

## D · Low

**D1 — Third copy of the Ed25519 verifier.** `esms.rs` and `staking/mod.rs` each
carry a `verify_preceding_ed25519_instruction`; the staking one is private.
Extract to `instructions/ed25519.rs` and have all three call it.

**D2 — The new spec lands off the typechecked surface.** `tsconfig.json`
excludes `test` and `**/*.spec.ts`. Phase 5's **S8** found two real errors hidden
this way — one of which made a test assert `programId: undefined` and stay green
— and prescribed a `tsconfig.solana.json` covering `lib/solana/**` +
`test/solana/**`. `ls tsconfig*.json` shows it was never created. Create it now,
or Phase 6's spec inherits the same blind spot.

**D3 — Cleanups.** Seeds mix kebab (`star-vault`, `star-pool`) and snake
(`persona_commitment`, `claim_receipt`); use snake for the new three, and note
that seed strings are consensus-critical once devnet has pools. `version: u8` is
written everywhere and read nowhere — check it on load or drop it.
`created_slot` mirrors Arc's `mintedAtBlock`, which is unused there too; keep it
only if the `LiquidityAdded` event or the feeder consumes it.

**D4 — Verification plan is incomplete.** `cargo test -p asol_program --lib`
does not compile the BPF target or regenerate the IDL that the SDK and any
account-decoding test depend on. Add `bun run solana:build` and a typecheck pass
over the new TS.

---

## Suggested order

1. **A4, A3, C6, C7** — state shape and registration guards. Cheapest, and A4
   changes the account layout, so it must land before anything is deployed.
2. **A1** — write the full account/constraint table for all six instructions.
   This is the deliverable that was missing; everything else depends on it.
3. **A2, C1, C2, C3, C5** — instruction bodies and math invariants.
4. **B4, B5, B6, D1** — the attestation message: fields, op byte, shared
   verifier, hex vector in `vectors.rs`.
5. **A5** — events, with discriminators pinned in both languages.
6. **B2, C8** — SDK instruction builders with CU limits.
7. **B1** — the runtime test lane, driving the builders from step 6.
8. **C4** — rent reclamation and `CloseAuthority` on Deed mints.
9. **B3, D2** — attestation route, `tsconfig.solana.json`.
10. **B7, D3, D4** — docs, User Review block, cleanups, verification commands.

Steps 1–4 are the blocking set. Steps 6–7 are one piece of work and are what
convert this from Phase 5's shape into something that can fail for a reason the
program would fail for.

---

## Corrected plan — decisions resolved 2026-08-28

Four open questions were put to the owner and answered. The resolutions below
supersede the corresponding findings above.

| Question               | Resolution                                                                     |
| ---------------------- | ------------------------------------------------------------------------------ |
| Deed transferability   | **Neither** — drop the NFT. LP positions become owner-seeded PDAs (see below)  |
| Runtime test lane (B1) | **Both** — litesvm in CI, plus one devnet happy path before Phase 7            |
| ESMS supply guard (B7) | **None beyond pool depth** — correct the wording, keep `MAX_BOOTSTRAP_RESERVE` |
| Attestor key           | **One attestor, domain-separated** — verify against `ProgramConfig.attestor`   |

### D-1 · The Deed NFT is removed

The position is bound to its owner, so a Token-2022 mint + ATA is redundant
machinery around state that Solana's account model already scopes to a wallet. A
PDA seeded by the owner cannot be transferred, so the authorization check becomes
a seed derivation rather than a balance constraint.

This deletes, in full: the per-position Deed mint, its ATA, the `CloseAuthority`
extension, the mint/burn CPIs on the Deed, and finding **C4** (the rent leak it
was written against — one account at ~0.0012 SOL replaces three at ~0.0047 SOL).
It also removes `InvalidDeedMint` from the error set.

**Seed correction.** The proposed `seeds = [b"deed", owner.key().as_ref()]` gives
one position per wallet _globally_, so a user providing liquidity to
Spirit–Matter and Spirit–Essence collides on the same account. `pool_id` must be
in the seed, mirroring Phase 5's `StakePosition`
(`[STAKE_POSITION_SEED, &star_id.to_le_bytes(), staker.key().as_ref()]`):

```rust
seeds = [DEED_POSITION_SEED, &pool_id.to_le_bytes(), owner.key().as_ref()]
```

This yields **one position per (owner, pool)**. Repeat adds accumulate into it
rather than creating parallel positions — same semantics as `stake_star`, using
the same `version == 0` first-touch initialization under `init_if_needed`.

**What is given up.** Arc's `ConstellationDeed` is a transferable ERC-721 by
explicit design — _"deliberately the opposite of soulbound ESMS [...] the
tradable trophy that proves you traced a constellation."_ Three shipped docs
carry that story: `STAR_STAKING.md` ("the Deed NFT is the position"),
`SUBMISSION.md` ("LP-position NFT for zone pools"), and the roadmap's Phase 6
spec, which names the deliverable "Constellation Deeds" and requires a test for
"Deed NFT minting, **transferability**, and burn-on-withdrawal." Those need
updating alongside the code; Arc and Solana will no longer expose the same LP
product. If transferability is wanted later the migration is additive — a
`transfer_position` instruction requiring both parties to sign, or reintroducing
the mint — but the position accounts written before that point stay non-portable.

The name is kept (`DeedPosition`, `b"deed"`) so the Pentacles feeder and the
existing docs keep referring to one thing.

### Revised User Review Required

- **Locked bootstrap, and what it exposes.** One-time, admin-only, permanently
  locked shares. Closes Arc's repeatable-`seedInitial` hole. Because virtual
  reserves were never funded by burned ESMS, **aggregate ESMS is not conserved
  per swap** — an imbalanced pool mints more than it burns (reserves
  `(100 in, 10_000 out)`: burning 10 mints 909). It is conserved across closed
  round trips, where fees make it net-deflationary. Per-element minting is
  bounded by that element's reserve; the permanent unbacked component is capped
  at `MAX_BOOTSTRAP_RESERVE = 100_000_0000` (100,000 ESMS). No further guard.
- **Per-pool pause.** `ProgramConfig` is live on devnet at exactly
  `8 + INIT_SPACE = 140` bytes with no slack, so it cannot grow a flag without
  EOF-ing borsh on the existing account. `ConstellationPool.paused`, gated by
  `config.can_pause`.
- **LP positions are owner-seeded PDAs, not NFTs.** Non-transferable by
  construction. Withdrawals need no attestation, are never paused, and accept
  `share_bps: u16` (`1..=10_000`); the account closes with rent to the owner when
  `shares` reaches zero.
- **One attestor, two domains.** AMM attestations verify against
  `ProgramConfig.attestor` — necessarily the same key that signs
  `ASOL_STAR_YIELD_V1`, since the account has one attestor field and cannot grow
  a second. `ASOL_AMM_VISIBILITY_V1` domain separation keeps the messages
  unforgeable across surfaces; rotation goes through the existing
  `set_service_authorities`. **The Arc attestor key cannot be reused**: it is
  secp256k1 signing EIP-712, and this path needs the Ed25519 keypair
  `config.attestor` already names.
- **Canonical pairs and fee ceiling.** `element_a < element_b <= 3`,
  `pool_id <= 5`, `fee_bps <= MAX_FEE_BPS = 1_000`.

### Revised state

**`state/amm.rs`** — `ConstellationPool` unchanged from the plan
(`version, pool_id, element_a, element_b, fee_bps, reserve_a, reserve_b,
total_shares, bootstrapped, paused, bump`), seeds
`[b"constellation_pool", pool_id.to_le_bytes()]`. `PoolTraderNonce` unchanged.
Math unchanged: `u128` intermediates, flooring toward the pool, `checked_*` at
the `u64` boundary.

**`state/deed.rs`** — `DeedPosition`, seeds
`[b"deed", pool_id.to_le_bytes(), owner]`: `version: u8`, `pool_id: u16`,
`owner: Pubkey`, `shares: u64`, `created_slot: u64`, `bump: u8`. `owner` is
redundant with the seed but kept for events and indexing, as `StakePosition`
keeps `staker`.

### Revised instructions

`register_pool`, `bootstrap_pool`, `set_pool_pause`, and `swap_esms` are
unchanged from the plan's constraint tables.

**`add_liquidity`** — drops `deed_mint: Signer`, `trader_deed_ata`, and the
`associated_token_program`. `deed_position` becomes:

```rust
#[account(
    init_if_needed,
    payer = trader,
    space = 8 + DeedPosition::INIT_SPACE,
    seeds = [DEED_POSITION_SEED, &pool_id.to_le_bytes(), trader.key().as_ref()],
    bump
)]
pub deed_position: Account<'info, DeedPosition>,
```

On `version == 0`, initialize; otherwise accumulate `shares`. Everything else —
attestation with `op = 0`, seed-bound `mint_a`/`mint_b`, permissioned burn on
both legs with the trader signing, 1% ratio tolerance, `min_shares`, post-state
reserve ceiling — is unchanged.

**`withdraw_liquidity`** — drops `deed_mint`, `owner_deed_ata`, and the Deed burn
/ mint-close / ATA-close CPIs. Authorization is the seed itself; the explicit
`deed_position.owner == owner.key()` constraint is kept as defence in depth
alongside `deed_position.pool_id == pool.pool_id`. `share_bps` decrements
`shares`; `close = owner` fires when it reaches zero. Still no attestation, still
never paused.

**Events** — `LiquidityAdded` and `LiquidityWithdrawn` carry the `deed_position`
address in place of `deed_mint`.

### Revised client, route and tests

- **`lib/solana/priority-fee.ts`** — the NFT path is gone, so re-profile rather
  than carrying the plan's figures: `ADD_LIQUIDITY_CU_LIMIT` should land near
  120k (two permissioned burns + one account init), not 260k.
  `SWAP_ESMS_CU_LIMIT` ≈ 150k and `WITHDRAW_LIQUIDITY_CU_LIMIT` ≈ 110k. Measure,
  don't guess.
- **`lib/solana/constellation-amm.ts`** — `getDeedPositionAddress(poolId, owner)`
  replaces the mint-keyed derivation; `buildAddLiquidityTransaction` no longer
  generates or signs an ephemeral mint keypair. All six builders otherwise as
  planned, with `buildSwapEsmsTransaction` emitting the adjacent ed25519 + swap
  pair.
- **`app/api/solana/amm-attestation/route.ts`** — as planned; signs with the
  Ed25519 attestor keypair only, and reads the trader's `PoolTraderNonce` from
  chain.
- **`tsconfig.solana.json`** and **`typecheck:solana`** — as planned (D2).
- **`test/solana/constellation-amm.spec.ts`** — drop the NFT lifecycle and
  transferability cases. Add: one position per `(owner, pool)`; a repeat add
  accumulates rather than colliding; positions in two different pools for one
  owner derive to distinct PDAs; full withdrawal closes and refunds.
- **litesvm lane** (Rust, CI gate) — substituted output mint fails; ed25519 at
  `index − 2` fails; `in_element` outside the pair fails; withdraw by a
  non-owner fails; a position from pool 0 against pool 1 fails; second
  `bootstrap_pool` fails; add → immediate full withdraw returns ≤ deposited in
  both elements.
- **devnet lane** (`test:solana:devnet`, pre-Phase-7) — one end-to-end happy
  path driving the real SDK builders against the live Token-2022 program:
  register → bootstrap → add → swap → partial withdraw → full withdraw.

### Verification

```bash
RUSTUP_TOOLCHAIN=1.79.0 cargo test -p asol_program --lib   # unit, vectors, litesvm
bun run solana:build                                        # BPF + IDL
bunx tsc --noEmit -p tsconfig.solana.json                   # new TS surface
bun run test:solana:unit                                    # pure math + hex vectors
bun run test:solana:devnet                                  # end-to-end, pre-Phase-7
```

### Follow-on doc updates

`STAR_STAKING.md`, `SUBMISSION.md`, `WEB3_STATUS.md`, and the Phase 6 spec in
`SOLANA_MAINNET_MIGRATION_ROADMAP.md` all describe the LP position as a
transferable NFT. They need to state that the Solana port diverges, and why.
