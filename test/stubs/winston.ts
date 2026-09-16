/**
 * Minimal `winston` stand-in for the root vitest suite.
 *
 * `backend/src/**` is a separate Bun service with its own package.json, and
 * winston is one of its dependencies — it is not installed at the repo root.
 * Root tests that import backend modules for their pure logic (the pentacles
 * strategy functions, the thermodynamics helpers) drag in `utils/logger.ts`
 * transitively, and Vite fails to resolve the import at transform time, which
 * takes the whole file down before a single test runs.
 *
 * Installing winston at the root would add a production dependency to satisfy a
 * test. Aliasing it here keeps the root tree honest. Nothing under test asserts
 * on logging behaviour; if that ever changes, this stub is the wrong tool.
 */

type Formatter = { transform: (info: unknown) => unknown }

const formatter: Formatter = { transform: (info: unknown) => info }
const makeFormatter = () => formatter

// `winston.format` is both callable — `winston.format(fn)()` — and a namespace
// of named formatters. Mirror both shapes.
const format: any = (_fn?: unknown) => makeFormatter
format.combine = (..._args: unknown[]) => formatter
format.timestamp = makeFormatter
format.colorize = makeFormatter
format.printf = (_fn?: unknown) => formatter
format.errors = makeFormatter
format.json = makeFormatter
format.simple = makeFormatter
format.splat = makeFormatter
format.label = makeFormatter

class ConsoleTransport {
  constructor(_options?: unknown) {}
}
class FileTransport {
  constructor(_options?: unknown) {}
}

export const transports = { Console: ConsoleTransport, File: FileTransport }

const noop = () => undefined

export function createLogger(_options?: unknown) {
  return {
    error: noop,
    warn: noop,
    info: noop,
    http: noop,
    verbose: noop,
    debug: noop,
    silly: noop,
    log: noop,
    add: noop,
    remove: noop,
    close: noop,
    child: () => createLogger(),
  }
}

export { format }

export default { format, transports, createLogger }
