pub const PROGRAM_AUTHORITY_SEED: &[u8] = b"program_authority";
pub const ESMS_MINT_SEED: &[u8] = b"esms_mint";
pub const PERSONA_COMMITMENT_SEED: &[u8] = b"persona_commitment";
pub const CLAIM_RECEIPT_SEED: &[u8] = b"claim_receipt";
pub const ORDER_RECEIPT_SEED: &[u8] = b"order_receipt";
pub const STAR_VAULT_SEED: &[u8] = b"star-vault";
pub const STAR_POOL_SEED: &[u8] = b"star-pool";
pub const STAKE_POSITION_SEED: &[u8] = b"stake";
pub const CONSTELLATION_POOL_SEED: &[u8] = b"constellation_pool";
pub const DEED_POSITION_SEED: &[u8] = b"deed";
pub const AMM_NONCE_SEED: &[u8] = b"amm_nonce";
pub const PENDING_ADMIN_SEED: &[u8] = b"pending_admin";

pub const STATE_VERSION: u8 = 1;
pub const ESMS_MINT_COUNT: usize = 4;
pub const ESMS_DECIMALS: u8 = 4;
pub const USDC_DECIMALS: u8 = 6;
pub const MAX_LEDGER_ATOMS: u64 = 999_999_999_999;
pub const SECONDS_PER_DAY: i64 = 86_400;
pub const USDC_SCALE: u128 = 1_000_000;

/// Maximum allowable yield rate: 100,000.0000 ESMS atoms per USDC per day.
/// Derived from 20,000x baseline (5.0000 ESMS/USDC/day) to accommodate extreme
/// celestial resonance surges while preventing administrative typo overflows.
pub const MAX_YIELD_RATE_PER_USDC_DAY: u64 = 1_000_000_0000;

/// Maximum allowable Merkle proof depth (32 nodes covers 2^32 entries).
pub const MAX_STAR_PROOF_DEPTH: usize = 32;

/// Maximum allowable swap fee in basis points (10% = 1,000 bps).
pub const MAX_FEE_BPS: u16 = 1_000;

/// Maximum allowable virtual reserve per element on pool bootstrap (100,000.0000 ESMS).
pub const MAX_BOOTSTRAP_RESERVE: u64 = 100_000_0000;

/// Minimum initial virtual liquidity shares on bootstrap floor (1,000).
pub const MINIMUM_LIQUIDITY: u64 = 1_000;

/// Ratio tolerance basis points for liquidity additions (1% = 100 bps).
pub const RATIO_TOLERANCE_BPS: u64 = 100;

/// Basis point denominator (10,000 = 100%).
pub const BPS_DENOMINATOR: u64 = 10_000;

/// Operation discriminator for AMM visibility attestations.
pub const AMM_OP_ADD_LIQUIDITY: u8 = 0;
pub const AMM_OP_SWAP: u8 = 1;

/// Maximum pool identifier index (6 canonical pairs: pool_id 0..=5).
pub const MAX_AMM_POOLS: u16 = 5;

pub const PERMISSIONED_BURN_EXTENSION_TYPE: u16 = 28;
pub const PERMISSIONED_BURN_INSTRUCTION_TAG: u8 = 46;
pub const PERMISSIONED_BURN_INITIALIZE_TAG: u8 = 0;
pub const PERMISSIONED_BURN_BURN_CHECKED_TAG: u8 = 2;

pub const ED25519_OFFSETS_SIZE: usize = 14;
pub const ED25519_SIGNATURE_SIZE: usize = 64;
pub const ED25519_PUBLIC_KEY_SIZE: usize = 32;
pub const REDEEM_AUTHORIZATION_DOMAIN: &[u8] = b"ASOL_ESMS_REDEEM_V1";
pub const STAR_YIELD_AUTHORIZATION_DOMAIN: &[u8] = b"ASOL_STAR_YIELD_V1";
pub const AMM_VISIBILITY_AUTHORIZATION_DOMAIN: &[u8] = b"ASOL_AMM_VISIBILITY_V1";

pub const ESMS_NAMES: [&str; ESMS_MINT_COUNT] = ["Spirit", "Essence", "Matter", "Substance"];
pub const ESMS_SYMBOLS: [&str; ESMS_MINT_COUNT] = ["SPIRIT", "ESSENCE", "MATTER", "SUBSTANCE"];
pub const ESMS_METADATA_URIS: [&str; ESMS_MINT_COUNT] = [
    "https://arweave.net/BP4XXynxmnRB4ZSqTAvvjdZARPpGD6Kxgcj2YH1tXpWE",
    "https://arweave.net/HdtPTVqm9GdKFX2F7a7je1vApcXSuEcpVXMS353kDhAo",
    "https://arweave.net/5AGdZFaNba8A5Zke23j7K85oPihQzUmpn7QKoz4dGgFe",
    "https://arweave.net/3xzDcPZn1h9Ss91kaTeCWjSBsPBWczcETECFfvJe68YY",
];

pub const REDEMPTION_MODE_SELF: u8 = 0;
pub const REDEMPTION_MODE_SPONSORED: u8 = 1;
