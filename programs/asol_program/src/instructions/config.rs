use anchor_lang::prelude::*;

use crate::{
    constants::{PENDING_ADMIN_SEED, PROGRAM_AUTHORITY_SEED, STATE_VERSION},
    errors::AsolError,
    program::AsolProgram,
    state::{PendingAdmin, ProgramConfig},
};

pub fn initialize(
    ctx: Context<InitializeConfig>,
    attestor: Pubkey,
    pauser: Pubkey,
    cluster_domain: [u8; 32],
) -> Result<()> {
    require_keys_neq!(attestor, Pubkey::default(), AsolError::DefaultAuthority);
    require_keys_neq!(pauser, Pubkey::default(), AsolError::DefaultAuthority);
    require!(
        cluster_domain != [0_u8; 32],
        AsolError::InvalidClusterDomain
    );

    ctx.accounts.program_config.set_inner(ProgramConfig {
        version: STATE_VERSION,
        admin: ctx.accounts.admin.key(),
        attestor,
        pauser,
        cluster_domain,
        pause_claims: false,
        pause_redemptions: false,
        bump: ctx.bumps.program_config,
    });
    Ok(())
}

pub fn set_pause_state(
    ctx: Context<SetPauseState>,
    pause_claims: bool,
    pause_redemptions: bool,
) -> Result<()> {
    require!(
        ctx.accounts
            .program_config
            .can_pause(&ctx.accounts.authority.key()),
        AsolError::Unauthorized
    );
    ctx.accounts.program_config.pause_claims = pause_claims;
    ctx.accounts.program_config.pause_redemptions = pause_redemptions;
    Ok(())
}

pub fn set_service_authorities(
    ctx: Context<SetServiceAuthorities>,
    attestor: Pubkey,
    pauser: Pubkey,
) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.authority.key(),
        ctx.accounts.program_config.admin,
        AsolError::Unauthorized
    );
    ctx.accounts.program_config.attestor = attestor;
    ctx.accounts.program_config.pauser = pauser;
    Ok(())
}

pub fn propose_admin(ctx: Context<ProposeAdmin>, new_admin: Pubkey) -> Result<()> {
    require_keys_neq!(new_admin, Pubkey::default(), AsolError::DefaultAuthority);
    require_keys_neq!(
        new_admin,
        ctx.accounts.program_config.admin,
        AsolError::Unauthorized
    );
    ctx.accounts.pending_admin.set_inner(PendingAdmin {
        pending_admin: new_admin,
        bump: ctx.bumps.pending_admin,
    });
    Ok(())
}

pub fn accept_admin(ctx: Context<AcceptAdmin>) -> Result<()> {
    ctx.accounts.program_config.admin = ctx.accounts.authority.key();
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + ProgramConfig::INIT_SPACE,
        seeds = [PROGRAM_AUTHORITY_SEED],
        bump
    )]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, AsolProgram>,
    #[account(constraint = program_data.upgrade_authority_address == Some(admin.key()))]
    pub program_data: Account<'info, ProgramData>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPauseState<'info> {
    #[account(
        mut,
        seeds = [PROGRAM_AUTHORITY_SEED],
        bump = program_config.bump
    )]
    pub program_config: Account<'info, ProgramConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetServiceAuthorities<'info> {
    #[account(
        mut,
        seeds = [PROGRAM_AUTHORITY_SEED],
        bump = program_config.bump
    )]
    pub program_config: Account<'info, ProgramConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ProposeAdmin<'info> {
    #[account(
        seeds = [PROGRAM_AUTHORITY_SEED],
        bump = program_config.bump
    )]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + PendingAdmin::INIT_SPACE,
        seeds = [PENDING_ADMIN_SEED],
        bump
    )]
    pub pending_admin: Account<'info, PendingAdmin>,
    #[account(mut, constraint = authority.key() == program_config.admin @ AsolError::Unauthorized)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AcceptAdmin<'info> {
    #[account(
        mut,
        seeds = [PROGRAM_AUTHORITY_SEED],
        bump = program_config.bump
    )]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(
        mut,
        seeds = [PENDING_ADMIN_SEED],
        bump = pending_admin.bump,
        close = authority,
        constraint = authority.key() == pending_admin.pending_admin @ AsolError::Unauthorized
    )]
    pub pending_admin: Account<'info, PendingAdmin>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pending_admin_init_space() {
        assert_eq!(PendingAdmin::INIT_SPACE, 32 + 1);
    }
}
