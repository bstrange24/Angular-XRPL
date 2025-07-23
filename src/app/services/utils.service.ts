import { ElementRef, ViewChild } from '@angular/core';
import { Injectable } from '@angular/core';
import * as xrpl from 'xrpl';
import { XrplService } from '../services/xrpl.service';
import { AppConstants } from '../core/app.constants';
import { StorageService } from '../services/storage.service';
import { sha256 } from 'js-sha256';

@Injectable({
     providedIn: 'root',
})
export class UtilsService {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     transactionInput = '';
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     ownerCount = '';
     totalXrpReserves = '';
     transferRate = '';
     isMessageKey = false;
     memo = '';
     spinner = false;

     constructor(private xrplService: XrplService, private storageService: StorageService) {}

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
                    { key: 'Flags', format: (v: any) => v || '0' },
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

     convertXRPLTime(rippleTime: any) {
          // Convert Ripple time (seconds since Jan 1, 2000) to UTC datetime
          const rippleEpoch = 946684800; // Jan 1, 2000 in Unix time
          const date = new Date((rippleTime + rippleEpoch) * 1000);
          const formatter = this.dateFormatter();
          return formatter.format(date);
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

     labelCurrencyCode(code: String) {
          if (code.length === 40) {
               return `LP-${code.slice(0, 40).toUpperCase()}`;
          } else {
               return code;
          }
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
          console.log(`savedEncryptionType: ${savedEncryptionType}`);
          if (savedEncryptionType === 'true') {
               return seed.split(' ').length > 1 ? xrpl.Wallet.fromMnemonic(seed, { algorithm: AppConstants.ENCRYPTION.ED25519 }) : xrpl.Wallet.fromSeed(seed, { algorithm: AppConstants.ENCRYPTION.ED25519 });
          } else {
               return seed.split(' ').length > 1 ? xrpl.Wallet.fromMnemonic(seed, { algorithm: AppConstants.ENCRYPTION.SECP256K1 }) : xrpl.Wallet.fromSeed(seed, { algorithm: AppConstants.ENCRYPTION.SECP256K1 });
          }
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

     async handleMultiSignTransaction({ client, wallet, environment, tx, signerAddresses, signerSeeds, fee }: { client: xrpl.Client; wallet: xrpl.Wallet; environment: string; tx: xrpl.Transaction; signerAddresses: string[]; signerSeeds: string[]; fee: string }): Promise<{ signedTx: { tx_blob: string; hash: string } | null; signers: xrpl.Signer[] }> {
          if (signerAddresses.length !== signerSeeds.length) {
               throw new Error('Signer address count must match signer seed count');
          }

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

          const signers: xrpl.Signer[] = [];
          let signedTx: { tx_blob: string; hash: string } | null = null;

          for (let i = 0; i < signerAddresses.length; i++) {
               const signerWallet = await this.getWallet(signerSeeds[i], environment);

               if (signerWallet.classicAddress !== signerAddresses[i]) {
                    throw new Error(`Seed mismatch for signer ${signerAddresses[i]}`);
               }

               const signed = signerWallet.sign(preparedTx, true);
               console.log('Signed Transaction:', JSON.stringify(signed, null, 2));

               const decoded = xrpl.decode(signed.tx_blob) as xrpl.Transaction;

               if (!decoded.Signers || !Array.isArray(decoded.Signers)) {
                    throw new Error(`Could not extract Signer from ${signerWallet.classicAddress}`);
               }

               signers.push(decoded.Signers[0]);
               signedTx = signed;
               break; // Exit after first signer if quorum is 1
          }

          if (!signedTx) {
               throw new Error('No valid signature collected for multisign transaction');
          }

          return { signedTx, signers };
     }

     // async handleMultiSignPayment({ client, wallet, environment, payment, signerAddresses, signerSeeds, fee }: { client: xrpl.Client; wallet: xrpl.Wallet; environment: string; payment: xrpl.Payment; signerAddresses: string[]; signerSeeds: string[]; fee: string }): Promise<{ signedTx: { tx_blob: string; hash: string } | null; signers: xrpl.Signer[] }> {
     //      if (signerAddresses.length !== signerSeeds.length) {
     //           throw new Error('Signer address count must match signer seed count');
     //      }

     //      const accountObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '');
     //      const signerList = accountObjects.result.account_objects.find((obj: any) => obj.LedgerEntryType === 'SignerList');
     //      if (!signerList) {
     //           throw new Error('Account does not have a SignerList');
     //      }

     //      if (!('SignerEntries' in signerList) || !Array.isArray((signerList as any).SignerEntries)) {
     //           throw new Error('SignerList object does not have SignerEntries');
     //      }
     //      const validSigners = (signerList as { SignerEntries: any[] }).SignerEntries.map((entry: any) => entry.SignerEntry.Account);
     //      const quorum = (signerList as any).SignerQuorum;

     //      let totalWeight = 0;
     //      signerAddresses.forEach(addr => {
     //           const signerEntry = (signerList as any).SignerEntries.find((entry: any) => entry.SignerEntry.Account === addr);
     //           if (signerEntry) {
     //                totalWeight += signerEntry.SignerEntry.SignerWeight;
     //           }
     //      });

     //      if (totalWeight < quorum) {
     //           throw new Error(`Total signer weight (${totalWeight}) does not meet quorum (${quorum})`);
     //      }

     //      if (signerAddresses.some(addr => !validSigners.includes(addr))) {
     //           throw new Error('One or more signer addresses are not in the SignerList');
     //      }

     //      console.log('SignerList:', JSON.stringify(signerList, null, 2));
     //      console.log('Valid Signers:', validSigners);
     //      console.log('Provided Signers:', signerAddresses);
     //      console.log('Quorum:', quorum);

     //      // Fee = baseFee × (1 + number of signers)
     //      const feeDrops = Number(fee) * (1 + signerAddresses.length);
     //      payment.Fee = String(feeDrops);
     //      payment.SigningPubKey = '';

     //      const preparedTx = await client.autofill({
     //           ...payment,
     //           SigningPubKey: '',
     //      });
     //      delete preparedTx.Signers;
     //      delete preparedTx.TxnSignature;

     //      console.log('PreparedTx before signing:', JSON.stringify(preparedTx, null, 2));

     //      const signers: xrpl.Signer[] = [];
     //      let signedTx: { tx_blob: string; hash: string } | null = null;

     //      for (let i = 0; i < signerAddresses.length; i++) {
     //           const signerWallet = await this.getWallet(signerSeeds[i], environment);

     //           if (signerWallet.classicAddress !== signerAddresses[i]) {
     //                throw new Error(`Seed mismatch for signer ${signerAddresses[i]}`);
     //           }

     //           const signed = signerWallet.sign(preparedTx, true);
     //           console.log('Signed Transaction:', JSON.stringify(signed, null, 2));

     //           const decoded = xrpl.decode(signed.tx_blob) as xrpl.Transaction;

     //           if (!decoded.Signers || !Array.isArray(decoded.Signers)) {
     //                throw new Error(`Could not extract Signer from ${signerWallet.classicAddress}`);
     //           }

     //           signers.push(decoded.Signers[0]);
     //           signedTx = signed;
     //           break; // Exit after first valid signer if quorum is 1
     //      }

     //      if (!signedTx) {
     //           throw new Error('No valid signature collected for multisign transaction');
     //      }

     //      return { signedTx, signers };
     // }

     getFlagName(value: string) {
          return AppConstants.FLAGS.find(f => f.value.toString() === value)?.name || `Flag ${value}`;
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
               const accountInfo = await this.getAccountInfo(address);
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
                         RippleState: ['Balance', 'HighLimit', 'LowLimit'],
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
                                             value: k === 'issuer' || k === 'index' || k === 'Account' ? `<code>${String(v)}</code>` : String(v),
                                        }));
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
                         { key: 'OwnerCount', value: accountInfo.result.account_data.OwnerCount },
                         { key: 'Sequence', value: accountInfo.result.account_data.Sequence },
                    ],
               },
               metadata: {
                    title: 'Account Meta Data',
                    content: [
                         { key: 'BurnedNFTokens', value: accountInfo.result.account_data.BurnedNFTokens },
                         { key: 'MintedNFTokens', value: accountInfo.result.account_data.MintedNFTokens },
                         {
                              key: 'Domain',
                              value: accountInfo.result.account_data.Domain ? Buffer.from(accountInfo.result.account_data.Domain, 'hex').toString('ascii') : 'Not Set',
                         },
                         { key: 'TickSize', value: accountInfo.result.account_data.TickSize },
                         {
                              key: 'TransferRate',
                              value: accountInfo.result.account_data.TransferRate ? ((accountInfo.result.account_data.TransferRate / 1_000_000_000 - 1) * 100).toFixed(6) + '%' : 'Not Set',
                         },
                         // { key: 'TransferRate', value: (accountInfo.result.account_data.TransferRate / 1_000_000_000).toFixed(9) },
                         { key: 'FirstNFTokenSequence', value: accountInfo.result.account_data.FirstNFTokenSequence },
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

     // renderTransactionsResults(transactions: { type: string; result: any } | { type: string; result: any }[], container: HTMLElement): void {
     //      const txArray = Array.isArray(transactions) ? transactions : [transactions];
     //      if (!container) {
     //           console.error('Error: container not found');
     //           return;
     //      }
     //      container.innerHTML = '';

     //      // Add search bar
     //      const searchBar = document.createElement('input');
     //      searchBar.type = 'text';
     //      searchBar.id = 'resultSearch';
     //      searchBar.placeholder = 'Search transaction...';
     //      searchBar.className = 'result-search';
     //      searchBar.style.boxSizing = 'border-box';
     //      container.appendChild(searchBar);

     //      const result = Array.isArray(transactions) ? transactions[0].result : transactions.result;
     //      const isSuccess = result.meta.TransactionResult === 'tesSUCCESS'; // Check tesSUCCESS

     //      // Define nested fields for each transaction type (unchanged)
     //      const nestedFieldsByType = {
     //           Payment: ['Amount', 'DeliverMax', 'DestinationTag', 'SourceTag', 'InvoiceID', 'PreviousFields', 'Balance', 'Sequence'],
     //           OfferCreate: ['TakerGets', 'TakerPays'],
     //           OfferCancel: [],
     //           TrustSet: ['LimitAmount'],
     //           AccountSet: ['ClearFlag', 'SetFlag', 'Domain', 'EmailHash', 'MessageKey', 'TransferRate', 'TickSize'],
     //           AccountDelete: [],
     //           SetRegularKey: ['RegularKey'],
     //           SignerListSet: ['SignerEntries'],
     //           EscrowCreate: ['Amount', 'Condition', 'DestinationTag', 'SourceTag'],
     //           EscrowFinish: ['Condition', 'Fulfillment'],
     //           EscrowCancel: [],
     //           PaymentChannelCreate: ['Amount', 'DestinationTag', 'SourceTag', 'PublicKey'],
     //           PaymentChannelFund: ['Amount'],
     //           PaymentChannelClaim: ['Balance', 'Amount', 'Signature', 'PublicKey'],
     //           CheckCreate: ['Amount', 'DestinationTag', 'SourceTag', 'InvoiceID'],
     //           CheckCash: ['Amount', 'DeliverMin'],
     //           CheckCancel: [],
     //           DepositPreauth: ['Authorize', 'Unauthorize'],
     //           TicketCreate: [],
     //           NFTokenMint: ['NFTokenTaxon', 'Issuer', 'TransferFee', 'URI'],
     //           NFTokenBurn: [],
     //           NFTokenCreateOffer: ['Amount', 'Destination'],
     //           NFTokenCancelOffer: ['NFTokenOffers'],
     //           NFTokenAcceptOffer: [],
     //           AMMCreate: ['Amount', 'Amount2', 'TradingFee'],
     //           AMMFund: ['Amount', 'Amount2'],
     //           AMMBid: ['BidMin', 'BidMax', 'AuthAccounts'],
     //           AMMWithdraw: ['Amount', 'Amount2', 'LPTokenIn'],
     //           AMMVote: [],
     //           AMMDelete: [],
     //           EnableAmendment: [],
     //           SetFee: [],
     //           UNLModify: [],
     //           Clawback: ['Amount'],
     //           XChainBridge: ['MinAccountCreateAmount', 'SignatureReward'],
     //           XChainCreateClaimId: [],
     //           XChainCommit: ['Amount', 'OtherChainDestination'],
     //           XChainClaim: [],
     //           XChainAccountCreateCommit: ['Amount', 'SignatureReward'],
     //           XChainAddAccountCreateAttestation: [],
     //           XChainAddClaimAttestation: [],
     //           XChainCreateBridge: ['MinAccountCreateAmount', 'SignatureReward'],
     //           XChainModifyBridge: ['MinAccountCreateAmount', 'SignatureReward'],
     //           DIDSet: ['Data', 'URI', 'Attestation'],
     //           DIDDelete: [],
     //      };

     //      // Define sections
     //      interface SectionContentItem {
     //           key: string;
     //           value: any;
     //           subContent?: SectionContentItem[];
     //      }

     //      interface SectionSubItem {
     //           key: string;
     //           content: SectionContentItem[];
     //      }

     //      interface Section {
     //           title: string;
     //           content: SectionContentItem[];
     //           subItems?: SectionSubItem[];
     //      }

     //      interface Sections {
     //           [key: string]: Section;
     //      }

     //      interface TxResult {
     //           tx_json: { [key: string]: any; TransactionType: string };
     //           hash: string;
     //           ctid?: string;
     //           close_time_iso?: string;
     //           meta: {
     //                TransactionResult: string;
     //                TransactionIndex?: number;
     //                delivered_amount?: any;
     //                AffectedNodes: any[];
     //           };
     //           ledger_hash?: string;
     //           ledger_index?: number;
     //           validated?: boolean;
     //      }

     //      const sections: Sections = {
     //           transaction: {
     //                title: 'Transaction Details',
     //                content: [
     //                     { key: 'Transaction Type', value: result.tx_json.TransactionType },
     //                     { key: 'Hash', value: `<code>${result.hash}</code>` },
     //                     { key: 'CTID', value: result.ctid },
     //                     { key: 'Date', value: new Date(result.close_time_iso).toLocaleString() },
     //                     {
     //                          key: 'Result',
     //                          value: isSuccess ? result.meta.TransactionResult : `<span class="error-result">${result.meta.TransactionResult}</span>`,
     //                     },
     //                     { key: 'Ledger Hash', value: `<code>${result.ledger_hash}</code>` },
     //                     { key: 'Ledger Index', value: result.ledger_index },
     //                     { key: 'Validated', value: result.validated },
     //                ],
     //           },
     //           tx_data: {
     //                title: 'Transaction Data',
     //                content: Object.entries(result.tx_json)
     //                     .filter(([key]) => !['TransactionType', 'date', 'ledger_index'].includes(key))
     //                     .map(([key, value]) => {
     //                          const nestedFields = (nestedFieldsByType[result.tx_json.TransactionType as keyof typeof nestedFieldsByType] || []) as string[];
     //                          if (nestedFields.includes(key) && typeof value === 'object') return null;
     //                          return {
     //                               key,
     //                               value: key === 'Account' || key === 'Destination' || key.includes('PubKey') || key.includes('Signature') || key.includes('TxnSignature') ? `<code>${value}</code>` : typeof value === 'string' && value.length > 50 ? `<code>${value.slice(0, 50)}...</code>` : value,
     //                          };
     //                     })
     //                     .filter((item): item is SectionContentItem => item !== null && item !== undefined),
     //                subItems: (nestedFieldsByType[result.tx_json.TransactionType as keyof typeof nestedFieldsByType] || [])
     //                     .filter((field: string) => result.tx_json[field])
     //                     .map((field: string): SectionSubItem => {
     //                          let content: SectionContentItem[];
     //                          if (field === 'SignerEntries') {
     //                               interface SignerEntry {
     //                                    SignerEntry: {
     //                                         Account: string;
     //                                         SignerWeight: number;
     //                                    };
     //                               }

     //                               interface SignerEntryContent {
     //                                    key: string;
     //                                    value: string;
     //                               }

     //                               const signerEntries: SignerEntry[] = result.tx_json[field] as SignerEntry[];
     //                               content = signerEntries.map(
     //                                    (entry: SignerEntry, i: number): SignerEntryContent => ({
     //                                         key: `Signer ${i + 1}`,
     //                                         value: `<code>${entry.SignerEntry.Account}</code> (Weight: ${entry.SignerEntry.SignerWeight})`,
     //                                    })
     //                               );
     //                          } else if (field === 'NFTokenOffers') {
     //                               interface NFTokenOfferContent {
     //                                    key: string;
     //                                    value: string;
     //                               }

     //                               const offers: string[] = result.tx_json[field] as string[];
     //                               content = offers.map(
     //                                    (offer: string, i: number): NFTokenOfferContent => ({
     //                                         key: `Offer ${i + 1}`,
     //                                         value: `<code>${offer}</code>`,
     //                                    })
     //                               );
     //                          } else if (field === 'AuthAccounts') {
     //                               interface AuthAccount {
     //                                    AuthAccount: {
     //                                         Account: string;
     //                                    };
     //                               }
     //                               interface AuthAccountContent {
     //                                    key: string;
     //                                    value: string;
     //                               }
     //                               const authAccounts: AuthAccount[] = result.tx_json[field] as AuthAccount[];
     //                               content = authAccounts.map(
     //                                    (acc: AuthAccount, i: number): AuthAccountContent => ({
     //                                         key: `Account ${i + 1}`,
     //                                         value: `<code>${acc.AuthAccount.Account}</code>`,
     //                                    })
     //                               );
     //                          } else if (typeof result.tx_json[field] === 'object') {
     //                               content = Object.entries(result.tx_json[field]).map(([k, v]) => ({
     //                                    key: k,
     //                                    value: k === 'issuer' || k === 'Account' ? `<code>${v}</code>` : v,
     //                               }));
     //                          } else {
     //                               content = [{ key: field, value: result.tx_json[field] }];
     //                          }
     //                          return { key: field, content };
     //                     }),
     //           },
     //           meta: {
     //                title: 'Meta Data',
     //                content: [
     //                     { key: 'Transaction Index', value: result.meta.TransactionIndex },
     //                     { key: 'Transaction Result', value: result.meta.TransactionResult },
     //                     { key: 'Delivered Amount', value: result.meta.delivered_amount ? formatAmount(result.meta.delivered_amount) : 'N/A' },
     //                ],
     //                subItems: [
     //                     {
     //                          key: 'Affected Nodes',
     //                          content: result.meta.AffectedNodes.map((node: any, idx: number): SectionContentItem => {
     //                               const nodeType = Object.keys(node)[0];
     //                               const entry = node[nodeType];
     //                               console.log(`entry ${JSON.stringify(entry, null, 2)}`);
     //                               return {
     //                                    key: `${nodeType} ${idx + 1}`,
     //                                    value: null,
     //                                    subContent: [
     //                                         { key: 'Ledger Entry Type', value: entry.LedgerEntryType },
     //                                         { key: 'Ledger Index', value: `<code>${entry.LedgerIndex}</code>` },
     //                                         { key: 'Previous Txn ID', value: entry.PreviousTxnID },
     //                                         { key: 'Previous Txn Lgr Seq', value: `<code>${entry.PreviousTxnLgrSeq}</code>` },
     //                                         ...Object.entries(entry.FinalFields || {}).map(([k, v]) => ({
     //                                              key: k,
     //                                              value: k === 'Account' || k.includes('index') ? `<code>${v}</code>` : formatAmount(v as string | AmountObject),
     //                                         })),
     //                                         ...(entry.PreviousFields
     //                                              ? [
     //                                                     {
     //                                                          key: 'Previous Fields',
     //                                                          value: '', // Add a value property to satisfy SectionContentItem
     //                                                          subContent: Object.entries(entry.PreviousFields).map(([k, v]) => ({
     //                                                               key: k,
     //                                                               value: k === 'Account' || k.includes('index') || k == 'Balance' ? `<code>${v}</code>` : formatAmount(v as string | AmountObject),
     //                                                          })),
     //                                                     },
     //                                                ]
     //                                              : []),
     //                                    ],
     //                               };
     //                          }),
     //                     },
     //                ],
     //           },
     //      };

     //      // Helper to format amounts (unchanged)
     //      interface AmountObject {
     //           value: string;
     //           currency: string;
     //           issuer?: string;
     //      }

     //      function formatAmount(value: string | AmountObject): string | AmountObject {
     //           if (typeof value === 'string' && /^\d+$/.test(value)) {
     //                return (parseInt(value) / 1_000_000).toFixed(6) + ' XRP';
     //           } else if (typeof value === 'object' && value.currency) {
     //                return `${value.value} ${value.currency}${value.issuer ? ` (<code>${value.issuer}</code>)` : ''}`;
     //           }
     //           return value;
     //      }

     //      // Render sections
     //      for (const section of Object.values(sections)) {
     //           if (section.content.length || (section.subItems && section.subItems.length)) {
     //                const details = document.createElement('details');
     //                details.className = `result-section${isSuccess || section.title !== 'Transaction Details' ? '' : ' error-transaction'}`; // Add error class for failed tx
     //                if (section.title === 'Transaction Details' || section.title === 'Transaction Data') {
     //                     details.setAttribute('open', 'open');
     //                }
     //                const summary = document.createElement('summary');
     //                summary.textContent = section.title + (section.title === 'Transaction Details' && !isSuccess ? ' (Failed)' : ''); // Indicate failure
     //                details.appendChild(summary);

     //                // Optional: Add error message for failed transactions
     //                if (!isSuccess && section.title === 'Transaction Details') {
     //                     const errorMessage = document.createElement('div');
     //                     errorMessage.className = 'error-message';
     //                     errorMessage.textContent = `Error: Transaction failed with result ${result.meta.TransactionResult}`;
     //                     details.appendChild(errorMessage);
     //                }

     //                if (section.content.length) {
     //                     const table = document.createElement('div');
     //                     table.className = 'result-table';
     //                     const header = document.createElement('div');
     //                     header.className = 'result-row result-header';
     //                     header.innerHTML = `
     //                      <div class="result-cell key" data-key="Key">Key</div>
     //                      <div class="result-cell value" data-key="Value">Value</div>
     //                  `;
     //                     table.appendChild(header);

     //                     for (const item of section.content) {
     //                          const row = document.createElement('div');
     //                          row.className = 'result-row';
     //                          row.innerHTML = `
     //                          <div class="result-cell key" data-key="Key">${item.key}</div>
     //                          <div class="result-cell value" data-key="Value">${item.value}</div>
     //                      `;
     //                          table.appendChild(row);
     //                     }
     //                     details.appendChild(table);
     //                }

     //                if (section.subItems) {
     //                     for (const subItem of section.subItems) {
     //                          const subDetails = document.createElement('details');
     //                          subDetails.className = 'nested-object';
     //                          const subSummary = document.createElement('summary');
     //                          subSummary.textContent = subItem.key;
     //                          subDetails.appendChild(subSummary);

     //                          const subTable = document.createElement('div');
     //                          subTable.className = 'result-table';
     //                          const subHeader = document.createElement('div');
     //                          subHeader.className = 'result-row result-header';
     //                          subHeader.innerHTML = `
     //                          <div class="result-cell key" data-key="Key">Key</div>
     //                          <div class="result-cell value" data-key="Value">Value</div>
     //                      `;
     //                          subTable.appendChild(subHeader);

     //                          for (const subContent of subItem.content) {
     //                               const subRow = document.createElement('div');
     //                               subRow.className = 'result-row';
     //                               subRow.innerHTML = `
     //                              <div class="result-cell key" data-key="Key">${subContent.key}</div>
     //                              <div class="result-cell value" data-key="Value">${subContent.value || ''}</div>
     //                          `;
     //                               if (subContent.subContent) {
     //                                    const nestedDetails = document.createElement('details');
     //                                    nestedDetails.className = 'nested-object';
     //                                    const nestedSummary = document.createElement('summary');
     //                                    nestedSummary.textContent = subContent.key;
     //                                    nestedDetails.appendChild(nestedSummary);

     //                                    const nestedTable = document.createElement('div');
     //                                    nestedTable.className = 'result-table';
     //                                    const nestedHeader = document.createElement('div');
     //                                    nestedHeader.className = 'result-row result-header';
     //                                    nestedHeader.innerHTML = `
     //                                  <div class="result-cell key" data-key="Key">Key</div>
     //                                  <div class="result-cell value" data-key="Value">Value</div>
     //                              `;
     //                                    nestedTable.appendChild(nestedHeader);

     //                                    for (const nestedItem of subContent.subContent) {
     //                                         const nestedRow = document.createElement('div');
     //                                         nestedRow.className = 'result-row';
     //                                         const value = nestedItem.value || '';
     //                                         nestedRow.innerHTML = `
     //                                      <div class="result-cell key" data-key="Key">${nestedItem.key}</div>
     //                                      <div class="result-cell value" data-key="Value">${value}</div>
     //                                  `;
     //                                         nestedTable.appendChild(nestedRow);
     //                                    }
     //                                    nestedDetails.appendChild(nestedTable);
     //                                    subRow.appendChild(nestedDetails);
     //                               }
     //                               subTable.appendChild(subRow);
     //                          }
     //                          subDetails.appendChild(subTable);
     //                          details.appendChild(subDetails);
     //                     }
     //                }

     //                container.appendChild(details);
     //           }
     //      }

     //      // Add toggle event listeners
     //      document.querySelectorAll('.result-section, .nested-object').forEach(details => {
     //           details.addEventListener('toggle', () => {
     //                container.offsetHeight;
     //                container.style.height = 'auto';
     //           });
     //      });

     //      // Updated search functionality
     //      searchBar.addEventListener('input', e => {
     //           const target = e.target as HTMLInputElement | null;
     //           const search = target ? target.value.toLowerCase().trim() : '';
     //           const sections = document.querySelectorAll('.result-section');

     //           if (!search) {
     //                sections.forEach(section => {
     //                     (section as HTMLElement).style.display = '';
     //                     section.querySelectorAll('.result-row').forEach(row => ((row as HTMLElement).style.display = 'flex'));
     //                     section.querySelectorAll('.nested-object').forEach(nested => {
     //                          (nested as HTMLElement).style.display = '';
     //                          nested.querySelectorAll('.result-row').forEach(row => ((row as HTMLElement).style.display = 'flex'));
     //                     });
     //                     const summaryElement = section.querySelector('summary');
     //                     const title = summaryElement && summaryElement.textContent ? summaryElement.textContent.replace(' (Failed)', '') : '';
     //                     if (title === 'Transaction Details' || title === 'Transaction Data') {
     //                          section.setAttribute('open', 'open');
     //                     } else {
     //                          section.removeAttribute('open');
     //                     }
     //                });
     //                return;
     //           }

     //           sections.forEach(section => {
     //                let hasVisibleContent = false;
     //                const directRows = section.querySelectorAll(':scope > .result-table > .result-row:not(.result-header)');
     //                directRows.forEach(row => {
     //                     const keyCell = row.querySelector('.key');
     //                     const valueCell = row.querySelector('.value');
     //                     const keyText = keyCell ? this.stripHTML(keyCell.innerHTML).toLowerCase() : '';
     //                     const valueText = valueCell ? this.stripHTML(valueCell.innerHTML).toLowerCase() : '';
     //                     const isMatch = keyText.includes(search) || valueText.includes(search);
     //                     (row as HTMLElement).style.display = isMatch ? 'flex' : 'none';
     //                     if (isMatch) hasVisibleContent = true;
     //                });

     //                const nestedDetails = section.querySelectorAll('.nested-object');
     //                nestedDetails.forEach(nested => {
     //                     let nestedHasVisibleContent = false;
     //                     const allTableRows = nested.querySelectorAll('.result-table .result-row:not(.result-header)');
     //                     allTableRows.forEach(row => {
     //                          const keyCell = row.querySelector('.key');
     //                          const valueCell = row.querySelector('.value');
     //                          const keyText = keyCell ? this.stripHTML(keyCell.innerHTML).toLowerCase() : '';
     //                          const valueText = valueCell ? this.stripHTML(valueCell.innerHTML).toLowerCase() : '';
     //                          const isMatch = keyText.includes(search) || valueText.includes(search);
     //                          (row as HTMLElement).style.display = isMatch ? 'flex' : 'none';
     //                          if (isMatch) nestedHasVisibleContent = true;
     //                     });
     //                     const topRow = nested.parentElement ? (nested.parentElement.closest('.result-row') as HTMLElement | null) : null;
     //                     if (topRow && nestedHasVisibleContent) {
     //                          topRow.style.display = 'flex';
     //                     }
     //                     (nested as HTMLElement).style.display = nestedHasVisibleContent ? '' : 'none';
     //                     if (nestedHasVisibleContent) {
     //                          (nested as HTMLElement).setAttribute('open', 'open');
     //                          hasVisibleContent = true;
     //                     }
     //                });

     //                (section as HTMLElement).style.display = hasVisibleContent ? '' : 'none';
     //                if (hasVisibleContent) (section as HTMLElement).setAttribute('open', 'open');
     //           });
     //      });

     //      // Add toggle persistence
     //      document.querySelectorAll('.result-section, .nested-object').forEach(details => {
     //           const summary = details.querySelector('summary');
     //           const title = summary && summary.textContent ? summary.textContent.replace(' (Failed)', '') : '';
     //           if (summary && title) {
     //                const savedState = localStorage.getItem(`collapse_${title}`);
     //                if (savedState === 'closed') details.removeAttribute('open');
     //                else if (savedState === 'open' || title === 'Transaction Details' || title === 'Transaction Data') {
     //                     details.setAttribute('open', 'open');
     //                }
     //                details.addEventListener('toggle', () => {
     //                     localStorage.setItem(`collapse_${title}`, (details as HTMLDetailsElement).open ? 'open' : 'closed');
     //                     container.offsetHeight;
     //                     container.style.height = 'auto';
     //                });
     //           }
     //      });
     // }

     renderTransactionsResults1(transactions: { type: string; result: any } | { type: string; result: any }[], container: HTMLElement, clearInnerHtml: boolean): void {
          const txArray = Array.isArray(transactions) ? transactions : [transactions];
          if (!container) {
               console.error('Error: container not found');
               return;
          }

          if (clearInnerHtml) {
               container.innerHTML = ''; // Clear content
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
                    }

                    row.innerHTML = `
                      <div class="result-cell key">${item.key}</div>
                      <div class="result-cell value">${displayValue}</div>
                    `;
                    txDataTable.appendChild(row);
               });
               //      txDataContent.forEach(item => {
               //           console.debug(`ite ${item.key} ${item.value}`);
               //           const row = document.createElement('div');
               //           row.className = 'result-row';
               //           row.innerHTML = `
               //       <div class="result-cell key">${item.key}</div>
               //       <div class="result-cell value">${item.value}</div>
               //     `;
               //           txDataTable.appendChild(row);
               //      });

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
                         row.innerHTML = `
                  <div class="result-cell key">${item.key}</div>
                  <div class="result-cell value">${item.value || ''}</div>
                `;
                         if (item.content) {
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
                              row.appendChild(nestedDetails);
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

          // Toggle event listeners
          // document.querySelectorAll('.result-section, .nested-object').forEach(details => {
          //      const summary = details.querySelector('summary');
          //      if (summary) {
          //           const title = summary.textContent;
          //           const savedState = localStorage.getItem(`collapse_${title}`);
          //           if (savedState === 'closed') details.removeAttribute('open');
          //           else details.setAttribute('open', 'open');
          //           details.addEventListener('toggle', () => {
          //                localStorage.setItem(`collapse_${title}`, (details as HTMLDetailsElement).open ? 'open' : 'closed');
          //                container.offsetHeight;
          //                container.style.height = 'auto';
          //           });
          //      }
          // });
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

     renderTransactionsResults(transactions: { type: string; result: any } | { type: string; result: any }[], container: HTMLElement): void {
          const txArray = Array.isArray(transactions) ? transactions : [transactions];
          if (!container) {
               console.error('Error: container not found');
               return;
          }
          container.classList.remove('error', 'success');
          container.innerHTML = ''; // Clear content

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
                    }

                    row.innerHTML = `
                      <div class="result-cell key">${item.key}</div>
                      <div class="result-cell value">${displayValue}</div>
                    `;
                    txDataTable.appendChild(row);
               });
               //      txDataContent.forEach(item => {
               //           console.debug(`ite ${item.key} ${item.value}`);
               //           const row = document.createElement('div');
               //           row.className = 'result-row';
               //           row.innerHTML = `
               //       <div class="result-cell key">${item.key}</div>
               //       <div class="result-cell value">${item.value}</div>
               //     `;
               //           txDataTable.appendChild(row);
               //      });

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
                         row.innerHTML = `
                  <div class="result-cell key">${item.key}</div>
                  <div class="result-cell value">${item.value || ''}</div>
                `;
                         if (item.content) {
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
                              row.appendChild(nestedDetails);
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

          // Toggle event listeners
          // document.querySelectorAll('.result-section, .nested-object').forEach(details => {
          //      const summary = details.querySelector('summary');
          //      if (summary) {
          //           const title = summary.textContent;
          //           const savedState = localStorage.getItem(`collapse_${title}`);
          //           if (savedState === 'closed') details.removeAttribute('open');
          //           else details.setAttribute('open', 'open');
          //           details.addEventListener('toggle', () => {
          //                localStorage.setItem(`collapse_${title}`, (details as HTMLDetailsElement).open ? 'open' : 'closed');
          //                container.offsetHeight;
          //                container.style.height = 'auto';
          //           });
          //      }
          // });
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

     renderPaymentChannelDetails(data: any) {
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

     // renderPaymentChannelDetails(data: any) {
     //      const container = document.getElementById('resultField');
     //      if (!container) {
     //           console.error('Error: #resultField not found');
     //           return;
     //      }
     //      container.classList.remove('error', 'success');
     //      container.innerHTML = '';

     //      // Add search bar
     //      const searchBar = document.createElement('input');
     //      searchBar.type = 'text';
     //      searchBar.id = 'resultSearch';
     //      searchBar.placeholder = 'Search results...';
     //      searchBar.className = 'result-search';
     //      searchBar.style.boxSizing = 'border-box';
     //      container.appendChild(searchBar);

     //      // Render sections
     //      for (const section of data.sections) {
     //           if (!section.content && !section.subItems) continue;
     //           const details = document.createElement('details');
     //           details.className = 'result-section';
     //           if (section.openByDefault) {
     //                details.setAttribute('open', 'open');
     //           }
     //           const summary = document.createElement('summary');
     //           summary.textContent = section.title;
     //           details.appendChild(summary);

     //           // Render direct content (e.g., Network in Connection Status)
     //           if (section.content && section.content.length) {
     //                const table = document.createElement('div');
     //                table.className = 'result-table';
     //                const header = document.createElement('div');
     //                header.className = 'result-row result-header';
     //                header.innerHTML = `
     //                  <div class="result-cell key" data-key="Key">Key</div>
     //                  <div class="result-cell value" data-key="Value">Value</div>
     //              `;
     //                table.appendChild(header);

     //                for (const item of section.content) {
     //                     const row = document.createElement('div');
     //                     row.className = 'result-row';
     //                     row.innerHTML = `
     //                      <div class="result-cell key" data-key="Key">${item.key}</div>
     //                      <div class="result-cell value" data-key="Value">${item.value}</div>
     //                  `;
     //                     table.appendChild(row);
     //                }
     //                details.appendChild(table);
     //           }

     //           // Render nested sub-items (e.g., Channels)
     //           if (section.subItems && section.subItems.length) {
     //                for (const subItem of section.subItems) {
     //                     const subDetails = document.createElement('details');
     //                     subDetails.className = 'nested-object';
     //                     if (subItem.openByDefault) {
     //                          subDetails.setAttribute('open', 'open');
     //                     }
     //                     const subSummary = document.createElement('summary');
     //                     subSummary.textContent = subItem.key;
     //                     subDetails.appendChild(subSummary);

     //                     const subTable = document.createElement('div');
     //                     subTable.className = 'result-table';
     //                     const subHeader = document.createElement('div');
     //                     subHeader.className = 'result-row result-header';
     //                     subHeader.innerHTML = `
     //                      <div class="result-cell key" data-key="Key">Key</div>
     //                      <div class="result-cell value" data-key="Value">Value}</div>
     //                  `;
     //                     subTable.appendChild(subHeader);

     //                     for (const subContent of subItem.content) {
     //                          const subRow = document.createElement('div');
     //                          subRow.className = 'result-row';
     //                          subRow.innerHTML = `
     //                          <div class="result-cell key" data-key="Key">${subContent.key}</div>
     //                          <div class="result-cell value" data-key="Value">${subContent.value || ''}</div>
     //                      `;
     //                          subTable.appendChild(subRow);
     //                     }
     //                     subDetails.appendChild(subTable);
     //                     details.appendChild(subDetails);
     //                }
     //           }
     //           container.appendChild(details);
     //      }
     //      container.classList.add('success');

     //      // Add toggle event listeners and persist state
     //      document.querySelectorAll('.result-section, .object-group, .nested-object').forEach(details => {
     //           const summary = details.querySelector('summary');
     //           if (summary) {
     //                const title = summary.textContent;
     //                const savedState = localStorage.getItem(`collapse_${title}`);
     //                if (savedState === 'closed') details.removeAttribute('open');
     //                else if (
     //                     savedState === 'open' ||
     //                     title === 'Account Data' ||
     //                     title === 'RippleState' // Open RippleState group by default
     //                ) {
     //                     details.setAttribute('open', 'open');
     //                }
     //                details.addEventListener('toggle', () => {
     //                     localStorage.setItem(`collapse_${title}`, (details as HTMLDetailsElement).open ? 'open' : 'closed');
     //                     container.offsetHeight;
     //                     container.style.height = 'auto';
     //                });
     //           }
     //      });

     //      console.log(container.innerHTML);

     //      // Search functionality
     //      searchBar.addEventListener('input', e => {
     //           const target = e.target as HTMLInputElement | null;
     //           const search = target ? target.value.toLowerCase().trim() : '';
     //           const sections = document.querySelectorAll('.result-section');
     //           console.log('Searching for:', search, 'sections:', sections);
     //           if (!search) {
     //                sections.forEach(section => {
     //                     (section as HTMLElement).style.display = '';
     //                     section.querySelectorAll('.result-row').forEach(row => ((row as HTMLElement).style.display = 'flex'));
     //                     section.querySelectorAll('.object-group, .nested-object').forEach(nested => {
     //                          (nested as HTMLElement).style.display = '';
     //                          nested.querySelectorAll('.result-row').forEach(row => ((row as HTMLElement).style.display = 'flex'));
     //                     });
     //                     const summaryElement = section.querySelector('summary');
     //                     const title = summaryElement ? summaryElement.textContent : '';
     //                     if (title === 'Account Data') {
     //                          section.setAttribute('open', 'open');
     //                     } else {
     //                          section.removeAttribute('open');
     //                     }
     //                });
     //                return;
     //           }

     //           sections.forEach(section => {
     //                let hasVisibleContent = false;
     //                const directRows = section.querySelectorAll(':scope > .result-table > .result-row:not(.result-header)');
     //                console.log('directRows:', directRows);
     //                directRows.forEach(row => {
     //                     const keyCell = row.querySelector('.key');
     //                     const valueCell = row.querySelector('.value');
     //                     const keyText = keyCell ? this.stripHTMLForSearch(keyCell.innerHTML).toLowerCase() : '';
     //                     const valueText = valueCell ? this.stripHTMLForSearch(valueCell.innerHTML).toLowerCase() : '';
     //                     const isMatch = keyText.includes(search) || valueText.includes(search);
     //                     console.log('Searching for:', search, 'Key:', keyText, 'Value:', valueText, 'Match:', isMatch);
     //                     (row as HTMLElement).style.display = isMatch ? 'flex' : 'none';
     //                     if (isMatch) hasVisibleContent = true;
     //                });

     //                const groupDetails = section.querySelectorAll('.object-group');
     //                groupDetails.forEach(group => {
     //                     let groupHasVisibleContent = false;
     //                     const nestedDetails = group.querySelectorAll('.nested-object');
     //                     nestedDetails.forEach(nested => {
     //                          let nestedHasVisibleContent = false;
     //                          const tableRows = nested.querySelectorAll('.result-table > .result-row:not(.result-header)');
     //                          tableRows.forEach(row => {
     //                               const keyCell = row.querySelector('.key');
     //                               const valueCell = row.querySelector('.value');
     //                               const keyText = keyCell ? this.stripHTMLForSearch(keyCell.innerHTML).toLowerCase() : '';
     //                               const valueText = valueCell ? this.stripHTMLForSearch(valueCell.innerHTML).toLowerCase() : '';
     //                               const isMatch = keyText.includes(search) || valueText.includes(search);
     //                               (row as HTMLElement).style.display = isMatch ? 'flex' : 'none';
     //                               if (isMatch) nestedHasVisibleContent = true;
     //                          });

     //                          const deeperDetails = nested.querySelectorAll('.nested-object');
     //                          deeperDetails.forEach(deeper => {
     //                               let deeperHasVisibleContent = false;
     //                               const deeperRows = deeper.querySelectorAll('.result-table > .result-row:not(.result-header)');
     //                               deeperRows.forEach(row => {
     //                                    const keyCell = row.querySelector('.key');
     //                                    const valueCell = row.querySelector('.value');
     //                                    const keyText = keyCell ? this.stripHTMLForSearch(keyCell.innerHTML).toLowerCase() : '';
     //                                    const valueText = valueCell ? this.stripHTMLForSearch(valueCell.innerHTML).toLowerCase() : '';
     //                                    const isMatch = keyText.includes(search) || valueText.includes(search);
     //                                    (row as HTMLElement).style.display = isMatch ? 'flex' : 'none';
     //                                    if (isMatch) deeperHasVisibleContent = true;
     //                               });
     //                               (deeper as HTMLElement).style.display = deeperHasVisibleContent ? '' : 'none';
     //                               if (deeperHasVisibleContent) nestedHasVisibleContent = true;
     //                          });

     //                          (nested as HTMLElement).style.display = nestedHasVisibleContent ? '' : 'none';
     //                          if (nestedHasVisibleContent) groupHasVisibleContent = true;
     //                     });

     //                     (group as HTMLElement).style.display = groupHasVisibleContent ? '' : 'none';
     //                     if (groupHasVisibleContent) hasVisibleContent = true;
     //                });

     //                (section as HTMLElement).style.display = hasVisibleContent ? '' : 'none';
     //                if (hasVisibleContent) section.setAttribute('open', 'open');
     //           });
     //      });
     // }

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

     async getTokenBalance(
          client: xrpl.Client,
          address: string,
          currency: string
     ): Promise<{
          issuers: string[];
          total: number;
          xrpBalance: number;
     }> {
          try {
               const gatewayBalances = await client.request({
                    command: 'gateway_balances',
                    account: address,
                    ledger_index: 'validated',
               });

               console.log('gatewayBalances', gatewayBalances);

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

     // async getCurrencyBalance(address: string, currency: string, issuer?: string): Promise<string | null> {
     //      try {
     //           const client = await this.xrplService.getClient();
     //           const balanceResponse = await client.request({
     //                command: 'gateway_balances',
     //                account: address,
     //                ledger_index: 'validated',
     //           });

     //           let tokenTotal = 0;
     //           if (balanceResponse.result.assets) {
     //                Object.entries(balanceResponse.result.assets).forEach(([assetIssuer, assets]) => {
     //                     if (!issuer || assetIssuer === issuer) {
     //                          assets.forEach((asset: any) => {
     //                               let assetCurrency = asset.currency.length > 3 ? this.decodeCurrencyCode(asset.currency) : asset.currency;
     //                               if (currency === assetCurrency) {
     //                                    const value = parseFloat(asset.value);
     //                                    if (!isNaN(value)) {
     //                                         tokenTotal += value;
     //                                    }
     //                               }
     //                          });
     //                     }
     //                });
     //           }
     //           return tokenTotal > 0 ? (Math.round(tokenTotal * 100) / 100).toString() : '0';
     //      } catch (error: any) {
     //           console.error('Error fetching token balance:', error);
     //           throw error;
     //      }
     // }

     async getAccountObjects(address: string) {
          try {
               const client = await this.xrplService.getClient();
               const accountObjects = await client.request({
                    command: 'account_objects',
                    account: address,
                    ledger_index: 'validated',
               });
               console.debug(`account_objects: ${accountObjects}`);
               return accountObjects;
          } catch (error) {
               console.error('Error fetching account objects:', error);
               return [];
          }
     }

     async getCurrencyBalance(currency: string, accountAddressField: HTMLElement) {
          try {
               const address = accountAddressField && 'value' in accountAddressField ? (accountAddressField as HTMLInputElement).value : '';
               const response = await this.getAccountObjects(address);
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

     async getAccountInfo(address: string): Promise<any> {
          try {
               const client = await this.xrplService.getClient();
               const accountInfo = await client.request({
                    command: 'account_info',
                    account: address,
               });

               return accountInfo;
          } catch (error: any) {
               throw new Error(`Failed to fetch account info: ${error.message || 'Unknown error'}`);
          }
     }

     // async getAccountInfo(seed: string, environment: string = 'devnet'): Promise<any> {
     //      if (!seed) {
     //           throw new Error('Account seed cannot be empty');
     //      }
     //      try {
     //           const client = await this.xrplService.getClient();
     //           let wallet;
     //           if (seed.split(' ').length > 1) {
     //                wallet = xrpl.Wallet.fromMnemonic(seed, {
     //                     algorithm: environment === AppConstants.NETWORKS.MAINNET.NAME ? AppConstants.ENCRYPTION.ED25519 : AppConstants.ENCRYPTION.SECP256K1,
     //                });
     //           } else {
     //                wallet = xrpl.Wallet.fromSeed(seed, {
     //                     algorithm: environment === AppConstants.NETWORKS.MAINNET.NAME ? AppConstants.ENCRYPTION.ED25519 : AppConstants.ENCRYPTION.SECP256K1,
     //                });
     //           }
     //           const accountInfo = await client.request({
     //                command: 'account_info',
     //                account: wallet.classicAddress,
     //           });

     //           const accountObjects = await client.request({
     //                command: 'account_objects',
     //                account: wallet.classicAddress,
     //           });

     //           return { accountInfo, accountObjects }; //response.result;
     //      } catch (error: any) {
     //           throw new Error(`Failed to fetch account info: ${error.message || 'Unknown error'}`);
     //      }
     // }

     async getTrustlines(seed: string, environment: string = 'devnet'): Promise<any> {
          if (!seed) {
               throw new Error('Account seed cannot be empty');
          }
          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet(seed, environment);

               if (!wallet) {
                    throw new Error('ERROR: Wallet could not be created or is undefined');
               }

               // let wallet;
               // if (seed.split(' ').length > 1) {
               //      wallet = xrpl.Wallet.fromMnemonic(seed, {
               //           algorithm: environment === AppConstants.NETWORKS.MAINNET.NAME ? AppConstants.ENCRYPTION.ED25519 : AppConstants.ENCRYPTION.SECP256K1,
               //      });
               // } else {
               //      wallet = xrpl.Wallet.fromSeed(seed, {
               //           algorithm: environment === AppConstants.NETWORKS.MAINNET.NAME ? AppConstants.ENCRYPTION.ED25519 : AppConstants.ENCRYPTION.SECP256K1,
               //      });
               // }

               const trustLines = await client.request({
                    command: 'account_lines',
                    account: wallet.classicAddress,
               });

               // Filter out trust lines with Limit: 0
               const activeTrustLines = trustLines.result.lines.filter((line: any) => parseFloat(line.limit) > 0);
               console.debug(`Active trust lines for ${wallet.classicAddress}:`, activeTrustLines);

               if (activeTrustLines.length === 0) {
                    console.log(`No active trust lines found for ${wallet.classicAddress}`);
                    return [];
               }

               console.debug(`Trust lines for ${wallet.classicAddress}:`, activeTrustLines);
               return activeTrustLines;
          } catch (error: any) {
               throw new Error(`Failed to fetch account info: ${error.message || 'Unknown error'}`);
          }
     }

     refreshUiIAccountMetaData(accountInfo: any) {
          const tickSizeField = document.getElementById('tickSizeField') as HTMLInputElement;
          if (tickSizeField) {
               if (accountInfo.account_data.TickSize && accountInfo.account_data.TickSize != '') {
                    tickSizeField.value = accountInfo.account_data.TickSize;
               } else {
                    tickSizeField.value = '';
               }
          }

          const transferRateField = document.getElementById('transferRateField') as HTMLInputElement;
          if (transferRateField) {
               if (accountInfo.account_data.TransferRate && accountInfo.account_data.TransferRate != '') {
                    transferRateField.value = ((accountInfo.account_data.TransferRate / 1_000_000_000 - 1) * 100).toFixed(3);
               } else {
                    transferRateField.value = '';
               }
          }

          const domainField = document.getElementById('domainField') as HTMLInputElement;
          if (domainField) {
               if (accountInfo.account_data.Domain && accountInfo.account_data.Domain != '') {
                    domainField.value = this.decodeHex(accountInfo.account_data.Domain);
               } else {
                    domainField.value = '';
               }
          }

          const isMessageKeyField = document.getElementById('isMessageKey') as HTMLInputElement;
          if (isMessageKeyField) {
               if (accountInfo.account_data.MessageKey && accountInfo.account_data.MessageKey != '') {
                    isMessageKeyField.checked = true;
               } else {
                    isMessageKeyField.checked = false;
               }
          }
     }

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
}
