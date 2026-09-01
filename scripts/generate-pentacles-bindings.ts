import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const projectRoot = resolve(import.meta.dir, '..')
const outputDirectory = join(projectRoot, 'lib', 'spacetime', 'generated')
const defaultModule = resolve(projectRoot, '..', 'Spacetimedbhackathon', 'Pentacles', 'server')

function valueAfter(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const moduleDirectory = resolve(
  valueAfter('--module') ?? process.env.PENTACLES_MODULE_PATH ?? defaultModule
)

if (!existsSync(join(moduleDirectory, 'Cargo.toml'))) {
  throw new Error(
    `Pentacles module not found at ${moduleDirectory}. Set PENTACLES_MODULE_PATH or pass --module.`
  )
}

const outputParent = dirname(outputDirectory)
const temporaryDirectory = mkdtempSync(join(outputParent, '.pentacles-bindings-'))

function patchUnitEnums(directory: string): void {
  const typesPath = join(directory, 'types.ts')
  let source = readFileSync(typesPath, 'utf8')
  const converted: string[] = []
  source = source.replace(
    /__t\.enum\(\s*"([A-Za-z0-9_]+)"\s*,\s*\{([\s\S]*?)\}\s*\)/g,
    (full, name: string, body: string) => {
      const entries = [...body.matchAll(/([A-Za-z0-9_]+)\s*:\s*__t\.([A-Za-z0-9_]+)\([^)]*\)/g)]
      if (entries.length === 0 || entries.some(entry => entry[2] !== 'unit')) return full
      converted.push(name)
      return `__t.enum("${name}", [${entries.map(entry => `"${entry[1]}"`).join(', ')}])`
    }
  )
  writeFileSync(typesPath, source)
  console.log(`Patched ${converted.length} unit enums for SpacetimeDB 2.6 primary-key support`)
}

function normalizeGeneratedFiles(directory: string): void {
  for (const relativePath of readdirSync(directory, { recursive: true }) as string[]) {
    if (!relativePath.endsWith('.ts')) continue
    const path = join(directory, relativePath)
    writeFileSync(path, `${readFileSync(path, 'utf8').trimEnd()}\n`)
  }
}

function formatGeneratedFiles(directory: string): void {
  const prettier = join(projectRoot, 'node_modules', '.bin', 'prettier')
  if (!existsSync(prettier)) {
    throw new Error('Prettier is required. Install dependencies before generating bindings.')
  }
  const result = spawnSync(prettier, ['--write', directory], {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`prettier exited with status ${result.status ?? 'unknown'}`)
  }
}

try {
  const result = spawnSync(
    'spacetime',
    [
      'generate',
      '--lang',
      'typescript',
      '--module-path',
      moduleDirectory,
      '--out-dir',
      temporaryDirectory,
      '--yes',
    ],
    { cwd: projectRoot, env: process.env, stdio: 'inherit' }
  )

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`spacetime generate exited with status ${result.status ?? 'unknown'}`)
  }

  // Mirrors Pentacles/scripts/patch-bindings.mjs. SpacetimeDB 2.6 emits
  // object-form unit enums without primaryKey(); array form is wire-equivalent.
  patchUnitEnums(temporaryDirectory)
  formatGeneratedFiles(temporaryDirectory)
  normalizeGeneratedFiles(temporaryDirectory)

  // Generation completed successfully; replace only the machine-owned directory.
  rmSync(outputDirectory, { recursive: true, force: true })
  renameSync(temporaryDirectory, outputDirectory)
  console.log(`Pentacles bindings generated at ${outputDirectory}`)
} catch (error) {
  rmSync(temporaryDirectory, { recursive: true, force: true })
  throw error
}
