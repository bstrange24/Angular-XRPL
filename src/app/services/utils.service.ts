import { ElementRef, ViewChild } from '@angular/core';
import { Injectable } from '@angular/core';
import * as xrpl from 'xrpl';
import { walletFromSecretNumbers, Wallet, SubmitResponse, TxResponse, SubmittableTransaction } from 'xrpl';
import { flagNames } from 'flagnames';
import { XrplService } from '../services/xrpl.service';
import { AppConstants } from '../core/app.constants';
import { StorageService } from '../services/storage.service';
import { sha256 } from 'js-sha256';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

type FlagResult = Record<string, boolean> | string | null;

type DidValidationResult = {
     success: boolean;
     hexData?: string;
     errors?: string;
};

type InputType = 'seed' | 'mnemonic' | 'secret_numbers' | 'unknown';

@Injectable({
     providedIn: 'root',
})
export class UtilsService {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     spinner: boolean = false;

     constructor(private readonly xrplService: XrplService, private readonly storageService: StorageService) {}

     ledgerEntryTypeFields = {
          AccountRoot: {
               fields: [
                    { key: 'Account', format: (v: any) => v || null },
                    { key: 'Balance', format: (v: any) => this.formatXRPLAmount(v || '0') },
                    { key: 'Sequence', format: (v: any) => v || null },
                    { key: 'OwnerCount', format: (v: any) => v || '0' },
                    { key: 'PreviousTxnID', format: (v: any) => v || null },
                    { key: 'PreviousTxnLgrSeq', format: (v: any) => v || null },
                    { key: 'Domain', format: (v: any) => v || null },
                    { key: 'EmailHash', format: (v: any) => v || null },
                    { key: 'index', format: (v: any) => v || null },
                    { key: 'FirstNFTokenSequence', format: (v: any) => v || null },
                    { key: 'MintedNFTokens', format: (v: any) => v || '0' },
                    { key: 'Flags', format: (v: any) => v || '0' },
               ],
               label: 'Account',
               pluralLabel: 'Accounts',
          },
          Escrow: {
               fields: [
                    { key: 'Account', format: (v: any) => v || null },
                    { key: 'Amount', format: (v: any) => this.formatXRPLAmount(v || '0') },
                    { key: 'Destination', format: (v: any) => v || null },
                    { key: 'DestinationTag', format: (v: any) => v || null },
                    { key: 'Sequence', format: (v: any) => v || null },
                    { key: 'CancelAfter', format: (v: any) => (v ? this.convertXRPLTime(v) : null) },
                    { key: 'FinishAfter', format: (v: any) => (v ? this.convertXRPLTime(v) : null) },
                    { key: 'Condition', format: (v: any) => v || null },
                    { key: 'memo', format: (v: any) => v || null },
                    { key: 'PreviousTxnID', format: (v: any) => v || null },
                    { key: 'PreviousTxnLgrSeq', format: (v: any) => v || null },
                    { key: 'index', format: (v: any) => v || null },
               ],
               label: 'Escrow',
               pluralLabel: 'Escrows',
          },
          Offer: {
               fields: [
                    { key: 'Account', format: (v: any) => v || null },
                    { key: 'TakerPays', format: (v: any) => (typeof v === 'object' ? `${v.value} ${v.currency}` : this.formatXRPLAmount(v || '0')) },
                    { key: 'TakerGets', format: (v: any) => (typeof v === 'object' ? `${v.value} ${v.currency}` : this.formatXRPLAmount(v || '0')) },
                    { key: 'Expiration', format: (v: any) => (v ? this.convertXRPLTime(v) : null) },
                    { key: 'OfferSequence', format: (v: any) => v || null },
                    { key: 'PreviousTxnID', format: (v: any) => v || null },
                    { key: 'PreviousTxnLgrSeq', format: (v: any) => v || null },
                    { key: 'index', format: (v: any) => v || null },
               ],
               label: 'Offer',
               pluralLabel: 'Offers',
          },
          RippleState: {
               fields: [
                    { key: 'Balance', format: (v: any) => (typeof v === 'object' ? this.formatXRPLAmount(v) : v || null) },
                    { key: 'Flags', format: (v: any) => this.getFlagName(v) || '0' },
                    { key: 'HighLimit', format: (v: any) => (typeof v === 'object' ? this.formatXRPLAmount(v) : v || null) },
                    { key: 'HighNode', format: (v: any) => v || null },
                    { key: 'LedgerEntryType', format: (v: any) => v || null },
                    { key: 'LowLimit', format: (v: any) => (typeof v === 'object' ? this.formatXRPLAmount(v) : v || null) },
                    { key: 'LowNode', format: (v: any) => v || null },
                    { key: 'PreviousTxnID', format: (v: any) => v || null },
                    { key: 'PreviousTxnLgrSeq', format: (v: any) => v || null },
                    { key: 'index', format: (v: any) => v || null },
               ],
               label: 'RippleState',
               pluralLabel: 'RippleStates',
          },
          PayChannel: {
               fields: [
                    { key: 'Account', format: (v: any) => v || null },
                    { key: 'Destination', format: (v: any) => v || null },
                    { key: 'Amount', format: (v: any) => this.formatXRPLAmount(v || '0') },
                    { key: 'Balance', format: (v: any) => this.formatXRPLAmount(v || '0') },
                    { key: 'SettleDelay', format: (v: any) => v || null },
                    { key: 'Expiration', format: (v: any) => (v ? this.convertXRPLTime(v) : null) },
                    { key: 'CancelAfter', format: (v: any) => (v ? this.convertXRPLTime(v) : null) },
                    { key: 'PreviousTxnID', format: (v: any) => v || null },
                    { key: 'PreviousTxnLgrSeq', format: (v: any) => v || null },
                    { key: 'index', format: (v: any) => v || null },
               ],
               label: 'Payment Channel',
               pluralLabel: 'Payment Channels',
          },
          Check: {
               fields: [
                    { key: 'Account', format: (v: any) => v || null },
                    { key: 'Destination', format: (v: any) => v || null },
                    { key: 'Expiration', format: (v: any) => (v ? this.convertXRPLTime(v) : null) },
                    { key: 'SendMax', format: (v: any) => (typeof v === 'object' ? `${v.value} ${v.currency}` : this.formatXRPLAmount(v || '0')) },
                    { key: 'Sequence', format: (v: any) => v || null },
                    { key: 'PreviousTxnID', format: (v: any) => v || null },
                    { key: 'PreviousTxnLgrSeq', format: (v: any) => v || null },
                    { key: 'index', format: (v: any) => v || null },
               ],
               label: 'Check',
               pluralLabel: 'Checks',
          },
          DepositPreauth: {
               fields: [
                    { key: 'Account', format: (v: any) => v || null },
                    { key: 'Authorize', format: (v: any) => v || null },
                    { key: 'Flags', format: (v: any) => v || null },
                    { key: 'OwnerNode', format: (v: any) => v || null },
                    { key: 'PreviousTxnID', format: (v: any) => v || null },
                    { key: 'PreviousTxnLgrSeq', format: (v: any) => v || null },
                    { key: 'index', format: (v: any) => v || null },
               ],
               label: 'Deposit Preauthorization',
               pluralLabel: 'Deposit Preauthorizations',
          },
          Ticket: {
               fields: [
                    { key: 'Account', format: (v: any) => v || null },
                    { key: 'Flags', format: (v: any) => this.decodeNFTFlags(Number(v)) },
                    { key: 'TicketSequence', format: (v: any) => v || null },
                    { key: 'PreviousTxnID', format: (v: any) => v || null },
                    { key: 'PreviousTxnLgrSeq', format: (v: any) => v || null },
                    { key: 'index', format: (v: any) => v || null },
               ],
               label: 'Ticket',
               pluralLabel: 'Tickets',
          },
          DirectoryNode: {
               fields: [
                    { key: 'Flags', format: (v: any) => v || '0' },
                    { key: 'Owner', format: (v: any) => v || null },
                    { key: 'Indexes', format: (v: any) => (Array.isArray(v) ? v.join(', ') : v || null) },
                    { key: 'PreviousTxnID', format: (v: any) => v || null },
                    { key: 'PreviousTxnLgrSeq', format: (v: any) => v || null },
                    { key: 'index', format: (v: any) => v || null },
                    { key: 'RootIndex', format: (v: any) => v || null },
               ],
               label: 'Directory',
               pluralLabel: 'Directories',
          },
          AMM: {
               fields: [
                    // { key: 'Asset1', format: (v: any)=> `${v.currency} (Issuer: ${v.issuer || null})` },
                    // { key: 'Asset2', format: (v: any)=> `${v.currency} (Issuer: ${v.issuer || null})` },
                    { key: 'LPTokenBalance', format: (v: any) => `${v.value} ${v.currency}` },
                    { key: 'TradingFee', format: (v: any) => v || null },
                    { key: 'PreviousTxnID', format: (v: any) => v || null },
                    { key: 'PreviousTxnLgrSeq', format: (v: any) => v || null },
                    { key: 'index', format: (v: any) => v || null },
               ],
               label: 'Automated Market Maker',
               pluralLabel: 'Automated Market Makers',
          },
          NFTokenPage: {
               fields: [
                    { key: 'Flags', format: (v: any) => v || '0' },
                    { key: 'LedgerEntryType', format: (v: any) => v || null },
                    { key: 'NFTokens', format: (v: any) => (Array.isArray(v) ? v : null) },
                    { key: 'index', format: (v: any) => v || null },
                    { key: 'PreviousTxnID', format: (v: any) => v || null },
                    { key: 'PreviousTxnLgrSeq', format: (v: any) => v || null },
               ],
               label: 'NFTokenPage',
               pluralLabel: 'NFTokenPages',
          },
          SignerList: {
               fields: [
                    { key: 'Flags', format: (v: any) => v || null },
                    { key: 'SignerQuorum', format: (v: any) => v || null },
                    { key: 'SignerEntries', format: (v: any) => (Array.isArray(v) ? v.map(e => e.SignerEntry.Account).join(', ') : null) },
                    { key: 'SignerListID', format: (v: any) => v || null },
                    { key: 'PreviousTxnID', format: (v: any) => v || null },
                    { key: 'PreviousTxnLgrSeq', format: (v: any) => v || null },
                    { key: 'index', format: (v: any) => v || null },
               ],
               label: 'Signer List',
               pluralLabel: 'Signer Lists',
          },
          NFT: {
               fields: [
                    // { key: 'Flags', format: (v: any)=> v || '0' },
                    { key: 'Flags', format: (v: any) => this.decodeNFTFlags(Number(v)) },
                    { key: 'Issuer', format: (v: any) => v || null },
                    { key: 'NFTokenID', format: (v: any) => v || null },
                    { key: 'NFTokenTaxon', format: (v: any) => (v === 0 ? null : v || null) },
                    { key: 'URI', format: (v: any) => v || null },
                    { key: 'nft_serial', format: (v: any) => v || null },
               ],
               label: 'NFT',
               pluralLabel: 'NFTs',
          },
     };

     getSelectedSeedWithIssuer(selectedAccount: string, account1: any, account2: any, issuer: any): string {
          return selectedAccount === 'account1' ? account1.seed : selectedAccount === 'account2' ? account2.seed : issuer.seed;
     }

     getSelectedAddressWithIssuer(selectedAccount: string, account1: any, account2: any, issuer: any): string {
          return selectedAccount === 'account1' ? account1.address : selectedAccount === 'account2' ? account2.address : issuer.address;
     }

     getSelectedAddressWithOutIssuer(selectedAccount: string, account1: any, account2: any): string {
          return selectedAccount === 'account1' ? account1.address : account2.address;
     }

     getSelectedSeedWithOutIssuer(selectedAccount: string, account1: any, account2: any): string {
          return selectedAccount === 'account1' ? account1.seed : account2.seed;
     }

     encodeIfNeeded(currency: string): string {
          return currency?.length > 3 ? this.encodeCurrencyCode(currency) : currency || '';
     }

     decodeIfNeeded(value: string): string {
          return this.isCurrencyCode(value) ? this.decodeCurrencyCode(value) : value;
     }

     isCurrencyCode(value: string): boolean {
          // Heuristic: XRP-style currency codes are either "XRP" or 3+ chars / 160-bit hex
          // You can adjust this depending on your needs
          return value !== 'XRP' && value.length > 3;
     }

     validateCondition(condition: string | undefined | null): string | null {
          // Check if condition is provided and non-empty
          if (!this.validateInput(condition)) {
               return 'Condition cannot be empty';
          }

          // Ensure condition is a valid hex string (uppercase, 0-9, A-F)
          const hexRegex = /^[0-9A-F]+$/;
          if (!hexRegex.test(condition!)) {
               return 'Condition must be a valid uppercase hex string (0-9, A-F)';
          }

          // Check length for SHA-256 (32 bytes = 64 hex characters)
          if (condition!.length !== 64) {
               return 'Condition must be 64 hex characters (32 bytes) for SHA-256';
          }

          return null;
     }

     validateFulfillment(fulfillment: string | undefined | null, condition: string): string | null {
          if (!this.validateInput(fulfillment)) {
               return 'Fulfillment cannot be empty';
          }
          const hexRegex = /^[0-9A-F]+$/;
          if (!hexRegex.test(fulfillment!)) {
               return 'Fulfillment must be a valid uppercase hex string (0-9, A-F)';
          }
          try {
               // Convert hex to binary and compute SHA-256 hash
               const fulfillmentBytes = Buffer.from(fulfillment!, 'hex'); // Buffer polyfill or use Uint8Array
               const computedHash = sha256(fulfillmentBytes).toUpperCase();
               if (computedHash !== condition) {
                    return 'Fulfillment does not match the condition';
               }
          } catch (error) {
               return 'Invalid fulfillment: unable to compute SHA-256 hash';
          }
          return null;
     }

     validateInput(input: string | undefined | null): boolean {
          return typeof input === 'string' && !!input.trim();
     }

     isValidTransactionHash(input: string): boolean {
          return /^[0-9A-Fa-f]{64}$/.test(input);
     }

     parseAndValidateNFTokenIDs(idsString: string): string[] {
          const ids = idsString.split(',').map(id => id.trim());
          const validIds = ids.filter(id => /^[0-9A-Fa-f]{64}$/.test(id));
          return validIds;
     }

     isValidCTID(input: string): boolean {
          return /^C[0-9A-Fa-f]+$/.test(input);
     }

     formatXRPLAmount = (value: any): string => {
          if (value == null || isNaN(value)) {
               return 'Invalid amount';
          }

          if (typeof value === 'object' && value.currency && value.value) {
               return `${value.value} ${value.currency}${value.issuer ? ` (Issuer: ${value.issuer})` : ''}`;
          }
          return `${(parseInt(value) / 1000000).toFixed(6)} XRP`;
     };

     isValidDate(value: any): boolean {
          return value && !isNaN(new Date(value).getTime());
     }

     isValidAddress(address: string): boolean {
          return xrpl.isValidAddress(address);
     }

     jsonToHex(obj: string | object): string {
          const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
          return Buffer.from(JSON.stringify(str), 'utf8').toString('hex');
     }

     hexTojson(obj: string | object): string {
          const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
          return Buffer.from(str, 'hex').toString('utf8');
     }

     validateAndConvertDidJson(didJsonString: string, didSchema: object): DidValidationResult {
          const ajv = new Ajv({ allErrors: true });
          addFormats(ajv);
          const validate = ajv.compile(didSchema);

          try {
               const parsed = JSON.parse(didJsonString);

               // Handle array of documents or single document
               if (Array.isArray(parsed)) {
                    for (let i = 0; i < parsed.length; i++) {
                         const doc = parsed[i];
                         const valid = validate(doc);
                         if (!valid) {
                              console.error(`Document ${i} invalid:`, validate.errors);
                              return { success: false, errors: `Document ${i} invalid: ${JSON.stringify(validate.errors)}` };
                         }
                         console.log(`Document ${i} valid!`);
                    }
               } else {
                    const valid = validate(parsed);
                    if (!valid) {
                         console.error('DID JSON invalid:', validate.errors);
                         return { success: false, errors: `DID JSON invalid: ${JSON.stringify(validate.errors)}` };
                    }
                    console.log('DID JSON valid');
               }

               // Convert JSON to hex
               const didDataHex = this.jsonToHex(parsed as object);
               console.log('didDataHex in json', this.hexTojson(didDataHex));
               return { success: true, hexData: didDataHex };
          } catch (e: any) {
               console.error('Invalid JSON:', e.message);
               return { success: false, errors: `Invalid JSON: ${e.message}` };
          }
     }

     issuedAmount(currency: string, issuer: string, value: any) {
          return { currency, issuer, value: value.toString() };
     }

     convertXRPLTime(rippleTime: any) {
          const rippleEpochOffset = 946684800;
          const cancelAfterUnix = rippleTime + rippleEpochOffset; // 1757804253

          const cancelAfterDate = new Date(cancelAfterUnix * 1000);
          const formatter1 = this.dateFormatter();
          console.log('toUTCString: ', cancelAfterDate.toUTCString());
          console.log('Formatter 1: ', formatter1.format(cancelAfterDate));
          return formatter1.format(cancelAfterDate);

          // Convert Ripple time (seconds since Jan 1, 2000) to UTC datetime
          // const rippleEpoch = 946684800; // Jan 1, 2000 in Unix time
          // const date = new Date((rippleTime + rippleEpoch) * 1000);
          // const formatter = this.dateFormatter();
          // console.log('Formatter OG: ', formatter.format(date));
          // return formatter.format(date);
     }

     convertToUnixTimestamp(dateString: any) {
          const [month, day, year] = dateString.split('/').map(Number);
          const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
          return Math.floor(date.getTime() / 1000);
     }

     /**
      * Convert XRPL Expiration (Ripple Epoch seconds) to "MM/DD/YYYY HH:MM:SS" UTC string
      * @param rippleSeconds - Expiration from XRPL tx (seconds since 2000-01-01 UTC)
      */
     // toFormattedExpiration(rippleSeconds: number): string {
     //      // Convert to UNIX epoch seconds
     //      const unixSeconds = rippleSeconds + 946684800;
     //      const date = new Date(unixSeconds * 1000);

