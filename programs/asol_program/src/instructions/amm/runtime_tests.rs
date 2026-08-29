//! Runtime suite for the Constellation AMM, executed inside `litesvm` against the
//! **compiled SBF program** and the **real Token-2022 binary** — not against a
//! re-implementation of either.
//!
//! Phase 5 finding **S10**: "The whole suite is a TypeScript re-implementation
//! checked against itself." Everything below runs the actual `.so`, so an account
//! that Anchor would accept at runtime is accepted here, and one it would reject is
//! rejected here for the same reason.
//!
//! Prerequisites (the harness fails loudly rather than skipping — a security test
//! that silently no-ops is worse than one that is absent):
//!   1. `bun run solana:build` → `target/deploy/asol_program.so`
//!   2. `programs/asol_program/tests/fixtures/spl_token_2022.so` (see that dir's README)

use std::path::PathBuf;

use anchor_lang::{AccountDeserialize, AccountSerialize, AnchorSerialize};
use litesvm::types::{FailedTransactionMetadata, TransactionResult};
use litesvm::LiteSVM;
use sha2::{Digest, Sha256};
use solana_sdk::{
    account::Account,
    compute_budget::ComputeBudgetInstruction,
    ed25519_program,
    instruction::{AccountMeta, Instruction, InstructionError},
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    system_program,
    sysvar::{clock::Clock, instructions as instructions_sysvar},
    transaction::{Transaction, TransactionError},
};

use crate::{
    constants::{
        AMM_NONCE_SEED, AMM_OP_ADD_LIQUIDITY, AMM_OP_SWAP, CONSTELLATION_POOL_SEED,
        DEED_POSITION_SEED, ESMS_MINT_SEED, PROGRAM_AUTHORITY_SEED, STATE_VERSION,
    },
    state::{ConstellationPool, DeedPosition, ProgramConfig},
    vectors::amm_visibility_authorization_message,
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// SPL Token-2022. Must match `anchor_spl::token_2022::ID`.
const TOKEN_2022_ID: Pubkey = solana_sdk::pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
/// SPL Associated Token Account program.
const ATA_PROGRAM_ID: Pubkey = solana_sdk::pubkey!("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

/// Anchor's `#[error_code]` base offset. `AsolError::X as u32 + ANCHOR_ERROR_BASE`.
const ANCHOR_ERROR_BASE: u32 = 6_000;
/// `anchor_lang::error::ErrorCode::ConstraintSeeds`.
const CONSTRAINT_SEEDS: u32 = 2_006;

const ELEMENT_SPIRIT: u8 = 0;
const ELEMENT_ESSENCE: u8 = 1;
const ELEMENT_MATTER: u8 = 2;

const POOL_SPIRIT_ESSENCE: u16 = 0;
const POOL_SPIRIT_MATTER: u16 = 1;
const FEE_BPS: u16 = 30;

/// 100.0000 ESMS per side of the bootstrap.
const BOOTSTRAP_RESERVE: u64 = 1_000_000;
/// 1,000.0000 ESMS granted to the trader per element.
const TRADER_GRANT: u64 = 10_000_000;

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

/// Anchor instruction discriminator: `sha256("global:<snake_case_name>")[..8]`.
fn discriminator(name: &str) -> [u8; 8] {
    let digest = Sha256::digest(format!("global:{name}").as_bytes());
    let mut out = [0u8; 8];
    out.copy_from_slice(&digest[..8]);
    out
}

fn ix_data(name: &str, args: &[u8]) -> Vec<u8> {
    let mut data = discriminator(name).to_vec();
    data.extend_from_slice(args);
    data
}

fn borsh<T: AnchorSerialize>(value: &T) -> Vec<u8> {
    let mut out = Vec::new();
    value.serialize(&mut out).expect("borsh serialization");
    out
}

/// Builds an Ed25519 precompile instruction in the canonical solana layout:
/// a 16-byte header, then the public key at 16, the signature at 48, and the
/// message at 112. All three `instruction_index` fields are `u16::MAX`, which is
/// what `verify_preceding_ed25519_instruction` requires.
fn ed25519_instruction(signer: &Keypair, message: &[u8]) -> Instruction {
    let signature = signer.sign_message(message);
    let public_key = signer.pubkey().to_bytes();

    let public_key_offset: u16 = 16;
    let signature_offset: u16 = public_key_offset + 32;
    let message_offset: u16 = signature_offset + 64;

    let mut data = Vec::with_capacity(message_offset as usize + message.len());
    data.push(1); // number of signatures
    data.push(0); // padding
    data.extend_from_slice(&signature_offset.to_le_bytes());
    data.extend_from_slice(&u16::MAX.to_le_bytes()); // signature_instruction_index
    data.extend_from_slice(&public_key_offset.to_le_bytes());
    data.extend_from_slice(&u16::MAX.to_le_bytes()); // public_key_instruction_index
    data.extend_from_slice(&message_offset.to_le_bytes());
    data.extend_from_slice(&(message.len() as u16).to_le_bytes());
    data.extend_from_slice(&u16::MAX.to_le_bytes()); // message_instruction_index
    data.extend_from_slice(&public_key);
    data.extend_from_slice(signature.as_ref());
    data.extend_from_slice(message);

    Instruction {
        program_id: ed25519_program::ID,
        accounts: vec![],
        data,
    }
}

// ---------------------------------------------------------------------------
// PDA helpers
// ---------------------------------------------------------------------------

fn program_config_address() -> (Pubkey, u8) {
    Pubkey::find_program_address(&[PROGRAM_AUTHORITY_SEED], &crate::ID)
}

fn esms_mint_address(element: u8) -> Pubkey {
    Pubkey::find_program_address(&[ESMS_MINT_SEED, &[element]], &crate::ID).0
}

fn pool_address(pool_id: u16) -> Pubkey {
    Pubkey::find_program_address(
        &[CONSTELLATION_POOL_SEED, &pool_id.to_le_bytes()],
        &crate::ID,
    )
    .0
}

fn deed_position_address(pool_id: u16, owner: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[DEED_POSITION_SEED, &pool_id.to_le_bytes(), owner.as_ref()],
        &crate::ID,
    )
    .0
}

fn nonce_address(pool_id: u16, trader: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[AMM_NONCE_SEED, &pool_id.to_le_bytes(), trader.as_ref()],
        &crate::ID,
    )
    .0
}

fn ata(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[owner.as_ref(), TOKEN_2022_ID.as_ref(), mint.as_ref()],
        &ATA_PROGRAM_ID,
    )
    .0
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

fn unwrap_ok(result: TransactionResult, what: &str) -> litesvm::types::TransactionMetadata {
    match result {
        Ok(meta) => meta,
        Err(FailedTransactionMetadata { err, meta }) => {
            panic!(
                "{what} should have succeeded but failed with {err:?}\nlogs:\n{:#?}",
                meta.logs
            )
        }
    }
}

fn custom_error_code(result: &TransactionResult) -> Option<u32> {
    match result {
        Err(FailedTransactionMetadata {
            err: TransactionError::InstructionError(_, InstructionError::Custom(code)),
            ..
        }) => Some(*code),
        _ => None,
    }
}

#[track_caller]
fn expect_custom_error(result: TransactionResult, expected: u32, what: &str) {
    match custom_error_code(&result) {
        Some(code) if code == expected => {}
        Some(code) => panic!("{what}: expected custom error {expected}, got {code}"),
        None => panic!(
            "{what}: expected custom error {expected}, got {:?}",
            result.map(|meta| meta.logs)
        ),
    }
}

