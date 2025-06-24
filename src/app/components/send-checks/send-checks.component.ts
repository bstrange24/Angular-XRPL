import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { WalletInputComponent } from '../wallet-input/wallet-input.component';
import { StorageService } from '../../services/storage.service';
import { CheckCreate, CheckCash, CheckCancel, TransactionMetadataBase } from 'xrpl';
import * as xrpl from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';

@Component({
     selector: 'app-send-checks',
     standalone: true,
     imports: [CommonModule, FormsModule, WalletInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './send-checks.component.html',
     styleUrl: './send-checks.component.css',
})
export class SendChecksComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     selectedAccount: 'account1' | 'account2' | null = null;
     private lastResult: string = AppConstants.EMPTY_STRING;
     private intervalId: any;
     transactionInput = AppConstants.EMPTY_STRING;
     result: string = AppConstants.EMPTY_STRING;
     currencyFieldDropDownValue: string = 'XRP';
     checkExpirationTime: string = 'seconds';
     expirationTimeField = AppConstants.EMPTY_STRING;
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = true;
     account1 = { name: AppConstants.EMPTY_STRING, address: AppConstants.EMPTY_STRING, seed: AppConstants.EMPTY_STRING, secretNumbers: AppConstants.EMPTY_STRING, mnemonic: AppConstants.EMPTY_STRING, balance: AppConstants.EMPTY_STRING };
     account2 = { name: AppConstants.EMPTY_STRING, address: AppConstants.EMPTY_STRING, seed: AppConstants.EMPTY_STRING, secretNumbers: AppConstants.EMPTY_STRING, mnemonic: AppConstants.EMPTY_STRING, balance: AppConstants.EMPTY_STRING };
     xrpBalance1Field = AppConstants.EMPTY_STRING;
     checkIdField = AppConstants.EMPTY_STRING;
     ownerCount = AppConstants.EMPTY_STRING;
     totalXrpReserves = AppConstants.EMPTY_STRING;
     executionTime = AppConstants.EMPTY_STRING;
     amountField = AppConstants.EMPTY_STRING;
     destinationField = AppConstants.EMPTY_STRING;
     // currentTimeField = AppConstants.EMPTY_STRING;
     memoField = AppConstants.EMPTY_STRING;
     spinner = false;
     issuers: string[] = [];
     selectedIssuer: string = AppConstants.EMPTY_STRING;
     tokenBalance: string = AppConstants.EMPTY_STRING;

     constructor(private xrplService: XrplService, private utilsService: UtilsService, private cdr: ChangeDetectorRef, private storageService: StorageService) {}

     async ngOnInit(): Promise<void> {
          console.log('DOM fully loaded at', new Date().toISOString());

          // this.updateTimeField(); // Set initial time

          // // Update every 5 seconds
          // this.intervalId = setInterval(() => {
          //      this.updateTimeField();
          // }, 5000);

          await this.toggleIssuerField();
     }

     ngAfterViewChecked() {
          if (this.result !== this.lastResult && this.resultField?.nativeElement) {
               this.utilsService.attachSearchListener(this.resultField.nativeElement);
               this.lastResult = this.result;
               this.cdr.detectChanges();
          }
     }

     onWalletInputChange(event: { account1: any; account2: any }) {
          this.account1 = event.account1;
          this.account2 = event.account2;
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
               this.displayCheckDataForAccount1();
          } else if (this.selectedAccount === 'account2') {
               this.displayCheckDataForAccount2();
          }
     }

     // updateTimeField(): void {
     //      this.currentTimeField = this.utilsService.convertToEstTime(new Date().toISOString());
     // }

     ngOnDestroy(): void {
          if (this.intervalId) {
               clearInterval(this.intervalId);
          }
     }

     async toggleIssuerField() {
          this.issuers = []; // Reset issuers
          this.selectedIssuer = AppConstants.EMPTY_STRING; // Reset selected issuer
          this.tokenBalance = AppConstants.EMPTY_STRING; // Reset token balance
          if (this.currencyFieldDropDownValue !== 'XRP' && this.selectedAccount) {
               const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
               const address = this.selectedAccount === 'account1' ? this.account1.address : this.account2.address;
               if (this.utilsService.validatInput(seed) && this.utilsService.validatInput(address)) {
                    try {
                         const client = await this.xrplService.getClient();
                         const tokenBalanceData = await this.utilsService.getTokenBalance(client, address, this.currencyFieldDropDownValue);
                         this.issuers = tokenBalanceData.issuers;
                         this.tokenBalance = tokenBalanceData.total.toString();
                         if (this.selectedAccount === 'account1') {
                              this.account1.balance = tokenBalanceData.xrpBalance.toString();
                         } else {
                              this.account2.balance = tokenBalanceData.xrpBalance.toString();
                         }
                    } catch (error: any) {
                         console.error('Error fetching token balance:', error);
                         this.setError(`ERROR: Failed to fetch token balance - ${error.message || 'Unknown error'}`);
                    }
               }
          }
          this.cdr.detectChanges();
     }

     async getChecks() {
          console.log('Entering getChecks');
          const startTime = Date.now();
          this.spinner = true;
          this.isError = false;
          this.isSuccess = false;
          this.result = AppConstants.EMPTY_STRING;
          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }
          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
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
               const check_objects = await client.request({
                    id: 5,
                    command: 'account_objects',
                    account: wallet.classicAddress,
                    type: 'check',
                    ledger_index: 'validated',
               });

               console.log('Response', check_objects);

               const data = {
                    sections: [{}],
               };

               if (check_objects.result.account_objects.length <= 0) {
                    data.sections.push({
                         title: 'Checks',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No checks found for <code>${wallet.classicAddress}</code>` }],
                    });
               } else {
                    data.sections.push({
                         title: `Checks (${check_objects.result.account_objects.length})`,
                         openByDefault: true,
                         subItems: check_objects.result.account_objects.map((check, counter) => {
                              const Destination = (check as any)['Destination'];
                              const Amount = (check as any)['Amount'];
                              const Expiration = (check as any)['Expiration'];
                              const InvoiceID = (check as any)['InvoiceID'];
                              const DestinationTag = (check as any)['DestinationTag'];
                              const SourceTag = (check as any)['SourceTag'];
                              const LedgerEntryType = (check as any)['LedgerEntryType'];
                              const PreviousTxnID = (check as any)['PreviousTxnID'];
                              const index = (check as any)['index'];
                              // Use Amount if available, otherwise fall back to SendMax if present
                              const sendMax = (check as any).SendMax;
                              const amountValue = Amount || sendMax;
                              const amountDisplay = amountValue ? (typeof amountValue === 'string' ? `${xrpl.dropsToXrp(amountValue)} XRP` : `${amountValue.value} ${amountValue.currency} (<code>${amountValue.issuer}</code>)`) : 'N/A';
                              return {
                                   key: `Check ${counter + 1} (ID: ${PreviousTxnID?.slice(0, 8) || AppConstants.EMPTY_STRING}...)`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Check ID / Ledger Index', value: `<code>${index}</code>` },
                                        { key: 'Previous Txn ID', value: `<code>${PreviousTxnID}</code>` },
                                        { key: 'Ledger Entry Type', value: LedgerEntryType },
                                        { key: 'Destination', value: `<code>${Destination}</code>` },
                                        { key: Amount ? 'Amount' : 'SendMax', value: amountDisplay },
                                        ...(Expiration ? [{ key: 'Expiration', value: new Date(Expiration * 1000).toLocaleString() }] : []),
                                        ...(InvoiceID ? [{ key: 'Invoice ID', value: `<code>${InvoiceID}</code>` }] : []),
                                        ...(DestinationTag ? [{ key: 'Destination Tag', value: String(DestinationTag) }] : []),
                                        ...(SourceTag ? [{ key: 'Source Tag', value: String(SourceTag) }] : []),
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
               } else {
                    this.account2.balance = balance.toString();
               }
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getChecks in ${this.executionTime}ms`);
          }
     }

     async sendCheck() {
          console.log('Entering sendCheck');
          const startTime = Date.now();
          this.spinner = true;
          this.isError = false;
          this.isSuccess = false;
          this.result = AppConstants.EMPTY_STRING;
          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }
          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
          if (!this.utilsService.validatInput(seed)) {
               return this.setError('ERROR: Account seed cannot be empty');
          }
          if (!this.utilsService.validatInput(this.amountField)) {
               return this.setError('ERROR: XRP Amount cannot be empty');
          }
          if (parseFloat(this.amountField) <= 0) {
               return this.setError('ERROR: XRP Amount must be a positive number');
          }
          if (!this.utilsService.validatInput(this.destinationField)) {
               return this.setError('ERROR: Destination cannot be empty');
          }

          let checkExpiration = AppConstants.EMPTY_STRING;
          if (this.expirationTimeField != AppConstants.EMPTY_STRING) {
               if (isNaN(parseFloat(this.expirationTimeField)) || parseFloat(this.expirationTimeField) <= 0) {
                    return this.setError('ERROR: Expiration time must be a valid number greater than zero');
               }
               const expirationTimeValue = this.expirationTimeField;
               checkExpiration = this.utilsService.addTime(parseInt(expirationTimeValue), this.checkExpirationTime as 'seconds' | 'minutes' | 'hours' | 'days').toString();
               console.log(`Raw expirationTime: ${expirationTimeValue} finishUnit: ${this.checkExpirationTime} checkExpiration: ${this.utilsService.convertXRPLTime(parseInt(checkExpiration))}`);
          }

          // Check for positive number (greater than 0)
          if (this.tokenBalance && this.tokenBalance !== AppConstants.EMPTY_STRING && this.currencyFieldDropDownValue !== AppConstants.XRP_CURRENCY) {
               const balance = Number(this.tokenBalance);

               if (isNaN(balance)) {
                    return this.setError('ERROR: Token balance must be a number');
               }

               if (balance <= 0) {
                    return this.setError('ERROR: Token balance must be greater than 0');
               }

               if (parseFloat(balance.toString()) > parseFloat(this.amountField)) {
                    return this.setError(`ERROR: Insufficient token balance. Amount is to high`);
               }
          }

          if (this.issuers && this.tokenBalance != AppConstants.EMPTY_STRING && Number(this.tokenBalance) > 0 && this.issuers.length === 0) {
               return this.setError('ERROR: Issuer can not be empty when sending a token for a check');
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

               if (this.currencyFieldDropDownValue === AppConstants.XRP_CURRENCY) {
                    if (parseFloat(this.amountField) > (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0')) {
                         return this.setError('ERROR: Insufficent XRP to send check');
                    }
               }

               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nSending Check\n\n`;

               // Build SendMax amount
               let sendMax;
               if (this.currencyFieldDropDownValue === AppConstants.XRP_CURRENCY) {
                    sendMax = xrpl.xrpToDrops(this.amountField);
               } else {
                    sendMax = {
                         currency: this.currencyFieldDropDownValue,
                         value: this.amountField,
                         issuer: wallet.address,
                    };
               }

               const tx: CheckCreate = await client.autofill({
                    TransactionType: 'CheckCreate',
                    Account: wallet.classicAddress,
                    SendMax: sendMax,
                    Destination: this.destinationField,
               });

               if (this.memoField && this.memoField != AppConstants.EMPTY_STRING) {
                    tx.Memos = [
                         {
                              Memo: {
                                   MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                                   MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                              },
                         },
                    ];
               }

               if (checkExpiration && checkExpiration != AppConstants.EMPTY_STRING) {
                    tx.Expiration = Number(checkExpiration);
               }

               const signed = wallet.sign(tx);

               this.resultField.nativeElement.innerHTML += `Sending Check for ${this.amountField} ${this.currencyFieldDropDownValue} to ${this.destinationField}\n`;

               const response = await client.submitAndWait(signed.tx_blob);
               console.log('Response', response);

               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    return;
               }

               this.resultField.nativeElement.innerHTML += `Account fields successfully updated.\n`;
               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
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
               } else {
                    this.account2.balance = balance.toString();
               }
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving sendCheck in ${this.executionTime}ms`);
          }
     }

     async cashCheck() {
          console.log('Entering cashCheck');
          const startTime = Date.now();
          this.spinner = true;
          this.isError = false;
          this.isSuccess = false;
          this.result = AppConstants.EMPTY_STRING;

          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }

          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
          if (!this.utilsService.validatInput(seed)) {
               return this.setError('ERROR: Account seed cannot be empty');
          }

          if (!this.utilsService.validatInput(this.checkIdField)) {
               return this.setError('ERROR: Check ID cannot be empty');
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
               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nCashing Check\n\n`;

               // Build amount object depending on currency
               const amountToCash =
                    this.currencyFieldDropDownValue === AppConstants.XRP_CURRENCY
                         ? xrpl.xrpToDrops(this.amountField)
                         : {
                                value: this.amountField,
                                currency: this.currencyFieldDropDownValue,
                                issuer: this.selectedIssuer,
                           };

               const tx: CheckCash = await client.autofill({
                    TransactionType: 'CheckCash',
                    Account: wallet.classicAddress,
                    Amount: amountToCash,
                    CheckID: this.checkIdField,
               });

               const signed = wallet.sign(tx);
               this.resultField.nativeElement.innerHTML += `Cashing check for ${this.amountField} ${this.currencyFieldDropDownValue}\n`;

               const response = await client.submitAndWait(signed.tx_blob);
               console.log('Response:', response);

               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    return;
               }

               this.resultField.nativeElement.innerHTML += `Account fields successfully updated.\n`;
               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
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
               } else {
                    this.account2.balance = balance.toString();
               }
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving cashCheck in ${this.executionTime}ms`);
          }
     }

     async cancelCheck() {
          console.log('Entering cancelCheck');
          const startTime = Date.now();
          this.spinner = true;
          this.isError = false;
          this.isSuccess = false;
          this.result = AppConstants.EMPTY_STRING;

          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }

          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
          if (!this.utilsService.validatInput(seed)) {
               return this.setError('ERROR: Account seed cannot be empty');
          }

          if (!this.utilsService.validatInput(this.checkIdField)) {
               return this.setError('ERROR: Check ID cannot be empty');
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
               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nCancelling Check\n\n`;

               const tx: CheckCancel = await client.autofill({
                    TransactionType: 'CheckCancel',
                    Account: wallet.classicAddress,
                    CheckID: this.checkIdField,
               });

               const signed = wallet.sign(tx);
               this.resultField.nativeElement.innerHTML += `Cashing check for ${this.currencyFieldDropDownValue}\n`;

               const response = await client.submitAndWait(signed.tx_blob);
               console.log('Response:', response);

               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');

                    this.isSuccess = false;
                    this.isError = true;
                    this.handleTransactionResult({
                         result: this.result,
                         isError: this.isError,
                         isSuccess: this.isSuccess,
                    });
                    return;
               }

               this.resultField.nativeElement.innerHTML += `Account fields successfully updated.\n`;
               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
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
               } else {
                    this.account2.balance = balance.toString();
               }
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving cancelCheck in ${this.executionTime}ms`);
          }
     }

     async displayCheckDataForAccount1() {
          console.log('Entering displayCheckDataForAccount1');
          const startTime = Date.now();
          const account1name = this.storageService.getInputValue('account1name');
          const account1address = this.storageService.getInputValue('account1address');
          const account2address = this.storageService.getInputValue('account2address');
          const account1seed = this.storageService.getInputValue('account1seed');
          const account1mnemonic = this.storageService.getInputValue('account1mnemonic');
          const account1secretNumbers = this.storageService.getInputValue('account1secretNumbers');

          const accountName1Field = document.getElementById('accountName1Field') as HTMLInputElement | null;
          const accountAddress1Field = document.getElementById('accountAddress1Field') as HTMLInputElement | null;
          const accountSeed1Field = document.getElementById('accountSeed1Field') as HTMLInputElement | null;
          const destinationField = document.getElementById('destinationField') as HTMLInputElement | null;
          const checkIdField = document.getElementById('checkIdField') as HTMLInputElement | null;
          const memoField = document.getElementById('memoField') as HTMLInputElement | null;

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

          if (destinationField) {
               this.destinationField = account2address;
          }

          if (checkIdField) {
               this.checkIdField = AppConstants.EMPTY_STRING;
          }

          if (memoField) {
               this.memoField = AppConstants.EMPTY_STRING;
          }

          try {
               const client = await this.xrplService.getClient();
               const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, account1address);
               this.ownerCount = ownerCount;
               this.totalXrpReserves = totalXrpReserves;
               this.account1.balance = ((await client.getXrpBalance(account1address)) - parseFloat(this.totalXrpReserves || '0')).toString();
               console.log('this.account1.balance', this.account1.balance);
          } catch (error: any) {
               this.setError(error.message);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving handlePaymentChannelAction in ${this.executionTime}ms`);
          }

          this.getChecks();
     }

     async displayCheckDataForAccount2() {
          console.log('Entering displayCheckDataForAccount2');
          const startTime = Date.now();
          const account2name = this.storageService.getInputValue('account2name');
          const account1address = this.storageService.getInputValue('account1address');
          const account2address = this.storageService.getInputValue('account2address');
          const account2seed = this.storageService.getInputValue('account2seed');
          const account2mnemonic = this.storageService.getInputValue('account2mnemonic');
          const account2secretNumbers = this.storageService.getInputValue('account2secretNumbers');

          const accountName1Field = document.getElementById('accountName1Field') as HTMLInputElement | null;
          const accountAddress1Field = document.getElementById('accountAddress1Field') as HTMLInputElement | null;
          const accountSeed1Field = document.getElementById('accountSeed1Field') as HTMLInputElement | null;
          const destinationField = document.getElementById('destinationField') as HTMLInputElement | null;
          const checkIdField = document.getElementById('checkIdField') as HTMLInputElement | null;
          const memoField = document.getElementById('memoField') as HTMLInputElement | null;

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

          if (destinationField) {
               this.destinationField = account1address;
          }

          if (checkIdField) {
               this.checkIdField = AppConstants.EMPTY_STRING;
          }

          if (memoField) {
               this.memoField = AppConstants.EMPTY_STRING;
          }

          try {
               const client = await this.xrplService.getClient();
               const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, account2address);
               this.ownerCount = ownerCount;
               this.totalXrpReserves = totalXrpReserves;
               this.account1.balance = ((await client.getXrpBalance(account2address)) - parseFloat(this.totalXrpReserves || '0')).toString();
               console.log('this.account2.balance', this.account1.balance);
          } catch (error: any) {
               this.setError(error.message);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving handlePaymentChannelAction in ${this.executionTime}ms`);
          }

          this.getChecks();
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
}
