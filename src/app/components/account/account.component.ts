import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { WalletInputComponent } from '../wallet-input/wallet-input.component';
import * as xrpl from 'xrpl';
import { StorageService } from '../../services/storage.service';
import { AccountSet, TransactionMetadataBase, DepositPreauth, SignerListSet } from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';

interface AccountFlags {
     asfRequireDest: boolean;
     asfRequireAuth: boolean;
     asfDisallowXRP: boolean;
     asfDisableMaster: boolean;
     asfNoFreeze: boolean;
     asfGlobalFreeze: boolean;
     asfDefaultRipple: boolean;
     asfDepositAuth: boolean;
     asfAllowTrustLineClawback: boolean;
     asfDisallowIncomingNFTokenOffer: boolean;
     asfDisallowIncomingCheck: boolean;
     asfDisallowIncomingPayChan: boolean;
     asfDisallowIncomingTrustline: boolean;
}

@Component({
     selector: 'app-account',
     standalone: true,
     imports: [CommonModule, FormsModule, WalletInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './account.component.html',
     styleUrls: ['./account.component.css'],
})
export class AccountComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     @ViewChild('accountForm') accountForm!: NgForm;
     selectedAccount: 'account1' | 'account2' | null = null;
     private lastResult: string = '';
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = false;
     account1 = { name: '', address: '', seed: '', balance: '' };
     account2 = { name: '', address: '', seed: '', balance: '' };
     ownerCount = '';
     totalXrpReserves = '';
     executionTime = '';
     ticketSequence: string = '';
     isTicket = false;
     isTicketEnabled = false;
     isMultiSign = false;
     multiSignAddress = '';
     isUpdateMetaData = false;
     tickSize = '';
     transferRate = '';
     isMessageKey = false;
     domain = '';
     memoField = '';
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

     onWalletInputChange(event: { account1: any; account2: any }) {
          this.account1 = { ...event.account1, balance: '0' };
          this.account2 = { ...event.account2, balance: '0' };
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
          }
     }

     toggleMultiSign() {
          this.cdr.detectChanges();
     }

     toggleTicketSequence() {
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
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed,
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
               } else {
                    wallet = await this.utilsService.getWallet(this.account2.seed, environment);
               }

               if (!wallet) {
                    this.setError('ERROR: Wallet could not be created or is undefined');
                    return;
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
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed,
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
               } else {
                    wallet = await this.utilsService.getWallet(this.account2.seed, environment);
               }

               if (!wallet) {
                    this.setError('ERROR: Wallet could not be created or is undefined');
                    return;
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
               this.setSuccess(this.result);

               const signerAccounts: string[] = this.checkForSignerAccounts(accountObjects);
               if (signerAccounts) {
                    this.multiSignAddress = signerAccounts.map(account => account + ',\n').join('');
               } else {
                    this.multiSignAddress = '';
               }

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
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed,
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
               } else {
                    wallet = await this.utilsService.getWallet(this.account2.seed, environment);
               }

               if (!wallet) {
                    this.setError('ERROR: Wallet could not be created or is undefined');
                    return;
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

               this.updateSpinnerMessage('Submitting transaction to the Ledger...');

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
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed,
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
               } else {
                    wallet = await this.utilsService.getWallet(this.account2.seed, environment);
               }

               if (!wallet) {
                    this.setError('ERROR: Wallet could not be created or is undefined');
                    return;
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
                    if (tickSize < 3 || tickSize > 15) {
                         return this.setError('ERROR: Tick size must be between 3 and 15.');
                    }
                    updatedData = true;
                    accountSetTx.TickSize = tickSize;
               }

               if (this.transferRate) {
                    const transferRate = parseFloat(this.transferRate);
                    if (transferRate > 100) {
                         return this.setError('ERROR: Transfer rate cannot be greater than 100%.');
                    }
                    updatedData = true;
                    accountSetTx.TransferRate = this.utilsService.getTransferRate(transferRate);
               }

               if (this.isMessageKey) {
                    updatedData = true;
                    accountSetTx.MessageKey = wallet.publicKey;
               }

               if (this.domain) {
                    updatedData = true;
                    accountSetTx.Domain = Buffer.from(this.domain, 'utf8').toString('hex');
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

     async setDepositAuthAccounts(authorizeFlag: 'Y' | 'N') {
          console.log('Entering setDepositAuthAccounts');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          const authorizedAddress = this.selectedAccount === 'account1' ? this.account2.address : this.account1.address;
          if (!this.utilsService.validateInput(authorizedAddress)) {
               return this.setError('ERROR: Authorized account address cannot be empty');
          }

          if (!xrpl.isValidAddress(authorizedAddress)) {
               return this.setError('ERROR: Authorized account address is invalid');
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               let wallet;
               if (this.selectedAccount === 'account1') {
                    wallet = await this.utilsService.getWallet(this.account1.seed, environment);
               } else {
                    wallet = await this.utilsService.getWallet(this.account2.seed, environment);
               }

               if (!wallet) {
                    this.setError('ERROR: Wallet could not be created or is undefined');
                    return;
               }

               this.updateSpinnerMessage('Setting Deposit Auth...');

               let accountInfo;
               try {
                    accountInfo = await this.xrplService.getAccountInfo(client, authorizedAddress, 'validated', '');
               } catch (error: any) {
                    if (error.data?.error === 'actNotFound') {
                         return this.setError('ERROR: Authorized account does not exist (tecNO_TARGET)');
                    }
                    throw error;
               }

               console.debug(`accountInfo ${JSON.stringify(accountInfo, null, 2)}`);

               if (!accountInfo.result.account_flags?.depositAuth) {
                    return this.setError('ERROR: Account must have asfDepositAuth flag enabled');
               }

               const accountObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'deposit_preauth');
               console.debug(`accountObjects ${JSON.stringify(accountObjects, null, 2)}`);

               const alreadyAuthorized = accountObjects.result.account_objects.some((obj: any) => obj.Authorize === authorizedAddress);
               if (authorizeFlag === 'Y' && alreadyAuthorized) {
                    return this.setError('ERROR: Preauthorization already exists (tecDUPLICATE). Use Unauthorize to remove');
               }

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

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

               if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, depositPreauthTx, fee)) {
                    return this.setError('ERROR: Insufficent XRP to complete transaction');
               }

               this.updateSpinnerMessage('Submitting transaction to the Ledger...');

               const response = await client.submitAndWait(depositPreauthTx, { wallet });
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
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed,
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
               } else {
                    wallet = await this.utilsService.getWallet(this.account2.seed, environment);
               }

               if (!wallet) {
                    this.setError('ERROR: Wallet could not be created or is undefined');
                    return;
               }

               this.updateSpinnerMessage('Setting Multi Sign...');

               const fee = await this.xrplService.calculateTransactionFee(client);

               let signerListTx: SignerListSet;
               if (enableMultiSignFlag === 'Y') {
                    const addressesArray = this.multiSignAddress
                         .split(',')
                         .map(address => address.trim())
                         .filter(addr => addr !== '');

                    // Validate: At least one address
                    if (!addressesArray.length) {
                         return this.setError('ERROR: Multi-sign address list is empty');
                    }

                    const selfAddress = wallet.classicAddress;
                    if (addressesArray.includes(selfAddress)) {
                         return this.setError('ERROR: Your own account cannot be in the signer list');
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

                    if (invalidAddresses.length > 8) {
                         return this.setError(`ERROR: XRPL allows max 8 signer entries. You entered ${invalidAddresses.length}`);
                    }

                    const SignerEntries = addressesArray.map(address => ({
                         SignerEntry: {
                              Account: address,
                              SignerWeight: 1,
                         },
                    }));

                    const SignerQuorum = Math.ceil(SignerEntries.length / 2);
                    if (SignerQuorum > SignerEntries.length) {
                         return this.setError(`ERROR: Quorum (${SignerQuorum}) > total signers (${SignerEntries.length})`);
                    }

                    const currentLedger = await this.xrplService.getLastLedgerIndex(client);

                    if (this.ticketSequence) {
                         if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                              return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                         }

                         signerListTx = await client.autofill({
                              TransactionType: 'SignerListSet',
                              Account: wallet.classicAddress,
                              SignerQuorum,
                              SignerEntries,
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
                              SignerEntries,
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
                    const currentLedger = await this.xrplService.getLastLedgerIndex(client);

                    if (this.ticketSequence) {
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

          const tx = {
               TransactionType: 'AccountSet',
               Account: wallet.classicAddress,
               ...flagPayload,
          };

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
                                   signerAccounts.push(entry.SignerEntry.Account);
                              }
                         });
                    }
               });
          }
          return signerAccounts;
     }

     private async updateXrpBalance(client: xrpl.Client, wallet: xrpl.Wallet) {
          const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, wallet.classicAddress);
          this.ownerCount = ownerCount;
          this.totalXrpReserves = totalXrpReserves;
          const balance = (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0');
          if (this.selectedAccount === 'account1') {
               this.account1.balance = balance.toString();
          } else {
               this.account2.balance = balance.toString();
          }
     }

     private validateInputs(inputs: { seed?: string; amount?: string; destination?: string; sequence?: string; selectedAccount?: 'account1' | 'account2' | null }): string | null {
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
          return null;
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
                    domainField.value = this.utilsService.decodeHex(accountInfo.account_data.Domain);
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

     clearUiIAccountMetaData() {
          const tickSizeField = document.getElementById('tickSizeField') as HTMLInputElement | null;
          if (tickSizeField) {
               tickSizeField.value = '';
          }

          const transferRateField = document.getElementById('transferRateField') as HTMLInputElement | null;
          if (transferRateField) {
               transferRateField.value = '';
          }

          const domainField = document.getElementById('domainField') as HTMLInputElement | null;
          if (domainField) {
               domainField.value = '';
          }

          const isMessageKeyField = document.getElementById('isMessageKey') as HTMLInputElement;
          if (isMessageKeyField) {
               isMessageKeyField.checked = false;
          }
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

     async displayDataForAccount(accountKey: 'account1' | 'account2') {
          const prefix = accountKey; // 'account1' or 'account2'

          // Fetch stored values
          const name = this.storageService.getInputValue(`${prefix}name`) || '';
          const address = this.storageService.getInputValue(`${prefix}address`) || '';
          const seed = this.storageService.getInputValue(`${prefix}seed`) || this.storageService.getInputValue(`${prefix}mnemonic`) || this.storageService.getInputValue(`${prefix}secretNumbers`) || '';

          // Update account data
          const account = accountKey === 'account1' ? this.account1 : this.account2;
          account.name = name;
          account.address = address;
          account.seed = seed;

          // Trigger change detection to update UI
          this.cdr.detectChanges();

          // Validate and fetch account details
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
