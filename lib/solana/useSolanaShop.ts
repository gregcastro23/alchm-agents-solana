'use client'

import { useCallback, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import bs58 from 'bs58'
import type { ShopItem } from '@/lib/shop/catalog'
import type { EsmsCost } from '@/lib/shop/pricing'
import { costToSolanaAmounts } from '@/lib/shop/pricing'
import { ASOL_SOLANA_PROGRAM_ID, buildRedeemAuthorizationMessage } from '@/lib/solana/esms'
import { claimIdToBytes32 } from '@/lib/solana/solana-minter'
import {
  ASOL_SOLANA_TRANSACTION_CONFIRMED_EVENT,
  solanaExplorerTransactionUrl,
  type AsolSolanaTransaction,
} from '@/lib/solana/asol-solana-client'
import { useSolanaWalletState } from '@/components/providers/SolanaWalletProvider'

export interface SolanaPurchaseResult {
  ok: boolean
  alreadyOwned?: boolean
  reconciled?: boolean
  txHash?: string | null
  orderId?: string
  error?: string
  code?: string
  shortfall?: EsmsCost
}

export function useSolanaShop() {
  const { publicKey, signMessage, connected } = useWallet()
  const { refreshBalances } = useSolanaWalletState()
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)

  const buyDigitalSolana = useCallback(
    async (item: ShopItem, options?: { nonce?: string }): Promise<SolanaPurchaseResult> => {
      if (!connected || !publicKey) {
        return {
          ok: false,
          code: 'no_solana_wallet',
          error: 'Connect and verify your Solana wallet to spend ESMS on Solana.',
        }
      }

      setIsPurchasing(true)
      setActiveItemId(item.id)

      try {
        const nonce =
          options?.nonce ??
          (item.repeatable
            ? typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : `${item.id}-${Math.floor(performance.now())}`
            : undefined)

        const payload: Record<string, unknown> = {
          itemId: item.id,
          payWith: 'esms',
          rail: 'solana',
          ...(nonce ? { nonce } : {}),
        }

        const postPurchase = (body: Record<string, unknown>) =>
          fetch('/api/shop/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

        let res = await postPurchase(payload)
        let data = (await res.json().catch(() => ({}))) as Record<string, unknown>

        // ── Phase 1: Signing Challenge ───────────────────────────────────────
        if (res.ok && data.mode === 'sign_solana' && typeof data.messageBase64 === 'string') {
          if (!signMessage) {
            return {
              ok: false,
              code: 'wallet_sign_unsupported',
              error:
                'Your connected Solana wallet does not support message signing. Try Phantom or Solflare.',
            }
          }

          const orderIdStr = String(data.orderId ?? '')
          const deadlineStr = String(data.deadline ?? '')
          const clusterDomainHex = String(data.clusterDomainHex ?? '')

          // Re-derivation guard: prevent blind-signing unverified payloads
          const orderIdBytes = claimIdToBytes32(orderIdStr)
          const amounts = costToSolanaAmounts(item.esms)
          const clusterDomainBytes = Uint8Array.from(Buffer.from(clusterDomainHex, 'hex'))
          const expectedMessage = buildRedeemAuthorizationMessage({
            programId: ASOL_SOLANA_PROGRAM_ID,
            clusterDomain: clusterDomainBytes,
            holder: publicKey,
            orderId: orderIdBytes,
            amounts,
            deadline: BigInt(deadlineStr),
          })

          const challengeBuffer = Buffer.from(data.messageBase64, 'base64')
          if (!expectedMessage.equals(challengeBuffer)) {
            throw new Error(
              'Authorization message verification failed: local digest does not match server challenge.'
            )
          }

          // Request detached signature from wallet
          const rawSignature = await signMessage(challengeBuffer)
          const signature = bs58.encode(rawSignature)

          payload.orderId = orderIdStr
          payload.deadline = deadlineStr
          payload.signature = signature

          res = await postPurchase(payload)
          data = (await res.json().catch(() => ({}))) as Record<string, unknown>
        }

        // ── Phase 2: Result Handling ─────────────────────────────────────────
        if (res.ok && data.alreadyOwned) {
          return { ok: true, alreadyOwned: true }
        }

        if (res.ok && data.ok) {
          const txHash = typeof data.txHash === 'string' ? data.txHash : null
          const orderId = typeof data.orderId === 'string' ? data.orderId : undefined
          const reconciled = Boolean(data.reconciled)

          if (typeof window !== 'undefined' && txHash) {
            window.dispatchEvent(
              new CustomEvent<AsolSolanaTransaction>(ASOL_SOLANA_TRANSACTION_CONFIRMED_EVENT, {
                detail: {
                  type: 'redeemFor',
                  signature: txHash,
                  explorerUrl: solanaExplorerTransactionUrl(txHash),
                },
              })
            )
          }

          void refreshBalances()
          return { ok: true, txHash, orderId, reconciled }
        }

        if (res.status === 402 && data.code === 'insufficient_esms') {
          return {
            ok: false,
            code: 'insufficient_esms',
            error: String(data.error || 'Insufficient on-chain ESMS on Solana.'),
            shortfall: data.shortfall as EsmsCost | undefined,
          }
        }

        return {
          ok: false,
          code: String(data.code || 'purchase_failed'),
          error: String(data.error || 'Purchase failed. Please try again.'),
        }
      } catch (err) {
        return {
          ok: false,
          code: 'client_error',
          error: err instanceof Error ? err.message : 'An unexpected error occurred.',
        }
      } finally {
        setIsPurchasing(false)
        setActiveItemId(null)
      }
    },
    [connected, publicKey, refreshBalances, signMessage]
  )

  return {
    buyDigitalSolana,
    isPurchasing,
    activeItemId,
  }
}
