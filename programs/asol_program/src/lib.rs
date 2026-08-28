#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;
pub mod vectors;

use instructions::*;

declare_id!("5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD");

#[program]
pub mod asol_program {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        attestor: Pubkey,
        pauser: Pubkey,
        cluster_domain: [u8; 32],
    ) -> Result<()> {
        config::initialize(ctx, attestor, pauser, cluster_domain)
    }

    pub fn set_pause_state(
        ctx: Context<SetPauseState>,
        pause_claims: bool,
        pause_redemptions: bool,
    ) -> Result<()> {
        config::set_pause_state(ctx, pause_claims, pause_redemptions)
    }

    pub fn set_service_authorities(
        ctx: Context<SetServiceAuthorities>,
        attestor: Pubkey,
        pauser: Pubkey,
    ) -> Result<()> {
        config::set_service_authorities(ctx, attestor, pauser)
    }

    pub fn initialize_esms_mints(ctx: Context<InitializeEsmsMints>) -> Result<()> {
        esms::initialize_mints(ctx)
    }

    pub fn claim_mint_esms(
        ctx: Context<ClaimMintEsms>,
        claim_id: [u8; 32],
        ledger_reference_hash: [u8; 32],
        amounts: [u64; 4],
    ) -> Result<()> {
        esms::claim_mint(ctx, claim_id, ledger_reference_hash, amounts)
    }

    pub fn redeem_esms(
        ctx: Context<RedeemEsms>,
        order_id: [u8; 32],
        amounts: [u64; 4],
    ) -> Result<()> {
        esms::redeem(ctx, order_id, amounts)
    }

    pub fn redeem_for_esms(
        ctx: Context<RedeemForEsms>,
        order_id: [u8; 32],
        amounts: [u64; 4],
        deadline: i64,
    ) -> Result<()> {
        esms::redeem_for(ctx, order_id, amounts, deadline)
    }

    pub fn record_persona_commitment(
        ctx: Context<RecordPersonaCommitment>,
        agent_id: [u8; 32],
        target_persona_hash: [u8; 32],
        epoch_hash: [u8; 32],
        sequence: u64,
    ) -> Result<()> {
        persona::record(ctx, agent_id, target_persona_hash, epoch_hash, sequence)
    }

    pub fn initialize_star_vault(
        ctx: Context<InitializeStarVault>,
        star_root: [u8; 32],
        max_yield_rate_per_usdc_day: u64,
    ) -> Result<()> {
        staking::initialize_star_vault(ctx, star_root, max_yield_rate_per_usdc_day)
    }

    pub fn set_star_vault_config(
        ctx: Context<SetStarVaultConfig>,
        star_root: Option<[u8; 32]>,
        max_yield_rate_per_usdc_day: Option<u64>,
    ) -> Result<()> {
        staking::set_star_vault_config(ctx, star_root, max_yield_rate_per_usdc_day)
    }

    pub fn activate_star(
        ctx: Context<ActivateStar>,
        star_id: u32,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        staking::activate_star(ctx, star_id, proof)
    }

    pub fn stake_star(
        ctx: Context<StakeStar>,
        star_id: u32,
        usdc_amount: u64,
    ) -> Result<()> {
        staking::stake_star(ctx, star_id, usdc_amount)
    }

    pub fn unstake_star(
        ctx: Context<UnstakeStar>,
        star_id: u32,
        shares: u64,
    ) -> Result<()> {
        staking::unstake_star(ctx, star_id, shares)
    }

    pub fn claim_star_yield(
        ctx: Context<ClaimStarYield>,
        star_id: u32,
        element_id: u8,
        amount: u64,
        nonce: u64,
        deadline: i64,
    ) -> Result<()> {
        staking::claim_star_yield(ctx, star_id, element_id, amount, nonce, deadline)
    }
}

