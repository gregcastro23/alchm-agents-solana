use anchor_lang::{
    prelude::*,
    solana_program::{
        ed25519_program,
        sysvar::instructions::{load_current_index_checked, load_instruction_at_checked},
    },
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_2022::{self, MintTo, Token2022},
    token_interface::{Mint, TokenAccount, TokenInterface, TransferChecked},
};
use sha3::{Digest, Keccak256};

use crate::{
    constants::{
        ED25519_PUBLIC_KEY_SIZE, ED25519_SIGNATURE_SIZE, ESMS_MINT_COUNT,
        ESMS_MINT_SEED, MAX_LEDGER_ATOMS, MAX_STAR_PROOF_DEPTH,
        MAX_YIELD_RATE_PER_USDC_DAY, PROGRAM_AUTHORITY_SEED, STAR_POOL_SEED,
        STAR_VAULT_SEED, STAR_YIELD_AUTHORIZATION_DOMAIN, STATE_VERSION, STAKE_POSITION_SEED,
        USDC_DECIMALS,
    },
    errors::AsolError,
    state::{
        calculate_accrued_yield_cap, checkpoint_yield, ProgramConfig, StakePosition, StarPool,
        StarVaultState,
    },
    vectors::openzeppelin_star_leaf,
};

pub fn validate_vault_usdc_mint<'info>(mint: &AccountInfo<'info>) -> Result<()> {
    if *mint.owner == anchor_spl::token::ID {
        return Ok(());
    }
    require_keys_eq!(
        *mint.owner,
        anchor_spl::token_2022::spl_token_2022::ID,
        AsolError::InvalidTokenProgram
    );
    let data = mint.try_borrow_data()?;
    if data.len() > 166 {
        let mut cursor = 166;
        while cursor + 4 <= data.len() {
            let extension_type = u16::from_le_bytes([data[cursor], data[cursor + 1]]);
            let extension_len = u16::from_le_bytes([data[cursor + 2], data[cursor + 3]]) as usize;
            if extension_type == 0 && extension_len == 0 {
                break;
            }
            // Reject TransferFeeConfig (1), PermanentDelegate (12), TransferHook (14)
            if extension_type == 1 || extension_type == 12 || extension_type == 14 {
                return err!(AsolError::InvalidVaultMintExtensions);
            }
            cursor = cursor + 4 + extension_len;
        }
    }
    Ok(())
}

pub fn initialize_star_vault(
    ctx: Context<InitializeStarVault>,
    star_root: [u8; 32],
    max_yield_rate_per_usdc_day: u64,
) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.admin.key(),
        ctx.accounts.program_config.admin,
        AsolError::Unauthorized
    );
    require!(star_root != [0u8; 32], AsolError::StarRootUnset);
    require!(
        max_yield_rate_per_usdc_day <= MAX_YIELD_RATE_PER_USDC_DAY,
        AsolError::RateExceedsCeiling
    );
    validate_vault_usdc_mint(&ctx.accounts.usdc_mint.to_account_info())?;

    ctx.accounts.star_vault_state.set_inner(StarVaultState {
        version: STATE_VERSION,
        admin: ctx.accounts.admin.key(),
        usdc_mint: ctx.accounts.usdc_mint.key(),
        vault_usdc_ata: ctx.accounts.vault_usdc_ata.key(),
        total_principal: 0,
        star_root,
        max_yield_rate_per_usdc_day,
        bump: ctx.bumps.star_vault_state,
    });
    Ok(())
}

pub fn set_star_vault_config(
    ctx: Context<SetStarVaultConfig>,
    star_root: Option<[u8; 32]>,
    max_yield_rate_per_usdc_day: Option<u64>,
) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.admin.key(),
        ctx.accounts.star_vault_state.admin,
        AsolError::Unauthorized
    );

    if let Some(root) = star_root {
        require!(root != [0u8; 32], AsolError::StarRootUnset);
        ctx.accounts.star_vault_state.star_root = root;
    }
    if let Some(rate) = max_yield_rate_per_usdc_day {
        require!(rate <= MAX_YIELD_RATE_PER_USDC_DAY, AsolError::RateExceedsCeiling);
        ctx.accounts.star_vault_state.max_yield_rate_per_usdc_day = rate;
    }
    Ok(())
}

