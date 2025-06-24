import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { WalletInputComponent } from '../wallet-input/wallet-input.component';
import { StorageService } from '../../services/storage.service';
import * as xrpl from 'xrpl';
import { TransactionMetadataBase } from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';

@Component({
     selector: 'app-account',
     standalone: true,
     imports: [CommonModule, FormsModule, WalletInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './send-xrp.component.html',
     styleUrl: './send-xrp.component.css',
})
export class SendXrpComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     selectedAccount: 'account1' | 'account2' | null = null;
     private lastResult: string = AppConstants.EMPTY_STRING;
     transactionInput = AppConstants.EMPTY_STRING;
     result: string = AppConstants.EMPTY_STRING;
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = true;
     account1 = { name: AppConstants.EMPTY_STRING, address: AppConstants.EMPTY_STRING, seed: AppConstants.EMPTY_STRING, secretNumbers: AppConstants.EMPTY_STRING, mnemonic: AppConstants.EMPTY_STRING, balance: AppConstants.EMPTY_STRING };
     account2 = { name: AppConstants.EMPTY_STRING, address: AppConstants.EMPTY_STRING, seed: AppConstants.EMPTY_STRING, secretNumbers: AppConstants.EMPTY_STRING, mnemonic: AppConstants.EMPTY_STRING, balance: AppConstants.EMPTY_STRING };
     ownerCount = AppConstants.EMPTY_STRING;
     totalXrpReserves = AppConstants.EMPTY_STRING;
     executionTime = AppConstants.EMPTY_STRING;
     amountField = AppConstants.EMPTY_STRING;
     destinationField = AppConstants.EMPTY_STRING;
     destinationTagField = AppConstants.EMPTY_STRING;
     memoField = AppConstants.EMPTY_STRING;
     isMultiSignTransaction = false;
     multiSignAddress = AppConstants.EMPTY_STRING;
     spinner = false;
     isMultiSign = false;

     constructor(private xrplService: XrplService, private utilsService: UtilsService, private cdr: ChangeDetectorRef, private storageService: StorageService) {}

     ngAfterViewInit() {
          // Clear input fields after the view is initialized
          const accountName1Field = document.getElementById('accountName1Field') as HTMLInputElement | null;
          const accountAddress1Field = document.getElementById('accountAddress1Field') as HTMLInputElement | null;
          const accountSeed1Field = document.getElementById('accountSeed1Field') as HTMLInputElement | null;
          const resultField = document.getElementById('resultField') as HTMLInputElement | null;

          if (accountName1Field) accountName1Field.value = AppConstants.EMPTY_STRING;
          if (accountAddress1Field) accountAddress1Field.value = AppConstants.EMPTY_STRING;
          if (accountSeed1Field) accountSeed1Field.value = AppConstants.EMPTY_STRING;

          // Ensure Angular detects changes after updating the DOM
          this.cdr.detectChanges();
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

     toggleMultiSign() {
          // Handled by *ngIf in template
     }

     onAccountChange() {
          if (this.selectedAccount === 'account1') {
               this.displayDataForAccount1();
          } else if (this.selectedAccount === 'account2') {
               this.displayDataForAccount2();
          }
     }

     async sendXrp() {
          console.log('Entering sendXrp');
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

               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nSending XRP\n\n`;

               // Prepare the base transaction object
               const tx: any = {
                    TransactionType: 'Payment',
                    Account: wallet.classicAddress,
                    Amount: xrpl.xrpToDrops(this.amountField),
                    Destination: this.destinationField,
               };

               const destinationTagText = this.destinationTagField;
               if (destinationTagText) {
                    if (parseInt(destinationTagText) <= 0) {
                         return this.setError('ERROR: Destination Tag must be a valid number and greater than zero');
                    }
                    tx.DestinationTag = parseInt(destinationTagText, 10);
               }

               const memoText = this.memoField;
               if (memoText) {
                    tx.Memos = [
                         {
                              Memo: {
                                   MemoData: Buffer.from(memoText, 'utf8').toString('hex'),
                                   MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                              },
                         },
                    ];
               }

               let preparedTx = await client.autofill(tx);
               const signed = wallet.sign(preparedTx);
               const response = await client.submitAndWait(signed.tx_blob);

               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    return;
               }

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
               console.log(`Leaving updateFlags in ${this.executionTime}ms`);
          }
     }

     async displayDataForAccount1() {
          console.log('Entering displayDataForAccount1');
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
               const { environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               const { accountInfo, accountObjects } = await this.utilsService.getAccountInfo(account1seed, environment);
               this.utilsService.renderAccountDetails(accountInfo, accountObjects);
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
     }

     async displayDataForAccount2() {
          console.log('Entering displayDataForAccount2');
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
               const { environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               const { accountInfo, accountObjects } = await this.utilsService.getAccountInfo(account2seed, environment);
               this.utilsService.renderAccountDetails(accountInfo, accountObjects);
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
