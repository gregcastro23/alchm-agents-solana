use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct DeedPosition {
    pub version: u8,
    pub pool_id: u16,
    pub owner: Pubkey,
    pub shares: u64,
    pub created_slot: u64,
    pub bump: u8,
}