pub fn activate_star(
    ctx: Context<ActivateStar>,
    star_id: u32,
    proof: Vec<[u8; 32]>,
) -> Result<()> {
    if ctx.accounts.star_pool.activated {
        return Ok(());
    }

    require!(
        proof.len() <= MAX_STAR_PROOF_DEPTH,
        AsolError::ProofTooDeep
    );
    let root = ctx.accounts.star_vault_state.star_root;
    require!(root != [0u8; 32], AsolError::StarRootUnset);

    let leaf = openzeppelin_star_leaf(star_id);
    let valid = verify_merkle_proof(&proof, root, leaf);
    require!(valid, AsolError::InvalidStarProof);

    ctx.accounts.star_pool.set_inner(StarPool {
        version: STATE_VERSION,
        star_id,
        activated: true,
        total_principal: 0,
        total_shares: 0,
        bump: ctx.bumps.star_pool,
    });
    Ok(())
}

pub fn stake_star(
    ctx: Context<StakeStar>,
    star_id: u32,
    usdc_amount: u64,
) -> Result<()> {
    require!(usdc_amount > 0, AsolError::ZeroAmount);
    require!(ctx.accounts.star_pool.activated, AsolError::StarNotActivated);
    require_keys_eq!(
        ctx.accounts.vault_usdc_ata.key(),
        ctx.accounts.star_vault_state.vault_usdc_ata,
        AsolError::InvalidVault
    );

    let now = Clock::get()?.unix_timestamp;
    let position = &mut ctx.accounts.stake_position;
    if position.version == 0 {
        position.version = STATE_VERSION;
        position.staker = ctx.accounts.staker.key();
        position.star_id = star_id;
        position.shares = 0;
        position.principal = 0;
        position.accrued_cap = 0;
        position.last_checkpoint = now;
        position.claim_nonce = 0;
        position.bump = ctx.bumps.stake_position;
    } else {
        checkpoint_yield(
            position,
            ctx.accounts.star_vault_state.max_yield_rate_per_usdc_day,
            now,
        )?;
    }

    // Measure the net balance delta rather than trusting usdc_amount:
    // a mint carrying transfer fee delivers less than sent, and crediting
    // unreceived principal would compromise custody.
    let pre = ctx.accounts.vault_usdc_ata.amount;
    anchor_spl::token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.staker_usdc_ata.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.vault_usdc_ata.to_account_info(),
                authority: ctx.accounts.staker.to_account_info(),
            },
        ),
        usdc_amount,
        USDC_DECIMALS,
    )?;
    ctx.accounts.vault_usdc_ata.reload()?;
    let net = ctx
        .accounts
        .vault_usdc_ata
        .amount
        .checked_sub(pre)
        .ok_or(AsolError::ArithmeticOverflow)?;
    require!(net > 0, AsolError::ZeroAmount);

    let pool = &mut ctx.accounts.star_pool;
    let shares = if pool.total_shares == 0 || pool.total_principal == 0 {
        net
    } else {
        ((net as u128)
            .checked_mul(pool.total_shares as u128)
            .ok_or(AsolError::ArithmeticOverflow)?
            / (pool.total_principal as u128)) as u64
    };
    require!(shares > 0, AsolError::ZeroAmount);

    pool.total_principal = pool
        .total_principal
        .checked_add(net)
        .ok_or(AsolError::ArithmeticOverflow)?;
    pool.total_shares = pool
        .total_shares
        .checked_add(shares)
        .ok_or(AsolError::ArithmeticOverflow)?;

    position.principal = position
        .principal
        .checked_add(net)
        .ok_or(AsolError::ArithmeticOverflow)?;
    position.shares = position
        .shares
        .checked_add(shares)
        .ok_or(AsolError::ArithmeticOverflow)?;

    let vault = &mut ctx.accounts.star_vault_state;
    vault.total_principal = vault
        .total_principal
        .checked_add(net)
        .ok_or(AsolError::ArithmeticOverflow)?;

    Ok(())
}


