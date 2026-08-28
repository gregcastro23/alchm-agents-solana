use anchor_lang::prelude::*;

use crate::{
    constants::{BPS_DENOMINATOR, RATIO_TOLERANCE_BPS},
    errors::AsolError,
};

#[account]
#[derive(InitSpace)]
pub struct ConstellationPool {
    pub version: u8,
    pub pool_id: u16,
    pub element_a: u8,
    pub element_b: u8,
    pub fee_bps: u16,
    pub reserve_a: u64,
    pub reserve_b: u64,
    pub total_shares: u64,
    pub bootstrapped: bool,
    pub paused: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PoolTraderNonce {
    pub version: u8,
    pub pool_id: u16,
    pub trader: Pubkey,
    pub nonce: u64,
    pub bump: u8,
}

#[event]
pub struct PoolRegistered {
    pub pool_id: u16,
    pub element_a: u8,
    pub element_b: u8,
    pub fee_bps: u16,
}

#[event]
pub struct PoolBootstrapped {
    pub pool_id: u16,
    pub reserve_a: u64,
    pub reserve_b: u64,
    pub total_shares: u64,
}

#[event]
pub struct PoolPauseToggled {
    pub pool_id: u16,
    pub paused: bool,
}

#[event]
pub struct LiquidityAdded {
    pub pool_id: u16,
    pub trader: Pubkey,
    pub amt_a: u64,
    pub amt_b: u64,
    pub shares: u64,
    pub deed_position: Pubkey,
    pub region_commit: [u8; 32],
    pub visible_stars: u8,
}

#[event]
pub struct Swapped {
    pub pool_id: u16,
    pub trader: Pubkey,
    pub in_element: u8,
    pub in_amount: u64,
    pub out_element: u8,
    pub out_amount: u64,
    pub reserve_a: u64,
    pub reserve_b: u64,
    pub region_commit: [u8; 32],
    pub visible_stars: u8,
}

#[event]
pub struct LiquidityWithdrawn {
    pub pool_id: u16,
    pub trader: Pubkey,
    pub deed_position: Pubkey,
    pub pull_shares: u64,
    pub remaining_shares: u64,
    pub amt_a: u64,
    pub amt_b: u64,
    pub reserve_a: u64,
    pub reserve_b: u64,
}

pub fn integer_sqrt(y: u128) -> u128 {
    if y > 3 {
        let mut z = y;
        let mut x = y / 2 + 1;
        while x < z {
            z = x;
            x = (y / x + x) / 2;
        }
        z
    } else if y != 0 {
        1
    } else {
        0
    }
}

pub fn quote_swap(reserve_in: u64, reserve_out: u64, fee_bps: u16, in_amount: u64) -> Result<u64> {
    if in_amount == 0 || reserve_in == 0 || reserve_out == 0 {
        return Ok(0);
    }
    require!(fee_bps <= 10_000, AsolError::FeeExceedsMaximum);
    let fee_factor = (BPS_DENOMINATOR as u128)
        .checked_sub(fee_bps as u128)
        .ok_or(AsolError::ArithmeticOverflow)?;
    let in_with_fee = (in_amount as u128)
        .checked_mul(fee_factor)
        .ok_or(AsolError::ArithmeticOverflow)?
        / (BPS_DENOMINATOR as u128);

    let numerator = (reserve_out as u128)
        .checked_mul(in_with_fee)
        .ok_or(AsolError::ArithmeticOverflow)?;
    let denominator = (reserve_in as u128)
        .checked_add(in_with_fee)
        .ok_or(AsolError::ArithmeticOverflow)?;
    if denominator == 0 {
        return Ok(0);
    }
    let out_amt = numerator / denominator;
    Ok(out_amt as u64)
}

pub fn compute_add_shares(
    reserve_a: u64,
    reserve_b: u64,
    total_shares: u64,
    amt_a: u64,
    amt_b: u64,
) -> Result<u64> {
    require!(amt_a > 0 && amt_b > 0, AsolError::ZeroAmount);
    require!(
        reserve_a > 0 && reserve_b > 0 && total_shares > 0,
        AsolError::PoolNotBootstrapped
    );

    let s_a = (amt_a as u128)
        .checked_mul(total_shares as u128)
        .ok_or(AsolError::ArithmeticOverflow)?
        / (reserve_a as u128);
    let s_b = (amt_b as u128)
        .checked_mul(total_shares as u128)
        .ok_or(AsolError::ArithmeticOverflow)?
        / (reserve_b as u128);

    let lo = s_a.min(s_b);
    let hi = s_a.max(s_b);
    require!(lo > 0, AsolError::InsufficientLiquidity);

    // On-ratio guard: (hi - lo) * 10_000 <= lo * RATIO_TOLERANCE_BPS (100 = 1%)
    let diff_scaled = (hi - lo)
        .checked_mul(BPS_DENOMINATOR as u128)
        .ok_or(AsolError::ArithmeticOverflow)?;
    let tolerance_limit = lo
        .checked_mul(RATIO_TOLERANCE_BPS as u128)
        .ok_or(AsolError::ArithmeticOverflow)?;
    require!(diff_scaled <= tolerance_limit, AsolError::OffRatioDeposit);

    Ok(lo as u64)
}

pub fn compute_withdrawal(
    reserve_a: u64,
    reserve_b: u64,
    total_shares: u64,
    shares: u64,
    share_bps: u16,
) -> Result<(u64, u64, u64)> {
    require!(
        share_bps > 0 && share_bps <= BPS_DENOMINATOR as u16,
        AsolError::InvalidShareBps
    );
    require!(shares > 0, AsolError::ZeroAmount);
    require!(total_shares > 0, AsolError::InsufficientLiquidity);

    let pull_shares = (shares as u128)
        .checked_mul(share_bps as u128)
        .ok_or(AsolError::ArithmeticOverflow)?
        / (BPS_DENOMINATOR as u128);
    require!(pull_shares > 0, AsolError::InvalidShareBps);
    let pull_shares = pull_shares.min(shares as u128) as u64;

    let amt_a = (reserve_a as u128)
        .checked_mul(pull_shares as u128)
        .ok_or(AsolError::ArithmeticOverflow)?
        / (total_shares as u128);
    let amt_b = (reserve_b as u128)
        .checked_mul(pull_shares as u128)
        .ok_or(AsolError::ArithmeticOverflow)?
        / (total_shares as u128);

    Ok((pull_shares, amt_a as u64, amt_b as u64))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_integer_sqrt() {
        assert_eq!(integer_sqrt(0), 0);
        assert_eq!(integer_sqrt(1), 1);
        assert_eq!(integer_sqrt(3), 1);
        assert_eq!(integer_sqrt(4), 2);
        assert_eq!(integer_sqrt(1_000_000_000_000), 1_000_000);
        assert_eq!(integer_sqrt(100 * 100), 100);
    }

    #[test]
    fn test_quote_swap_math() {
        let r_in: u64 = 1_000_000;
        let r_out: u64 = 1_000_000;
        let fee_bps: u16 = 30; // 0.3%
        let in_amt: u64 = 100_000;

        // in_with_fee = 100_000 * 9970 / 10000 = 99_700
        // out_amt = 1_000_000 * 99_700 / (1_000_000 + 99_700) = 99700000000 / 1099700 = 90661
        let out = quote_swap(r_in, r_out, fee_bps, in_amt).unwrap();
        assert_eq!(out, 90661);

        // Constant-product k after swap:
        // new_r_in = 1_000_000 + 100_000 = 1_100_000
        // new_r_out = 1_000_000 - 90661 = 909339
        // new_k = 1_100_000 * 909339 = 1_000_272_900_000 >= old_k (1_000_000_000_000)
        let old_k = (r_in as u128) * (r_out as u128);
        let new_k = (r_in as u128 + in_amt as u128) * (r_out as u128 - out as u128);
        assert!(new_k >= old_k);
    }

    #[test]
    fn test_add_liquidity_ratio_tolerance() {
        let r_a: u64 = 1_000_000;
        let r_b: u64 = 2_000_000;
        let total_shares: u64 = 1_414_213;

        // Perfectly on-ratio (1:2)
        let shares = compute_add_shares(r_a, r_b, total_shares, 100_000, 200_000).unwrap();
        assert_eq!(shares, 141_421);

        // Within 1% tolerance: amt_b is 201_000 (+0.5%)
        let shares_tol = compute_add_shares(r_a, r_b, total_shares, 100_000, 201_000).unwrap();
        assert_eq!(shares_tol, 141_421);

        // Outside 1% tolerance: amt_b is 205_000 (+2.5%) -> Reverts OffRatioDeposit
        let err = compute_add_shares(r_a, r_b, total_shares, 100_000, 205_000);
        assert!(err.is_err());
    }

    #[test]
    fn test_round_trip_add_and_withdraw() {
        let r_a: u64 = 1_000_000;
        let r_b: u64 = 1_000_000;
        let total_shares: u64 = 1_000_000;

        let deposit_a: u64 = 50_000;
        let deposit_b: u64 = 50_000;
        let minted_shares =
            compute_add_shares(r_a, r_b, total_shares, deposit_a, deposit_b).unwrap();
        assert_eq!(minted_shares, 50_000);

        let new_r_a = r_a + deposit_a;
        let new_r_b = r_b + deposit_b;
        let new_total_shares = total_shares + minted_shares;

        // Immediate 100% withdraw (10000 bps)
        let (pull_shares, withdrawn_a, withdrawn_b) =
            compute_withdrawal(new_r_a, new_r_b, new_total_shares, minted_shares, 10_000).unwrap();

        assert_eq!(pull_shares, minted_shares);
        assert!(withdrawn_a <= deposit_a);
        assert!(withdrawn_b <= deposit_b);
        assert_eq!(withdrawn_a, deposit_a);
        assert_eq!(withdrawn_b, deposit_b);
    }
}
