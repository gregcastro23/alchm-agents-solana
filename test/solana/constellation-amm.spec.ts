/**
 * Constellation AMM client suite.
 *
 * Two of these classes of assertion are load-bearing in a way a pure-TypeScript
 * suite normally is not, because they check the client against artefacts generated
 * from the Rust program rather than against itself (Phase 5 finding **S10**):
 *
 *  - the attestation preimage is asserted against the **same pinned hex vector** as
 *    `programs/asol_program/src/vectors.rs`;
 *  - every instruction's discriminator and account order is asserted against the
 *    **generated IDL**, so an account inserted, removed, or reordered in the Rust
 *    `#[derive(Accounts)]` struct fails here rather than at runtime on devnet.
 *
 * Everything else -- the math mirror, the PDA derivations -- is a re-implementation
 * checked against itself, and is necessary but not sufficient. The behaviour those
 * cover is proven by the litesvm suite in
 * `programs/asol_program/src/instructions/amm/runtime_tests.rs`.
 */

import { describe, expect, it } from 'vitest'
import { Keypair, PublicKey, SystemProgram, SYSVAR_INSTRUCTIONS_PUBKEY } from '@solana/web3.js'
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token'

import IDL from '@/lib/solana/idl/asol_program.json'
import {
  ADMIN_CU_LIMITS,
  AMM_OP_ADD_LIQUIDITY,
  AMM_OP_SWAP,
  AMM_VISIBILITY_MESSAGE_BYTES,
  ASOL_SOLANA_PROGRAM_ID,
  BPS_DENOMINATOR,
  CONSTELLATION_PAIRS,
  MAX_AMM_POOL_ID,
  MAX_BOOTSTRAP_RESERVE,
  MAX_FEE_BPS,
  MINIMUM_LIQUIDITY,
  OffRatioDepositError,
  TOKEN_2022_PROGRAM_ID,
  anchorAccountDiscriminator,
  anchorDiscriminator,
  buildAddLiquidityInstruction,
  buildAddLiquidityTransaction,
  buildAmmVisibilityAuthorizationMessage,
  buildBootstrapPoolInstruction,
  buildEd25519AttestationInstruction,
  buildRegisterPoolInstruction,
  buildSetPoolPauseInstruction,
  buildSwapEsmsInstruction,
  buildSwapEsmsTransaction,
  buildWithdrawLiquidityInstruction,
  calculateAddLiquidityShares,
  calculateWithdrawalAmounts,
  decodeConstellationPool,
  decodeDeedPosition,
  getConstellationPoolAddress,
  getDeedPositionAddress,
  getEsmsMintAddress,
  getPoolTraderNonceAddress,
  getProgramConfigAddress,
  integerSqrt,
  poolIdForPair,
  quoteAmmSwap,
  type EsmsElementId,
} from '@/lib/solana/constellation-amm'
import { buildAmmVisibilityAuthorizationVector } from '@/lib/solana/vectors'
import {
  ADD_LIQUIDITY_CU_LIMIT,
  SWAP_ESMS_CU_LIMIT,
  WITHDRAW_LIQUIDITY_CU_LIMIT,
} from '@/lib/solana/priority-fee'

// The instruction that `programs/asol_program/src/vectors.rs`
// `serializes_canonical_amm_visibility_authorization_vector` pins.
const RUST_VECTOR_INPUTS = {
  programId: new Uint8Array(32).fill(1),
  clusterDomain: new Uint8Array(32).fill(2),
  trader: new Uint8Array(32).fill(3),
  poolId: 3,
  op: AMM_OP_SWAP,
  regionCommit: new Uint8Array(32).fill(5),
  visibleStars: 7,
  nonce: 42n,
  deadline: 1_900_000_000n,
} as const

const RUST_VECTOR_HEX =
  '41534f4c5f414d4d5f5649534942494c4954595f5631' + // b"ASOL_AMM_VISIBILITY_V1"
  '01'.repeat(32) + // program_id
  '02'.repeat(32) + // cluster_domain
  '03'.repeat(32) + // trader
  '0300' + // pool_id = 3, u16 LE
  '01' + // op = swap
  '05'.repeat(32) + // region_commit
  '07' + // visible_stars
  '2a00000000000000' + // nonce = 42, u64 LE
  '00b33f7100000000' // deadline = 1_900_000_000, i64 LE