pub fn unstake_star(
    ctx: Context<UnstakeStar>,
    star_id: u32,
    shares: u64,
) -> Result<()> {
    require!(shares > 0, AsolError::ZeroAmount);
    require_keys_eq!(
        ctx.accounts.vault_usdc_ata.key(),
        ctx.accounts.star_vault_state.vault_usdc_ata,
        AsolError::InvalidVault
    );

    let position = &mut ctx.accounts.stake_position;
    require_eq!(position.star_id, star_id, AsolError::InvalidVault);
    require!(position.shares >= shares, AsolError::InsufficientShares);
    let pool = &mut ctx.accounts.star_pool;
    require!(pool.total_shares > 0, AsolError::InsufficientShares);

    let now = Clock::get()?.unix_timestamp;
    checkpoint_yield(
        position,
        ctx.accounts.star_vault_state.max_yield_rate_per_usdc_day,
        now,
    )?;

    let usdc_amount = ((shares as u128)
        .checked_mul(pool.total_principal as u128)
        .ok_or(AsolError::ArithmeticOverflow)?
        / (pool.total_shares as u128)) as u64;

    pool.total_shares = pool
        .total_shares
        .checked_sub(shares)
        .ok_or(AsolError::ArithmeticOverflow)?;
    pool.total_principal = pool
        .total_principal
        .checked_sub(usdc_amount)
        .ok_or(AsolError::ArithmeticOverflow)?;

    position.shares = position
        .shares
        .checked_sub(shares)
        .ok_or(AsolError::ArithmeticOverflow)?;
    position.principal = position
        .principal
        .checked_sub(usdc_amount)
        .ok_or(AsolError::ArithmeticOverflow)?;

    let vault = &mut ctx.accounts.star_vault_state;
    vault.total_principal = vault
        .total_principal
        .checked_sub(usdc_amount)
        .ok_or(AsolError::ArithmeticOverflow)?;

    let bump = vault.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[STAR_VAULT_SEED, &[bump]]];

    anchor_spl::token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.vault_usdc_ata.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.staker_usdc_ata.to_account_info(),
                authority: ctx.accounts.star_vault_state.to_account_info(),
            },
            signer_seeds,
        ),
        usdc_amount,
        USDC_DECIMALS,
    )?;

    Ok(())
}

pub fn claim_star_yield(
    ctx: Context<ClaimStarYield>,
    star_id: u32,
    element_id: u8,
    amount: u64,
    nonce: u64,
    deadline: i64,
) -> Result<()> {
    let config = &ctx.accounts.program_config;
    require!(!config.pause_claims, AsolError::ClaimsPaused);
    require!(
        element_id < ESMS_MINT_COUNT as u8,
        AsolError::InvalidElement
    );
    require!(amount > 0, AsolError::EmptyAmounts);
    require!(amount <= MAX_LEDGER_ATOMS, AsolError::AmountOutOfRange);

    let now = Clock::get()?.unix_timestamp;
    require!(now <= deadline, AsolError::AuthorizationExpired);

    let position = &mut ctx.accounts.stake_position;
    require_keys_eq!(
        position.staker,
        ctx.accounts.staker.key(),
        AsolError::Unauthorized
    );
    require_eq!(position.star_id, star_id, AsolError::InvalidVault);
    require_eq!(position.claim_nonce, nonce, AsolError::InvalidYieldNonce);

    require_keys_eq!(
        ctx.accounts.instructions.key(),
        anchor_lang::solana_program::sysvar::instructions::ID,
        AsolError::InvalidInstructionsSysvar
    );

    let expected_message = star_yield_authorization_message(
        &crate::ID,
        &config.cluster_domain,
        &ctx.accounts.staker.key(),
        star_id,
        element_id,
        amount,
        nonce,
        deadline,
    );

    verify_preceding_ed25519_instruction(
        &ctx.accounts.instructions.to_account_info(),
        &config.attestor,
        &expected_message,
    )?;

    let interval_cap = calculate_accrued_yield_cap(
        position.principal,
        ctx.accounts.star_vault_state.max_yield_rate_per_usdc_day,
        now.saturating_sub(position.last_checkpoint),
    );
    let total_claimable = position.accrued_cap.saturating_add(interval_cap);
    require!(amount <= total_claimable, AsolError::YieldExceedsCap);

    position.claim_nonce = position
        .claim_nonce
        .checked_add(1)
        .ok_or(AsolError::ArithmeticOverflow)?;
    position.last_checkpoint = now.max(position.last_checkpoint);
    position.accrued_cap = total_claimable.saturating_sub(amount);


    let config_bump = [config.bump];
    let config_signer = [PROGRAM_AUTHORITY_SEED, config_bump.as_ref()];

    token_2022::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_2022_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.element_mint.to_account_info(),
                to: ctx.accounts.staker_element_ata.to_account_info(),
                authority: ctx.accounts.program_config.to_account_info(),
            },
            &[&config_signer],
        ),
        amount,
    )?;

    Ok(())
}

