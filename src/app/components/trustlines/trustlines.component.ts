import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { StorageService } from '../../services/storage.service';
import * as xrpl from 'xrpl';
import { TrustSet, TransactionMetadataBase, AccountSet, Payment } from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';
import { WalletMultiInputComponent } from '../wallet-multi-input/wallet-multi-input.component';
import { derive } from 'xrpl-accountlib';
import { secretNumbers } from 'xrpl-accountlib/dist/generate';

interface TrustLine {
     currency: string;
     issuer?: string; // Optional, as some currencies (e.g., XRP) may not have an issuer
     account: string;
     balance: string;
     limit: string;
     limit_peer: string;
     no_ripple: boolean | undefined;
     no_ripple_peer: boolean | undefined;
     quality_in: number;
     quality_out: number;
}

@Component({
     selector: 'app-trustlines',
     standalone: true,
     imports: [CommonModule, FormsModule, WalletMultiInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './trustlines.component.html',
     styleUrl: './trustlines.component.css',
})
export class TrustlinesComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     selectedAccount: 'account1' | 'account2' | 'issuer' | null = null;
     private lastResult: string = '';
     transactionInput = '';
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = true;
     currencyField: string = '';
     currencyBalanceField: string = '';
     destinationField: string = '';
     amountField: string = '';
     ticketSequence: string = '';
     account1 = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '' };
     account2 = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '' };
     issuer = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '' };
     ownerCount = '';
     totalXrpReserves = '';
     executionTime = '';
     isMultiSign = false;
     multiSignAddress = '';
     isUpdateMetaData = false;
     tickSize = '';
     transferRate = '';
     isMessageKey = false;
     domain = '';
     memo = '';
     spinner = false;
     spinnerMessage: string = '';

     constructor(private xrplService: XrplService, private utilsService: UtilsService, private cdr: ChangeDetectorRef, private storageService: StorageService) {}

     ngAfterViewInit() {
          this.cdr.detectChanges();
     }

     ngAfterViewChecked() {
          if (this.result !== this.lastResult && this.resultField?.nativeElement) {
               this.utilsService.attachSearchListener(this.resultField.nativeElement);
               this.lastResult = this.result;
               this.cdr.detectChanges();
          }
     }

     onWalletInputChange(event: { account1: any; account2: any; issuer: any }) {
          this.account1 = event.account1;
          this.account2 = event.account2;
          this.issuer = event.issuer;
     }

     handleTransactionResult(event: { result: string; isError: boolean; isSuccess: boolean }) {
          this.result = event.result;
          this.isError = event.isError;
          this.isSuccess = event.isSuccess;
          if (this.isSuccess) {
               this.isEditable = false;
          }
     }

     onAccountChange() {
          if (this.selectedAccount === null || this.selectedAccount === undefined) {
               return;
          }
          if (this.selectedAccount === 'account1') {
               this.displayDataForAccount1();
          } else if (this.selectedAccount === 'account2') {
               this.displayDataForAccount2();
          } else {
               this.displayDataForAccount3();
          }
     }

     async getTrustlinesForAccount() {
          console.log('Entering getTrustlinesForAccount');
          const startTime = Date.now();
          this.setSuccessProperties();

          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }

          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed;
          if (!this.utilsService.validatInput(seed)) {
               return this.setError('ERROR: Account seed cannot be empty');
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();

               let wallet;
               if (seed.split(' ').length > 1) {
                    wallet = xrpl.Wallet.fromMnemonic(seed, {
                         algorithm: environment === AppConstants.NETWORKS.MAINNET.NAME ? AppConstants.ENCRYPTION.ED25519 : AppConstants.ENCRYPTION.SECP256K1,
                    });
               } else {
                    wallet = xrpl.Wallet.fromSeed(seed, {
                         algorithm: environment === AppConstants.NETWORKS.MAINNET.NAME ? AppConstants.ENCRYPTION.ED25519 : AppConstants.ENCRYPTION.SECP256K1,
                    });
               }

               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nGetting Trustlines\n\n`;

               const trustLines = await this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', '');
               const activeTrustLine = trustLines.result.lines.filter((line: any) => parseFloat(line.limit) > 0);
               console.debug(`Active trust lines for ${wallet.classicAddress}:`, activeTrustLine);

               type Section = {
                    title: string;
                    openByDefault: boolean;
                    content?: { key: string; value: string }[];
                    subItems?: {
                         key: string;
                         openByDefault: boolean;
                         content: { key: string; value: string }[];
                    }[];
               };
               const data: { sections: Section[] } = {
                    sections: [],
               };

               const activeTrustLines: TrustLine[] = (activeTrustLine as TrustLine[]).filter((line: TrustLine) => parseFloat(line.limit) > 0);
               if (activeTrustLines.length === 0) {
                    data.sections.push({
                         title: 'Trust Lines',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No active trust lines found for <code>${wallet.classicAddress}</code>` }],
                    });
               } else {
                    // Group trust lines by currency and issuer, and calculate total balance for each
                    const balanceByToken = activeTrustLines.reduce((acc: { [key: string]: number }, line: TrustLine) => {
                         const currency = line.currency.length > 3 ? this.utilsService.decodeCurrencyCode(line.currency) : line.currency;
                         const issuer = line.issuer || 'no-issuer'; // Handle cases with no issuer
                         const key = `${currency}:${issuer}`;
                         acc[key] = (acc[key] || 0) + parseFloat(line.balance);
                         return acc;
                    }, {});

                    // Format totals for display
                    const totalBalances = Object.entries(balanceByToken).map(([key, balance]) => {
                         const [currency, issuer] = key.split(':');
                         const formattedBalance = balance.toFixed(8);
                         return {
                              key: `Total ${currency} Balance${issuer !== 'no-issuer' ? ` (Issuer: ${issuer})` : ''}`,
                              value: `${formattedBalance} ${currency}`,
                         };
                    });

                    data.sections.push({
                         title: `Trust Lines (${activeTrustLines.length})`,
                         openByDefault: true,
                         content: totalBalances, // Display all token totals
                         subItems: activeTrustLines.map((line, index) => {
                              const displayCurrency = line.currency.length > 3 ? this.utilsService.decodeCurrencyCode(line.currency) : line.currency;
                              return {
                                   key: `Trust Line ${index + 1} (${displayCurrency}${line.issuer ? `, Issuer: ${line.issuer}` : ''})`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Currency', value: displayCurrency ?? '' },
                                        { key: 'Issuer', value: line.issuer ? `<code>${line.issuer}</code>` : '' },
                                        { key: 'Account', value: line.account ?? '' },
                                        { key: 'Limit', value: line.limit ?? '' },
                                        { key: 'Balance', value: line.balance != null ? `${line.balance} ${displayCurrency}` : '' },
                                        { key: 'Limit Peer', value: line.limit_peer ?? '' },
                                        { key: 'No Ripple', value: line.no_ripple != null ? String(line.no_ripple) : '' },
                                        { key: 'No Ripple Peer', value: line.no_ripple_peer != null ? String(line.no_ripple_peer) : '' },
                                        { key: 'Quality In', value: line.quality_in != null ? String(line.quality_in) : '' },
                                        { key: 'Quality Out', value: line.quality_out != null ? String(line.quality_out) : '' },
                                   ],
                              };
                         }),
                    });

                    const tokenBalance = await this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '');
                    // Obligations section (tokens issued by the account)
                    if (tokenBalance.result.obligations && Object.keys(tokenBalance.result.obligations).length > 0) {
                         data.sections.push({
                              title: `Obligations (${Object.keys(tokenBalance.result.obligations).length})`,
                              openByDefault: true,
                              subItems: Object.entries(tokenBalance.result.obligations).map(([currency, amount], index) => {
                                   const displayCurrency = currency.length > 3 ? this.utilsService.decodeCurrencyCode(currency) : currency;
                                   return {
                                        key: `Obligation ${index + 1} (${displayCurrency})`,
                                        openByDefault: false,
                                        content: [
                                             { key: 'Currency', value: displayCurrency },
                                             { key: 'Amount', value: amount },
                                        ],
                                   };
                              }),
                         });
                    } else {
                         data.sections.push({
                              title: 'Obligations',
                              openByDefault: true,
                              content: [{ key: 'Status', value: 'No obligations (tokens issued by you)' }],
                         });
                    }

                    // Balances section (tokens held by the account)
                    if (tokenBalance.result.assets && Object.keys(tokenBalance.result.assets).length > 0) {
                         const balanceItems = [];
                         for (const [issuer, currencies] of Object.entries(tokenBalance.result.assets)) {
                              for (const { currency, value } of currencies) {
                                   let displayCurrency = currency;
                                   if (currency.length > 3) {
                                        const tempCurrency = currency;
                                        displayCurrency = this.utilsService.decodeCurrencyCode(currency);
                                        if (displayCurrency.length > 8) {
                                             displayCurrency = tempCurrency;
                                        }
                                   }
                                   balanceItems.push({
                                        key: `${displayCurrency} from ${issuer.slice(0, 8)}...`,
                                        openByDefault: false,
                                        content: [
                                             { key: 'Currency', value: displayCurrency },
                                             { key: 'Issuer', value: `<code>${issuer}</code>` },
                                             { key: 'Amount', value: value },
                                        ],
                                   });
                              }
                         }
                         data.sections.push({
                              title: `Balances (${balanceItems.length})`,
                              openByDefault: true,
                              subItems: balanceItems,
                         });
                    } else {
                         data.sections.push({
                              title: 'Balances',
                              openByDefault: true,
                              content: [{ key: 'Status', value: 'No balances (tokens held by you)' }],
                         });
                    }
               }

               this.utilsService.renderPaymentChannelDetails(data);
               this.setSuccess(this.result);

               const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, wallet.classicAddress);
               this.ownerCount = ownerCount;
               this.totalXrpReserves = totalXrpReserves;
               const balance = (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0');

               if (this.selectedAccount === 'account1') {
                    this.account1.balance = balance.toString();
               } else if (this.selectedAccount === 'account2') {
                    this.account1.balance = balance.toString();
               } else {
                    this.account1.balance = balance.toString();
               }
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getTrustlinesForAccount in ${this.executionTime}ms`);
          }
     }

     async setTrustLine() {
          console.log('Entering setTrustLine');
          const startTime = Date.now();
          this.setSuccessProperties();

          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }

          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed;
          if (!this.utilsService.validatInput(seed)) {
               return this.setError('ERROR: Account seed cannot be empty');
          }

          if (!this.utilsService.validatInput(this.amountField)) {
               return this.setError('ERROR: Currency Amount cannot be empty');
          }

          if (!this.utilsService.validatInput(this.destinationField)) {
               return this.setError('ERROR: Destination cannot be empty');
          }

          if (parseFloat(this.amountField) <= 0) {
               return this.setError('ERROR: Currency Amount must be a positive number');
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();

               let wallet;
               if (seed.split(' ').length > 1) {
                    wallet = xrpl.Wallet.fromMnemonic(seed, {
                         algorithm: environment === AppConstants.NETWORKS.MAINNET.NAME ? AppConstants.ENCRYPTION.ED25519 : AppConstants.ENCRYPTION.SECP256K1,
                    });
               } else {
                    wallet = xrpl.Wallet.fromSeed(seed, {
                         algorithm: environment === AppConstants.NETWORKS.MAINNET.NAME ? AppConstants.ENCRYPTION.ED25519 : AppConstants.ENCRYPTION.SECP256K1,
                    });
               }

               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nSetting Trustline\n\n`;

               const { result: feeResponse } = await client.request({ command: 'fee' });

               let cur;
               if (this.currencyField.length > 3) {
                    cur = this.utilsService.encodeCurrencyCode(this.currencyField);
               } else {
                    cur = this.currencyField;
               }

               if (!/^[A-Z0-9]{3}$|^[0-9A-Fa-f]{40}$/.test(cur)) {
                    throw new Error('Invalid currency code. Must be a 3-character code (e.g., USDC) or 40-character hex.');
               }

               // let tx;
               // if (this.ticketSequence) {
               //      const currentLedger = await this.xrplService.getLastLedgerIndex(client);
               //      const trustSetTx: TrustSet = {
               //           TransactionType: 'TrustSet',
               //           Account: wallet.classicAddress,
               //           TicketSequence: Number(this.ticketSequence),
               //           LimitAmount: {
               //                currency: cur,
               //                issuer: this.destinationField,
               //                value: this.amountField,
               //           },
               //           Fee: feeResponse.drops.open_ledger_fee || '12',
               //           LastLedgerSequence: currentLedger + 20,
               //      };

               //      console.log(`trustSetTx ${JSON.stringify(trustSetTx, null, 2)} \nto create ${this.currencyField} trust line from ${this.destinationField}`);
               //      const signed = wallet.sign(trustSetTx);
               //      console.log(`signed ${JSON.stringify(signed, null, 2)}`);
               //      tx = await client.submitAndWait(signed.tx_blob);
               //      console.log(`Trustline tx ${JSON.stringify(tx, null, 2)}`);
               // } else {
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);
               const trustSetTx: TrustSet = {
                    TransactionType: 'TrustSet',
                    Account: wallet.classicAddress,
                    LimitAmount: {
                         currency: cur,
                         issuer: this.destinationField,
                         value: this.amountField,
                    },
                    Fee: feeResponse.drops.open_ledger_fee || '12',
                    LastLedgerSequence: currentLedger + 20,
               };

               console.log(`Submitting TrustSet ${trustSetTx} to create ${this.currencyField} trust line from ${this.destinationField}`);

               const preparedTx = await client.autofill(trustSetTx);
               const signedTx = wallet.sign(preparedTx);
               const tx = await client.submitAndWait(signedTx.tx_blob);
               console.log('Create Trustline tx', tx);
               // }

               if (tx.result.meta && typeof tx.result.meta !== 'string' && (tx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, wallet.classicAddress);
               this.ownerCount = ownerCount;
               this.totalXrpReserves = totalXrpReserves;
               const balance = (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0');

               if (this.selectedAccount === 'account1') {
                    this.account1.balance = balance.toString();
               } else if (this.selectedAccount === 'account2') {
                    this.account1.balance = balance.toString();
               } else {
                    this.account1.balance = balance.toString();
               }
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving setTrustLine in ${this.executionTime}ms`);
          }
     }

     async removeTrustline() {
          console.log('Entering removeTrustline');
          const startTime = Date.now();
          this.setSuccessProperties();

          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }

          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed;
          if (!this.utilsService.validatInput(seed)) {
               return this.setError('ERROR: Account seed cannot be empty');
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();

               let wallet;
               if (seed.split(' ').length > 1) {
                    wallet = xrpl.Wallet.fromMnemonic(seed, {
                         algorithm: environment === AppConstants.NETWORKS.MAINNET.NAME ? AppConstants.ENCRYPTION.ED25519 : AppConstants.ENCRYPTION.SECP256K1,
                    });
               } else {
                    wallet = xrpl.Wallet.fromSeed(seed, {
                         algorithm: environment === AppConstants.NETWORKS.MAINNET.NAME ? AppConstants.ENCRYPTION.ED25519 : AppConstants.ENCRYPTION.SECP256K1,
                    });
               }

               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nRemoving Trustline\n\n`;

               // const trustLines = await this.utilsService.getTrustlines(seed, environment);
               const trustLines = await this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', '');
               console.debug(`All trust lines for ${wallet.classicAddress}:`, trustLines);

               // const activeTrustLine = trustLines.result.lines.filter((line: any) => parseFloat(line.limit) > 0);
               // console.debug(`Active trust lines for ${wallet.classicAddress}:`, activeTrustLine);

               const activeTrustLine = trustLines.result.lines.filter((line: any) => {
                    // Decode currency for comparison
                    const decodedCurrency = line.currency.length > 3 ? this.utilsService.decodeCurrencyCode(line.currency) : line.currency;
                    return (
                         parseFloat(line.limit) > 0 &&
                         parseFloat(line.balance) > 0 &&
                         line.account === this.destinationField && // Use 'account' as the issuer field
                         (this.currencyField ? decodedCurrency === this.currencyField : true)
                    );
               });
               console.debug(`Active trust lines for ${wallet.classicAddress}:`, activeTrustLine);

               // If no trust lines, return early
               if (activeTrustLine.length === 0) {
                    console.log(`No trust lines found for ${wallet.classicAddress}`);
                    this.resultField.nativeElement.innerHTML = `No trust lines found for ${wallet.classicAddress}`;
                    this.resultField.nativeElement.classList.add('error');
                    const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, wallet.classicAddress);
                    this.ownerCount = ownerCount;
                    this.totalXrpReserves = totalXrpReserves;
                    const balance = (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0');
                    this.setErrorProperties();
                    return;
               }

               const targetLine: TrustLine | undefined = (activeTrustLine as TrustLine[]).find((line: TrustLine) => line.account === this.destinationField && line.currency === this.currencyField);

               if (!targetLine) {
                    return this.setError(`ERROR: No trust line found for ${this.currencyField} from ${this.destinationField}.`);
               }

               if (parseFloat(targetLine.balance) !== 0) {
                    return this.setError(`ERROR: Cannot remove trust line: Balance is ${targetLine.balance}. Balance must be 0.`);
               }

               const { result: feeResponse } = await client.request({ command: 'fee' });

               if (this.currencyField.length > 3) {
                    this.currencyField = this.utilsService.encodeCurrencyCode(this.currencyField);
               }

               const currentLedger = await this.xrplService.getLastLedgerIndex(client);
               const trustSetTx: TrustSet = {
                    TransactionType: 'TrustSet',
                    Account: wallet.classicAddress,
                    LimitAmount: {
                         currency: this.currencyField,
                         issuer: this.destinationField,
                         value: '0',
                    },
                    Fee: feeResponse.drops.open_ledger_fee,
                    LastLedgerSequence: currentLedger + 20,
               };

               // if (this.ticketSequence) {
               //      trustSetTx.TicketSequence = Number(this.ticketSequence);
               // }

               console.log(`Submitting TrustSet ${trustSetTx} to remove ${this.currencyField} trust line from ${this.destinationField}`);

               const preparedTx = await client.autofill(trustSetTx);
               const signedTx = wallet.sign(preparedTx);
               const tx = await client.submitAndWait(signedTx.tx_blob);

               console.log('Create Trustline tx', tx);

               if (tx.result.meta && typeof tx.result.meta !== 'string' && (tx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, wallet.classicAddress);
               this.ownerCount = ownerCount;
               this.totalXrpReserves = totalXrpReserves;
               const balance = (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0');

               if (this.selectedAccount === 'account1') {
                    this.account1.balance = balance.toString();
               } else if (this.selectedAccount === 'account2') {
                    this.account1.balance = balance.toString();
               } else {
                    this.account1.balance = balance.toString();
               }
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving removeTrustline in ${this.executionTime}ms`);
          }
     }

     async issueCurrency() {
          console.log('Entering issueCurrency');
          const startTime = Date.now();
          this.setSuccessProperties();

          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }

          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed;
          if (!this.utilsService.validatInput(seed)) {
               return this.setError('ERROR: Account seed cannot be empty');
          }

          if (!this.utilsService.validatInput(this.amountField)) {
               return this.setError('ERROR: Currency Amount cannot be empty');
          }

          if (!this.utilsService.validatInput(this.destinationField)) {
               return this.setError('ERROR: Destination cannot be empty');
          }

          if (parseFloat(this.amountField) <= 0) {
               return this.setError('ERROR: Currency Amount must be a positive number');
          }

          const currencyBalanceField = document.getElementById('currencyBalanceField') as HTMLInputElement | null;
          if (parseFloat(this.amountField) > parseFloat(currencyBalanceField?.value || '0')) {
               return this.setError('ERROR: Currency Amount must be less than the currecny balance.');
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();

               let wallet;
               if (seed.split(' ').length > 1) {
                    wallet = xrpl.Wallet.fromMnemonic(seed, {
                         algorithm: environment === AppConstants.NETWORKS.MAINNET.NAME ? AppConstants.ENCRYPTION.ED25519 : AppConstants.ENCRYPTION.SECP256K1,
                    });
               } else {
                    wallet = xrpl.Wallet.fromSeed(seed, {
                         algorithm: environment === AppConstants.NETWORKS.MAINNET.NAME ? AppConstants.ENCRYPTION.ED25519 : AppConstants.ENCRYPTION.SECP256K1,
                    });
               }

               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nIssuing Currency\n\n`;

               const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
               if (accountInfo == null) {
                    return this.setError(`Issuer account ${wallet.classicAddress} is not funded.`);
               }
               console.log('accountInfo', accountInfo);

               const trustLines = await this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', '');
               const activeTrustLine = trustLines.result.lines.filter((line: any) => {
                    // Decode currency for comparison
                    const decodedCurrency = line.currency.length > 3 ? this.utilsService.decodeCurrencyCode(line.currency) : line.currency;
                    return parseFloat(line.limit) > 0 && parseFloat(line.balance) > 0 && line.account === this.destinationField && (this.destinationField ? decodedCurrency === this.currencyField : true);
               });
               console.debug(`Active trust lines for ${wallet.classicAddress}:`, activeTrustLine);

               type Section = {
                    title: string;
                    openByDefault: boolean;
                    content?: { key: string; value: string }[];
                    subItems?: {
                         key: string;
                         openByDefault: boolean;
                         content: { key: string; value: string }[];
                    }[];
               };
               const data: { sections: Section[] } = {
                    sections: [],
               };

               const activeTrustLines: TrustLine[] = (activeTrustLine as TrustLine[]).filter((line: TrustLine) => parseFloat(line.limit) > 0);
               if (activeTrustLines.length === 0) {
                    data.sections.push({
                         title: 'Trust Lines',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No active trust lines found from <code>${wallet.classicAddress}</code> to <code>${this.destinationField}</code>` }],
                    });
               } else {
                    data.sections.push({
                         title: 'Trust Lines',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `Trust lines found from <code>${wallet.classicAddress}</code> to <code>${this.destinationField}</code>` }],
                    });
               }

               // const destinationTrustLines = await this.xrplService.getAccountLines(client, this.destinationField, 'validated', '');
               // const activeDestinationTrustLine = destinationTrustLines.result.lines.filter((line: any) => {
               //      // Decode currency for comparison
               //      const decodedCurrency = line.currency.length > 3 ? this.utilsService.decodeCurrencyCode(line.currency) : line.currency;
               //      return parseFloat(line.limit) > 0 && parseFloat(line.balance) > 0 && line.account === this.destinationField && (this.destinationField ? decodedCurrency === this.currencyField : true);
               // });
               // console.debug(`Active trust lines for ${this.destinationField}:`, activeDestinationTrustLine);

               // const activeDestinationTrustLines: TrustLine[] = (activeDestinationTrustLine as TrustLine[]).filter((line: TrustLine) => parseFloat(line.limit) > 0);
               // if (activeDestinationTrustLines.length === 0) {
               //      data.sections.push({
               //           title: 'Trust Lines',
               //           openByDefault: true,
               //           content: [{ key: 'Status', value: `No active trust lines found from <code>${this.destinationField}</code> to <code>${wallet.classicAddress}</code>` }],
               //      });
               // }

               let tx = null;
               const accountFlags = accountInfo.result.account_data.Flags;
               const asfDefaultRipple = 0x00800000;
               let lastLedgerIndex = await this.xrplService.getLastLedgerIndex(client);

               if ((accountFlags & asfDefaultRipple) === 0) {
                    const networkFee = await this.xrplService.getTransactionFee(client);
                    const accountSetTx: AccountSet = {
                         TransactionType: 'AccountSet',
                         Account: wallet.classicAddress,
                         SetFlag: 8, // asfDefaultRipple
                         LastLedgerSequence: lastLedgerIndex + 20,
                         Fee: networkFee,
                    };

                    const preparedAccountSet = await client.autofill(accountSetTx);
                    const signedAccountSet = wallet.sign(preparedAccountSet);
                    tx = await client.submitAndWait(signedAccountSet.tx_blob);

                    if (tx.result.meta && typeof tx.result.meta !== 'string' && (tx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                         this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
                         this.resultField.nativeElement.classList.add('error');
                         this.setErrorProperties();
                         return;
                    }

                    this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.result);

                    console.log('DefaultRipple enabled', JSON.stringify(tx, null, 2));
                    data.sections.push({
                         title: 'DefaultRipple Enabled',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `Enabled via AccountSet transaction for <code>${wallet.classicAddress}</code>` }],
                    });
               } else {
                    data.sections.push({
                         title: 'DefaultRipple Enabled',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `Default Ripple already enable for <code>${wallet.classicAddress}</code>` }],
                    });
               }

               lastLedgerIndex = await this.xrplService.getLastLedgerIndex(client);
               const networkFee = await this.xrplService.getTransactionFee(client);

               const curr = this.currencyField.length > 3 ? this.utilsService.decodeCurrencyCode(this.currencyField) : this.currencyField;
               const paymentTx: Payment = {
                    TransactionType: 'Payment',
                    Account: wallet.classicAddress,
                    Destination: this.destinationField,
                    Amount: {
                         currency: curr,
                         value: this.amountField,
                         issuer: wallet.classicAddress,
                    },
                    Fee: networkFee,
                    LastLedgerSequence: lastLedgerIndex + 20,
               };

               const pay_prepared = await client.autofill(paymentTx);
               const pay_signed = wallet.sign(pay_prepared);
               const pay_result = await client.submitAndWait(pay_signed.tx_blob);

               if (pay_result.result.meta && typeof pay_result.result.meta !== 'string' && (pay_result.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(pay_result, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               // New Balance section
               const updatedTrustLines = await this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', '');
               interface UpdatedTrustLine {
                    account: string;
                    currency: string;
                    balance: string;
                    [key: string]: any;
               }

               console.log(`updatedTrustLines ${JSON.stringify(updatedTrustLines.result, null, 2)}`);
               const newTrustLine: UpdatedTrustLine | undefined = updatedTrustLines.result.lines.find((line: UpdatedTrustLine) => line.account === wallet.classicAddress && line.currency === this.utilsService.decodeCurrencyCode(this.currencyField));
               data.sections.push({
                    title: 'New Balance',
                    openByDefault: true,
                    content: [
                         {
                              key: 'Destination',
                              value: `<code>${this.destinationField}</code>`,
                         },
                         {
                              key: 'Currency',
                              value: this.currencyField,
                         },
                         {
                              key: 'Balance',
                              value: newTrustLine ? newTrustLine.balance : 'Unknown',
                         },
                    ],
               });

               // Issuer Obligations section
               const gatewayBalances = await this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '');
               if (gatewayBalances.result.obligations && Object.keys(gatewayBalances.result.obligations).length > 0) {
                    data.sections.push({
                         title: `Issuer Obligations (${Object.keys(gatewayBalances.result.obligations).length})`,
                         openByDefault: true,
                         subItems: Object.entries(gatewayBalances.result.obligations).map(([oblCurrency, amount], index) => ({
                              key: `Obligation ${index + 1} (${oblCurrency})`,
                              openByDefault: false,
                              content: [
                                   { key: 'Currency', value: oblCurrency },
                                   { key: 'Amount', value: amount },
                              ],
                         })),
                    });
               } else {
                    data.sections.push({
                         title: 'Issuer Obligations',
                         openByDefault: true,
                         content: [{ key: 'Status', value: 'No obligations issued' }],
                    });
               }

               // Account Details section
               data.sections.push({
                    title: 'Account Details',
                    openByDefault: true,
                    content: [
                         { key: 'Issuer Address', value: `<code>${wallet.classicAddress}</code>` },
                         { key: 'Destination Address', value: `<code>${this.destinationField}</code>` },
                         { key: 'XRP Balance (Issuer)', value: (await client.getXrpBalance(wallet.classicAddress)).toString() },
                    ],
               });

               this.utilsService.renderPaymentChannelDetails(data);
               this.utilsService.renderTransactionsResults1(pay_result, this.resultField.nativeElement, false);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving issueCurrency in ${this.executionTime}ms`);
          }
     }

     async onCurrencyChange() {
          const currencyField = document.getElementById('currencyField') as HTMLInputElement | null;
          const currencyBalanceField = document.getElementById('currencyBalanceField') as HTMLInputElement | null;
          const accountAddress1Field = document.getElementById('accountAddress1Field') as HTMLInputElement | null;
          if (!this.selectedAccount) {
               this.setError('Please select an account');
               if (currencyBalanceField) {
                    currencyBalanceField.value = '0';
               }
               this.setErrorProperties();
               return;
          }
          const address = this.selectedAccount === 'account1' ? this.account1.address : this.account2.address;
          if (!this.utilsService.validatInput(address)) {
               this.setError('ERROR: Account address cannot be empty');
               if (currencyBalanceField) {
                    currencyBalanceField.value = '0';
               }
               this.setErrorProperties();
               return;
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();

               this.spinner = true;
               let balance: string;
               const currencyCode = currencyField && currencyField.value.length > 3 ? this.utilsService.encodeCurrencyCode(currencyField.value) : currencyField ? currencyField.value : '';
               if (accountAddress1Field) {
                    const balanceResult = await this.utilsService.getCurrencyBalance(currencyCode, accountAddress1Field);
                    balance = balanceResult !== null ? balanceResult.toString() : '0';
                    if (currencyBalanceField) {
                         currencyBalanceField.value = balance;
                    }
               } else {
                    if (currencyBalanceField) {
                         currencyBalanceField.value = '0';
                    }
               }

               // Fetch token balances
               const gatewayBalances = await this.xrplService.getTokenBalance(client, address, 'validated', '');
               console.log('gatewayBalances', gatewayBalances);

               // Prepare data for rendering
               interface SectionContent {
                    key: string;
                    value: string;
               }

               interface SectionSubItem {
                    key: string;
                    openByDefault: boolean;
                    content: SectionContent[];
               }

               interface Section {
                    title: string;
                    openByDefault: boolean;
                    content?: SectionContent[];
                    subItems?: SectionSubItem[];
               }

               const data: { sections: Section[] } = {
                    sections: [],
               };

               interface SectionContent {
                    key: string;
                    value: string;
               }

               interface SectionSubItem {
                    key: string;
                    openByDefault: boolean;
                    content: SectionContent[];
               }

               interface Section {
                    title: string;
                    openByDefault: boolean;
                    content?: SectionContent[];
                    subItems?: SectionSubItem[];
               }

               // Obligations section (tokens issued by the account)
               if (gatewayBalances.result.obligations && Object.keys(gatewayBalances.result.obligations).length > 0) {
                    data.sections.push({
                         title: `Issuer Obligations (${Object.keys(gatewayBalances.result.obligations).length})`,
                         openByDefault: true,
                         subItems: Object.entries(gatewayBalances.result.obligations).map(([oblCurrency, amount], index) => {
                              // Decode if length > 3
                              const displayCurrency = oblCurrency.length > 3 ? this.utilsService.decodeCurrencyCode(oblCurrency) : oblCurrency;
                              return {
                                   key: `Obligation ${index + 1} (${displayCurrency})`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Currency', value: displayCurrency },
                                        { key: 'Amount', value: amount },
                                   ],
                              };
                         }),
                    });
               } else {
                    data.sections.push({
                         title: 'Issuer Obligations',
                         openByDefault: true,
                         content: [{ key: 'Status', value: 'No obligations issued' }],
                    });
               }

               // Balances section (tokens held by the account)
               if (gatewayBalances.result.assets && Object.keys(gatewayBalances.result.assets).length > 0) {
                    const balanceItems = [];
                    for (const [issuer, currencies] of Object.entries(gatewayBalances.result.assets)) {
                         for (const { currency, value } of currencies) {
                              let displayCurrency = currency;
                              if (currency.length > 3) {
                                   const tempCurrency = currency;
                                   displayCurrency = this.utilsService.decodeCurrencyCode(currency);
                                   if (displayCurrency.length > 8) {
                                        displayCurrency = tempCurrency;
                                   }
                              }
                              balanceItems.push({
                                   key: `${displayCurrency} from ${issuer.slice(0, 8)}...`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Currency', value: displayCurrency },
                                        { key: 'Issuer', value: `<code>${issuer}</code>` },
                                        { key: 'Amount', value: value },
                                   ],
                              });
                         }
                    }
                    data.sections.push({
                         title: `Balances (${balanceItems.length})`,
                         openByDefault: true,
                         subItems: balanceItems,
                    });
               } else {
                    data.sections.push({
                         title: 'Balances',
                         openByDefault: true,
                         content: [{ key: 'Status', value: 'No balances (tokens held by you)' }],
                    });
               }

               this.utilsService.renderPaymentChannelDetails(data);
          } catch (error: any) {
               console.error('Error fetching weWant balance:', error);
               if (currencyBalanceField) {
                    currencyBalanceField.value = '0';
               }
               return this.setError(`ERROR: Failed to fetch balance - ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.cdr.detectChanges();
          }
     }

     async displayDataForAccount1() {
          const account1name = this.storageService.getInputValue('account1name');
          const account1address = this.storageService.getInputValue('account1address');
          const account1seed = this.storageService.getInputValue('account1seed');
          const account1mnemonic = this.storageService.getInputValue('account1mnemonic');
          const account1secretNumbers = this.storageService.getInputValue('account1secretNumbers');

          const accountName1Field = document.getElementById('accountName1Field') as HTMLInputElement | null;
          const accountAddress1Field = document.getElementById('accountAddress1Field') as HTMLInputElement | null;
          const accountSeed1Field = document.getElementById('accountSeed1Field') as HTMLInputElement | null;

          if (accountName1Field) accountName1Field.value = account1name || AppConstants.EMPTY_STRING;
          if (accountAddress1Field) accountAddress1Field.value = account1address || AppConstants.EMPTY_STRING;
          if (accountSeed1Field) {
               if (account1seed === AppConstants.EMPTY_STRING) {
                    if (account1mnemonic === AppConstants.EMPTY_STRING) {
                         accountSeed1Field.value = account1secretNumbers || AppConstants.EMPTY_STRING;
                    } else {
                         accountSeed1Field.value = account1mnemonic || AppConstants.EMPTY_STRING;
                    }
               } else {
                    accountSeed1Field.value = account1seed || AppConstants.EMPTY_STRING;
               }
          }

          await this.onCurrencyChange();
          await this.getTrustlinesForAccount();
     }

     async displayDataForAccount2() {
          const account2name = this.storageService.getInputValue('account2name');
          const account2address = this.storageService.getInputValue('account2address');
          const account2seed = this.storageService.getInputValue('account2seed');
          const account2mnemonic = this.storageService.getInputValue('account2mnemonic');
          const account2secretNumbers = this.storageService.getInputValue('account2secretNumbers');

          const accountName1Field = document.getElementById('accountName1Field') as HTMLInputElement | null;
          const accountAddress1Field = document.getElementById('accountAddress1Field') as HTMLInputElement | null;
          const accountSeed1Field = document.getElementById('accountSeed1Field') as HTMLInputElement | null;

          if (accountName1Field) accountName1Field.value = account2name || AppConstants.EMPTY_STRING;
          if (accountAddress1Field) accountAddress1Field.value = account2address || AppConstants.EMPTY_STRING;
          if (accountSeed1Field) {
               if (account2seed === AppConstants.EMPTY_STRING) {
                    if (account2mnemonic === AppConstants.EMPTY_STRING) {
                         accountSeed1Field.value = account2secretNumbers || AppConstants.EMPTY_STRING;
                    } else {
                         accountSeed1Field.value = account2mnemonic || AppConstants.EMPTY_STRING;
                    }
               } else {
                    accountSeed1Field.value = account2seed || AppConstants.EMPTY_STRING;
               }
          }

          await this.onCurrencyChange();
          await this.getTrustlinesForAccount();
     }

     async displayDataForAccount3() {
          const issuerName = this.storageService.getInputValue('issuerName');
          const issuerAddress = this.storageService.getInputValue('issuerAddress');
          const issuerSeed = this.storageService.getInputValue('issuerSeed');
          const issuerMnemonic = this.storageService.getInputValue('issuerMnemonic');
          const issuerSecretNumbers = this.storageService.getInputValue('issuerSecretNumbers');

          const accountName1Field = document.getElementById('accountName1Field') as HTMLInputElement | null;
          const accountAddress1Field = document.getElementById('accountAddress1Field') as HTMLInputElement | null;
          const accountSeed1Field = document.getElementById('accountSeed1Field') as HTMLInputElement | null;

          if (accountName1Field) accountName1Field.value = issuerName || AppConstants.EMPTY_STRING;
          if (accountAddress1Field) accountAddress1Field.value = issuerAddress || AppConstants.EMPTY_STRING;
          if (accountSeed1Field) {
               if (issuerSeed === AppConstants.EMPTY_STRING) {
                    if (issuerMnemonic === AppConstants.EMPTY_STRING) {
                         accountSeed1Field.value = issuerSecretNumbers || AppConstants.EMPTY_STRING;
                    } else {
                         accountSeed1Field.value = issuerMnemonic || AppConstants.EMPTY_STRING;
                    }
               } else {
                    accountSeed1Field.value = issuerSeed || AppConstants.EMPTY_STRING;
               }
          }

          await this.onCurrencyChange();
          await this.getTrustlinesForAccount();
     }

     private setErrorProperties() {
          this.isSuccess = false;
          this.isError = true;
          this.spinner = false;
     }

     private setError(message: string) {
          this.setErrorProperties();
          this.handleTransactionResult({
               result: `${message}`,
               isError: this.isError,
               isSuccess: this.isSuccess,
          });
     }

     private setSuccessProperties() {
          this.isSuccess = true;
          this.isError = false;
          this.spinner = true;
          this.result = '';
     }

     private setSuccess(message: string) {
          this.setSuccessProperties();
          this.handleTransactionResult({
               result: `${message}`,
               isError: this.isError,
               isSuccess: this.isSuccess,
          });
     }
}