const CONNECTION = {
  getRecentPrioritizationFees: async () => [{ prioritizationFee: 12_345, slot: 1 }],
}

function idlInstruction(name: string) {
  const found = IDL.instructions.find(instruction => instruction.name === name)
  if (!found) throw new Error(`${name} is missing from the generated IDL`)
  return found
}

describe('attestation preimage', () => {
  it('is byte-identical to the pinned Rust vector', () => {
    const vector = buildAmmVisibilityAuthorizationVector(RUST_VECTOR_INPUTS)
    expect(vector.length).toBe(AMM_VISIBILITY_MESSAGE_BYTES)
    expect(vector.toString('hex')).toBe(RUST_VECTOR_HEX)
  })

  it('is 170 bytes, and every field lands at its documented offset', () => {
    const vector = buildAmmVisibilityAuthorizationVector(RUST_VECTOR_INPUTS)
    expect(vector.length).toBe(170)
    expect(vector.subarray(0, 22).toString('utf8')).toBe('ASOL_AMM_VISIBILITY_V1')
    expect([...vector.subarray(22, 54)]).toEqual([...RUST_VECTOR_INPUTS.programId])
    expect([...vector.subarray(54, 86)]).toEqual([...RUST_VECTOR_INPUTS.clusterDomain])
    expect([...vector.subarray(86, 118)]).toEqual([...RUST_VECTOR_INPUTS.trader])
    expect(vector.readUInt16LE(118)).toBe(3)
    expect(vector.readUInt8(120)).toBe(AMM_OP_SWAP)
    expect([...vector.subarray(121, 153)]).toEqual([...RUST_VECTOR_INPUTS.regionCommit])
    expect(vector.readUInt8(153)).toBe(7)
    expect(vector.readBigUInt64LE(154)).toBe(42n)
    expect(vector.readBigInt64LE(162)).toBe(1_900_000_000n)
  })

  it('the typed wrapper produces the same bytes as the raw serialiser', () => {
    const typed = buildAmmVisibilityAuthorizationMessage({
      programId: new PublicKey(RUST_VECTOR_INPUTS.programId),
      clusterDomain: RUST_VECTOR_INPUTS.clusterDomain,
      trader: new PublicKey(RUST_VECTOR_INPUTS.trader),
      poolId: RUST_VECTOR_INPUTS.poolId,
      op: RUST_VECTOR_INPUTS.op,
      regionCommit: RUST_VECTOR_INPUTS.regionCommit,
      visibleStars: RUST_VECTOR_INPUTS.visibleStars,
      nonce: RUST_VECTOR_INPUTS.nonce,
      deadline: RUST_VECTOR_INPUTS.deadline,
    })
    expect(typed.toString('hex')).toBe(RUST_VECTOR_HEX)
  })

  it('binds the operation, so an add signature cannot be spent on a swap', () => {
    const add = buildAmmVisibilityAuthorizationVector({
      ...RUST_VECTOR_INPUTS,
      op: AMM_OP_ADD_LIQUIDITY,
    })
    const swap = buildAmmVisibilityAuthorizationVector(RUST_VECTOR_INPUTS)
    expect(add.toString('hex')).not.toBe(swap.toString('hex'))
    expect(add.readUInt8(120)).toBe(AMM_OP_ADD_LIQUIDITY)
  })

  it('binds the program and cluster, so a devnet signature is not a mainnet one', () => {
    const other = buildAmmVisibilityAuthorizationVector({
      ...RUST_VECTOR_INPUTS,
      clusterDomain: new Uint8Array(32).fill(9),
    })
    expect(other.toString('hex')).not.toBe(RUST_VECTOR_HEX)
  })

  it('rejects a short domain, a bad op, and an out-of-range visibleStars', () => {
    const base = {
      clusterDomain: new Uint8Array(32),
      trader: new PublicKey(RUST_VECTOR_INPUTS.trader),
      poolId: 0,
      op: AMM_OP_SWAP,
      regionCommit: new Uint8Array(32),
      visibleStars: 1,
      nonce: 0n,
      deadline: 0n,
    }
    expect(() =>
      buildAmmVisibilityAuthorizationMessage({ ...base, clusterDomain: new Uint8Array(31) })
    ).toThrow(/32 bytes/)
    expect(() => buildAmmVisibilityAuthorizationMessage({ ...base, op: 7 })).toThrow(/op must be/)
    expect(() => buildAmmVisibilityAuthorizationMessage({ ...base, visibleStars: 256 })).toThrow(
      /u8/
    )
  })
})

