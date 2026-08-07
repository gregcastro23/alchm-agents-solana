/** Build headers for a retry-safe single-agent chat debit. */
export function createUnifiedChatHeaders(requestId: string = crypto.randomUUID()): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Idempotency-Key': requestId,
  }
}
