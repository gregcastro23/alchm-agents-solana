use anchor_lang::{
    prelude::*,
    solana_program::{
        ed25519_program,
        sysvar::instructions::{load_current_index_checked, load_instruction_at_checked},
    },
};

use crate::{
    constants::{ED25519_PUBLIC_KEY_SIZE, ED25519_SIGNATURE_SIZE},
    errors::AsolError,
};

pub fn verify_preceding_ed25519_instruction(
    instructions: &AccountInfo,
    expected_signer: &Pubkey,
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
        message_size == expected_message.len(),
        AsolError::InvalidEd25519Authorization
    );
    let public_key = &data[public_key_offset..public_key_offset + ED25519_PUBLIC_KEY_SIZE];
    let message = &data[message_offset..message_offset + message_size];
    require!(
        public_key == expected_signer.as_ref() && message == expected_message,
        AsolError::InvalidEd25519Authorization
    );
    Ok(())
}
