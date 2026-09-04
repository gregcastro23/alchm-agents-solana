import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js'
import { ASOL_SOLANA_PROGRAM_ID, getProgramConfigAddress } from '@/lib/solana/esms'

export const SQUADS_V4_PROGRAM_ID = new PublicKey('SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf')

export const BPF_LOADER_UPGRADEABLE_PROGRAM_ID = new PublicKey(
  'BPFLoaderUpgradeab1e11111111111111111111111'
)

import {
  getMultisigPda as sqdsGetMultisigPda,
  getVaultPda as sqdsGetVaultPda,
  getProposalPda as sqdsGetProposalPda,
  getTransactionPda as sqdsGetTransactionPda,
} from '@sqds/multisig'

/** Derive Squads v4 Multisig PDA from create key. */
export function getSquadsMultisigPda(
  createKey: PublicKey,
  programId = SQUADS_V4_PROGRAM_ID
): [PublicKey, number] {
  return sqdsGetMultisigPda({ createKey, programId })
}

/** Derive Squads v4 Vault PDA for a given multisig and vault index (default 1). */
export function getSquadsVaultPda(
  multisigPda: PublicKey,
  vaultIndex = 1,
  programId = SQUADS_V4_PROGRAM_ID
): [PublicKey, number] {
  return sqdsGetVaultPda({ multisigPda, index: vaultIndex, programId })
}

/** Derive Squads v4 Proposal PDA for a given transaction index. */
export function getSquadsProposalPda(
  multisigPda: PublicKey,
  transactionIndex: bigint | number,
  programId = SQUADS_V4_PROGRAM_ID
): [PublicKey, number] {
  return sqdsGetProposalPda({
    multisigPda,
    transactionIndex: BigInt(transactionIndex),
    programId,
  })
}

/** Derive Squads v4 Transaction PDA for a given transaction index. */
export function getSquadsTransactionPda(
  multisigPda: PublicKey,
  transactionIndex: bigint | number,
  programId = SQUADS_V4_PROGRAM_ID
): [PublicKey, number] {
  return sqdsGetTransactionPda({
    multisigPda,
    index: BigInt(transactionIndex),
    programId,
  })
}

/** Derive BPF Loader Upgradeable ProgramData address for a program ID. */
export function getProgramDataAddress(
  programId = ASOL_SOLANA_PROGRAM_ID,
  bpfLoaderProgramId = BPF_LOADER_UPGRADEABLE_PROGRAM_ID
): PublicKey {
  return PublicKey.findProgramAddressSync([programId.toBuffer()], bpfLoaderProgramId)[0]
}

/**
 * Build BPF Loader Upgradeable `SetUpgradeAuthority` instruction.
 * Transferred program upgrade authority to Squads Vault.
 */
export function buildSetProgramUpgradeAuthorityInstruction(args: {
  programId?: PublicKey
  currentAuthority: PublicKey
  newAuthority: PublicKey
}): TransactionInstruction {
  const programId = args.programId ?? ASOL_SOLANA_PROGRAM_ID
  const programDataAddress = getProgramDataAddress(programId)

  // BPF Loader Upgradeable SetUpgradeAuthority instruction index: 4 (u32 LE)
  const data = Buffer.alloc(4)
  data.writeUInt32LE(4, 0)

  return new TransactionInstruction({
    programId: BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
    keys: [
      { pubkey: programDataAddress, isSigner: false, isWritable: true },
      { pubkey: args.currentAuthority, isSigner: true, isWritable: false },
      { pubkey: args.newAuthority, isSigner: false, isWritable: false },
    ],
    data,
  })
}

/**
 * Build `asol_program.set_service_authorities` instruction.
 * Sets `attestor` and `pauser` to the Squads Vault or designated addresses.
 */
export function buildSetServiceAuthoritiesInstruction(args: {
  programId?: PublicKey
  adminAuthority: PublicKey
  attestor: PublicKey
  pauser: PublicKey
}): TransactionInstruction {
  const programId = args.programId ?? ASOL_SOLANA_PROGRAM_ID
  const programConfigPda = getProgramConfigAddress(programId)

  // Anchor instruction discriminator for set_service_authorities: [42, 156, 68, 130, 225, 158, 43, 33]
  const discriminator = Buffer.from([42, 156, 68, 130, 225, 158, 43, 33])
  const data = Buffer.concat([discriminator, args.attestor.toBuffer(), args.pauser.toBuffer()])

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: programConfigPda, isSigner: false, isWritable: true },
      { pubkey: args.adminAuthority, isSigner: true, isWritable: false },
    ],
    data,
  })
}

/** Derive PendingAdmin PDA for two-step admin transfers. */
export function getPendingAdminAddress(programId = ASOL_SOLANA_PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('pending_admin')], programId)[0]
}

/**
 * Build `asol_program.propose_admin` instruction.
 * Initiates the two-step admin handover to a new admin (e.g., Squads Vault).
 */
export function buildProposeAdminInstruction(args: {
  programId?: PublicKey
  currentAdmin: PublicKey
  newAdmin: PublicKey
}): TransactionInstruction {
  const programId = args.programId ?? ASOL_SOLANA_PROGRAM_ID
  const programConfigPda = getProgramConfigAddress(programId)
  const pendingAdminPda = getPendingAdminAddress(programId)

  // Anchor instruction discriminator for propose_admin: [121, 214, 199, 212, 87, 39, 117, 234]
  const discriminator = Buffer.from([121, 214, 199, 212, 87, 39, 117, 234])
  const data = Buffer.concat([discriminator, args.newAdmin.toBuffer()])

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: programConfigPda, isSigner: false, isWritable: false },
      { pubkey: pendingAdminPda, isSigner: false, isWritable: true },
      { pubkey: args.currentAdmin, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })
}