     //      const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // Months are 0-based
     //      const day = String(date.getUTCDate()).padStart(2, '0');
     //      const year = date.getUTCFullYear();

     //      let hours = date.getUTCHours();
     //      const minutes = String(date.getUTCMinutes()).padStart(2, '0');
     //      const seconds = String(date.getUTCSeconds()).padStart(2, '0');

     //      const ampm = hours >= 12 ? 'PM' : 'AM';
     //      hours = hours % 12;
     //      if (hours === 0) hours = 12; // handle midnight/noon
     //      const hoursStr = String(hours).padStart(2, '0');

     //      return `${month}/${day}/${year} ${hoursStr}:${minutes}:${seconds} ${ampm}`;
     // }

     // toRippleTime(dateTimeStr: string): number {
     //      // dateTimeStr example: "2025-12-25T15:30"
     //      const date = new Date(dateTimeStr + ':00Z'); // Force UTC
     //      return Math.floor(date.getTime() / 1000) - 946684800;
     // }

     toRippleTime(isoDate: string): number {
          // Ripple epoch starts 2000-01-01T00:00:00Z
          const rippleEpoch = Date.UTC(2000, 0, 1, 0, 0, 0);

          // Parse the input date
          const inputDate = new Date(isoDate).getTime();

          // Convert ms → seconds and subtract epoch
          return Math.floor((inputDate - rippleEpoch) / 1000);
     }

     fromRippleTime(rippleTime: number): { isoUTC: string; est: string } {
          // Ripple epoch starts 2000-01-01T00:00:00Z
          const rippleEpoch = Date.UTC(2000, 0, 1, 0, 0, 0);

          // Convert ripple seconds back to JS time
          const date = new Date(rippleEpoch + rippleTime * 1000);

          // ISO UTC string
          const isoUTC = date.toISOString();

          // EST (America/New_York) using 12-hour clock
          const est = new Intl.DateTimeFormat('en-US', {
               timeZone: 'America/New_York',
               year: 'numeric',
               month: '2-digit',
               day: '2-digit',
               hour: '2-digit',
               minute: '2-digit',
               second: '2-digit',
               hour12: true,
          }).format(date);

          return { isoUTC, est };
     }

     // Returns ripple-epoch seconds (number) or undefined if empty/invalid
     getExpirationRippleSeconds(credential: String): number | undefined {
          const v = credential;
          if (!v) return undefined;

          // If ngModel gave a Date object, convert to Y/M/D safely:
          if (v instanceof Date) {
               const y = v.getFullYear();
               const m = v.getMonth() + 1;
               const d = v.getDate();
               const unixSeconds = Math.floor(Date.UTC(y, m - 1, d, 0, 0, 0) / 1000);
               return unixSeconds - 946684800;
          }

          // If it's a string (YYYY-MM-DD) — the normal case for <input type="date">
          if (typeof v === 'string') {
               const parts = v.split('-').map(Number);
               if (parts.length !== 3 || parts.some(isNaN)) {
                    throw new Error('expirationDate must be YYYY-MM-DD or Date');
               }
               const [year, month, day] = parts;
               const unixSeconds = Math.floor(Date.UTC(year, month - 1, day, 0, 0, 0) / 1000);
               return unixSeconds - 946684800;
          }

          throw new Error('Unsupported expirationDate type: ' + typeof v);
     }

     decodeHex = (hex: any): string => {
          try {
               if (!this.validateInput(hex)) {
                    return '';
               }
               return Buffer.from(hex, 'hex').toString('ascii');
          } catch (error: any) {
               console.error(`Error decoding hex: ${hex}`, error);
               return hex; // Return raw hex if decoding fails
          }
     };

     async getRegularKeyWallet(environment: string, isMultiSign: boolean, isRegularKeyAddress: boolean, regularKeySeed: string) {
          let regularKeyWalletSignTx: any = '';
          let useRegularKeyWalletSignTx = false;
          if (isRegularKeyAddress && !isMultiSign) {
               console.log('Using Regular Key Seed for transaction signing');
               regularKeyWalletSignTx = await this.getWallet(regularKeySeed, environment);
               useRegularKeyWalletSignTx = true;
          }
          return { useRegularKeyWalletSignTx, regularKeyWalletSignTx };
     }

     getMultiSignSeeds(multiSignSeeds: any) {
          return multiSignSeeds
               .split(',')
               .map((s: string) => s.trim())
               .filter((s: string) => s.length > 0 && s !== '');
     }

     getMultiSignAddress(multiSignAddress: any) {
          return multiSignAddress
               .split(',')
               .map((s: string) => s.trim())
               .filter((s: string) => s.length > 0 && s !== '');
     }

     getNftIds(nftId: any) {
          return nftId
               .split(',')
               .map((s: string) => s.trim())
               .filter((s: string) => s.length > 0 && s !== '');
     }

     populateKnownDestinations(knownDestinations: any, account1: string, account2: string, issuer: string) {
          return (knownDestinations = {
               Account1: account1,
               Account2: account2,
               Account3: issuer,
          });
     }

     formatTokenBalance(field: string, roundTo: number): string {
          Number(field).toLocaleString();
          return Number(field).toLocaleString(undefined, {
               minimumFractionDigits: 0,
               maximumFractionDigits: roundTo, // enough to preserve precision
               useGrouping: true,
          });
     }

     removeCommaFromAmount(field: string): string {
          return field.replace(/,/g, '');
     }

     formatCurrencyForDisplay(v: any): string {
          const strV = String(v);
          const normalizedCurrency = this.normalizeCurrencyCode(strV);
          if (normalizedCurrency === '') {
               return `(LP Token) ${strV}`;
          } else {
               return `${normalizedCurrency}`;
          }
     }

     formatValueForKey(k: string, v: any): string {
          const strV = String(v);
          if (k === 'index' || k === 'Account' || k === 'issuer') {
               return `<code>${strV}</code>`;
          }
          if (k === 'currency') {
               const normalizedCurrency = this.normalizeCurrencyCode(strV);
               if (normalizedCurrency === '') {
                    return `(LP Token) <code>${strV}</code>`;
               } else {
                    return `<code>${normalizedCurrency}</code>`;
               }
          }
          return strV;
     }

     normalizeAccounts(accounts: Record<string, string>, newAddress: string): Record<string, string> {
          // Check if all non-XRP keys are already set to newAddress
          const alreadyNormalized = Object.entries(accounts)
               .filter(([key]) => key !== 'XRP')
               .every(([, value]) => value === newAddress);

          if (alreadyNormalized) {
               accounts['XRP'] = '';
               return accounts; // Nothing to change
          }

          // Update all non-XRP keys to newAddress
          const updated = { ...accounts };
          for (const key in updated) {
               if (key !== 'XRP') {
                    updated[key] = newAddress;
               }
          }
          accounts['XRP'] = '';
          return updated;
     }

     isValidCurrencyCode(currency: string): boolean {
          // Basic validation: 3-20 characters or valid hex for XRPL currency codes
          return /^[A-Za-z0-9]{3,20}$/.test(currency) || /^[0-9A-Fa-f]{40}$/.test(currency);
     }

     normalizeCurrencyCode(currencyCode: string, maxLength = 20) {
          if (!currencyCode) return '';

          if (currencyCode.length === 3 && currencyCode.trim().toLowerCase() !== 'xrp') {
               // "Standard" currency code
               return currencyCode.trim();
          }

          if (currencyCode.match(/^[a-fA-F0-9]{40}$/) && !isNaN(parseInt(currencyCode, 16))) {
               // Hexadecimal currency code
               const hex = currencyCode.toString().replace(/(00)+$/g, '');
               if (hex.startsWith('01')) {
                    // Old demurrage code. https://xrpl.org/demurrage.html
                    return this.convertDemurrageToUTF8(currencyCode);
               }
               if (hex.startsWith('02')) {
                    // XLS-16d NFT Metadata using XLS-15d Concise Transaction Identifier
                    // https://github.com/XRPLF/XRPL-Standards/discussions/37
                    const xlf15d = Buffer.from(hex, 'hex').slice(8).toString('utf-8').slice(0, maxLength).trim();
                    if (xlf15d.match(/[a-zA-Z0-9]{3,}/) && xlf15d.toLowerCase() !== 'xrp') {
                         return xlf15d;
                    }
               }
               const decodedHex = Buffer.from(hex, 'hex').toString('utf-8').slice(0, maxLength).trim();
               if (decodedHex.match(/[a-zA-Z0-9]{3,}/) && decodedHex.toLowerCase() !== 'xrp') {
                    // ASCII or UTF-8 encoded alphanumeric code, 3+ characters long
                    return decodedHex;
               }
          }
          return '';
     }

     convertDemurrageToUTF8(demurrageCode: string): string {
          let bytes = Buffer.from(demurrageCode, 'hex');
          let code = String.fromCharCode(bytes[1]) + String.fromCharCode(bytes[2]) + String.fromCharCode(bytes[3]);
          let interest_start = (bytes[4] << 24) + (bytes[5] << 16) + (bytes[6] << 8) + bytes[7];
          let interest_period = bytes.readDoubleBE(8);
          const year_seconds = 31536000; // By convention, the XRP Ledger's interest/demurrage rules use a fixed number of seconds per year (31536000), which is not adjusted for leap days or leap seconds
          let interest_after_year = Math.pow(Math.E, (interest_start + year_seconds - interest_start) / interest_period);
          let interest = interest_after_year * 100 - 100;

          return `${code} (${interest}% pa)`;
     }

     decodeCurrencyCode(hexCode: String) {
          const buffer = Buffer.from(hexCode, 'hex');
          const trimmed = buffer.subarray(0, buffer.findIndex(byte => byte === 0) === -1 ? 20 : buffer.findIndex(byte => byte === 0));
          return new TextDecoder().decode(trimmed);
     }

     encodeCurrencyCode(code: any) {
          const encoder = new TextEncoder();
          const codeBytes = encoder.encode(code);

          if (codeBytes.length > 20) throw new Error('Currency code too long');

          // Pad to 20 bytes
          const padded = new Uint8Array(20);
          padded.set(codeBytes);

          return Buffer.from(padded).toString('hex').toUpperCase(); // 40-char hex string
     }

     decodeNFTFlags(flags: any) {
          if (typeof flags !== 'number') return '';

          const flagMap = {
               1: 'Burnable',
               2: 'Only XRP',
               8: 'Transferable',
               16: 'Mutable',
          };

          const result = [];
          for (const [bit, name] of Object.entries(flagMap)) {
               if (flags & Number(bit)) result.push(name);
          }

          return result.length ? result.join(', ') : 'None';
     }

     getCredentialStatus(flags: number): string {
          return flags === 65536 ? 'Credential accepted' : 'Credential not accepted';
     }

     parseTransferRateToPercentage(transferRate: string) {
          const rate = parseInt(transferRate, 10);
          if (isNaN(rate) || rate < 1000000000) {
               return 0; // Default rate is 0% fee (1.0x multiplier)
          }
          return (rate / 1_000_000_000 - 1) * 100;
     }

     convertToEstTime(UtcDataTime: string): string {
          const utcDate = new Date(UtcDataTime);
          const formatter = this.dateFormatter();
          return formatter.format(utcDate);
     }

     dateFormatter() {
          // Format the date in EST (America/New_York handles EST/EDT automatically)
          return new Intl.DateTimeFormat('en-US', {
               timeZone: 'America/New_York', // EST/EDT
               timeZoneName: 'short', // Includes EST or EDT
               year: 'numeric',
               month: 'numeric',
               day: 'numeric', // day: '2-digit',
               hour: 'numeric', // hour: '2-digit',
               minute: '2-digit',
               second: '2-digit',
               hour12: true, // Use 24-hour format; set to true for 12-hour with AM/PM
               // fractionalSecondDigits: 3, // Include milliseconds (3 digits)
          });
     }

     convertDateTimeToRippleTime(dateTimeField: string) {
          const rippleEpochOffset = 946684800; // Seconds between 1970-01-01 and 2000-01-01 UTC
          const date = new Date(dateTimeField); // parses as local time
          const unixTimestamp = Math.floor(date.getTime() / 1000); // milliseconds ➜ seconds
          const afterDate = unixTimestamp - rippleEpochOffset;
          console.log('XRPL CancelAfter:', afterDate);
          return afterDate;
     }

     addTime(amount: any, unit: 'seconds' | 'minutes' | 'hours' | 'days' = 'seconds', date = new Date()) {
          const multiplierMap = {
               seconds: 1,
               minutes: 60,
               hours: 3600,
               days: 86400,
          };

          const multiplier = multiplierMap[unit];
          if (!multiplier) {
               throw new Error(`Invalid unit: ${unit}. Use 'seconds', 'minutes', 'hours', or 'days'.`);
          }

          const addedSeconds = amount * multiplier;
          const unixTimestamp = Math.floor(date.getTime() / 1000) + addedSeconds;

          // Convert from Unix Epoch (1970) to Ripple Epoch (2000)
          const rippleEpoch = unixTimestamp - 946684800;
          return rippleEpoch;
     }

     getTransferRate(percentage: number): number {
          // Placeholder: Implement your getTransferRate from utils.js
          // Example: Convert percentage to XRPL TransferRate
          return Math.round((1 + percentage / 100) * 1_000_000_000);
     }

     stripHTMLForSearch(html: string): string {
          const div = document.createElement('div');
          div.innerHTML = html;
          const result = (div.textContent || div.innerText || '').toLowerCase().trim();
          console.debug('stripHTMLForSearch:', { input: html, output: result });
          return result;
     }

     stripHTML(text: string): string {
          const div = document.createElement('div');
          div.innerHTML = text;
          return div.textContent || div.innerText || '';
     }

     async getWallet(seed: string, environment: string): Promise<xrpl.Wallet> {
          const savedEncryptionType = this.storageService.getInputValue('encryptionType');
          const result = this.detectXrpInputType(seed);
          try {
               if (savedEncryptionType === 'true') {
                    if (result.type === 'seed') {
                         return xrpl.Wallet.fromSeed(result.value, { algorithm: AppConstants.ENCRYPTION.ED25519 });
                    } else if (result.type === 'mnemonic') {
                         return Wallet.fromMnemonic(result.value, { algorithm: AppConstants.ENCRYPTION.ED25519 });
                    } else if (result.type === 'secret_numbers') {
                         return walletFromSecretNumbers(result.value, { algorithm: AppConstants.ENCRYPTION.ED25519 });
                    } else {
                         throw new Error('Invalid seed or mnemonic format');
                    }
               } else {
                    if (result.type === 'seed') {
                         return xrpl.Wallet.fromSeed(result.value, { algorithm: AppConstants.ENCRYPTION.SECP256K1 });
                    } else if (result.type === 'mnemonic') {
                         return Wallet.fromMnemonic(result.value, { algorithm: AppConstants.ENCRYPTION.SECP256K1 });
                    } else if (result.type === 'secret_numbers') {
                         return walletFromSecretNumbers(result.value, { algorithm: AppConstants.ENCRYPTION.SECP256K1 });
                    } else {
                         throw new Error('Invalid seed or mnemonic format');
                    }
               }
          } catch (error: any) {
               throw new Error('Invalid seed or mnemonic format');
          }
     }

     validateSeed(seed: string) {
          const savedEncryptionType = this.storageService.getInputValue('encryptionType');
          const result = this.detectXrpInputType(seed);
          try {
               if (result.type === 'unknown') {
                    return false;
               }
               if (savedEncryptionType === 'true') {
                    if (result.type === 'seed') {
                         xrpl.Wallet.fromSeed(result.value, { algorithm: AppConstants.ENCRYPTION.ED25519 });
                    } else if (result.type === 'mnemonic') {
                         Wallet.fromMnemonic(result.value, { algorithm: AppConstants.ENCRYPTION.ED25519 });
                    } else if (result.type === 'secret_numbers') {
                         walletFromSecretNumbers(result.value, { algorithm: AppConstants.ENCRYPTION.ED25519 });
                    }
               } else {
                    if (result.type === 'seed') {
                         xrpl.Wallet.fromSeed(result.value, { algorithm: AppConstants.ENCRYPTION.SECP256K1 });
                    } else if (result.type === 'mnemonic') {
                         Wallet.fromMnemonic(result.value, { algorithm: AppConstants.ENCRYPTION.SECP256K1 });
                    } else if (result.type === 'secret_numbers') {
                         walletFromSecretNumbers(result.value, { algorithm: AppConstants.ENCRYPTION.SECP256K1 });
                    }
               }
               return true;
          } catch (error: any) {
               return false;
          }
     }

     detectXrpInputType(input: string): { type: InputType; value: string } {
          const trimmed = input.trim();

          // Check for seed (starts with 's' and is base58)
          const seedRegex = /^s[0-9a-zA-Z]{20,}$/;
          if (seedRegex.test(trimmed)) {
               return { type: 'seed', value: trimmed };
          }

          // Check for mnemonic (space-separated lowercase words, usually 12-24)
          const mnemonicWords = trimmed.split(/\s+/);
          const isAllWords = mnemonicWords.every(word => /^[a-z]+$/.test(word));
          if (isAllWords && [12, 15, 18, 21, 24].includes(mnemonicWords.length)) {
               return { type: 'mnemonic', value: trimmed };
          }

          // Check for secret numbers (comma-separated 6-digit numbers)
          const numberParts = trimmed.split(',');
          const isAllNumbers = numberParts.every(num => /^\d{6}$/.test(num.trim()));
          if (isAllNumbers && numberParts.length > 1) {
               return { type: 'secret_numbers', value: trimmed };
          }

          return { type: 'unknown', value: trimmed };
     }