pub fn verify_merkle_proof(proof: &[[u8; 32]], root: [u8; 32], leaf: [u8; 32]) -> bool {
    let mut computed = leaf;
    for element in proof {
        let mut hasher = Keccak256::new();
        if computed <= *element {
            hasher.update(computed);
            hasher.update(element);
        } else {
            hasher.update(element);
            hasher.update(computed);
        }
        computed = hasher.finalize().into();
    }
    computed == root
}

pub fn star_yield_authorization_message(
    program_id: &Pubkey,
    cluster_domain: &[u8; 32],
    staker: &Pubkey,
    star_id: u32,
    element_id: u8,
    amount: u64,
    nonce: u64,
    deadline: i64,
) -> Vec<u8> {
    let mut message = Vec::with_capacity(
        STAR_YIELD_AUTHORIZATION_DOMAIN.len() + 32 + 32 + 32 + 4 + 1 + 8 + 8 + 8,
    );
    message.extend_from_slice(STAR_YIELD_AUTHORIZATION_DOMAIN);
    message.extend_from_slice(program_id.as_ref());
    message.extend_from_slice(cluster_domain);
    message.extend_from_slice(staker.as_ref());
    message.extend_from_slice(&star_id.to_le_bytes());
    message.push(element_id);
    message.extend_from_slice(&amount.to_le_bytes());
    message.extend_from_slice(&nonce.to_le_bytes());
    message.extend_from_slice(&deadline.to_le_bytes());
    message
}

fn verify_preceding_ed25519_instruction(
    instructions: &AccountInfo,
    attestor: &Pubkey,
    expected_message: &[u8],
) -> Result<()> {
    let current_index = load_current_index_checked(instructions)
        .map_err(|_| error!(AsolError::InvalidInstructionsSysvar))?;
    require!(current_index > 0, AsolError::InvalidEd25519Authorization);
    let ed25519_instruction = load_instruction_at_checked(current_index as usize - 1, instructions)
        .map_err(|_| error!(AsolError::InvalidEd25519Authorization))?;
    require_keys_eq!(
        ed25519_instruction.program_id,
        ed25519_program::ID,
        AsolError::InvalidEd25519Authorization
    );
    let data = &ed25519_instruction.data;
    require!(data.len() >= 16, AsolError::InvalidEd25519Authorization);
    require!(
        data[0] == 1 && data[1] == 0,
        AsolError::InvalidEd25519Authorization
    );

    let read_u16 = |offset: usize| u16::from_le_bytes([data[offset], data[offset + 1]]);
    let signature_offset = read_u16(2) as usize;
    let signature_instruction_index = read_u16(4);
    let public_key_offset = read_u16(6) as usize;
    let public_key_instruction_index = read_u16(8);
    let message_offset = read_u16(10) as usize;
    let message_size = read_u16(12) as usize;
    let message_instruction_index = read_u16(14);
    require!(
        signature_instruction_index == u16::MAX
            && public_key_instruction_index == u16::MAX
            && message_instruction_index == u16::MAX,
        AsolError::InvalidEd25519Authorization
    );
    require!(
        signature_offset
            .checked_add(ED25519_SIGNATURE_SIZE)
            .is_some_and(|end| end <= data.len())
            && public_key_offset
                .checked_add(ED25519_PUBLIC_KEY_SIZE)
                .is_some_and(|end| end <= data.len())
            && message_offset
                .checked_add(message_size)
                .is_some_and(|end| end <= data.len()),
        AsolError::InvalidEd25519Authorization
    );
    require!(
        &data[public_key_offset..public_key_offset + ED25519_PUBLIC_KEY_SIZE] == attestor.as_ref()
            && message_size == expected_message.len()
            && &data[message_offset..message_offset + message_size] == expected_message,
        AsolError::InvalidEd25519Authorization
    );
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeStarVault<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + StarVaultState::INIT_SPACE,
        seeds = [STAR_VAULT_SEED],
        bump
    )]
    pub star_vault_state: Account<'info, StarVaultState>,
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [PROGRAM_AUTHORITY_SEED],
        bump = program_config.bump
    )]
    pub program_config: Account<'info, ProgramConfig>,
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    #[account(
        token::mint = usdc_mint,
        token::authority = star_vault_state
    )]
    pub vault_usdc_ata: InterfaceAccount<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetStarVaultConfig<'info> {
    #[account(
        mut,
        seeds = [STAR_VAULT_SEED],
        bump = star_vault_state.bump
    )]
    pub star_vault_state: Account<'info, StarVaultState>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(star_id: u32)]
