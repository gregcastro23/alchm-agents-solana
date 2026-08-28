#!/usr/bin/env node
/**
 * `anchor build` wrapper that fails on SBF stack-frame overflow.
 *
 * The SBF linker reports a `try_accounts` frame over 4 KiB as
 *
 *   Error: Function <mangled> Stack offset of 4160 exceeded max offset of 4096 by 64 bytes
 *
 * and then **exits 0 and writes a .so anyway**. The resulting program faults with
 * "Access violation in unknown section at address 0x0" on every call to the
 * affected instruction. That is exactly how Phase 6's `add_liquidity` and
 * `withdraw_liquidity` shipped broken until the litesvm suite executed them: no
 * unit test, type check, or IDL build notices it. A build that emits this must
 * not look like a build that succeeded.
 *
 * Fix an overflow by boxing the account: `Box<Account<'info, T>>` /
 * `Box<InterfaceAccount<'info, T>>`, which moves it to the 32 KiB heap.
 */
import { spawn } from 'node:child_process'

const STACK_OVERFLOW = /Stack offset of (\d+) exceeded max offset of (\d+) by (\d+) bytes/
const FUNCTION_NAME = /Function\s+(\S+)\s+Stack offset/

const child = spawn('anchor', ['build', ...process.argv.slice(2)], {
  env: { ...process.env, RUSTC_BOOTSTRAP: '1', RUSTUP_TOOLCHAIN: '1.79.0' },
  stdio: ['inherit', 'pipe', 'pipe'],
})

const overflows = []

function watch(stream, sink) {
  let carry = ''
  stream.on('data', chunk => {
    sink.write(chunk)
    carry += chunk.toString()
    const lines = carry.split('\n')
    carry = lines.pop() ?? ''
    for (const line of lines) {
      const overflow = STACK_OVERFLOW.exec(line)
      if (overflow) {
        overflows.push({
          fn: FUNCTION_NAME.exec(line)?.[1] ?? '<unknown>',
          offset: Number(overflow[1]),
          max: Number(overflow[2]),
          over: Number(overflow[3]),
        })
      }
    }
  })
}

watch(child.stdout, process.stdout)
watch(child.stderr, process.stderr)

child.on('close', code => {
  if (code !== 0) {
    process.exit(code ?? 1)
  }
  if (overflows.length > 0) {
    console.error(
      `\n\x1b[31manchor build exited 0 but the SBF linker reported ${overflows.length} stack-frame overflow(s).\x1b[0m`
    )
    console.error('The emitted .so will fault at runtime on every call to these instructions.\n')
    for (const { fn, offset, max, over } of overflows) {
      console.error(`  ${fn}\n    ${offset} bytes, ${over} over the ${max}-byte limit`)
    }
    console.error(
      '\nBox the account(s) in the offending #[derive(Accounts)] struct:\n' +
        "  pub foo: Account<'info, T>          ->  pub foo: Box<Account<'info, T>>\n" +
        "  pub bar: InterfaceAccount<'info, T> ->  pub bar: Box<InterfaceAccount<'info, T>>\n"
    )
    process.exit(1)
  }
})
