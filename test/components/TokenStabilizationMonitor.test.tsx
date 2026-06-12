import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TokenStabilizationMonitor } from '@/components/dashboards/TokenStabilizationMonitor'
import { vi } from 'vitest'

// Mock the usePlanetaryPositions hook
const { mockUsePlanetaryPositions } = vi.hoisted(() => ({
  mockUsePlanetaryPositions: vi.fn(),
}))
vi.mock('@/hooks/usePlanetaryPositions', () => ({
  usePlanetaryPositions: mockUsePlanetaryPositions,
}))

// Mock logger
vi.mock('@/lib/structured-logger', () => ({
  logger: {
    log: vi.fn(),
  },
  LogLevel: {
    INFO: 'info',
  },
}))

// Mock Radix UI Tabs to work reliably in JSDOM
vi.mock('@radix-ui/react-tabs', () => {
  const React = require('react')

  const Root = React.forwardRef(
    ({ children, defaultValue, onValueChange, value, ...props }: any, ref: any) => {
      const [activeTab, setActiveTab] = React.useState(defaultValue || value)

      React.useEffect(() => {
        if (value !== undefined) {
          setActiveTab(value)
        }
      }, [value])

      const handleValueChange = (val: string) => {
        setActiveTab(val)
        if (onValueChange) onValueChange(val)
      }

      const renderChildren = (nodes: any): any => {
        return React.Children.map(nodes, (child: any) => {
          if (!child || !React.isValidElement(child)) return child

          const childProps: any = { activeTab, onTabChange: handleValueChange }
          if (child.props && child.props.children) {
            childProps.children = renderChildren(child.props.children)
          }

          return React.cloneElement(child, childProps)
        })
      }

      return (
        <div ref={ref} data-testid="tabs-root" {...props}>
          {renderChildren(children)}
        </div>
      )
    }
  )
  Root.displayName = 'TabsRoot'

  const List = React.forwardRef(({ children, activeTab, onTabChange, ...props }: any, ref: any) => {
    const renderChildren = (nodes: any): any => {
      return React.Children.map(nodes, (child: any) => {
        if (!child || !React.isValidElement(child)) return child

        const childProps: any = { activeTab, onTabChange }
        if (child.props && child.props.children) {
          childProps.children = renderChildren(child.props.children)
        }

        return React.cloneElement(child, childProps)
      })
    }

    return (
      <div ref={ref} role="tablist" {...props}>
        {renderChildren(children)}
      </div>
    )
  })
  List.displayName = 'TabsList'

  const Trigger = React.forwardRef(
    ({ children, value, activeTab, onTabChange, ...props }: any, ref: any) => {
      return (
        <button
          ref={ref}
          role="tab"
          aria-selected={activeTab === value}
          data-state={activeTab === value ? 'active' : 'inactive'}
          onClick={() => onTabChange && onTabChange(value)}
          {...props}
        >
          {children}
        </button>
      )
    }
  )
  Trigger.displayName = 'TabsTrigger'

  const Content = React.forwardRef(({ children, value, activeTab, ...props }: any, ref: any) => {
    if (activeTab !== value) return null
    return (
      <div ref={ref} role="tabpanel" data-state="active" {...props}>
        {children}
      </div>
    )
  })
  Content.displayName = 'TabsContent'

  return {
    Root,
    List,
    Trigger,
    Content,
  }
})

describe('TokenStabilizationMonitor', () => {
  beforeEach(() => {
    mockUsePlanetaryPositions.mockReturnValue({
      alchmQuantities: {
        spirit: 0.5,
        essence: 0.8,
        matter: 0.7,
        substance: 0.4,
        Heat: 0.3,
        Entropy: 0.2,
        Reactivity: 0.1,
        Energy: 0.6,
      },
      planetaryPositions: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the component with token data', async () => {
    render(<TokenStabilizationMonitor />)

    expect(screen.getByText('Token Stabilization Monitor')).toBeInTheDocument()

    // Click Elements tab to render token details
    const elementsTab = screen.getByRole('tab', { name: /elements/i })
    fireEvent.pointerDown(elementsTab)
    fireEvent.click(elementsTab)

    expect(await screen.findByText('0.50')).toBeInTheDocument() // spirit value
    expect(await screen.findByText('0.80')).toBeInTheDocument() // essence value
  })

  it('shows monitoring status', () => {
    render(<TokenStabilizationMonitor />)

    expect(screen.getByText('Monitoring')).toBeInTheDocument()
  })

  it('toggles monitoring state', async () => {
    render(<TokenStabilizationMonitor />)

    const monitoringButton = screen.getByText('Monitoring')
    fireEvent.click(monitoringButton)

    await waitFor(() => {
      expect(screen.getByText('Paused')).toBeInTheDocument()
    })
  })

  it('handles loading state', () => {
    mockUsePlanetaryPositions.mockReturnValue({
      alchmQuantities: {
        spirit: 0,
        essence: 0,
        matter: 0,
        substance: 0,
        Heat: 0,
        Entropy: 0,
        Reactivity: 0,
        Energy: 0,
      },
      planetaryPositions: [],
      loading: true,
      error: null,
      refresh: vi.fn(),
    })

    render(<TokenStabilizationMonitor />)

    expect(screen.getByText('Token Stabilization Monitor')).toBeInTheDocument()
  })

  it('handles error state', () => {
    mockUsePlanetaryPositions.mockReturnValue({
      alchmQuantities: {
        spirit: 0,
        essence: 0,
        matter: 0,
        substance: 0,
        Heat: 0,
        Entropy: 0,
        Reactivity: 0,
        Energy: 0,
      },
      planetaryPositions: [],
      loading: false,
      error: 'Test error',
      refresh: vi.fn(),
    })

    render(<TokenStabilizationMonitor />)

    expect(screen.getByText('Token Stabilization Monitor')).toBeInTheDocument()
  })
})