describe('instruction encoding against the generated IDL', () => {
  const admin = Keypair.generate().publicKey
  const trader = Keypair.generate().publicKey

  const cases: Array<{
    name: string
    instruction: () => { keys: Array<{ pubkey: PublicKey }>; data: Buffer }
  }> = [
    {
      name: 'register_pool',
      instruction: () =>
        buildRegisterPoolInstruction({ poolId: 0, elementA: 0, elementB: 1, feeBps: 30, admin }),
    },
    {
      name: 'bootstrap_pool',
      instruction: () =>
        buildBootstrapPoolInstruction({
          poolId: 0,
          reserveA: 1_000_000n,
          reserveB: 1_000_000n,
          admin,
        }),
    },
    {
      name: 'set_pool_pause',
      instruction: () =>
        buildSetPoolPauseInstruction({ poolId: 0, paused: true, authority: admin }),
    },
    {
      name: 'add_liquidity',
      instruction: () =>
        buildAddLiquidityInstruction({
          poolId: 0,
          elementA: 0,
          elementB: 1,
          amtA: 1_000n,
          amtB: 1_000n,
          minShares: 0n,
          trader,
          attestation: {
            attestor: admin,
            signature: new Uint8Array(64),
            regionCommit: new Uint8Array(32),
            visibleStars: 3,
            nonce: 0n,
            deadline: 0n,
            clusterDomain: new Uint8Array(32),
          },
        }),
    },
    {
      name: 'swap_esms',
      instruction: () =>
        buildSwapEsmsInstruction({
          poolId: 0,
          elementA: 0,
          elementB: 1,
          inElement: 0,
          inAmount: 1_000n,
          minOut: 0n,
          trader,
          attestation: {
            attestor: admin,
            signature: new Uint8Array(64),
            regionCommit: new Uint8Array(32),
            visibleStars: 3,
            nonce: 0n,
            deadline: 0n,
            clusterDomain: new Uint8Array(32),
          },
        }),
    },
    {
      name: 'withdraw_liquidity',
      instruction: () =>
        buildWithdrawLiquidityInstruction({
          poolId: 0,
          elementA: 0,
          elementB: 1,
          shareBps: 10_000,
          owner: trader,
        }),
    },
  ]

  it.each(cases)('$name discriminator matches the IDL', ({ name, instruction }) => {
    const expected = Buffer.from(idlInstruction(name).discriminator)
    expect(anchorDiscriminator(name).equals(expected)).toBe(true)
    expect(instruction().data.subarray(0, 8).equals(expected)).toBe(true)
  })

  // Resolves an IDL account name to the address the program will look for. An
  // account inserted, removed, or reordered in the Rust `#[derive(Accounts)]`
  // struct changes the IDL, and this table then disagrees with the SDK -- which is
  // the failure this suite exists to catch before devnet does.
  const ata = (owner: PublicKey, mint: PublicKey) =>
    getAssociatedTokenAddressSync(mint, owner, true, TOKEN_2022_PROGRAM_ID)
  const mintA = getEsmsMintAddress(0)
  const mintB = getEsmsMintAddress(1)
  const expectedAccount: Record<string, PublicKey> = {
    program_config: getProgramConfigAddress(),
    admin,
    authority: admin,
    pool: getConstellationPoolAddress(0),
    trader,
    owner: trader,
    nonce_account: getPoolTraderNonceAddress(0, trader),
    mint_a: mintA,
    mint_b: mintB,
    trader_mint_a_ata: ata(trader, mintA),
    trader_mint_b_ata: ata(trader, mintB),
    trader_in_ata: ata(trader, mintA),
    trader_out_ata: ata(trader, mintB),
    owner_mint_a_ata: ata(trader, mintA),
    owner_mint_b_ata: ata(trader, mintB),
    deed_position: getDeedPositionAddress(0, trader),
    instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
    token_2022_program: TOKEN_2022_PROGRAM_ID,
    associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
    system_program: SystemProgram.programId,
  }

  it.each(cases)(
    '$name passes exactly the accounts the IDL declares, in order',
    ({ name, instruction }) => {
      const declared = idlInstruction(name).accounts.map(account => account.name)
      const keys = instruction().keys
      expect(keys).toHaveLength(declared.length)
      declared.forEach((accountName, index) => {
        const expectedPubkey = expectedAccount[accountName]
        expect(expectedPubkey, `no expectation recorded for "${accountName}"`).toBeDefined()
        expect(
          keys[index].pubkey.toBase58(),
          `${name} account ${index} should be "${accountName}"`
        ).toBe(expectedPubkey.toBase58())
      })
    }
  )

  it('add_liquidity places every account at the index the program reads it from', () => {
    const declared = idlInstruction('add_liquidity').accounts.map(a => a.name)
    expect(declared).toEqual([
      'program_config',
      'pool',
      'trader',
      'nonce_account',
      'mint_a',
      'mint_b',
      'trader_mint_a_ata',
      'trader_mint_b_ata',
      'deed_position',
      'instructions',
      'token_2022_program',
      'system_program',
    ])
    const keys = cases.find(c => c.name === 'add_liquidity')!.instruction().keys
    expect(keys[0].pubkey.equals(getProgramConfigAddress())).toBe(true)
    expect(keys[1].pubkey.equals(getConstellationPoolAddress(0))).toBe(true)
    expect(keys[2].pubkey.equals(trader)).toBe(true)
    expect(keys[3].pubkey.equals(getPoolTraderNonceAddress(0, trader))).toBe(true)
    expect(keys[4].pubkey.equals(getEsmsMintAddress(0))).toBe(true)
    expect(keys[5].pubkey.equals(getEsmsMintAddress(1))).toBe(true)
    expect(keys[8].pubkey.equals(getDeedPositionAddress(0, trader))).toBe(true)
    expect(keys[9].pubkey.equals(SYSVAR_INSTRUCTIONS_PUBKEY)).toBe(true)
    expect(keys[10].pubkey.equals(TOKEN_2022_PROGRAM_ID)).toBe(true)
    expect(keys[11].pubkey.equals(SystemProgram.programId)).toBe(true)
  })

  it('swap_esms carries the associated-token program it needs to create the output ATA', () => {
    const keys = cases.find(c => c.name === 'swap_esms')!.instruction().keys
    expect(keys[10].pubkey.equals(ASSOCIATED_TOKEN_PROGRAM_ID)).toBe(true)
  })

  it('account discriminators match the IDL', () => {
    for (const name of ['ConstellationPool', 'DeedPosition', 'PoolTraderNonce']) {
      const declared = IDL.accounts.find(account => account.name === name)
      expect(declared, `${name} is missing from the IDL`).toBeDefined()
      expect(anchorAccountDiscriminator(name).equals(Buffer.from(declared!.discriminator))).toBe(
        true
      )
    }
  })

  it('publishes every AMM event the program emits', () => {
    const emitted = IDL.events.map(event => event.name)
    for (const name of [
      'PoolRegistered',
      'PoolBootstrapped',
      'PoolPauseToggled',
      'LiquidityAdded',
      'Swapped',
      'LiquidityWithdrawn',
    ]) {
      expect(emitted).toContain(name)
    }
  })
})

