import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import * as xrpl from 'xrpl';
import { StorageService } from '../../services/storage.service';
import { derive } from 'xrpl-accountlib';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Component({
     selector: 'app-wallet-multi-input',
     standalone: true,
     imports: [CommonModule, FormsModule],
     templateUrl: './wallet-multi-input.component.html',
     styleUrl: './wallet-multi-input.component.css',
})
export class WalletMultiInputComponent {
     @Output() walletChange = new EventEmitter<{ account1: any; account2: any; issuer: any }>();
     @Output() transactionResult = new EventEmitter<{
          result: string;
          isError: boolean;
          isSuccess: boolean;
     }>();

     private searchSubject = new Subject<void>();
     private pageLoad: boolean = true;
     createWallet: boolean = false;
     showGenerateButtons = true;
     showDeriveButtons = false;
     transactionInput = '';
     spinner = false;

     account1 = {
          name: '',
          address: '',
          seed: '',
          mnemonic: '',
          secretNumbers: '',
     };

     account2 = {
          name: '',
          address: '',
          seed: '',
          mnemonic: '',
          secretNumbers: '',
     };

     issuer = {
          name: '',
          address: '',
          seed: '',
          mnemonic: '',
          secretNumbers: '',
     };

     constructor(private storageService: StorageService, private xrplService: XrplService, private utilsService: UtilsService) {}

