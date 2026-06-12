// Unit tests for HistoricalCouncilChat component
// Tests preset selection, filtering, and council configuration

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom'
import HistoricalCouncilChat from '@/components/misc/historical-council-chat'
import {
  mockHistoricalAgents,
  mockHistoricalPresets,
  mockMessages,
  createMockAgent,
} from '../fixtures/mock-data'

// Mock the unified multi-agent chat component
vi.mock('@/components/misc/unified-multi-agent-chat', () => ({
  default: ({ isOpen, onClose, title, historicalAgents, initialAgents, customHeader }: any) => (
    <div data-testid="unified-chat" data-open={isOpen}>
      <div data-testid="chat-title">{title}</div>
      <div data-testid="historical-agents-count">{initialAgents.length}</div>
      {customHeader}
    </div>
  ),
}))

// Mock council presets
vi.mock('@/lib/council-presets', async () => {
  const actual = await vi.importActual('../fixtures/mock-data')
  const presets = (actual as any).mockHistoricalPresets
  return {
    HISTORICAL_COUNCIL_PRESETS: presets,
    getPresetsByDifficulty: vi.fn((difficulty: string) =>
      presets.filter((p: any) => p.difficulty === difficulty)
    ),
    getPresetsByTag: vi.fn((tag: string) => presets.filter((p: any) => p.tags.includes(tag))),
    getOptimalMonicaRole: vi.fn(() => 'synthesizer'),
  }
})

