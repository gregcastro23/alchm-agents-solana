use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::{self, AssociatedToken},
    token_2022::{self, MintTo, Token2022},
    token_interface::{Mint, TokenAccount},
};

use crate::{
    constants::{
        AMM_NONCE_SEED, AMM_OP_ADD_LIQUIDITY, AMM_OP_SWAP, CONSTELLATION_POOL_SEED,
        DEED_POSITION_SEED, ESMS_MINT_SEED, MAX_AMM_POOLS, MAX_BOOTSTRAP_RESERVE, MAX_FEE_BPS,
        MAX_LEDGER_ATOMS, MINIMUM_LIQUIDITY, PROGRAM_AUTHORITY_SEED, STATE_VERSION,
    },
    errors::AsolError,
    instructions::{
        ed25519::verify_preceding_ed25519_instruction, esms::permissioned_burn_checked,
    },
    state::{
        compute_add_shares, compute_withdrawal, integer_sqrt, quote_swap, ConstellationPool,
        DeedPosition, LiquidityAdded, LiquidityWithdrawn, PoolBootstrapped, PoolPauseToggled,
        PoolRegistered, PoolTraderNonce, ProgramConfig, Swapped,
    },
    vectors::amm_visibility_authorization_message,
};

pub fn register_pool(
    ctx: Context<RegisterPool>,
    pool_id: u16,
    element_a: u8,
    element_b: u8,
    fee_bps: u16,
) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.admin.key(),
        ctx.accounts.program_config.admin,
        AsolError::Unauthorized
    );
    require!(element_a < element_b, AsolError::InvalidPoolElements);
    require!(element_b <= 3, AsolError::InvalidPoolElements);
    require!(pool_id <= MAX_AMM_POOLS, AsolError::InvalidPoolElements);
    require!(fee_bps <= MAX_FEE_BPS, AsolError::FeeExceedsMaximum);

    ctx.accounts.pool.set_inner(ConstellationPool {
        version: STATE_VERSION,
        pool_id,
        element_a,
        element_b,
        fee_bps,
        reserve_a: 0,
        reserve_b: 0,
        total_shares: 0,
        bootstrapped: false,
        paused: false,
        bump: ctx.bumps.pool,
    });

    emit!(PoolRegistered {
        pool_id,
        element_a,
        element_b,
        fee_bps,
    });

    Ok(())
}

pub fn bootstrap_pool(
    ctx: Context<BootstrapPool>,
    pool_id: u16,
    reserve_a: u64,
    reserve_b: u64,
) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.admin.key(),
        ctx.accounts.program_config.admin,
        AsolError::Unauthorized
    );
    let pool = &mut ctx.accounts.pool;
    require!(!pool.bootstrapped, AsolError::PoolAlreadyBootstrapped);
    require!(reserve_a > 0 && reserve_b > 0, AsolError::ZeroAmount);
    require!(
        reserve_a <= MAX_BOOTSTRAP_RESERVE && reserve_b <= MAX_BOOTSTRAP_RESERVE,
        AsolError::ReserveCeilingExceeded
    );

    let initial_shares = integer_sqrt((reserve_a as u128) * (reserve_b as u128));
    require!(
        initial_shares > MINIMUM_LIQUIDITY as u128,
        AsolError::InsufficientLiquidity
    );
    let initial_shares = initial_shares as u64;

    pool.reserve_a = reserve_a;
    pool.reserve_b = reserve_b;
    pool.total_shares = initial_shares;
    pool.bootstrapped = true;

    emit!(PoolBootstrapped {
        pool_id,
        reserve_a,
        reserve_b,
        total_shares: initial_shares,
    });

    Ok(())
}

