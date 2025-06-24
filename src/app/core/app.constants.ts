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
          },
     },

     // Encryption Algorithms
     ENCRYPTION: {
          ED25519: 'ed25519' as ECDSA,
          SECP256K1: 'secp256k1' as ECDSA,
     },

     // Transaction Results
     TRANSACTION: {
          TES_SUCCESS: 'tesSUCCESS',
     },

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

     INPUT_IDS: [
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
     ],

     XRP_CURRENCY: 'XRP',
     EMPTY_STRING: '',
};
