import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Output, ViewChild } from '@angular/core';
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
     selector: 'app-app-wallet-dynamic-input',
     standalone: true,
     imports: [CommonModule, FormsModule],
     templateUrl: './app-wallet-dynamic-input.component.html',
     styleUrl: './app-wallet-dynamic-input.component.css',
})
export class AppWalletDynamicInputComponent {
     @Output() walletListChange = new EventEmitter<any[]>();
     @Output() transactionResult = new EventEmitter<{ result: string; isError: boolean; isSuccess: boolean }>();
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;

     private searchSubject = new Subject<void>();
     private pageLoad: boolean = true;
     createWallet: boolean = false;
     encryptionType: boolean = false;
     showGenerateButtons = true;
     showDeriveButtons = false;
     transactionInput = '';
     spinner = false;
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = false;
     private lastResult: string = '';

     wallets: any[] = [];

     constructor(private readonly storageService: StorageService, private readonly cdr: ChangeDetectorRef, private readonly xrplService: XrplService, private readonly utilsService: UtilsService, private readonly renderUiComponentsService: RenderUiComponentsService, private readonly xrplTransactions: XrplTransactionService) {}

     ngOnInit() {
          const savedWallets = this.storageService.get('wallets');
          if (savedWallets) {
               this.wallets = JSON.parse(savedWallets);
          } else {
               // Migrate from old fixed wallets
               const oldAccount1 = {
                    name: this.storageService.getInputValue('account1name'),
                    address: this.storageService.getInputValue('account1address'),
                    seed: this.storageService.getInputValue('account1seed'),
                    mnemonic: this.storageService.getInputValue('account1mnemonic'),
                    secretNumbers: this.storageService.getInputValue('account1secretNumbers'),
                    encryptionAlgorithm: this.storageService.getInputValue('account1encryptionAlgorithm'),
               };
               const oldAccount2 = {
                    name: this.storageService.getInputValue('account2name'),
                    address: this.storageService.getInputValue('account2address'),
                    seed: this.storageService.getInputValue('account2seed'),
                    mnemonic: this.storageService.getInputValue('account2mnemonic'),
                    secretNumbers: this.storageService.getInputValue('account2secretNumbers'),
                    encryptionAlgorithm: this.storageService.getInputValue('account2encryptionAlgorithm'),
               };
               const oldIssuer = {
                    name: this.storageService.getInputValue('issuerName'),
                    address: this.storageService.getInputValue('issuerAddress'),
                    seed: this.storageService.getInputValue('issuerSeed'),
                    mnemonic: this.storageService.getInputValue('issuerMnemonic'),
                    secretNumbers: this.storageService.getInputValue('issuerSecretNumbers'),
                    encryptionAlgorithm: this.storageService.getInputValue('issuerEncryptionAlgorithm'),
               };
               this.wallets = [oldAccount1, oldAccount2, oldIssuer].filter(w => w.address);
               if (this.wallets.length === 0) {
                    this.addWallet();
               }
               this.saveWallets();
          }

          const savedCreateWallet = this.storageService.getInputValue('createWallet');
          this.createWallet = savedCreateWallet === 'true';
          const savedEncryptionType = this.storageService.getInputValue('encryptionType');
          this.encryptionType = savedEncryptionType === 'true';
          this.showGenerateButtons = this.createWallet;
          this.showDeriveButtons = !this.createWallet;
          this.emitChange();

          // Subscribe to clear inputs event (if applicable)
          this.storageService.inputsCleared.subscribe(() => {
               this.wallets = [];
               this.addWallet();
               this.createWallet = true;
               this.encryptionType = true;
               this.showGenerateButtons = true;
               this.showDeriveButtons = false;
               this.storageService.setInputValue('createWallet', 'true');
               this.storageService.setInputValue('encryptionType', 'true');
               this.saveWallets();
               this.emitChange();
          });

          this.searchSubject.pipe(debounceTime(300)).subscribe(() => {
               this.getTransaction();
          });
     }

     ngAfterViewChecked() {
          if (this.result !== this.lastResult && this.resultField?.nativeElement) {
               this.renderUiComponentsService.attachSearchListener(this.resultField.nativeElement);
               this.lastResult = this.result;
               this.cdr.detectChanges();
          }
     }

     addWallet() {
          this.wallets.push({
               name: '',
               address: '',
               seed: '',
               mnemonic: '',
               secretNumbers: '',
               encryptionAlgorithm: '',
          });
          this.saveWallets();
          this.emitChange();
     }

     removeWallet(index: number) {
          if (this.wallets.length > 1) {
               this.wallets.splice(index, 1);
               this.saveWallets();
               this.emitChange();
          }
     }

     saveWallets() {
          this.storageService.set('wallets', JSON.stringify(this.wallets));
     }

     triggerSearch() {
          this.searchSubject.next();
     }

     onCreateWalletChange() {
          this.showGenerateButtons = this.createWallet;
          this.showDeriveButtons = !this.createWallet;
          this.pageLoad = false;
          this.storageService.setInputValue('createWallet', this.createWallet.toString());
          this.emitChange();
     }