pub fn set_pool_pause(ctx: Context<SetPoolPause>, pool_id: u16, paused: bool) -> Result<()> {
    require!(
        ctx.accounts
            .program_config
            .can_pause(&ctx.accounts.authority.key()),
        AsolError::Unauthorized
    );
    ctx.accounts.pool.paused = paused;

    emit!(PoolPauseToggled { pool_id, paused });

    Ok(())
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
    require!(
        Clock::get()?.unix_timestamp <= deadline,
        AsolError::AuthorizationExpired
    );
    require_eq!(
        nonce,
        ctx.accounts.nonce_account.nonce,
        AsolError::InvalidPoolNonce
    );

    let expected_message = amm_visibility_authorization_message(
        &crate::ID.to_bytes(),
        &ctx.accounts.program_config.cluster_domain,
        &ctx.accounts.trader.key().to_bytes(),
        pool_id,
        AMM_OP_ADD_LIQUIDITY,
        &region_commit,
        visible_stars,
        nonce,
        deadline,
    );

    verify_preceding_ed25519_instruction(
        &ctx.accounts.instructions.to_account_info(),
        &ctx.accounts.program_config.attestor,
        &expected_message,
    )?;

    ctx.accounts.nonce_account.nonce = ctx
        .accounts
        .nonce_account
        .nonce
        .checked_add(1)
        .ok_or(AsolError::ArithmeticOverflow)?;
    ctx.accounts.nonce_account.version = STATE_VERSION;
    ctx.accounts.nonce_account.pool_id = pool_id;
    ctx.accounts.nonce_account.trader = ctx.accounts.trader.key();
    ctx.accounts.nonce_account.bump = ctx.bumps.nonce_account;

    let minted_shares = compute_add_shares(
        ctx.accounts.pool.reserve_a,
        ctx.accounts.pool.reserve_b,
        ctx.accounts.pool.total_shares,
        amt_a,
        amt_b,
    )?;
    require!(minted_shares >= min_shares, AsolError::SlippageExceeded);

    let new_reserve_a = ctx
        .accounts
        .pool
        .reserve_a
        .checked_add(amt_a)
        .ok_or(AsolError::ArithmeticOverflow)?;
    let new_reserve_b = ctx
        .accounts
        .pool
        .reserve_b
        .checked_add(amt_b)
        .ok_or(AsolError::ArithmeticOverflow)?;
    require!(
        new_reserve_a <= MAX_LEDGER_ATOMS && new_reserve_b <= MAX_LEDGER_ATOMS,
        AsolError::ReserveCeilingExceeded
    );
    let new_total_shares = ctx
        .accounts
        .pool
        .total_shares
        .checked_add(minted_shares)
        .ok_or(AsolError::ArithmeticOverflow)?;

    let config_info = ctx.accounts.program_config.to_account_info();
    let config_bump = [ctx.accounts.program_config.bump];
    let config_signer = [PROGRAM_AUTHORITY_SEED, config_bump.as_ref()];

    // Burn element A from trader
    permissioned_burn_checked(
        &ctx.accounts.trader_mint_a_ata.to_account_info(),
        &ctx.accounts.mint_a.to_account_info(),
        &config_info,
        &ctx.accounts.trader.to_account_info(),
        &ctx.accounts.token_2022_program.to_account_info(),
        amt_a,
        &[&config_signer],
    )?;

    // Burn element B from trader
    permissioned_burn_checked(
        &ctx.accounts.trader_mint_b_ata.to_account_info(),
        &ctx.accounts.mint_b.to_account_info(),
        &config_info,
        &ctx.accounts.trader.to_account_info(),
        &ctx.accounts.token_2022_program.to_account_info(),
        amt_b,
        &[&config_signer],
    )?;

    // Update DeedPosition
    let deed_position = &mut ctx.accounts.deed_position;
    if deed_position.version == 0 {
        deed_position.version = STATE_VERSION;
        deed_position.pool_id = pool_id;
        deed_position.owner = ctx.accounts.trader.key();
        deed_position.shares = minted_shares;
        deed_position.created_slot = Clock::get()?.slot;
        deed_position.bump = ctx.bumps.deed_position;
    } else {
        deed_position.shares = deed_position
            .shares
            .checked_add(minted_shares)
            .ok_or(AsolError::ArithmeticOverflow)?;
    }

    // Update Pool
    ctx.accounts.pool.reserve_a = new_reserve_a;
    ctx.accounts.pool.reserve_b = new_reserve_b;
    ctx.accounts.pool.total_shares = new_total_shares;

    emit!(LiquidityAdded {
        pool_id,
        trader: ctx.accounts.trader.key(),
        amt_a,
        amt_b,
        shares: minted_shares,
        deed_position: ctx.accounts.deed_position.key(),
        region_commit,
        visible_stars,
    });

    Ok(())
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
    require!(in_amount > 0, AsolError::ZeroAmount);
    require!(
        Clock::get()?.unix_timestamp <= deadline,
        AsolError::AuthorizationExpired
    );
    require!(
        in_element == ctx.accounts.pool.element_a || in_element == ctx.accounts.pool.element_b,
        AsolError::InvalidElementForPool
    );
    require_eq!(
        nonce,
        ctx.accounts.nonce_account.nonce,
        AsolError::InvalidPoolNonce
    );

    let expected_message = amm_visibility_authorization_message(
        &crate::ID.to_bytes(),
        &ctx.accounts.program_config.cluster_domain,
        &ctx.accounts.trader.key().to_bytes(),
        pool_id,
        AMM_OP_SWAP,
        &region_commit,
        visible_stars,
        nonce,
        deadline,
    );

    verify_preceding_ed25519_instruction(
        &ctx.accounts.instructions.to_account_info(),
        &ctx.accounts.program_config.attestor,
        &expected_message,
    )?;

    ctx.accounts.nonce_account.nonce = ctx
        .accounts
        .nonce_account
        .nonce
        .checked_add(1)
        .ok_or(AsolError::ArithmeticOverflow)?;
    ctx.accounts.nonce_account.version = STATE_VERSION;
    ctx.accounts.nonce_account.pool_id = pool_id;
    ctx.accounts.nonce_account.trader = ctx.accounts.trader.key();
    ctx.accounts.nonce_account.bump = ctx.bumps.nonce_account;

    let in_is_a = in_element == ctx.accounts.pool.element_a;
    let (in_mint_info, out_mint_info, reserve_in, reserve_out, out_element) = if in_is_a {
        (
            &ctx.accounts.mint_a,
            &ctx.accounts.mint_b,
            ctx.accounts.pool.reserve_a,
            ctx.accounts.pool.reserve_b,
            ctx.accounts.pool.element_b,
        )
    } else {
        (
            &ctx.accounts.mint_b,
            &ctx.accounts.mint_a,
            ctx.accounts.pool.reserve_b,
            ctx.accounts.pool.reserve_a,
            ctx.accounts.pool.element_a,
        )
    };

    require_keys_eq!(
        ctx.accounts.trader_in_ata.mint,
        in_mint_info.key(),
        AsolError::InvalidTokenAccount
    );

    let out_amount = quote_swap(
        reserve_in,
        reserve_out,
        ctx.accounts.pool.fee_bps,
        in_amount,
    )?;
    require!(
        out_amount > 0 && out_amount >= min_out,
        AsolError::InsufficientOutput
    );
    require!(out_amount < reserve_out, AsolError::InsufficientLiquidity);

    // Validate trader_out_ata PDA address
    let expected_out_ata = associated_token::get_associated_token_address_with_program_id(
        &ctx.accounts.trader.key(),
        &out_mint_info.key(),
        &token_2022::spl_token_2022::ID,
    );
    require_keys_eq!(
        ctx.accounts.trader_out_ata.key(),
        expected_out_ata,
        AsolError::InvalidTokenAccount
    );

    // Idempotently create trader_out_ata if needed
    associated_token::create_idempotent(CpiContext::new(
        ctx.accounts.associated_token_program.to_account_info(),
        associated_token::Create {
            payer: ctx.accounts.trader.to_account_info(),
            associated_token: ctx.accounts.trader_out_ata.to_account_info(),
            authority: ctx.accounts.trader.to_account_info(),
            mint: out_mint_info.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            token_program: ctx.accounts.token_2022_program.to_account_info(),
        },
    ))?;

    let config_info = ctx.accounts.program_config.to_account_info();
    let config_bump = [ctx.accounts.program_config.bump];
    let config_signer = [PROGRAM_AUTHORITY_SEED, config_bump.as_ref()];

    // Burn input token
    permissioned_burn_checked(
        &ctx.accounts.trader_in_ata.to_account_info(),
        &in_mint_info.to_account_info(),
        &config_info,
        &ctx.accounts.trader.to_account_info(),
        &ctx.accounts.token_2022_program.to_account_info(),
        in_amount,
        &[&config_signer],
    )?;

    // Mint output token to trader
    token_2022::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_2022_program.to_account_info(),
            MintTo {
                mint: out_mint_info.to_account_info(),
                to: ctx.accounts.trader_out_ata.to_account_info(),
                authority: config_info,
            },
            &[&config_signer],
        ),
        out_amount,
    )?;

    // Update reserves
    if in_is_a {
        ctx.accounts.pool.reserve_a = ctx
            .accounts
            .pool
            .reserve_a
            .checked_add(in_amount)
            .ok_or(AsolError::ArithmeticOverflow)?;
        ctx.accounts.pool.reserve_b = ctx
            .accounts
            .pool
            .reserve_b
            .checked_sub(out_amount)
            .ok_or(AsolError::ArithmeticOverflow)?;
    } else {
        ctx.accounts.pool.reserve_b = ctx
            .accounts
            .pool
            .reserve_b
            .checked_add(in_amount)
            .ok_or(AsolError::ArithmeticOverflow)?;
        ctx.accounts.pool.reserve_a = ctx
            .accounts
            .pool
            .reserve_a
            .checked_sub(out_amount)
            .ok_or(AsolError::ArithmeticOverflow)?;
    }
    require!(
        ctx.accounts.pool.reserve_a <= MAX_LEDGER_ATOMS
            && ctx.accounts.pool.reserve_b <= MAX_LEDGER_ATOMS,
        AsolError::ReserveCeilingExceeded
    );

    emit!(Swapped {
        pool_id,
        trader: ctx.accounts.trader.key(),
        in_element,
        in_amount,
        out_element,
        out_amount,
        reserve_a: ctx.accounts.pool.reserve_a,
        reserve_b: ctx.accounts.pool.reserve_b,
        region_commit,
        visible_stars,
    });

    Ok(())
}