     checkTimeBasedEscrowStatus(escrow: { FinishAfter?: number; CancelAfter?: number; owner: string }, currentRippleTime: number, callerAddress: string, operation: string): { canFinish: boolean; canCancel: boolean; reasonFinish: string; reasonCancel: string } {
          const now = currentRippleTime;
          const { FinishAfter, CancelAfter, owner } = escrow;

          let canFinish = false;
          let canCancel = false;
          let reasonFinish = '';
          let reasonCancel = '';

          // --- Check finish eligibility ---
          if (FinishAfter !== undefined) {
               if (now >= FinishAfter) {
                    canFinish = true;
               } else {
                    reasonFinish = `Escrow can only be finished after ${this.convertXRPLTime(FinishAfter)}, current time is ${this.convertXRPLTime(now)}.`;
               }
          } else {
               reasonFinish = `No FinishAfter time defined.`;
          }

          // --- Check cancel eligibility ---
          if (CancelAfter !== undefined) {
               if (now >= CancelAfter) {
                    if (callerAddress === owner) {
                         canCancel = true;
                    } else {
                         reasonCancel = `The Escrow has expired and can only be cancelled. Only the escrow owner (${owner}) can cancel this escrow.`;
                    }
               } else {
                    reasonCancel = `Escrow can only be canceled after ${this.convertXRPLTime(CancelAfter)}, current time is ${this.convertXRPLTime(now)}.`;
               }
          } else {
               reasonCancel = `No CancelAfter time defined.`;
          }

          if (operation === 'finishEscrow' && canCancel && canFinish) {
               canFinish = false;
               canCancel = true;
               reasonFinish = `The Escrow has expired and can only be cancelled.`;
          }

          return { canFinish, canCancel, reasonFinish, reasonCancel };
     }

     checkEscrowStatus(escrow: { FinishAfter?: number; CancelAfter?: number; Condition?: string; owner: string }, currentRippleTime: number, callerAddress: string, operation: 'finishEscrow' | 'cancelEscrow', fulfillment?: string): { canFinish: boolean; canCancel: boolean; reasonFinish: string; reasonCancel: string } {
          const now = currentRippleTime;
          const { FinishAfter, CancelAfter, Condition, owner } = escrow;

          let canFinish = true; // Default to true for condition-only escrows
          let canCancel = false;
          let reasonFinish = '';
          let reasonCancel = '';

          // --- Check finish eligibility ---
          // Time-based check
          if (FinishAfter !== undefined) {
               if (now < FinishAfter) {
                    canFinish = false;
                    reasonFinish = `Escrow can only be finished after ${this.convertXRPLTime(FinishAfter)}, current time is ${this.convertXRPLTime(now)}.`;
               }
          }

          // Condition-based check
          if (Condition) {
               if (!fulfillment) {
                    canFinish = false;
                    reasonFinish = reasonFinish ? `${reasonFinish} Additionally, a fulfillment is required for condition-based escrow.` : 'A fulfillment is required for condition-based escrow.';
               }
          } else if (fulfillment && !Condition) {
               canFinish = false;
               reasonFinish = reasonFinish ? `${reasonFinish} No condition is set, so fulfillment is not applicable.` : 'No condition is set, so fulfillment is not applicable.';
          }

          // If no FinishAfter or Condition is set, finishing is not possible
          if (FinishAfter === undefined && !Condition) {
               canFinish = false;
               reasonFinish = 'No FinishAfter time or Condition defined.';
          }

          // --- Check cancel eligibility ---
          if (CancelAfter !== undefined) {
               if (now >= CancelAfter) {
                    if (callerAddress === owner) {
                         canCancel = true;
                    } else {
                         reasonCancel = `Only the escrow owner (${owner}) can cancel this escrow.`;
                    }
               } else {
                    reasonCancel = `Escrow can only be canceled after ${this.convertXRPLTime(CancelAfter)}, current time is ${this.convertXRPLTime(now)}.`;
               }
          } else {
               reasonCancel = 'No CancelAfter time defined.';
          }

          // If escrow has expired (CancelAfter passed), prioritize cancellation for finishEscrow operation
          if (operation === 'finishEscrow' && canCancel && canFinish) {
               canFinish = false;
               reasonFinish = reasonFinish ? `${reasonFinish} The escrow has expired and can only be canceled.` : 'The escrow has expired and can only be canceled.';
          }

          return { canFinish, canCancel, reasonFinish, reasonCancel };
     }

     isTxResponse(obj: any): obj is xrpl.TxResponse<xrpl.SubmittableTransaction> {
          return obj && typeof obj !== 'string' && 'result' in obj;
     }

     /**
      * ✅ BULLETPROOF transaction success checker
      * Handles ALL response types from rippled:
      * - submit (simulate)
      * - submitAndWait
      * - errors, warnings, partial results
      */
     isTxSuccessful(response: any): boolean {
          // Handle submitAndWait response (real transaction)
          if (response?.result?.meta) {
               if (typeof response.result.meta === 'string') {
                    // Meta is string? That's an error
                    return false;
               }
               // Check TransactionResult
               return response.result.meta.TransactionResult === AppConstants.TRANSACTION.TES_SUCCESS;
          }

          // Handle submit response (simulate)
          if (response?.engine_result) {
               return response.engine_result === 'tesSUCCESS';
          }

          // Handle error responses from submit
          if (response?.result?.engine_result) {
               return response.result.engine_result === 'tesSUCCESS';
          }

          // Handle unexpected/unknown response
          console.warn('Unknown response format in isTxSuccessful:', response);
          return false;
     }

     /**
      * Optional: Get human-readable result for logging or UI
      */
     getTransactionResultMessage(response: any): string {
          if (response?.result?.meta?.TransactionResult) {
               return response.result.meta.TransactionResult;
          }
          if (response?.engine_result) {
               return response.engine_result;
          }
          if (response?.result?.engine_result) {
               return response.result.engine_result;
          }
          return 'UNKNOWN';
     }

     processErrorMessageFromLedger(resultMsg: string): string {
          // =============================
          // 🚫 LOCAL FAILURE (tef*)
          // Transaction failed before applying to ledger
          // =============================
          if (resultMsg === 'tefALREADY') return 'Transaction already applied or queued.';
          if (resultMsg === 'tefBAD_ADD_AUTH') return 'Invalid addition to signer list.';
          if (resultMsg === 'tefBAD_AUTH') return 'Invalid signature or authorization.';
          if (resultMsg === 'tefBAD_AUTH_MASTER') return 'Master key is disabled and no regular key set.';
          if (resultMsg === 'tefBAD_LEDGER') return 'Ledger state is invalid or inconsistent.';
          if (resultMsg === 'tefCREATED') return 'Object created that should not be created.';
          if (resultMsg === 'tefEXCEPTION') return 'Unexpected exception during processing.';
          if (resultMsg === 'tefFAILURE') return 'Generic failure during local processing.';
          if (resultMsg === 'tefINTERNAL') return 'Internal error in rippled server.';
          if (resultMsg === 'tefMAX_LEDGER') return 'Transaction expired. Please try again.';
          if (resultMsg === 'tefNO_AUTH_REQUIRED') return 'Auth is required but not provided.';
          if (resultMsg === 'tefPAST_SEQ') return 'Sequence number is too low (already used).';
          if (resultMsg === 'tefWRONG_PRIOR') return 'Incorrect previous transaction hash.';
          if (resultMsg === 'tefMASTER_DISABLED') return 'Master key is disabled and no regular key available.';

          // =============================
          // 🚫 CLAIM FAILURE (tec*)
          // Transaction claimed a fee but failed to apply
          // =============================
          if (resultMsg === 'tecCLAIM') return 'Fee claimed, but transaction failed.';
          if (resultMsg === 'tecDIR_FULL') return 'Directory is full. Try again later.';
          if (resultMsg === 'tecFAILED_PROCESSING') return 'Transaction failed during processing.';
          if (resultMsg === 'tecINSUF_RESERVE_LINE') return 'Insufficient reserve to add trust line.';
          if (resultMsg === 'tecINSUF_RESERVE_OFFER') return 'Insufficient reserve to create offer.';
          if (resultMsg === 'tecNO_DST') return 'Destination account does not exist.';
          if (resultMsg === 'tecNO_DST_INSUF_XRP') return 'Destination account does not exist and cannot be created (insufficient XRP).';
          if (resultMsg === 'tecNO_ISSUER') return 'Issuer account does not exist.';
          if (resultMsg === 'tecNO_AUTH') return 'Not authorized to hold asset (trust line not authorized).';
          if (resultMsg === 'tecNO_LINE') return 'No trust line exists for this asset.';
          if (resultMsg === 'tecNO_LINE_INSUF_RESERVE') return 'No trust line and insufficient reserve to create one.';
          if (resultMsg === 'tecNO_LINE_REDUNDANT') return 'Trust line already exists with same limit.';
          if (resultMsg === 'tecPATH_DRY') return 'No liquidity found along payment path.';
          if (resultMsg === 'tecPATH_PARTIAL') return 'Only partial payment possible.';
          if (resultMsg === 'tecUNFUNDED_ADD') return 'Insufficient funds to add to balance.';
          if (resultMsg === 'tecUNFUNDED_OFFER') return 'Insufficient funds to place offer.';
          if (resultMsg === 'tecUNFUNDED_PAYMENT') return 'Insufficient balance to complete transaction.';
          if (resultMsg === 'tecOWNERS') return 'Cannot modify object with existing owners (e.g. disable account with trust lines/offers).';
          if (resultMsg === 'tecOVERSIZE') return 'Transaction is too large.';
          if (resultMsg === 'tecCRYPTOCONDITION_ERROR') return 'Cryptocondition validation failed.';
          if (resultMsg === 'tecEXPIRED') return 'Transaction or object has expired.';
          if (resultMsg === 'tecDUPLICATE') return 'Transaction is duplicate or conflicts with existing one.';
          if (resultMsg === 'tecKILLED') return 'Offer or object was killed (e.g., expired/cancelled).';
          if (resultMsg === 'tecHAS_OBLIGATIONS') return 'Account cannot be deleted — still has obligations (issued tokens).';
          if (resultMsg === 'tecTOO_SOON') return 'Too soon to perform this action (e.g., clawback cooldown).';

          // =============================
          // 🚫 FAILURE (ter*)
          // Retry might succeed
          // =============================
          if (resultMsg === 'terRETRY') return 'Temporary failure. Please retry transaction.';
          if (resultMsg === 'terQUEUED') return 'Transaction queued for future processing.';
          if (resultMsg === 'terPRE_SEQ') return 'Sequence number is too high (future sequence).';
          if (resultMsg === 'terLAST') return 'Transaction is last in queue — retry may help.';

          // =============================
          // 🚫 BAD INPUT (tem*)
          // Malformed transaction
          // =============================
          if (resultMsg === 'temBAD_AMOUNT') return 'Invalid amount specified.';
          if (resultMsg === 'temBAD_CURRENCY') return 'Invalid currency code.';
          if (resultMsg === 'temBAD_EXPIRATION') return 'Invalid expiration time.';
          if (resultMsg === 'temBAD_FEE') return 'Invalid transaction fee.';
          if (resultMsg === 'temBAD_ISSUER') return 'Invalid issuer address.';
          if (resultMsg === 'temBAD_LIMIT') return 'Invalid limit amount.';
          if (resultMsg === 'temBAD_OFFER') return 'Invalid offer.';
          if (resultMsg === 'temBAD_PATH') return 'Invalid payment path.';
          if (resultMsg === 'temBAD_PATH_LOOP') return 'Payment path contains loop.';
          if (resultMsg === 'temBAD_QUANTITY') return 'Invalid quantity.';
          if (resultMsg === 'temBAD_SEND_XRP_LIMIT') return 'XRP send limit exceeded.';
          if (resultMsg === 'temBAD_SEND_XRP_MAX') return 'Maximum XRP send exceeded.';
          if (resultMsg === 'temBAD_SEND_XRP_NO_DIRECT') return 'No direct XRP send allowed.';
          if (resultMsg === 'temBAD_SEND_XRP_PARTIAL') return 'Partial XRP send not allowed.';
          if (resultMsg === 'temBAD_SEND_XRP_SRC_TAG') return 'Source tag not allowed for XRP send.';
          if (resultMsg === 'temBAD_SEQUENCE') return 'Invalid sequence number.';
          if (resultMsg === 'temBAD_SIGNATURE') return 'Invalid signature.';
          if (resultMsg === 'temBAD_SRC_ACCOUNT') return 'Invalid source account.';
          if (resultMsg === 'temBAD_TRANSFER_RATE') return 'Invalid transfer rate.';
          if (resultMsg === 'temDST_IS_SRC') return 'Destination cannot be same as source.';
          if (resultMsg === 'temDST_NEEDED') return 'Destination account required.';
          if (resultMsg === 'temINVALID') return 'Transaction is malformed or invalid.';
          if (resultMsg === 'temINVALID_FLAG') return 'Invalid flag combination.';
          if (resultMsg === 'temREDUNDANT') return 'Redundant transaction (no change).';
          if (resultMsg === 'temRIPPLE_EMPTY') return 'Ripple state is empty.';
          if (resultMsg === 'temDISABLED') return 'Feature is disabled.';
          if (resultMsg === 'temBAD_SIGNER') return 'Invalid signer or quorum.';

          // =============================
          // 🎯 SUCCESS (tes*)
          // =============================
          if (resultMsg === 'tesSUCCESS') return ''; // No error message needed

          // =============================
          // 🧩 UNKNOWN / UNSPECIFIED
          // =============================
          return ` (Code: ${resultMsg})`;
     }

     async handleMultiSignTransaction({ client, wallet, environment, tx, signerAddresses, signerSeeds, fee }: { client: xrpl.Client; wallet: xrpl.Wallet; environment: string; tx: xrpl.Transaction; signerAddresses: string[]; signerSeeds: string[]; fee: string }): Promise<{ signedTx: { tx_blob: string; hash: string } | null; signers: xrpl.Signer[] }> {
          const accountObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '');
          const signerList = accountObjects.result.account_objects.find((obj: any) => obj.LedgerEntryType === 'SignerList');
          if (!signerList) {
               throw new Error('Account does not have a SignerList');
          }

          if (!Array.isArray((signerList as any).SignerEntries)) {
               throw new Error('SignerList object does not have valid SignerEntries');
          }

          if (!('SignerEntries' in signerList) || !Array.isArray((signerList as any).SignerEntries)) {
               throw new Error('SignerList object does not have SignerEntries');
          }
          const validSigners = (signerList as { SignerEntries: any[] }).SignerEntries.map((entry: any) => entry.SignerEntry.Account);
          const quorum = (signerList as any).SignerQuorum;

          let totalWeight = 0;
          signerAddresses.forEach(addr => {
               const signerEntry = (signerList as any).SignerEntries.find((entry: any) => entry.SignerEntry.Account === addr);
               if (signerEntry) {
                    totalWeight += signerEntry.SignerEntry.SignerWeight;
               }
          });

          if (signerAddresses.some(addr => !validSigners.includes(addr))) {
               throw new Error('One or more signer addresses are not in the SignerList');
          }

          console.log('SignerList:', JSON.stringify(signerList, null, 2));
          console.log('Valid Signers:', validSigners);
          console.log('Provided Signers:', signerAddresses);
          console.log('Quorum:', quorum);

          // Adjust fee based on number of signers
          const feeDrops = Number(fee) * (1 + signerAddresses.length);
          tx.Fee = String(feeDrops);
          tx.SigningPubKey = '';

          const preparedTx = await client.autofill({
               ...tx,
               SigningPubKey: '',
          } as xrpl.SubmittableTransaction);

          delete preparedTx.Signers;
          delete preparedTx.TxnSignature;

          console.log('PreparedTx before signing:', JSON.stringify(preparedTx, null, 2));

          const signerBlobs: string[] = [];

          for (let i = 0; i < signerAddresses.length; i++) {
               const signerWallet = await this.getWallet(signerSeeds[i], environment);

               if (signerWallet.classicAddress !== signerAddresses[i]) {
                    throw new Error(`Seed mismatch for signer ${signerAddresses[i]}`);
               }

               const signed = signerWallet.sign(preparedTx, true); // true = multisign
               console.log('Signed Transaction:', JSON.stringify(signed, null, 2));

               if (signed.tx_blob) {
                    signerBlobs.push(signed.tx_blob);
               }
          }

          if (signerBlobs.length === 0) {
               throw new Error('No valid signatures collected for multisign transaction');
          }

          console.log('PreparedTx after signing:', JSON.stringify(preparedTx, null, 2));
          console.log('signerBlobs:', JSON.stringify(signerBlobs, null, 2));

          // Combine all signatures into one final multisigned transaction
          const multisignedTxBlob = xrpl.multisign(signerBlobs);

          console.log('Final multisignedTxBlob:', multisignedTxBlob);

          // Decode the multisigned transaction to get signers
          const decodedMultisigned = xrpl.decode(multisignedTxBlob) as any;
          const signers = decodedMultisigned.Signers || [];