     onEncryptionChange() {
          this.pageLoad = false;
          this.storageService.setInputValue('encryptionType', this.encryptionType.toString());
          this.emitChange();
     }

     async generateNewWalletFromFamilySeed(index: number) {
          const environment = this.xrplService.getNet().environment;
          let encryptionAlgorithm = AppConstants.ENCRYPTION.SECP256K1;
          if (this.encryptionType) {
               encryptionAlgorithm = AppConstants.ENCRYPTION.ED25519;
          }
          const wallet = await this.xrplService.generateWalletFromFamilySeed(environment, encryptionAlgorithm);
          await this.sleep(4000);
          this.wallets[index] = {
               ...this.wallets[index],
               address: wallet.address,
               seed: wallet.secret.familySeed || '',
               mnemonic: '',
               secretNumbers: '',
               encryptionAlgorithm: wallet.keypair.algorithm || '',
          };
          this.saveWallets();
          this.emitChange();
     }

     async deriveNewWalletFromFamilySeed(index: number) {
          const seed = this.wallets[index].seed;
          if (!seed) {
               // Handle error, e.g., alert or log
               return;
          }
          const wallet = await this.xrplService.deriveWalletFromFamilySeed(seed);
          this.wallets[index] = {
               ...this.wallets[index],
               address: wallet.address,
               seed: wallet.secret.familySeed || '',
               mnemonic: '',
               secretNumbers: '',
               encryptionAlgorithm: wallet.keypair.algorithm || '',
          };
          this.saveWallets();
          this.emitChange();
     }

     async generateNewWalletFromMnemonic(index: number) {
          const environment = this.xrplService.getNet().environment;
          let encryptionAlgorithm = AppConstants.ENCRYPTION.SECP256K1;
          if (this.encryptionType) {
               encryptionAlgorithm = AppConstants.ENCRYPTION.ED25519;
          }
          const wallet = await this.xrplService.generateWalletFromMnemonic(environment, encryptionAlgorithm);
          await this.sleep(4000);
          this.wallets[index] = {
               ...this.wallets[index],
               address: wallet.address,
               seed: wallet.secret.mnemonic || '',
               mnemonic: wallet.secret.mnemonic || '',
               secretNumbers: '',
               encryptionAlgorithm: wallet.keypair.algorithm || '',
          };
          this.saveWallets();
          this.emitChange();
     }

     async deriveNewWalletFromMnemonic(index: number) {
          const mnemonic = this.wallets[index].mnemonic;
          if (!mnemonic) {
               return;
          }
          const wallet = await this.xrplService.deriveWalletFromMnemonic(mnemonic);
          this.wallets[index] = {
               ...this.wallets[index],
               address: wallet.address,
               seed: wallet.secret.mnemonic || '',
               mnemonic: wallet.secret.mnemonic || '',
               secretNumbers: '',
               encryptionAlgorithm: wallet.keypair.algorithm || '',
          };
          this.saveWallets();
          this.emitChange();
     }

     async generateNewWalletFromSecretNumbers(index: number) {
          const environment = this.xrplService.getNet().environment;
          let encryptionAlgorithm = AppConstants.ENCRYPTION.SECP256K1;
          if (this.encryptionType) {
               encryptionAlgorithm = AppConstants.ENCRYPTION.ED25519;
          }
          const wallet = await this.xrplService.generateWalletFromSecretNumbers(environment, encryptionAlgorithm);
          await this.sleep(4000);
          this.wallets[index] = {
               ...this.wallets[index],
               address: wallet.address,
               seed: wallet.secret.familySeed || '',
               mnemonic: '',
               secretNumbers: wallet.secret.secretNumbers || '',
               encryptionAlgorithm: wallet.keypair.algorithm || '',
          };
          this.saveWallets();
          this.emitChange();
     }

     async deriveNewWalletFromSecretNumbers(index: number) {
          const secretNumbers = this.wallets[index].secretNumbers;
          if (!secretNumbers) {
               return;
          }
          const wallet = await this.xrplService.deriveWalletFromSecretNumbers(secretNumbers);
          this.wallets[index] = {
               ...this.wallets[index],
               address: wallet.address,
               seed: wallet.secret.familySeed || '',
               mnemonic: '',
               secretNumbers: wallet.secret.secretNumbers || '',
               encryptionAlgorithm: wallet.keypair.algorithm || '',
          };
          this.saveWallets();
          this.emitChange();
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

     onPasteTrim(event: ClipboardEvent, index: number): void {
          event.preventDefault();
          const pastedText = event.clipboardData?.getData('text').trim() || '';
          this.wallets[index].mnemonic = pastedText;
          this.saveWallets();
          this.emitChange();
     }

     private emitChange() {
          this.walletListChange.emit(this.wallets);
     }

     sleep(ms: number) {
          return new Promise(resolve => setTimeout(resolve, ms));
     }
}
