# Canonical ESMS price contract

`alchm.kitchen` is the sole authority for ESMS price-index snapshots.
`app/api/economy/price-index/route.ts` is a validated HTTP adapter that returns
that snapshot unchanged; it must not acquire its own formula or fallback quote.

This repo remains authoritative for Solana identity: the Token-2022 program,
mint PDAs, decimals and explorer links. The client joins those identities onto
the canonical quote after fetching it. Chain deployment does not establish a
USD price.

The four displayed numbers are dimensionless index points, not USD or SOL
market prices. The canonical payload's separately named mint and redeem rails
are the only currency values. On upstream or contract failure, render the
oracle as offline with no token values.

The full ruling and mathematical basis live in Kitchen ADR-013,
`docs/adr/013-cross-site-esms-price-contract.md`.