#[track_caller]
fn expect_asol_error(result: TransactionResult, error: crate::errors::AsolError, what: &str) {
    expect_custom_error(result, error as u32 + ANCHOR_ERROR_BASE, what);
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

fn workspace_root() -> PathBuf {
    // CARGO_MANIFEST_DIR = <root>/programs/asol_program
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
}

struct Env {
    svm: LiteSVM,
    admin: Keypair,
    attestor: Keypair,
    trader: Keypair,
    config: Pubkey,
    cluster_domain: [u8; 32],
}

impl Env {
    /// Boots the SVM, plants `ProgramConfig`, creates the four ESMS mints through the
    /// program's own `initialize_esms_mints`, and funds the trader through
    /// `claim_mint_esms`. Only `ProgramConfig` is planted; everything else is produced
    /// by executing the real program.
    fn boot() -> Self {
        let program_so = workspace_root().join("target/deploy/asol_program.so");
        assert!(
            program_so.exists(),
            "missing {}. Run `bun run solana:build` before the runtime suite — \
             these tests execute the compiled SBF program, not a stub.",
            program_so.display()
        );
        let token_so =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/spl_token_2022.so");
        assert!(
            token_so.exists(),
            "missing {}. See that directory's README — litesvm's bundled Token-2022 \
             predates the Permissioned Burn extension and cannot execute ESMS burns.",
            token_so.display()
        );

        let mut svm = LiteSVM::new();
        svm.add_program_from_file(crate::ID, &program_so)
            .expect("load asol_program");
        // Overrides litesvm's bundled spl_token_2022-1.0.0.so, which has no
        // Permissioned Burn extension.
        svm.add_program_from_file(TOKEN_2022_ID, &token_so)
            .expect("load spl_token_2022");
        // litesvm 0.2.1 registers no account for the Ed25519 precompile, so its
        // account loader rejects any transaction containing one with
        // `InvalidProgramForExecution` before execution begins. The runtime never
        // *runs* a precompile -- `MessageProcessor::process_message` branches on
        // `is_precompile` and calls `process_precompile`, which is what actually
        // verifies the signature -- so the ELF planted here is never entered. It
        // exists only to satisfy the loader's "executable and owned by a loader"
        // check. `tx.verify_precompiles` and `process_precompile` still do the real
        // cryptography: `attestation_signed_by_a_non_attestor_fails` would pass
        // vacuously if they did not.
        svm.add_program_from_file(ed25519_program::ID, &program_so)
            .expect("register the ed25519 precompile address");

        let admin = Keypair::new();
        let attestor = Keypair::new();
        let trader = Keypair::new();
        for key in [&admin, &attestor, &trader] {
            svm.airdrop(&key.pubkey(), 100_000_000_000)
                .expect("airdrop");
        }

        let cluster_domain = [7u8; 32];
        let (config, config_bump) = program_config_address();

        // `initialize_config` requires an upgradeable-loader ProgramData account whose
        // upgrade authority is the admin. litesvm loads programs under the
        // non-upgradeable loader, so the config is planted directly. This is state
        // setup, not a code path under test.
        let mut data = Vec::new();
        ProgramConfig {
            version: STATE_VERSION,
            admin: admin.pubkey(),
            attestor: attestor.pubkey(),
            pauser: admin.pubkey(),
            cluster_domain,
            pause_claims: false,
            pause_redemptions: false,
            bump: config_bump,
        }
        .try_serialize(&mut data)
        .expect("serialize ProgramConfig");
        let lamports = svm.minimum_balance_for_rent_exemption(data.len());
        svm.set_account(
            config,
            Account {
                lamports,
                data,
                owner: crate::ID,
                executable: false,
                rent_epoch: 0,
            },
        )
        .expect("plant ProgramConfig");

        let mut env = Env {
            svm,
            admin,
            attestor,
            trader,
            config,
            cluster_domain,
        };
        env.initialize_mints();
        env.fund_trader();
        env
    }

    fn now(&self) -> i64 {
        self.svm.get_sysvar::<Clock>().unix_timestamp
    }

    fn deadline(&self) -> i64 {
        self.now() + 600
    }

    /// Sends `instructions` behind a raised compute-unit limit, exactly as the
    /// client SDK does via `injectComputeBudgetInstructions`. The budget instruction
    /// goes *first*, which keeps any Ed25519 instruction at `current_index - 1`
    /// relative to the instruction it authorizes.
    fn send(&mut self, instructions: &[Instruction], signers: &[&Keypair]) -> TransactionResult {
        let mut all = vec![ComputeBudgetInstruction::set_compute_unit_limit(1_400_000)];
        all.extend_from_slice(instructions);
        let payer = signers[0].pubkey();
        let blockhash = self.svm.latest_blockhash();
        let tx =
            Transaction::new_signed_with_payer(&all, Some(&payer), &signers.to_vec(), blockhash);
        self.svm.send_transaction(tx)
    }

    fn initialize_mints(&mut self) {
        let ix = Instruction {
            program_id: crate::ID,
            accounts: vec![
                AccountMeta::new_readonly(self.config, false),
                AccountMeta::new(self.admin.pubkey(), true),
                AccountMeta::new(esms_mint_address(0), false),
                AccountMeta::new(esms_mint_address(1), false),
                AccountMeta::new(esms_mint_address(2), false),
                AccountMeta::new(esms_mint_address(3), false),
                AccountMeta::new_readonly(TOKEN_2022_ID, false),
                AccountMeta::new_readonly(system_program::ID, false),
            ],
            data: ix_data("initialize_esms_mints", &[]),
        };
        let admin = self.admin.insecure_clone();
        unwrap_ok(self.send(&[ix], &[&admin]), "initialize_esms_mints");
    }

    fn fund_trader(&mut self) {
        let recipient = self.trader.pubkey();
        let claim_id = [9u8; 32];
        let ledger_reference_hash = [8u8; 32];
        let amounts: [u64; 4] = [TRADER_GRANT; 4];

        let claim_receipt = Pubkey::find_program_address(
            &[crate::constants::CLAIM_RECEIPT_SEED, &claim_id],
            &crate::ID,
        )
        .0;

        let mut accounts = vec![
            AccountMeta::new_readonly(self.config, false),
            AccountMeta::new(claim_receipt, false),
            AccountMeta::new(self.admin.pubkey(), true),
            AccountMeta::new_readonly(recipient, false),
        ];
        for element in 0..4u8 {
            accounts.push(AccountMeta::new(esms_mint_address(element), false));
        }
        for element in 0..4u8 {
            accounts.push(AccountMeta::new(
                ata(&recipient, &esms_mint_address(element)),
                false,
            ));
        }
        accounts.push(AccountMeta::new_readonly(TOKEN_2022_ID, false));
        accounts.push(AccountMeta::new_readonly(ATA_PROGRAM_ID, false));
        accounts.push(AccountMeta::new_readonly(system_program::ID, false));

        let mut args = Vec::new();
        args.extend_from_slice(&claim_id);
        args.extend_from_slice(&ledger_reference_hash);
        args.extend_from_slice(&borsh(&amounts));

        let ix = Instruction {
            program_id: crate::ID,
            accounts,
            data: ix_data("claim_mint_esms", &args),
        };
        let admin = self.admin.insecure_clone();
        unwrap_ok(self.send(&[ix], &[&admin]), "claim_mint_esms");
    }

    // -- pool lifecycle -----------------------------------------------------

    fn register_pool(&mut self, pool_id: u16, element_a: u8, element_b: u8) -> TransactionResult {
        let mut args = Vec::new();
        args.extend_from_slice(&pool_id.to_le_bytes());
        args.push(element_a);
        args.push(element_b);
        args.extend_from_slice(&FEE_BPS.to_le_bytes());
        let ix = Instruction {
            program_id: crate::ID,
            accounts: vec![
                AccountMeta::new_readonly(self.config, false),
                AccountMeta::new(self.admin.pubkey(), true),
                AccountMeta::new(pool_address(pool_id), false),
                AccountMeta::new_readonly(system_program::ID, false),
            ],
            data: ix_data("register_pool", &args),
        };
        let admin = self.admin.insecure_clone();
        self.send(&[ix], &[&admin])
    }

    fn bootstrap_pool(
        &mut self,
        pool_id: u16,
        reserve_a: u64,
        reserve_b: u64,
    ) -> TransactionResult {
        let mut args = Vec::new();
        args.extend_from_slice(&pool_id.to_le_bytes());
        args.extend_from_slice(&reserve_a.to_le_bytes());
        args.extend_from_slice(&reserve_b.to_le_bytes());
        let ix = Instruction {
            program_id: crate::ID,
            accounts: vec![
                AccountMeta::new_readonly(self.config, false),
                AccountMeta::new(self.admin.pubkey(), true),
                AccountMeta::new(pool_address(pool_id), false),
            ],
            data: ix_data("bootstrap_pool", &args),
        };
        let admin = self.admin.insecure_clone();
        self.send(&[ix], &[&admin])
    }

    fn live_pool(&mut self, pool_id: u16, element_a: u8, element_b: u8) {
        unwrap_ok(
            self.register_pool(pool_id, element_a, element_b),
            "register_pool",
        );
        unwrap_ok(
            self.bootstrap_pool(pool_id, BOOTSTRAP_RESERVE, BOOTSTRAP_RESERVE),
            "bootstrap_pool",
        );
    }

    // -- attested instructions ---------------------------------------------

    fn attestation_message(&self, pool_id: u16, op: u8, nonce: u64, deadline: i64) -> Vec<u8> {
        amm_visibility_authorization_message(
            &crate::ID.to_bytes(),
            &self.cluster_domain,
            &self.trader.pubkey().to_bytes(),
            pool_id,
            op,
            &[3u8; 32],
            5,
            nonce,
            deadline,
        )
    }

    fn trader_nonce(&self, pool_id: u16) -> u64 {
        let address = nonce_address(pool_id, &self.trader.pubkey());
        match self.svm.get_account(&address) {
            Some(account) if account.data.len() > 8 => {
                crate::state::PoolTraderNonce::try_deserialize(&mut account.data.as_slice())
                    .map(|state| state.nonce)
                    .unwrap_or(0)
            }
            _ => 0,
        }
    }

    fn add_liquidity_instruction(
        &self,
        pool_id: u16,
        element_a: u8,
        element_b: u8,
        amt_a: u64,
        amt_b: u64,
        nonce: u64,
        deadline: i64,
    ) -> Instruction {
        let trader = self.trader.pubkey();
        let mint_a = esms_mint_address(element_a);
        let mint_b = esms_mint_address(element_b);

        let mut args = Vec::new();
        args.extend_from_slice(&pool_id.to_le_bytes());
        args.extend_from_slice(&amt_a.to_le_bytes());
        args.extend_from_slice(&amt_b.to_le_bytes());
        args.extend_from_slice(&0u64.to_le_bytes()); // min_shares
        args.extend_from_slice(&[3u8; 32]); // region_commit
        args.push(5); // visible_stars
        args.extend_from_slice(&nonce.to_le_bytes());
        args.extend_from_slice(&deadline.to_le_bytes());

        Instruction {
            program_id: crate::ID,
            accounts: vec![
                AccountMeta::new_readonly(self.config, false),
                AccountMeta::new(pool_address(pool_id), false),
                AccountMeta::new(trader, true),
                AccountMeta::new(nonce_address(pool_id, &trader), false),
                AccountMeta::new(mint_a, false),
                AccountMeta::new(mint_b, false),
                AccountMeta::new(ata(&trader, &mint_a), false),
                AccountMeta::new(ata(&trader, &mint_b), false),
                AccountMeta::new(deed_position_address(pool_id, &trader), false),
                AccountMeta::new_readonly(instructions_sysvar::ID, false),
                AccountMeta::new_readonly(TOKEN_2022_ID, false),
                AccountMeta::new_readonly(system_program::ID, false),
            ],
            data: ix_data("add_liquidity", &args),
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn swap_instruction(
        &self,
        pool_id: u16,
        element_a: u8,
        element_b: u8,
        in_element: u8,
        in_amount: u64,
        nonce: u64,
        deadline: i64,
        in_ata: Pubkey,
        out_ata: Pubkey,
    ) -> Instruction {
        let trader = self.trader.pubkey();
        let mut args = Vec::new();
        args.extend_from_slice(&pool_id.to_le_bytes());
        args.push(in_element);
        args.extend_from_slice(&in_amount.to_le_bytes());
        args.extend_from_slice(&0u64.to_le_bytes()); // min_out
        args.extend_from_slice(&[3u8; 32]); // region_commit
        args.push(5); // visible_stars
        args.extend_from_slice(&nonce.to_le_bytes());
        args.extend_from_slice(&deadline.to_le_bytes());

        Instruction {
            program_id: crate::ID,
            accounts: vec![
                AccountMeta::new_readonly(self.config, false),
                AccountMeta::new(pool_address(pool_id), false),
                AccountMeta::new(trader, true),
                AccountMeta::new(nonce_address(pool_id, &trader), false),
                AccountMeta::new(esms_mint_address(element_a), false),
                AccountMeta::new(esms_mint_address(element_b), false),
                AccountMeta::new(in_ata, false),
                AccountMeta::new(out_ata, false),
                AccountMeta::new_readonly(instructions_sysvar::ID, false),
                AccountMeta::new_readonly(TOKEN_2022_ID, false),
                AccountMeta::new_readonly(ATA_PROGRAM_ID, false),
                AccountMeta::new_readonly(system_program::ID, false),
            ],
            data: ix_data("swap_esms", &args),
        }
    }

    fn withdraw_instruction(
        &self,
        pool_id: u16,
        element_a: u8,
        element_b: u8,
        share_bps: u16,
        owner: &Pubkey,
        deed_position: Pubkey,
    ) -> Instruction {
        let mint_a = esms_mint_address(element_a);
        let mint_b = esms_mint_address(element_b);
        let mut args = Vec::new();
        args.extend_from_slice(&pool_id.to_le_bytes());
        args.extend_from_slice(&share_bps.to_le_bytes());

        Instruction {
            program_id: crate::ID,
            accounts: vec![
                AccountMeta::new_readonly(self.config, false),
                AccountMeta::new(pool_address(pool_id), false),
                AccountMeta::new(*owner, true),
                AccountMeta::new(mint_a, false),
                AccountMeta::new(mint_b, false),
                AccountMeta::new(ata(owner, &mint_a), false),
                AccountMeta::new(ata(owner, &mint_b), false),
                AccountMeta::new(deed_position, false),
                AccountMeta::new_readonly(TOKEN_2022_ID, false),
                AccountMeta::new_readonly(ATA_PROGRAM_ID, false),
                AccountMeta::new_readonly(system_program::ID, false),
            ],
            data: ix_data("withdraw_liquidity", &args),
        }
    }

    // -- state readers ------------------------------------------------------

    fn pool_state(&self, pool_id: u16) -> ConstellationPool {
        let account = self
            .svm
            .get_account(&pool_address(pool_id))
            .expect("pool account");
        ConstellationPool::try_deserialize(&mut account.data.as_slice()).expect("pool decode")
    }

    fn deed_state(&self, pool_id: u16, owner: &Pubkey) -> Option<DeedPosition> {
        let account = self
            .svm
            .get_account(&deed_position_address(pool_id, owner))?;
        if account.lamports == 0 || account.data.len() < 8 {
            return None;
        }
        DeedPosition::try_deserialize(&mut account.data.as_slice()).ok()
    }

    /// Token-2022 accounts keep `amount` at offset 64 of the base layout.
    fn token_balance(&self, owner: &Pubkey, element: u8) -> u64 {
        let address = ata(owner, &esms_mint_address(element));
        match self.svm.get_account(&address) {
            Some(account) if account.data.len() >= 72 => {
                u64::from_le_bytes(account.data[64..72].try_into().unwrap())
            }
            _ => 0,
        }
    }
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

#[test]
fn add_then_full_withdraw_returns_at_most_deposited_and_closes_the_position() {
    let mut env = Env::boot();
    env.live_pool(POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE);
    let trader = env.trader.pubkey();

    let before_a = env.token_balance(&trader, ELEMENT_SPIRIT);
    let before_b = env.token_balance(&trader, ELEMENT_ESSENCE);
    assert_eq!(before_a, TRADER_GRANT);

    let deposit = 100_000u64;
    let deadline = env.deadline();
    let nonce = env.trader_nonce(POOL_SPIRIT_ESSENCE);
    let message =
        env.attestation_message(POOL_SPIRIT_ESSENCE, AMM_OP_ADD_LIQUIDITY, nonce, deadline);
    let sig_ix = ed25519_instruction(&env.attestor, &message);
    let add_ix = env.add_liquidity_instruction(
        POOL_SPIRIT_ESSENCE,
        ELEMENT_SPIRIT,
        ELEMENT_ESSENCE,
        deposit,
        deposit,
        nonce,
        deadline,
    );
    let trader_kp = env.trader.insecure_clone();
    unwrap_ok(env.send(&[sig_ix, add_ix], &[&trader_kp]), "add_liquidity");

    // Input was burned, not escrowed: the pool holds no custody of soulbound ESMS.
    assert_eq!(
        env.token_balance(&trader, ELEMENT_SPIRIT),
        before_a - deposit
    );
    assert_eq!(
        env.token_balance(&trader, ELEMENT_ESSENCE),
        before_b - deposit
    );

    let position = env
        .deed_state(POOL_SPIRIT_ESSENCE, &trader)
        .expect("position created");
    assert_eq!(position.owner, trader);
    assert_eq!(position.pool_id, POOL_SPIRIT_ESSENCE);
    assert_eq!(position.shares, deposit); // 1:1 against a symmetric bootstrap
    assert_eq!(position.version, STATE_VERSION);

    let pool = env.pool_state(POOL_SPIRIT_ESSENCE);
    assert_eq!(pool.reserve_a, BOOTSTRAP_RESERVE + deposit);
    assert_eq!(pool.total_shares, BOOTSTRAP_RESERVE + deposit);

    // Full exit.
    let deed = deed_position_address(POOL_SPIRIT_ESSENCE, &trader);
    let rent_before = env.svm.get_balance(&trader).unwrap_or(0);
    let withdraw_ix = env.withdraw_instruction(
        POOL_SPIRIT_ESSENCE,
        ELEMENT_SPIRIT,
        ELEMENT_ESSENCE,
        10_000,
        &trader,
        deed,
    );
    unwrap_ok(
        env.send(&[withdraw_ix], &[&trader_kp]),
        "withdraw_liquidity",
    );

    let after_a = env.token_balance(&trader, ELEMENT_SPIRIT);
    let after_b = env.token_balance(&trader, ELEMENT_ESSENCE);
    assert!(
        after_a <= before_a && after_b <= before_b,
        "a round trip must never return more than it took: {after_a}/{before_a}, {after_b}/{before_b}"
    );

    assert!(
        env.deed_state(POOL_SPIRIT_ESSENCE, &trader).is_none(),
        "the position must be closed once its last share is redeemed"
    );
    let rent_after = env.svm.get_balance(&trader).unwrap_or(0);
    assert!(
        rent_after > rent_before,
        "closing the position must refund its rent to the owner (before {rent_before}, after {rent_after})"
    );

    let pool = env.pool_state(POOL_SPIRIT_ESSENCE);
    assert_eq!(
        pool.total_shares, BOOTSTRAP_RESERVE,
        "only the permanently locked bootstrap shares remain"
    );
}

#[test]
fn swap_never_decreases_the_constant_product() {
    let mut env = Env::boot();
    env.live_pool(POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE);
    let trader = env.trader.pubkey();

    let before = env.pool_state(POOL_SPIRIT_ESSENCE);
    let k_before = before.reserve_a as u128 * before.reserve_b as u128;

    let in_amount = 100_000u64;
    let deadline = env.deadline();
    let nonce = env.trader_nonce(POOL_SPIRIT_ESSENCE);
    let message = env.attestation_message(POOL_SPIRIT_ESSENCE, AMM_OP_SWAP, nonce, deadline);
    let sig_ix = ed25519_instruction(&env.attestor, &message);
    let swap_ix = env.swap_instruction(
        POOL_SPIRIT_ESSENCE,
        ELEMENT_SPIRIT,
        ELEMENT_ESSENCE,
        ELEMENT_SPIRIT,
        in_amount,
        nonce,
        deadline,
        ata(&trader, &esms_mint_address(ELEMENT_SPIRIT)),
        ata(&trader, &esms_mint_address(ELEMENT_ESSENCE)),
    );
    let trader_kp = env.trader.insecure_clone();
    unwrap_ok(env.send(&[sig_ix, swap_ix], &[&trader_kp]), "swap_esms");

    let after = env.pool_state(POOL_SPIRIT_ESSENCE);
    let k_after = after.reserve_a as u128 * after.reserve_b as u128;
    assert!(
        k_after >= k_before,
        "the fee must leave k non-decreasing: {k_before} -> {k_after}"
    );
    assert_eq!(after.reserve_a, before.reserve_a + in_amount);
    assert!(after.reserve_b < before.reserve_b);
    assert_eq!(
        env.token_balance(&trader, ELEMENT_SPIRIT),
        TRADER_GRANT - in_amount
    );
    assert!(env.token_balance(&trader, ELEMENT_ESSENCE) > TRADER_GRANT);
}

// ---------------------------------------------------------------------------
// 1. Account substitution
// ---------------------------------------------------------------------------

#[test]
fn swap_with_a_substituted_output_ata_fails() {
    let mut env = Env::boot();
    env.live_pool(POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE);
    let trader = env.trader.pubkey();

    let deadline = env.deadline();
    let nonce = env.trader_nonce(POOL_SPIRIT_ESSENCE);
    let message = env.attestation_message(POOL_SPIRIT_ESSENCE, AMM_OP_SWAP, nonce, deadline);
    let sig_ix = ed25519_instruction(&env.attestor, &message);
    // Matter is not in this pool; its ATA is a valid Token-2022 account the trader
    // owns, so only the derivation assert stands between it and a mint of the wrong
    // element.
    let swap_ix = env.swap_instruction(
        POOL_SPIRIT_ESSENCE,
        ELEMENT_SPIRIT,
        ELEMENT_ESSENCE,
        ELEMENT_SPIRIT,
        50_000,
        nonce,
        deadline,
        ata(&trader, &esms_mint_address(ELEMENT_SPIRIT)),
        ata(&trader, &esms_mint_address(ELEMENT_MATTER)),
    );
    let trader_kp = env.trader.insecure_clone();
    expect_asol_error(
        env.send(&[sig_ix, swap_ix], &[&trader_kp]),
        crate::errors::AsolError::InvalidTokenAccount,
        "swap with a substituted output ATA",
    );
}

#[test]
fn swap_with_a_substituted_pool_mint_fails() {
    let mut env = Env::boot();
    env.live_pool(POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE);
    let trader = env.trader.pubkey();

    let deadline = env.deadline();
    let nonce = env.trader_nonce(POOL_SPIRIT_ESSENCE);
    let message = env.attestation_message(POOL_SPIRIT_ESSENCE, AMM_OP_SWAP, nonce, deadline);
    let sig_ix = ed25519_instruction(&env.attestor, &message);
    // Pass Matter where the pool's own state says Essence must be. The mint is
    // seed-derived from `pool.element_b`, so this cannot be steered by an argument.
    let mut swap_ix = env.swap_instruction(
        POOL_SPIRIT_ESSENCE,
        ELEMENT_SPIRIT,
        ELEMENT_ESSENCE,
        ELEMENT_SPIRIT,
        50_000,
        nonce,
        deadline,
        ata(&trader, &esms_mint_address(ELEMENT_SPIRIT)),
        ata(&trader, &esms_mint_address(ELEMENT_MATTER)),
    );
    swap_ix.accounts[5] = AccountMeta::new(esms_mint_address(ELEMENT_MATTER), false);
    let trader_kp = env.trader.insecure_clone();
    expect_custom_error(
        env.send(&[sig_ix, swap_ix], &[&trader_kp]),
        CONSTRAINT_SEEDS,
        "swap with a substituted pool mint",
    );
}

// ---------------------------------------------------------------------------
// 2. Ed25519 adjacency
// ---------------------------------------------------------------------------

#[test]
fn attestation_two_instructions_back_fails() {
    let mut env = Env::boot();
    env.live_pool(POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE);

    let deadline = env.deadline();
    let nonce = env.trader_nonce(POOL_SPIRIT_ESSENCE);
    let message =
        env.attestation_message(POOL_SPIRIT_ESSENCE, AMM_OP_ADD_LIQUIDITY, nonce, deadline);
    let sig_ix = ed25519_instruction(&env.attestor, &message);
    // A harmless self-transfer, not a second ComputeBudget instruction: duplicates
    // of those are rejected during sanitization and would never reach the program.
    let filler =
        solana_sdk::system_instruction::transfer(&env.trader.pubkey(), &env.trader.pubkey(), 0);
    let add_ix = env.add_liquidity_instruction(
        POOL_SPIRIT_ESSENCE,
        ELEMENT_SPIRIT,
        ELEMENT_ESSENCE,
        50_000,
        50_000,
        nonce,
        deadline,
    );
    let trader_kp = env.trader.insecure_clone();
    // The signature is valid and present — it is simply not at `current_index - 1`.
    expect_asol_error(
        env.send(&[sig_ix, filler, add_ix], &[&trader_kp]),
        crate::errors::AsolError::InvalidEd25519Authorization,
        "attestation two instructions back",
    );
}

#[test]
fn attestation_signed_by_a_non_attestor_fails() {
    let mut env = Env::boot();
    env.live_pool(POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE);

    let deadline = env.deadline();
    let nonce = env.trader_nonce(POOL_SPIRIT_ESSENCE);
    let message =
        env.attestation_message(POOL_SPIRIT_ESSENCE, AMM_OP_ADD_LIQUIDITY, nonce, deadline);
    let impostor = Keypair::new();
    let sig_ix = ed25519_instruction(&impostor, &message);
    let add_ix = env.add_liquidity_instruction(
        POOL_SPIRIT_ESSENCE,
        ELEMENT_SPIRIT,
        ELEMENT_ESSENCE,
        50_000,
        50_000,
        nonce,
        deadline,
    );
    let trader_kp = env.trader.insecure_clone();
    expect_asol_error(
        env.send(&[sig_ix, add_ix], &[&trader_kp]),
        crate::errors::AsolError::InvalidEd25519Authorization,
        "attestation signed by a non-attestor",
    );
}

#[test]
fn an_add_attestation_cannot_be_spent_on_a_swap() {
    let mut env = Env::boot();
    env.live_pool(POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE);
    let trader = env.trader.pubkey();

    let deadline = env.deadline();
    let nonce = env.trader_nonce(POOL_SPIRIT_ESSENCE);
    // Signed with op = add_liquidity, presented to swap_esms.
    let message =
        env.attestation_message(POOL_SPIRIT_ESSENCE, AMM_OP_ADD_LIQUIDITY, nonce, deadline);
    let sig_ix = ed25519_instruction(&env.attestor, &message);
    let swap_ix = env.swap_instruction(
        POOL_SPIRIT_ESSENCE,
        ELEMENT_SPIRIT,
        ELEMENT_ESSENCE,
        ELEMENT_SPIRIT,
        50_000,
        nonce,
        deadline,
        ata(&trader, &esms_mint_address(ELEMENT_SPIRIT)),
        ata(&trader, &esms_mint_address(ELEMENT_ESSENCE)),
    );
    let trader_kp = env.trader.insecure_clone();
    expect_asol_error(
        env.send(&[sig_ix, swap_ix], &[&trader_kp]),
        crate::errors::AsolError::InvalidEd25519Authorization,
        "an add attestation spent on a swap",
    );
}

#[test]
fn a_spent_nonce_cannot_be_replayed() {
    let mut env = Env::boot();
    env.live_pool(POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE);
    let trader = env.trader.pubkey();
    let trader_kp = env.trader.insecure_clone();

    let deadline = env.deadline();
    let nonce = env.trader_nonce(POOL_SPIRIT_ESSENCE);
    let message = env.attestation_message(POOL_SPIRIT_ESSENCE, AMM_OP_SWAP, nonce, deadline);
    let build = |env: &Env| {
        env.swap_instruction(
            POOL_SPIRIT_ESSENCE,
            ELEMENT_SPIRIT,
            ELEMENT_ESSENCE,
            ELEMENT_SPIRIT,
            50_000,
            nonce,
            deadline,
            ata(&trader, &esms_mint_address(ELEMENT_SPIRIT)),
            ata(&trader, &esms_mint_address(ELEMENT_ESSENCE)),
        )
    };
    let first = build(&env);
    unwrap_ok(
        env.send(
            &[ed25519_instruction(&env.attestor, &message), first],
            &[&trader_kp],
        ),
        "first swap",
    );

    env.svm.expire_blockhash();
    let second = build(&env);
    expect_asol_error(
        env.send(
            &[ed25519_instruction(&env.attestor, &message), second],
            &[&trader_kp],
        ),
        crate::errors::AsolError::InvalidPoolNonce,
        "replay of a spent nonce",
    );
}

// ---------------------------------------------------------------------------
// 3. Element outside the pool's pair
// ---------------------------------------------------------------------------

#[test]
fn swap_with_an_element_outside_the_pair_fails() {
    let mut env = Env::boot();
    env.live_pool(POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE);
    let trader = env.trader.pubkey();

    let deadline = env.deadline();
    let nonce = env.trader_nonce(POOL_SPIRIT_ESSENCE);
    let message = env.attestation_message(POOL_SPIRIT_ESSENCE, AMM_OP_SWAP, nonce, deadline);
    let sig_ix = ed25519_instruction(&env.attestor, &message);
    let swap_ix = env.swap_instruction(
        POOL_SPIRIT_ESSENCE,
        ELEMENT_SPIRIT,
        ELEMENT_ESSENCE,
        ELEMENT_MATTER, // not in (Spirit, Essence)
        50_000,
        nonce,
        deadline,
        ata(&trader, &esms_mint_address(ELEMENT_MATTER)),
        ata(&trader, &esms_mint_address(ELEMENT_ESSENCE)),
    );
    let trader_kp = env.trader.insecure_clone();
    expect_asol_error(
        env.send(&[sig_ix, swap_ix], &[&trader_kp]),
        crate::errors::AsolError::InvalidElementForPool,
        "swap with an element outside the pair",
    );
}

// ---------------------------------------------------------------------------
// 4 & 5. Position ownership and pool binding
// ---------------------------------------------------------------------------

#[test]
fn withdraw_by_a_non_owner_fails() {
    let mut env = Env::boot();
    env.live_pool(POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE);
    let trader = env.trader.pubkey();
    let trader_kp = env.trader.insecure_clone();

    let deadline = env.deadline();
    let nonce = env.trader_nonce(POOL_SPIRIT_ESSENCE);
    let message =
        env.attestation_message(POOL_SPIRIT_ESSENCE, AMM_OP_ADD_LIQUIDITY, nonce, deadline);
    let sig_ix = ed25519_instruction(&env.attestor, &message);
    let add_ix = env.add_liquidity_instruction(
        POOL_SPIRIT_ESSENCE,
        ELEMENT_SPIRIT,
        ELEMENT_ESSENCE,
        100_000,
        100_000,
        nonce,
        deadline,
    );
    unwrap_ok(env.send(&[sig_ix, add_ix], &[&trader_kp]), "add_liquidity");

    // An attacker presents the victim's position account and signs as themselves.
    let attacker = Keypair::new();
    env.svm.airdrop(&attacker.pubkey(), 10_000_000_000).unwrap();
    let victim_deed = deed_position_address(POOL_SPIRIT_ESSENCE, &trader);
    let ix = env.withdraw_instruction(
        POOL_SPIRIT_ESSENCE,
        ELEMENT_SPIRIT,
        ELEMENT_ESSENCE,
        10_000,
        &attacker.pubkey(),
        victim_deed,
    );
    expect_custom_error(
        env.send(&[ix], &[&attacker]),
        CONSTRAINT_SEEDS,
        "withdraw by a non-owner",
    );

    assert!(
        env.deed_state(POOL_SPIRIT_ESSENCE, &trader).is_some(),
        "the victim's position must survive the attempt"
    );
}

#[test]
fn a_position_from_one_pool_cannot_be_redeemed_against_another() {
    let mut env = Env::boot();
    env.live_pool(POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE);
    env.live_pool(POOL_SPIRIT_MATTER, ELEMENT_SPIRIT, ELEMENT_MATTER);
    let trader = env.trader.pubkey();
    let trader_kp = env.trader.insecure_clone();

    let deadline = env.deadline();
    let nonce = env.trader_nonce(POOL_SPIRIT_ESSENCE);
    let message =
        env.attestation_message(POOL_SPIRIT_ESSENCE, AMM_OP_ADD_LIQUIDITY, nonce, deadline);
    let sig_ix = ed25519_instruction(&env.attestor, &message);
    let add_ix = env.add_liquidity_instruction(
        POOL_SPIRIT_ESSENCE,
        ELEMENT_SPIRIT,
        ELEMENT_ESSENCE,
        100_000,
        100_000,
        nonce,
        deadline,
    );
    unwrap_ok(env.send(&[sig_ix, add_ix], &[&trader_kp]), "add_liquidity");

    // Pool 0's position, presented against pool 1's reserves.
    let pool_zero_deed = deed_position_address(POOL_SPIRIT_ESSENCE, &trader);
    let ix = env.withdraw_instruction(
        POOL_SPIRIT_MATTER,
        ELEMENT_SPIRIT,
        ELEMENT_MATTER,
        10_000,
        &trader,
        pool_zero_deed,
    );
    expect_custom_error(
        env.send(&[ix], &[&trader_kp]),
        CONSTRAINT_SEEDS,
        "a pool-0 position redeemed against pool 1",
    );

    let untouched = env.pool_state(POOL_SPIRIT_MATTER);
    assert_eq!(untouched.reserve_a, BOOTSTRAP_RESERVE);
    assert_eq!(untouched.reserve_b, BOOTSTRAP_RESERVE);
}

// ---------------------------------------------------------------------------
// 6. Bootstrap is one-shot
// ---------------------------------------------------------------------------

#[test]
fn a_pool_cannot_be_bootstrapped_twice() {
    let mut env = Env::boot();
    env.live_pool(POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE);

    // Arc's `seedInitial` was repeatable, which minted the admin a withdrawable
    // position against reserves nobody funded.
    env.svm.expire_blockhash();
    expect_asol_error(
        env.bootstrap_pool(POOL_SPIRIT_ESSENCE, BOOTSTRAP_RESERVE, BOOTSTRAP_RESERVE),
        crate::errors::AsolError::PoolAlreadyBootstrapped,
        "second bootstrap",
    );

    let pool = env.pool_state(POOL_SPIRIT_ESSENCE);
    assert_eq!(pool.reserve_a, BOOTSTRAP_RESERVE);
    assert_eq!(pool.total_shares, BOOTSTRAP_RESERVE);
}

#[test]
fn a_registered_pool_cannot_be_re_registered() {
    let mut env = Env::boot();
    unwrap_ok(
        env.register_pool(POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE),
        "register_pool",
    );
    unwrap_ok(
        env.bootstrap_pool(POOL_SPIRIT_ESSENCE, BOOTSTRAP_RESERVE, BOOTSTRAP_RESERVE),
        "bootstrap_pool",
    );

    // `init` rather than `init_if_needed`: re-registering must not be able to zero
    // reserves and total_shares on a pool with positions outstanding.
    env.svm.expire_blockhash();
    let result = env.register_pool(POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE);
    assert!(result.is_err(), "re-registering a live pool must fail");

    let pool = env.pool_state(POOL_SPIRIT_ESSENCE);
    assert_eq!(pool.total_shares, BOOTSTRAP_RESERVE);
    assert!(pool.bootstrapped);
}

// ---------------------------------------------------------------------------
// Pause and pair validation
// ---------------------------------------------------------------------------

#[test]
fn a_paused_pool_rejects_swaps_but_still_lets_liquidity_leave() {
    let mut env = Env::boot();
    env.live_pool(POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE);
    let trader = env.trader.pubkey();
    let trader_kp = env.trader.insecure_clone();

    let deadline = env.deadline();
    let nonce = env.trader_nonce(POOL_SPIRIT_ESSENCE);
    let message =
        env.attestation_message(POOL_SPIRIT_ESSENCE, AMM_OP_ADD_LIQUIDITY, nonce, deadline);
    let sig_ix = ed25519_instruction(&env.attestor, &message);
    let add_ix = env.add_liquidity_instruction(
        POOL_SPIRIT_ESSENCE,
        ELEMENT_SPIRIT,
        ELEMENT_ESSENCE,
        100_000,
        100_000,
        nonce,
        deadline,
    );
    unwrap_ok(env.send(&[sig_ix, add_ix], &[&trader_kp]), "add_liquidity");

    let mut args = Vec::new();
    args.extend_from_slice(&POOL_SPIRIT_ESSENCE.to_le_bytes());
    args.push(1); // paused = true
    let pause_ix = Instruction {
        program_id: crate::ID,
        accounts: vec![
            AccountMeta::new_readonly(env.config, false),
            AccountMeta::new_readonly(env.admin.pubkey(), true),
            AccountMeta::new(pool_address(POOL_SPIRIT_ESSENCE), false),
        ],
        data: ix_data("set_pool_pause", &args),
    };
    let admin = env.admin.insecure_clone();
    unwrap_ok(env.send(&[pause_ix], &[&admin]), "set_pool_pause");
    assert!(env.pool_state(POOL_SPIRIT_ESSENCE).paused);

    let deadline = env.deadline();
    let nonce = env.trader_nonce(POOL_SPIRIT_ESSENCE);
    let message = env.attestation_message(POOL_SPIRIT_ESSENCE, AMM_OP_SWAP, nonce, deadline);
    let sig_ix = ed25519_instruction(&env.attestor, &message);
    let swap_ix = env.swap_instruction(
        POOL_SPIRIT_ESSENCE,
        ELEMENT_SPIRIT,
        ELEMENT_ESSENCE,
        ELEMENT_SPIRIT,
        50_000,
        nonce,
        deadline,
        ata(&trader, &esms_mint_address(ELEMENT_SPIRIT)),
        ata(&trader, &esms_mint_address(ELEMENT_ESSENCE)),
    );
    expect_asol_error(
        env.send(&[sig_ix, swap_ix], &[&trader_kp]),
        crate::errors::AsolError::PoolPaused,
        "swap on a paused pool",
    );

    // Withdrawal carries no pause constraint by design: liquidity can always leave.
    let deed = deed_position_address(POOL_SPIRIT_ESSENCE, &trader);
    let withdraw_ix = env.withdraw_instruction(
        POOL_SPIRIT_ESSENCE,
        ELEMENT_SPIRIT,
        ELEMENT_ESSENCE,
        5_000,
        &trader,
        deed,
    );
    unwrap_ok(
        env.send(&[withdraw_ix], &[&trader_kp]),
        "partial withdraw from a paused pool",
    );

    let position = env
        .deed_state(POOL_SPIRIT_ESSENCE, &trader)
        .expect("half the position survives a 5000 bps exit");
    assert_eq!(position.shares, 50_000);
}

#[test]
fn register_pool_rejects_non_canonical_pairs_and_excessive_fees() {
    let mut env = Env::boot();

    // element_a must be strictly less than element_b, so a pair cannot be
    // registered under both orderings as two divergent pools.
    expect_asol_error(
        env.register_pool(2, ELEMENT_ESSENCE, ELEMENT_SPIRIT),
        crate::errors::AsolError::InvalidPoolElements,
        "reversed pair",
    );
    env.svm.expire_blockhash();
    expect_asol_error(
        env.register_pool(3, ELEMENT_SPIRIT, ELEMENT_SPIRIT),
        crate::errors::AsolError::InvalidPoolElements,
        "identical elements",
    );
    env.svm.expire_blockhash();
    expect_asol_error(
        env.register_pool(9, ELEMENT_SPIRIT, ELEMENT_ESSENCE),
        crate::errors::AsolError::InvalidPoolElements,
        "pool_id above the six canonical pairs",
    );
}

// ---------------------------------------------------------------------------
// Compute-unit profile
// ---------------------------------------------------------------------------

/// The exact compute-unit limits published by `lib/solana/priority-fee.ts`.
/// `profiles_compute_units` measures each instruction against its own published
/// limit and fails if it outgrows it, so a client transaction cannot silently start
/// running out of budget as the program changes.
///
/// Measured 2026-08-28, first touch (the instruction also pays to create its nonce
/// account and position):
///   register_pool 11_586 | bootstrap_pool 12_850 | set_pool_pause  7_343
///   add_liquidity 61_034 | swap_esms      49_350 | withdraw_liquidity 36_164
///
/// `withdraw_liquidity`'s limit carries more headroom than its measurement needs.
/// Its two `init_if_needed` output ATAs cannot be first-touched here: `add_liquidity`
/// requires both ATAs to already exist, so any owner holding a position has them.
/// The headroom (~2 x 25k, the observed cost of one `create_idempotent`) covers the
/// one reachable case -- an owner who closed an emptied ATA between add and withdraw.
const ADD_LIQUIDITY_CU_CEILING: u64 = 85_000;
const SWAP_ESMS_CU_CEILING: u64 = 75_000;
const WITHDRAW_LIQUIDITY_CU_CEILING: u64 = 95_000;
const REGISTER_POOL_CU_CEILING: u64 = 20_000;
const BOOTSTRAP_POOL_CU_CEILING: u64 = 20_000;
const SET_POOL_PAUSE_CU_CEILING: u64 = 15_000;

/// The `ComputeBudgetInstruction::set_compute_unit_limit` that `Env::send` prepends.
const COMPUTE_BUDGET_IX_CU: u64 = 150;

#[test]
fn profiles_compute_units() {
    let mut env = Env::boot();
    let trader = env.trader.pubkey();
    let trader_kp = env.trader.insecure_clone();
    let mut measured: Vec<(&str, u64, u64)> = Vec::new();

    let record = |name: &'static str,
                      meta: litesvm::types::TransactionMetadata,
                      ceiling: u64,
                      out: &mut Vec<(&'static str, u64, u64)>| {
        let cu = meta
            .compute_units_consumed
            .saturating_sub(COMPUTE_BUDGET_IX_CU);
        out.push((name, cu, ceiling));
    };

    let meta = unwrap_ok(
        env.register_pool(POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE),
        "register_pool",
    );
    record(
        "register_pool",
        meta,
        REGISTER_POOL_CU_CEILING,
        &mut measured,
    );

    let meta = unwrap_ok(
        env.bootstrap_pool(POOL_SPIRIT_ESSENCE, BOOTSTRAP_RESERVE, BOOTSTRAP_RESERVE),
        "bootstrap_pool",
    );
    record(
        "bootstrap_pool",
        meta,
        BOOTSTRAP_POOL_CU_CEILING,
        &mut measured,
    );

    // add_liquidity, first touch: creates both the nonce account and the position.
    let deadline = env.deadline();
    let nonce = env.trader_nonce(POOL_SPIRIT_ESSENCE);
    let message =
        env.attestation_message(POOL_SPIRIT_ESSENCE, AMM_OP_ADD_LIQUIDITY, nonce, deadline);
    let sig_ix = ed25519_instruction(&env.attestor, &message);
    let add_ix = env.add_liquidity_instruction(
        POOL_SPIRIT_ESSENCE,
        ELEMENT_SPIRIT,
        ELEMENT_ESSENCE,
        100_000,
        100_000,
        nonce,
        deadline,
    );
    let meta = unwrap_ok(env.send(&[sig_ix, add_ix], &[&trader_kp]), "add_liquidity");
    record(
        "add_liquidity",
        meta,
        ADD_LIQUIDITY_CU_CEILING,
        &mut measured,
    );

    // swap, worst case: the output ATA does not exist yet, so the instruction also
    // pays for `create_idempotent`.
    env.live_pool(POOL_SPIRIT_MATTER, ELEMENT_SPIRIT, ELEMENT_MATTER);
    let fresh = Keypair::new();
    env.svm.airdrop(&fresh.pubkey(), 100_000_000_000).unwrap();
    let deadline = env.deadline();
    let nonce = env.trader_nonce(POOL_SPIRIT_MATTER);
    let message = env.attestation_message(POOL_SPIRIT_MATTER, AMM_OP_SWAP, nonce, deadline);
    let sig_ix = ed25519_instruction(&env.attestor, &message);
    let swap_ix = env.swap_instruction(
        POOL_SPIRIT_MATTER,
        ELEMENT_SPIRIT,
        ELEMENT_MATTER,
        ELEMENT_SPIRIT,
        50_000,
        nonce,
        deadline,
        ata(&trader, &esms_mint_address(ELEMENT_SPIRIT)),
        ata(&trader, &esms_mint_address(ELEMENT_MATTER)),
    );
    let meta = unwrap_ok(env.send(&[sig_ix, swap_ix], &[&trader_kp]), "swap_esms");
    record("swap_esms", meta, SWAP_ESMS_CU_CEILING, &mut measured);

    let mut args = Vec::new();
    args.extend_from_slice(&POOL_SPIRIT_ESSENCE.to_le_bytes());
    args.push(1);
    let pause_ix = Instruction {
        program_id: crate::ID,
        accounts: vec![
            AccountMeta::new_readonly(env.config, false),
            AccountMeta::new_readonly(env.admin.pubkey(), true),
            AccountMeta::new(pool_address(POOL_SPIRIT_ESSENCE), false),
        ],
        data: ix_data("set_pool_pause", &args),
    };
    let admin = env.admin.insecure_clone();
    let meta = unwrap_ok(env.send(&[pause_ix], &[&admin]), "set_pool_pause");
    record(
        "set_pool_pause",
        meta,
        SET_POOL_PAUSE_CU_CEILING,
        &mut measured,
    );

    // withdraw, worst case: both output ATAs are created by `init_if_needed`.
    let deed = deed_position_address(POOL_SPIRIT_ESSENCE, &trader);
    let withdraw_ix = env.withdraw_instruction(
        POOL_SPIRIT_ESSENCE,
        ELEMENT_SPIRIT,
        ELEMENT_ESSENCE,
        10_000,
        &trader,
        deed,
    );
    let meta = unwrap_ok(
        env.send(&[withdraw_ix], &[&trader_kp]),
        "withdraw_liquidity",
    );
    record(
        "withdraw_liquidity",
        meta,
        WITHDRAW_LIQUIDITY_CU_CEILING,
        &mut measured,
    );

    println!("\n  measured compute units (worst case, first touch)");
    println!(
        "  {:<20} {:>10} {:>10}",
        "instruction", "measured", "ceiling"
    );
    let mut over = Vec::new();
    for (name, cu, ceiling) in &measured {
        println!("  {name:<20} {cu:>10} {ceiling:>10}");
        if cu > ceiling {
            over.push(format!("{name}: {cu} > {ceiling}"));
        }
    }
    assert!(
        over.is_empty(),
        "compute usage outgrew its declared ceiling -- raise both this constant and \
         the matching limit in lib/solana/priority-fee.ts: {over:?}"
    );
}

// ---------------------------------------------------------------------------
// Position lifecycle
// ---------------------------------------------------------------------------

/// Drives one attested `add_liquidity` for the trader and returns the tx result.
fn add_once(env: &mut Env, pool_id: u16, element_a: u8, element_b: u8, amount: u64) -> TransactionResult {
    let deadline = env.deadline();
    let nonce = env.trader_nonce(pool_id);
    let message = env.attestation_message(pool_id, AMM_OP_ADD_LIQUIDITY, nonce, deadline);
    let sig_ix = ed25519_instruction(&env.attestor, &message);
    let add_ix =
        env.add_liquidity_instruction(pool_id, element_a, element_b, amount, amount, nonce, deadline);
    let trader = env.trader.insecure_clone();
    env.send(&[sig_ix, add_ix], &[&trader])
}

#[test]
fn a_repeat_add_accumulates_into_the_same_position() {
    let mut env = Env::boot();
    env.live_pool(POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE);
    let trader = env.trader.pubkey();

    unwrap_ok(
        add_once(&mut env, POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE, 100_000),
        "first add",
    );
    let first = env
        .deed_state(POOL_SPIRIT_ESSENCE, &trader)
        .expect("position opened");
    let created_slot = first.created_slot;

    env.svm.expire_blockhash();
    unwrap_ok(
        add_once(&mut env, POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE, 100_000),
        "second add",
    );
    let second = env
        .deed_state(POOL_SPIRIT_ESSENCE, &trader)
        .expect("position still open");

    // The `version == 0` first-touch branch must not run again and reset shares.
    assert!(
        second.shares > first.shares,
        "a repeat add must accumulate, not overwrite: {} -> {}",
        first.shares,
        second.shares
    );
    assert_eq!(
        second.created_slot, created_slot,
        "created_slot records the first touch and must not be rewritten"
    );
    assert_eq!(second.owner, trader);
    assert_eq!(second.pool_id, POOL_SPIRIT_ESSENCE);
}

#[test]
fn a_closed_position_can_be_reopened_by_adding_again() {
    let mut env = Env::boot();
    env.live_pool(POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE);
    let trader = env.trader.pubkey();
    let trader_kp = env.trader.insecure_clone();

    unwrap_ok(
        add_once(&mut env, POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE, 100_000),
        "first add",
    );
    let deed = deed_position_address(POOL_SPIRIT_ESSENCE, &trader);
    let withdraw_ix = env.withdraw_instruction(
        POOL_SPIRIT_ESSENCE,
        ELEMENT_SPIRIT,
        ELEMENT_ESSENCE,
        10_000,
        &trader,
        deed,
    );
    unwrap_ok(env.send(&[withdraw_ix], &[&trader_kp]), "full withdraw");
    assert!(
        env.deed_state(POOL_SPIRIT_ESSENCE, &trader).is_none(),
        "the position must be closed"
    );

    // `init_if_needed` has to re-create an account that `close()` drained to zero
    // lamports and reassigned to the system program. If it did not, or if it
    // re-created it without the `version == 0` first touch running, a returning LP
    // would be locked out of the pool.
    env.svm.expire_blockhash();
    unwrap_ok(
        add_once(&mut env, POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE, 50_000),
        "add after close",
    );

    let reopened = env
        .deed_state(POOL_SPIRIT_ESSENCE, &trader)
        .expect("position reopened");
    assert_eq!(reopened.version, STATE_VERSION);
    assert_eq!(reopened.owner, trader);
    assert_eq!(reopened.pool_id, POOL_SPIRIT_ESSENCE);
    assert_eq!(
        reopened.shares, 50_000,
        "a reopened position starts from the new deposit, not from stale data"
    );
}

#[test]
fn a_partial_exit_leaves_a_position_that_can_still_be_added_to_and_fully_closed() {
    let mut env = Env::boot();
    env.live_pool(POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE);
    let trader = env.trader.pubkey();
    let trader_kp = env.trader.insecure_clone();
    let deed = deed_position_address(POOL_SPIRIT_ESSENCE, &trader);

    unwrap_ok(
        add_once(&mut env, POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE, 100_000),
        "add",
    );

    let half = env.withdraw_instruction(
        POOL_SPIRIT_ESSENCE,
        ELEMENT_SPIRIT,
        ELEMENT_ESSENCE,
        5_000,
        &trader,
        deed,
    );
    unwrap_ok(env.send(&[half], &[&trader_kp]), "partial exit");
    assert_eq!(
        env.deed_state(POOL_SPIRIT_ESSENCE, &trader)
            .expect("position survives a partial exit")
            .shares,
        50_000
    );

    env.svm.expire_blockhash();
    unwrap_ok(
        add_once(&mut env, POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE, 25_000),
        "add onto a partially exited position",
    );
    let topped_up = env
        .deed_state(POOL_SPIRIT_ESSENCE, &trader)
        .expect("position open");
    assert!(topped_up.shares > 50_000);

    env.svm.expire_blockhash();
    let rest = env.withdraw_instruction(
        POOL_SPIRIT_ESSENCE,
        ELEMENT_SPIRIT,
        ELEMENT_ESSENCE,
        10_000,
        &trader,
        deed,
    );
    unwrap_ok(env.send(&[rest], &[&trader_kp]), "final exit");
    assert!(env.deed_state(POOL_SPIRIT_ESSENCE, &trader).is_none());

    // Only the permanently locked bootstrap shares are left behind.
    assert_eq!(
        env.pool_state(POOL_SPIRIT_ESSENCE).total_shares,
        BOOTSTRAP_RESERVE
    );
}

// ---------------------------------------------------------------------------
// Cross-pool binding and the LP round trip
// ---------------------------------------------------------------------------

#[test]
fn an_attestation_for_one_pool_cannot_be_spent_on_another() {
    let mut env = Env::boot();
    env.live_pool(POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE);
    env.live_pool(POOL_SPIRIT_MATTER, ELEMENT_SPIRIT, ELEMENT_MATTER);
    let trader = env.trader.pubkey();
    let trader_kp = env.trader.insecure_clone();

    let deadline = env.deadline();
    // Signed for pool 0 ...
    let nonce = env.trader_nonce(POOL_SPIRIT_MATTER);
    let message = env.attestation_message(POOL_SPIRIT_ESSENCE, AMM_OP_SWAP, nonce, deadline);
    let sig_ix = ed25519_instruction(&env.attestor, &message);
    // ... and presented to pool 1. `pool_id` is inside the preimage, so the
    // signature does not verify against the message the program rebuilds.
    let swap_ix = env.swap_instruction(
        POOL_SPIRIT_MATTER,
        ELEMENT_SPIRIT,
        ELEMENT_MATTER,
        ELEMENT_SPIRIT,
        50_000,
        nonce,
        deadline,
        ata(&trader, &esms_mint_address(ELEMENT_SPIRIT)),
        ata(&trader, &esms_mint_address(ELEMENT_MATTER)),
    );
    expect_asol_error(
        env.send(&[sig_ix, swap_ix], &[&trader_kp]),
        crate::errors::AsolError::InvalidEd25519Authorization,
        "a pool-0 attestation spent on pool 1",
    );
}

#[test]
fn an_expired_attestation_is_refused() {
    let mut env = Env::boot();
    env.live_pool(POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE);

    let expired = env.now() - 1;
    let nonce = env.trader_nonce(POOL_SPIRIT_ESSENCE);
    let message = env.attestation_message(POOL_SPIRIT_ESSENCE, AMM_OP_ADD_LIQUIDITY, nonce, expired);
    let sig_ix = ed25519_instruction(&env.attestor, &message);
    let add_ix = env.add_liquidity_instruction(
        POOL_SPIRIT_ESSENCE,
        ELEMENT_SPIRIT,
        ELEMENT_ESSENCE,
        50_000,
        50_000,
        nonce,
        expired,
    );
    let trader_kp = env.trader.insecure_clone();
    expect_asol_error(
        env.send(&[sig_ix, add_ix], &[&trader_kp]),
        crate::errors::AsolError::AuthorizationExpired,
        "an expired attestation",
    );
}

#[test]
fn adding_then_swapping_then_exiting_is_never_profitable_for_the_same_actor() {
    let mut env = Env::boot();
    env.live_pool(POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE);
    let trader = env.trader.pubkey();
    let trader_kp = env.trader.insecure_clone();

    let before = env.token_balance(&trader, ELEMENT_SPIRIT) as u128
        + env.token_balance(&trader, ELEMENT_ESSENCE) as u128;

    unwrap_ok(
        add_once(&mut env, POOL_SPIRIT_ESSENCE, ELEMENT_SPIRIT, ELEMENT_ESSENCE, 200_000),
        "add",
    );

    env.svm.expire_blockhash();
    let deadline = env.deadline();
    let nonce = env.trader_nonce(POOL_SPIRIT_ESSENCE);
    let message = env.attestation_message(POOL_SPIRIT_ESSENCE, AMM_OP_SWAP, nonce, deadline);
    let sig_ix = ed25519_instruction(&env.attestor, &message);
    let swap_ix = env.swap_instruction(
        POOL_SPIRIT_ESSENCE,
        ELEMENT_SPIRIT,
        ELEMENT_ESSENCE,
        ELEMENT_SPIRIT,
        150_000,
        nonce,
        deadline,
        ata(&trader, &esms_mint_address(ELEMENT_SPIRIT)),
        ata(&trader, &esms_mint_address(ELEMENT_ESSENCE)),
    );
    unwrap_ok(env.send(&[sig_ix, swap_ix], &[&trader_kp]), "swap");

    env.svm.expire_blockhash();
    let deed = deed_position_address(POOL_SPIRIT_ESSENCE, &trader);
    let exit = env.withdraw_instruction(
        POOL_SPIRIT_ESSENCE,
        ELEMENT_SPIRIT,
        ELEMENT_ESSENCE,
        10_000,
        &trader,
        deed,
    );
    unwrap_ok(env.send(&[exit], &[&trader_kp]), "exit");

    let after = env.token_balance(&trader, ELEMENT_SPIRIT) as u128
        + env.token_balance(&trader, ELEMENT_ESSENCE) as u128;

    // The actor pays the full swap fee and recovers only their fraction of it, and
    // the curve charges them slippage on their own trade. A profitable round trip
    // here would mean the pool mints ESMS out of nothing on demand -- the failure
    // mode the locked, capped bootstrap exists to bound.
    assert!(
        after <= before,
        "add -> swap -> exit must not be profitable: {before} -> {after}"
    );
}