describe('client-side argument validation', () => {
  const admin = Keypair.generate().publicKey

  it('refuses a non-canonical element ordering', () => {
    expect(() =>
      buildRegisterPoolInstruction({ poolId: 0, elementA: 1, elementB: 0, feeBps: 30, admin })
    ).toThrow(/canonically ordered/)
    expect(() =>
      buildRegisterPoolInstruction({ poolId: 0, elementA: 2, elementB: 2, feeBps: 30, admin })
    ).toThrow(/canonically ordered/)
  })

  it('refuses a pool_id past the six canonical pairs', () => {
    expect(() =>
      buildRegisterPoolInstruction({
        poolId: MAX_AMM_POOL_ID + 1,
        elementA: 0,
        elementB: 1,
        feeBps: 30,
        admin,
      })
    ).toThrow(/poolId must be/)
  })

  it('refuses a fee above 10%, which would zero the input and brick every swap', () => {
    expect(() =>
      buildRegisterPoolInstruction({
        poolId: 0,
        elementA: 0,
        elementB: 1,
        feeBps: MAX_FEE_BPS + 1,
        admin,
      })
    ).toThrow(/feeBps must be/)
    expect(() =>
      buildRegisterPoolInstruction({
        poolId: 0,
        elementA: 0,
        elementB: 1,
        feeBps: MAX_FEE_BPS,
        admin,
      })
    ).not.toThrow()
  })

  it('refuses a bootstrap over the reserve ceiling or under the liquidity floor', () => {
    expect(() =>
      buildBootstrapPoolInstruction({
        poolId: 0,
        reserveA: MAX_BOOTSTRAP_RESERVE + 1n,
        reserveB: 1_000_000n,
        admin,
      })
    ).toThrow(/reserves must be/)
    expect(() =>
      buildBootstrapPoolInstruction({ poolId: 0, reserveA: 10n, reserveB: 10n, admin })
    ).toThrow(new RegExp(`${MINIMUM_LIQUIDITY}`))
  })

  it('refuses a swap on an element outside the pool pair', () => {
    expect(() =>
      buildSwapEsmsInstruction({
        poolId: 0,
        elementA: 0,
        elementB: 1,
        inElement: 2 as EsmsElementId,
        inAmount: 1n,
        minOut: 0n,
        trader: admin,
        attestation: {
          attestor: admin,
          signature: new Uint8Array(64),
          regionCommit: new Uint8Array(32),
          visibleStars: 1,
          nonce: 0n,
          deadline: 0n,
          clusterDomain: new Uint8Array(32),
        },
      })
    ).toThrow(/not in pool/)
  })

  it('refuses a shareBps outside 1..=10000', () => {
    for (const shareBps of [0, -1, BPS_DENOMINATOR + 1]) {
      expect(() =>
        buildWithdrawLiquidityInstruction({
          poolId: 0,
          elementA: 0,
          elementB: 1,
          shareBps,
          owner: admin,
        })
      ).toThrow(/shareBps must be/)
    }
  })

  it('refuses a signature that is not 64 bytes', () => {
    expect(() =>
      buildEd25519AttestationInstruction(
        { attestor: admin, signature: new Uint8Array(63) },
        Buffer.alloc(AMM_VISIBILITY_MESSAGE_BYTES)
      )
    ).toThrow(/64 bytes/)
  })
})