pub fn withdraw_liquidity(
    ctx: Context<WithdrawLiquidity>,
    pool_id: u16,
    share_bps: u16,
) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    let deed_position = &mut ctx.accounts.deed_position;

    let (pull_shares, amt_a, amt_b) = compute_withdrawal(
        pool.reserve_a,
        pool.reserve_b,
        pool.total_shares,
        deed_position.shares,
        share_bps,
    )?;

    pool.reserve_a = pool
        .reserve_a
        .checked_sub(amt_a)
        .ok_or(AsolError::ArithmeticOverflow)?;
    pool.reserve_b = pool
        .reserve_b
        .checked_sub(amt_b)
        .ok_or(AsolError::ArithmeticOverflow)?;
    pool.total_shares = pool
        .total_shares
        .checked_sub(pull_shares)
        .ok_or(AsolError::ArithmeticOverflow)?;

    let remaining_shares = deed_position
        .shares
        .checked_sub(pull_shares)
        .ok_or(AsolError::ArithmeticOverflow)?;
    deed_position.shares = remaining_shares;

    let config_info = ctx.accounts.program_config.to_account_info();
    let config_bump = [ctx.accounts.program_config.bump];
    let config_signer = [PROGRAM_AUTHORITY_SEED, config_bump.as_ref()];

    if amt_a > 0 {
        token_2022::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_2022_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint_a.to_account_info(),
                    to: ctx.accounts.owner_mint_a_ata.to_account_info(),
                    authority: config_info.clone(),
                },
                &[&config_signer],
            ),
            amt_a,
        )?;
    }

    if amt_b > 0 {
        token_2022::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_2022_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint_b.to_account_info(),
                    to: ctx.accounts.owner_mint_b_ata.to_account_info(),
                    authority: config_info,
                },
                &[&config_signer],
            ),
            amt_b,
        )?;
    }

    if remaining_shares == 0 {
        deed_position.close(ctx.accounts.owner.to_account_info())?;
    }

    emit!(LiquidityWithdrawn {
        pool_id,
        trader: ctx.accounts.owner.key(),
        deed_position: ctx.accounts.deed_position.key(),
        pull_shares,
        remaining_shares,
        amt_a,
        amt_b,
        reserve_a: pool.reserve_a,
        reserve_b: pool.reserve_b,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(pool_id: u16, element_a: u8, element_b: u8, fee_bps: u16)]
pub struct RegisterPool<'info> {
    #[account(seeds = [PROGRAM_AUTHORITY_SEED], bump = program_config.bump)]
    pub program_config: Box<Account<'info, ProgramConfig>>,
    #[account(mut, constraint = admin.key() == program_config.admin @ AsolError::Unauthorized)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + ConstellationPool::INIT_SPACE,
        seeds = [CONSTELLATION_POOL_SEED, &pool_id.to_le_bytes()],
        bump
    )]
    pub pool: Box<Account<'info, ConstellationPool>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(pool_id: u16, reserve_a: u64, reserve_b: u64)]
