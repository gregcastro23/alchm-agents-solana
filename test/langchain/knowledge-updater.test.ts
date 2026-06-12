/**
 * Unit Tests for Knowledge Updater
 *
 * Tests web content ingestion using CheerioWebBaseLoader
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  updateAgentKnowledge,
  calculateKnowledgeStats,
  type KnowledgeUpdateResult,
} from '@/lib/langchain/knowledge-updater'

// Mock CheerioWebBaseLoader
const mockLoad = vi.fn()
vi.mock('@langchain/community/document_loaders/web/cheerio', () => ({
  CheerioWebBaseLoader: class {
    load() {
      return mockLoad()
    }
  },
}))

// Mock RecursiveCharacterTextSplitter
const mockSplitText = vi.fn()
const mockSplitterConstructor = vi.fn()
vi.mock('@langchain/textsplitters', () => ({
  RecursiveCharacterTextSplitter: class {
    constructor(...args: any[]) {
      mockSplitterConstructor(...args)
    }
    splitText(text: string) {
      return mockSplitText(text)
    }
  },
}))

// Mock vector store
vi.mock('@/lib/llamaindex/vector-store', () => ({
  getOrCreateCollection: vi.fn(),
  addDocuments: vi.fn(),
}))

// Mock embeddings service
vi.mock('@/lib/llamaindex/embeddings-service', () => ({
  generateEmbeddings: vi.fn(),
}))

// Mock logger
vi.mock('@/lib/structured-logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    performance: vi.fn(),
  },
}))

describe('Knowledge Updater', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    const { getOrCreateCollection, addDocuments } = await import('@/lib/llamaindex/vector-store')
    const { generateEmbeddings } = await import('@/lib/llamaindex/embeddings-service')

    vi.mocked(getOrCreateCollection).mockResolvedValue({
      name: 'test-collection',
    } as any)

    vi.mocked(addDocuments).mockResolvedValue({
      success: true,
      documentsAdded: 5,
      errors: [],
    })

    vi.mocked(generateEmbeddings).mockResolvedValue([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
      [0.7, 0.8, 0.9],
    ])

    // Set up default mock behaviors
    mockLoad.mockResolvedValue([
      {
        pageContent:
          'This is test content from a web page. It contains multiple sentences. ' +
          'This allows us to test the chunking functionality. ' +
          'The content should be split into manageable pieces.',
        metadata: { source: 'https://example.com' },
      },
    ])

    mockSplitText.mockResolvedValue([
      'This is test content from a web page. It contains multiple sentences.',
      'This allows us to test the chunking functionality.',
      'The content should be split into manageable pieces.',
    ])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('updateAgentKnowledge', () => {
    it('should successfully load and chunk documents from URLs', async () => {
      const result = await updateAgentKnowledge('plato', [
        'https://plato.stanford.edu/entries/plato/',
      ])

      expect(result.success).toBe(true)
      expect(result.agentId).toBe('plato')
      expect(result.documentsAdded).toBeGreaterThan(0)
      expect(result.urls).toBe(1)
      expect(result.chunks).toBeGreaterThan(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle multiple URLs', async () => {
      const urls = [
        'https://plato.stanford.edu/entries/plato/',
        'https://plato.stanford.edu/entries/aristotle/',
      ]

      const result = await updateAgentKnowledge('plato', urls)

      expect(result.success).toBe(true)
      expect(result.urls).toBe(2)
      expect(mockLoad).toHaveBeenCalledTimes(2)
    })

    it('should reject empty agent ID', async () => {
      await expect(updateAgentKnowledge('', ['https://example.com'])).rejects.toThrow(
        'Agent ID is required'
      )
    })

    it('should reject empty URL array', async () => {
      await expect(updateAgentKnowledge('plato', [])).rejects.toThrow(
        'At least one URL is required'
      )
    })

    it('should block localhost URLs', async () => {
      await expect(updateAgentKnowledge('plato', ['http://localhost:3000'])).rejects.toThrow(
        'No valid URLs provided'
      )
    })

    it('should block private IP addresses', async () => {
      const privateUrls = [
        'http://192.168.1.1',
        'http://10.0.0.1',
        'http://172.16.0.1',
        'http://127.0.0.1',
      ]

      await expect(updateAgentKnowledge('plato', privateUrls)).rejects.toThrow(
        'No valid URLs provided'
      )
    })

    it('should only allow HTTP and HTTPS protocols', async () => {
      const invalidUrls = ['ftp://example.com', 'file:///etc/passwd', 'javascript:alert(1)']

      await expect(updateAgentKnowledge('plato', invalidUrls)).rejects.toThrow(
        'No valid URLs provided'
      )
    })

    it('should handle loading errors gracefully', async () => {
      mockLoad.mockRejectedValueOnce(new Error('Network error'))

      const result = await updateAgentKnowledge('plato', ['https://example.com'])

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('Network error')
    })

    it('should handle empty content from URL', async () => {
      mockLoad.mockResolvedValueOnce([
        {
          pageContent: '',
          metadata: { source: 'https://example.com' },
        },
      ])

      const result = await updateAgentKnowledge('plato', ['https://example.com'])

      expect(result.success).toBe(false)
      expect(result.urls).toBe(0)
    })

    it('should use custom chunk size when provided', async () => {
      await updateAgentKnowledge('plato', ['https://example.com'], {
        chunkSize: 500,
        chunkOverlap: 100,
      })

      // Verify RecursiveCharacterTextSplitter was called with custom options
      expect(mockSplitterConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          chunkSize: 500,
          chunkOverlap: 100,
        })
      )
    })

    it('should generate correct metadata for chunks', async () => {
      const result = await updateAgentKnowledge('plato', ['https://example.com'])

      const { addDocuments } = await import('@/lib/llamaindex/vector-store')

      expect(addDocuments).toHaveBeenCalled()
      const callArgs = (addDocuments as any).mock.calls[0]
      const metadatas = callArgs[3] // 4th argument is metadatas array

      expect(metadatas[0]).toMatchObject({
        agentId: 'plato',
        source: 'web',
        sourceUrl: 'https://example.com',
      })
    })
  })

  describe('calculateKnowledgeStats', () => {
    it('should calculate correct statistics', () => {
      const results: KnowledgeUpdateResult[] = [
        {
          success: true,
          agentId: 'plato',
          documentsAdded: 10,
          urls: 2,
          chunks: 15,
          errors: [],
          timestamp: new Date().toISOString(),
        },
        {
          success: true,
          agentId: 'aristotle',
          documentsAdded: 8,
          urls: 1,
          chunks: 12,
          errors: [],
          timestamp: new Date().toISOString(),
        },
        {
          success: false,
          agentId: 'socrates',
          documentsAdded: 0,
          urls: 0,
          chunks: 0,
          errors: ['Failed to load'],
          timestamp: new Date().toISOString(),
        },
      ]

      const stats = calculateKnowledgeStats(results)

      expect(stats.totalDocuments).toBe(18)
      expect(stats.totalUrls).toBe(3)
      expect(stats.totalChunks).toBe(27)
      expect(stats.successRate).toBeCloseTo(2 / 3)
      expect(stats.averageChunksPerUrl).toBe(9)
    })

    it('should handle empty results array', () => {
      const stats = calculateKnowledgeStats([])

      expect(stats.totalDocuments).toBe(0)
      expect(stats.totalUrls).toBe(0)
      expect(stats.totalChunks).toBe(0)
      expect(stats.successRate).toBe(0)
      expect(stats.averageChunksPerUrl).toBe(0)
    })

    it('should handle all failed results', () => {
      const results: KnowledgeUpdateResult[] = [
        {
          success: false,
          agentId: 'plato',
          documentsAdded: 0,
          urls: 0,
          chunks: 0,
          errors: ['Error 1'],
          timestamp: new Date().toISOString(),
        },
      ]

      const stats = calculateKnowledgeStats(results)

      expect(stats.successRate).toBe(0)
    })
  })

  describe('Error Handling', () => {
    it('should throw error if ChromaDB is unavailable', async () => {
      const { getOrCreateCollection } = await import('@/lib/llamaindex/vector-store')
      ;(getOrCreateCollection as any).mockRejectedValueOnce(new Error('ChromaDB unavailable'))

      await expect(updateAgentKnowledge('plato', ['https://example.com'])).rejects.toThrow()
    })

    it('should throw error if embeddings generation fails', async () => {
      const { generateEmbeddings } = await import('@/lib/llamaindex/embeddings-service')
      ;(generateEmbeddings as any).mockRejectedValueOnce(
        new Error('Embeddings service unavailable')
      )

      await expect(updateAgentKnowledge('plato', ['https://example.com'])).rejects.toThrow()
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle Stanford Encyclopedia of Philosophy URL', async () => {
      mockLoad.mockResolvedValueOnce([
        {
          pageContent:
            'Plato (429-347 BCE) was a Greek philosopher and founder of the Academy. ' +
            'His theory of Forms posits that abstract concepts are the most real things. ' +
            'The physical world is merely a shadow of this higher reality.',
          metadata: { source: 'https://plato.stanford.edu/entries/plato/' },
        },
      ])

      mockSplitText.mockResolvedValueOnce([
        'Plato (429-347 BCE) was a Greek philosopher and founder of the Academy.',
        'His theory of Forms posits that abstract concepts are the most real things.',
        'The physical world is merely a shadow of this higher reality.',
      ])

      const result = await updateAgentKnowledge('plato', [
        'https://plato.stanford.edu/entries/plato/',
      ])

      expect(result.success).toBe(true)
      expect(result.agentId).toBe('plato')
      expect(result.chunks).toBe(3)
    })

    it('should handle Wikipedia URL', async () => {
      mockLoad.mockResolvedValueOnce([
        {
          pageContent:
            'Carl Jung was a Swiss psychiatrist and psychoanalyst who founded analytical psychology.',
          metadata: { source: 'https://en.wikipedia.org/wiki/Carl_Jung' },
        },
      ])

      mockSplitText.mockResolvedValueOnce([
        'Carl Jung was a Swiss psychiatrist and psychoanalyst who founded analytical psychology.',
      ])

      const result = await updateAgentKnowledge('carl-jung', [
        'https://en.wikipedia.org/wiki/Carl_Jung',
      ])

      expect(result.success).toBe(true)
      expect(result.agentId).toBe('carl-jung')
    })
  })
})
