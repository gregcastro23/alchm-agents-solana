pub const PROGRAM_AUTHORITY_SEED: &[u8] = b"program_authority";
pub const ESMS_MINT_SEED: &[u8] = b"esms_mint";
pub const PERSONA_COMMITMENT_SEED: &[u8] = b"persona_commitment";
pub const CLAIM_RECEIPT_SEED: &[u8] = b"claim_receipt";
pub const ORDER_RECEIPT_SEED: &[u8] = b"order_receipt";
pub const STAR_VAULT_SEED: &[u8] = b"star-vault";
pub const STAR_POOL_SEED: &[u8] = b"star-pool";
pub const STAKE_POSITION_SEED: &[u8] = b"stake";

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


pub const PERMISSIONED_BURN_EXTENSION_TYPE: u16 = 28;
pub const PERMISSIONED_BURN_INSTRUCTION_TAG: u8 = 46;
pub const PERMISSIONED_BURN_INITIALIZE_TAG: u8 = 0;
pub const PERMISSIONED_BURN_BURN_CHECKED_TAG: u8 = 2;

pub const ED25519_OFFSETS_SIZE: usize = 14;
pub const ED25519_SIGNATURE_SIZE: usize = 64;
pub const ED25519_PUBLIC_KEY_SIZE: usize = 32;
pub const REDEEM_AUTHORIZATION_DOMAIN: &[u8] = b"ASOL_ESMS_REDEEM_V1";
pub const STAR_YIELD_AUTHORIZATION_DOMAIN: &[u8] = b"ASOL_STAR_YIELD_V1";

pub const ESMS_NAMES: [&str; ESMS_MINT_COUNT] = ["Spirit", "Essence", "Matter", "Substance"];
pub const ESMS_SYMBOLS: [&str; ESMS_MINT_COUNT] = ["SPIRIT", "ESSENCE", "MATTER", "SUBSTANCE"];
pub const ESMS_METADATA_URIS: [&str; ESMS_MINT_COUNT] = [
    "https://alchm.kitchen/metadata/esms/spirit.json",
    "https://alchm.kitchen/metadata/esms/essence.json",
    "https://alchm.kitchen/metadata/esms/matter.json",
    "https://alchm.kitchen/metadata/esms/substance.json",
];

pub const REDEMPTION_MODE_SELF: u8 = 0;
pub const REDEMPTION_MODE_SPONSORED: u8 = 1;