pub struct BootstrapPool<'info> {
    #[account(seeds = [PROGRAM_AUTHORITY_SEED], bump = program_config.bump)]
    pub program_config: Box<Account<'info, ProgramConfig>>,
    #[account(mut, constraint = admin.key() == program_config.admin @ AsolError::Unauthorized)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [CONSTELLATION_POOL_SEED, &pool_id.to_le_bytes()],
        bump = pool.bump,
        constraint = !pool.bootstrapped @ AsolError::PoolAlreadyBootstrapped
    )]
    pub pool: Box<Account<'info, ConstellationPool>>,
}

#[derive(Accounts)]
#[instruction(pool_id: u16, paused: bool)]
pub struct SetPoolPause<'info> {
    #[account(seeds = [PROGRAM_AUTHORITY_SEED], bump = program_config.bump)]
    pub program_config: Box<Account<'info, ProgramConfig>>,
    #[account(constraint = program_config.can_pause(&authority.key()) @ AsolError::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [CONSTELLATION_POOL_SEED, &pool_id.to_le_bytes()],
        bump = pool.bump
    )]
    pub pool: Box<Account<'info, ConstellationPool>>,
}

#[derive(Accounts)]
#[instruction(
    pool_id: u16,
    amt_a: u64,
    amt_b: u64,
    min_shares: u64,
    region_commit: [u8; 32],
    visible_stars: u8,
    nonce: u64,
    deadline: i64
)]
pub struct AddLiquidity<'info> {
    #[account(seeds = [PROGRAM_AUTHORITY_SEED], bump = program_config.bump)]
    pub program_config: Box<Account<'info, ProgramConfig>>,
    #[account(
        mut,
        seeds = [CONSTELLATION_POOL_SEED, &pool_id.to_le_bytes()],
        bump = pool.bump,
        constraint = pool.bootstrapped @ AsolError::PoolNotBootstrapped,
        constraint = !pool.paused @ AsolError::PoolPaused
    )]
    pub pool: Box<Account<'info, ConstellationPool>>,
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(
        init_if_needed,
        payer = trader,
        space = 8 + PoolTraderNonce::INIT_SPACE,
        seeds = [AMM_NONCE_SEED, &pool_id.to_le_bytes(), trader.key().as_ref()],
        bump
    )]
    pub nonce_account: Box<Account<'info, PoolTraderNonce>>,
    #[account(mut, seeds = [ESMS_MINT_SEED, &[pool.element_a]], bump)]
    pub mint_a: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, seeds = [ESMS_MINT_SEED, &[pool.element_b]], bump)]
    pub mint_b: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = trader,
        associated_token::token_program = token_2022_program
    )]
    pub trader_mint_a_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = mint_b,
        associated_token::authority = trader,
        associated_token::token_program = token_2022_program
    )]
    pub trader_mint_b_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = trader,
        space = 8 + DeedPosition::INIT_SPACE,
        seeds = [DEED_POSITION_SEED, &pool_id.to_le_bytes(), trader.key().as_ref()],
        bump
    )]
    pub deed_position: Box<Account<'info, DeedPosition>>,
    /// CHECK: Checked against instruction sysvar address
    #[account(constraint = instructions.key() == anchor_lang::solana_program::sysvar::instructions::ID @ AsolError::InvalidInstructionsSysvar)]
    pub instructions: UncheckedAccount<'info>,
    pub token_2022_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(
    pool_id: u16,
    in_element: u8,
    in_amount: u64,
    min_out: u64,
    region_commit: [u8; 32],
    visible_stars: u8,
    nonce: u64,
    deadline: i64
)]
pub struct SwapEsms<'info> {
    #[account(seeds = [PROGRAM_AUTHORITY_SEED], bump = program_config.bump)]
    pub program_config: Box<Account<'info, ProgramConfig>>,
    #[account(
        mut,
        seeds = [CONSTELLATION_POOL_SEED, &pool_id.to_le_bytes()],
        bump = pool.bump,
        constraint = pool.bootstrapped @ AsolError::PoolNotBootstrapped,
        constraint = !pool.paused @ AsolError::PoolPaused
    )]
    pub pool: Box<Account<'info, ConstellationPool>>,
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(
        init_if_needed,
        payer = trader,
        space = 8 + PoolTraderNonce::INIT_SPACE,
        seeds = [AMM_NONCE_SEED, &pool_id.to_le_bytes(), trader.key().as_ref()],
        bump
    )]
    pub nonce_account: Box<Account<'info, PoolTraderNonce>>,
    #[account(mut, seeds = [ESMS_MINT_SEED, &[pool.element_a]], bump)]
    pub mint_a: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, seeds = [ESMS_MINT_SEED, &[pool.element_b]], bump)]
    pub mint_b: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, constraint = trader_in_ata.owner == trader.key() @ AsolError::InvalidTokenAccount)]
    pub trader_in_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: Created idempotently via associated_token CPI with payer = trader
    #[account(mut)]
    pub trader_out_ata: UncheckedAccount<'info>,
    /// CHECK: Checked against instruction sysvar address
    #[account(constraint = instructions.key() == anchor_lang::solana_program::sysvar::instructions::ID @ AsolError::InvalidInstructionsSysvar)]
    pub instructions: UncheckedAccount<'info>,
    pub token_2022_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(pool_id: u16, share_bps: u16)]
