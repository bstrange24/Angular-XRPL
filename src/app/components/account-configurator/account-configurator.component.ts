import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
// import { WalletInputComponent } from '../wallet-input/wallet-input.component';
import { WalletMultiInputComponent } from '../wallet-multi-input/wallet-multi-input.component';
import * as xrpl from 'xrpl';
import { StorageService } from '../../services/storage.service';
import { AccountSet, TransactionMetadataBase, DepositPreauth, SignerListSet } from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';

interface SignerEntry {
     Account: string;
     SignerWeight: number;
     SingnerSeed: string;
}

interface RegularKeyEntry {
     Account: string;
     RegularKeySeed: string;
}

interface AccountFlags {
     asfRequireDest: boolean;
     asfRequireAuth: boolean;
     asfDisallowXRP: boolean;
     asfDisableMaster: boolean;
     asfNoFreeze: boolean;
     asfGlobalFreeze: boolean;
     asfDefaultRipple: boolean;
     asfDepositAuth: boolean;
     // asfAuthorizedNFTokenMinter: boolean;
     asfAllowTrustLineClawback: boolean;
     asfDisallowIncomingNFTokenOffer: boolean;
     asfDisallowIncomingCheck: boolean;
     asfDisallowIncomingPayChan: boolean;
     asfDisallowIncomingTrustline: boolean;
}

