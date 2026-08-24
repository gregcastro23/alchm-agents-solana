use sha2::{Digest, Sha256};
use sha3::Keccak256;
use unicode_normalization::UnicodeNormalization;

pub const ESMS_DECIMALS: u8 = 4;
pub const MAX_LEDGER_ATOMS: u64 = 999_999_999_999;
pub const PERSONA_DOMAIN: &[u8] = b"ASOL_PERSONA_V1";
pub const EPOCH_DOMAIN: &[u8] = b"ASOL_EPOCH_V1";

pub fn ledger_units_to_atoms(value: &str) -> Option<u64> {
    let (whole, fraction) = match value.split_once('.') {
        Some((_whole, "")) => return None,
        Some((whole, fraction)) => (whole, fraction),
        None => (value, ""),
    };
    if whole.is_empty()
        || whole.len() > 8
        || fraction.len() > ESMS_DECIMALS as usize
        || !whole.bytes().all(|byte| byte.is_ascii_digit())
        || !fraction.bytes().all(|byte| byte.is_ascii_digit())
    {
        return None;
    }

    let whole = whole.parse::<u64>().ok()?;
    let fraction = if fraction.is_empty() {
        0
    } else {
        let parsed = fraction.parse::<u64>().ok()?;
        parsed.checked_mul(10_u64.pow(ESMS_DECIMALS as u32 - fraction.len() as u32))?
    };
    let atoms = whole
        .checked_mul(10_u64.pow(ESMS_DECIMALS as u32))?
        .checked_add(fraction)?;
    (atoms <= MAX_LEDGER_ATOMS).then_some(atoms)
}

pub fn target_persona_hash(agent_id: &str, values: &[f64]) -> Option<[u8; 32]> {
    if values.len() != 64 || values.iter().any(|value| !value.is_finite()) {
        return None;
    }

    let normalized_agent_id: String = agent_id.nfc().collect();
    let agent_key = Sha256::digest(normalized_agent_id.as_bytes());
    let mut hasher = Sha256::new();
    hasher.update(PERSONA_DOMAIN);
    hasher.update(agent_key);
    for value in values {
        let canonical_value = if *value == 0.0 { 0.0 } else { *value };
        hasher.update(canonical_value.to_le_bytes());
    }
    Some(hasher.finalize().into())
}

pub fn epoch_context_hash(canonical_json: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(EPOCH_DOMAIN);
    hasher.update(canonical_json);
    hasher.finalize().into()
}

pub fn openzeppelin_star_leaf(star_id: u32) -> [u8; 32] {
    let mut abi_word = [0_u8; 32];
    abi_word[28..].copy_from_slice(&star_id.to_be_bytes());
    let inner = Keccak256::digest(abi_word);
    Keccak256::digest(inner).into()
}

pub const REDEEM_AUTHORIZATION_DOMAIN: &[u8] = b"ASOL_ESMS_REDEEM_V1";

pub fn redeem_authorization_vector(
    program_id: &[u8; 32],
    cluster_domain: &[u8; 32],
    holder: &[u8; 32],
    order_id: &[u8; 32],
    amounts: &[u64; 4],
    deadline: i64,
) -> Vec<u8> {
    let mut message = Vec::with_capacity(REDEEM_AUTHORIZATION_DOMAIN.len() + 32 * 4 + 8 * 5);
    message.extend_from_slice(REDEEM_AUTHORIZATION_DOMAIN);
    message.extend_from_slice(program_id);
    message.extend_from_slice(cluster_domain);
    message.extend_from_slice(holder);
    message.extend_from_slice(order_id);
    for amount in amounts {
        message.extend_from_slice(&amount.to_le_bytes());
    }
    message.extend_from_slice(&deadline.to_le_bytes());
    message
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scales_ledger_units_to_esms_atoms() {
        assert_eq!(ledger_units_to_atoms("100.0000"), Some(1_000_000));
        assert_eq!(ledger_units_to_atoms("0.0001"), Some(1));
        assert_eq!(
            ledger_units_to_atoms("99999999.9999"),
            Some(MAX_LEDGER_ATOMS)
        );
        assert_eq!(ledger_units_to_atoms("1."), None);
        assert_eq!(ledger_units_to_atoms("1.00000"), None);
        assert_eq!(ledger_units_to_atoms("-1.0000"), None);
    }

    #[test]
    fn hashes_canonical_persona_and_epoch_vectors() {
        let mut persona = [0_f64; 64];
        for (index, value) in persona.iter_mut().enumerate().skip(1) {
            *value = (index as f64 - 32.0) / 8.0;
        }

        assert_eq!(
            hex(&target_persona_hash("gregory-castro", &persona).unwrap()),
            "d796333f06b38838fd61c409a36a83051e441bc1cd3ae5185d428ddce9fae4c0"
        );
        assert_eq!(
            hex(&epoch_context_hash(
                br#"{"domicile":"Sun","epoch":42,"retrogrades":["Mercury"],"transits":{"Moon":123.456}}"#
            )),
            "fa9eb38e5689391a27906e2f356d9fc60b78f8f6b0c3fc1a5ff41222ffe58063"
        );
    }

    #[test]
    fn hashes_openzeppelin_uint32_leaf() {
        assert_eq!(
            hex(&openzeppelin_star_leaf(677)),
            "3faa6d4015e2c725ac8e804470bee904ec1855a333dafaf3fbf6e06fdf3e94a2"
        );
    }

    #[test]
    fn serializes_canonical_redeem_authorization_vector() {
        let program_id = [1; 32];
        let cluster = [2; 32];
        let holder = [3; 32];
        let order = [4; 32];
        let amounts = [10_000, 20_000, 30_000, 40_000];
        let deadline = 1_900_000_000;
        let vector = redeem_authorization_vector(
            &program_id,
            &cluster,
            &holder,
            &order,
            &amounts,
            deadline,
        );
        assert_eq!(
            hex(&vector),
            "41534f4c5f45534d535f52454445454d5f563101010101010101010101010101010101010101010101010101010101010101010202020202020202020202020202020202020202020202020202020202020202030303030303030303030303030303030303030303030303030303030303030304040404040404040404040404040404040404040404040404040404040404041027000000000000204e0000000000003075000000000000409c00000000000000b33f7100000000"
        );
    }


    fn hex(bytes: &[u8]) -> String {
        use std::fmt::Write;

        bytes.iter().fold(
            String::with_capacity(bytes.len() * 2),
            |mut output, byte| {
                write!(&mut output, "{byte:02x}").expect("writing to String cannot fail");
                output
            },
        )
    }
}