pub struct WithdrawLiquidity<'info> {
    #[account(seeds = [PROGRAM_AUTHORITY_SEED], bump = program_config.bump)]
    pub program_config: Box<Account<'info, ProgramConfig>>,
    #[account(
        mut,
        seeds = [CONSTELLATION_POOL_SEED, &pool_id.to_le_bytes()],
        bump = pool.bump
    )]
    pub pool: Box<Account<'info, ConstellationPool>>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, seeds = [ESMS_MINT_SEED, &[pool.element_a]], bump)]
    pub mint_a: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, seeds = [ESMS_MINT_SEED, &[pool.element_b]], bump)]
    pub mint_b: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint_a,
        associated_token::authority = owner,
        associated_token::token_program = token_2022_program
    )]
    pub owner_mint_a_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint_b,
        associated_token::authority = owner,
        associated_token::token_program = token_2022_program
    )]
    pub owner_mint_b_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        seeds = [DEED_POSITION_SEED, &pool_id.to_le_bytes(), owner.key().as_ref()],
        bump = deed_position.bump,
        constraint = deed_position.pool_id == pool.pool_id @ AsolError::InvalidDeedOwner,
        constraint = deed_position.owner == owner.key() @ AsolError::InvalidDeedOwner
    )]
    pub deed_position: Box<Account<'info, DeedPosition>>,
    pub token_2022_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[cfg(test)]
mod runtime_tests;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_event_discriminators() {
        // Ensure event structs compile and have expected fields
        let reg = PoolRegistered {
            pool_id: 0,
            element_a: 0,
            element_b: 1,
            fee_bps: 30,
        };
        assert_eq!(reg.pool_id, 0);

        let boot = PoolBootstrapped {
            pool_id: 0,
            reserve_a: 1000,
            reserve_b: 1000,
            total_shares: 1000,
        };
        assert_eq!(boot.total_shares, 1000);
    }
}