pub struct ActivateStar<'info> {
    #[account(
        seeds = [STAR_VAULT_SEED],
        bump = star_vault_state.bump
    )]
    pub star_vault_state: Account<'info, StarVaultState>,
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + StarPool::INIT_SPACE,
        seeds = [STAR_POOL_SEED, &star_id.to_le_bytes()],
        bump
    )]
    pub star_pool: Account<'info, StarPool>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(star_id: u32)]
pub struct StakeStar<'info> {
    #[account(
        mut,
        seeds = [STAR_VAULT_SEED],
        bump = star_vault_state.bump
    )]
    pub star_vault_state: Account<'info, StarVaultState>,
    #[account(
        mut,
        seeds = [STAR_POOL_SEED, &star_id.to_le_bytes()],
        bump = star_pool.bump
    )]
    pub star_pool: Account<'info, StarPool>,
    #[account(
        init_if_needed,
        payer = staker,
        space = 8 + StakePosition::INIT_SPACE,
        seeds = [STAKE_POSITION_SEED, &star_id.to_le_bytes(), staker.key().as_ref()],
        bump
    )]
    pub stake_position: Account<'info, StakePosition>,
    #[account(mut)]
    pub staker: Signer<'info>,
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = staker
    )]
    pub staker_usdc_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = star_vault_state
    )]
    pub vault_usdc_ata: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(star_id: u32)]
pub struct UnstakeStar<'info> {
    #[account(
        mut,
        seeds = [STAR_VAULT_SEED],
        bump = star_vault_state.bump
    )]
    pub star_vault_state: Account<'info, StarVaultState>,
    #[account(
        mut,
        seeds = [STAR_POOL_SEED, &star_id.to_le_bytes()],
        bump = star_pool.bump
    )]
    pub star_pool: Account<'info, StarPool>,
    #[account(
        mut,
        seeds = [STAKE_POSITION_SEED, &star_id.to_le_bytes(), staker.key().as_ref()],
        bump = stake_position.bump
    )]
    pub stake_position: Account<'info, StakePosition>,
    #[account(mut)]
    pub staker: Signer<'info>,
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = staker
    )]
    pub staker_usdc_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = star_vault_state
    )]
    pub vault_usdc_ata: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
