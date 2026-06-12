#!/usr/bin/env node
/**
 * Next.js Security Upgrade Script
 * Upgrades Next.js to patched version to fix CVE-2025-55182 (React2Shell)
 *
 * Usage:
 *   node scripts/upgrade-nextjs-security.js [version]
 *
 * Examples:
 *   node scripts/upgrade-nextjs-security.js           # Auto-detect and upgrade to patched version
 *   node scripts/upgrade-nextjs-security.js 15.2.6    # Upgrade to specific version
 *   node scripts/upgrade-nextjs-security.js latest    # Upgrade to latest stable
 */

import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')
const packageJsonPath = join(rootDir, 'package.json')

// Patched versions by minor version
const PATCHED_VERSIONS = {
  '15.0': '15.0.5',
  15.1: '15.1.9',
  15.2: '15.2.6',
  15.3: '15.3.6',
  15.4: '15.4.8',
  15.5: '15.5.7',
  '16.0': '16.0.7',
}

// Vulnerable version ranges
const VULNERABLE_RANGES = [
  { min: '15.0.0', max: '15.0.4' },
  { min: '15.1.0', max: '15.1.8' },
  { min: '15.2.0', max: '15.2.5' },
  { min: '15.3.0', max: '15.3.5' },
  { min: '15.4.0', max: '15.4.7' },
  { min: '15.5.0', max: '15.5.6' },
  { min: '16.0.0', max: '16.0.6' },
]

function isVulnerable(version) {
  return VULNERABLE_RANGES.some(range => {
    return version >= range.min && version <= range.max
  })
}

function getPatchedVersion(currentVersion) {
  const [major, minor] = currentVersion.split('.').map(Number)
  const minorKey = `${major}.${minor}`
  return PATCHED_VERSIONS[minorKey] || null
}

function parseVersion(version) {
  // Remove ^, ~, >=, etc.
  return version.replace(/^[\^~>=<]+/, '')
}

function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0
    if (p1 < p2) return -1
    if (p1 > p2) return 1
  }
  return 0
}

function readPackageJson() {
  try {
    const content = readFileSync(packageJsonPath, 'utf8')
    return JSON.parse(content)
  } catch (error) {
    console.error('❌ Error reading package.json:', error.message)
    process.exit(1)
  }
}

function writePackageJson(pkg) {
  try {
    writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n')
  } catch (error) {
    console.error('❌ Error writing package.json:', error.message)
    process.exit(1)
  }
}

function getCurrentVersion() {
  const pkg = readPackageJson()
  const nextVersion = pkg.dependencies?.next || pkg.devDependencies?.next
  if (!nextVersion) {
    console.error('❌ Next.js not found in package.json')
    process.exit(1)
  }
  return parseVersion(nextVersion)
}

async function getLatestVersion() {
  try {
    const output = execSync('yarn info next version --json', { encoding: 'utf8' })
    return JSON.parse(output).data.trim()
  } catch (error) {
    console.warn('⚠️  Could not fetch latest version, using 16.0.7 as fallback')
    return '16.0.7'
  }
}

function upgradePackageJson(targetVersion) {
  const pkg = readPackageJson()
  let updated = false

  // Update next in dependencies
  if (pkg.dependencies?.next) {
    const current = parseVersion(pkg.dependencies.next)
    pkg.dependencies.next = targetVersion
    updated = true
    console.log(`  ✓ Updated dependencies.next: ${current} → ${targetVersion}`)
  }

  // Update next in devDependencies
  if (pkg.devDependencies?.next) {
    const current = parseVersion(pkg.devDependencies.next)
    pkg.devDependencies.next = targetVersion
    updated = true
    console.log(`  ✓ Updated devDependencies.next: ${current} → ${targetVersion}`)
  }

  // Update @next packages
  const nextPackages = ['@next/bundle-analyzer', '@next/eslint-plugin-next', 'eslint-config-next']

  nextPackages.forEach(pkgName => {
    if (pkg.devDependencies?.[pkgName]) {
      const current = parseVersion(pkg.devDependencies[pkgName])
      pkg.devDependencies[pkgName] = targetVersion
      updated = true
      console.log(`  ✓ Updated devDependencies.${pkgName}: ${current} → ${targetVersion}`)
    }
  })

  // Update optionalDependencies
  if (pkg.optionalDependencies) {
    Object.keys(pkg.optionalDependencies).forEach(key => {
      if (key.startsWith('@next/')) {
        const current = parseVersion(pkg.optionalDependencies[key])
        pkg.optionalDependencies[key] = targetVersion
        updated = true
        console.log(`  ✓ Updated optionalDependencies.${key}: ${current} → ${targetVersion}`)
      }
    })
  }

  if (updated) {
    writePackageJson(pkg)
  }

  return updated
}

async function main() {
  console.log('🔒 Next.js Security Upgrade Script')
  console.log('===================================\n')

  const currentVersion = getCurrentVersion()
  console.log(`📦 Current Next.js version: ${currentVersion}`)

  // Check if vulnerable
  if (!isVulnerable(currentVersion)) {
    console.log('✅ Your version is NOT vulnerable to CVE-2025-55182')
    console.log('   No upgrade needed.')
    process.exit(0)
  }

  console.log('⚠️  VULNERABLE to CVE-2025-55182 (React2Shell)')
  console.log('   Upgrade required!\n')

  // Determine target version
  let targetVersion = process.argv[2]

  if (!targetVersion || targetVersion === 'auto') {
    const patchedVersion = getPatchedVersion(currentVersion)
    if (patchedVersion) {
      targetVersion = patchedVersion
      console.log(`🎯 Auto-selected patched version: ${targetVersion}`)
    } else {
      console.error('❌ Could not auto-determine patched version')
      console.log('   Please specify version: node scripts/upgrade-nextjs-security.js 15.2.6')
      process.exit(1)
    }
  } else if (targetVersion === 'latest') {
    targetVersion = await getLatestVersion()
    console.log(`🎯 Upgrading to latest stable: ${targetVersion}`)
  } else {
    console.log(`🎯 Target version: ${targetVersion}`)
  }

  // Validate target version is not vulnerable
  if (isVulnerable(targetVersion)) {
    console.error(`❌ Target version ${targetVersion} is also vulnerable!`)
    console.log('   Please use a patched version:')
    Object.entries(PATCHED_VERSIONS).forEach(([minor, patch]) => {
      console.log(`     ${minor}.x → ${patch}`)
    })
    process.exit(1)
  }

  // Validate target is newer
  if (compareVersions(targetVersion, currentVersion) < 0) {
    console.warn(`⚠️  Target version ${targetVersion} is older than current ${currentVersion}`)
    console.log('   Proceeding anyway...\n')
  }

  console.log('\n📝 Updating package.json...')
  const updated = upgradePackageJson(targetVersion)

  if (!updated) {
    console.error('❌ No packages were updated')
    process.exit(1)
  }

  console.log('\n✅ package.json updated successfully!')
  console.log('\n📦 Next steps:')
  console.log('   1. Run: yarn install')
  console.log('   2. Run: yarn build (to test)')
  console.log('   3. Test your application')
  console.log('   4. Deploy to production')
  console.log('\n📚 See docs/REACT2SHELL_SECURITY.md for more information')
}

main().catch(error => {
  console.error('❌ Error:', error.message)
  process.exit(1)
})
