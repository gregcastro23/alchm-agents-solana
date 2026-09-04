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

    pub fn propose_admin(ctx: Context<ProposeAdmin>, new_admin: Pubkey) -> Result<()> {
        config::propose_admin(ctx, new_admin)
    }

    pub fn accept_admin(ctx: Context<AcceptAdmin>) -> Result<()> {
        config::accept_admin(ctx)
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

    pub fn stake_star(ctx: Context<StakeStar>, star_id: u32, usdc_amount: u64) -> Result<()> {
        staking::stake_star(ctx, star_id, usdc_amount)
    }

    pub fn unstake_star(ctx: Context<UnstakeStar>, star_id: u32, shares: u64) -> Result<()> {
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

    pub fn register_pool(
        ctx: Context<RegisterPool>,
        pool_id: u16,
        element_a: u8,
        element_b: u8,
        fee_bps: u16,
    ) -> Result<()> {
        amm::register_pool(ctx, pool_id, element_a, element_b, fee_bps)
    }

    pub fn bootstrap_pool(
        ctx: Context<BootstrapPool>,
        pool_id: u16,
        reserve_a: u64,
        reserve_b: u64,
    ) -> Result<()> {
        amm::bootstrap_pool(ctx, pool_id, reserve_a, reserve_b)
    }

    pub fn set_pool_pause(ctx: Context<SetPoolPause>, pool_id: u16, paused: bool) -> Result<()> {
        amm::set_pool_pause(ctx, pool_id, paused)
    }

    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        pool_id: u16,
        amt_a: u64,
        amt_b: u64,
        min_shares: u64,
        region_commit: [u8; 32],
        visible_stars: u8,
        nonce: u64,
        deadline: i64,
    ) -> Result<()> {
        amm::add_liquidity(
            ctx,
            pool_id,
            amt_a,
            amt_b,
            min_shares,
            region_commit,
            visible_stars,
            nonce,
            deadline,
        )
    }

    pub fn swap_esms(
        ctx: Context<SwapEsms>,
        pool_id: u16,
        in_element: u8,
        in_amount: u64,
        min_out: u64,
        region_commit: [u8; 32],
        visible_stars: u8,
        nonce: u64,
        deadline: i64,
    ) -> Result<()> {
        amm::swap_esms(
            ctx,
            pool_id,
            in_element,
            in_amount,
            min_out,
            region_commit,
            visible_stars,
            nonce,
            deadline,
        )
    }

    pub fn withdraw_liquidity(
        ctx: Context<WithdrawLiquidity>,
        pool_id: u16,
        share_bps: u16,
    ) -> Result<()> {
        amm::withdraw_liquidity(ctx, pool_id, share_bps)
    }
}
