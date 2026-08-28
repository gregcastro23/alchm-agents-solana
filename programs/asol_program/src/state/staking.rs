use anchor_lang::prelude::*;

use crate::constants::{SECONDS_PER_DAY, USDC_SCALE};

#[account]
#[derive(InitSpace)]
pub struct StarVaultState {
    pub version: u8,
    pub admin: Pubkey,
    pub usdc_mint: Pubkey,
    pub vault_usdc_ata: Pubkey,
    pub total_principal: u64,
    pub star_root: [u8; 32],
    pub max_yield_rate_per_usdc_day: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct StarPool {
    pub version: u8,
    pub star_id: u32,
    pub activated: bool,
    pub total_principal: u64,
    pub total_shares: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct StakePosition {
    pub version: u8,
    pub staker: Pubkey,
    pub star_id: u32,
    pub shares: u64,
    pub principal: u64,
    pub accrued_cap: u64,
    pub last_checkpoint: i64,
    pub claim_nonce: u64,
    pub bump: u8,
}

/// Computes yield cap in ESMS atoms given principal (6 decimals), daily rate, and elapsed seconds.
/// Infallible and saturating: never overflows or halts custody operations.
/// Formula: (principal * max_rate * elapsed_seconds) / (10^6 * 86400) clamped to u64::MAX
pub fn calculate_accrued_yield_cap(
    principal: u64,
    max_rate_per_usdc_day: u64,
    elapsed_seconds: i64,
) -> u64 {
    if principal == 0 || max_rate_per_usdc_day == 0 || elapsed_seconds <= 0 {
        return 0;
    }
    let numerator = (principal as u128)
        .saturating_mul(max_rate_per_usdc_day as u128)
        .saturating_mul(elapsed_seconds as u128);
    let denominator = USDC_SCALE.saturating_mul(SECONDS_PER_DAY as u128);
    let cap = numerator / denominator;
    cap.min(u64::MAX as u128) as u64
}

/// Updates the position's accrued yield cap before modifying principal or shares.
/// Infallible and monotonic: backwards clock never rewinds, overflow saturates at u64::MAX.
pub fn checkpoint_yield(
    position: &mut StakePosition,
    max_rate_per_usdc_day: u64,
    now: i64,
) -> Result<()> {
    let elapsed = now.saturating_sub(position.last_checkpoint);
    if elapsed <= 0 {
        // A backwards clock must not rewind the checkpoint; move it forward only.
        position.last_checkpoint = now.max(position.last_checkpoint);
        return Ok(());
    }
    if position.principal > 0 && max_rate_per_usdc_day > 0 {
        let delta = calculate_accrued_yield_cap(position.principal, max_rate_per_usdc_day, elapsed);
        position.accrued_cap = position.accrued_cap.saturating_add(delta);
    }
    position.last_checkpoint = now.max(position.last_checkpoint);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_checkpointed_yield_accrual_no_retroactive() {
        let max_rate: u64 = 5_0000; // 5 ESMS atoms per USDC per day
        let day_seconds: i64 = 86_400;

        // Staked at start_time (Day 0)
        let start_time: i64 = 1_000_000;
        let mut position = StakePosition {
            version: 1,
            staker: Pubkey::default(),
            star_id: 677,
            shares: 10_000_000,
            principal: 10_000_000, // 10 USDC
            accrued_cap: 0,
            last_checkpoint: start_time,
            claim_nonce: 0,
            bump: 0,
        };

        // Simulate 10 days passing
        let day_10_time = start_time + 10 * day_seconds;
        checkpoint_yield(&mut position, max_rate, day_10_time).unwrap();

        // 10 USDC * 5 ESMS * 10 days = 500 ESMS atoms (500_0000 = 5_000_000)
        let expected_cap_10_days = (10_000_000_u128 * (max_rate as u128) * 10) / 1_000_000;
        assert_eq!(position.accrued_cap, expected_cap_10_days as u64);
        assert_eq!(position.last_checkpoint, day_10_time);

        // User deposits 1,000 USDC on day 10
        let top_up: u64 = 1_000_000_000;
        position.principal += top_up;
        position.shares += top_up;

        // Checkpoint 1 second later
        let day_10_plus_1 = day_10_time + 1;
        let interval_cap = calculate_accrued_yield_cap(
            position.principal,
            max_rate,
            day_10_plus_1 - position.last_checkpoint,
        );

        // 1 second of 1,010 USDC at 5 ESMS/day = (1010 * 50000 * 1) / 86400 = 584 atoms
        assert_eq!(interval_cap, 584);
        let total_claimable = position.accrued_cap + interval_cap;
        assert_eq!(total_claimable, 5_000_584);

        // Under vulnerable Arc EVM formula (no checkpoint on top-up):
        // 1,010 USDC over 10 days + 1s = (1010 * 10^6 * 50000 * 864001) / (10^6 * 86400) = 505,000,584 atoms
        let vulnerable_evm_cap =
            calculate_accrued_yield_cap(position.principal, max_rate, day_10_plus_1 - start_time);
        assert_eq!(vulnerable_evm_cap, 505_000_584);

        // Checkpointed engine prevented an illegitimate 500,000,000 atom (100x) over-mint!
        assert_eq!(vulnerable_evm_cap - total_claimable, 500_000_000);
    }

    #[test]
    fn test_checkpoint_infallible_with_max_rate_100_years() {
        let max_rate: u64 = u64::MAX;
        let hundred_years_seconds: i64 = 100 * 365 * 86_400;

        let mut position = StakePosition {
            version: 1,
            staker: Pubkey::default(),
            star_id: 677,
            shares: 1_000_000_000_000, // 1M USDC
            principal: 1_000_000_000_000,
            accrued_cap: u64::MAX - 100,
            last_checkpoint: 1_000_000,
            claim_nonce: 0,
            bump: 0,
        };

        // Accrual must not panic or error; it saturates at u64::MAX
        let result = checkpoint_yield(&mut position, max_rate, 1_000_000 + hundred_years_seconds);
        assert!(result.is_ok());
        assert_eq!(position.accrued_cap, u64::MAX);
        assert_eq!(position.last_checkpoint, 1_000_000 + hundred_years_seconds);
    }

    #[test]
    fn test_backwards_clock_never_rewinds_checkpoint() {
        let mut position = StakePosition {
            version: 1,
            staker: Pubkey::default(),
            star_id: 677,
            shares: 10_000_000,
            principal: 10_000_000,
            accrued_cap: 100,
            last_checkpoint: 1_000_000,
            claim_nonce: 0,
            bump: 0,
        };

        // Clock moves backwards by 50 seconds
        let result = checkpoint_yield(&mut position, 50_000, 1_000_000 - 50);
        assert!(result.is_ok());
        // Checkpoint must NOT be rewound
        assert_eq!(position.last_checkpoint, 1_000_000);
        // Accrued cap must not change
        assert_eq!(position.accrued_cap, 100);
    }
}
