// src/app/core/constants/app.constants.ts
import { ECDSA } from 'xrpl';
import * as xrpl from 'xrpl';

export const AppConstants = {
     // XRPL Network Settings
     NETWORKS: {
          MAINNET: {
               NAME: 'mainnet',
               URL: 'wss://s1.ripple.com',
          },
          TESTNET: {
               NAME: 'testnet',
               URL: 'wss://s.altnet.rippletest.net:51233',
          },
          DEVNET: {
               NAME: 'devnet',
               URL: 'wss://s.devnet.rippletest.net:51233',
               // URL: 'ws://192.168.1.226:6007/',
          },
     },

     XRPL_WIN_URL: {
          MAINNET: 'https://xrplwin.com/tx/',
          TESTNET: 'https://testnet.xrplwin.com/tx/',
          DEVNET: 'https://devnet.xrplwin.com/tx/',
     },

     CREDENTIAL_REGEX: /^[0-9A-F]{2,128}$/,
     LSF_ACCEPTED: 0x00010000,

     // Encryption Algorithms
     ENCRYPTION: {
          ED25519: 'ed25519' as ECDSA,
          SECP256K1: 'secp256k1' as ECDSA,
     },

     // Transaction Results
     TRANSACTION: {
          TES_SUCCESS: 'tesSUCCESS',
     },

     ACCOUNT_SET_FLAGS: {
          1: 'asfRequireDest',
          2: 'asfRequireAuth',
          3: 'asfDisallowXRP',
          4: 'asfDisableMaster',
          5: 'asfAccountTxnID',
          6: 'asfNoFreeze',
          7: 'asfGlobalFreeze',
          8: 'asfDefaultRipple',
          9: 'asfDepositAuth',
          10: 'asfAuthorizedNFTokenMinter',
          12: 'asfDisallowIncomingNFTokenOffer',
          13: 'asfDisallowIncomingCheck',
          14: 'asfDisallowIncomingPayChan',
          15: 'asfDisallowIncomingTrustline',
          16: 'asfAllowTrustLineClawback',
     },

     ACCOUNT_ROOT_FLAGS: {
          0x00010000: 'Regular Key Set',
          0x00020000: 'Require Destination Tag',
          0x00040000: 'Require Authorization',
          0x00080000: 'Disallow Incoming XRP',
          0x00100000: 'DisableMaster Key',
          0x00200000: 'No Freeze',
          0x00400000: 'Global Freeze',
          0x00800000: 'Default Ripple',
          0x01000000: 'Deposit Auth',
          // If new flags are added later, just extend this map
     },

     // Payment tx flags
     PAYMENT_FLAGS: {
          0x00010000: 'tfNoDirectRipple',
          0x00020000: 'tfPartialPayment',
          0x00040000: 'tfLimitQuality',
     },

     OFFER_CREATE_FLAGS: {
          0x00010000: 'tfPassive',
          0x00020000: 'tfImmediateOrCancel',
          0x00040000: 'tfFillOrKill',
          0x00080000: 'tfSell',
     },

     // OfferCancel has no flags (just included for structure)

     // TrustSet tx flags
     TRUST_SET_FLAGS: {
          0x00010000: 'tfSetAuth',
          0x00020000: 'tfSetNoRipple',
          0x00040000: 'tfClearNoRipple',
          0x00080000: 'tfSetFreeze',
          0x00100000: 'tfClearFreeze',
     },

     RIPPLE_STATE_FLAGS: {
          0x00010000: 'lsfLowReserve',
          0x00020000: 'lsfHighReserve',
          0x00040000: 'lsfLowNoRipple',
          0x00080000: 'lsfHighNoRipple',
          0x00100000: 'lsfLowFreeze',
          0x00200000: 'lsfHighFreeze',
     },

     // EscrowCreate tx flags
     ESCROW_CREATE_FLAGS: {
          0x00020000: 'tfFinishAfter',
          0x00040000: 'tfCancelAfter',
     },

     NFT_FLAGS: {
          tfBurnable: 1,
          tfOnlyXRP: 2,
          tfTrustLine: 4,
          tfTransferable: 8,
          tfMutable: 16,
     },

     // You can extend with CheckCash, AMM, etc.

     // Account Flags (from your flagList in AccountComponent)
     FLAGS: [
          { name: 'asfRequireDest', label: 'Require Destination Tag', value: 1, xrplName: 'requireDestinationTag', xrplEnum: xrpl.AccountSetAsfFlags.asfRequireDest },
          { name: 'asfRequireAuth', label: 'Require Trust Line Auth', value: 2, xrplName: 'requireAuthorization', xrplEnum: xrpl.AccountSetAsfFlags.asfRequireAuth },
          { name: 'asfDisallowXRP', label: 'Disallow XRP Payments', value: 3, xrplName: 'disallowIncomingXRP', xrplEnum: xrpl.AccountSetAsfFlags.asfDisallowXRP },
          { name: 'asfDisableMaster', label: 'Disable Master Key', value: 4, xrplName: 'disableMasterKey', xrplEnum: xrpl.AccountSetAsfFlags.asfDisableMaster },
          // { name: 'asfAccountTxnID', label: 'Account Txn ID', value: 5, xrplName: 'accountTxnID', xrplEnum: xrpl.AccountSetAsfFlags.asfAccountTxnID },
          { name: 'asfNoFreeze', label: 'Prevent Freezing Trust Lines', value: 6, xrplName: 'noFreeze', xrplEnum: xrpl.AccountSetAsfFlags.asfNoFreeze },
          { name: 'asfGlobalFreeze', label: 'Freeze All Trust Lines', value: 7, xrplName: 'globalFreeze', xrplEnum: xrpl.AccountSetAsfFlags.asfGlobalFreeze },
          { name: 'asfDefaultRipple', label: 'Enable Rippling', value: 8, xrplName: 'defaultRipple', xrplEnum: xrpl.AccountSetAsfFlags.asfDefaultRipple },
          { name: 'asfDepositAuth', label: 'Require Deposit Auth', value: 9, xrplName: 'depositAuth', xrplEnum: xrpl.AccountSetAsfFlags.asfDepositAuth },
          // { name: 'asfAuthorizedNFTokenMinter', label: 'Require Deposit Auth', value: 10, xrplName: 'authorizedNFTokenMinter', xrplEnum: xrpl.AccountSetAsfFlags.asfAuthorizedNFTokenMinter },
          { name: 'asfDisallowIncomingNFTokenOffer', label: 'Block NFT Offers', value: 12, xrplName: 'disallowIncomingNFTokenOffer', xrplEnum: xrpl.AccountSetAsfFlags.asfDisallowIncomingNFTokenOffer },
          { name: 'asfDisallowIncomingCheck', label: 'Block Checks', value: 13, xrplName: 'disallowIncomingCheck', xrplEnum: xrpl.AccountSetAsfFlags.asfDisallowIncomingCheck },
          { name: 'asfDisallowIncomingPayChan', label: 'Block Payment Channels', value: 14, xrplName: 'disallowIncomingPayChan', xrplEnum: xrpl.AccountSetAsfFlags.asfDisallowIncomingPayChan },
          { name: 'asfDisallowIncomingTrustline', label: 'Block Trust Lines', value: 15, xrplName: 'disallowIncomingTrustline', xrplEnum: xrpl.AccountSetAsfFlags.asfDisallowIncomingTrustline },
          { name: 'asfAllowTrustLineClawback', label: 'Allow Trust Line Clawback', value: 16, xrplName: 'allowTrustLineClawback', xrplEnum: xrpl.AccountSetAsfFlags.asfAllowTrustLineClawback },
          // { name: 'asfAllowTrustLineLocking', label: 'Allow Trust Line Locking', value: 17, xrplName: 'asfAllowTrustLineLocking', xrplEnum: xrpl.AccountSetAsfFlags.asfAllowTrustLineClawback },
          { name: 'passwordSpent', label: 'Set Regular Key', value: 100, xrplName: 'passwordSpent', xrplEnum: '' },
     ],

     FLAGMAP: {
          asfRequireDest: 'requireDestinationTag',
          asfRequireAuth: 'requireAuthorization',
          asfDisallowXRP: 'disallowIncomingXRP',
          asfDisableMaster: 'disableMasterKey',
          // asfAccountTxnID: 'accountTxnID',
          asfNoFreeze: 'noFreeze',
          asfGlobalFreeze: 'globalFreeze',
          asfDefaultRipple: 'defaultRipple',
          asfDepositAuth: 'depositAuth',
          // asfAuthorizedNFTokenMinter: 'authorizedNFTokenMinter',
          asfDisallowIncomingNFTokenOffer: 'disallowIncomingNFTokenOffer',
          asfDisallowIncomingCheck: 'disallowIncomingCheck',
          asfDisallowIncomingPayChan: 'disallowIncomingPayChan',
          asfDisallowIncomingTrustline: 'disallowIncomingTrustline',
          asfAllowTrustLineClawback: 'allowTrustLineClawback',
     },

     NESTED_FIELDS: ['SetFlag', 'ClearFlag'],

     BLACK_LISTED_MEMES: ['USD', 'EUR', 'GBP', 'JPY', 'BTC', 'ETH', 'XRP', 'CNY', 'USDT', 'USDC', 'DAI', '666', 'GRD', 'coreum905c098732', 'RLUSD', 'ETH', 'USDC.axl'],

     INPUT_IDS: [
          'encryptionType',
          'createWallet',
          'account1name',
          'account2name',
          'account3name',
          'issuerName',
          'account1address',
          'account2address',
          'account3address',
          'issuerAddress',
          'account1seed',
          'account2seed',
          'account3seed',
          'issuerSeed',
          'account1encryptionAlgorithm',
          'account2encryptionAlgorithm',
          'issuerEncryptionAlgorithm',
          'account1mnemonic',
          'account2mnemonic',
          'account3mnemonic',
          'issuerMnemonic',
          'account1secretNumbers',
          'account2secretNumbers',
          'account3secretNumbers',
          'issuerSecretNumbers',
          'accountNameField',
          'accountAddressField',
          'accountSeedField',
          'xrpBalanceField',
          'amountField',
          'destinationField',
          'knownIssuers',
     ],

     XRP_CURRENCY: 'XRP',
     EMPTY_STRING: '',
     LAST_LEDGER_ADD_TIME: 20,
     MAX_FEE: '12',
     MIN_FEE: '10',
     MAX_ESCROW_FEE: '24',
};
