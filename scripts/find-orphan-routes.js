import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const apiDir = 'app/api'

function getRoutes(dir, prefix = '/api') {
  let routes = []
  const items = fs.readdirSync(dir, { withFileTypes: true })
  for (const item of items) {
    if (item.isDirectory()) {
      routes = routes.concat(getRoutes(path.join(dir, item.name), `${prefix}/${item.name}`))
    } else if (item.name === 'route.ts' || item.name === 'route.js') {
      // Remove dynamic segments for simpler grep
      const baseRoute = prefix.replace(/\[.*?\]/g, '')
      routes.push({ fullPath: path.join(dir, item.name), route: baseRoute })
    }
  }
  return routes
}

const allRoutes = getRoutes(apiDir)
console.log(`Found ${allRoutes.length} routes.`)

const orphanRoutes = []

for (const { fullPath, route } of allRoutes) {
  // Search for the route string in the codebase, excluding the app/api directory
  try {
    const command = `grep -r "${route}" . --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=app/api --exclude-dir=.git | wc -l`
    const count = parseInt(execSync(command).toString().trim())
    if (count === 0) {
      orphanRoutes.push({ fullPath, route })
    }
  } catch (e) {
    // Ignore errors
  }
}

console.log(`Found ${orphanRoutes.length} potential orphan routes:`)
orphanRoutes.forEach(r => console.log(`${r.route} (${r.fullPath})`))
