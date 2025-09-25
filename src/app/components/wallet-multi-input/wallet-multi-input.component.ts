import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import * as xrpl from 'xrpl';
import { StorageService } from '../../services/storage.service';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AppConstants } from '../../core/app.constants';
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';

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
          encryptionAlgorithm: '',
     };

     account2 = {
          name: '',
          address: '',
          seed: '',
          mnemonic: '',
          secretNumbers: '',
          encryptionAlgorithm: '',
     };

     issuer = {
          name: '',
          address: '',
          seed: '',
          mnemonic: '',
          secretNumbers: '',
          encryptionAlgorithm: '',
     };

     constructor(private readonly storageService: StorageService, private readonly xrplService: XrplService, private readonly utilsService: UtilsService, private readonly renderUiComponentsService: RenderUiComponentsService, private readonly xrplTransactions: XrplTransactionService) {}

     ngOnInit() {
          // Load saved input values
          this.account1.name = this.storageService.getInputValue('account1name');
          this.account1.address = this.storageService.getInputValue('account1address');
          this.account1.seed = this.storageService.getInputValue('account1seed');
          this.account1.mnemonic = this.storageService.getInputValue('account1mnemonic');
          this.account1.secretNumbers = this.storageService.getInputValue('account1secretNumbers');
          this.account1.encryptionAlgorithm = this.storageService.getInputValue('account1encryptionAlgorithm');

          this.account2.name = this.storageService.getInputValue('account2name');
          this.account2.address = this.storageService.getInputValue('account2address');
          this.account2.seed = this.storageService.getInputValue('account2seed');
          this.account2.mnemonic = this.storageService.getInputValue('account2mnemonic');
          this.account2.secretNumbers = this.storageService.getInputValue('account2secretNumbers');
          this.account2.encryptionAlgorithm = this.storageService.getInputValue('account2encryptionAlgorithm');

          this.issuer.name = this.storageService.getInputValue('issuerName');
          this.issuer.address = this.storageService.getInputValue('issuerAddress');
          this.issuer.seed = this.storageService.getInputValue('issuerSeed');
          this.issuer.mnemonic = this.storageService.getInputValue('issuerMnemonic');
          this.issuer.secretNumbers = this.storageService.getInputValue('issuerSecretNumbers');
          this.issuer.encryptionAlgorithm = this.storageService.getInputValue('issuerEncryptionAlgorithm');

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
               this.account1 = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', encryptionAlgorithm: '' };
               this.account2 = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', encryptionAlgorithm: '' };
               this.issuer = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', encryptionAlgorithm: '' };
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

     onEncryptionChange() {
          this.pageLoad = false;
          this.storageService.setInputValue('encryptionType', this.encryptionType.toString());
          this.emitChange();
     }

     async generateNewWalletFromFamilySeed(account: '1' | '2' | '3') {
          const environment = this.xrplService.getNet().environment;
          let encryptionAlgorithm = AppConstants.ENCRYPTION.SECP256K1;
          if (this.encryptionType) {
               encryptionAlgorithm = AppConstants.ENCRYPTION.ED25519;
          }
          const wallet = await this.xrplService.generateWalletFromFamilySeed(environment, encryptionAlgorithm);
          await this.sleep(4000);
          this.updateAccount(account, {
               address: wallet.address,
               seed: wallet.secret.familySeed || '',
               mnemonic: '',
               secretNumbers: '',
               encryptionAlgorithm: wallet.keypair.algorithm || '',
          });
          if (account === '3') {
               this.saveInput(`issuerAddress`, wallet.address || '');
               this.saveInput(`issuerSeed`, wallet.secret.familySeed || '');
               this.saveInput(`issuerMnemonic`, '');
               this.saveInput(`issuerSecretNumbers`, '');
               this.saveInput(`issuerEncryptionAlgorithm`, wallet.keypair.algorithm || '');
          } else {
               this.saveInput(`account${account}address`, wallet.address || '');
               this.saveInput(`account${account}seed`, wallet.secret.familySeed || '');
               this.saveInput(`account${account}mnemonic`, '');
               this.saveInput(`account${account}secretNumbers`, '');
               this.saveInput(`account${account}encryptionAlgorithm`, wallet.keypair.algorithm || '');
          }
          this.emitChange();
     }

     async deriveNewWalletFromFamilySeed(account: '1' | '2' | '3') {
          const seed = this.getAccount(account).seed;
          const wallet = await this.xrplService.deriveWalletFromFamilySeed(seed);
          this.updateAccount(account, {
               address: wallet.address,
               seed: wallet.secret.familySeed || '',
               mnemonic: '',
               secretNumbers: '',
               encryptionAlgorithm: wallet.keypair.algorithm || '',
          });
          if (account === '3') {
               this.saveInput(`issuerAddress`, wallet.address || '');
               this.saveInput(`issuerSeed`, wallet.secret.familySeed || '');
               this.saveInput(`issuerMnemonic`, '');
               this.saveInput(`issuerSecretNumbers`, '');
               this.saveInput(`issuerEncryptionAlgorithm`, wallet.keypair.algorithm || '');
          } else {
               this.saveInput(`account${account}address`, wallet.address || '');
               this.saveInput(`account${account}seed`, wallet.secret.familySeed || '');
               this.saveInput(`account${account}mnemonic`, '');
               this.saveInput(`account${account}secretNumbers`, '');
               this.saveInput(`account${account}encryptionAlgorithm`, wallet.keypair.algorithm || '');
          }

          const destionations = this.storageService.getKnownIssuers('destinations');
          let updatedDestionations;
          if (destionations) {
               updatedDestionations = this.updateAccountDestination(destionations, Number(account), wallet.address);
               this.storageService.removeValue('destinations');
          }
          if (updatedDestionations) {
               this.storageService.setKnownIssuers('destinations', updatedDestionations);
          }
          this.emitChange();
     }

     async generateNewWalletFromMnemonic(account: '1' | '2' | '3') {
          const environment = this.xrplService.getNet().environment;
          let encryptionAlgorithm = AppConstants.ENCRYPTION.SECP256K1;
          if (this.encryptionType) {
               encryptionAlgorithm = AppConstants.ENCRYPTION.ED25519;
          }
          const wallet = await this.xrplService.generateWalletFromMnemonic(environment, encryptionAlgorithm);
          await this.sleep(4000);
          this.updateAccount(account, {
               address: wallet.address,
               mnemonic: wallet.secret.mnemonic || '',
               seed: wallet.secret.mnemonic || '',
               secretNumbers: '',
               encryptionAlgorithm: wallet.keypair.algorithm || '',
          });
          if (account === '3') {
               this.saveInput(`issuerAddress`, wallet.address || '');
               this.saveInput(`issuerSeed`, wallet.secret.mnemonic || '');
               this.saveInput(`issuerMnemonic`, wallet.secret.mnemonic || '');
               this.saveInput(`issuerSecretNumbers`, '');
               this.saveInput(`issuerEncryptionAlgorithm`, wallet.keypair.algorithm);
          } else {
               this.saveInput(`account${account}address`, wallet.address || '');
               this.saveInput(`account${account}mnemonic`, wallet.secret.mnemonic || '');
               this.saveInput(`account${account}seed`, wallet.secret.mnemonic || '');
               this.saveInput(`account${account}secretNumbers`, '');
               this.saveInput(`account${account}encryptionAlgorithm`, wallet.keypair.algorithm || '');
          }
          this.emitChange();
     }

     async deriveNewWalletFromMnemonic(account: '1' | '2' | '3') {
          const mnemonic = this.getAccount(account).mnemonic;
          const wallet = await this.xrplService.deriveWalletFromMnemonic(mnemonic);
          this.updateAccount(account, {
               address: wallet.address,
               mnemonic: wallet.secret.mnemonic || '',
               seed: wallet.secret.mnemonic || '',
               secretNumbers: '',
               encryptionAlgorithm: wallet.keypair.algorithm || '',
          });
          if (account === '3') {
               this.saveInput(`issuerAddress`, wallet.address || '');
               this.saveInput(`issuerSeed`, wallet.secret.mnemonic || '');
               this.saveInput(`issuerMnemonic`, wallet.secret.mnemonic || '');
               this.saveInput(`issuerSecretNumbers`, '');
               this.saveInput(`issuerEncryptionAlgorithm`, wallet.keypair.algorithm || '');
          } else {
               this.saveInput(`account${account}address`, wallet.address || '');
               this.saveInput(`account${account}mnemonic`, wallet.secret.mnemonic || '');
               this.saveInput(`account${account}seed`, wallet.secret.mnemonic || '');
               this.saveInput(`account${account}secretNumbers`, '');
               this.saveInput(`account${account}encryptionAlgorithm`, wallet.keypair.algorithm || '');
          }

          const destionations = this.storageService.getKnownIssuers('destinations');
          let updatedDestionations;
          if (destionations) {
               updatedDestionations = this.updateAccountDestination(destionations, Number(account), wallet.address);
               this.storageService.removeValue('destinations');
          }
          if (updatedDestionations) {
               this.storageService.setKnownIssuers('destinations', updatedDestionations);
          }
          this.emitChange();
     }

     async generateNewWalletFromSecretNumbers(account: '1' | '2' | '3') {
          const environment = this.xrplService.getNet().environment;
          let encryptionAlgorithm = AppConstants.ENCRYPTION.SECP256K1;
          if (this.encryptionType) {
               encryptionAlgorithm = AppConstants.ENCRYPTION.ED25519;
          }
          const wallet = await this.xrplService.generateWalletFromSecretNumbers(environment, encryptionAlgorithm);
          await this.sleep(4000);
          this.updateAccount(account, {
               address: wallet.address,
               secretNumbers: wallet.secret.secretNumbers || '',
               seed: wallet.secret.familySeed || '',
               mnemonic: '',
               encryptionAlgorithm: wallet.keypair.algorithm || '',
          });
          if (account === '3') {
               this.saveInput(`issuerAddress`, wallet.address || '');
               this.saveInput(`issuerSeed`, wallet.secret.familySeed || '');
               this.saveInput(`issuerMnemonic`, '');
               this.saveInput(`issuerSecretNumbers`, wallet.secret.secretNumbers || '');
               this.saveInput(`issuerEncryptionAlgorithm`, wallet.keypair.algorithm || '');
          } else {
               this.saveInput(`account${account}address`, wallet.address || '');
               this.saveInput(`account${account}secretNumbers`, wallet.secret.secretNumbers || '');
               this.saveInput(`account${account}mnemonic`, '');
               this.saveInput(`account${account}seed`, wallet.secret.familySeed || '');
               this.saveInput(`account${account}encryptionAlgorithm`, wallet.keypair.algorithm || '');
          }
          this.emitChange();
     }

     async deriveNewWalletFromSecretNumbers(account: '1' | '2' | '3') {
          const secretNumbers = this.getAccount(account).secretNumbers;
          const wallet = await this.xrplService.deriveWalletFromSecretNumbers(secretNumbers);
          this.updateAccount(account, {
               address: wallet.address,
               secretNumbers: wallet.secret.secretNumbers || '',
               seed: wallet.secret.familySeed,
               mnemonic: '',
               encryptionAlgorithm: wallet.keypair.algorithm || '',
          });
          if (account === '3') {
               this.saveInput(`issuerAddress`, wallet.address || '');
               this.saveInput(`issuerSeed`, wallet.secret.familySeed || '');
               this.saveInput(`issuerSecretNumbers`, wallet.secret.secretNumbers || '');
               this.saveInput(`issuerMnemonic`, '');
               this.saveInput(`issuerEncryptionAlgorithm`, wallet.keypair.algorithm || '');
          } else {
               this.saveInput(`account${account}address`, wallet.address || '');
               this.saveInput(`account${account}secretNumbers`, wallet.secret.secretNumbers || '');
               this.saveInput(`account${account}mnemonic`, '');
               this.saveInput(`account${account}seed`, wallet.secret.familySeed || '');
               this.saveInput(`account${account}encryptionAlgorithm`, wallet.keypair.algorithm || '');
          }

          const destionations = this.storageService.getKnownIssuers('destinations');
          let updatedDestionations;
          if (destionations) {
               updatedDestionations = this.updateAccountDestination(destionations, Number(account), wallet.address);
               this.storageService.removeValue('destinations');
          }
          if (updatedDestionations) {
               this.storageService.setKnownIssuers('destinations', updatedDestionations);
          }
          this.emitChange();
     }

     private updateAccountDestination(accounts: Record<string, string>, num: number, newAddress: string) {
          const key = `Account${num}`; // e.g. "Account1"
          if (accounts.hasOwnProperty(key)) {
               accounts[key] = newAddress;
          }
          return accounts;
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

     sleep(ms: number) {
          return new Promise(resolve => setTimeout(resolve, ms));
     }
}
