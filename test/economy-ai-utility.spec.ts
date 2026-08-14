import { describe, it, expect } from 'vitest'
import {
  ORACLE_CHAMBER_COST,
  FLASH_EPIPHANY_COST,
  COUNCIL_CONCLAVE_COST,
  AGENT_OPERATION_COSTS,
} from '@/lib/economy-config'
import { DEEPSEEK, resolveOracleModel, resolveEpiphanyModel } from '@/lib/models/registry'
import { validateProviderKey } from '@/lib/byok/validate'

describe('Alchemical Economy AI Infusion Utilities & Gating', () => {
  it('enforces Oracle Chamber cost basket of 20 ESMS evenly split', () => {
    expect(ORACLE_CHAMBER_COST).toEqual({
      Spirit: 5,
      Essence: 5,
      Matter: 5,
      Substance: 5,
    })
    const total =
      ORACLE_CHAMBER_COST.Spirit +
      ORACLE_CHAMBER_COST.Essence +
      ORACLE_CHAMBER_COST.Matter +
      ORACLE_CHAMBER_COST.Substance
    expect(total).toBe(20)
  })

  it('enforces Flash Epiphany cost basket of 8 ESMS evenly split', () => {
    expect(FLASH_EPIPHANY_COST).toEqual({
      Spirit: 2,
      Essence: 2,
      Matter: 2,
      Substance: 2,
    })
    const total =
      FLASH_EPIPHANY_COST.Spirit +
      FLASH_EPIPHANY_COST.Essence +
      FLASH_EPIPHANY_COST.Matter +
      FLASH_EPIPHANY_COST.Substance
    expect(total).toBe(8)
  })

  it('enforces Council Conclave cost basket of 35 ESMS', () => {
    expect(COUNCIL_CONCLAVE_COST).toEqual({
      Spirit: 10,
      Essence: 10,
      Matter: 5,
      Substance: 10,
    })
    const total =
      COUNCIL_CONCLAVE_COST.Spirit +
      COUNCIL_CONCLAVE_COST.Essence +
      COUNCIL_CONCLAVE_COST.Matter +
      COUNCIL_CONCLAVE_COST.Substance
    expect(total).toBe(35)
  })

  it('registers all high-value AI operations in AGENT_OPERATION_COSTS', () => {
    expect(AGENT_OPERATION_COSTS.oracle_chamber).toEqual(ORACLE_CHAMBER_COST)
    expect(AGENT_OPERATION_COSTS.flash_epiphany).toEqual(FLASH_EPIPHANY_COST)
    expect(AGENT_OPERATION_COSTS.council_conclave).toEqual(COUNCIL_CONCLAVE_COST)
  })

  it('defines DeepSeek V3 and R1 models in registry', () => {
    expect(DEEPSEEK.V3).toBe('deepseek/deepseek-chat')
    expect(DEEPSEEK.R1).toBe('deepseek/deepseek-r1')
  })

  it('resolves valid language model instances for Oracle and Epiphany tiers', () => {
    const oracleModel = resolveOracleModel()
    expect(oracleModel).toBeDefined()

    const epiphanyModel = resolveEpiphanyModel()
    expect(epiphanyModel).toBeDefined()
  })

  it('validates BYOK providers empty key handling', async () => {
    const emptyOpenRouter = await validateProviderKey('openrouter', '  ')
    expect(emptyOpenRouter.valid).toBe(false)
    expect(emptyOpenRouter.error).toContain('empty')

    const emptyGoogle = await validateProviderKey('google', '')
    expect(emptyGoogle.valid).toBe(false)
    expect(emptyGoogle.error).toContain('empty')
  })
})