describe('transaction assembly', () => {
  const trader = Keypair.generate().publicKey
  const attestation = {
    attestor: Keypair.generate().publicKey,
    signature: new Uint8Array(64).fill(9),
    regionCommit: new Uint8Array(32).fill(4),
    visibleStars: 6,
    nonce: 11n,
    deadline: 1_900_000_000n,
    clusterDomain: new Uint8Array(32).fill(2),
  }

  it('places the Ed25519 instruction directly before the AMM instruction', async () => {
    const transaction = await buildAddLiquidityTransaction({
      connection: CONNECTION,
      poolId: 0,
      elementA: 0,
      elementB: 1,
      amtA: 1_000n,
      amtB: 1_000n,
      minShares: 0n,
      trader,
      attestation,
    })
    const instructions = transaction.instructions
    // [setComputeUnitLimit, setComputeUnitPrice, ed25519, add_liquidity]
    expect(instructions).toHaveLength(4)
    const ammIndex = instructions.length - 1
    expect(instructions[ammIndex].programId.equals(ASOL_SOLANA_PROGRAM_ID)).toBe(true)
    // The program reads the instructions sysvar at `current_index - 1`; anything
    // between these two makes every attested instruction fail.
    expect(instructions[ammIndex - 1].programId.toBase58()).toBe(
      'Ed25519SigVerify111111111111111111111111111'
    )
  })

  it('carries the exact message the attestor signed', async () => {
    const transaction = await buildSwapEsmsTransaction({
      connection: CONNECTION,
      poolId: 0,
      elementA: 0,
      elementB: 1,
      inElement: 0,
      inAmount: 5_000n,
      minOut: 0n,
      trader,
      attestation,
    })
    const ed25519 = transaction.instructions[transaction.instructions.length - 2]
    const expected = buildAmmVisibilityAuthorizationMessage({
      clusterDomain: attestation.clusterDomain,
      trader,
      poolId: 0,
      op: AMM_OP_SWAP,
      regionCommit: attestation.regionCommit,
      visibleStars: attestation.visibleStars,
      nonce: attestation.nonce,
      deadline: attestation.deadline,
    })
    // Canonical Ed25519 precompile layout: 16-byte header, pubkey at 16,
    // signature at 48, message at 112.
    expect(ed25519.data.subarray(112).equals(expected)).toBe(true)
    expect(ed25519.data.readUInt16LE(4)).toBe(0xffff) // signature_instruction_index
    expect(ed25519.data.readUInt16LE(8)).toBe(0xffff) // public_key_instruction_index
    expect(ed25519.data.readUInt16LE(14)).toBe(0xffff) // message_instruction_index
  })

  it('requests the measured compute-unit limits', async () => {
    const add = await buildAddLiquidityTransaction({
      connection: CONNECTION,
      poolId: 0,
      elementA: 0,
      elementB: 1,
      amtA: 1n,
      amtB: 1n,
      minShares: 0n,
      trader,
      attestation,
    })
    // ComputeBudgetInstruction::SetComputeUnitLimit is tag 0x02 + u32 LE units.
    expect(add.instructions[0].data.readUInt8(0)).toBe(2)
    expect(add.instructions[0].data.readUInt32LE(1)).toBe(ADD_LIQUIDITY_CU_LIMIT)

    const swap = await buildSwapEsmsTransaction({
      connection: CONNECTION,
      poolId: 0,
      elementA: 0,
      elementB: 1,
      inElement: 0,
      inAmount: 1n,
      minOut: 0n,
      trader,
      attestation,
    })
    expect(swap.instructions[0].data.readUInt32LE(1)).toBe(SWAP_ESMS_CU_LIMIT)
    expect(WITHDRAW_LIQUIDITY_CU_LIMIT).toBeGreaterThan(0)
    expect(Object.values(ADMIN_CU_LIMITS).every(limit => limit > 0)).toBe(true)
  })
})