     ngOnInit() {
          // Load saved input values
          this.account1.name = this.storageService.getInputValue('account1name');
          this.account1.address = this.storageService.getInputValue('account1address');
          this.account1.seed = this.storageService.getInputValue('account1seed');
          this.account1.mnemonic = this.storageService.getInputValue('account1mnemonic');
          this.account1.secretNumbers = this.storageService.getInputValue('account1secretNumbers');

          this.account2.name = this.storageService.getInputValue('account2name');
          this.account2.address = this.storageService.getInputValue('account2address');
          this.account2.seed = this.storageService.getInputValue('account2seed');
          this.account2.mnemonic = this.storageService.getInputValue('account2mnemonic');
          this.account2.secretNumbers = this.storageService.getInputValue('account2secretNumbers');

          this.issuer.name = this.storageService.getInputValue('issuerName');
          this.issuer.address = this.storageService.getInputValue('issuerAddress');
          this.issuer.seed = this.storageService.getInputValue('issuerSeed');
          this.issuer.mnemonic = this.storageService.getInputValue('issuerMnemonic');
          this.issuer.secretNumbers = this.storageService.getInputValue('issuerSecretNumbers');

          // Load createWallet state
          const savedCreateWallet = this.storageService.getInputValue('createWallet');
          this.createWallet = savedCreateWallet === 'true';
          this.showGenerateButtons = this.createWallet;
          this.showDeriveButtons = !this.createWallet;
          this.emitChange();

          // Subscribe to clear inputs event
          this.storageService.inputsCleared.subscribe(() => {
               this.account1 = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '' };
               this.account2 = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '' };
               this.issuer = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '' };
               this.createWallet = true;
               this.showGenerateButtons = true;
               this.showDeriveButtons = false;
               this.storageService.setInputValue('createWallet', 'true');
               this.emitChange();
          });

          this.searchSubject.pipe(debounceTime(300)).subscribe(() => {
               this.getTransaction();
          });
     }

     triggerSearch() {
          this.searchSubject.next();
     }

     toggleCreateWallet() {
          this.showGenerateButtons = this.createWallet;
          this.showDeriveButtons = !this.createWallet;
     }

     saveInput(key: string, value: string) {
          this.storageService.setInputValue(key, value);
          // Update account1 or account2 based on key
          if (key.startsWith('account1')) {
               const field = key.replace('account1', '').toLowerCase() as keyof typeof this.account1;
               this.account1[field] = value;
          } else if (key.startsWith('account2')) {
               const field = key.replace('account2', '').toLowerCase() as keyof typeof this.account2;
               this.account2[field] = value;
          } else if (key.startsWith('issuer')) {
               const field = key.replace('issuer', '').toLowerCase() as keyof typeof this.issuer;
               this.issuer[field] = value;
          }
          this.walletChange.emit({
               account1: this.account1,
               account2: this.account2,
               issuer: this.issuer,
          });
     }

     onCreateWalletChange() {
          if (this.createWallet) {
               this.showGenerateButtons = true;
               this.showDeriveButtons = false;
          } else {
               this.showGenerateButtons = false;
               this.showDeriveButtons = true;
               console.log('Create Wallet unchecked');
          }
          this.pageLoad = false;
          this.storageService.setInputValue('createWallet', this.createWallet.toString());
          this.emitChange();
     }

     generateNewWallet(account: '1' | '2' | '3') {
          const wallet = xrpl.Wallet.generate();
          this.updateAccount(account, {
               address: wallet.classicAddress,
               seed: wallet.seed || '',
          });
          this.saveInput(`account${account}address`, wallet.classicAddress);
          this.saveInput(`account${account}seed`, wallet.seed || '');
          this.emitChange();
     }

     generateNewWalletFromMnemonic(account: '1' | '2' | '3') {
          // Placeholder: Implement mnemonic generation
          alert('Mnemonic generation not implemented yet');
          this.emitChange();
     }

     generateNewWalletFromSecretNumbers(account: '1' | '2' | '3') {
          // Placeholder: Implement secret numbers generation
          alert('Secret numbers generation not implemented yet');
          this.emitChange();
     }

     getAccountFromSeed(account: '1' | '2' | '3') {
          const seed = this.getAccount(account).seed;
          if (seed) {
               try {
                    const wallet = xrpl.Wallet.fromSeed(seed);
                    this.updateAccount(account, {
                         address: wallet.classicAddress,
                         seed,
                    });
                    this.saveInput(`account${account}address`, wallet.classicAddress);
                    this.saveInput(`account${account}seed`, seed);
                    this.emitChange();
               } catch (error) {
                    alert(`Invalid seed: ${(error as Error).message}`);
               }
          } else {
               alert('Seed is empty');
          }
     }

     getAccountFromMnemonic(account: '1' | '2' | '3') {
          const mnemonic = this.getAccount(account).mnemonic;
          if (mnemonic) {
               try {
                    const wallet = xrpl.Wallet.fromMnemonic(mnemonic);
                    this.updateAccount(account, {
                         address: wallet.classicAddress,
                         mnemonic,
                    });
                    this.saveInput(`account${account}address`, wallet.classicAddress);
                    this.saveInput(`account${account}mnemonic`, mnemonic);
                    this.emitChange();
               } catch (error) {
                    alert(`Invalid mnemonic: ${(error as Error).message}`);
               }
          } else {
               alert('Mnemonic is empty');
          }
     }

     getAccountFromSecretNumbers(account: '1' | '2' | '3') {
          const secretNumbers = this.getAccount(account).secretNumbers;
          if (secretNumbers) {
               try {
                    // const derived = derive.secretNumbers(secretNumbers);
                    // if (!derived.secret.familySeed) {
                    //      throw new Error('familySeed is null');
                    // }
                    // const wallet = xrpl.Wallet.fromSeed(derived.secret.familySeed);
                    // this.updateAccount(account, {
                    //      address: wallet.classicAddress,
                    //      secretNumbers,
                    // });
                    // this.emitChange();
               } catch (error) {
                    alert(`Invalid secret numbers: ${error}`);
               }
          } else {
               alert('Secret numbers are empty');
          }
     }

     private getAccountMnemonic(account: '1' | '2' | 'issuerMnemonic') {
          if (account === '1') {
               return this.account1;
          } else if (account === '2') {
               return this.account2;
          } else {
               return this.issuer;
          }
     }

     private getAccount(account: '1' | '2' | '3') {
          if (account === '1') {
               return this.account1;
          } else if (account === '2') {
               return this.account2;
          } else {
               return this.issuer;
          }
     }

     private updateAccount(account: '1' | '2' | '3', data: Partial<typeof this.account1>) {
          if (account === '1') {
               this.account1 = { ...this.account1, ...data };
          } else if (account === '2') {
               this.account2 = { ...this.account2, ...data };
          } else {
               this.issuer = { ...this.issuer, ...data };
          }
     }

     async getTransaction() {
          console.log('Entering getTransaction');
          const startTime = Date.now();
          this.spinner = true;

          const input = this.transactionInput.trim();
          if (!input) {
               this.transactionResult.emit({
                    result: `<p>ERROR: Transaction field cannot be empty</p>`,
                    isError: true,
                    isSuccess: false,
               });
               this.spinner = false;
               return;
          }
          if (!this.utilsService.isValidTransactionHash(input) && !this.utilsService.isValidCTID(input) && !xrpl.isValidAddress(input)) {
               this.transactionResult.emit({
                    result: `<p>ERROR: Invalid input. Must be a valid Transaction Hash, CTID, or Address</p>`,
                    isError: true,
                    isSuccess: false,
               });
               this.spinner = false;
               return;
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();

               const tempDiv = document.createElement('div');
               tempDiv.innerHTML = `Connected to ${environment} ${net}\n\nFetching Transaction\n`;

               let txResponse;
               if (this.utilsService.isValidTransactionHash(input)) {
                    txResponse = await client.request({
                         command: 'tx',
                         transaction: input,
                    });
               } else if (this.utilsService.isValidCTID(input)) {
                    txResponse = await client.request({
                         command: 'tx',
                         ctid: input,
                    });
               } else if (xrpl.isValidAddress(input)) {
                    txResponse = await client.request({
                         command: 'account_tx',
                         account: input,
                         ledger_index_min: -1,
                         ledger_index_max: -1,
                         limit: 10,
                    });
               }

               tempDiv.innerHTML += `\nTransaction data retrieved successfully.\n`;

               if (txResponse) {
                    this.utilsService.renderTransactionsResults(txResponse, tempDiv);

                    this.transactionResult.emit({
                         result: tempDiv.innerHTML,
                         isError: false,
                         isSuccess: true,
                    });
               } else {
                    this.transactionResult.emit({
                         result: `<p>ERROR: No transaction data found.</p>`,
                         isError: true,
                         isSuccess: false,
                    });
               }
          } catch (error: any) {
               console.error('Error:', error);
               this.transactionResult.emit({
                    result: `ERROR: ${error.message || 'Unknown error'}`,
                    isError: true,
                    isSuccess: false,
               });
          } finally {
               this.spinner = false;
               console.log(`Leaving getTransaction in ${Date.now() - startTime}ms`);
          }
     }

     private emitChange() {
          this.walletChange.emit({
               account1: this.account1,
               account2: this.account2,
               issuer: this.issuer,
          });
     }

     onPasteTrim(event: ClipboardEvent, accountKey: string): void {
          event.preventDefault(); // Prevent the default paste

          const pastedText = event.clipboardData?.getData('text').trim() || ''; // Remove leading/trailing whitespace

          let account;
          if (accountKey === 'account1mnemonic') {
               account = this.getAccountMnemonic('1');
          } else if (accountKey === 'account2mnemonic') {
               account = this.getAccountMnemonic('2');
          } else {
               account = this.getAccountMnemonic('issuerMnemonic');
          }

          account.mnemonic = pastedText;

          // Optional: save it immediately
          this.saveInput(`${accountKey}`, pastedText);
     }
}