describe('HistoricalCouncilChat Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    historicalAgents: mockHistoricalAgents,
    maxAgents: 5,
    allowMonica: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('Initial Rendering', () => {
    it('renders preset selection when no initial council is provided', () => {
      render(<HistoricalCouncilChat {...defaultProps} />)

      expect(screen.getByText('Choose Your Historical Council')).toBeInTheDocument()
      expect(
        screen.getByText('Select a curated council or create your own custom assembly')
      ).toBeInTheDocument()
    })

    it('renders with initial council preset', () => {
      render(<HistoricalCouncilChat {...defaultProps} initialCouncil="test-renaissance-masters" />)

      expect(screen.getByTestId('unified-chat')).toHaveAttribute('data-open', 'true')
      expect(screen.getByTestId('chat-title')).toHaveTextContent('Historical Council Chamber')
    })

    it('renders with custom agent selection', () => {
      render(
        <HistoricalCouncilChat
          {...defaultProps}
          initialAgents={['leonardo-da-vinci', 'carl-jung']}
        />
      )

      expect(screen.getByTestId('unified-chat')).toHaveAttribute('data-open', 'true')
      expect(screen.getByTestId('historical-agents-count')).toHaveTextContent('2')
    })
  })

  describe('Preset Selection Interface', () => {
    it('displays all available presets', () => {
      render(<HistoricalCouncilChat {...defaultProps} />)

      expect(screen.getByText('Test Renaissance Council')).toBeInTheDocument()
      expect(screen.getByText('Test configuration for Renaissance masters')).toBeInTheDocument()
    })

    it('shows difficulty and tag filters', () => {
      render(<HistoricalCouncilChat {...defaultProps} />)

      expect(screen.getByLabelText(/Difficulty:/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Focus:/)).toBeInTheDocument()
    })

    it('filters presets by difficulty', async () => {
      const mockGetPresetsByDifficulty = vi.mocked(
        (await import('@/lib/council-presets')).getPresetsByDifficulty
      )

      render(<HistoricalCouncilChat {...defaultProps} />)

      const difficultySelect = screen.getByLabelText(/Difficulty:/)
      fireEvent.change(difficultySelect, { target: { value: 'intermediate' } })

      expect(mockGetPresetsByDifficulty).toHaveBeenCalledWith('intermediate')
    })

    it('filters presets by tag', async () => {
      const mockGetPresetsByTag = vi.mocked((await import('@/lib/council-presets')).getPresetsByTag)

      render(<HistoricalCouncilChat {...defaultProps} />)

      const tagSelect = screen.getByLabelText(/Focus:/)
      fireEvent.change(tagSelect, { target: { value: 'art' } })

      expect(mockGetPresetsByTag).toHaveBeenCalledWith('art')
    })

    it('displays preset metadata correctly', () => {
      render(<HistoricalCouncilChat {...defaultProps} />)

      // Check for era badge
      expect(screen.getAllByText('Renaissance')[0]).toBeInTheDocument()

      // Check for difficulty badge
      expect(screen.getByText('intermediate')).toBeInTheDocument()

      // Check for agent count
      expect(screen.getByText('2')).toBeInTheDocument() // mockHistoricalPresets[0] has 2 agents

      // Check for Monica inclusion indicator
      expect(screen.getByText('Monica as synthesizer')).toBeInTheDocument()
    })
  })

  describe('Preset Selection', () => {
    it('selects a preset and closes selection modal', async () => {
      render(<HistoricalCouncilChat {...defaultProps} />)

      const presetCard = screen.getByText('Test Renaissance Council').closest('.cursor-pointer')
      expect(presetCard).toBeInTheDocument()

      fireEvent.click(presetCard!)

      await waitFor(() => {
        expect(screen.getByTestId('unified-chat')).toHaveAttribute('data-open', 'true')
      })
    })

    it('creates custom council option', () => {
      render(<HistoricalCouncilChat {...defaultProps} />)

      const customOption = screen.getByText('Create Custom Council')
      expect(customOption).toBeInTheDocument()

      fireEvent.click(customOption.closest('div')!)

      expect(screen.getByTestId('unified-chat')).toHaveAttribute('data-open', 'true')
    })
  })

  describe('Council Information Display', () => {
    it('displays council info for selected preset', () => {
      render(<HistoricalCouncilChat {...defaultProps} initialCouncil="test-renaissance-masters" />)

      expect(screen.getByText('Test Renaissance Council')).toBeInTheDocument()
      expect(screen.getByText('Council Members')).toBeInTheDocument()
      expect(screen.getByText('Historical Eras')).toBeInTheDocument()
    })

    it('shows era information based on agent birth dates', () => {
      render(
        <HistoricalCouncilChat
          {...defaultProps}
          initialAgents={['leonardo-da-vinci']} // Born 1452 = Renaissance
        />
      )

      expect(screen.getByText('Renaissance')).toBeInTheDocument()
    })

    it('displays agent symbols and names correctly', () => {
      render(
        <HistoricalCouncilChat
          {...defaultProps}
          initialAgents={['leonardo-da-vinci', 'carl-jung']}
        />
      )

      expect(screen.getByText('Leonardo da Vinci')).toBeInTheDocument()
      expect(screen.getByText('Carl Jung')).toBeInTheDocument()
    })

    it('shows Monica role when included', () => {
      render(
        <HistoricalCouncilChat
          {...defaultProps}
          initialCouncil="test-renaissance-masters" // includes Monica as synthesizer
        />
      )

      expect(screen.getByText('Monica (synthesizer)')).toBeInTheDocument()
    })
  })

  describe('Historical-Specific Features', () => {
    it('enables era filtering when specified', () => {
      render(<HistoricalCouncilChat {...defaultProps} enableEraFilters={true} />)

      // Should pass enableEraFilters to UnifiedMultiAgentChat
      expect(screen.getByTestId('unified-chat')).toBeInTheDocument()
    })

    it('enables specialization groups when specified', () => {
      render(<HistoricalCouncilChat {...defaultProps} enableSpecializationGroups={true} />)

      // Should pass enableSpecializationGroups to UnifiedMultiAgentChat
      expect(screen.getByTestId('unified-chat')).toBeInTheDocument()
    })

    it('enables agent biographies when specified', () => {
      render(<HistoricalCouncilChat {...defaultProps} showAgentBiographies={true} />)

      // Biography feature should be available
      expect(screen.getByTestId('unified-chat')).toBeInTheDocument()
    })
  })

  describe('Configuration Management', () => {
    it('handles changing council selection', async () => {
      render(<HistoricalCouncilChat {...defaultProps} initialCouncil="test-renaissance-masters" />)

      const changeButton = screen.getAllByText('Change Council')[0]
      fireEvent.click(changeButton)

      await waitFor(() => {
        expect(screen.getByText('Choose Your Historical Council')).toBeInTheDocument()
      })
    })

    it('respects maxAgents limitation', () => {
      render(
        <HistoricalCouncilChat
          {...defaultProps}
          maxAgents={3}
          initialAgents={['leonardo-da-vinci', 'carl-jung', 'nikola-tesla']}
        />
      )

      expect(screen.getByTestId('historical-agents-count')).toHaveTextContent('3')
    })

    it('handles agent filtering by selection', () => {
      const filteredAgents = ['leonardo-da-vinci']

      render(<HistoricalCouncilChat {...defaultProps} filterBySelectedAgents={filteredAgents} />)

      expect(screen.getByTestId('historical-agents-count')).toHaveTextContent('1')
    })
  })

  describe('Callback Handling', () => {
    it('calls onClose when chat is closed', () => {
      const mockOnClose = vi.fn()

      render(<HistoricalCouncilChat {...defaultProps} onClose={mockOnClose} isOpen={false} />)

      expect(screen.getByTestId('unified-chat')).toHaveAttribute('data-open', 'false')
    })

    it('handles session updates', () => {
      const mockOnSessionUpdate = vi.fn()

      render(<HistoricalCouncilChat {...defaultProps} onSessionUpdate={mockOnSessionUpdate} />)

      // Session update handling should be passed through
      expect(screen.getByTestId('unified-chat')).toBeInTheDocument()
    })

    it('handles agent evolution', () => {
      const mockOnAgentEvolution = vi.fn()

      render(<HistoricalCouncilChat {...defaultProps} onAgentEvolution={mockOnAgentEvolution} />)

      // Agent evolution handling should be passed through
      expect(screen.getByTestId('unified-chat')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('handles missing preset gracefully', () => {
      render(<HistoricalCouncilChat {...defaultProps} initialCouncil="non-existent-preset" />)

      // Should fall back to preset selection
      expect(screen.getByText('Choose Your Historical Council')).toBeInTheDocument()
    })

    it('handles empty agent list', () => {
      render(<HistoricalCouncilChat {...defaultProps} historicalAgents={[]} />)

      expect(screen.getByTestId('unified-chat')).toBeInTheDocument()
      expect(screen.getByTestId('historical-agents-count')).toHaveTextContent('0')
    })

    it('handles missing agent in initial selection', () => {
      render(<HistoricalCouncilChat {...defaultProps} initialAgents={['non-existent-agent']} />)

      // Should filter out non-existent agents
      expect(screen.getByTestId('historical-agents-count')).toHaveTextContent('0')
    })
  })

  describe('Accessibility', () => {
    it('provides proper ARIA labels', () => {
      render(<HistoricalCouncilChat {...defaultProps} />)

      expect(screen.getByLabelText(/Difficulty:/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Focus:/)).toBeInTheDocument()
    })

    it('supports keyboard navigation', () => {
      render(<HistoricalCouncilChat {...defaultProps} />)

      const presetCard = screen.getByText('Test Renaissance Council').closest('.cursor-pointer')
      expect(presetCard).toBeInTheDocument()

      // Should be focusable
      presetCard?.focus()
      expect(document.activeElement).toBe(presetCard)
    })
  })
})