describe('PDA derivation', () => {
  const owner = Keypair.generate().publicKey

  it('re-exports the program ID so a caller cannot pass undefined', () => {
    // Phase 5 finding S8: the star-vault client did not re-export it, and a test
    // silently passed `programId: undefined`.
    expect(ASOL_SOLANA_PROGRAM_ID.toBase58()).toBe('5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD')
    expect(ASOL_SOLANA_PROGRAM_ID.toBase58()).toBe(IDL.address)
  })

  it('derives one position per (owner, pool)', () => {
    const first = getDeedPositionAddress(0, owner)
    const again = getDeedPositionAddress(0, owner)
    expect(first.equals(again)).toBe(true)
  })

  it('derives distinct positions for the same owner across pools', () => {
    const addresses = CONSTELLATION_PAIRS.map((_, poolId) =>
      getDeedPositionAddress(poolId, owner).toBase58()
    )
    expect(new Set(addresses).size).toBe(CONSTELLATION_PAIRS.length)
  })

  it('derives distinct positions for different owners in the same pool', () => {
    const other = Keypair.generate().publicKey
    expect(getDeedPositionAddress(0, owner).equals(getDeedPositionAddress(0, other))).toBe(false)
  })

  it('derives distinct nonce accounts per (trader, pool)', () => {
    const addresses = CONSTELLATION_PAIRS.map((_, poolId) =>
      getPoolTraderNonceAddress(poolId, owner).toBase58()
    )
    expect(new Set(addresses).size).toBe(CONSTELLATION_PAIRS.length)
  })

  it('rejects a poolId that does not fit a u16 seed', () => {
    expect(() => getConstellationPoolAddress(-1)).toThrow(/u16/)
    expect(() => getConstellationPoolAddress(70_000)).toThrow(/u16/)
  })

  it('maps unordered element pairs onto the six canonical pool ids', () => {
    expect(poolIdForPair(0, 1)).toBe(0)
    expect(poolIdForPair(1, 0)).toBe(0) // order-insensitive
    expect(poolIdForPair(2, 3)).toBe(5)
    expect(poolIdForPair(1, 1)).toBe(-1)
    expect(new Set(CONSTELLATION_PAIRS.map(([a, b]) => poolIdForPair(a, b))).size).toBe(6)
  })
})