          return { signedTx: { tx_blob: multisignedTxBlob, hash: xrpl.hashes.hashSignedTx(multisignedTxBlob) }, signers };
     }

     findDepositPreauthObjects(accountObjects: xrpl.AccountObjectsResponse) {
          const depositPreauthAccounts: string[] = [];
          if (accountObjects.result && Array.isArray(accountObjects.result.account_objects)) {
               accountObjects.result.account_objects.forEach(obj => {
                    if (obj.LedgerEntryType === 'DepositPreauth' && obj.Authorize) {
                         depositPreauthAccounts.push(obj.Authorize);
                    }
               });
          }
          return depositPreauthAccounts;
     }

     decodeRippleStateFlags(flagValue: any) {
          const TRUSTLINE_FLAGS = {
               lsfAMMNode: 0x01000000, // 16777216
               lsfLowReserve: 0x00020000, // 65536
               lsfHighReserve: 0x00040000, // 131072
               lsfLowAuth: 0x00010000, // 262144
               lsfHighAuth: 0x00020000, // 524288
               lsfLowNoRipple: 0x00100000, // 1048576
               lsfHighNoRipple: 0x00200000, // 2097152
               lsfLowFreeze: 0x00400000, // 4194304
               lsfHighFreeze: 0x00800000, // 8388608
               lsfLowDeepFreeze: 0x02000000, // 33554432
               lsfHighDeepFreeze: 0x04000000, // 67108864
          };

          const results = [];

          for (const [name, bit] of Object.entries(TRUSTLINE_FLAGS)) {
               if ((flagValue & bit) !== 0) {
                    results.push(name);
               }
          }

          return results.length > 0 ? results : ['No Flags Set'];
     }

     getFlagName(value: string): string {
          // 1. Try AppConstants.FLAGS
          const appFlag = AppConstants.FLAGS.find(f => f.value.toString() === value)?.name;
          if (appFlag) {
               return appFlag;
          }

          // 2. Try decodeRippleStateFlags
          const rippleFlags = this.decodeRippleStateFlags(Number(value));
          if (rippleFlags.length > 0) {
               return rippleFlags.join(', ');
          }

          // 3. Fallback: return raw value
          return `${value}`;
     }

     getFlagUpdates(currentFlags: any) {
          const setFlags: any[] = [];
          const clearFlags: any[] = [];

          AppConstants.FLAGS.forEach(flag => {
               const checkbox = document.getElementById(flag.name) as HTMLInputElement;
               if (!checkbox || !flag.xrplName) return;

               const desired = checkbox.checked;
               const actual = !!currentFlags[flag.xrplName];

               if (desired && !actual) setFlags.push(flag.value);
               if (!desired && actual) clearFlags.push(flag.value);
          });

          return { setFlags, clearFlags };
     }

     formatAmount(value: any): string {
          if (typeof value === 'string' && /^\d+$/.test(value)) {
               return (parseInt(value) / 1_000_000).toFixed(6) + ' XRP';
          } else if (typeof value === 'object' && value.currency) {
               return `${value.value} ${value.currency}${value.issuer ? ` (<code>${value.issuer}</code>)` : ''}`;
          }
          return JSON.stringify(value);
     }

     formatValue(key: string, value: any, nestedFields: string[] = []): string {
          if (key === 'Account' || key.includes('PubKey') || key.includes('Signature') || key.includes('index')) {
               return `<code>${value}</code>`;
          }
          if (key === 'Flags') {
               return this.getFlagName(String(value));
          }
          if (typeof value === 'string' && value.length > 50) {
               return `<code>${value.slice(0, 50)}...</code>`;
          }
          if (key === 'Memos') {
               const memoData = value[0].Memo.MemoData;
               const memoType = value[0].Memo.MemoType;
               return this.decodeHex(memoData) + (memoType ? ` (${this.decodeHex(memoType)})` : '');
          }
          if (key === 'Domain' || key === 'EmailHash' || key === 'URI') {
               return this.decodeHex(value);
          }
          if (key === 'Balance' && typeof value === 'object') {
               return `${value.value} ${value.currency}${value.issuer ? ` (<code>${value.issuer}</code>)` : ''}`;
          }
          if (key === 'Balance' || key === 'Fee') {
               return this.formatXRPLAmount(value);
          }
          if (key === 'date' || key === 'CancelAfter' || key === 'FinishAfter' || key === 'Expiration') {
               return this.convertXRPLTime(value);
          }
          if (typeof value === 'object') {
               return this.formatAmount(value);
          }

          return String(value);
     }

     increasesOwnerCount(tx: any): boolean {
          const type = tx.TransactionType;

          switch (type) {
               case 'TrustSet':
                    // Non-zero limit or flags will likely create a trustline
                    const limit = parseFloat(tx?.LimitAmount?.value || '0');
                    const flags = tx?.Flags || 0;
                    return limit !== 0 || flags !== 0;

               case 'OfferCreate':
                    // Offers often create new ledger objects unless fully consumed
                    return true;

               case 'CheckCreate':
               case 'EscrowCreate':
               case 'PaymentChannelCreate':
               case 'TicketCreate':
               case 'SignerListSet':
               case 'AMMDeposit':
               case 'NFTokenMint':
                    return true;

               case 'AccountSet':
                    return false; // AccountSet does not increase owner count

               default:
                    return false;
          }
     }

     decodeAccountFlags(accountInfo: any): string[] {
          const activeFlags: string[] = [];

          if (accountInfo?.result?.account_flags) {
               for (const [flag, enabled] of Object.entries(accountInfo.result.account_flags)) {
                    if (enabled === true) {
                         const match = AppConstants.FLAGS.find(f => f.xrplName === flag);
                         activeFlags.push(match ? match.label : flag); // Use label if found, else raw name
                    }
               }
          }

          return activeFlags;
     }

     formatFlags(flags: string[]): string {
          if (flags.length <= 1) return flags[0] || '';
          return flags.slice(0, -1).join(', ') + ' and ' + flags[flags.length - 1];
     }

     roundToEightDecimals(value: number): number {
          return parseFloat(value.toFixed(8));
     }

     async isInsufficientXrpBalance(client: xrpl.Client, amountXrp: string, address: string, txObject: any, feeDrops: string = '10'): Promise<boolean> {
          try {
               // Validate inputs
               if (!amountXrp || isNaN(parseFloat(amountXrp)) || parseFloat(amountXrp) < 0) {
                    throw new Error('Invalid amount: must be a non-negative number');
               }

               let amountDrops = 0n;

               // Define transaction types that involve sending XRP
               const xrpTransferTypes = new Set([
                    'Payment',
                    'EscrowFinish', // Can deliver XRP
                    'CheckCash', // Can cash XRP checks
                    // Add other transaction types that involve XRP transfers as needed
               ]);

               // Calculate amountDrops only for transactions that involve sending XRP
               if (txObject?.TransactionType && xrpTransferTypes.has(txObject.TransactionType)) {
                    if (txObject?.Amount && typeof txObject.Amount === 'string') {
                         // XRP to XRP
                         amountDrops = BigInt(txObject.Amount);
                    } else if (typeof amountXrp === 'string' && !isNaN(Number(amountXrp))) {
                         amountDrops = BigInt(xrpl.xrpToDrops(amountXrp));
                    }
               } else {
                    amountDrops = 0n; // No XRP transfer for non-payment transactions
               }

               // Get account info to calculate reserves
               const accountInfo = await this.xrplService.getAccountInfo(client, address, 'validated', '');
               // const accountInfo = await this.getAccountInfo(address);
               const balanceDrops = BigInt(accountInfo.result.account_data.Balance);

               // Get server info for reserve requirements
               const serverInfo = await this.xrplService.getXrplServerInfo(client, 'current', '');
               const baseReserveDrops = BigInt(xrpl.xrpToDrops(serverInfo.result.info.validated_ledger?.reserve_base_xrp || 10));
               const incReserveDrops = BigInt(xrpl.xrpToDrops(serverInfo.result.info.validated_ledger?.reserve_inc_xrp || 0.2));
               const ownerCount = BigInt(accountInfo.result.account_data.OwnerCount || 0);

               // Calculate total reserve (base + incremental)
               let totalReserveDrops = baseReserveDrops + ownerCount * incReserveDrops;

               if (txObject && this.increasesOwnerCount(txObject)) {
                    totalReserveDrops += incReserveDrops;
               }

               // Include transaction fee
               const fee = BigInt(feeDrops);

               // Check if balance is sufficient
               const requiredDrops = amountDrops + fee + totalReserveDrops;
               return balanceDrops < requiredDrops; // Return true if insufficient balance
          } catch (error: any) {
               console.error('Error checking XRP balance:', error);
               throw new Error(`Failed to check balance: ${error.message || 'Unknown error'}`);
          }
     }

     renderAccountDetails(accountInfo: any, accountObjects: any) {
          const container = document.getElementById('resultField') as HTMLInputElement;
          if (!container) {
               console.error('Error: #resultField not found');
               return;
          }
          container.classList.remove('error', 'success');
          container.innerHTML = ''; // Clear content

          // Add search bar
          const searchBar = document.createElement('input');
          searchBar.type = 'text';
          searchBar.id = 'resultSearch';
          searchBar.placeholder = 'Search account info...';
          searchBar.className = 'result-search';
          searchBar.style.boxSizing = 'border-box';
          container.appendChild(searchBar);

          // Group account objects by LedgerEntryType while preserving order
          interface AccountObject {
               LedgerEntryType: string;
               [key: string]: any;
          }

          interface ObjectsByTypeGroup {
               type: string;
               objects: (AccountObject & { originalIndex: number })[];
               order: number;
          }

          type ObjectsByType = {
               [type: string]: ObjectsByTypeGroup;
          };

          const objectsByType: ObjectsByType = accountObjects.result.account_objects.reduce((acc: ObjectsByType, obj: AccountObject, idx: number) => {
               const type = obj.LedgerEntryType;
               if (!acc[type]) {
                    acc[type] = { type, objects: [], order: idx };
               }
               acc[type].objects.push({ ...obj, originalIndex: idx });
               return acc;
          }, {});

          // Convert grouped objects to subSections
          const subSections = Object.values(objectsByType)
               .sort((a, b) => {
                    // Prioritize RippleState, then maintain original order
                    if (a.type === 'RippleState' && b.type !== 'RippleState') return -1;
                    if (a.type !== 'RippleState' && b.type === 'RippleState') return 1;
                    return a.order - b.order;
               })
               .map((group: any) => {
                    const typeMap: { [key: string]: string[] } = {
                         RippleState: ['Balance', 'HighLimit', 'LowLimit', 'Flags'],
                         Offer: ['TakerPays', 'TakerGets'],
                         SignerList: ['SignerEntries'],
                         Check: ['Amount', 'DestinationTag', 'SourceTag'],
                         Escrow: ['Amount', 'Condition', 'DestinationTag', 'SourceTag'],
                         PayChannel: ['Amount', 'Balance', 'PublicKey', 'DestinationTag', 'SourceTag'],
                         NFTokenPage: ['NFTokens'],
                         Ticket: [],
                         DepositPreauth: [],
                         AMMBid: ['BidMin', 'BidMax', 'AuthAccounts'],
                         AMM: ['LPTokenBalance', 'TradingFee', 'Asset', 'Asset2'],
                         AMMWithdraw: ['LPTokenBalance', 'TradingFee', 'Asset', 'Asset2'],
                    };
                    const nestedFields = typeMap[group.type as keyof typeof typeMap] || [];

                    interface SubItemContent {
                         key: string;
                         value: string;
                    }

                    interface SubItemSubItem {
                         key: string;
                         content: SubItemContent[];
                    }

                    interface SubItem {
                         id: string;
                         content: SubItemContent[];
                         subItems: SubItemSubItem[];
                    }

                    const subItems: SubItem[] = group.objects.map((obj: Record<string, any>, idx: number): SubItem => {
                         const subItemContent: SubItemContent[] = Object.entries(obj)
                              .filter(([k]) => !nestedFields.includes(k) && k !== 'originalIndex')
                              .map(([key, value]) => ({
                                   key,
                                   value: key.includes('PreviousTxnID') || key.includes('index') || key === 'Account' || key.includes('PublicKey') ? `<code>${value}</code>` : value,
                              }));

                         const subItemSubItems: SubItemSubItem[] = nestedFields
                              .filter((field: string) => obj[field])
                              .map((field: string) => {
                                   let content: SubItemContent[];
                                   if (field === 'SignerEntries') {
                                        content = obj[field].map((entry: any, i: number) => ({
                                             key: `Signer ${i + 1}`,
                                             value: `<code>${entry.SignerEntry.Account}</code> (Weight: ${entry.SignerEntry.SignerWeight})`,
                                        }));
                                   } else if (field === 'NFTokens') {
                                        content = obj[field].map((nft: any, i: number) => ({
                                             key: `NFT ${i + 1}`,
                                             value: `<code>${nft.NFToken.NFTokenID}</code> \nURI: ${this.decodeHex(nft.NFToken.URI)}`,
                                        }));
                                   } else if (field === 'AuthAccounts') {
                                        content = obj[field].map((acc: any, i: number) => ({
                                             key: `Account ${i + 1}`,
                                             value: `<code>${acc.AuthAccount.Account}</code>`,
                                        }));
                                   } else if (typeof obj[field] === 'object') {
                                        content = Object.entries(obj[field]).map(([k, v]) => ({
                                             key: k,
                                             value: this.formatValueForKey(k, v),
                                             // value: k === 'issuer' || k === 'index' || k === 'Account' ? `<code>${String(v)}</code>` : k === 'currency' ? this.decodeIfNeeded(String(v)) : String(v),
                                             // value: k === 'issuer' || k === 'index' || k === 'Account' ? `<code>${String(v)}</code>` : this.decodeIfNeeded(String(v)),
                                        }));
                                   } else if (nestedFields.includes('HighLimit') && field === 'Flags') {
                                        content = [{ key: field, value: this.getFlagName(obj[field]) }];
                                   } else {
                                        content = [{ key: field, value: obj[field] }];
                                   }
                                   return { key: field, content };
                              });

                         return {
                              id: `${group.type} ${idx + 1}`,
                              content: subItemContent,
                              subItems: subItemSubItems,
                         };
                    });

                    return {
                         type: group.type,
                         id: group.type, // e.g., "RippleState"
                         content: [], // No direct content for group
                         subItems,
                    };
               });

          type Section = {
               title: string;
               content: { key: string; value: any }[];
               subSections?: any[];
          };

          const sections: { [key: string]: Section } = {
               account: {
                    title: 'Account Data',
                    content: [
                         { key: 'Account', value: `<code>${accountInfo.result.account_data.Account}</code>` },
                         { key: 'Balance', value: (parseInt(accountInfo.result.account_data.Balance) / 1_000_000).toFixed(6) + ' XRP' },
                         { key: 'My Flags', value: accountInfo.result.account_data.Flags ? this.formatFlags(this.decodeAccountFlags(accountInfo)) : '0' },
                         { key: 'Flags', value: accountInfo.result.account_data.Flags ? flagNames(accountInfo.result.account_data.LedgerEntryType, accountInfo.result.account_data.Flags) : '0' },
                         { key: 'OwnerCount', value: accountInfo.result.account_data.OwnerCount },
                         { key: 'Sequence', value: accountInfo.result.account_data.Sequence },
                         { key: 'Regular Key', value: accountInfo.result.account_data.RegularKey ? `<code>${accountInfo.result.account_data.RegularKey}</code>` : 'Not Set' },
                    ],
               },
               metadata: {
                    title: 'Account Meta Data',
                    content: [
                         { key: 'BurnedNFTokens', value: accountInfo.result.account_data.BurnedNFTokens ? accountInfo.result.account_data.BurnedNFTokens : 'Not Set' },
                         { key: 'MintedNFTokens', value: accountInfo.result.account_data.MintedNFTokens ? accountInfo.result.account_data.MintedNFTokens : 'Not Set' },
                         { key: 'MessageKey', value: accountInfo.result.account_data.MessageKey ? accountInfo.result.account_data.MessageKey : 'Not Set' },
                         {
                              key: 'Domain',
                              value: accountInfo.result.account_data.Domain ? Buffer.from(accountInfo.result.account_data.Domain, 'hex').toString('ascii') : 'Not Set',
                         },
                         { key: 'TickSize', value: accountInfo.result.account_data.TickSize ? accountInfo.result.account_data.TickSize : 'Not Set' },
                         {
                              key: 'TransferRate',
                              value: accountInfo.result.account_data.TransferRate ? ((accountInfo.result.account_data.TransferRate / 1_000_000_000 - 1) * 100).toFixed(6) + '%' : 'Not Set',
                         },
                         // { key: 'TransferRate', value: (accountInfo.result.account_data.TransferRate / 1_000_000_000).toFixed(9) },
                         { key: 'FirstNFTokenSequence', value: accountInfo.result.account_data.FirstNFTokenSequence ? accountInfo.result.account_data.FirstNFTokenSequence : 'Not Set' },
                    ],
               },
               flags: {
                    title: 'Flag Details',
                    content: Object.entries(accountInfo.result.account_flags).map(([key, value]) => ({
                         key,
                         value: value ? '<span class="flag-true">True</span>' : 'False',
                    })),
               },
               objects: {
                    title: 'Account Objects',
                    content: [],
                    subSections,
               },
          };

          // Render sections
          for (const section of Object.values(sections)) {
               if (section.content.length || section.subSections?.length) {
                    const details = document.createElement('details');
                    details.className = 'result-section';
                    if (section.title === 'Account Data') {
                         details.setAttribute('open', 'open');
                    }
                    const summary = document.createElement('summary');
                    summary.textContent = section.title;
                    details.appendChild(summary);

                    if (section.content.length) {
                         const table = document.createElement('div');
                         table.className = 'result-table';
                         const header = document.createElement('div');
                         header.className = 'result-row result-header';
                         header.innerHTML = `
                          <div class="result-cell key">Key</div>
                          <div class="result-cell value">Value</div>
                      `;
                         table.appendChild(header);

                         for (const item of section.content) {
                              const row = document.createElement('div');
                              row.className = 'result-row';
                              row.innerHTML = `
                              <div class="result-cell key">${item.key}</div>
                              <div class="result-cell value">${item.value}</div>
                          `;
                              table.appendChild(row);
                         }
                         details.appendChild(table);
                    }

                    if (section.subSections) {
                         for (const group of section.subSections) {
                              const groupDetails = document.createElement('details');
                              groupDetails.className = 'object-group'; // New class for groups
                              const groupSummary = document.createElement('summary');
                              groupSummary.textContent = group.id;
                              groupDetails.appendChild(groupSummary);

                              if (group.content.length) {
                                   const groupTable = document.createElement('div');
                                   groupTable.className = 'result-table';
                                   const groupHeader = document.createElement('div');
                                   groupHeader.className = 'result-row result-header';
                                   groupHeader.innerHTML = `
                                  <div class="result-cell key">Key</div>
                                  <div class="result-cell value">Value</div>
                              `;
                                   groupTable.appendChild(groupHeader);

                                   for (const item of group.content) {
                                        const row = document.createElement('div');
                                        row.className = 'result-row';
                                        row.innerHTML = `
                                      <div class="result-cell key">${item.key}</div>
                                      <div class="result-cell value">${item.value}</div>
                                  `;
                                        groupTable.appendChild(row);
                                   }
                                   groupDetails.appendChild(groupTable);
                              }

                              for (const subItem of group.subItems) {
                                   const objDetails = document.createElement('details');
                                   objDetails.className = 'nested-object';
                                   const objSummary = document.createElement('summary');
                                   objSummary.textContent = subItem.id;
                                   objDetails.appendChild(objSummary);

                                   if (subItem.content.length) {
                                        const objTable = document.createElement('div');
                                        objTable.className = 'result-table';
                                        const objHeader = document.createElement('div');
                                        objHeader.className = 'result-row result-header';
                                        objHeader.innerHTML = `
                                      <div class="result-cell key">Key</div>
                                      <div class="result-cell value">Value</div>
                                  `;
                                        objTable.appendChild(objHeader);

                                        for (const item of subItem.content) {
                                             const row = document.createElement('div');
                                             row.className = 'result-row';
                                             row.innerHTML = `
                                          <div class="result-cell key">${item.key}</div>
                                          <div class="result-cell value">${item.value}</div>
                                      `;
                                             objTable.appendChild(row);
                                        }
                                        objDetails.appendChild(objTable);
                                   }

                                   for (const nestedItem of subItem.subItems) {
                                        const nestedDetails = document.createElement('details');
                                        nestedDetails.className = 'nested-object';
                                        const nestedSummary = document.createElement('summary');
                                        nestedSummary.textContent = nestedItem.key;
                                        nestedDetails.appendChild(nestedSummary);

                                        const nestedTable = document.createElement('div');
                                        nestedTable.className = 'result-table';
                                        const nestedHeader = document.createElement('div');
                                        nestedHeader.className = 'result-row result-header';
                                        nestedHeader.innerHTML = `
                                      <div class="result-cell key">Key</div>
                                      <div class="result-cell value">Value</div>
                                  `;
                                        nestedTable.appendChild(nestedHeader);

                                        for (const nestedContent of nestedItem.content) {
                                             const nestedRow = document.createElement('div');
                                             nestedRow.className = 'result-row';
                                             nestedRow.innerHTML = `
                                          <div class="result-cell key">${nestedContent.key}</div>
                                          <div class="result-cell value">${nestedContent.value}</div>
                                      `;
                                             nestedTable.appendChild(nestedRow);
                                        }
                                        nestedDetails.appendChild(nestedTable);
                                        objDetails.appendChild(nestedDetails);
                                   }

                                   groupDetails.appendChild(objDetails);
                              }

                              details.appendChild(groupDetails);
                         }
                    }
                    container.appendChild(details);
               }
               container.classList.add('success');
          }

          // Add toggle event listeners and persist state
          document.querySelectorAll('.result-section, .object-group, .nested-object').forEach(details => {
               const summary = details.querySelector('summary');
               if (summary) {
                    const title = summary.textContent;
                    const savedState = localStorage.getItem(`collapse_${title}`);
                    if (savedState === 'closed') details.removeAttribute('open');
                    else if (
                         savedState === 'open' ||
                         title === 'Account Data' ||
                         title === 'RippleState' // Open RippleState group by default
                    ) {
                         details.setAttribute('open', 'open');
                    }
                    details.addEventListener('toggle', () => {
                         localStorage.setItem(`collapse_${title}`, (details as HTMLDetailsElement).open ? 'open' : 'closed');
                         container.offsetHeight;
                         container.style.height = 'auto';
                    });
               }
          });

          // Search functionality
          searchBar.addEventListener('input', e => {
               const target = e.target as HTMLInputElement | null;
               const search = target ? target.value.toLowerCase().trim() : '';
               const sections = document.querySelectorAll('.result-section');

               if (!search) {
                    sections.forEach(section => {
                         (section as HTMLElement).style.display = '';
                         section.querySelectorAll('.result-row').forEach(row => ((row as HTMLElement).style.display = 'flex'));
                         section.querySelectorAll('.object-group, .nested-object').forEach(nested => {
                              (nested as HTMLElement).style.display = '';
                              nested.querySelectorAll('.result-row').forEach(row => ((row as HTMLElement).style.display = 'flex'));
                         });
                         const summaryElement = section.querySelector('summary');
                         const title = summaryElement ? summaryElement.textContent : '';
                         if (title === 'Account Data') {
                              section.setAttribute('open', 'open');
                         } else {
                              section.removeAttribute('open');
                         }
                    });
                    return;
               }

               sections.forEach(section => {
                    let hasVisibleContent = false;
                    const directRows = section.querySelectorAll(':scope > .result-table > .result-row:not(.result-header)');
                    directRows.forEach(row => {
                         const keyCell = row.querySelector('.key');
                         const valueCell = row.querySelector('.value');
                         const keyText = keyCell ? this.stripHTMLForSearch(keyCell.innerHTML).toLowerCase() : '';
                         const valueText = valueCell ? this.stripHTMLForSearch(valueCell.innerHTML).toLowerCase() : '';
                         const isMatch = keyText.includes(search) || valueText.includes(search);
                         (row as HTMLElement).style.display = isMatch ? 'flex' : 'none';
                         if (isMatch) hasVisibleContent = true;
                    });

                    const groupDetails = section.querySelectorAll('.object-group');
                    groupDetails.forEach(group => {
                         let groupHasVisibleContent = false;
                         const nestedDetails = group.querySelectorAll('.nested-object');
                         nestedDetails.forEach(nested => {
                              let nestedHasVisibleContent = false;
                              const tableRows = nested.querySelectorAll('.result-table > .result-row:not(.result-header)');
                              tableRows.forEach(row => {
                                   const keyCell = row.querySelector('.key');
                                   const valueCell = row.querySelector('.value');
                                   const keyText = keyCell ? this.stripHTMLForSearch(keyCell.innerHTML).toLowerCase() : '';
                                   const valueText = valueCell ? this.stripHTMLForSearch(valueCell.innerHTML).toLowerCase() : '';
                                   const isMatch = keyText.includes(search) || valueText.includes(search);
                                   (row as HTMLElement).style.display = isMatch ? 'flex' : 'none';
                                   if (isMatch) nestedHasVisibleContent = true;
                              });

                              const deeperDetails = nested.querySelectorAll('.nested-object');
                              deeperDetails.forEach(deeper => {
                                   let deeperHasVisibleContent = false;
                                   const deeperRows = deeper.querySelectorAll('.result-table > .result-row:not(.result-header)');
                                   deeperRows.forEach(row => {
                                        const keyCell = row.querySelector('.key');
                                        const valueCell = row.querySelector('.value');
                                        const keyText = keyCell ? this.stripHTMLForSearch(keyCell.innerHTML).toLowerCase() : '';
                                        const valueText = valueCell ? this.stripHTMLForSearch(valueCell.innerHTML).toLowerCase() : '';
                                        const isMatch = keyText.includes(search) || valueText.includes(search);
                                        (row as HTMLElement).style.display = isMatch ? 'flex' : 'none';
                                        if (isMatch) deeperHasVisibleContent = true;
                                   });
                                   (deeper as HTMLElement).style.display = deeperHasVisibleContent ? '' : 'none';
                                   if (deeperHasVisibleContent) nestedHasVisibleContent = true;
                              });

                              (nested as HTMLElement).style.display = nestedHasVisibleContent ? '' : 'none';
                              if (nestedHasVisibleContent) groupHasVisibleContent = true;
                         });

                         (group as HTMLElement).style.display = groupHasVisibleContent ? '' : 'none';
                         if (groupHasVisibleContent) hasVisibleContent = true;
                    });

                    (section as HTMLElement).style.display = hasVisibleContent ? '' : 'none';
                    if (hasVisibleContent) section.setAttribute('open', 'open');
               });
          });
     }

     renderSimulatedTransactionsResults(transactions: { type: string; result: any } | { type: string; result: any }[], container: HTMLElement): void {
          const txArray = Array.isArray(transactions) ? transactions : [transactions];
          if (!container) {
               console.error('Error: container not found');
               return;
          }
          container.classList.remove('error', 'success');
          // container.innerHTML = ''; // Clear content

          if (txArray[0].result.clearInnerHtml === undefined || txArray[0].result.clearInnerHtml) {
               container.innerHTML = ''; // Clear content
          }

          container.innerHTML = `<div class="simulate-banner">You are in SIMULATION MODE — No real transaction was performed</div>`;
          if (txArray[0].result.errorMessage !== undefined && txArray[0].result.errorMessage !== null && txArray[0].result.errorMessage !== '') {
               container.innerHTML += `<div class="simulate-banner-error">${txArray[0].result.engine_result_message}</div>`;
          }
          container.classList.add('simulate-mode');

          // Add search bar (if not already present)
          let searchBar = container.querySelector('#resultSearch') as HTMLInputElement;
          if (!searchBar) {
               searchBar = document.createElement('input');
               searchBar.type = 'text';
               searchBar.id = 'resultSearch';
               searchBar.placeholder = 'Search transactions...';
               searchBar.className = 'result-search';
               searchBar.style.boxSizing = 'border-box';
               searchBar.setAttribute('aria-label', 'Search displayed transactions by type, hash, or other fields');
               container.appendChild(searchBar);
          }

          // Define nested fields for transactions
          const nestedFields = {
               Payment: ['Amount', 'DeliverMax', 'DestinationTag', 'SourceTag', 'InvoiceID', 'PreviousFields', 'Balance', 'Sequence'],
               OfferCancel: ['OfferSequence'],
               OfferCreate: ['TakerGets', 'TakerPays'],
               TrustSet: ['LimitAmount'],
               AccountSet: ['ClearFlag', 'SetFlag', 'Domain', 'EmailHash', 'MessageKey', 'TransferRate', 'TickSize'],
               AccountDelete: [],
               SetRegularKey: ['RegularKey'],
               SignerListSet: ['SignerEntries'],
               EscrowCreate: ['Amount', 'Condition', 'DestinationTag', 'SourceTag'],
               EscrowFinish: ['Condition', 'Fulfillment'],
               EscrowCancel: [],
               PaymentChannelCreate: ['Amount', 'DestinationTag', 'SourceTag', 'PublicKey'],
               PaymentChannelFund: ['Amount'],
               PaymentChannelClaim: ['Balance', 'Amount', 'Signature', 'PublicKey'],
               CheckCreate: ['Amount', 'DestinationTag', 'SourceTag', 'InvoiceID'],
               CheckCash: ['Amount', 'DeliverMin'],
               CheckCancel: [],
               DepositPreauth: ['Authorize', 'Unauthorize'],
               TicketCreate: [],
               NFTokenMint: ['NFTokenTaxon', 'Issuer', 'TransferFee', 'URI'],
               NFTokenBurn: [],
               NFTokenCreateOffer: ['Amount', 'Destination'],
               NFTokenCancelOffer: ['NFTokenOffers'],
               NFTokenAcceptOffer: [],
               AMMCreate: ['Amount', 'Amount2', 'TradingFee'],
               AMMFund: ['Amount', 'Amount2'],
               AMMBid: ['BidMin', 'BidMax', 'AuthAccounts'],
               AMMWithdraw: ['Amount', 'Amount2', 'LPTokenIn'],
               AMMVote: [],
               AMMDelete: [],
               MPTokenIssuanceCreate: ['AssetScale', 'Fee', 'Flags', 'MaximumAmount', 'TransferFee'],
               EnableAmendment: [],
               SetFee: [],
               UNLModify: [],
               Clawback: ['Amount'],
               XChainBridge: ['MinAccountCreateAmount', 'SignatureReward'],
               XChainCreateClaimId: [],
               XChainCommit: ['Amount', 'OtherChainDestination'],
               XChainClaim: [],
               XChainAccountCreateCommit: ['Amount', 'SignatureReward'],
               XChainAddAccountCreateAttestation: [],
               XChainAddClaimAttestation: [],
               XChainCreateBridge: ['MinAccountCreateAmount', 'SignatureReward'],
               XChainModifyBridge: ['MinAccountCreateAmount', 'SignatureReward'],
               DIDSet: ['Data', 'URI', 'Attestation'],
               DIDDelete: [],
               RawTransaction: ['Account', 'Fee', 'Flags'],
          };

          if (txArray.length === 0) {
               container.innerHTML += 'No transactions to display.';
               return;
          }

          // Create Transactions section
          const details = document.createElement('details');
          details.className = 'result-section';
          details.setAttribute('open', 'open');
          const summary = document.createElement('summary');
          summary.textContent = txArray.length === 1 && txArray[0].result?.tx_json?.TransactionType ? 'Transactions' : 'Transactions';
          details.appendChild(summary);

          // Render each transaction
          txArray.forEach((tx, index) => {
               const result = tx.result || {};
               const txType = result.tx_json?.TransactionType || 'Unknown';
               const isSuccess = result.engine_result === 'tesSUCCESS';

               const txDetails = document.createElement('details');
               txDetails.className = `nested-object${isSuccess ? '' : ' error-transaction'}`;
               const txSummary = document.createElement('summary');
               txSummary.textContent = `${txType} ${index + 1}${isSuccess ? '' : ' (Failed)'}${tx.result.OfferSequence ? ` (Sequence: ${tx.result.OfferSequence})` : ''}`;
               txDetails.appendChild(txSummary);

               if (result.error) {
                    const errorMessage = document.createElement('div');
                    errorMessage.className = 'error-message';
                    errorMessage.textContent = `Error: ${result.error}`;
                    txDetails.appendChild(errorMessage);
               } else if (!isSuccess && result.meta?.TransactionResult) {
                    const errorMessage = document.createElement('div');
                    errorMessage.className = 'error-message';
                    errorMessage.textContent = `Error: Transaction failed with result ${result.meta.TransactionResult}`;
                    txDetails.appendChild(errorMessage);
               }

               // Transaction Details Table
               const txTable = document.createElement('div');
               txTable.className = 'result-table';
               const txHeader = document.createElement('div');
               txHeader.className = 'result-row result-header';
               txHeader.innerHTML = `
              <div class="result-cell key">Key</div>
              <div class="result-cell value">Value</div>
            `;
               txTable.appendChild(txHeader);

               const txContent = [
                    { key: 'Transaction Type', value: txType },
                    { key: 'Accepted', value: result.accepted ? `${result.accepted}` : 'N/A' },
                    { key: 'Account Sequence Available', value: result.account_sequence_available ? `${result.account_sequence_available}` : 'N/A' },
                    { key: 'Account Sequence Next', value: result.account_sequence_next ? `${result.account_sequence_next}` : 'N/A' },
                    { key: 'Applied', value: result.applied ? `${Boolean(result.applied)}` : 'False' },
                    { key: 'Broadcast', value: result.broadcast ? `${result.broadcast}` : 'N/A' },
                    { key: 'Engine Result', value: result.engine_result ? `${result.engine_result}` : 'N/A' },
                    { key: 'Engine Result Code', value: result.engine_result_code ? `${result.engine_result_code}` : '0' },
                    { key: 'Engine Result Message', value: result.engine_result_message ? `${result.engine_result_message}` : 'N/A' },
                    { key: 'Kept', value: result.kept ? `${result.kept}` : 'N/A' },
                    { key: 'Open Ledger Cost', value: result.open_ledger_cost ? `${result.open_ledger_cost}` : 'N/A' },
                    { key: 'Queued', value: result.queued ? `${result.queued}` : 'False' },
                    { key: 'Tx Blob', value: result.tx_blob ? `${result.tx_blob}` : 'N/A' },
               ];

               txContent.forEach(item => {
                    const row = document.createElement('div');
                    row.className = 'result-row';
                    row.innerHTML = `
                <div class="result-cell key">${item.key}</div>
                <div class="result-cell value">${item.value}</div>
              `;
                    txTable.appendChild(row);
               });

               // Transaction Data Table
               const txDataContent = result.tx_json
                    ? Object.entries(result.tx_json)
                           .filter(([key]) => key !== 'TransactionType')
                           .map(([key, value]) => ({ key, value: this.formatValue(key, value, nestedFields[txType as keyof typeof nestedFields] || []) }))
                    : [];

               const txDataTable = document.createElement('div');
               txDataTable.className = 'result-table';
               const txDataHeader = document.createElement('div');
               txDataHeader.className = 'result-row result-header';
               txDataHeader.innerHTML = `
              <div class="result-cell key">Key</div>
              <div class="result-cell value">Value</div>
            `;
               txDataTable.appendChild(txDataHeader);

               txDataContent.forEach(item => {
                    const row = document.createElement('div');
                    row.className = 'result-row';

                    let displayValue: string;
                    if (typeof item.value === 'object' && item.value !== null) {
                         if (item.key === 'LimitAmount' && typeof item.value === 'object') {
                              const currency = (item.value as { currency: string }).currency;
                              const value = (item.value as { value: string }).value;
                              const issuer = (item.value as { issuer: string }).issuer;
                              displayValue = `${currency} ${value} (issuer: <code>${issuer}</code>)`;
                         } else {
                              displayValue = JSON.stringify(item.value, null, 2).replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
                         }
                    } else {
                         displayValue = String(item.value);
                         if (item.key === 'Account' || item.key === 'OfferSequence' || item.key === 'SigningPubKey' || item.key === 'TxnSignature' || item.key === 'ctid') {
                              displayValue = `<code>${displayValue}</code>`;
                         }
                         if ((item.key == 'Asset' || item.key == 'Asset2') && item.value.includes('undefined')) {
                              displayValue = item.value.split(' ')[1];
                         }
                    }

                    row.innerHTML = `
                      <div class="result-cell key">${item.key}</div>
                      <div class="result-cell value">${displayValue}</div>
                    `;
                    txDataTable.appendChild(row);
               });

               const txDataDetails = document.createElement('details');
               txDataDetails.className = 'nested-object';
               const txDataSummary = document.createElement('summary');
               txDataSummary.textContent = 'Transaction Data';
               txDataDetails.appendChild(txDataSummary);
               txDataDetails.appendChild(txDataTable);

               //      // Meta Data Table
               //      const metaContent = result.meta
               //           ? [
               //                  { key: 'Transaction Index', value: result.meta.TransactionIndex || 'N/A' },
               //                  { key: 'Transaction Result', value: result.meta.TransactionResult || 'N/A' },
               //                  { key: 'Delivered Amount', value: result.meta.delivered_amount ? this.formatAmount(result.meta.delivered_amount) : 'N/A' },
               //             ]
               //           : [];

               //      const metaTable = document.createElement('div');
               //      metaTable.className = 'result-table';
               //      const metaHeader = document.createElement('div');
               //      metaHeader.className = 'result-row result-header';
               //      metaHeader.innerHTML = `
               //     <div class="result-cell key">Key</div>
               //     <div class="result-cell value">Value</div>
               //   `;
               //      metaTable.appendChild(metaHeader);

               //      metaContent.forEach(item => {
               //           const row = document.createElement('div');
               //           row.className = 'result-row';
               //           row.innerHTML = `
               //       <div class="result-cell key">${item.key}</div>
               //       <div class="result-cell value">${item.value}</div>
               //     `;
               //           metaTable.appendChild(row);
               //      });

               // const metaDetails = document.createElement('details');
               // metaDetails.className = 'nested-object';
               // const metaSummary = document.createElement('summary');
               // metaSummary.textContent = 'Meta Data';
               // metaDetails.appendChild(metaSummary);
               // metaDetails.appendChild(metaTable);

               // // Affected Nodes
               // const affectedNodesContent = result.meta?.AffectedNodes
               //      ? result.meta.AffectedNodes.map((node: any, nodeIndex: number) => {
               //             const nodeType = Object.keys(node)[0];
               //             const entry = node[nodeType] || {};
               //             return {
               //                  key: `${nodeType} ${nodeIndex + 1}`,
               //                  content: [
               //                       { key: 'Ledger Entry Type', value: entry.LedgerEntryType || 'N/A' },
               //                       { key: 'Ledger Index', value: entry.LedgerIndex ? `<code>${entry.LedgerIndex}</code>` : 'N/A' },
               //                       ...(entry.PreviousTxnID ? [{ key: 'Previous Txn ID', value: `<code>${entry.PreviousTxnID}</code>` }] : []),
               //                       ...(entry.PreviousTxnLgrSeq ? [{ key: 'Previous Txn Lgr Seq', value: entry.PreviousTxnLgrSeq }] : []),
               //                       ...Object.entries(entry.FinalFields || {}).map(([k, v]) => ({
               //                            key: k,
               //                            value: this.formatValue(k, v),
               //                       })),
               //                       ...Object.entries(entry.NewFields || {}).map(([k, v]) => ({
               //                            key: k,
               //                            value: this.formatValue(k, v),
               //                       })),
               //                       ...(entry.PreviousFields
               //                            ? [
               //                                   {
               //                                        key: 'Previous Fields',
               //                                        content: Object.entries(entry.PreviousFields).map(([k, v]) => ({
               //                                             key: k,
               //                                             value: this.formatValue(k, v),
               //                                        })),
               //                                   },
               //                              ]
               //                            : []),
               //                  ],
               //             };
               //        })
               //      : [];

               //                const affectedNodesDetails = document.createElement('details');
               //                affectedNodesDetails.className = 'nested-object';
               //                const affectedNodesSummary = document.createElement('summary');
               //                affectedNodesSummary.textContent = 'Affected Nodes';
               //                affectedNodesDetails.appendChild(affectedNodesSummary);

               //                affectedNodesContent.forEach((node: { key: string; content: any[] }) => {
               //                     const nodeDetails = document.createElement('details');
               //                     nodeDetails.className = 'nested-object';
               //                     const nodeSummary = document.createElement('summary');
               //                     nodeSummary.textContent = node.key;
               //                     nodeDetails.appendChild(nodeSummary);

               //                     const nodeTable = document.createElement('div');
               //                     nodeTable.className = 'result-table';
               //                     const nodeHeader = document.createElement('div');
               //                     nodeHeader.className = 'result-row result-header';
               //                     nodeHeader.innerHTML = `
               //         <div class="result-cell key">Key</div>
               //         <div class="result-cell value">Value</div>
               //     `;
               //                     nodeTable.appendChild(nodeHeader);

               //                     node.content.forEach(item => {
               //                          const row = document.createElement('div');
               //                          row.className = 'result-row';

               //                          if (item.content) {
               //                               // Keep proper key + value structure
               //                               row.innerHTML = `<div class="result-cell key">${item.key}</div>`;

               //                               const valueCell = document.createElement('div');
               //                               valueCell.className = 'result-cell value';

               //                               const nestedDetails = document.createElement('details');
               //                               nestedDetails.className = 'nested-object';

               //                               const nestedSummary = document.createElement('summary');
               //                               nestedSummary.textContent = item.key;
               //                               nestedDetails.appendChild(nestedSummary);

               //                               const nestedTable = document.createElement('div');
               //                               nestedTable.className = 'result-table';
               //                               const nestedHeader = document.createElement('div');
               //                               nestedHeader.className = 'result-row result-header';
               //                               nestedHeader.innerHTML = `
               //         <div class="result-cell key">Key</div>
               //         <div class="result-cell value">Value</div>
               //     `;
               //                               nestedTable.appendChild(nestedHeader);

               //                               item.content.forEach((nestedItem: { key: string; value?: string }) => {
               //                                    const nestedRow = document.createElement('div');
               //                                    nestedRow.className = 'result-row';
               //                                    nestedRow.innerHTML = `
               //             <div class="result-cell key">${nestedItem.key}</div>
               //             <div class="result-cell value">${nestedItem.value || ''}</div>
               //         `;
               //                                    nestedTable.appendChild(nestedRow);
               //                               });

               //                               nestedDetails.appendChild(nestedTable);
               //                               valueCell.appendChild(nestedDetails);
               //                               row.appendChild(valueCell);
               //                          } else {
               //                               // Normal key-value row
               //                               row.innerHTML = `
               //                 <div class="result-cell key">${item.key}</div>
               //                 <div class="result-cell value">${item.value || ''}</div>
               //             `;
               //                          }

               //                          nodeTable.appendChild(row);
               //                     });

               //                     nodeDetails.appendChild(nodeTable);
               //                     affectedNodesDetails.appendChild(nodeDetails);
               //                });

               txDetails.appendChild(txTable);
               txDetails.appendChild(txDataDetails);
               // txDetails.appendChild(metaDetails);
               // txDetails.appendChild(affectedNodesDetails);
               details.appendChild(txDetails);
          });

          container.appendChild(details);

          document.querySelectorAll('.result-section, .nested-object').forEach(details => {
               const summary = details.querySelector('summary');
               if (summary) {
                    const title = summary.textContent;
                    const savedState = localStorage.getItem(`collapse_${title}`);
                    if (savedState === 'closed') details.removeAttribute('open');
                    else if (savedState === 'open' || title === 'Account Data' || title === 'RippleState') {
                         details.setAttribute('open', 'open');
                    }
                    details.addEventListener('toggle', () => {
                         localStorage.setItem(`collapse_${title}`, (details as HTMLDetailsElement).open ? 'open' : 'closed');
                         container.offsetHeight;
                         container.style.height = 'auto';
                    });
               }
          });

          // Updated search functionality
          searchBar.addEventListener('input', e => {
               const target = e.target as HTMLInputElement | null;
               const search = target ? target.value.toLowerCase().trim() : '';
               console.debug('Search query:', search);
               const sections = document.querySelectorAll('.result-section');

               if (!search) {
                    sections.forEach(section => {
                         (section as HTMLElement).style.display = '';
                         section.querySelectorAll('.result-row').forEach(row => ((row as HTMLElement).style.display = 'flex'));
                         section.querySelectorAll('.nested-object').forEach(nested => {
                              (nested as HTMLElement).style.display = '';
                              nested.querySelectorAll('.result-row').forEach(row => ((row as HTMLElement).style.display = 'flex'));
                         });
                         const summaryElement = section.querySelector('summary');
                         const title = summaryElement ? summaryElement.textContent : '';
                         if (title === 'Account Data' || (title && title.includes('Trust Lines'))) {
                              section.setAttribute('open', 'open');
                         } else {
                              section.removeAttribute('open');
                         }
                    });
                    return;
               }

               sections.forEach(section => {
                    let hasVisibleContent = false;

                    // Skip directRows since there are none in this case
                    const nestedDetails = section.querySelectorAll('.nested-object');
                    nestedDetails.forEach(nested => {
                         let nestedHasVisibleContent = false;
                         const tableRows = nested.querySelectorAll('.result-table > .result-row:not(.result-header)');
                         tableRows.forEach(row => {
                              const keyCell = row.querySelector('.key');
                              const valueCell = row.querySelector('.value');
                              const keyText = keyCell ? this.stripHTMLForSearch(keyCell.innerHTML) : '';
                              const valueText = valueCell ? this.stripHTMLForSearch(valueCell.innerHTML) : '';
                              console.debug('Row content:', { keyText, valueText, search });
                              const isMatch = keyText.includes(search) || valueText.includes(search);
                              (row as HTMLElement).style.display = isMatch ? 'flex' : 'none';
                              if (isMatch) {
                                   nestedHasVisibleContent = true;
                                   console.debug('Match found:', { keyText, valueText, search });
                              }
                         });
                         (nested as HTMLElement).style.display = nestedHasVisibleContent ? '' : 'none';
                         if (nestedHasVisibleContent) hasVisibleContent = true;
                    });

                    (section as HTMLElement).style.display = hasVisibleContent ? '' : 'none';
                    if (hasVisibleContent) section.setAttribute('open', 'open');
               });
          });
     }

     renderTransactionsResults(transactions: { type: string; result: any } | { type: string; result: any }[], container: HTMLElement): void {
          const txArray = Array.isArray(transactions) ? transactions : [transactions];
          if (!container) {
               console.error('Error: container not found');
               return;
          }
          container.classList.remove('error', 'success');
          // container.innerHTML = ''; // Clear content

          if (txArray[0].result.clearInnerHtml === undefined || txArray[0].result.clearInnerHtml) {
               container.innerHTML = ''; // Clear content
          }

          if (txArray[0].result.errorMessage !== undefined && txArray[0].result.errorMessage !== null && txArray[0].result.errorMessage !== '') {
               container.innerHTML += `<div class="simulate-banner-error">${txArray[0].result.errorMessage}</div>`;
          }

          // Add search bar (if not already present)
          let searchBar = container.querySelector('#resultSearch') as HTMLInputElement;
          if (!searchBar) {
               searchBar = document.createElement('input');
               searchBar.type = 'text';
               searchBar.id = 'resultSearch';
               searchBar.placeholder = 'Search transactions...';
               searchBar.className = 'result-search';
               searchBar.style.boxSizing = 'border-box';
               searchBar.setAttribute('aria-label', 'Search displayed transactions by type, hash, or other fields');
               container.appendChild(searchBar);
          }

          // Define nested fields for transactions
          const nestedFields = {
               Payment: ['Amount', 'DeliverMax', 'DestinationTag', 'SourceTag', 'InvoiceID', 'PreviousFields', 'Balance', 'Sequence'],
               OfferCancel: ['OfferSequence'],
               OfferCreate: ['TakerGets', 'TakerPays'],
               TrustSet: ['LimitAmount'],
               AccountSet: ['ClearFlag', 'SetFlag', 'Domain', 'EmailHash', 'MessageKey', 'TransferRate', 'TickSize'],
               AccountDelete: [],
               SetRegularKey: ['RegularKey'],
               SignerListSet: ['SignerEntries'],
               EscrowCreate: ['Amount', 'Condition', 'DestinationTag', 'SourceTag'],
               EscrowFinish: ['Condition', 'Fulfillment'],
               EscrowCancel: [],
               PaymentChannelCreate: ['Amount', 'DestinationTag', 'SourceTag', 'PublicKey'],
               PaymentChannelFund: ['Amount'],
               PaymentChannelClaim: ['Balance', 'Amount', 'Signature', 'PublicKey'],
               CheckCreate: ['Amount', 'DestinationTag', 'SourceTag', 'InvoiceID'],
               CheckCash: ['Amount', 'DeliverMin'],
               CheckCancel: [],
               DepositPreauth: ['Authorize', 'Unauthorize'],
               TicketCreate: [],
               NFTokenMint: ['NFTokenTaxon', 'Issuer', 'TransferFee', 'URI'],
               NFTokenBurn: [],
               NFTokenCreateOffer: ['Amount', 'Destination'],
               NFTokenCancelOffer: ['NFTokenOffers'],
               NFTokenAcceptOffer: [],
               AMMCreate: ['Amount', 'Amount2', 'TradingFee'],
               AMMFund: ['Amount', 'Amount2'],
               AMMBid: ['BidMin', 'BidMax', 'AuthAccounts'],
               AMMWithdraw: ['Amount', 'Amount2', 'LPTokenIn'],
               AMMVote: [],
               AMMDelete: [],
               MPTokenIssuanceCreate: ['AssetScale', 'Fee', 'Flags', 'MaximumAmount', 'TransferFee'],
               EnableAmendment: [],
               SetFee: [],
               UNLModify: [],
               Clawback: ['Amount'],
               XChainBridge: ['MinAccountCreateAmount', 'SignatureReward'],
               XChainCreateClaimId: [],
               XChainCommit: ['Amount', 'OtherChainDestination'],
               XChainClaim: [],
               XChainAccountCreateCommit: ['Amount', 'SignatureReward'],
               XChainAddAccountCreateAttestation: [],
               XChainAddClaimAttestation: [],
               XChainCreateBridge: ['MinAccountCreateAmount', 'SignatureReward'],
               XChainModifyBridge: ['MinAccountCreateAmount', 'SignatureReward'],
               DIDSet: ['Data', 'URI', 'Attestation'],
               DIDDelete: [],
               RawTransaction: ['Account', 'Fee', 'Flags'],
          };

          if (txArray.length === 0) {
               container.innerHTML += 'No transactions to display.';
               return;
          }

          // Create Transactions section
          const details = document.createElement('details');
          details.className = 'result-section';
          details.setAttribute('open', 'open');
          const summary = document.createElement('summary');
          // summary.textContent = txArray.length === 1 && txArray[0].result?.tx_json?.TransactionType ? txArray[0].result.tx_json.TransactionType : 'Transactions';
          summary.textContent = txArray.length === 1 && txArray[0].result?.tx_json?.TransactionType ? 'Transactions' : 'Transactions';
          details.appendChild(summary);

          // Render each transaction
          txArray.forEach((tx, index) => {
               const result = tx.result || {};
               const txType = result.tx_json?.TransactionType || 'Unknown';
               const isSuccess = result.meta?.TransactionResult === 'tesSUCCESS';

               const txDetails = document.createElement('details');
               txDetails.className = `nested-object${isSuccess ? '' : ' error-transaction'}`;
               const txSummary = document.createElement('summary');
               // txSummary.textContent = `${tx.result.tx_json.TransactionType} ${isSuccess ? '' : ' (Failed)'}`; // Indicate failure in summary
               txSummary.textContent = `${txType} ${index + 1}${isSuccess ? '' : ' (Failed)'}${tx.result.OfferSequence ? ` (Sequence: ${tx.result.OfferSequence})` : ''}`; // Include sequence
               txDetails.appendChild(txSummary);

               if (result.error) {
                    const errorMessage = document.createElement('div');
                    errorMessage.className = 'error-message';
                    errorMessage.textContent = `Error: ${result.error}`;
                    txDetails.appendChild(errorMessage);
               } else if (!isSuccess && result.meta?.TransactionResult) {
                    const errorMessage = document.createElement('div');
                    errorMessage.className = 'error-message';
                    errorMessage.textContent = `Error: Transaction failed with result ${result.meta.TransactionResult}`;
                    txDetails.appendChild(errorMessage);
               }

               // Transaction Details Table
               const txTable = document.createElement('div');
               txTable.className = 'result-table';
               const txHeader = document.createElement('div');
               txHeader.className = 'result-row result-header';
               txHeader.innerHTML = `
              <div class="result-cell key">Key</div>
              <div class="result-cell value">Value</div>
            `;
               txTable.appendChild(txHeader);

               const txContent = [
                    { key: 'Transaction Type', value: txType },
                    { key: 'Hash', value: result.hash ? `<code>${result.hash}</code>` : 'N/A' },
                    { key: 'CTID', value: result.ctid || 'N/A' },
                    { key: 'Date', value: result.close_time_iso ? new Date(result.close_time_iso).toLocaleString() : result.date || 'N/A' },
                    // { key: 'Result', value: result.meta?.TransactionResult ? (isSuccess ? result.meta.TransactionResult : `<span class="error-result">${result.meta.TransactionResult}</span>`) : 'N/A' },
                    { key: 'Result', value: result.error ? `<span class="error-result">${result.error}</span>` : result.meta?.TransactionResult ? (isSuccess ? result.meta.TransactionResult : `<span class="error-result">${result.meta.TransactionResult}</span>`) : 'N/A' },
                    { key: 'Ledger Index', value: result.ledger_index || 'N/A' },
                    { key: 'Validated', value: result.validated !== undefined ? result.validated.toString() : 'N/A' },
               ];

               txContent.forEach(item => {
                    const row = document.createElement('div');
                    row.className = 'result-row';
                    row.innerHTML = `
                <div class="result-cell key">${item.key}</div>
                <div class="result-cell value">${item.value}</div>
              `;
                    txTable.appendChild(row);
               });

               // Transaction Data Table
               const txDataContent = result.tx_json
                    ? Object.entries(result.tx_json)
                           .filter(([key]) => key !== 'TransactionType')
                           .map(([key, value]) => ({ key, value: this.formatValue(key, value, nestedFields[txType as keyof typeof nestedFields] || []) }))
                    : [];

               const txDataTable = document.createElement('div');
               txDataTable.className = 'result-table';
               const txDataHeader = document.createElement('div');
               txDataHeader.className = 'result-row result-header';
               txDataHeader.innerHTML = `
              <div class="result-cell key">Key</div>
              <div class="result-cell value">Value</div>
            `;
               txDataTable.appendChild(txDataHeader);

               txDataContent.forEach(item => {
                    // console.debug(`ite ${item.key} ${item.value}`);
                    const row = document.createElement('div');
                    row.className = 'result-row';

                    // Format value based on type
                    let displayValue: string;
                    if (typeof item.value === 'object' && item.value !== null) {
                         // Handle LimitAmount object
                         if (item.key === 'LimitAmount' && typeof item.value === 'object') {
                              const currency = (item.value as { currency: string }).currency;
                              const value = (item.value as { value: string }).value;
                              const issuer = (item.value as { issuer: string }).issuer;
                              displayValue = `${currency} ${value} (issuer: <code>${issuer}</code>)`;
                         } else {
                              // Fallback for other objects
                              displayValue = JSON.stringify(item.value, null, 2).replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
                         }
                    } else {
                         // Handle strings or other primitives
                         displayValue = String(item.value);
                         // Wrap in <code> if it looks like an address or key
                         if (item.key === 'Account' || item.key === 'OfferSequence' || item.key === 'SigningPubKey' || item.key === 'TxnSignature' || item.key === 'ctid') {
                              // if (item.key === 'Account' || item.key === 'SigningPubKey' || item.key === 'TxnSignature' || item.key === 'ctid') {
                              displayValue = `<code>${displayValue}</code>`;
                         }
                         if ((item.key == 'Asset' || item.key == 'Asset2') && item.value.includes('undefined')) {
                              displayValue = item.value.split(' ')[1];
                         }
                    }

                    row.innerHTML = `
                      <div class="result-cell key">${item.key}</div>
                      <div class="result-cell value">${displayValue}</div>
                    `;
                    txDataTable.appendChild(row);
               });

               const txDataDetails = document.createElement('details');
               txDataDetails.className = 'nested-object';
               const txDataSummary = document.createElement('summary');
               txDataSummary.textContent = 'Transaction Data';
               txDataDetails.appendChild(txDataSummary);
               txDataDetails.appendChild(txDataTable);

               // Meta Data Table
               const metaContent = result.meta
                    ? [
                           { key: 'Transaction Index', value: result.meta.TransactionIndex || 'N/A' },
                           { key: 'Transaction Result', value: result.meta.TransactionResult || 'N/A' },
                           { key: 'Delivered Amount', value: result.meta.delivered_amount ? this.formatAmount(result.meta.delivered_amount) : 'N/A' },
                      ]
                    : [];

               const metaTable = document.createElement('div');
               metaTable.className = 'result-table';
               const metaHeader = document.createElement('div');
               metaHeader.className = 'result-row result-header';
               metaHeader.innerHTML = `
              <div class="result-cell key">Key</div>
              <div class="result-cell value">Value</div>
            `;
               metaTable.appendChild(metaHeader);

               metaContent.forEach(item => {
                    const row = document.createElement('div');
                    row.className = 'result-row';
                    row.innerHTML = `
                <div class="result-cell key">${item.key}</div>
                <div class="result-cell value">${item.value}</div>
              `;
                    metaTable.appendChild(row);
               });

               const metaDetails = document.createElement('details');
               metaDetails.className = 'nested-object';
               const metaSummary = document.createElement('summary');
               metaSummary.textContent = 'Meta Data';
               metaDetails.appendChild(metaSummary);
               metaDetails.appendChild(metaTable);

               // Affected Nodes
               const affectedNodesContent = result.meta?.AffectedNodes
                    ? result.meta.AffectedNodes.map((node: any, nodeIndex: number) => {
                           const nodeType = Object.keys(node)[0];
                           const entry = node[nodeType] || {};
                           return {
                                key: `${nodeType} ${nodeIndex + 1}`,
                                content: [
                                     { key: 'Ledger Entry Type', value: entry.LedgerEntryType || 'N/A' },
                                     { key: 'Ledger Index', value: entry.LedgerIndex ? `<code>${entry.LedgerIndex}</code>` : 'N/A' },
                                     ...(entry.PreviousTxnID ? [{ key: 'Previous Txn ID', value: `<code>${entry.PreviousTxnID}</code>` }] : []),
                                     ...(entry.PreviousTxnLgrSeq ? [{ key: 'Previous Txn Lgr Seq', value: entry.PreviousTxnLgrSeq }] : []),
                                     ...Object.entries(entry.FinalFields || {}).map(([k, v]) => ({
                                          key: k,
                                          value: this.formatValue(k, v),
                                     })),
                                     ...Object.entries(entry.NewFields || {}).map(([k, v]) => ({
                                          key: k,
                                          value: this.formatValue(k, v),
                                     })),
                                     ...(entry.PreviousFields
                                          ? [
                                                 {
                                                      key: 'Previous Fields',
                                                      content: Object.entries(entry.PreviousFields).map(([k, v]) => ({
                                                           key: k,
                                                           value: this.formatValue(k, v),
                                                      })),
                                                 },
                                            ]
                                          : []),
                                ],
                           };
                      })
                    : [];

               const affectedNodesDetails = document.createElement('details');
               affectedNodesDetails.className = 'nested-object';
               const affectedNodesSummary = document.createElement('summary');
               affectedNodesSummary.textContent = 'Affected Nodes';
               affectedNodesDetails.appendChild(affectedNodesSummary);

               affectedNodesContent.forEach((node: { key: string; content: any[] }) => {
                    const nodeDetails = document.createElement('details');
                    nodeDetails.className = 'nested-object';
                    const nodeSummary = document.createElement('summary');
                    nodeSummary.textContent = node.key;
                    nodeDetails.appendChild(nodeSummary);

                    const nodeTable = document.createElement('div');
                    nodeTable.className = 'result-table';
                    const nodeHeader = document.createElement('div');
                    nodeHeader.className = 'result-row result-header';
                    nodeHeader.innerHTML = `
        <div class="result-cell key">Key</div>
        <div class="result-cell value">Value</div>
    `;
                    nodeTable.appendChild(nodeHeader);

                    node.content.forEach(item => {
                         const row = document.createElement('div');
                         row.className = 'result-row';

                         if (item.content) {
                              // Keep proper key + value structure
                              row.innerHTML = `<div class="result-cell key">${item.key}</div>`;

                              const valueCell = document.createElement('div');
                              valueCell.className = 'result-cell value';

                              const nestedDetails = document.createElement('details');
                              nestedDetails.className = 'nested-object';

                              const nestedSummary = document.createElement('summary');
                              nestedSummary.textContent = item.key;
                              nestedDetails.appendChild(nestedSummary);

                              const nestedTable = document.createElement('div');
                              nestedTable.className = 'result-table';
                              const nestedHeader = document.createElement('div');
                              nestedHeader.className = 'result-row result-header';
                              nestedHeader.innerHTML = `
        <div class="result-cell key">Key</div>
        <div class="result-cell value">Value</div>
    `;
                              nestedTable.appendChild(nestedHeader);

                              item.content.forEach((nestedItem: { key: string; value?: string }) => {
                                   const nestedRow = document.createElement('div');
                                   nestedRow.className = 'result-row';
                                   nestedRow.innerHTML = `
            <div class="result-cell key">${nestedItem.key}</div>
            <div class="result-cell value">${nestedItem.value || ''}</div>
        `;
                                   nestedTable.appendChild(nestedRow);
                              });

                              nestedDetails.appendChild(nestedTable);
                              valueCell.appendChild(nestedDetails);
                              row.appendChild(valueCell);
                         } else {
                              // Normal key-value row
                              row.innerHTML = `
                <div class="result-cell key">${item.key}</div>
                <div class="result-cell value">${item.value || ''}</div>
            `;
                         }

                         nodeTable.appendChild(row);
                    });

                    nodeDetails.appendChild(nodeTable);
                    affectedNodesDetails.appendChild(nodeDetails);
               });

               txDetails.appendChild(txTable);
               txDetails.appendChild(txDataDetails);
               txDetails.appendChild(metaDetails);
               txDetails.appendChild(affectedNodesDetails);
               details.appendChild(txDetails);
          });

          container.appendChild(details);

          document.querySelectorAll('.result-section, .nested-object').forEach(details => {
               const summary = details.querySelector('summary');
               if (summary) {
                    const title = summary.textContent;
                    const savedState = localStorage.getItem(`collapse_${title}`);
                    if (savedState === 'closed') details.removeAttribute('open');
                    else if (savedState === 'open' || title === 'Account Data' || title === 'RippleState') {
                         details.setAttribute('open', 'open');
                    }
                    details.addEventListener('toggle', () => {
                         localStorage.setItem(`collapse_${title}`, (details as HTMLDetailsElement).open ? 'open' : 'closed');
                         container.offsetHeight;
                         container.style.height = 'auto';
                    });
               }
          });

          // Updated search functionality
          searchBar.addEventListener('input', e => {
               const target = e.target as HTMLInputElement | null;
               const search = target ? target.value.toLowerCase().trim() : '';
               console.debug('Search query:', search);
               const sections = document.querySelectorAll('.result-section');

               if (!search) {
                    sections.forEach(section => {
                         (section as HTMLElement).style.display = '';
                         section.querySelectorAll('.result-row').forEach(row => ((row as HTMLElement).style.display = 'flex'));
                         section.querySelectorAll('.nested-object').forEach(nested => {
                              (nested as HTMLElement).style.display = '';
                              nested.querySelectorAll('.result-row').forEach(row => ((row as HTMLElement).style.display = 'flex'));
                         });
                         const summaryElement = section.querySelector('summary');
                         const title = summaryElement ? summaryElement.textContent : '';
                         if (title === 'Account Data' || (title && title.includes('Trust Lines'))) {
                              section.setAttribute('open', 'open');
                         } else {
                              section.removeAttribute('open');
                         }
                    });
                    return;
               }

               sections.forEach(section => {
                    let hasVisibleContent = false;

                    // Skip directRows since there are none in this case
                    const nestedDetails = section.querySelectorAll('.nested-object');
                    nestedDetails.forEach(nested => {
                         let nestedHasVisibleContent = false;
                         const tableRows = nested.querySelectorAll('.result-table > .result-row:not(.result-header)');
                         tableRows.forEach(row => {
                              const keyCell = row.querySelector('.key');
                              const valueCell = row.querySelector('.value');
                              const keyText = keyCell ? this.stripHTMLForSearch(keyCell.innerHTML) : '';
                              const valueText = valueCell ? this.stripHTMLForSearch(valueCell.innerHTML) : '';
                              console.debug('Row content:', { keyText, valueText, search });
                              const isMatch = keyText.includes(search) || valueText.includes(search);
                              (row as HTMLElement).style.display = isMatch ? 'flex' : 'none';
                              if (isMatch) {
                                   nestedHasVisibleContent = true;
                                   console.debug('Match found:', { keyText, valueText, search });
                              }
                         });
                         (nested as HTMLElement).style.display = nestedHasVisibleContent ? '' : 'none';
                         if (nestedHasVisibleContent) hasVisibleContent = true;
                    });

                    (section as HTMLElement).style.display = hasVisibleContent ? '' : 'none';
                    if (hasVisibleContent) section.setAttribute('open', 'open');
               });
          });
     }

     renderDetails(data: any) {
          const container = document.getElementById('resultField');
          if (!container) {
               console.error('Error: #resultField not found');
               return;
          }
          container.classList.remove('error', 'success');
          container.innerHTML = '';

          // Add search bar
          const searchBar = document.createElement('input');
          searchBar.type = 'text';
          searchBar.id = 'resultSearch';
          searchBar.placeholder = 'Search results...';
          searchBar.className = 'result-search';
          searchBar.style.boxSizing = 'border-box';
          container.appendChild(searchBar);

          // Render sections (unchanged)
          for (const section of data.sections) {
               if (!section.content && !section.subItems) continue;
               const details = document.createElement('details');
               details.className = 'result-section';
               if (section.openByDefault) {
                    details.setAttribute('open', 'open');
               }
               const summary = document.createElement('summary');
               summary.textContent = section.title;
               details.appendChild(summary);

               if (section.content && section.content.length) {
                    const table = document.createElement('div');
                    table.className = 'result-table';
                    const header = document.createElement('div');
                    header.className = 'result-row result-header';
                    header.innerHTML = `
                <div class="result-cell key" data-key="Key">Key</div>
                <div class="result-cell value" data-key="Value">Value</div>
              `;
                    table.appendChild(header);

                    for (const item of section.content) {
                         const row = document.createElement('div');
                         row.className = 'result-row';
                         row.innerHTML = `
                  <div class="result-cell key" data-key="Key">${item.key}</div>
                  <div class="result-cell value" data-key="Value">${item.value}</div>
                `;
                         table.appendChild(row);
                    }
                    details.appendChild(table);
               }

               if (section.subItems && section.subItems.length) {
                    for (const subItem of section.subItems) {
                         const subDetails = document.createElement('details');
                         subDetails.className = 'nested-object';
                         if (subItem.openByDefault) {
                              subDetails.setAttribute('open', 'open');
                         }
                         const subSummary = document.createElement('summary');
                         subSummary.textContent = subItem.key;
                         subDetails.appendChild(subSummary);

                         const subTable = document.createElement('div');
                         subTable.className = 'result-table';
                         const subHeader = document.createElement('div');
                         subHeader.className = 'result-row result-header';
                         subHeader.innerHTML = `
                  <div class="result-cell key" data-key="Key">Key</div>
                  <div class="result-cell value" data-key="Value">Value</div>
                `;
                         subTable.appendChild(subHeader);

                         for (const subContent of subItem.content) {
                              const subRow = document.createElement('div');
                              subRow.className = 'result-row';
                              subRow.innerHTML = `
                    <div class="result-cell key" data-key="Key">${subContent.key}</div>
                    <div class="result-cell value" data-key="Value">${subContent.value || ''}</div>
                  `;
                              subTable.appendChild(subRow);
                         }
                         subDetails.appendChild(subTable);
                         details.appendChild(subDetails);
                    }
               }
               container.appendChild(details);
          }
          container.classList.add('success');

          // Add toggle event listeners (unchanged)
          document.querySelectorAll('.result-section, .nested-object').forEach(details => {
               const summary = details.querySelector('summary');
               if (summary) {
                    const title = summary.textContent;
                    const savedState = localStorage.getItem(`collapse_${title}`);
                    if (savedState === 'closed') details.removeAttribute('open');
                    else if (savedState === 'open' || title === 'Account Data' || title === 'RippleState') {
                         details.setAttribute('open', 'open');
                    }
                    details.addEventListener('toggle', () => {
                         localStorage.setItem(`collapse_${title}`, (details as HTMLDetailsElement).open ? 'open' : 'closed');
                         container.offsetHeight;
                         container.style.height = 'auto';
                    });
               }
          });

          // Updated search functionality
          searchBar.addEventListener('input', e => {
               const target = e.target as HTMLInputElement | null;
               const search = target ? target.value.toLowerCase().trim() : '';
               console.debug('Search query:', search);
               const sections = document.querySelectorAll('.result-section');

               if (!search) {
                    sections.forEach(section => {
                         (section as HTMLElement).style.display = '';
                         section.querySelectorAll('.result-row').forEach(row => ((row as HTMLElement).style.display = 'flex'));
                         section.querySelectorAll('.nested-object').forEach(nested => {
                              (nested as HTMLElement).style.display = '';
                              nested.querySelectorAll('.result-row').forEach(row => ((row as HTMLElement).style.display = 'flex'));
                         });
                         const summaryElement = section.querySelector('summary');
                         const title = summaryElement ? summaryElement.textContent : '';
                         if (title === 'Account Data' || (title && title.includes('Trust Lines'))) {
                              section.setAttribute('open', 'open');
                         } else {
                              section.removeAttribute('open');
                         }
                    });
                    return;
               }

               sections.forEach(section => {
                    let hasVisibleContent = false;

                    // Skip directRows since there are none in this case
                    const nestedDetails = section.querySelectorAll('.nested-object');
                    nestedDetails.forEach(nested => {
                         let nestedHasVisibleContent = false;
                         const tableRows = nested.querySelectorAll('.result-table > .result-row:not(.result-header)');
                         tableRows.forEach(row => {
                              const keyCell = row.querySelector('.key');
                              const valueCell = row.querySelector('.value');
                              const keyText = keyCell ? this.stripHTMLForSearch(keyCell.innerHTML) : '';
                              const valueText = valueCell ? this.stripHTMLForSearch(valueCell.innerHTML) : '';
                              console.debug('Row content:', { keyText, valueText, search });
                              const isMatch = keyText.includes(search) || valueText.includes(search);
                              (row as HTMLElement).style.display = isMatch ? 'flex' : 'none';
                              if (isMatch) {
                                   nestedHasVisibleContent = true;
                                   console.debug('Match found:', { keyText, valueText, search });
                              }
                         });
                         (nested as HTMLElement).style.display = nestedHasVisibleContent ? '' : 'none';
                         if (nestedHasVisibleContent) hasVisibleContent = true;
                    });

                    (section as HTMLElement).style.display = hasVisibleContent ? '' : 'none';
                    if (hasVisibleContent) section.setAttribute('open', 'open');
               });
          });
     }

     attachSearchListener(container: HTMLElement): void {
          const searchBar = container.querySelector('#resultSearch') as HTMLInputElement;
          if (!searchBar) {
               // console.error('Error: #resultSearch not found');
               return;
          }

          searchBar.addEventListener('input', e => {
               const target = e.target as HTMLInputElement;
               const search = target.value.toLowerCase().trim();
               const sections = container.querySelectorAll('.result-section') as NodeListOf<HTMLElement>;

               if (!search) {
                    sections.forEach(section => {
                         section.style.display = '';
                         section.querySelectorAll('.result-row').forEach((row: Element) => ((row as HTMLElement).style.display = 'flex'));
                         section.querySelectorAll('.nested-object').forEach(nested => {
                              (nested as HTMLElement).style.display = '';
                              nested.querySelectorAll('.result-row').forEach((row: Element) => ((row as HTMLElement).style.display = 'flex'));
                         });
                         const summaryElement = section.querySelector('summary');
                         const title = summaryElement ? summaryElement.textContent : null;
                         if (title === 'Transactions' || title?.includes('Transaction')) {
                              section.setAttribute('open', 'open');
                         } else {
                              section.removeAttribute('open');
                         }
                    });
                    return;
               }

               sections.forEach(section => {
                    let hasVisibleContent = false;
                    const directRows = section.querySelectorAll(':scope > .result-table > .result-row:not(.result-header)') as NodeListOf<HTMLElement>;
                    directRows.forEach(row => {
                         const keyCell = row.querySelector('.key') as HTMLElement;
                         const valueCell = row.querySelector('.value') as HTMLElement;
                         const keyText = keyCell ? this.stripHTMLForSearch(keyCell.innerHTML).toLowerCase() : '';
                         const valueText = valueCell ? this.stripHTMLForSearch(valueCell.innerHTML).toLowerCase() : '';
                         const isMatch = keyText.includes(search) || valueText.includes(search);
                         row.style.display = isMatch ? 'flex' : 'none';
                         if (isMatch) hasVisibleContent = true;
                    });

                    const nestedDetails = section.querySelectorAll('.nested-object') as NodeListOf<HTMLElement>;
                    nestedDetails.forEach(nested => {
                         let nestedHasVisibleContent = false;
                         const tableRows = nested.querySelectorAll('.result-table > .result-row:not(.result-header)') as NodeListOf<HTMLElement>;
                         tableRows.forEach(row => {
                              const keyCell = row.querySelector('.key') as HTMLElement;
                              const valueCell = row.querySelector('.value') as HTMLElement;
                              const keyText = keyCell ? this.stripHTMLForSearch(keyCell.innerHTML).toLowerCase() : '';
                              const valueText = valueCell ? this.stripHTMLForSearch(valueCell.innerHTML).toLowerCase() : '';
                              const isMatch = keyText.includes(search) || valueText.includes(search);
                              row.style.display = isMatch ? 'flex' : 'none';
                              if (isMatch) nestedHasVisibleContent = true;
                         });

                         const deeperDetails = nested.querySelectorAll('.nested-object') as NodeListOf<HTMLElement>;
                         deeperDetails.forEach(deeper => {
                              let deeperHasVisibleContent = false;
                              const deeperRows = deeper.querySelectorAll('.result-table > .result-row:not(.result-header)') as NodeListOf<HTMLElement>;
                              deeperRows.forEach(row => {
                                   const keyCell = row.querySelector('.key') as HTMLElement;
                                   const valueCell = row.querySelector('.value') as HTMLElement;
                                   const keyText = keyCell ? this.stripHTMLForSearch(keyCell.innerHTML).toLowerCase() : '';
                                   const valueText = valueCell ? this.stripHTMLForSearch(valueCell.innerHTML).toLowerCase() : '';
                                   const isMatch = keyText.includes(search) || valueText.includes(search);
                                   row.style.display = isMatch ? 'flex' : 'none';
                                   if (isMatch) deeperHasVisibleContent = true;
                              });
                              deeper.style.display = deeperHasVisibleContent ? '' : 'none';
                              if (deeperHasVisibleContent) nestedHasVisibleContent = true;
                         });

                         nested.style.display = nestedHasVisibleContent ? '' : 'none';
                         if (nestedHasVisibleContent) hasVisibleContent = true;
                    });

                    section.style.display = hasVisibleContent ? '' : 'none';
                    if (hasVisibleContent) section.setAttribute('open', 'open');
               });
          });
     }

     async getAccountReserves(client: xrpl.Client, address: string) {
          try {
               // Get the current ledger index from the client
               const accountInfo = await this.xrplService.getAccountInfo(client, address, 'validated', '');
               const accountData = accountInfo.result.account_data;
               const ownerCount = accountData.OwnerCount;

               const reserveData = await this.getXrplReserve(client);
               if (!reserveData) {
                    throw new Error('Failed to fetch XRPL reserve data');
               }
               const { reserveBaseXRP, reserveIncrementXRP } = reserveData;
               const totalReserveXRP = reserveBaseXRP + ownerCount * reserveIncrementXRP;

               return { ownerCount, totalReserveXRP };
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`, undefined);
               return undefined;
          }
     }

     async getXrplReserve(client: xrpl.Client) {
          try {
               // Get the current ledger index from the client
               const server_info = await this.xrplService.getXrplServerInfo(client, 'current', '');
               // console.debug(`Server Info ${JSON.stringify(server_info, null, 2)}`);

               if (server_info.result.info && server_info.result.info.validated_ledger) {
                    console.debug(`Base Fee: ${server_info.result.info.validated_ledger.base_fee_xrp} XRP`);
                    console.debug(`Base Reserve: ${server_info.result.info.validated_ledger.reserve_base_xrp} XRP`);
                    console.debug(`Total incremental owner count: ${server_info.result.info.validated_ledger.reserve_inc_xrp} XRP`);
               } else {
                    console.warn('validated_ledger is undefined in server_info');
               }

               const ledger_info = await this.xrplService.getXrplServerState(client, 'current', '');
               const ledgerData = ledger_info.result.state.validated_ledger;
               if (!ledgerData) {
                    throw new Error('validated_ledger is undefined in server_state');
               }
               const baseFee = ledgerData.base_fee;
               const reserveBaseXRP = ledgerData.reserve_base;
               const reserveIncrementXRP = ledgerData.reserve_inc;

               // console.debug(`baseFee: ${baseFee}`);
               // console.debug(`reserveBaseXRP: ${xrpl.dropsToXrp(reserveBaseXRP)}`);
               // console.debug(`Total incremental owner count: ${xrpl.dropsToXrp(reserveIncrementXRP)} XRP`);
               // console.debug(`Total Reserve: ${xrpl.dropsToXrp(reserveIncrementXRP)} XRP`);

               return { reserveBaseXRP, reserveIncrementXRP };
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`, undefined);
               return undefined;
          }
     }

     async updateOwnerCountAndReserves(client: xrpl.Client, address: string): Promise<{ ownerCount: string; totalXrpReserves: string }> {
          const reserves = await this.getAccountReserves(client, address);
          let ownerCount = '0';
          let totalXrpReserves = '0';
          if (reserves) {
               ownerCount = reserves.ownerCount.toString();
               totalXrpReserves = String(xrpl.dropsToXrp(reserves.totalReserveXRP));
               console.debug(`Owner Count: ${ownerCount} Total XRP Reserves: ${totalXrpReserves}`);
          }
          return { ownerCount, totalXrpReserves };
     }

     async getOnlyTokenBalance(client: xrpl.Client, address: string, currency: string): Promise<string> {
          try {
               const response = await this.xrplService.getAccountLines(client, address, 'validated', '');
               const lines = response.result.lines || [];
               const tokenLine = lines.find((line: any) => line.currency.toUpperCase() === currency.toUpperCase());
               return tokenLine ? tokenLine.balance : '0';
          } catch (error: any) {
               console.error('Error fetching token balance:', error);
               return '0';
          }
     }

     async getTokenBalance(client: xrpl.Client, address: string, currency: string, hotwallet: string): Promise<{ issuers: string[]; total: number; xrpBalance: number }> {
          try {
               const gatewayBalances = await client.request({
                    command: 'gateway_balances',
                    account: address,
                    ledger_index: 'validated',
                    // hotwallet: hotwallet,
               });

               console.log(`gatewayBalances: ${JSON.stringify(gatewayBalances, null, '\t')}`);

               let tokenTotal = 0;
               const issuers: string[] = [];

               if (gatewayBalances.result.assets) {
                    Object.entries(gatewayBalances.result.assets).forEach(([issuer, assets]) => {
                         console.log(`Issuer: ${issuer}`);
                         assets.forEach((asset: any) => {
                              console.log(`  Currency: ${asset.currency}, Value: ${asset.value}`);
                              let assetCurrency = asset.currency.length > 3 ? this.decodeCurrencyCode(asset.currency) : asset.currency;

                              if (currency === assetCurrency) {
                                   console.log(`  Match: ${currency} = ${assetCurrency}`);
                                   const value = parseFloat(asset.value);
                                   if (!isNaN(value)) {
                                        tokenTotal += value;
                                        if (!issuers.includes(issuer)) {
                                             issuers.push(issuer);
                                        }
                                   }
                              }
                         });
                    });
               }

               const roundedTotal = Math.round(tokenTotal * 100) / 100;
               const xrpBalance = await client.getXrpBalance(address);
               await this.updateOwnerCountAndReserves(client, address);

               return {
                    issuers,
                    total: roundedTotal,
                    xrpBalance,
               };
          } catch (error: any) {
               console.error('Error fetching token balance:', error);
               throw error; // Let the caller handle the error
          }
     }

     async getAccountObjects(address: string) {
          try {
               const client = await this.xrplService.getClient();
               const accountObjects = await client.request({
                    command: 'account_objects',
                    account: address,
                    ledger_index: 'validated',
               });
               return accountObjects;
          } catch (error) {
               console.error('Error fetching account objects:', error);
               return [];
          }
     }

     async getCurrencyBalance(currency: string, accountAddressField: string) {
          try {
               const response = await this.getAccountObjects(accountAddressField);
               let accountObjects: any[] = [];
               if (response && !Array.isArray(response) && response.result && Array.isArray(response.result.account_objects)) {
                    accountObjects = response.result.account_objects;
               }

               interface AccountObjectWithBalance {
                    Balance: {
                         value: string;
                         currency: string;
                         [key: string]: any;
                    };
                    [key: string]: any;
               }

               const matchingObjects: AccountObjectWithBalance[] = accountObjects.filter((obj: any): obj is AccountObjectWithBalance => obj.Balance && obj.Balance.currency === currency.toUpperCase());

               const total = matchingObjects.reduce((sum, obj) => {
                    return sum + parseFloat(obj.Balance.value);
               }, 0);

               return total;
          } catch (error) {
               console.error('Error fetching balance:', error);
               return null;
          }
     }

     // async getAccountInfo(address: string): Promise<any> {
     //      try {
     //           const client = await this.xrplService.getClient();
     //           const accountInfo = await client.request({
     //                command: 'account_info',
     //                account: address,
     //           });

     //           return accountInfo;
     //      } catch (error: any) {
     //           throw new Error(`Failed to fetch account info: ${error.message || 'Unknown error'}`);
     //      }
     // }

     // async getTrustlines(seed: string, environment: string = 'devnet'): Promise<any> {
     //      if (!seed) {
     //           throw new Error('Account seed cannot be empty');
     //      }
     //      try {
     //           const client = await this.xrplService.getClient();
     //           const wallet = await this.getWallet(seed, environment);

     //           if (!wallet) {
     //                throw new Error('ERROR: Wallet could not be created or is undefined');
     //           }

     //           // let wallet;
     //           // if (seed.split(' ').length > 1) {
     //           //      wallet = xrpl.Wallet.fromMnemonic(seed, {
     //           //           algorithm: environment === AppConstants.NETWORKS.MAINNET.NAME ? AppConstants.ENCRYPTION.ED25519 : AppConstants.ENCRYPTION.SECP256K1,
     //           //      });
     //           // } else {
     //           //      wallet = xrpl.Wallet.fromSeed(seed, {
     //           //           algorithm: environment === AppConstants.NETWORKS.MAINNET.NAME ? AppConstants.ENCRYPTION.ED25519 : AppConstants.ENCRYPTION.SECP256K1,
     //           //      });
     //           // }

     //           const trustLines = await client.request({
     //                command: 'account_lines',
     //                account: wallet.classicAddress,
     //           });

     //           // Filter out trust lines with Limit: 0
     //           const activeTrustLines = trustLines.result.lines.filter((line: any) => parseFloat(line.limit) > 0);
     //           console.debug(`Active trust lines for ${wallet.classicAddress}:`, activeTrustLines);

     //           if (activeTrustLines.length === 0) {
     //                console.log(`No active trust lines found for ${wallet.classicAddress}`);
     //                return [];
     //           }

     //           console.debug(`Trust lines for ${wallet.classicAddress}:`, activeTrustLines);
     //           return activeTrustLines;
     //      } catch (error: any) {
     //           throw new Error(`Failed to fetch account info: ${error.message || 'Unknown error'}`);
     //      }
     // }

     // refreshUiIAccountMetaData(accountInfo: any) {
     //      const tickSizeField = document.getElementById('tickSizeField') as HTMLInputElement;
     //      if (tickSizeField) {
     //           if (accountInfo.account_data.TickSize && accountInfo.account_data.TickSize != '') {
     //                tickSizeField.value = accountInfo.account_data.TickSize;
     //           } else {
     //                tickSizeField.value = '';
     //           }
     //      }

     //      const transferRateField = document.getElementById('transferRateField') as HTMLInputElement;
     //      if (transferRateField) {
     //           if (accountInfo.account_data.TransferRate && accountInfo.account_data.TransferRate != '') {
     //                transferRateField.value = ((accountInfo.account_data.TransferRate / 1_000_000_000 - 1) * 100).toFixed(3);
     //           } else {
     //                transferRateField.value = '';
     //           }
     //      }

     //      const domainField = document.getElementById('domainField') as HTMLInputElement;
     //      if (domainField) {
     //           if (accountInfo.account_data.Domain && accountInfo.account_data.Domain != '') {
     //                domainField.value = this.decodeHex(accountInfo.account_data.Domain);
     //           } else {
     //                domainField.value = '';
     //           }
     //      }

     //      const isMessageKeyField = document.getElementById('isMessageKey') as HTMLInputElement;
     //      if (isMessageKeyField) {
     //           if (accountInfo.account_data.MessageKey && accountInfo.account_data.MessageKey != '') {
     //                isMessageKeyField.checked = true;
     //           } else {
     //                isMessageKeyField.checked = false;
     //           }
     //      }
     // }

     setError(message: string, spinner: { style: { display: string } } | undefined) {
          this.isError = true;
          this.isSuccess = false;
          this.result = `${message}`;
          this.spinner = false;
     }

     public setSuccess(message: string) {
          this.result = `${message}`;
          this.isError = false;
          this.isSuccess = true;
     }

     async getValidInvoiceID(input: string): Promise<string | null> {
          if (!input) {
               return null;
          }
          if (/^[0-9A-Fa-f]{64}$/.test(input)) {
               return input.toUpperCase();
          }
          try {
               const encoder = new TextEncoder();
               const data = encoder.encode(input);
               const hashBuffer = await crypto.subtle.digest('SHA-256', data);
               const hashArray = Array.from(new Uint8Array(hashBuffer));
               const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
               return hashHex.toUpperCase();
          } catch (error) {
               throw new Error('Failed to hash InvoiceID');
          }
     }

     loadSignerList(account: string, signers: any) {
          const singerEntriesAccount = account + 'signerEntries';
          if (this.storageService.get(singerEntriesAccount) != null && this.storageService.get(singerEntriesAccount).length > 0) {
               signers = this.storageService.get(singerEntriesAccount).map((s: { Account: any; seed: any; SignerWeight: any }) => ({
                    account: s.Account,
                    seed: s.seed,
                    weight: s.SignerWeight,
               }));
          } else {
               this.clearSignerList(signers);
          }
     }

     clearSignerList(signers: any) {
          signers = [{ account: '', seed: '', weight: 1 }];
     }

     getUserEnteredAddress(userEnteredAddress: any) {
          return userEnteredAddress
               .split(',')
               .map((address: string) => address.trim())
               .filter((addr: string) => addr !== '');
     }

     async setInvoiceIdField(tx: any, invoiceIdField: string) {
          const validInvoiceID = await this.getValidInvoiceID(invoiceIdField);
          if (validInvoiceID) {
               tx.InvoiceID = validInvoiceID;
          }
     }

     setSourceTagField(tx: any, sourceTagField: string) {
          tx.SourceTag = Number(sourceTagField);
     }

     setURI(tx: any, uri: string) {
          // tx.URI = Buffer.from(uri, 'utf8').toString('hex');
          tx.URI = xrpl.convertStringToHex(uri);
     }

     setIssuerAddress(tx: any, issuerAddressField: string) {
          tx.Issuer = issuerAddressField;
     }

     async applyTicketSequence(tx: any, client: xrpl.Client, account: string, ticketSequence: string) {
          if (ticketSequence) {
               if (!(await this.xrplService.checkTicketExists(client, account, Number(ticketSequence)))) {
                    throw new Error(`Ticket Sequence ${ticketSequence} not found for account ${account}`);
               }
               this.setTicketSequence(tx, ticketSequence, true);
          } else {
               const accountInfo = await this.xrplService.getAccountInfo(client, account, 'validated', '');
               this.setTicketSequence(tx, accountInfo.result.account_data.Sequence, false);
          }
     }

     setTicketSequence(tx: any, ticketSequence: string, useTicket: boolean) {
          if (useTicket) {
               tx.TicketSequence = Number(ticketSequence);
               tx.Sequence = 0;
          } else {
               tx.Sequence = Number(ticketSequence);
          }
     }

     setMemoField(tx: any, memoField: string) {
          tx.Memos = [
               {
                    Memo: {
                         MemoData: Buffer.from(memoField, 'utf8').toString('hex'),
                         MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                    },
               },
          ];
     }

     setDestinationTag(tx: any, destinationTagField: string) {
          tx.DestinationTag = parseInt(destinationTagField, 10);
     }

     setMessageKey(tx: any, messageKey: string) {
          tx.MessageKey = messageKey;
     }

     setDomain(tx: any, domain: string) {
          if (domain === '') {
               tx.Domain = '';
          } else {
               tx.Domain = Buffer.from(domain, 'utf8').toString('hex');
          }
     }

     setTransferRate(tx: any, transferRate: number) {
          tx.TransferRate = this.getTransferRate(transferRate);
     }

     setTickSize(tx: any, tickSize: number) {
          tx.TickSize = tickSize;
     }

     setExpiration(tx: any, expiration: number) {
          tx.Expiration = expiration;
     }
}