/**
 * Build `asol_program.accept_admin` instruction.
 * Proposed admin signs to accept role and close the PendingAdmin PDA.
 */
export function buildAcceptAdminInstruction(args: {
  programId?: PublicKey
  newAdmin: PublicKey
}): TransactionInstruction {
  const programId = args.programId ?? ASOL_SOLANA_PROGRAM_ID
  const programConfigPda = getProgramConfigAddress(programId)
  const pendingAdminPda = getPendingAdminAddress(programId)

  // Anchor instruction discriminator for accept_admin: [112, 42, 45, 90, 116, 181, 13, 170]
  const discriminator = Buffer.from([112, 42, 45, 90, 116, 181, 13, 170])

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: programConfigPda, isSigner: false, isWritable: true },
      { pubkey: pendingAdminPda, isSigner: false, isWritable: true },
      { pubkey: args.newAdmin, isSigner: true, isWritable: true },
    ],
    data: discriminator,
  })
}

/**
 * Verify on-chain existence and ownership of Squads multisig and vault accounts.
 */
export async function verifySquadsAccountsOnChain(
  connection: { getAccountInfo: (pubkey: PublicKey) => Promise<any> },
  multisigPda: PublicKey,
  vaultPda: PublicKey,
  squadsProgramId = SQUADS_V4_PROGRAM_ID
): Promise<{
  multisigExists: boolean
  vaultExists: boolean
  multisigOwnerValid: boolean
  vaultOwnerValid: boolean
}> {
  const [multisigInfo, vaultInfo] = await Promise.all([
    connection.getAccountInfo(multisigPda),
    connection.getAccountInfo(vaultPda),
  ])

  return {
    multisigExists: Boolean(multisigInfo),
    vaultExists: Boolean(vaultInfo),
    multisigOwnerValid: Boolean(multisigInfo && multisigInfo.owner.equals(squadsProgramId)),
    vaultOwnerValid: Boolean(vaultInfo && vaultInfo.owner.equals(SystemProgram.programId)),
  }
}

export interface SquadsHandoverReport {
  programId: string
  programData: string
  multisigPda: string
  vaultPda: string
  vaultIndex: number
  currentAuthority: string
  upgradeAuthorityCliCommand: string
  setServiceAuthoritiesInstruction: {
    programId: string
    programConfig: string
    adminAuthority: string
    attestor: string
    pauser: string
  }
}

/**
 * Generate full Squads v4 governance transition runbook and instructions.
 */
export function generateSquadsHandoverRunbook(params: {
  createKey: PublicKey
  currentAuthority: PublicKey
  programId?: PublicKey
  vaultIndex?: number
  attestor?: PublicKey
  pauser?: PublicKey
}): SquadsHandoverReport {
  const programId = params.programId ?? ASOL_SOLANA_PROGRAM_ID
  const vaultIndex = params.vaultIndex ?? 1
  const [multisigPda] = getSquadsMultisigPda(params.createKey)
  const [vaultPda] = getSquadsVaultPda(multisigPda, vaultIndex)
  const programData = getProgramDataAddress(programId)

  const attestor = params.attestor ?? vaultPda
  const pauser = params.pauser ?? vaultPda

  const upgradeAuthorityCliCommand = `solana program set-upgrade-authority ${programId.toBase58()} --new-upgrade-authority ${vaultPda.toBase58()} --keypair <CURRENT_AUTHORITY_KEYPAIR>`

  return {
    programId: programId.toBase58(),
    programData: programData.toBase58(),
    multisigPda: multisigPda.toBase58(),
    vaultPda: vaultPda.toBase58(),
    vaultIndex,
    currentAuthority: params.currentAuthority.toBase58(),
    upgradeAuthorityCliCommand,
    setServiceAuthoritiesInstruction: {
      programId: programId.toBase58(),
      programConfig: getProgramConfigAddress(programId).toBase58(),
      adminAuthority: params.currentAuthority.toBase58(),
      attestor: attestor.toBase58(),
      pauser: pauser.toBase58(),
    },
  }
}

// CLI runner if executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv.includes('--dry-run')) {
  const createKey = PublicKey.default
  const currentAuthority = PublicKey.default
  const runbook = generateSquadsHandoverRunbook({
    createKey,
    currentAuthority,
  })

  console.log('==================================================================')
  console.log(' ASOL PROGRAM SQUADS V4 MULTISIG GOVERNANCE HANDOVER RUNBOOK')
  console.log('==================================================================')
  console.log(JSON.stringify(runbook, null, 2))
  console.log('\nStep 1: Transfer Program Upgrade Authority to Squads Vault:')
  console.log(`  $ ${runbook.upgradeAuthorityCliCommand}`)
  console.log('\nStep 2: Update Protocol Admin & Pauser via Anchor Instruction:')
  console.log(`  Program: ${runbook.setServiceAuthoritiesInstruction.programId}`)
  console.log(`  Config:  ${runbook.setServiceAuthoritiesInstruction.programConfig}`)
  console.log(`  Attestor -> ${runbook.setServiceAuthoritiesInstruction.attestor}`)
  console.log(`  Pauser   -> ${runbook.setServiceAuthoritiesInstruction.pauser}`)
  console.log('==================================================================')
}