describe('constant-product math', () => {
  it('mirrors the Rust quote exactly on the pinned case', () => {
    // `state::amm::tests::test_quote_swap_math`
    expect(
      quoteAmmSwap({
        reserveIn: 1_000_000n,
        reserveOut: 1_000_000n,
        feeBps: 30,
        inAmount: 100_000n,
      })
    ).toBe(90_661n)
  })

  it('never decreases k across a swap', () => {
    let reserveIn = 1_000_000n
    let reserveOut = 1_000_000n
    let k = reserveIn * reserveOut
    for (const inAmount of [1_000n, 25_000n, 100_000n, 7n, 250_000n]) {
      const out = quoteAmmSwap({ reserveIn, reserveOut, feeBps: 30, inAmount })
      expect(out).toBeLessThan(reserveOut)
      reserveIn += inAmount
      reserveOut -= out
      const next = reserveIn * reserveOut
      expect(next).toBeGreaterThanOrEqual(k)
      k = next
    }
  })

  it('quotes zero on an empty side or a zero input', () => {
    expect(quoteAmmSwap({ reserveIn: 0n, reserveOut: 1n, feeBps: 30, inAmount: 1n })).toBe(0n)
    expect(quoteAmmSwap({ reserveIn: 1n, reserveOut: 0n, feeBps: 30, inAmount: 1n })).toBe(0n)
    expect(quoteAmmSwap({ reserveIn: 1n, reserveOut: 1n, feeBps: 30, inAmount: 0n })).toBe(0n)
  })

  it('returns nothing at a 100% fee, which is why MAX_FEE_BPS is 1000', () => {
    expect(
      quoteAmmSwap({
        reserveIn: 1_000_000n,
        reserveOut: 1_000_000n,
        feeBps: BPS_DENOMINATOR,
        inAmount: 100_000n,
      })
    ).toBe(0n)
  })

  it('floors toward the pool', () => {
    // 3 * (7 * 9970 / 10000 = 6) / (1000 + 6) = 18/1006 = 0
    expect(quoteAmmSwap({ reserveIn: 1_000n, reserveOut: 3n, feeBps: 30, inAmount: 7n })).toBe(0n)
  })

  it('matches the Rust integer_sqrt', () => {
    expect(integerSqrt(0n)).toBe(0n)
    expect(integerSqrt(1n)).toBe(1n)
    expect(integerSqrt(3n)).toBe(1n)
    expect(integerSqrt(4n)).toBe(2n)
    expect(integerSqrt(1_000_000_000_000n)).toBe(1_000_000n)
    expect(integerSqrt(10_000n)).toBe(100n)
  })
})

describe('liquidity accounting', () => {
  const pool = { reserveA: 1_000_000n, reserveB: 2_000_000n, totalShares: 1_414_213n }

  it('mints the lower of the two per-side share counts', () => {
    expect(calculateAddLiquidityShares({ ...pool, amtA: 100_000n, amtB: 200_000n })).toBe(141_421n)
  })

  it('accepts a deposit inside the 1% ratio tolerance', () => {
    expect(calculateAddLiquidityShares({ ...pool, amtA: 100_000n, amtB: 201_000n })).toBe(141_421n)
  })

  it('rejects a deposit outside it', () => {
    expect(() => calculateAddLiquidityShares({ ...pool, amtA: 100_000n, amtB: 205_000n })).toThrow(
      OffRatioDepositError
    )
  })

  it('rejects a deposit against a pool that was never bootstrapped', () => {
    expect(() =>
      calculateAddLiquidityShares({
        reserveA: 0n,
        reserveB: 0n,
        totalShares: 0n,
        amtA: 1n,
        amtB: 1n,
      })
    ).toThrow(/bootstrapped/)
  })

  it('returns no more than was deposited on an immediate full round trip', () => {
    const reserveA = 1_000_000n
    const reserveB = 1_000_000n
    const totalShares = 1_000_000n
    const deposit = 50_000n

    const minted = calculateAddLiquidityShares({
      reserveA,
      reserveB,
      totalShares,
      amtA: deposit,
      amtB: deposit,
    })
    const withdrawal = calculateWithdrawalAmounts({
      reserveA: reserveA + deposit,
      reserveB: reserveB + deposit,
      totalShares: totalShares + minted,
      shares: minted,
      shareBps: 10_000,
    })
    expect(withdrawal.amtA).toBeLessThanOrEqual(deposit)
    expect(withdrawal.amtB).toBeLessThanOrEqual(deposit)
    expect(withdrawal.pullShares).toBe(minted)
    expect(withdrawal.remainingShares).toBe(0n)
    expect(withdrawal.closesPosition).toBe(true)
  })

  it('halves a position at 5000 bps and leaves it open', () => {
    const withdrawal = calculateWithdrawalAmounts({
      reserveA: 1_050_000n,
      reserveB: 1_050_000n,
      totalShares: 1_050_000n,
      shares: 50_000n,
      shareBps: 5_000,
    })
    expect(withdrawal.pullShares).toBe(25_000n)
    expect(withdrawal.remainingShares).toBe(25_000n)
    expect(withdrawal.closesPosition).toBe(false)
    expect(withdrawal.amtA).toBe(25_000n)
  })

  it('never returns more than the position is worth across a partial sequence', () => {
    let reserveA = 1_050_000n
    let reserveB = 1_050_000n
    let totalShares = 1_050_000n
    let shares = 50_000n
    let returnedA = 0n

    for (const shareBps of [5_000, 5_000, 10_000]) {
      const step = calculateWithdrawalAmounts({ reserveA, reserveB, totalShares, shares, shareBps })
      returnedA += step.amtA
      reserveA -= step.amtA
      reserveB -= step.amtB
      totalShares -= step.pullShares
      shares = step.remainingShares
    }
    expect(shares).toBe(0n)
    expect(returnedA).toBeLessThanOrEqual(50_000n)
    // Only the permanently locked bootstrap shares are left.
    expect(totalShares).toBe(1_000_000n)
  })

  it('rejects a shareBps that rounds to zero shares', () => {
    expect(() =>
      calculateWithdrawalAmounts({
        reserveA: 1_000n,
        reserveB: 1_000n,
        totalShares: 1_000n,
        shares: 1n,
        shareBps: 1,
      })
    ).toThrow(/rounds to zero/)
  })
})

