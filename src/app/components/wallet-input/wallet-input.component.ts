import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import * as xrpl from 'xrpl';
import { StorageService } from '../../services/storage.service';
import { generateSeed, deriveKeypair } from 'ripple-keypairs';
import { derive, sign } from 'xrpl-accountlib';
import { encode } from 'ripple-binary-codec';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';

@Component({
     selector: 'app-wallet-input',
     standalone: true,
     imports: [CommonModule, FormsModule],
     templateUrl: './wallet-input.component.html',
     styleUrls: ['./wallet-input.component.css'],
})
export class WalletInputComponent {
     @Output() walletChange = new EventEmitter<{ account1: any; account2: any }>();
     @Output() transactionResult = new EventEmitter<{
          result: string;
          isError: boolean;
          isSuccess: boolean;
     }>();

     private searchSubject = new Subject<void>();
     private pageLoad: boolean = true;
     createWallet: boolean = false;
     encryptionType: boolean = false;
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

     constructor(private readonly storageService: StorageService, private readonly xrplService: XrplService, private readonly utilsService: UtilsService, private readonly renderUiComponentsService: RenderUiComponentsService, private readonly xrplTransactions: XrplTransactionService) {}

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

          // Load createWallet state
          const savedCreateWallet = this.storageService.getInputValue('createWallet');
          this.createWallet = savedCreateWallet === 'true';
          const savedEncryptionType = this.storageService.getInputValue('encryptionType');
          this.encryptionType = savedEncryptionType === 'true';
          this.showGenerateButtons = this.createWallet;
          this.showDeriveButtons = !this.createWallet;
          this.emitChange();

          // Subscribe to clear inputs event
          this.storageService.inputsCleared.subscribe(() => {
               this.account1 = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '' };
               this.account2 = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '' };
               this.createWallet = true;
               this.encryptionType = true;
               this.showGenerateButtons = true;
               this.showDeriveButtons = false;
               this.storageService.setInputValue('createWallet', 'true');
               this.storageService.setInputValue('encryptionType', 'true');
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
          }
          this.walletChange.emit({ account1: this.account1, account2: this.account2 });
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

     onEncryptionChange() {
          this.pageLoad = false;
          this.storageService.setInputValue('encryptionType', this.encryptionType.toString());
          this.emitChange();
     }

     generateNewWallet(account: '1' | '2') {
          const wallet = xrpl.Wallet.generate();
          this.updateAccount(account, {
               address: wallet.classicAddress,
               seed: wallet.seed || '',
          });
          this.saveInput(`account${account}address`, wallet.classicAddress);
          this.saveInput(`account${account}seed`, wallet.seed || '');
          this.emitChange();
     }

     generateNewWalletFromMnemonic(account: '1' | '2') {
          // Placeholder: Implement mnemonic generation
          alert('Mnemonic generation not implemented yet');
          this.emitChange();
     }

     generateNewWalletFromSecretNumbers(account: '1' | '2') {
          // Placeholder: Implement secret numbers generation
          alert('Secret numbers generation not implemented yet');
          this.emitChange();
     }

     getAccountFromSeed(account: '1' | '2') {
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

     getAccountFromMnemonic(account: '1' | '2') {
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

     getAccountFromSecretNumbers(account: '1' | '2') {
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

     private getAccount(account: '1' | '2') {
          return account === '1' ? this.account1 : this.account2;
     }

     private updateAccount(account: '1' | '2', data: Partial<typeof this.account1>) {
          if (account === '1') {
               this.account1 = { ...this.account1, ...data };
          } else {
               this.account2 = { ...this.account2, ...data };
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
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();

               const tempDiv = document.createElement('div');

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
                    this.renderUiComponentsService.renderTransactionsResults(txResponse, tempDiv);

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
          });
     }

     onPasteTrim(event: ClipboardEvent, accountKey: string): void {
          event.preventDefault(); // Prevent the default paste

          const pastedText = event.clipboardData?.getData('text').trim() || ''; // Remove leading/trailing whitespace

          // Insert the trimmed value into the ngModel
          const account = this.getAccount(accountKey === 'account1mnemonic' ? '1' : accountKey === 'account2mnemonic' ? '2' : '1');
          account.mnemonic = pastedText;

          // Optional: save it immediately
          this.saveInput(`${accountKey}mnemonic`, pastedText);
     }
}