#[instruction(star_id: u32, element_id: u8)]
pub struct ClaimStarYield<'info> {
    #[account(
        seeds = [PROGRAM_AUTHORITY_SEED],
        bump = program_config.bump
    )]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(
        seeds = [STAR_VAULT_SEED],
        bump = star_vault_state.bump
    )]
    pub star_vault_state: Account<'info, StarVaultState>,
    #[account(
        mut,
        seeds = [STAKE_POSITION_SEED, &star_id.to_le_bytes(), staker.key().as_ref()],
        bump = stake_position.bump
    )]
    pub stake_position: Account<'info, StakePosition>,
    #[account(mut)]
    pub staker: Signer<'info>,
    #[account(
        mut,
        seeds = [ESMS_MINT_SEED, &[element_id]],
        bump
    )]
    pub element_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        token::mint = element_mint,
        token::authority = staker
    )]
    pub staker_element_ata: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: Instructions sysvar account for Ed25519 signature verification
    pub instructions: AccountInfo<'info>,
    pub token_2022_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_openzeppelin_merkle_leaf_and_proof_verification() {
        let star_id: u32 = 677;
        let leaf = openzeppelin_star_leaf(star_id);
        assert_eq!(
            leaf,
            openzeppelin_star_leaf(677)
        );

        // Single element tree where leaf == root
        let root = leaf;
        let proof: Vec<[u8; 32]> = vec![];
        assert!(verify_merkle_proof(&proof, root, leaf));

        // Two element tree
        let sibling = openzeppelin_star_leaf(100);
        let mut hasher = Keccak256::new();
        if leaf <= sibling {
            hasher.update(leaf);
            hasher.update(sibling);
        } else {
            hasher.update(sibling);
            hasher.update(leaf);
        }
        let two_root: [u8; 32] = hasher.finalize().into();
        assert!(verify_merkle_proof(&[sibling], two_root, leaf));
        assert!(verify_merkle_proof(&[leaf], two_root, sibling));
    }

    #[test]
    fn test_star_yield_authorization_serialization() {
        let program_id = Pubkey::new_from_array([1; 32]);
        let cluster_domain = [2; 32];
        let staker = Pubkey::new_from_array([3; 32]);
        let star_id = 677;
        let element_id = 1;
        let amount = 500_0000;
        let nonce = 0;
        let deadline = 1_900_000_000;

        let msg = star_yield_authorization_message(
            &program_id,
            &cluster_domain,
            &staker,
            star_id,
            element_id,
            amount,
            nonce,
            deadline,
        );

        assert_eq!(&msg[0..STAR_YIELD_AUTHORIZATION_DOMAIN.len()], STAR_YIELD_AUTHORIZATION_DOMAIN);
        assert_eq!(msg.len(), STAR_YIELD_AUTHORIZATION_DOMAIN.len() + 32 + 32 + 32 + 4 + 1 + 8 + 8 + 8);
    }

    #[test]
    fn test_vault_mint_validation_rejects_unsupported_extensions() {
        // Standard SPL Token mint info (82 bytes, owned by spl_token)
        let spl_token_program = anchor_spl::token::ID;
        let spl_mint_key = Pubkey::new_unique();
        let mut spl_mint_data = vec![0u8; 82];
        let mut spl_lamports = 1_000_000;
        let spl_mint_info = AccountInfo::new(
            &spl_mint_key,
            false,
            false,
            &mut spl_lamports,
            &mut spl_mint_data,
            &spl_token_program,
            false,
            0,
        );
        assert!(validate_vault_usdc_mint(&spl_mint_info).is_ok());

        // Token-2022 mint with TransferFeeConfig (extension type 1)
        let token_2022_program = anchor_spl::token_2022::spl_token_2022::ID;
        let token_2022_key = Pubkey::new_unique();
        let mut fee_mint_data = vec![0u8; 200];
        // Set extension header at byte 166: type = 1, length = 8
        fee_mint_data[166] = 1;
        fee_mint_data[167] = 0;
        fee_mint_data[168] = 8;
        fee_mint_data[169] = 0;
        let mut fee_lamports = 1_000_000;
        let fee_mint_info = AccountInfo::new(
            &token_2022_key,
            false,
            false,
            &mut fee_lamports,
            &mut fee_mint_data,
            &token_2022_program,
            false,
            0,
        );
        let err = validate_vault_usdc_mint(&fee_mint_info);
        assert!(err.is_err());
        assert_eq!(err.unwrap_err(), error!(AsolError::InvalidVaultMintExtensions));

        // Token-2022 mint with PermanentDelegate (extension type 12)
        let mut delegate_mint_data = vec![0u8; 200];
        delegate_mint_data[166] = 12;
        delegate_mint_data[167] = 0;
        delegate_mint_data[168] = 32;
        delegate_mint_data[169] = 0;
        let mut delegate_lamports = 1_000_000;
        let delegate_mint_info = AccountInfo::new(
            &token_2022_key,
            false,
            false,
            &mut delegate_lamports,
            &mut delegate_mint_data,
            &token_2022_program,
            false,
            0,
        );
        let err = validate_vault_usdc_mint(&delegate_mint_info);
        assert!(err.is_err());
        assert_eq!(err.unwrap_err(), error!(AsolError::InvalidVaultMintExtensions));

        // Token-2022 mint with TransferHook (extension type 14)
        let mut hook_mint_data = vec![0u8; 200];
        hook_mint_data[166] = 14;
        hook_mint_data[167] = 0;
        hook_mint_data[168] = 32;
        hook_mint_data[169] = 0;
        let mut hook_lamports = 1_000_000;
        let hook_mint_info = AccountInfo::new(
            &token_2022_key,
            false,
            false,
            &mut hook_lamports,
            &mut hook_mint_data,
            &token_2022_program,
            false,
            0,
        );
        let err = validate_vault_usdc_mint(&hook_mint_info);
        assert!(err.is_err());
        assert_eq!(err.unwrap_err(), error!(AsolError::InvalidVaultMintExtensions));
    }

    #[test]
    fn test_proof_depth_and_rate_ceiling_bounds() {
        assert_eq!(MAX_STAR_PROOF_DEPTH, 32);
        assert_eq!(MAX_YIELD_RATE_PER_USDC_DAY, 1_000_000_0000);
    }
}

