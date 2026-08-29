# Runtime test fixtures

## `spl_token_2022.so`

The SPL Token-2022 program as deployed on **Solana devnet**, dumped on
**2026-08-28**:

```bash
solana program dump -u devnet TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb \
  programs/asol_program/tests/fixtures/spl_token_2022.so
```

It is vendored rather than fetched at test time so the runtime suite is
hermetic and reproducible in CI.

**Why not litesvm's bundled copy:** `litesvm` ships
`spl_token_2022-1.0.0.so`, which predates the **Permissioned Burn**
extension (extension type 28, instruction tag 46). `asol_program` burns ESMS
through that extension, so every burn CPI would fail against the bundled
binary. The harness calls `add_program_from_file` _after_ `LiteSVM::new()` to
override it.

Verify the extension is present in a replacement dump before swapping this
file:

```bash
strings -a programs/asol_program/tests/fixtures/spl_token_2022.so \
  | grep -c PermissionedBurnExtension   # must be >= 1
```
