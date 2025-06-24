import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { StorageService } from '../../services/storage.service';
import * as xrpl from 'xrpl';
import { AccountSet, TrustSet, TransactionMetadataBase } from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';
import { WalletMultiInputComponent } from '../wallet-multi-input/wallet-multi-input.component';
import { secretNumbers } from 'xrpl-accountlib/dist/generate';

interface TrustLine {
     account: string;
     balance: string;
     currency: string;
     limit: string;
     limit_peer: string;
     no_ripple: boolean;
     no_ripple_peer: boolean;
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
     private lastResult: string = AppConstants.EMPTY_STRING;
     transactionInput = AppConstants.EMPTY_STRING;
     result: string = AppConstants.EMPTY_STRING;
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = true;
     currencyField: string = '';
     currencyBalanceField: string = '';
     destinationField: string = '';
     amountField: string = '';
     account1 = { name: AppConstants.EMPTY_STRING, address: AppConstants.EMPTY_STRING, seed: AppConstants.EMPTY_STRING, mnemonic: AppConstants.EMPTY_STRING, secretNumbers: AppConstants.EMPTY_STRING, balance: AppConstants.EMPTY_STRING };
     account2 = { name: AppConstants.EMPTY_STRING, address: AppConstants.EMPTY_STRING, seed: AppConstants.EMPTY_STRING, mnemonic: AppConstants.EMPTY_STRING, secretNumbers: AppConstants.EMPTY_STRING, balance: AppConstants.EMPTY_STRING };
     issuer = { name: AppConstants.EMPTY_STRING, address: AppConstants.EMPTY_STRING, seed: AppConstants.EMPTY_STRING, mnemonic: AppConstants.EMPTY_STRING, secretNumbers: AppConstants.EMPTY_STRING, balance: AppConstants.EMPTY_STRING };
     ownerCount = AppConstants.EMPTY_STRING;
     totalXrpReserves = AppConstants.EMPTY_STRING;
     executionTime = AppConstants.EMPTY_STRING;
     isMultiSign = false;
     multiSignAddress = AppConstants.EMPTY_STRING;
     isUpdateMetaData = false;
     tickSize = AppConstants.EMPTY_STRING;
     transferRate = AppConstants.EMPTY_STRING;
     isMessageKey = false;
     domain = AppConstants.EMPTY_STRING;
     memo = AppConstants.EMPTY_STRING;
     spinner = false;

     constructor(private xrplService: XrplService, private utilsService: UtilsService, private cdr: ChangeDetectorRef, private storageService: StorageService) {}

     ngAfterViewInit() {
          // this.account1 = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '' };
          // this.account2 = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '' };
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
          this.spinner = true;
          this.isError = false;
          this.isSuccess = false;

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

               const trustLines = await this.utilsService.getTrustlines(seed, environment);

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

               const activeTrustLines: TrustLine[] = (trustLines as TrustLine[]).filter((line: TrustLine) => parseFloat(line.limit) > 0);
               if (activeTrustLines.length === 0) {
                    data.sections.push({
                         title: 'Trust Lines',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No active trust lines found for <code>${wallet.classicAddress}</code>` }],
                    });
               } else {
                    data.sections.push({
                         title: `Trust Lines (${activeTrustLines.length})`,
                         openByDefault: true,
                         subItems: activeTrustLines.map((line, index) => {
                              const displayCurrency = line.currency.length > 3 ? this.utilsService.decodeCurrencyCode(line.currency) : line.currency;
                              return {
                                   key: `Trust Line ${index + 1} (${displayCurrency})`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Currency', value: displayCurrency },
                                        { key: 'Account', value: `<code>${line.account}</code>` },
                                        { key: 'Limit', value: line.limit },
                                        { key: 'Balance', value: line.balance },
                                        { key: 'Limit Peer', value: line.limit_peer },
                                        { key: 'No Ripple', value: String(line.no_ripple) },
                                        { key: 'No Ripple Peer', value: String(line.no_ripple_peer) },
                                        { key: 'Quality In', value: String(line.quality_in) },
                                        { key: 'Quality Out', value: String(line.quality_out) },
                                   ],
                              };
                         }),
                    });
               }

               this.utilsService.renderPaymentChannelDetails(data);

               this.isSuccess = true;
               this.handleTransactionResult({
                    result: this.result,
                    isError: this.isError,
                    isSuccess: this.isSuccess,
               });

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
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getTrustlinesForAccount in ${this.executionTime}ms`);
          }
     }

     async setTrustLine() {
          console.log('Entering setTrustLine');
          const startTime = Date.now();
          this.spinner = true;
          this.isError = false;
          this.isSuccess = false;
          this.result = AppConstants.EMPTY_STRING;

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

               const { result: feeResponse } = await client.request({ command: 'fee' });

               let cur;
               if (this.currencyField.length > 3) {
                    cur = this.utilsService.encodeCurrencyCode(this.currencyField);
               } else {
                    cur = this.currencyField;
               }

               const trustSetTx: TrustSet = {
                    TransactionType: 'TrustSet',
                    Account: wallet.classicAddress,
                    LimitAmount: {
                         currency: cur,
                         issuer: this.destinationField,
                         value: this.amountField,
                    },
                    Fee: feeResponse.drops.open_ledger_fee,
               };

               console.log(`Submitting TrustSet ${trustSetTx} to create ${this.currencyField} trust line from ${this.destinationField}`);

               const preparedTx = await client.autofill(trustSetTx);
               const signedTx = wallet.sign(preparedTx);
               const tx = await client.submitAndWait(signedTx.tx_blob);

               console.log('Create Trustline tx', tx);

               if (tx.result.meta && typeof tx.result.meta !== 'string' && (tx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    return;
               }

               this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');

               this.isSuccess = true;
               this.handleTransactionResult({
                    result: this.result,
                    isError: this.isError,
                    isSuccess: this.isSuccess,
               });

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
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving setTrustLine in ${this.executionTime}ms`);
          }
     }

     async removeTrustline() {
          console.log('Entering removeTrustline');
          const startTime = Date.now();
          this.spinner = true;
          this.isError = false;
          this.isSuccess = false;

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

               const trustLines = await this.utilsService.getTrustlines(seed, environment);

               // If no trust lines, return early
               if (trustLines.length === 0) {
                    console.log(`No trust lines found for ${wallet.classicAddress}`);
                    this.resultField.nativeElement.innerHTML = `No trust lines found for ${wallet.classicAddress}`;
                    this.resultField.nativeElement.classList.add('error');
                    const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, wallet.classicAddress);
                    this.ownerCount = ownerCount;
                    this.totalXrpReserves = totalXrpReserves;
                    const balance = (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0');
                    return;
               }

               const targetLine: TrustLine | undefined = (trustLines as TrustLine[]).find((line: TrustLine) => line.account === this.destinationField && line.currency === this.currencyField);

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

               const trustSetTx: TrustSet = {
                    TransactionType: 'TrustSet',
                    Account: wallet.classicAddress,
                    LimitAmount: {
                         currency: this.currencyField,
                         issuer: this.destinationField,
                         value: '0',
                    },
                    Fee: feeResponse.drops.open_ledger_fee,
               };

               console.log(`Submitting TrustSet ${trustSetTx} to remove ${this.currencyField} trust line from ${this.destinationField}`);

               const preparedTx = await client.autofill(trustSetTx);
               const signedTx = wallet.sign(preparedTx);
               const tx = await client.submitAndWait(signedTx.tx_blob);

               console.log('Create Trustline tx', tx);

               if (tx.result.meta && typeof tx.result.meta !== 'string' && (tx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    return;
               }

               this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');

               this.isSuccess = true;
               this.handleTransactionResult({
                    result: this.result,
                    isError: this.isError,
                    isSuccess: this.isSuccess,
               });

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
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving removeTrustline in ${this.executionTime}ms`);
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
               return;
          }
          const address = this.selectedAccount === 'account1' ? this.account1.address : this.account2.address;
          if (!this.utilsService.validatInput(address)) {
               this.setError('ERROR: Account address cannot be empty');
               if (currencyBalanceField) {
                    currencyBalanceField.value = '0';
               }
               return;
          }

          try {
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
          } catch (error: any) {
               console.error('Error fetching weWant balance:', error);
               this.setError(`ERROR: Failed to fetch balance - ${error.message || 'Unknown error'}`);
               if (currencyBalanceField) {
                    currencyBalanceField.value = '0';
               }
          } finally {
               this.spinner = false;
               this.cdr.detectChanges();
          }
     }

