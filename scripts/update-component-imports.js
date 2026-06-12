#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

/**
 * Update component imports after reorganization
 */

// Component mapping from old to new paths
const componentMapping = {
  // Agents
  'agent-card': 'agents/agent-card',
  'agent-dashboard': 'agents/agent-dashboard',
  'agent-detail-modal': 'agents/agent-detail-modal',
  'agent-detailed-stats': 'agents/agent-detailed-stats',
  'agent-evolution-display': 'agents/agent-evolution-display',
  'agent-kinetic-evolution': 'agents/agent-kinetic-evolution',
  'agent-recommendation-system': 'agents/agent-recommendation-system',
  'agent-recommendations-widget': 'agents/agent-recommendations-widget',
  'agent-attachments-manager': 'agents/agent-attachments-manager',
  'consciousness-crafted-agents-showcase': 'agents/consciousness-crafted-agents-showcase',
  'consciousness-laboratory-chat': 'agents/consciousness-laboratory-chat',
  'consciousness-survey': 'agents/consciousness-survey',
  'consciousness-velocity-visualizer': 'agents/consciousness-velocity-visualizer',

  // Charts
  'chart-transform-visualization': 'charts/chart-transform-visualization',
  'aspect-grid': 'charts/aspect-grid',
  'aspect-phase-indicator': 'charts/aspect-phase-indicator',
  'circular-natal-horoscope': 'charts/circular-natal-horoscope',
  'dynamic-aspects-indicators': 'charts/dynamic-aspects-indicators',
  'dynamic-aspects-visualizer': 'charts/dynamic-aspects-visualizer',
  'elemental-chart': 'charts/elemental-chart',
  'enhanced-chart-display': 'charts/enhanced-chart-display',
  'interactive-chart-teacher': 'charts/interactive-chart-teacher',
  'kinetic-compatibility-indicator': 'charts/kinetic-compatibility-indicator',
  'kinetic-indicators': 'charts/kinetic-indicators',
  'kinetics-chart-pane': 'charts/kinetics-chart-pane',
  'multi-chart-input': 'charts/multi-chart-input',
  'quick-chart-input': 'charts/quick-chart-input',
  'real-time-kinetics-widget': 'charts/real-time-kinetics-widget',
  'saved-charts-manager': 'charts/saved-charts-manager',
  'sign-vector-graphic': 'charts/sign-vector-graphic',
  'alchemical-metrics-chart': 'charts/alchemical-metrics-chart',

  // Dashboards
  'alchemical-consciousness-dashboard': 'dashboards/alchemical-consciousness-dashboard',
  'batch-processing-dashboard': 'dashboards/batch-processing-dashboard',
  'character-vector-dashboard': 'dashboards/character-vector-dashboard',
  'enhanced-tarot-dashboard': 'dashboards/enhanced-tarot-dashboard',
  'galileo-dashboard': 'dashboards/galileo-dashboard',
  PlanetaryPositionIndicator: 'dashboards/PlanetaryPositionIndicator',
  PlanetaryPositionsMonitor: 'dashboards/PlanetaryPositionsMonitor',
  'synastry-compatibility-dashboard': 'dashboards/synastry-compatibility-dashboard',
  'token-dashboard-kinetics': 'dashboards/token-dashboard-kinetics',
  TokenMonitorIntegration: 'dashboards/TokenMonitorIntegration',
  'universe-connection-dashboard': 'dashboards/universe-connection-dashboard',

  // Tarot
  'monica-tarot-oracle': 'tarot/monica-tarot-oracle',
  'monica-tarot-spreads': 'tarot/monica-tarot-spreads',
  'unified-tarot-system': 'tarot/unified-tarot-system',

  // Wizards
  AgentCreationWizard: 'wizards/AgentCreationWizard',
  'create-ai-wizard': 'wizards/create-ai-wizard',

  // Misc
  'alchm-quantities-display': 'misc/alchm-quantities-display',
  'alchm-quantities-trends': 'misc/alchm-quantities-trends',
  'ancient-gallery': 'misc/ancient-gallery',
  'cosmic-time-laboratory': 'misc/cosmic-time-laboratory',
  'enhanced-agent-card': 'misc/enhanced-agent-card',
  FallbackNotification: 'misc/FallbackNotification',
  'galileo-logger': 'misc/galileo-logger',
  'gallery-group-chat': 'misc/gallery-group-chat',
  'group-consciousness-indicator': 'misc/group-consciousness-indicator',
  HarmonicAnalysisBridge: 'misc/HarmonicAnalysisBridge',
  header: 'misc/header',
  'historical-council-chat': 'misc/historical-council-chat',
  'historical-transit-card': 'misc/historical-transit-card',
  'moment-based-recommendations': 'misc/moment-based-recommendations',
  'monica-chat-interface': 'misc/monica-chat-interface',
  'monica-style-cards': 'misc/monica-style-cards',
  'moon-phase-agent-chat': 'misc/moon-phase-agent-chat',
  'multi-agent-chat': 'misc/multi-agent-chat',
  'natal-sigil-generator': 'misc/natal-sigil-generator',
  'personalized-ai-chat': 'misc/personalized-ai-chat',
  'planetary-wisdom-chat': 'misc/planetary-wisdom-chat',
  'power-hour-notification': 'misc/power-hour-notification',
  'realtime-rune-display': 'misc/realtime-rune-display',
  'relational-astrology-trainer': 'misc/relational-astrology-trainer',
  'runes-preview': 'misc/runes-preview',
  'survey-question-component': 'misc/survey-question-component',
  'tarot-agent-chat': 'misc/tarot-agent-chat',
  'tarot-cosmic-widget': 'misc/tarot-cosmic-widget',
  'tarot-enhanced-layout': 'misc/tarot-enhanced-layout',
  'temporal-oracle': 'misc/temporal-oracle',
  'temporal-timeline': 'misc/temporal-timeline',
  'theme-provider': 'misc/theme-provider',
  'unified-multi-agent-chat': 'misc/unified-multi-agent-chat',
}

function updateImportsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8')
    let updated = false

    // Update import statements
    for (const [component, newPath] of Object.entries(componentMapping)) {
      const oldImportRegex = new RegExp(`from ['"]@/components/${component}['"]`, 'g')
      const newImport = `from '@/components/${newPath}'`

      if (oldImportRegex.test(content)) {
        content = content.replace(oldImportRegex, newImport)
        updated = true
      }
    }

    if (updated) {
      fs.writeFileSync(filePath, content, 'utf8')
      console.log(`Updated imports in: ${filePath}`)
    }
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error.message)
  }
}

function findFilesWithImports() {
  try {
    // Find all TypeScript/JavaScript files that might have component imports
    const result = execSync(
      'find . -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" | grep -v node_modules | grep -v .next | grep -v dist',
      { encoding: 'utf8' }
    )

    return result.trim().split('\n').filter(Boolean)
  } catch (error) {
    console.error('Error finding files:', error.message)
    return []
  }
}

function main() {
  console.log('Starting import updates...')

  const files = findFilesWithImports()
  console.log(`Found ${files.length} files to check`)

  let updatedCount = 0
  for (const file of files) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8')
      const hasOldImports = Object.keys(componentMapping).some(component =>
        content.includes(`@/components/${component}`)
      )

      if (hasOldImports) {
        updateImportsInFile(file)
        updatedCount++
      }
    }
  }

  console.log(`Updated imports in ${updatedCount} files`)
  console.log('Import updates complete!')
}

if (require.main === module) {
  main()
}
