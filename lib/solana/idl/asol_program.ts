/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/asol_program.json`.
 */
export type AsolProgram = {
  address: '5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD'
  metadata: {
    name: 'asolProgram'
    version: '0.1.0'
    spec: '0.1.0'
    description: 'AlchmAgentsSolana (ASOL) ESMS and persona core'
  }
  instructions: [
    {
      name: 'acceptAdmin'
      discriminator: [112, 42, 45, 90, 116, 181, 13, 170]
      accounts: [
        {
          name: 'programConfig'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ]
              },
            ]
          }
        },
        {
          name: 'pendingAdmin'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 101, 110, 100, 105, 110, 103, 95, 97, 100, 109, 105, 110]
              },
            ]
          }
        },
        {
          name: 'authority'
          writable: true
          signer: true
        },
      ]
      args: []
    },
    {
      name: 'activateStar'
      discriminator: [82, 216, 86, 203, 195, 1, 48, 98]
      accounts: [
        {
          name: 'starVaultState'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [115, 116, 97, 114, 45, 118, 97, 117, 108, 116]
              },
            ]
          }
        },
        {
          name: 'starPool'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [115, 116, 97, 114, 45, 112, 111, 111, 108]
              },
              {
                kind: 'arg'
                path: 'starId'
              },
            ]
          }
        },
        {
          name: 'payer'
          writable: true
          signer: true
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'starId'
          type: 'u32'
        },
        {
          name: 'proof'
          type: {
            vec: {
              array: ['u8', 32]
            }
          }
        },
      ]
    },
    {
      name: 'addLiquidity'
      discriminator: [181, 157, 89, 67, 143, 182, 52, 72]
      accounts: [
        {
          name: 'programConfig'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ]
              },
            ]
          }
        },
        {
          name: 'pool'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  99,
                  111,
                  110,
                  115,
                  116,
                  101,
                  108,
                  108,
                  97,
                  116,
                  105,
                  111,
                  110,
                  95,
                  112,
                  111,
                  111,
                  108,
                ]
              },
              {
                kind: 'arg'
                path: 'poolId'
              },
            ]
          }
        },
        {
          name: 'trader'
          writable: true
          signer: true
        },
        {
          name: 'nonceAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [97, 109, 109, 95, 110, 111, 110, 99, 101]
              },
              {
                kind: 'arg'
                path: 'poolId'
              },
              {
                kind: 'account'
                path: 'trader'
              },
            ]
          }
        },
        {
          name: 'mintA'
          writable: true
        },
        {
          name: 'mintB'
          writable: true
        },
        {
          name: 'traderMintAAta'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'trader'
              },
              {
                kind: 'account'
                path: 'token2022Program'
              },
              {
                kind: 'account'
                path: 'mintA'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'traderMintBAta'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'trader'
              },
              {
                kind: 'account'
                path: 'token2022Program'
              },
              {
                kind: 'account'
                path: 'mintB'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'deedPosition'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [100, 101, 101, 100]
              },
              {
                kind: 'arg'
                path: 'poolId'
              },
              {
                kind: 'account'
                path: 'trader'
              },
            ]
          }
        },
        {
          name: 'instructions'
        },
        {
          name: 'token2022Program'
          address: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'poolId'
          type: 'u16'
        },
        {
          name: 'amtA'
          type: 'u64'
        },
        {
          name: 'amtB'
          type: 'u64'
        },
        {
          name: 'minShares'
          type: 'u64'
        },
        {
          name: 'regionCommit'
          type: {
            array: ['u8', 32]
          }
        },
        {
          name: 'visibleStars'
          type: 'u8'
        },
        {
          name: 'nonce'
          type: 'u64'
        },
        {
          name: 'deadline'
          type: 'i64'
        },
      ]
    },
    {
      name: 'bootstrapPool'
      discriminator: [153, 42, 148, 41, 62, 60, 181, 171]
      accounts: [
        {
          name: 'programConfig'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ]
              },
            ]
          }
        },
        {
          name: 'admin'
          writable: true
          signer: true
        },
        {
          name: 'pool'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  99,
                  111,
                  110,
                  115,
                  116,
                  101,
                  108,
                  108,
                  97,
                  116,
                  105,
                  111,
                  110,
                  95,
                  112,
                  111,
                  111,
                  108,
                ]
              },
              {
                kind: 'arg'
                path: 'poolId'
              },
            ]
          }
        },
      ]
      args: [
        {
          name: 'poolId'
          type: 'u16'
        },
        {
          name: 'reserveA'
          type: 'u64'
        },
        {
          name: 'reserveB'
          type: 'u64'
        },
      ]
    },
    {
      name: 'claimMintEsms'
      discriminator: [194, 59, 120, 134, 151, 157, 193, 239]
      accounts: [
        {
          name: 'programConfig'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ]
              },
            ]
          }
        },
        {
          name: 'claimReceipt'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [99, 108, 97, 105, 109, 95, 114, 101, 99, 101, 105, 112, 116]
              },
              {
                kind: 'arg'
                path: 'claimId'
              },
            ]
          }
        },
        {
          name: 'authority'
          writable: true
          signer: true
        },
        {
          name: 'recipient'
        },
        {
          name: 'spiritMint'
          writable: true
        },
        {
          name: 'essenceMint'
          writable: true
        },
        {
          name: 'matterMint'
          writable: true
        },
        {
          name: 'substanceMint'
          writable: true
        },
        {
          name: 'spiritAccount'
          writable: true
        },
        {
          name: 'essenceAccount'
          writable: true
        },
        {
          name: 'matterAccount'
          writable: true
        },
        {
          name: 'substanceAccount'
          writable: true
        },
        {
          name: 'tokenProgram'
          address: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
        },
        {
          name: 'associatedTokenProgram'
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'claimId'
          type: {
            array: ['u8', 32]
          }
        },
        {
          name: 'ledgerReferenceHash'
          type: {
            array: ['u8', 32]
          }
        },
        {
          name: 'amounts'
          type: {
            array: ['u64', 4]
          }
        },
      ]
    },
    {
      name: 'claimStarYield'
      discriminator: [171, 89, 21, 11, 39, 79, 237, 123]
      accounts: [
        {
          name: 'programConfig'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ]
              },
            ]
          }
        },
        {
          name: 'starVaultState'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [115, 116, 97, 114, 45, 118, 97, 117, 108, 116]
              },
            ]
          }
        },
        {
          name: 'stakePosition'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [115, 116, 97, 107, 101]
              },
              {
                kind: 'arg'
                path: 'starId'
              },
              {
                kind: 'account'
                path: 'staker'
              },
            ]
          }
        },
        {
          name: 'staker'
          writable: true
          signer: true
        },
        {
          name: 'elementMint'
          writable: true
        },
        {
          name: 'stakerElementAta'
          writable: true
        },
        {
          name: 'instructions'
        },
        {
          name: 'token2022Program'
          address: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
        },
        {
          name: 'associatedTokenProgram'
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'starId'
          type: 'u32'
        },
        {
          name: 'elementId'
          type: 'u8'
        },
        {
          name: 'amount'
          type: 'u64'
        },
        {
          name: 'nonce'
          type: 'u64'
        },
        {
          name: 'deadline'
          type: 'i64'
        },
      ]
    },
    {
      name: 'initializeConfig'
      discriminator: [208, 127, 21, 1, 194, 190, 196, 70]
      accounts: [
        {
          name: 'programConfig'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ]
              },
            ]
          }
        },
        {
          name: 'admin'
          writable: true
          signer: true
        },
        {
          name: 'program'
          address: '5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD'
        },
        {
          name: 'programData'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'attestor'
          type: 'pubkey'
        },
        {
          name: 'pauser'
          type: 'pubkey'
        },
        {
          name: 'clusterDomain'
          type: {
            array: ['u8', 32]
          }
        },
      ]
    },
    {
      name: 'initializeEsmsMints'
      discriminator: [195, 95, 238, 168, 120, 136, 203, 4]
      accounts: [
        {
          name: 'programConfig'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ]
              },
            ]
          }
        },
        {
          name: 'admin'
          writable: true
          signer: true
        },
        {
          name: 'spiritMint'
          writable: true
        },
        {
          name: 'essenceMint'
          writable: true
        },
        {
          name: 'matterMint'
          writable: true
        },
        {
          name: 'substanceMint'
          writable: true
        },
        {
          name: 'tokenProgram'
          address: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: []
    },
    {
      name: 'initializeStarVault'
      discriminator: [85, 142, 78, 248, 62, 207, 165, 176]
      accounts: [
        {
          name: 'starVaultState'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [115, 116, 97, 114, 45, 118, 97, 117, 108, 116]
              },
            ]
          }
        },
        {
          name: 'admin'
          writable: true
          signer: true
        },
        {
          name: 'programConfig'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ]
              },
            ]
          }
        },
        {
          name: 'usdcMint'
        },
        {
          name: 'vaultUsdcAta'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'starRoot'
          type: {
            array: ['u8', 32]
          }
        },
        {
          name: 'maxYieldRatePerUsdcDay'
          type: 'u64'
        },
      ]
    },
    {
      name: 'proposeAdmin'
      discriminator: [121, 214, 199, 212, 87, 39, 117, 234]
      accounts: [
        {
          name: 'programConfig'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ]
              },
            ]
          }
        },
        {
          name: 'pendingAdmin'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 101, 110, 100, 105, 110, 103, 95, 97, 100, 109, 105, 110]
              },
            ]
          }
        },
        {
          name: 'authority'
          writable: true
          signer: true
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'newAdmin'
          type: 'pubkey'
        },
      ]
    },
    {
      name: 'recordPersonaCommitment'
      discriminator: [228, 40, 100, 106, 125, 164, 118, 37]
      accounts: [
        {
          name: 'programConfig'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ]
              },
            ]
          }
        },
        {
          name: 'personaCommitment'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  112,
                  101,
                  114,
                  115,
                  111,
                  110,
                  97,
                  95,
                  99,
                  111,
                  109,
                  109,
                  105,
                  116,
                  109,
                  101,
                  110,
                  116,
                ]
              },
              {
                kind: 'arg'
                path: 'agentId'
              },
            ]
          }
        },
        {
          name: 'writer'
          writable: true
          signer: true
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'agentId'
          type: {
            array: ['u8', 32]
          }
        },
        {
          name: 'targetPersonaHash'
          type: {
            array: ['u8', 32]
          }
        },
        {
          name: 'epochHash'
          type: {
            array: ['u8', 32]
          }
        },
        {
          name: 'sequence'
          type: 'u64'
        },
      ]
    },
    {
      name: 'redeemEsms'
      discriminator: [182, 20, 159, 192, 104, 83, 177, 113]
      accounts: [
        {
          name: 'programConfig'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ]
              },
            ]
          }
        },
        {
          name: 'orderReceipt'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [111, 114, 100, 101, 114, 95, 114, 101, 99, 101, 105, 112, 116]
              },
              {
                kind: 'arg'
                path: 'orderId'
              },
            ]
          }
        },
        {
          name: 'holder'
          writable: true
          signer: true
        },
        {
          name: 'spiritMint'
          writable: true
        },
        {
          name: 'essenceMint'
          writable: true
        },
        {
          name: 'matterMint'
          writable: true
        },
        {
          name: 'substanceMint'
          writable: true
        },
        {
          name: 'spiritAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'holder'
              },
              {
                kind: 'account'
                path: 'tokenProgram'
              },
              {
                kind: 'account'
                path: 'spiritMint'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'essenceAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'holder'
              },
              {
                kind: 'account'
                path: 'tokenProgram'
              },
              {
                kind: 'account'
                path: 'essenceMint'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'matterAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'holder'
              },
              {
                kind: 'account'
                path: 'tokenProgram'
              },
              {
                kind: 'account'
                path: 'matterMint'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'substanceAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'holder'
              },
              {
                kind: 'account'
                path: 'tokenProgram'
              },
              {
                kind: 'account'
                path: 'substanceMint'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'tokenProgram'
          address: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'orderId'
          type: {
            array: ['u8', 32]
          }
        },
        {
          name: 'amounts'
          type: {
            array: ['u64', 4]
          }
        },
      ]
    },
    {
      name: 'redeemForEsms'
      discriminator: [86, 175, 194, 240, 164, 243, 199, 163]
      accounts: [
        {
          name: 'programConfig'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ]
              },
            ]
          }
        },
        {
          name: 'orderReceipt'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [111, 114, 100, 101, 114, 95, 114, 101, 99, 101, 105, 112, 116]
              },
              {
                kind: 'arg'
                path: 'orderId'
              },
            ]
          }
        },
        {
          name: 'sponsor'
          writable: true
          signer: true
        },
        {
          name: 'holder'
        },
        {
          name: 'spiritMint'
          writable: true
        },
        {
          name: 'essenceMint'
          writable: true
        },
        {
          name: 'matterMint'
          writable: true
        },
        {
          name: 'substanceMint'
          writable: true
        },
        {
          name: 'spiritAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'holder'
              },
              {
                kind: 'account'
                path: 'tokenProgram'
              },
              {
                kind: 'account'
                path: 'spiritMint'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'essenceAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'holder'
              },
              {
                kind: 'account'
                path: 'tokenProgram'
              },
              {
                kind: 'account'
                path: 'essenceMint'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'matterAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'holder'
              },
              {
                kind: 'account'
                path: 'tokenProgram'
              },
              {
                kind: 'account'
                path: 'matterMint'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'substanceAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'holder'
              },
              {
                kind: 'account'
                path: 'tokenProgram'
              },
              {
                kind: 'account'
                path: 'substanceMint'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'instructions'
        },
        {
          name: 'tokenProgram'
          address: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'orderId'
          type: {
            array: ['u8', 32]
          }
        },
        {
          name: 'amounts'
          type: {
            array: ['u64', 4]
          }
        },
        {
          name: 'deadline'
          type: 'i64'
        },
      ]
    },
    {
      name: 'registerPool'
      discriminator: [85, 229, 114, 47, 75, 145, 166, 100]
      accounts: [
        {
          name: 'programConfig'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ]
              },
            ]
          }
        },
        {
          name: 'admin'
          writable: true
          signer: true
        },
        {
          name: 'pool'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  99,
                  111,
                  110,
                  115,
                  116,
                  101,
                  108,
                  108,
                  97,
                  116,
                  105,
                  111,
                  110,
                  95,
                  112,
                  111,
                  111,
                  108,
                ]
              },
              {
                kind: 'arg'
                path: 'poolId'
              },
            ]
          }
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'poolId'
          type: 'u16'
        },
        {
          name: 'elementA'
          type: 'u8'
        },
        {
          name: 'elementB'
          type: 'u8'
        },
        {
          name: 'feeBps'
          type: 'u16'
        },
      ]
    },
    {
      name: 'setPauseState'
      discriminator: [130, 225, 63, 203, 229, 214, 138, 17]
      accounts: [
        {
          name: 'programConfig'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ]
              },
            ]
          }
        },
        {
          name: 'authority'
          signer: true
        },
      ]
      args: [
        {
          name: 'pauseClaims'
          type: 'bool'
        },
        {
          name: 'pauseRedemptions'
          type: 'bool'
        },
      ]
    },
    {
      name: 'setPoolPause'
      discriminator: [52, 171, 212, 208, 28, 209, 90, 15]
      accounts: [
        {
          name: 'programConfig'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ]
              },
            ]
          }
        },
        {
          name: 'authority'
          signer: true
        },
        {
          name: 'pool'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  99,
                  111,
                  110,
                  115,
                  116,
                  101,
                  108,
                  108,
                  97,
                  116,
                  105,
                  111,
                  110,
                  95,
                  112,
                  111,
                  111,
                  108,
                ]
              },
              {
                kind: 'arg'
                path: 'poolId'
              },
            ]
          }
        },
      ]
      args: [
        {
          name: 'poolId'
          type: 'u16'
        },
        {
          name: 'paused'
          type: 'bool'
        },
      ]
    },
    {
      name: 'setServiceAuthorities'
      discriminator: [42, 156, 68, 130, 225, 158, 43, 33]
      accounts: [
        {
          name: 'programConfig'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ]
              },
            ]
          }
        },
        {
          name: 'authority'
          signer: true
        },
      ]
      args: [
        {
          name: 'attestor'
          type: 'pubkey'
        },
        {
          name: 'pauser'
          type: 'pubkey'
        },
      ]
    },
    {
      name: 'setStarVaultConfig'
      discriminator: [108, 117, 69, 191, 228, 187, 95, 162]
      accounts: [
        {
          name: 'starVaultState'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [115, 116, 97, 114, 45, 118, 97, 117, 108, 116]
              },
            ]
          }
        },
        {
          name: 'admin'
          signer: true
        },
      ]
      args: [
        {
          name: 'starRoot'
          type: {
            option: {
              array: ['u8', 32]
            }
          }
        },
        {
          name: 'maxYieldRatePerUsdcDay'
          type: {
            option: 'u64'
          }
        },
      ]
    },
    {
      name: 'stakeStar'
      discriminator: [83, 165, 210, 69, 187, 164, 59, 108]
      accounts: [
        {
          name: 'starVaultState'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [115, 116, 97, 114, 45, 118, 97, 117, 108, 116]
              },
            ]
          }
        },
        {
          name: 'starPool'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [115, 116, 97, 114, 45, 112, 111, 111, 108]
              },
              {
                kind: 'arg'
                path: 'starId'
              },
            ]
          }
        },
        {
          name: 'stakePosition'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [115, 116, 97, 107, 101]
              },
              {
                kind: 'arg'
                path: 'starId'
              },
              {
                kind: 'account'
                path: 'staker'
              },
            ]
          }
        },
        {
          name: 'staker'
          writable: true
          signer: true
        },
        {
          name: 'usdcMint'
        },
        {
          name: 'stakerUsdcAta'
          writable: true
        },
        {
          name: 'vaultUsdcAta'
          writable: true
        },
        {
          name: 'tokenProgram'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'starId'
          type: 'u32'
        },
        {
          name: 'usdcAmount'
          type: 'u64'
        },
      ]
    },
    {
      name: 'swapEsms'
      discriminator: [37, 89, 15, 59, 6, 210, 183, 6]
      accounts: [
        {
          name: 'programConfig'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ]
              },
            ]
          }
        },
        {
          name: 'pool'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  99,
                  111,
                  110,
                  115,
                  116,
                  101,
                  108,
                  108,
                  97,
                  116,
                  105,
                  111,
                  110,
                  95,
                  112,
                  111,
                  111,
                  108,
                ]
              },
              {
                kind: 'arg'
                path: 'poolId'
              },
            ]
          }
        },
        {
          name: 'trader'
          writable: true
          signer: true
        },
        {
          name: 'nonceAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [97, 109, 109, 95, 110, 111, 110, 99, 101]
              },
              {
                kind: 'arg'
                path: 'poolId'
              },
              {
                kind: 'account'
                path: 'trader'
              },
            ]
          }
        },
        {
          name: 'mintA'
          writable: true
        },
        {
          name: 'mintB'
          writable: true
        },
        {
          name: 'traderInAta'
          writable: true
        },
        {
          name: 'traderOutAta'
          writable: true
        },
        {
          name: 'instructions'
        },
        {
          name: 'token2022Program'
          address: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
        },
        {
          name: 'associatedTokenProgram'
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'poolId'
          type: 'u16'
        },
        {
          name: 'inElement'
          type: 'u8'
        },
        {
          name: 'inAmount'
          type: 'u64'
        },
        {
          name: 'minOut'
          type: 'u64'
        },
        {
          name: 'regionCommit'
          type: {
            array: ['u8', 32]
          }
        },
        {
          name: 'visibleStars'
          type: 'u8'
        },
        {
          name: 'nonce'
          type: 'u64'
        },
        {
          name: 'deadline'
          type: 'i64'
        },
      ]
    },
    {
      name: 'unstakeStar'
      discriminator: [107, 218, 69, 159, 117, 224, 202, 47]
      accounts: [
        {
          name: 'starVaultState'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [115, 116, 97, 114, 45, 118, 97, 117, 108, 116]
              },
            ]
          }
        },
        {
          name: 'starPool'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [115, 116, 97, 114, 45, 112, 111, 111, 108]
              },
              {
                kind: 'arg'
                path: 'starId'
              },
            ]
          }
        },
        {
          name: 'stakePosition'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [115, 116, 97, 107, 101]
              },
              {
                kind: 'arg'
                path: 'starId'
              },
              {
                kind: 'account'
                path: 'staker'
              },
            ]
          }
        },
        {
          name: 'staker'
          writable: true
          signer: true
        },
        {
          name: 'usdcMint'
        },
        {
          name: 'stakerUsdcAta'
          writable: true
        },
        {
          name: 'vaultUsdcAta'
          writable: true
        },
        {
          name: 'tokenProgram'
        },
      ]
      args: [
        {
          name: 'starId'
          type: 'u32'
        },
        {
          name: 'shares'
          type: 'u64'
        },
      ]
    },
    {
      name: 'withdrawLiquidity'
      discriminator: [149, 158, 33, 185, 47, 243, 253, 31]
      accounts: [
        {
          name: 'programConfig'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ]
              },
            ]
          }
        },
        {
          name: 'pool'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  99,
                  111,
                  110,
                  115,
                  116,
                  101,
                  108,
                  108,
                  97,
                  116,
                  105,
                  111,
                  110,
                  95,
                  112,
                  111,
                  111,
                  108,
                ]
              },
              {
                kind: 'arg'
                path: 'poolId'
              },
            ]
          }
        },
        {
          name: 'owner'
          writable: true
          signer: true
        },
        {
          name: 'mintA'
          writable: true
        },
        {
          name: 'mintB'
          writable: true
        },
        {
          name: 'ownerMintAAta'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'owner'
              },
              {
                kind: 'account'
                path: 'token2022Program'
              },
              {
                kind: 'account'
                path: 'mintA'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'ownerMintBAta'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'owner'
              },
              {
                kind: 'account'
                path: 'token2022Program'
              },
              {
                kind: 'account'
                path: 'mintB'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'deedPosition'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [100, 101, 101, 100]
              },
              {
                kind: 'arg'
                path: 'poolId'
              },
              {
                kind: 'account'
                path: 'owner'
              },
            ]
          }
        },
        {
          name: 'token2022Program'
          address: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
        },
        {
          name: 'associatedTokenProgram'
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'poolId'
          type: 'u16'
        },
        {
          name: 'shareBps'
          type: 'u16'
        },
      ]
    },
  ]
  accounts: [
    {
      name: 'claimReceipt'
      discriminator: [223, 233, 11, 229, 124, 165, 207, 28]
    },
    {
      name: 'constellationPool'
      discriminator: [122, 48, 35, 1, 227, 241, 119, 151]
    },
    {
      name: 'deedPosition'
      discriminator: [74, 188, 63, 180, 9, 159, 41, 189]
    },
    {
      name: 'orderReceipt'
      discriminator: [133, 4, 37, 85, 200, 201, 93, 70]
    },
    {
      name: 'pendingAdmin'
      discriminator: [220, 45, 135, 16, 196, 153, 181, 56]
    },
    {
      name: 'personaCommitment'
      discriminator: [230, 97, 191, 242, 27, 177, 16, 63]
    },
    {
      name: 'poolTraderNonce'
      discriminator: [4, 172, 248, 254, 19, 128, 105, 220]
    },
    {
      name: 'programConfig'
      discriminator: [196, 210, 90, 231, 144, 149, 140, 63]
    },
    {
      name: 'stakePosition'
      discriminator: [78, 165, 30, 111, 171, 125, 11, 220]
    },
    {
      name: 'starPool'
      discriminator: [122, 218, 123, 125, 85, 222, 31, 75]
    },
    {
      name: 'starVaultState'
      discriminator: [36, 175, 17, 171, 219, 19, 110, 49]
    },
  ]
  events: [
    {
      name: 'liquidityAdded'
      discriminator: [154, 26, 221, 108, 238, 64, 217, 161]
    },
    {
      name: 'liquidityWithdrawn'
      discriminator: [240, 120, 73, 139, 154, 31, 218, 68]
    },
    {
      name: 'poolBootstrapped'
      discriminator: [148, 153, 73, 251, 8, 175, 101, 109]
    },
    {
      name: 'poolPauseToggled'
      discriminator: [190, 233, 13, 162, 239, 176, 159, 109]
    },
    {
      name: 'poolRegistered'
      discriminator: [77, 114, 165, 230, 33, 230, 135, 215]
    },
    {
      name: 'swapped'
      discriminator: [217, 52, 52, 83, 147, 135, 96, 109]
    },
  ]
  errors: [
    {
      code: 6000
      name: 'unauthorized'
      msg: 'Unauthorized authority'
    },
    {
      code: 6001
      name: 'claimsPaused'
      msg: 'Claims are paused'
    },
    {
      code: 6002
      name: 'redemptionsPaused'
      msg: 'Redemptions are paused'
    },
    {
      code: 6003
      name: 'defaultAuthority'
      msg: 'A required public key cannot be the default key'
    },
    {
      code: 6004
      name: 'invalidClusterDomain'
      msg: 'The cluster domain must be non-zero'
    },
    {
      code: 6005
      name: 'zeroCommitment'
      msg: 'Persona commitments and agent IDs must be non-zero'
    },
    {
      code: 6006
      name: 'invalidSequence'
      msg: 'Persona sequence must begin at one and increment exactly once'
    },
    {
      code: 6007
      name: 'arithmeticOverflow'
      msg: 'Arithmetic overflow'
    },
    {
      code: 6008
      name: 'emptyAmounts'
      msg: 'At least one ESMS amount must be non-zero'
    },
    {
      code: 6009
      name: 'amountOutOfRange'
      msg: 'An ESMS amount exceeds the Decimal(12,4) ledger domain'
    },
    {
      code: 6010
      name: 'invalidTokenProgram'
      msg: 'The Token-2022 program is invalid'
    },
    {
      code: 6011
      name: 'invalidMint'
      msg: 'The ESMS mint account is invalid'
    },
    {
      code: 6012
      name: 'invalidMintExtensions'
      msg: 'The ESMS mint extensions or authorities do not match protocol configuration'
    },
    {
      code: 6013
      name: 'authorizationExpired'
      msg: 'The holder authorization has expired'
    },
    {
      code: 6014
      name: 'invalidEd25519Authorization'
      msg: 'The Ed25519 holder authorization is missing or invalid'
    },
    {
      code: 6015
      name: 'zeroReceiptIdentifier'
      msg: 'The receipt identifier or ledger reference must be non-zero'
    },
    {
      code: 6016
      name: 'invalidTokenAccount'
      msg: 'The source token account does not belong to the expected holder and mint'
    },
    {
      code: 6017
      name: 'invalidInstructionsSysvar'
      msg: 'The instruction sysvar account is invalid'
    },
    {
      code: 6018
      name: 'starNotActivated'
      msg: 'Star has not been activated'
    },
    {
      code: 6019
      name: 'invalidStarProof'
      msg: 'Invalid Merkle proof for star activation'
    },
    {
      code: 6020
      name: 'insufficientShares'
      msg: 'Insufficient pool shares for unstaking'
    },
    {
      code: 6021
      name: 'yieldExceedsCap'
      msg: 'Requested yield exceeds dynamic accrued yield cap'
    },
    {
      code: 6022
      name: 'invalidElement'
      msg: 'Invalid element identifier (must be 0..3)'
    },
    {
      code: 6023
      name: 'invalidYieldNonce'
      msg: 'Invalid yield claim nonce'
    },
    {
      code: 6024
      name: 'zeroAmount'
      msg: 'Amount must be greater than zero'
    },
    {
      code: 6025
      name: 'invalidVault'
      msg: 'The vault or star pool state is invalid'
    },
    {
      code: 6026
      name: 'rateExceedsCeiling'
      msg: 'Yield rate exceeds the protocol safety ceiling'
    },
    {
      code: 6027
      name: 'starRootUnset'
      msg: 'Star registry Merkle root has not been initialized'
    },
    {
      code: 6028
      name: 'proofTooDeep'
      msg: 'Merkle proof exceeds maximum depth of 32 nodes'
    },
    {
      code: 6029
      name: 'invalidVaultMintExtensions'
      msg: 'Vault USDC mint carries unsupported extensions'
    },
    {
      code: 6030
      name: 'poolAlreadyBootstrapped'
      msg: 'Pool has already been bootstrapped'
    },
    {
      code: 6031
      name: 'poolNotBootstrapped'
      msg: 'Pool has not been bootstrapped'
    },
    {
      code: 6032
      name: 'poolPaused'
      msg: 'Pool is currently paused'
    },
    {
      code: 6033
      name: 'invalidPoolElements'
      msg: 'Pool element pair contains invalid or identical elements, or pool_id is out of range'
    },
    {
      code: 6034
      name: 'feeExceedsMaximum'
      msg: 'Pool fee exceeds maximum allowable fee basis points (1000)'
    },
    {
      code: 6035
      name: 'invalidElementForPool'
      msg: 'Invalid element for the specified pool'
    },
    {
      code: 6036
      name: 'offRatioDeposit'
      msg: 'Liquidity deposit is off-ratio by more than 1% tolerance'
    },
    {
      code: 6037
      name: 'slippageExceeded'
      msg: 'Slippage limit exceeded'
    },
    {
      code: 6038
      name: 'insufficientOutput'
      msg: 'Calculated output amount is insufficient'
    },
    {
      code: 6039
      name: 'insufficientLiquidity'
      msg: 'Insufficient liquidity in pool'
    },
    {
      code: 6040
      name: 'invalidDeedOwner'
      msg: 'Caller is not the valid owner of the Deed position or position belongs to another pool'
    },
    {
      code: 6041
      name: 'invalidPoolNonce'
      msg: 'Invalid pool trader nonce'
    },
    {
      code: 6042
      name: 'invalidShareBps'
      msg: 'Share basis points must be between 1 and 10000'
    },
    {
      code: 6043
      name: 'reserveCeilingExceeded'
      msg: 'Virtual reserve ceiling exceeded'
    },
  ]
  types: [
    {
      name: 'claimReceipt'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'version'
            type: 'u8'
          },
          {
            name: 'claimId'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'ledgerReferenceHash'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'recipient'
            type: 'pubkey'
          },
          {
            name: 'amounts'
            type: {
              array: ['u64', 4]
            }
          },
          {
            name: 'authority'
            type: 'pubkey'
          },
          {
            name: 'settledSlot'
            type: 'u64'
          },
          {
            name: 'bump'
            type: 'u8'
          },
        ]
      }
    },
    {
      name: 'constellationPool'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'version'
            type: 'u8'
          },
          {
            name: 'poolId'
            type: 'u16'
          },
          {
            name: 'elementA'
            type: 'u8'
          },
          {
            name: 'elementB'
            type: 'u8'
          },
          {
            name: 'feeBps'
            type: 'u16'
          },
          {
            name: 'reserveA'
            type: 'u64'
          },
          {
            name: 'reserveB'
            type: 'u64'
          },
          {
            name: 'totalShares'
            type: 'u64'
          },
          {
            name: 'bootstrapped'
            type: 'bool'
          },
          {
            name: 'paused'
            type: 'bool'
          },
          {
            name: 'bump'
            type: 'u8'
          },
        ]
      }
    },
    {
      name: 'deedPosition'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'version'
            type: 'u8'
          },
          {
            name: 'poolId'
            type: 'u16'
          },
          {
            name: 'owner'
            type: 'pubkey'
          },
          {
            name: 'shares'
            type: 'u64'
          },
          {
            name: 'createdSlot'
            type: 'u64'
          },
          {
            name: 'bump'
            type: 'u8'
          },
        ]
      }
    },
    {
      name: 'liquidityAdded'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'poolId'
            type: 'u16'
          },
          {
            name: 'trader'
            type: 'pubkey'
          },
          {
            name: 'amtA'
            type: 'u64'
          },
          {
            name: 'amtB'
            type: 'u64'
          },
          {
            name: 'shares'
            type: 'u64'
          },
          {
            name: 'deedPosition'
            type: 'pubkey'
          },
          {
            name: 'regionCommit'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'visibleStars'
            type: 'u8'
          },
        ]
      }
    },
    {
      name: 'liquidityWithdrawn'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'poolId'
            type: 'u16'
          },
          {
            name: 'trader'
            type: 'pubkey'
          },
          {
            name: 'deedPosition'
            type: 'pubkey'
          },
          {
            name: 'pullShares'
            type: 'u64'
          },
          {
            name: 'remainingShares'
            type: 'u64'
          },
          {
            name: 'amtA'
            type: 'u64'
          },
          {
            name: 'amtB'
            type: 'u64'
          },
          {
            name: 'reserveA'
            type: 'u64'
          },
          {
            name: 'reserveB'
            type: 'u64'
          },
        ]
      }
    },
    {
      name: 'orderReceipt'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'version'
            type: 'u8'
          },
          {
            name: 'orderId'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'holder'
            type: 'pubkey'
          },
          {
            name: 'amounts'
            type: {
              array: ['u64', 4]
            }
          },
          {
            name: 'submitter'
            type: 'pubkey'
          },
          {
            name: 'mode'
            type: 'u8'
          },
          {
            name: 'settledSlot'
            type: 'u64'
          },
          {
            name: 'bump'
            type: 'u8'
          },
        ]
      }
    },
    {
      name: 'pendingAdmin'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'pendingAdmin'
            type: 'pubkey'
          },
          {
            name: 'bump'
            type: 'u8'
          },
        ]
      }
    },
    {
      name: 'personaCommitment'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'version'
            type: 'u8'
          },
          {
            name: 'agentId'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'targetPersonaHash'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'epochHash'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'sequence'
            type: 'u64'
          },
          {
            name: 'writer'
            type: 'pubkey'
          },
          {
            name: 'updatedSlot'
            type: 'u64'
          },
          {
            name: 'bump'
            type: 'u8'
          },
        ]
      }
    },
    {
      name: 'poolBootstrapped'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'poolId'
            type: 'u16'
          },
          {
            name: 'reserveA'
            type: 'u64'
          },
          {
            name: 'reserveB'
            type: 'u64'
          },
          {
            name: 'totalShares'
            type: 'u64'
          },
        ]
      }
    },
    {
      name: 'poolPauseToggled'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'poolId'
            type: 'u16'
          },
          {
            name: 'paused'
            type: 'bool'
          },
        ]
      }
    },
    {
      name: 'poolRegistered'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'poolId'
            type: 'u16'
          },
          {
            name: 'elementA'
            type: 'u8'
          },
          {
            name: 'elementB'
            type: 'u8'
          },
          {
            name: 'feeBps'
            type: 'u16'
          },
        ]
      }
    },
    {
      name: 'poolTraderNonce'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'version'
            type: 'u8'
          },
          {
            name: 'poolId'
            type: 'u16'
          },
          {
            name: 'trader'
            type: 'pubkey'
          },
          {
            name: 'nonce'
            type: 'u64'
          },
          {
            name: 'bump'
            type: 'u8'
          },
        ]
      }
    },
    {
      name: 'programConfig'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'version'
            type: 'u8'
          },
          {
            name: 'admin'
            type: 'pubkey'
          },
          {
            name: 'attestor'
            type: 'pubkey'
          },
          {
            name: 'pauser'
            type: 'pubkey'
          },
          {
            name: 'clusterDomain'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'pauseClaims'
            type: 'bool'
          },
          {
            name: 'pauseRedemptions'
            type: 'bool'
          },
          {
            name: 'bump'
            type: 'u8'
          },
        ]
      }
    },
    {
      name: 'stakePosition'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'version'
            type: 'u8'
          },
          {
            name: 'staker'
            type: 'pubkey'
          },
          {
            name: 'starId'
            type: 'u32'
          },
          {
            name: 'shares'
            type: 'u64'
          },
          {
            name: 'principal'
            type: 'u64'
          },
          {
            name: 'accruedCap'
            type: 'u64'
          },
          {
            name: 'lastCheckpoint'
            type: 'i64'
          },
          {
            name: 'claimNonce'
            type: 'u64'
          },
          {
            name: 'bump'
            type: 'u8'
          },
        ]
      }
    },
    {
      name: 'starPool'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'version'
            type: 'u8'
          },
          {
            name: 'starId'
            type: 'u32'
          },
          {
            name: 'activated'
            type: 'bool'
          },
          {
            name: 'totalPrincipal'
            type: 'u64'
          },
          {
            name: 'totalShares'
            type: 'u64'
          },
          {
            name: 'bump'
            type: 'u8'
          },
        ]
      }
    },
    {
      name: 'starVaultState'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'version'
            type: 'u8'
          },
          {
            name: 'admin'
            type: 'pubkey'
          },
          {
            name: 'usdcMint'
            type: 'pubkey'
          },
          {
            name: 'vaultUsdcAta'
            type: 'pubkey'
          },
          {
            name: 'totalPrincipal'
            type: 'u64'
          },
          {
            name: 'starRoot'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'maxYieldRatePerUsdcDay'
            type: 'u64'
          },
          {
            name: 'bump'
            type: 'u8'
          },
        ]
      }
    },
    {
      name: 'swapped'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'poolId'
            type: 'u16'
          },
          {
            name: 'trader'
            type: 'pubkey'
          },
          {
            name: 'inElement'
            type: 'u8'
          },
          {
            name: 'inAmount'
            type: 'u64'
          },
          {
            name: 'outElement'
            type: 'u8'
          },
          {
            name: 'outAmount'
            type: 'u64'
          },
          {
            name: 'reserveA'
            type: 'u64'
          },
          {
            name: 'reserveB'
            type: 'u64'
          },
          {
            name: 'regionCommit'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'visibleStars'
            type: 'u8'
          },
        ]
      }
    },
  ]
}

export type AaeSolana = AsolProgram
