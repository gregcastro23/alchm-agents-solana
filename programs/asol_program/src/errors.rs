use anchor_lang::prelude::*;

#[error_code]
pub enum AsolError {
    #[msg("Unauthorized authority")]
    Unauthorized,
    #[msg("Claims are paused")]
    ClaimsPaused,
    #[msg("Redemptions are paused")]
    RedemptionsPaused,
    #[msg("A required public key cannot be the default key")]
    DefaultAuthority,
    #[msg("The cluster domain must be non-zero")]
    InvalidClusterDomain,
    #[msg("Persona commitments and agent IDs must be non-zero")]
    ZeroCommitment,
    #[msg("Persona sequence must begin at one and increment exactly once")]
    InvalidSequence,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("At least one ESMS amount must be non-zero")]
    EmptyAmounts,
    #[msg("An ESMS amount exceeds the Decimal(12,4) ledger domain")]
    AmountOutOfRange,
    #[msg("The Token-2022 program is invalid")]
    InvalidTokenProgram,
    #[msg("The ESMS mint account is invalid")]
    InvalidMint,
    #[msg("The ESMS mint extensions or authorities do not match protocol configuration")]
    InvalidMintExtensions,
    #[msg("The holder authorization has expired")]
    AuthorizationExpired,
    #[msg("The Ed25519 holder authorization is missing or invalid")]
    InvalidEd25519Authorization,
    #[msg("The receipt identifier or ledger reference must be non-zero")]
    ZeroReceiptIdentifier,
    #[msg("The source token account does not belong to the expected holder and mint")]
    InvalidTokenAccount,
    #[msg("The instruction sysvar account is invalid")]
    InvalidInstructionsSysvar,
    #[msg("Star has not been activated")]
    StarNotActivated,
    #[msg("Invalid Merkle proof for star activation")]
    InvalidStarProof,
    #[msg("Insufficient pool shares for unstaking")]
    InsufficientShares,
    #[msg("Requested yield exceeds dynamic accrued yield cap")]
    YieldExceedsCap,
    #[msg("Invalid element identifier (must be 0..3)")]
    InvalidElement,
    #[msg("Invalid yield claim nonce")]
    InvalidYieldNonce,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("The vault or star pool state is invalid")]
    InvalidVault,
    #[msg("Yield rate exceeds the protocol safety ceiling")]
    RateExceedsCeiling,
    #[msg("Star registry Merkle root has not been initialized")]
    StarRootUnset,
    #[msg("Merkle proof exceeds maximum depth of 32 nodes")]
    ProofTooDeep,
    #[msg("Vault USDC mint carries unsupported extensions")]
    InvalidVaultMintExtensions,
}