     async displayDataForAccount1() {
          const startTime = Date.now();
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

          try {
               const client = await this.xrplService.getClient();
               const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, account1address);
               this.ownerCount = ownerCount;
               this.totalXrpReserves = totalXrpReserves;
               this.account1.balance = ((await client.getXrpBalance(account1address)) - parseFloat(this.totalXrpReserves || '0')).toString();
               console.log(`balance ${this.account1.balance}`);
          } catch (error: any) {
               this.setError(error.message);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving displayDataForAccount1 in ${this.executionTime}ms`);
          }

          await this.onCurrencyChange();
          await this.getTrustlinesForAccount();
     }

     async displayDataForAccount2() {
          const startTime = Date.now();
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

          try {
               const client = await this.xrplService.getClient();
               const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, account2address);
               this.ownerCount = ownerCount;
               this.totalXrpReserves = totalXrpReserves;
               this.account1.balance = ((await client.getXrpBalance(account2address)) - parseFloat(this.totalXrpReserves || '0')).toString();
               console.log(`balance ${this.account1.balance}`);
          } catch (error: any) {
               this.setError(error.message);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving displayDataForAccount2 in ${this.executionTime}ms`);
          }

          await this.onCurrencyChange();
          await this.getTrustlinesForAccount();
     }

     async displayDataForAccount3() {
          const startTime = Date.now();
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

          try {
               const client = await this.xrplService.getClient();
               const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, issuerAddress);
               this.ownerCount = ownerCount;
               this.totalXrpReserves = totalXrpReserves;
               this.account1.balance = ((await client.getXrpBalance(issuerAddress)) - parseFloat(this.totalXrpReserves || '0')).toString();
               console.log(`balance ${this.account1.balance}`);
          } catch (error: any) {
               this.setError(error.message);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving displayDataForAccount3 in ${this.executionTime}ms`);
          }

          await this.getTrustlinesForAccount();
     }

     private setError(message: string) {
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

     private async submitFlagTransaction(client: xrpl.Client, wallet: xrpl.Wallet, flagPayload: any) {
          console.log('Entering submitFlagTransaction');
          const startTime = Date.now();

          const tx = {
               TransactionType: 'AccountSet',
               Account: wallet.classicAddress,
               ...flagPayload,
          };

          try {
               const response = await client.submitAndWait(tx, { wallet });
               return {
                    success: true,
                    message: response,
               };
          } catch (error: any) {
               return { success: false, message: `ERROR submitting flag: ${error.message}` };
          } finally {
               console.log(`Leaving submitFlagTransaction in ${Date.now() - startTime}ms`);
          }
     }
}
