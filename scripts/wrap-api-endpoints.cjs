#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

/**
 * Wrap API endpoints with withErrorHandling
 */

function wrapApiEndpoint(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8')

    // Skip if already wrapped
    if (
      content.includes('withErrorHandling') ||
      content.includes('AgentErrorHandler.executeWithFallback')
    ) {
      console.log(`Already wrapped: ${filePath}`)
      return false
    }

    // Add import for withErrorHandling if not present
    if (!content.includes('import { withErrorHandling }')) {
      // Find the last import line
      const importLines = content.split('\n').filter(line => line.trim().startsWith('import'))
      if (importLines.length > 0) {
        const lastImportIndex = content.lastIndexOf(importLines[importLines.length - 1])
        const insertPoint = lastImportIndex + importLines[importLines.length - 1].length + 1

        const importStatement = "import { withErrorHandling } from '@/lib/error-handling'\n"
        content = content.slice(0, insertPoint) + importStatement + content.slice(insertPoint)
      }
    }

    // Wrap GET function
    content = wrapFunction(content, 'GET', filePath)

    // Wrap POST function
    content = wrapFunction(content, 'POST', filePath)

    // Wrap PUT function
    content = wrapFunction(content, 'PUT', filePath)

    // Wrap DELETE function
    content = wrapFunction(content, 'DELETE', filePath)

    fs.writeFileSync(filePath, content, 'utf8')
    console.log(`Wrapped: ${filePath}`)
    return true
  } catch (error) {
    console.error(`Error wrapping ${filePath}:`, error.message)
    return false
  }
}

function wrapFunction(content, method, filePath) {
  const exportRegex = new RegExp(`export async function ${method}\\b([^)]*\\))([^}]+)`, 's')
  const match = content.match(exportRegex)

  if (!match) {
    return content // Function doesn't exist
  }

  const functionSignature = match[1]
  const functionBody = match[2]

  // Extract function name and parameters for context
  const functionMatch = functionSignature.match(/function (\w+)/)
  if (!functionMatch) return content

  // Create wrapped version
  const endpointPath = path
    .relative('app/api', filePath)
    .replace('/route.ts', '')
    .replace(/\//g, '_')
  const wrappedBody = `
  return withErrorHandling(
    async () => {
${functionBody.trim()}
    },
    {
      system: 'api',
      operation: '${endpointPath}_${method.toLowerCase()}',
      severity: 'high',
    }
  ).then(result => {
    if (result.success === false) {
      return NextResponse.json(
        {
          success: false,
          error: result.userMessage,
          context: result.context
        },
        { status: 500 }
      );
    }
    return result;
  }).catch(error => {
    console.error('Unexpected error in ${endpointPath}:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred',
        context: { system: 'api', operation: '${endpointPath}_${method.toLowerCase()}' }
      },
      { status: 500 }
    );
  });`

  const wrappedFunction = `export async function ${method}${functionSignature}${wrappedBody}`

  return content.replace(match[0], wrappedFunction)
}

function findApiRoutes() {
  const routes = []

  function scanDir(dir) {
    const items = fs.readdirSync(dir)

    for (const item of items) {
      const fullPath = path.join(dir, item)
      const stat = fs.statSync(fullPath)

      if (stat.isDirectory()) {
        scanDir(fullPath)
      } else if (item === 'route.ts') {
        routes.push(fullPath)
      }
    }
  }

  scanDir('app/api')
  return routes
}

function main() {
  console.log('Starting API endpoint wrapping...')

  const routes = findApiRoutes()
  console.log(`Found ${routes.length} API routes`)

  let wrappedCount = 0
  for (const route of routes) {
    if (wrapApiEndpoint(route)) {
      wrappedCount++
    }
  }

  console.log(`Wrapped ${wrappedCount} API endpoints`)
  console.log('API wrapping complete!')
}

if (require.main === module) {
  main()
}