describe('account decoding', () => {
  it('round-trips a ConstellationPool laid out as the program writes it', () => {
    const body = Buffer.alloc(34)
    body.writeUInt8(1, 0) // version
    body.writeUInt16LE(4, 1) // pool_id
    body.writeUInt8(1, 3) // element_a
    body.writeUInt8(3, 4) // element_b
    body.writeUInt16LE(30, 5) // fee_bps
    body.writeBigUInt64LE(1_000_000n, 7)
    body.writeBigUInt64LE(2_000_000n, 15)
    body.writeBigUInt64LE(1_414_213n, 23)
    body.writeUInt8(1, 31) // bootstrapped
    body.writeUInt8(0, 32) // paused
    body.writeUInt8(254, 33) // bump

    const decoded = decodeConstellationPool(
      Buffer.concat([anchorAccountDiscriminator('ConstellationPool'), body])
    )
    expect(decoded).toEqual({
      version: 1,
      poolId: 4,
      elementA: 1,
      elementB: 3,
      feeBps: 30,
      reserveA: 1_000_000n,
      reserveB: 2_000_000n,
      totalShares: 1_414_213n,
      bootstrapped: true,
      paused: false,
      bump: 254,
    })
  })

  it('round-trips a DeedPosition', () => {
    const owner = Keypair.generate().publicKey
    const body = Buffer.alloc(52)
    body.writeUInt8(1, 0)
    body.writeUInt16LE(2, 1)
    owner.toBuffer().copy(body, 3)
    body.writeBigUInt64LE(777n, 35)
    body.writeBigUInt64LE(123_456n, 43)
    body.writeUInt8(253, 51)

    const decoded = decodeDeedPosition(
      Buffer.concat([anchorAccountDiscriminator('DeedPosition'), body])
    )
    expect(decoded.poolId).toBe(2)
    expect(decoded.owner.equals(owner)).toBe(true)
    expect(decoded.shares).toBe(777n)
    expect(decoded.createdSlot).toBe(123_456n)
    expect(decoded.bump).toBe(253)
  })

  it('refuses to decode an account of the wrong type', () => {
    const wrong = Buffer.concat([anchorAccountDiscriminator('ProgramConfig'), Buffer.alloc(64)])
    expect(() => decodeConstellationPool(wrong)).toThrow(/not a ConstellationPool/)
    expect(() => decodeDeedPosition(wrong)).toThrow(/not a DeedPosition/)
  })
})
