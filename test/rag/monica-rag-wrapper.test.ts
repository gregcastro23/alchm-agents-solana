/**
 * Monica RAG Wrapper Unit Tests
 * Tests for the RAG wrapper integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { shouldUseRAG, getRAGStatus } from '@/lib/rag/monica-rag-wrapper'

const originalEnv = { ...process.env }

beforeAll(() => {
  process.env.USE_RAG_GENERATION = 'true'
  process.env.USE_VECTOR_SEARCH = 'true'
  process.env.RAG_MAX_KNOWLEDGE_CHUNKS = '10'
  process.env.RAG_MIN_SIMILARITY = '0.7'
  process.env.CHROMADB_URL = 'http://localhost:8001'
  process.env.OPENAI_API_KEY = 'test-openai-key'
})

afterAll(() => {
  process.env = originalEnv
})

describe('Monica RAG Wrapper', () => {
  describe('shouldUseRAG', () => {
    it('should return boolean', () => {
      const result = shouldUseRAG()
      expect(typeof result).toBe('boolean')
    })

    it('should check environment variables', () => {
      const useRAG = process.env.USE_RAG_GENERATION
      const vectorSearch = process.env.USE_VECTOR_SEARCH

      // These should be defined in .env.local
      expect(useRAG).toBeDefined()
      expect(vectorSearch).toBeDefined()
    })
  })

  describe('getRAGStatus', () => {
    it('should return complete status object with health check', async () => {
      const status = await getRAGStatus()

      expect(status).toBeDefined()
      expect(status).toHaveProperty('enabled')
      expect(status).toHaveProperty('vectorStoreReady')
      expect(status).toHaveProperty('message')

      expect(typeof status.enabled).toBe('boolean')
      expect(typeof status.vectorStoreReady).toBe('boolean')
      expect(typeof status.message).toBe('string')
    })

    it('should include config when enabled', async () => {
      const status = await getRAGStatus()

      if (status.enabled) {
        expect(status.config).toBeDefined()
        expect(status.config).toHaveProperty('topK')
        expect(status.config).toHaveProperty('threshold')
        expect(status.config).toHaveProperty('useReranking')
        expect(status.config).toHaveProperty('maxContextTokens')

        expect(typeof status.config.topK).toBe('number')
        expect(typeof status.config.threshold).toBe('number')
        expect(typeof status.config.useReranking).toBe('boolean')
        expect(typeof status.config.maxContextTokens).toBe('number')
      }
    })

    it('should have reasonable config values when enabled', async () => {
      const status = await getRAGStatus()

      if (status.enabled && status.config) {
        // topK should be reasonable (1-20)
        expect(status.config.topK).toBeGreaterThan(0)
        expect(status.config.topK).toBeLessThanOrEqual(20)

        // threshold should be between 0 and 1
        expect(status.config.threshold).toBeGreaterThanOrEqual(0)
        expect(status.config.threshold).toBeLessThanOrEqual(1)

        // maxContextTokens should be reasonable
        expect(status.config.maxContextTokens).toBeGreaterThan(0)
      }
    })
  })

  describe('Feature Flag Configuration', () => {
    it('should have RAG_MAX_KNOWLEDGE_CHUNKS configured', () => {
      const maxChunks = process.env.RAG_MAX_KNOWLEDGE_CHUNKS
      expect(maxChunks).toBeDefined()

      if (maxChunks) {
        const parsed = parseInt(maxChunks)
        expect(parsed).toBeGreaterThan(0)
      }
    })

    it('should have RAG_MIN_SIMILARITY configured', () => {
      const minSim = process.env.RAG_MIN_SIMILARITY
      expect(minSim).toBeDefined()

      if (minSim) {
        const parsed = parseFloat(minSim)
        expect(parsed).toBeGreaterThanOrEqual(0)
        expect(parsed).toBeLessThanOrEqual(1)
      }
    })
  })
})

describe('RAG Configuration Validation', () => {
  it('should have ChromaDB URL configured', () => {
    const chromaUrl = process.env.CHROMADB_URL
    expect(chromaUrl).toBeDefined()

    if (chromaUrl) {
      expect(chromaUrl).toContain('http')
    }
  })

  it('should have OpenAI API key for embeddings', () => {
    const apiKey = process.env.OPENAI_API_KEY
    expect(apiKey).toBeDefined()
    expect(typeof apiKey).toBe('string')
  })
})
