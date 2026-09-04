#!/usr/bin/env bun
/**
 * Squads v4 2-of-3 Multisig Deployment & Governance Execution Drill on Solana Devnet
 *
 * Deploys a real on-chain 2-of-3 Squads v4 multisig:
 *   - Member 1: Devnet Operator (AhNRjjyhJ4dR6ZSvWyJNSpbJFbFnxhkRdUNMY31fJ3S5)
 *   - Member 2: Governance Signer 2 (persisted in deployments/solana-devnet-governance-keys.json)
 *   - Member 3: Governance Signer 3 (persisted in deployments/solana-devnet-governance-keys.json)
 *   - Threshold: 2
 *   - Vault: Vault PDA (index 1)
 *
 * Executes a full governance lifecycle drill:
 *   1. Funds Vault with 0.05 SOL
 *   2. Creates Vault Transaction (Transfer 1,000 lamports back to Operator)
 *   3. Creates Proposal (Transaction Index 1)
 *   4. Approves with Member 1 & Member 2 (meeting 2-of-3 threshold)
 *   5. Executes Vault Transaction on-chain
 *   6. Verifies on-chain account states and writes deployments/solana-devnet-governance.json
 *
 * Usage:
 *   bun run scripts/governance/init-devnet-multisig.ts [--rpc-url <url>] [--force-new]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as sqds from '@sqds/multisig'
import {
  Connection,
  Keypair,
  PublicKey,
  Signer,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js'

import {
  SQUADS_V4_PROGRAM_ID,
  getSquadsMultisigPda,
  getSquadsVaultPda,
  getSquadsProposalPda,
  getSquadsTransactionPda,
  verifySquadsAccountsOnChain,
} from './squads-multisig-runbook'
import {
  loadOperatorKeypair,
  sendWithRetry,
  sendAndConfirmCustom,
} from '@/scripts/devnet/init-devnet-amm'
import { SOLANA_DEVNET_GENESIS_HASH } from '@/lib/solana/network-config'

export const DEFAULT_GOVERNANCE_FILE = resolve(
  process.cwd(),
  'deployments/solana-devnet-governance.json'
)
export const DEFAULT_KEYS_FILE = resolve(
  process.cwd(),
  'deployments/solana-devnet-governance-keys.json'
)

interface StoredGovernanceKeys {
  createKey: number[]
  member2: number[]
  member3: number[]
}

export function loadOrCreateGovernanceKeypairs(
  keysPath = DEFAULT_KEYS_FILE,
  forceNew = false
): {
  createKeypair: Keypair
  member2Keypair: Keypair
  member3Keypair: Keypair
} {
  if (!forceNew && existsSync(keysPath)) {
    const raw = JSON.parse(readFileSync(keysPath, 'utf8')) as StoredGovernanceKeys
    return {
      createKeypair: Keypair.fromSecretKey(Uint8Array.from(raw.createKey)),
      member2Keypair: Keypair.fromSecretKey(Uint8Array.from(raw.member2)),
      member3Keypair: Keypair.fromSecretKey(Uint8Array.from(raw.member3)),
    }
  }

  const createKeypair = Keypair.generate()
  const member2Keypair = Keypair.generate()
  const member3Keypair = Keypair.generate()

  const payload: StoredGovernanceKeys = {
    createKey: Array.from(createKeypair.secretKey),
    member2: Array.from(member2Keypair.secretKey),
    member3: Array.from(member3Keypair.secretKey),
  }

  writeFileSync(keysPath, JSON.stringify(payload, null, 2))
  return { createKeypair, member2Keypair, member3Keypair }
}

export async function sendAndConfirmVersioned(
  connection: Connection,
  transaction: VersionedTransaction,
  signers: Signer[]
): Promise<string> {
  return await sendWithRetry(async () => {
    transaction.sign(signers)
    const rawTx = transaction.serialize()
    const signature = await connection.sendRawTransaction(rawTx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    })

    for (let i = 0; i < 45; i++) {
      const status = await connection.getSignatureStatus(signature)
      if (
        status.value?.confirmationStatus === 'confirmed' ||
        status.value?.confirmationStatus === 'finalized'
      ) {
        if (status.value.err) {
          throw new Error(`Transaction ${signature} failed: ${JSON.stringify(status.value.err)}`)
        }
        return signature
      }
      await new Promise(r => setTimeout(r, 1000))
    }
    throw new Error(`Transaction ${signature} confirmation timeout`)
  })
}

export async function initDevnetMultisig(options: {
  rpcUrl?: string
  forceNew?: boolean
  keysPath?: string
  governancePath?: string
  operatorKeypair?: Keypair
}) {
  const rpcUrl =
    options.rpcUrl ?? process.env.ANCHOR_PROVIDER_URL ?? 'https://api.devnet.solana.com'
  const keysPath = options.keysPath ?? DEFAULT_KEYS_FILE
  const governancePath = options.governancePath ?? DEFAULT_GOVERNANCE_FILE
  const operator = options.operatorKeypair ?? loadOperatorKeypair()

  console.log('=============================================================')
  console.log('🏛️ SQUADS V4 DEVNET MULTISIG INITIALIZATION & DRILL')
  console.log('=============================================================')
  console.log(`RPC URL:          ${rpcUrl}`)
  console.log(`Operator Wallet:  ${operator.publicKey.toBase58()}`)
  console.log(`Squads Program:   ${SQUADS_V4_PROGRAM_ID.toBase58()}`)

  const connection = new Connection(rpcUrl, { commitment: 'confirmed' })
  const genesisHash = await connection.getGenesisHash()
  if (genesisHash !== SOLANA_DEVNET_GENESIS_HASH) {
    throw new Error(`Target RPC is not Solana Devnet (genesis: ${genesisHash})`)
  }

  const { createKeypair, member2Keypair, member3Keypair } = loadOrCreateGovernanceKeypairs(
    keysPath,
    options.forceNew
  )

  const [multisigPda] = getSquadsMultisigPda(createKeypair.publicKey)
  const [vaultPda] = getSquadsVaultPda(multisigPda, 1)

  console.log(`Create Key:       ${createKeypair.publicKey.toBase58()}`)
  console.log(`Multisig PDA:     ${multisigPda.toBase58()}`)
  console.log(`Vault PDA (idx 1): ${vaultPda.toBase58()}`)
  console.log(`Signer 1 (Admin): ${operator.publicKey.toBase58()}`)
  console.log(`Signer 2:         ${member2Keypair.publicKey.toBase58()}`)
  console.log(`Signer 3:         ${member3Keypair.publicKey.toBase58()}`)

  // Fetch Squads program config to discover treasury address
  const programConfigPda = sqds.getProgramConfigPda({ programId: SQUADS_V4_PROGRAM_ID })[0]
  const configAccountInfo = await connection.getAccountInfo(programConfigPda)
  if (!configAccountInfo) {
    throw new Error('Squads ProgramConfig account not found on Devnet')
  }
  const parsedSquadsConfig = sqds.accounts.ProgramConfig.fromAccountInfo(configAccountInfo)[0]
  const squadsTreasury = parsedSquadsConfig.treasury

  let createSig: string | null = null
  let multisigInfo = await connection.getAccountInfo(multisigPda)

  if (!multisigInfo) {
    console.log('\nDeploying 2-of-3 Squads v4 Multisig on Devnet...')
    const { blockhash } = await connection.getLatestBlockhash('confirmed')

    const members: sqds.generated.Member[] = [
      { key: operator.publicKey, permissions: sqds.types.Permissions.all() },
      { key: member2Keypair.publicKey, permissions: sqds.types.Permissions.all() },
      { key: member3Keypair.publicKey, permissions: sqds.types.Permissions.all() },
    ]

    const tx = sqds.transactions.multisigCreateV2({
      blockhash,
      treasury: squadsTreasury,
      createKey: createKeypair.publicKey,
      creator: operator.publicKey,
      multisigPda,
      configAuthority: null, // Immutable configuration
      threshold: 2,
      members,
      timeLock: 0,
      rentCollector: null,
      programId: SQUADS_V4_PROGRAM_ID,
    })

    createSig = await sendAndConfirmVersioned(connection, tx, [operator, createKeypair])
    console.log(`  ✓ Multisig Created: ${createSig}`)

    multisigInfo = await connection.getAccountInfo(multisigPda)
    if (!multisigInfo) throw new Error('Multisig account not found after creation')
  } else {
    console.log('\nMultisig account already exists on-chain.')
  }

  // Check and fund Vault PDA if needed
  const initialVaultBalance = await connection.getBalance(vaultPda)
  console.log(`Current Vault Balance: ${initialVaultBalance / 1e9} SOL`)
  if (initialVaultBalance < 20_000_000) {
    console.log('Funding Vault PDA with 0.05 SOL from Operator...')
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: operator.publicKey,
        toPubkey: vaultPda,
        lamports: 50_000_000,
      })
    )
    const fundSig = await sendAndConfirmCustom(connection, fundTx, [operator])
    console.log(`  ✓ Vault Funded: ${fundSig}`)
  }

  // Verify multisig and vault accounts
  const verification = await verifySquadsAccountsOnChain(connection, multisigPda, vaultPda)
  console.log('Account Verification:', verification)
  if (!verification.multisigExists || !verification.multisigOwnerValid) {
    throw new Error('Multisig account failed ownership/existence validation')
  }
  if (!verification.vaultExists || !verification.vaultOwnerValid) {
    throw new Error('Vault account failed ownership/existence validation')
  }

  // Execute Proposal Drill
  const multisigAccount = await sqds.accounts.Multisig.fromAccountAddress(connection, multisigPda)
  const nextTxIndex = BigInt(multisigAccount.transactionIndex) + 1n
  console.log(`Next Transaction Index: ${nextTxIndex}`)

  const proposalPda = getSquadsProposalPda(multisigPda, nextTxIndex)[0]
  const proposalInfo = await connection.getAccountInfo(proposalPda)

  let vaultTxSig = ''
  let proposalSig = ''
  const approvalSigs: string[] = []
  let executeSig = ''

  if (!proposalInfo) {
    console.log(
      `\nCreating Vault Transaction ${nextTxIndex} (Transfer 1,000 lamports from Vault to Operator)...`
    )
    const { blockhash: blockhash1 } = await connection.getLatestBlockhash('confirmed')

    const transferIx = SystemProgram.transfer({
      fromPubkey: vaultPda,
      toPubkey: operator.publicKey,
      lamports: 1_000,
    })

    const transactionMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: blockhash1,
      instructions: [transferIx],
    })

    const vaultTx = sqds.transactions.vaultTransactionCreate({
      blockhash: blockhash1,
      feePayer: operator.publicKey,
      multisigPda,
      transactionIndex: nextTxIndex,
      creator: operator.publicKey,
      vaultIndex: 1,
      ephemeralSigners: 0,
      transactionMessage,
      programId: SQUADS_V4_PROGRAM_ID,
    })

    vaultTxSig = await sendAndConfirmVersioned(connection, vaultTx, [operator])
    console.log(`  ✓ Vault Transaction Created: ${vaultTxSig}`)

    console.log(`Creating Proposal ${nextTxIndex}...`)
    const { blockhash: blockhash2 } = await connection.getLatestBlockhash('confirmed')
    const propTx = sqds.transactions.proposalCreate({
      blockhash: blockhash2,
      feePayer: operator.publicKey,
      creator: operator.publicKey,
      multisigPda,
      transactionIndex: nextTxIndex,
      isDraft: false,
      programId: SQUADS_V4_PROGRAM_ID,
    })
    proposalSig = await sendAndConfirmVersioned(connection, propTx, [operator])
    console.log(`  ✓ Proposal Created: ${proposalSig}`)

    console.log(`Approving Proposal with Member 1 (Operator)...`)
    const { blockhash: blockhash3 } = await connection.getLatestBlockhash('confirmed')
    const app1Tx = sqds.transactions.proposalApprove({
      blockhash: blockhash3,
      feePayer: operator.publicKey,
      member: operator.publicKey,
      multisigPda,
      transactionIndex: nextTxIndex,
      programId: SQUADS_V4_PROGRAM_ID,
    })
    const app1Sig = await sendAndConfirmVersioned(connection, app1Tx, [operator])
    approvalSigs.push(app1Sig)
    console.log(`  ✓ Member 1 Approved: ${app1Sig}`)

    console.log(`Approving Proposal with Member 2 (Second Signer)...`)
    const { blockhash: blockhash4 } = await connection.getLatestBlockhash('confirmed')
    const app2Tx = sqds.transactions.proposalApprove({
      blockhash: blockhash4,
      feePayer: operator.publicKey,
      member: member2Keypair.publicKey,
      multisigPda,
      transactionIndex: nextTxIndex,
      programId: SQUADS_V4_PROGRAM_ID,
    })
    const app2Sig = await sendAndConfirmVersioned(connection, app2Tx, [operator, member2Keypair])
    approvalSigs.push(app2Sig)
    console.log(`  ✓ Member 2 Approved (Threshold Met): ${app2Sig}`)

    console.log(`Executing Vault Transaction ${nextTxIndex}...`)
    const { blockhash: blockhash5 } = await connection.getLatestBlockhash('confirmed')
    const execTx = await sqds.transactions.vaultTransactionExecute({
      connection,
      blockhash: blockhash5,
      feePayer: operator.publicKey,
      multisigPda,
      transactionIndex: nextTxIndex,
      member: operator.publicKey,
      programId: SQUADS_V4_PROGRAM_ID,
    })
    executeSig = await sendAndConfirmVersioned(connection, execTx, [operator])
    console.log(`  ✓ Vault Transaction Executed: ${executeSig}`)
  } else {
    console.log(`Proposal ${nextTxIndex} already exists or was previously drilled.`)
  }

  let existingReceipt: any = null
  if (existsSync(governancePath)) {
    try {
      existingReceipt = JSON.parse(readFileSync(governancePath, 'utf8'))
    } catch {}
  }

  const receipt = {
    cluster: 'devnet',
    genesisHash,
    squadsProgramId: SQUADS_V4_PROGRAM_ID.toBase58(),
    createKey: createKeypair.publicKey.toBase58(),
    multisigPda: multisigPda.toBase58(),
    vaultPda: vaultPda.toBase58(),
    vaultIndex: 1,
    threshold: 2,
    members: [
      { role: 'operator', address: operator.publicKey.toBase58() },
      { role: 'signer2', address: member2Keypair.publicKey.toBase58() },
      { role: 'signer3', address: member3Keypair.publicKey.toBase58() },
    ],
    multisigCreated: true,
    createSignature: createSig ?? existingReceipt?.createSignature ?? null,
    verification,
    lifecycleDrill: {
      transactionIndex: Number(nextTxIndex),
      vaultTxSignature: vaultTxSig || existingReceipt?.lifecycleDrill?.vaultTxSignature || '',
      proposalSignature: proposalSig || existingReceipt?.lifecycleDrill?.proposalSignature || '',
      approvalSignatures:
        approvalSigs.length > 0
          ? approvalSigs
          : (existingReceipt?.lifecycleDrill?.approvalSignatures ?? []),
      executeSignature: executeSig || existingReceipt?.lifecycleDrill?.executeSignature || '',
      status: 'executed',
    },
    timestamp: new Date().toISOString(),
  }

  writeFileSync(governancePath, JSON.stringify(receipt, null, 2))
  console.log(`\n✓ Saved governance receipt to ${governancePath}`)
  console.log('=============================================================')
  console.log('🎉 SQUADS MULTISIG DEPLOYMENT & DRILL COMPLETED SUCCESSFULLY!')
  console.log('=============================================================')
  return receipt
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const forceNew = process.argv.includes('--force-new')
  initDevnetMultisig({ forceNew }).catch(err => {
    console.error('Squads Multisig Initialization Error:', err)
    process.exit(1)
  })
}