@Component({
     selector: 'app-account-configurator',
     standalone: true,
     imports: [CommonModule, FormsModule, WalletMultiInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './account-configurator.component.html',
     styleUrl: './account-configurator.component.css',
})
export class AccountConfiguratorComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     @ViewChild('accountForm') accountForm!: NgForm;
     // selectedAccount: 'account1' | 'account2' | null = null;
     selectedAccount: 'account1' | 'account2' | null = 'account1'; // Initialize to 'account1' for default selection
     configurationType: 'holder' | 'exchanger' | 'issuer' | null = null; // New property to track configuration type
     private lastResult: string = '';
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = false;
     account1 = { name: '', address: '', seed: '', balance: '' };
     account2 = { name: '', address: '', seed: '', balance: '' };
     issuer = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '0' };
     ownerCount = '';
     totalXrpReserves = '';
     executionTime = '';
     ticketSequence: string = '';
     isTicket = false;
     isTicketEnabled = false;
     isMemoEnabled = false;
     isMultiSign = false;
     useMultiSign = false;
     multiSignAddress = '';
     isSetRegularKey = false;
     regularKeyAccount = '';
     regularKeyAccountSeed = '';
     signer1Account = '';
     signer2Account = '';
     signer3Account = '';
     signer1Seed = '';
     signer2Seed = '';
     signer3Seed = '';
     signer1Weight = '';
     signer2Weight = '';
     signer3Weight = '';
     signerQuorum = '';
     multiSignSeeds = '';
     nfTokenMinterAddress = '';
     isUpdateMetaData = false;
     isHolderConfiguration = false;
     isExchangerConfiguration = false;
     isIssuerConfiguration = false;
     isdepositAuthAddress = false;
     isAuthorizedNFTokenMinter: boolean = false;
     depositAuthAddress = '';
     tickSize = '';
     transferRate = '';
     isMessageKey = false;
     domain = '';
     memoField = '';
     avatarUrl = '';
     spinnerMessage: string = '';
     flags: AccountFlags = {
          asfRequireDest: false,
          asfRequireAuth: false,
          asfDisallowXRP: false,
          asfDisableMaster: false,
          asfNoFreeze: false,
          asfGlobalFreeze: false,
          asfDefaultRipple: false,
          asfDepositAuth: false,
          // asfAuthorizedNFTokenMinter: false,
          asfAllowTrustLineClawback: false,
          asfDisallowIncomingNFTokenOffer: false,
          asfDisallowIncomingCheck: false,
          asfDisallowIncomingPayChan: false,
          asfDisallowIncomingTrustline: false,
     };
     spinner = false;

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
          this.account1 = { ...event.account1, balance: '0' };
          this.account2 = { ...event.account2, balance: '0' };
          this.issuer = { ...event.issuer, balance: '0' };
          this.onAccountChange();
     }

     handleTransactionResult(event: { result: string; isError: boolean; isSuccess: boolean }) {
          this.result = event.result;
          this.isError = event.isError;
          this.isSuccess = event.isSuccess;
          this.isEditable = !this.isSuccess;
          this.cdr.detectChanges();
     }

     onAccountChange() {
          if (!this.selectedAccount) return;
          if (this.selectedAccount === 'account1') {
               this.displayDataForAccount1();
          } else if (this.selectedAccount === 'account2') {
               this.displayDataForAccount2();
          } else {
               this.displayDataForAccount3();
          }
          this.configurationType = null;
     }

     validateQuorum() {
          this.cdr.detectChanges();
     }

     onConfigurationChange() {
          // Reset all flags to ensure a clean state
          this.resetFlags();

          // Call the appropriate method based on configurationType
          if (this.configurationType === 'holder') {
               this.setHolder();
          } else if (this.configurationType === 'exchanger') {
               this.setExchanger();
          } else if (this.configurationType === 'issuer') {
               this.setIssuer();
          }

          console.log('Configuration changed to:', this.configurationType);
          this.cdr.detectChanges();
     }

     private resetFlags() {
          this.flags = {
               asfRequireDest: false,
               asfRequireAuth: false,
               asfDisallowXRP: false,
               asfDisableMaster: false,
               asfNoFreeze: false,
               asfGlobalFreeze: false,
               asfDefaultRipple: false,
               asfDepositAuth: false,
               // asfAuthorizedNFTokenMinter: false,
               asfAllowTrustLineClawback: false,
               asfDisallowIncomingNFTokenOffer: false,
               asfDisallowIncomingCheck: false,
               asfDisallowIncomingPayChan: false,
               asfDisallowIncomingTrustline: false,
          };

          // Reset metadata fields
          this.domain = '';
          this.transferRate = '';
          this.tickSize = '';

          // Update UI elements
          const domainFieldElem = document.getElementById('domainField') as HTMLInputElement | null;
          if (domainFieldElem) domainFieldElem.value = '';
          const transferRateFieldElem = document.getElementById('transferRateField') as HTMLInputElement | null;
          if (transferRateFieldElem) transferRateFieldElem.value = '';
          const tickSizeFieldElem = document.getElementById('tickSizeField') as HTMLInputElement | null;
          if (tickSizeFieldElem) tickSizeFieldElem.value = '';

          this.cdr.detectChanges();
     }

     setHolder() {
          // Update flags for Holder configuration
          this.flags.asfRequireDest = false;
          this.flags.asfRequireAuth = false;
          this.flags.asfDisallowXRP = false;
          this.flags.asfDisableMaster = false;
          this.flags.asfNoFreeze = false;
          this.flags.asfGlobalFreeze = false;
          this.flags.asfDefaultRipple = false;
          this.flags.asfDepositAuth = false;
          // this.flags.asfAuthorizedNFTokenMinter = false;
          this.flags.asfAllowTrustLineClawback = false;
          this.flags.asfDisallowIncomingNFTokenOffer = false;
          this.flags.asfDisallowIncomingCheck = false;
          this.flags.asfDisallowIncomingPayChan = false;
          this.flags.asfDisallowIncomingTrustline = false;

          this.cdr.detectChanges();
     }

     setExchanger() {
          // Update flags for Exchanger configuration
          this.flags.asfRequireDest = true;
          this.flags.asfRequireAuth = false;
          this.flags.asfDisallowXRP = false;
          this.flags.asfDisableMaster = false;
          this.flags.asfNoFreeze = false;
          this.flags.asfGlobalFreeze = false;
          this.flags.asfDefaultRipple = true;
          this.flags.asfDepositAuth = false;
          // this.flags.asfAuthorizedNFTokenMinter = false;
          this.flags.asfAllowTrustLineClawback = false;
          this.flags.asfDisallowIncomingNFTokenOffer = true;
          this.flags.asfDisallowIncomingCheck = false;
          this.flags.asfDisallowIncomingPayChan = true;
          this.flags.asfDisallowIncomingTrustline = false;

          this.cdr.detectChanges();
     }

     setIssuer() {
          // Update flags for Issuer configuration
          this.flags.asfRequireDest = true;
          this.flags.asfRequireAuth = false;
          this.flags.asfDisallowXRP = false;
          this.flags.asfDisableMaster = false;
          this.flags.asfNoFreeze = false;
          this.flags.asfGlobalFreeze = false;
          this.flags.asfDefaultRipple = true;
          this.flags.asfDepositAuth = true;
          // this.flags.asfAuthorizedNFTokenMinter = false;
          this.flags.asfAllowTrustLineClawback = false;
          this.flags.asfDisallowIncomingNFTokenOffer = true;
          this.flags.asfDisallowIncomingCheck = true;
          this.flags.asfDisallowIncomingPayChan = true;
          this.flags.asfDisallowIncomingTrustline = false;

          this.cdr.detectChanges();
     }

     toggleConfigurationTemplate() {
          this.cdr.detectChanges();
     }

     toggleMultiSign() {
          this.cdr.detectChanges();
     }

     toggleUseMultiSign() {
          if (this.multiSignAddress === 'No Multi-Sign address configured for account') {
               this.multiSignSeeds = '';
               this.cdr.detectChanges();
               return;
          }

          if (this.useMultiSign && this.storageService.get('signerEntries') != null && this.storageService.get('signerEntries').length > 0) {
               const signers = this.storageService.get('signerEntries');
               const addresses = signers.map((item: { Account: any }) => item.Account + ',\n').join('');
               const seeds = signers.map((item: { SingnerSeed: any }) => item.SingnerSeed + ',\n').join('');
               this.multiSignAddress = addresses;
               this.multiSignSeeds = seeds;
          }
          this.cdr.detectChanges();
     }

     toggleTicketSequence() {
          this.cdr.detectChanges();
     }

     onAuthorizedNFTokenMinter() {
          this.cdr.detectChanges();
     }

     onEnableMemo() {
          this.cdr.detectChanges();
     }

     updateSpinnerMessage(message: string) {
          this.spinnerMessage = message;
          this.cdr.detectChanges();
          console.log('Spinner message updated:', message);
     }

     async showSpinnerWithDelay(message: string, delayMs: number = 200) {
          this.spinner = true;
          this.updateSpinnerMessage(message);
          await new Promise(resolve => setTimeout(resolve, delayMs));
     }

     onNoFreezeChange() {
          if (this.flags.asfNoFreeze) {
               alert('Prevent Freezing Trust Lines (No Freeze) cannot be unset!');
          }
     }

     onClawbackChange() {
          if (this.flags.asfAllowTrustLineClawback) {
               alert('Trust Line Clawback cannot be unset!');
          }
     }

     async toggleMetaData() {
          console.log('Entering toggleMetaData');
          const startTime = Date.now();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               let wallet;
               if (this.selectedAccount === 'account1') {
                    wallet = await this.utilsService.getWallet(this.account1.seed, environment);
               } else if (this.selectedAccount === 'account2') {
                    wallet = await this.utilsService.getWallet(this.account2.seed, environment);
               } else {
                    wallet = await this.utilsService.getWallet(this.issuer.seed, environment);
               }

               if (!wallet) {
                    return this.setError('ERROR: Wallet could not be created or is undefined');
               }

               const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
               console.debug('accountInfo', accountInfo);
               this.refreshUiIAccountMetaData(accountInfo.result);
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving toggleMetaData in ${this.executionTime}ms`);
          }
     }

     async getAccountDetails() {
          console.log('Entering getAccountDetails');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               let wallet;
               if (this.selectedAccount === 'account1') {
                    wallet = await this.utilsService.getWallet(this.account1.seed, environment);
               } else if (this.selectedAccount === 'account2') {
                    wallet = await this.utilsService.getWallet(this.account2.seed, environment);
               } else {
                    wallet = await this.utilsService.getWallet(this.issuer.seed, environment);
               }

               if (!wallet) {
                    return this.setError('ERROR: Wallet could not be created or is undefined');
               }

               this.showSpinnerWithDelay('Getting Account Details...', 200);

               const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
               const accountObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '');
               console.debug(`accountObjects ${JSON.stringify(accountObjects, null, 2)} accountInfo ${JSON.stringify(accountInfo, null, 2)}`);

               if (accountInfo.result.account_data.length <= 0) {
                    this.resultField.nativeElement.innerHTML = `No account data found for ${wallet.classicAddress}`;
                    return;
               }

               // Set flags from account info
               AppConstants.FLAGS.forEach(flag => {
                    const input = document.getElementById(flag.name) as HTMLInputElement;
                    const flagKey = AppConstants.FLAGMAP[flag.name as keyof typeof AppConstants.FLAGMAP];
                    if (input && flagKey) {
                         input.checked = !!accountInfo.result.account_flags?.[flagKey as keyof typeof accountInfo.result.account_flags];
                    }
               });

               this.utilsService.renderAccountDetails(accountInfo, accountObjects);
               this.refreshUiIAccountMetaData(accountInfo.result);
               this.refreshUiAccountObjects(accountObjects);
               this.refreshUiAccountInfo(accountInfo);
               this.setSuccess(this.result);

               await this.updateXrpBalance(client, wallet);
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getAccountDetails in ${this.executionTime}ms`);
          }
     }

     async updateFlags() {
          console.log('Entering updateFlags');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }
          if (this.flags.asfNoFreeze && this.flags.asfGlobalFreeze) {
               return this.setError('ERROR: Cannot enable both NoFreeze and GlobalFreeze');
          }

          this.clearUiIAccountMetaData();

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               let wallet;
               if (this.selectedAccount === 'account1') {
                    wallet = await this.utilsService.getWallet(this.account1.seed, environment);
               } else if (this.selectedAccount === 'account2') {
                    wallet = await this.utilsService.getWallet(this.account2.seed, environment);
               } else {
                    wallet = await this.utilsService.getWallet(this.issuer.seed, environment);
               }

               if (!wallet) {
                    return this.setError('ERROR: Wallet could not be created or is undefined');
               }

               this.updateSpinnerMessage('Updating Account Flags...');

               const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
               console.debug('accountInfo', accountInfo);

               const { setFlags, clearFlags } = this.utilsService.getFlagUpdates(accountInfo.result.account_flags);

               if (setFlags.length === 0 && clearFlags.length === 0) {
                    this.resultField.nativeElement.innerHTML = 'Set Flags and Clear Flags length is 0. No flags selected for update';
                    return;
               }

               const transactions = [];
               let hasError = false;

               for (const flagValue of setFlags) {
                    const response = await this.submitFlagTransaction(client, wallet, { SetFlag: parseInt(flagValue) }, this.memoField);
                    transactions.push({
                         type: 'SetFlag',
                         flag: this.utilsService.getFlagName(flagValue),
                         result: typeof response.message === 'object' && 'result' in response.message ? response.message.result : response.message,
                    });
                    if (!response.success) {
                         hasError = true;
                    }
               }

               for (const flagValue of clearFlags) {
                    const response = await this.submitFlagTransaction(client, wallet, { ClearFlag: parseInt(flagValue) }, this.memoField);
                    transactions.push({
                         type: 'ClearFlag',
                         flag: this.utilsService.getFlagName(flagValue),
                         result: typeof response.message === 'object' && 'result' in response.message ? response.message.result : response.message,
                    });
                    if (!response.success) {
                         hasError = true;
                    }
               }

               if (hasError) {
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
               }

               console.debug(`transactions ${JSON.stringify(transactions, null, 2)}`);

               // Render all successful transactions
               this.utilsService.renderTransactionsResults(transactions, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               this.refreshUiAccountInfo(await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''));
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''));

               await this.updateXrpBalance(client, wallet);
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving updateFlags in ${this.executionTime}ms`);
          }
     }

     async updateMetaData() {
          console.log('Entering updateMetaData');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               let wallet;
               if (this.selectedAccount === 'account1') {
                    wallet = await this.utilsService.getWallet(this.account1.seed, environment);
               } else if (this.selectedAccount === 'account2') {
                    wallet = await this.utilsService.getWallet(this.account2.seed, environment);
               } else {
                    wallet = await this.utilsService.getWallet(this.issuer.seed, environment);
               }

               if (!wallet) {
                    return this.setError('ERROR: Wallet could not be created or is undefined');
               }

               this.updateSpinnerMessage('Updating Meta Data...');

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               const accountSetTx: AccountSet = await client.autofill({
                    TransactionType: 'AccountSet',
                    Account: wallet.classicAddress,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               });

               let updatedData = false;

               if (this.memoField) {
                    updatedData = true;
                    accountSetTx.Memos = [
                         {
                              Memo: {
                                   MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                                   MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                              },
                         },
                    ];
               }

               if (this.tickSize) {
                    const tickSize = parseInt(this.tickSize);
                    if (tickSize == 0) {
                         updatedData = true;
                         accountSetTx.TickSize = tickSize;
                    } else {
                         if (tickSize < 3 || tickSize > 15) {
                              return this.setError('ERROR: Tick size must be between 3 and 15.');
                         }
                         updatedData = true;
                         accountSetTx.TickSize = tickSize;
                    }
               }

               if (this.transferRate) {
                    const transferRate = parseFloat(this.transferRate);
                    if (transferRate == 0) {
                         updatedData = true;
                         accountSetTx.TransferRate = transferRate;
                    } else {
                         if (transferRate > 100) {
                              return this.setError('ERROR: Transfer rate cannot be greater than 100%.');
                         }
                         updatedData = true;
                         accountSetTx.TransferRate = this.utilsService.getTransferRate(transferRate);
                    }
               }

               if (this.isMessageKey) {
                    updatedData = true;
                    accountSetTx.MessageKey = wallet.publicKey;
               } else {
                    accountSetTx.MessageKey = '';
               }

               if (this.domain) {
                    updatedData = true;
                    accountSetTx.Domain = Buffer.from(this.domain, 'utf8').toString('hex');
               } else {
                    accountSetTx.Domain = '';
               }

               if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, accountSetTx, fee)) {
                    return this.setError('ERROR: Insufficent XRP to complete transaction');
               }

               if (updatedData) {
                    this.updateSpinnerMessage('Submitting transaction to the Ledger...');
                    const response = await client.submitAndWait(accountSetTx, { wallet });
                    if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                         console.error(`response ${JSON.stringify(response, null, 2)}`);
                         this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                         this.resultField.nativeElement.classList.add('error');
                         this.setErrorProperties();
                         return;
                    }

                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('success');
               } else {
                    this.resultField.nativeElement.innerHTML = `No fields have data to update.\n`;
                    return;
               }

               this.isUpdateMetaData = true;
               this.setSuccess(this.result);

               this.refreshUiAccountInfo(await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''));
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''));

               await this.updateXrpBalance(client, wallet);
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving updateMetaData in ${this.executionTime}ms`);
          }
     }

     async setDepositAuthAccounts(authorizeFlag: 'Y' | 'N'): Promise<void> {
          console.log('Entering setDepositAuthAccounts');
          const startTime = Date.now();
          this.setSuccessProperties();

          // Validate selected account and seed
          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          // Split and validate deposit auth addresses
          const addressesArray = this.depositAuthAddress
               .split(',')
               .map(address => address.trim())
               .filter(addr => addr !== '');

          // Validate: At least one address
          if (!addressesArray.length) {
               return this.setError('ERROR: Deposit Auth address list is empty');
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               let wallet;
               if (this.selectedAccount === 'account1') {
                    wallet = await this.utilsService.getWallet(this.account1.seed, environment);
               } else if (this.selectedAccount === 'account2') {
                    wallet = await this.utilsService.getWallet(this.account2.seed, environment);
               } else {
                    wallet = await this.utilsService.getWallet(this.issuer.seed, environment);
               }

               if (!wallet) {
                    return this.setError('ERROR: Wallet could not be created or is undefined');
               }

               // Validate: Self-address not included
               const selfAddress = wallet.classicAddress;
               if (addressesArray.includes(selfAddress)) {
                    return this.setError('ERROR: Your own account cannot be in the deposit auth list');
               }

               // Validate: Each is a classic XRPL address
               const invalidAddresses = addressesArray.filter(addr => !xrpl.isValidClassicAddress(addr));
               if (invalidAddresses.length > 0) {
                    return this.setError(`ERROR: Invalid XRPL addresses: ${invalidAddresses.join(', ')}`);
               }

               // Validate: No duplicates
               const duplicates = addressesArray.filter((addr, idx, self) => self.indexOf(addr) !== idx);
               if (duplicates.length > 0) {
                    return this.setError(`ERROR: Duplicate addresses detected: ${[...new Set(duplicates)].join(', ')}`);
               }

               // Get account objects once for efficiency
               const accountObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'deposit_preauth');
               console.debug(`accountObjects ${JSON.stringify(accountObjects, null, 2)}`);

               // Validate each address
               for (const authorizedAddress of addressesArray) {
                    // Check if account exists and has asfDepositAuth flag
                    let accountInfo;
                    try {
                         accountInfo = await this.xrplService.getAccountInfo(client, authorizedAddress, 'validated', '');
                    } catch (error: any) {
                         if (error.data?.error === 'actNotFound') {
                              return this.setError(`ERROR: Authorized account ${authorizedAddress} does not exist (tecNO_TARGET)`);
                         }
                         throw error;
                    }
                    console.debug(`accountInfo for ${authorizedAddress}: ${JSON.stringify(accountInfo, null, 2)}`);

                    // if (!accountInfo.result.account_flags?.depositAuth) {
                    //      return this.setError(`ERROR: Account ${authorizedAddress} must have asfDepositAuth flag enabled`);
                    // }

                    // Check for existing preauthorization
                    const alreadyAuthorized = accountObjects.result.account_objects.some((obj: any) => obj.Authorize === authorizedAddress);
                    if (authorizeFlag === 'Y' && alreadyAuthorized) {
                         return this.setError(`ERROR: Preauthorization already exists for ${authorizedAddress} (tecDUPLICATE). Use Unauthorize to remove`);
                    }
                    if (authorizeFlag === 'N' && !alreadyAuthorized) {
                         return this.setError(`ERROR: No preauthorization exists for ${authorizedAddress} to unauthorize`);
                    }
               }

               this.updateSpinnerMessage('Setting Deposit Auth...');

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);
               const results: any[] = [];

               // Process each address
               for (const authorizedAddress of addressesArray) {
                    const depositPreauthTx: DepositPreauth = await client.autofill({
                         TransactionType: 'DepositPreauth',
                         Account: wallet.classicAddress,
                         [authorizeFlag === 'Y' ? 'Authorize' : 'Unauthorize']: authorizedAddress,
                         Fee: fee,
                         LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                    });

                    if (this.memoField) {
                         depositPreauthTx.Memos = [
                              {
                                   Memo: {
                                        MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                                        MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                                   },
                              },
                         ];
                    }

                    // Check XRP balance for each transaction
                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, depositPreauthTx, fee)) {
                         return this.setError(`ERROR: Insufficient XRP to complete transaction for ${authorizedAddress}`);
                    }

                    this.updateSpinnerMessage(`Submitting DepositPreauth for ${authorizedAddress} to the Ledger...`);

                    // Submit transaction
                    const response = await client.submitAndWait(depositPreauthTx, { wallet });
                    const result = response.result;
                    results.push({ result });

                    // Check transaction result
                    if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                         console.error(`Response for ${authorizedAddress}: ${JSON.stringify(response, null, 2)}`);
                         this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                         this.resultField.nativeElement.classList.add('error');
                         this.setErrorProperties();
                         return this.setError(`ERROR: Transaction failed for ${authorizedAddress}`);
                    }
               }

               // All transactions successful
               this.utilsService.renderTransactionsResults(results, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');

               this.refreshUiAccountInfo(await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''));
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''));

               await this.updateXrpBalance(client, wallet);
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving setDepositAuthAccounts in ${this.executionTime}ms`);
          }
     }

     async setMultiSign(enableMultiSignFlag: 'Y' | 'N') {
          console.log('Entering setMultiSign');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               let wallet;
               if (this.selectedAccount === 'account1') {
                    wallet = await this.utilsService.getWallet(this.account1.seed, environment);
               } else if (this.selectedAccount === 'account2') {
                    wallet = await this.utilsService.getWallet(this.account2.seed, environment);
               } else {
                    wallet = await this.utilsService.getWallet(this.issuer.seed, environment);
               }

               if (!wallet) {
                    return this.setError('ERROR: Wallet could not be created or is undefined');
               }

               console.log(`this.signer1Account ${this.signer1Account} this.signer2Account ${this.signer2Account} this.signer3Account ${this.signer3Account}`);
               console.log(`this.signer1Weight ${this.signer1Weight} this.signer2Weight ${this.signer2Weight} this.signer3Weight ${this.signer3Weight} this.signerQuorum ${this.signerQuorum}`);

               this.updateSpinnerMessage('Setting Multi Sign...');

               const fee = await this.xrplService.calculateTransactionFee(client);

               let signerListTx: SignerListSet;
               let signerEntries;
               if (enableMultiSignFlag === 'Y') {
                    // Create array of signer accounts and their weights
                    signerEntries = [
                         { Account: this.signer1Account, SignerWeight: Number(this.signer1Weight), SingnerSeed: this.signer1Seed },
                         { Account: this.signer2Account, SignerWeight: Number(this.signer2Weight), SingnerSeed: this.signer2Seed },
                         { Account: this.signer3Account, SignerWeight: Number(this.signer3Weight), SingnerSeed: this.signer3Seed },
                    ].filter(entry => entry.Account && entry.SignerWeight > 0); // Filter out empty or invalid entries

                    // Validate: At least one valid signer
                    if (!signerEntries.length) {
                         return this.setError('ERROR: No valid signer accounts provided');
                    }

                    // Validate: Self-address not included
                    const selfAddress = wallet.classicAddress;
                    if (signerEntries.some(entry => entry.Account === selfAddress)) {
                         return this.setError('ERROR: Your own account cannot be in the signer list');
                    }

                    // Validate: Each is a classic XRPL address
                    const invalidAddresses = signerEntries.filter(entry => !xrpl.isValidClassicAddress(entry.Account));
                    if (invalidAddresses.length > 0) {
                         return this.setError(`ERROR: Invalid XRPL addresses: ${invalidAddresses.map(entry => entry.Account).join(', ')}`);
                    }

                    // Validate: No duplicates
                    const addresses = signerEntries.map(entry => entry.Account);
                    const duplicates = addresses.filter((addr, idx, self) => self.indexOf(addr) !== idx);
                    if (duplicates.length > 0) {
                         return this.setError(`ERROR: Duplicate addresses detected: ${[...new Set(duplicates)].join(', ')}`);
                    }

                    // Validate: Max 8 signers
                    if (signerEntries.length > 8) {
                         return this.setError(`ERROR: XRPL allows max 8 signer entries. You provided ${signerEntries.length}`);
                    }

                    // Validate: Quorum does not exceed total weight
                    const totalWeight = signerEntries.reduce((sum, entry) => sum + entry.SignerWeight, 0);
                    const SignerQuorum = Number(this.signerQuorum);
                    if (SignerQuorum > totalWeight) {
                         return this.setError(`ERROR: Quorum (${SignerQuorum}) exceeds total signer weight (${totalWeight})`);
                    }
                    if (SignerQuorum <= 0) {
                         return this.setError('ERROR: Quorum must be greater than 0');
                    }

                    // Format SignerEntries for XRPL transaction
                    const formattedSignerEntries = signerEntries.map(entry => ({
                         SignerEntry: {
                              Account: entry.Account,
                              SignerWeight: entry.SignerWeight,
                         },
                    }));

                    const currentLedger = await this.xrplService.getLastLedgerIndex(client);

                    if (this.ticketSequence) {
                         // Validate ticket sequence
                         if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                              return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                         }

                         signerListTx = await client.autofill({
                              TransactionType: 'SignerListSet',
                              Account: wallet.classicAddress,
                              SignerQuorum,
                              SignerEntries: formattedSignerEntries,
                              TicketSequence: Number(this.ticketSequence),
                              Sequence: 0,
                              Fee: fee,
                              LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                         });

                         if (this.memoField) {
                              signerListTx.Memos = [
                                   {
                                        Memo: {
                                             MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                                             MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                                        },
                                   },
                              ];
                         }
                    } else {
                         signerListTx = await client.autofill({
                              TransactionType: 'SignerListSet',
                              Account: wallet.classicAddress,
                              SignerQuorum,
                              SignerEntries: formattedSignerEntries,
                              Fee: fee,
                              LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                         });

                         if (this.memoField) {
                              signerListTx.Memos = [
                                   {
                                        Memo: {
                                             MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                                             MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                                        },
                                   },
                              ];
                         }
                    }
               } else {
                    // Disable multi-sign (set SignerQuorum to 0 and empty SignerEntries)
                    const currentLedger = await this.xrplService.getLastLedgerIndex(client);

                    if (this.ticketSequence) {
                         // Validate ticket sequence
                         if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                              return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                         }

                         signerListTx = await client.autofill({
                              TransactionType: 'SignerListSet',
                              Account: wallet.classicAddress,
                              SignerQuorum: 0,
                              TicketSequence: Number(this.ticketSequence),
                              Sequence: 0,
                              Fee: fee,
                              LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                         });

                         if (this.memoField) {
                              signerListTx.Memos = [
                                   {
                                        Memo: {
                                             MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                                             MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                                        },
                                   },
                              ];
                         }
                    } else {
                         signerListTx = await client.autofill({
                              TransactionType: 'SignerListSet',
                              Account: wallet.classicAddress,
                              SignerQuorum: 0,
                              Fee: fee,
                              LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                         });

                         if (this.memoField) {
                              signerListTx.Memos = [
                                   {
                                        Memo: {
                                             MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                                             MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                                        },
                                   },
                              ];
                         }
                    }
               }

               if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, signerListTx, fee)) {
                    return this.setError('ERROR: Insufficent XRP to complete transaction');
               }

               this.updateSpinnerMessage('Submitting transaction to the Ledger...');

               const response = await client.submitAndWait(signerListTx, { wallet });
               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    console.error(`response ${JSON.stringify(response, null, 2)}`);
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               this.refreshUiAccountInfo(await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''));
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''));

               if (enableMultiSignFlag === 'Y') {
                    this.storageService.set('signerEntries', signerEntries);
               } else {
                    this.storageService.removeValue('signerEntries');
               }

               await this.updateXrpBalance(client, wallet);
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving setMultiSign in ${this.executionTime}ms`);
          }
     }

     async setRegularKey(enableRegularKeyFlag: 'Y' | 'N') {
          console.log('Entering setRegularKey');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed,
               multiSignAddresses: this.isMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.isMultiSign ? this.multiSignSeeds : undefined,
               regularKeyAccount: this.regularKeyAccount ? this.regularKeyAccount : undefined,
               regularKeyAccountSeeds: this.regularKeyAccountSeed ? this.regularKeyAccountSeed : undefined,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();

               let wallet;
               if (this.selectedAccount === 'account1') {
                    wallet = await this.utilsService.getWallet(this.account1.seed, environment);
               } else if (this.selectedAccount === 'account2') {
                    wallet = await this.utilsService.getWallet(this.account2.seed, environment);
               } else {
                    wallet = await this.utilsService.getWallet(this.issuer.seed, environment);
               }

               if (!wallet) {
                    return this.setError('ERROR: Wallet could not be created or is undefined');
               }

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);
               let setRegularKeyTx: xrpl.SetRegularKey;
               if (enableRegularKeyFlag === 'Y') {
                    setRegularKeyTx = {
                         TransactionType: 'SetRegularKey',
                         Account: wallet.classicAddress,
                         RegularKey: this.regularKeyAccount,
                         Fee: fee,
                         LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                    };
               } else {
                    // Important: omit RegularKey field to unset it
                    setRegularKeyTx = {
                         TransactionType: 'SetRegularKey',
                         Account: wallet.classicAddress,
                         Fee: fee,
                         LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                    };
               }

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    setRegularKeyTx.TicketSequence = Number(this.ticketSequence);
                    setRegularKeyTx.Sequence = 0;
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    setRegularKeyTx.Sequence = getAccountInfo.result.account_data.Sequence;
               }

               if (this.memoField) {
                    setRegularKeyTx.Memos = [
                         {
                              Memo: {
                                   MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                                   MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                              },
                         },
                    ];
               }

               let signedTx: { tx_blob: string; hash: string } | null = null;

               if (this.isMultiSign) {
                    let signerAddresses: string[] = [];
                    let signerSeeds: string[] = [];

                    const signerAccounts: string[] = this.checkForSignerAccounts(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''));
                    if (signerAccounts && signerAccounts.length > 0) {
                         if (Array.isArray(signerAccounts) && signerAccounts.length > 0) {
                              const signerEntries: SignerEntry[] = this.storageService.get('signerEntries') || [];
                              signerAddresses = signerAccounts.map(account => account?.split('~')[0]).filter((address): address is string => address !== undefined && address !== '');

                              signerSeeds = signerAccounts
                                   .map(account => {
                                        const address = account?.split('~')[0];
                                        const entry = signerEntries.find((entry: SignerEntry) => entry.Account === address);
                                        return entry?.SingnerSeed;
                                   })
                                   .filter((seed): seed is string => seed !== undefined && seed !== '');
                         }
                    }

                    try {
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: setRegularKeyTx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         setRegularKeyTx.Signers = result.signers;

                         console.log('Set regular key with signers:', JSON.stringify(setRegularKeyTx, null, 2));
                         console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    console.log('Set regular key without signers:', JSON.stringify(setRegularKeyTx, null, 2));
                    const preparedTx = await client.autofill(setRegularKeyTx);
                    signedTx = wallet.sign(preparedTx);
               }

               this.updateSpinnerMessage('Submitting transaction to the Ledger ...');

               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Submit Response:', JSON.stringify(response, null, 2));

               if (response.result.meta && typeof response.result.meta !== 'string' && response.result.meta.TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    console.error(`Transaction failed: ${JSON.stringify(response, null, 2)}`);
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               this.refreshUiAccountInfo(await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''));
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''));

               if (enableRegularKeyFlag === 'Y') {
                    this.storageService.set('regularKey', this.regularKeyAccount);
                    this.storageService.set('regularKeySeed', this.regularKeyAccountSeed);
               } else {
                    this.storageService.removeValue('regularKey');
                    this.storageService.removeValue('regularKeySeed');
               }

               await this.updateXrpBalance(client, wallet);
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving setMultiSign in ${this.executionTime}ms`);
          }
     }

     async setNftMinterAddress(enableNftMinter: 'Y' | 'N') {
          console.log('Entering setMultiSign');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          // Split and validate deposit auth addresses
          const addressesArray = this.nfTokenMinterAddress
               .split(',')
               .map(address => address.trim())
               .filter(addr => addr !== '');

          // Validate: At least one address
          if (!addressesArray.length) {
               return this.setError('ERROR: Deposit Auth address list is empty');
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               let wallet;
               if (this.selectedAccount === 'account1') {
                    wallet = await this.utilsService.getWallet(this.account1.seed, environment);
               } else if (this.selectedAccount === 'account2') {
                    wallet = await this.utilsService.getWallet(this.account2.seed, environment);
               } else {
                    wallet = await this.utilsService.getWallet(this.issuer.seed, environment);
               }

               if (!wallet) {
                    return this.setError('ERROR: Wallet could not be created or is undefined');
               }

               this.updateSpinnerMessage('Setting NFT Minter...');

               // Validate: Self-address not included
               const selfAddress = wallet.classicAddress;
               if (addressesArray.includes(selfAddress)) {
                    return this.setError('ERROR: Your own account cannot be in the deposit auth list');
               }

               // Validate: Each is a classic XRPL address
               const invalidAddresses = addressesArray.filter(addr => !xrpl.isValidClassicAddress(addr));
               if (invalidAddresses.length > 0) {
                    return this.setError(`ERROR: Invalid XRPL addresses: ${invalidAddresses.join(', ')}`);
               }

               // Validate: No duplicates
               const duplicates = addressesArray.filter((addr, idx, self) => self.indexOf(addr) !== idx);
               if (duplicates.length > 0) {
                    return this.setError(`ERROR: Duplicate addresses detected: ${[...new Set(duplicates)].join(', ')}`);
               }

               // Get account objects once for efficiency
               const accountObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'deposit_preauth');
               console.debug(`accountObjects ${JSON.stringify(accountObjects, null, 2)}`);

               // Validate each address
               for (const authorizedAddress of addressesArray) {
                    // Check if account exists and has asfDepositAuth flag
                    let accountInfo;
                    try {
                         accountInfo = await this.xrplService.getAccountInfo(client, authorizedAddress, 'validated', '');
                    } catch (error: any) {
                         if (error.data?.error === 'actNotFound') {
                              return this.setError(`ERROR: Authorized account ${authorizedAddress} does not exist (tecNO_TARGET)`);
                         }
                         throw error;
                    }
                    console.debug(`accountInfo for ${authorizedAddress}: ${JSON.stringify(accountInfo, null, 2)}`);
               }

               this.updateSpinnerMessage('Setting NFT Minter Address...');

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);
               const results: any[] = [];

               // Process each address
               for (const authorizedAddress of addressesArray) {
                    const accountSetTx: AccountSet = await client.autofill({
                         TransactionType: 'AccountSet',
                         Account: wallet.classicAddress,
                         NFTokenMinter: enableNftMinter === 'Y' ? authorizedAddress : '',
                         Fee: fee,
                         LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                    });

                    if (this.memoField) {
                         accountSetTx.Memos = [
                              {
                                   Memo: {
                                        MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                                        MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                                   },
                              },
                         ];
                    }

                    // Check XRP balance for each transaction
                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, accountSetTx, fee)) {
                         return this.setError(`ERROR: Insufficient XRP to complete transaction for ${authorizedAddress}`);
                    }

                    this.updateSpinnerMessage(`Submitting DepositPreauth for ${authorizedAddress} to the Ledger...`);

                    // Submit transaction
                    const response = await client.submitAndWait(accountSetTx, { wallet });
                    const result = response.result;
                    results.push({ result });

                    // Check transaction result
                    if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                         console.error(`Response for ${authorizedAddress}: ${JSON.stringify(response, null, 2)}`);
                         this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                         this.resultField.nativeElement.classList.add('error');
                         this.setErrorProperties();
                         return this.setError(`ERROR: Transaction failed for ${authorizedAddress}`);
                    }
               }

               // All transactions successful
               this.utilsService.renderTransactionsResults(results, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               this.refreshUiAccountInfo(await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''));
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''));

               await this.updateXrpBalance(client, wallet);
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving setMultiSign in ${this.executionTime}ms`);
          }
     }

     private async submitFlagTransaction(client: xrpl.Client, wallet: xrpl.Wallet, flagPayload: any, memoField: any) {
          console.log('Entering submitFlagTransaction');
          const startTime = Date.now();

          if (flagPayload.SetFlag) {
               const flagToUpdate = Array.from(AppConstants.FLAGS.values()).find((flag: any) => flag.value === flagPayload.SetFlag);
               this.updateSpinnerMessage(`Submitting ${flagToUpdate ? flagToUpdate.label : 'Flag'} set flag to the Ledger...`);
          }

          if (flagPayload.ClearFlag) {
               const flagToUpdate = Array.from(AppConstants.FLAGS.values()).find((flag: any) => flag.value === flagPayload.ClearFlag);
               this.updateSpinnerMessage(`Submitting ${flagToUpdate ? flagToUpdate.label : 'Flag'} clear flag to the Ledger...`);
          }

          // let tx;
          // if (flagPayload.SetFlag === 10) {
          //      tx = {
          //           TransactionType: 'AccountSet',
          //           Account: wallet.classicAddress,
          //           ...flagPayload,
          //           NFTokenMinter: this.nfTokenMinterAddress,
          //      };
          // } else if (flagPayload.ClearFlag === 10) {
          //      tx = {
          //           TransactionType: 'AccountSet',
          //           Account: wallet.classicAddress,
          //           ...flagPayload,
          //           NFTokenMinter: '',
          //      };
          // } else {
          const tx = {
               TransactionType: 'AccountSet',
               Account: wallet.classicAddress,
               ...flagPayload,
          };
          // }

          if (memoField) {
               tx.Memos = [
                    {
                         Memo: {
                              MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                              MemoData: Buffer.from(memoField, 'utf8').toString('hex'),
                         },
                    },
               ];
          }

          try {
               const fee = await this.xrplService.calculateTransactionFee(client);
               tx.fee = fee;

               if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, fee)) {
                    throw new Error('ERROR: Insufficent XRP to complete transaction');
               }

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

     private checkForSignerAccounts(accountObjects: xrpl.AccountObjectsResponse) {
          const signerAccounts: string[] = [];
          if (accountObjects.result && Array.isArray(accountObjects.result.account_objects)) {
               accountObjects.result.account_objects.forEach(obj => {
                    if (obj.LedgerEntryType === 'SignerList' && Array.isArray(obj.SignerEntries)) {
                         obj.SignerEntries.forEach((entry: any) => {
                              if (entry.SignerEntry && entry.SignerEntry.Account) {
                                   signerAccounts.push(entry.SignerEntry.Account + '~' + entry.SignerEntry.SignerWeight);
                                   this.signerQuorum = obj.SignerQuorum.toString();
                              }
                         });
                    }
               });
          }
          return signerAccounts;
     }

     private findDepositPreauthObjects(accountObjects: xrpl.AccountObjectsResponse) {
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

     private async updateXrpBalance(client: xrpl.Client, wallet: xrpl.Wallet) {
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
     }

     private validateInputs(inputs: { seed?: string; amount?: string; destination?: string; sequence?: string; selectedAccount?: 'account1' | 'account2' | null; multiSignAddresses?: string; multiSignSeeds?: string; regularKeyAccount?: string; regularKeyAccountSeeds?: string }): string | null {
          if (inputs.selectedAccount !== undefined && !inputs.selectedAccount) {
               return 'Please select an account';
          }
          if (inputs.seed != undefined) {
               if (!this.utilsService.validateInput(inputs.seed)) {
                    return 'Account seed cannot be empty';
               }
               if (!xrpl.isValidSecret(inputs.seed)) {
                    return 'Account seed is invalid';
               }
          } else {
               return 'Account seed is invalid';
          }
          if (inputs.amount != undefined) {
               if (!this.utilsService.validateInput(inputs.amount)) {
                    return 'XRP Amount cannot be empty';
               }
               if (isNaN(parseFloat(inputs.amount ?? '')) || !isFinite(parseFloat(inputs.amount ?? ''))) {
                    return 'XRP Amount must be a valid number';
               }
               if (inputs.amount && parseFloat(inputs.amount) <= 0) {
                    return 'XRP Amount must be a positive number';
               }
          }
          if (inputs.destination != undefined && !this.utilsService.validateInput(inputs.destination)) {
               return 'Destination cannot be empty';
          }
          if (inputs.multiSignAddresses && inputs.multiSignSeeds) {
               const addresses = inputs.multiSignAddresses
                    .split(',')
                    .map(addr => addr.trim())
                    .filter(addr => addr);
               const seeds = inputs.multiSignSeeds
                    .split(',')
                    .map(seed => seed.trim())
                    .filter(seed => seed);
               if (addresses.length === 0) {
                    return 'At least one signer address is required for multi-signing';
               }
               // if (addresses.length !== seeds.length) {
               //      return 'Number of signer addresses must match number of signer seeds';
               // }
               for (const addr of addresses) {
                    if (!xrpl.isValidAddress(addr)) {
                         return `Invalid signer address: ${addr}`;
                    }
               }
               for (const seed of seeds) {
                    if (!xrpl.isValidSecret(seed)) {
                         return 'One or more signer seeds are invalid';
                    }
               }
          }
          if (inputs.regularKeyAccountSeeds && inputs.regularKeyAccount) {
               const addresses = inputs.regularKeyAccount
                    .split(',')
                    .map(addr => addr.trim())
                    .filter(addr => addr);
               const seeds = inputs.regularKeyAccountSeeds
                    .split(',')
                    .map(seed => seed.trim())
                    .filter(seed => seed);
               if (addresses.length === 0) {
                    return 'At least one signer address is required to set a Regular Key';
               }
               for (const addr of addresses) {
                    if (!xrpl.isValidAddress(addr)) {
                         return `Invalid signer address: ${addr}`;
                    }
               }
               for (const seed of seeds) {
                    if (!xrpl.isValidSecret(seed)) {
                         return 'One or more signer seeds are invalid';
                    }
               }
          }
          return null;
     }

     refreshUiAccountObjects(accountObjects: any) {
          const signerAccounts: string[] = this.checkForSignerAccounts(accountObjects);
          if (signerAccounts && signerAccounts.length > 0) {
               if (Array.isArray(signerAccounts) && signerAccounts.length > 0) {
                    const signerEntries: SignerEntry[] = this.storageService.get('signerEntries') || [];

                    // Assign account addresses and weights
                    this.signer1Account = signerAccounts[0]?.split('~')[0] || '';
                    this.signer1Weight = signerAccounts[0]?.split('~')[1] || '';
                    this.signer1Seed = signerEntries.find((entry: SignerEntry) => entry.Account === this.signer1Account)?.SingnerSeed || '';

                    this.signer2Account = signerAccounts[1]?.split('~')[0] || '';
                    this.signer2Weight = signerAccounts[1]?.split('~')[1] || '';
                    this.signer2Seed = signerEntries.find((entry: SignerEntry) => entry.Account === this.signer2Account)?.SingnerSeed || '';

                    this.signer3Account = signerAccounts[2]?.split('~')[0] || '';
                    this.signer3Weight = signerAccounts[2]?.split('~')[1] || '';
                    this.signer3Seed = signerEntries.find((entry: SignerEntry) => entry.Account === this.signer3Account)?.SingnerSeed || '';

                    let signerEntries_ = [
                         { Account: this.signer1Account, SignerWeight: Number(this.signer1Weight), SingnerSeed: this.signer1Seed },
                         { Account: this.signer2Account, SignerWeight: Number(this.signer2Weight), SingnerSeed: this.signer2Seed },
                         { Account: this.signer3Account, SignerWeight: Number(this.signer3Weight), SingnerSeed: this.signer3Seed },
                    ].filter(entry => entry.Account && entry.SignerWeight > 0); // Filter out empty or invalid entries

                    this.storageService.removeValue('signerEntries');
                    this.storageService.set('signerEntries', signerEntries_);

                    const addresses = signerEntries_.map((item: { Account: any }) => item.Account + ',\n').join('');
                    const seeds = signerEntries_.map((item: { SingnerSeed: any }) => item.SingnerSeed + ',\n').join('');
                    this.multiSignAddress = addresses;
                    this.multiSignSeeds = seeds;
                    this.isMultiSign = true;
               }
          } else {
               this.signer1Account = '';
               this.signer1Weight = '';
               this.signer1Seed = '';
               this.signer2Account = '';
               this.signer2Weight = '';
               this.signer2Seed = '';
               this.signer3Account = '';
               this.signer3Weight = '';
               this.signer3Seed = '';
               this.multiSignAddress = 'No Multi-Sign address configured for account';
               this.multiSignSeeds = ''; // Clear seeds if no signer accounts
               this.isMultiSign = false;
               this.useMultiSign = false;
          }

          const preAuthAccounts: string[] = this.findDepositPreauthObjects(accountObjects);
          if (preAuthAccounts && preAuthAccounts.length > 0) {
               this.depositAuthAddress = preAuthAccounts.map(account => account + ',\n').join('');
               this.isdepositAuthAddress = true;
          } else {
               this.depositAuthAddress = '';
               this.isdepositAuthAddress = false;
          }
          this.isMemoEnabled = false;
          this.memoField = '';
     }

     refreshUiIAccountMetaData(accountInfo: any) {
          const { TickSize, TransferRate, Domain, MessageKey } = accountInfo.account_data;

          // this.isUpdateMetaData = !!(TickSize || TransferRate || Domain || MessageKey);

          // if (!this.isUpdateMetaData) {
          //      return;
          // }

          this.tickSize = TickSize || '';
          this.transferRate = TransferRate ? ((TransferRate / 1_000_000_000 - 1) * 100).toFixed(3) : '';
          this.domain = Domain ? this.utilsService.decodeHex(Domain) : '';
          this.isMessageKey = !!MessageKey;

          this.cdr.detectChanges();
     }

     refreshUiAccountInfo(accountInfo: any) {
          if (accountInfo.result.account_data && accountInfo.result.account_data.NFTokenMinter) {
               this.isAuthorizedNFTokenMinter = true;
               this.nfTokenMinterAddress = accountInfo.result.account_data.NFTokenMinter;
          } else {
               this.isAuthorizedNFTokenMinter = false;
               this.nfTokenMinterAddress = '';
          }

          if (accountInfo.result.account_data && accountInfo.result.account_data.RegularKey) {
               this.isSetRegularKey = true;
               this.regularKeyAccount = accountInfo.result.account_data.RegularKey;
               this.regularKeyAccountSeed = this.storageService.get('regularKeySeed');
          } else {
               this.isSetRegularKey = false;
               this.regularKeyAccount = '';
               this.regularKeyAccountSeed = '';
          }
     }

     clearUiIAccountMetaData() {
          this.tickSize = '';
          this.transferRate = '';
          this.domain = '';
          this.isMessageKey = false;

          this.cdr.detectChanges();
     }

     clearFields() {
          this.memoField = '';
          this.ticketSequence = '';
          this.isTicket = false;
          this.isMultiSign = false;
          this.multiSignAddress = '';
          this.isUpdateMetaData = false;
          this.cdr.detectChanges();
     }

     private async displayDataForAccount(accountKey: 'account1' | 'account2' | 'issuer') {
          const prefix = accountKey === 'issuer' ? 'issuer' : accountKey;

          let name;
          let address;
          let seed;

          // Fetch stored values
          if (prefix === 'issuer') {
               name = this.storageService.getInputValue(`${prefix}Name`) || AppConstants.EMPTY_STRING;
               address = this.storageService.getInputValue(`${prefix}Address`) || AppConstants.EMPTY_STRING;
               seed = this.storageService.getInputValue(`${prefix}Seed`) || this.storageService.getInputValue(`${prefix}Mnemonic`) || this.storageService.getInputValue(`${prefix}SecretNumbers`) || AppConstants.EMPTY_STRING;
          } else {
               name = this.storageService.getInputValue(`${prefix}name`) || AppConstants.EMPTY_STRING;
               address = this.storageService.getInputValue(`${prefix}address`) || AppConstants.EMPTY_STRING;
               seed = this.storageService.getInputValue(`${prefix}seed`) || this.storageService.getInputValue(`${prefix}mnemonic`) || this.storageService.getInputValue(`${prefix}secretNumbers`) || AppConstants.EMPTY_STRING;
          }

          // Update account data
          const account = accountKey === 'account1' ? this.account1 : accountKey === 'account2' ? this.account2 : this.issuer;
          account.name = name;
          account.address = address;
          account.seed = seed;

          // DOM manipulation
          const accountName1Field = document.getElementById('accountName1Field') as HTMLInputElement | null;
          const accountAddress1Field = document.getElementById('accountAddress1Field') as HTMLInputElement | null;
          const accountSeed1Field = document.getElementById('accountSeed1Field') as HTMLInputElement | null;

          if (accountName1Field) accountName1Field.value = name;
          if (accountAddress1Field) accountAddress1Field.value = address;
          if (accountSeed1Field) accountSeed1Field.value = seed;

          // Trigger change detection to sync with ngModel
          this.cdr.detectChanges();

          // Update destination field (set to other account's address)
          const otherPrefix = accountKey === 'account1' ? 'account2' : accountKey === 'account2' ? 'account1' : 'account1';
          // this.destinationField = this.storageService.getInputValue(`${otherPrefix}address`) || AppConstants.EMPTY_STRING;

          // Fetch account details and trustlines
          try {
               if (address && xrpl.isValidAddress(address)) {
                    await this.getAccountDetails();
               } else if (address) {
                    this.setError('Invalid XRP address');
               }
          } catch (error: any) {
               this.setError(`Error fetching account details: ${error.message}`);
          }
     }

     async displayDataForAccount1() {
          await this.displayDataForAccount('account1');
     }

     async displayDataForAccount2() {
          await this.displayDataForAccount('account2');
     }

     private async displayDataForAccount3() {
          await this.displayDataForAccount('issuer');
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
