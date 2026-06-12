import { Pool } from 'pg'
import { randomUUID } from 'crypto'

const pool = new Pool({
  connectionString: process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL,
})

export async function debitInferenceCost(
  userId: string,
  costs: { spirit: number; essence: number; matter: number; substance: number }
) {
  const client = await pool.connect()
  const transactionGroupId = randomUUID()

  try {
    await client.query('BEGIN')
    const result = await client.query(
      `
        UPDATE token_balances
        SET spirit = spirit - $2,
            essence = essence - $3,
            matter = matter - $4,
            substance = substance - $5,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
          AND spirit >= $2
          AND essence >= $3
          AND matter >= $4
          AND substance >= $5
        RETURNING user_id;
      `,
      [userId, costs.spirit, costs.essence, costs.matter, costs.substance]
    )

    if (result.rows.length === 0) {
      await client.query('ROLLBACK')
      return false
    }

    const entries = Object.entries(costs).filter(([, amount]) => amount > 0)
    for (const [tokenType, amount] of entries) {
      await client.query(
        `
          INSERT INTO token_transactions (
            transaction_group_id, user_id, token_type, amount, source_type, description, created_at
          )
          VALUES ($1, $2, $3, $4, 'local_inference', 'Local LLM Generation Deduction', NOW());
        `,
        [transactionGroupId, userId, tokenType, -amount]
      )
    }

    await client.query('COMMIT')
    return true
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
