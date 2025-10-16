import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import * as xrpl from 'xrpl';
import { StorageService } from '../../services/storage.service';
import { AccountSet, DepositPreauth, SignerListSet } from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';
import { AppWalletDynamicInputComponent } from '../app-wallet-dynamic-input/app-wallet-dynamic-input.component';

interface ValidationInputs {
     selectedAccount?: string;
     senderAddress?: string;
     seed?: string;
     account_info?: any;
     setFlags?: any;
     clearFlags?: any;
     destination?: string;
     amount?: string;
     flags?: any;
     depositAuthAddress?: string;
     nfTokenMinterAddress?: string;
     tickSize?: string;
     transferRate?: string;
     domain?: string;
     isRegularKeyAddress?: boolean;
     regularKeyAddress?: string;
     regularKeyAccount?: string;
     regularKeyAccountSeeds?: string;
     regularKeySeed?: string;
     isMultiSign?: boolean;
     useMultiSign?: boolean;
     multiSignSeeds?: string;
     multiSignAddresses?: string;
     isTicket?: boolean;
     ticketSequence?: string;
     selectedSingleTicket?: string;

     signerQuorum?: number;
     signers?: { account: string; seed: string; weight: number }[];
}

interface SignerEntry {
     Account: string;
     SignerWeight: number;
     SingnerSeed: string;
}

interface SignerEntry {
     account: string;
     seed: string;
     weight: number;
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
     asfAllowTrustLineClawback: boolean;
     asfDisallowIncomingNFTokenOffer: boolean;
     asfDisallowIncomingCheck: boolean;
     asfDisallowIncomingPayChan: boolean;
     asfDisallowIncomingTrustline: boolean;
     asfAllowTrustLineLocking: boolean;
}

@Component({
     selector: 'app-account-configurator',
     standalone: true,
     imports: [CommonModule, FormsModule, AppWalletDynamicInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './account-configurator.component.html',
     styleUrl: './account-configurator.component.css',
})
export class AccountConfiguratorComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     @ViewChild('accountForm') accountForm!: NgForm;
     configurationType: 'holder' | 'exchanger' | 'issuer' | null = null;
     private lastResult: string = '';
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = false;
     ticketArray: string[] = [];
     selectedTickets: string[] = []; // For multiple selection
     selectedSingleTicket: string = ''; // For single selection
     multiSelectMode: boolean = false; // Toggle between modes
     selectedTicket: string = ''; // The currently selected ticket
     ownerCount: string = '';
     totalXrpReserves: string = '';
     executionTime: string = '';
     ticketSequence: string = '';
     isTicket: boolean = false;
     isTicketEnabled: boolean = false;
     isMemoEnabled: boolean = false;
     isMultiSign: boolean = false;
     useMultiSign: boolean = false;
     multiSignAddress: string = '';
     isSetRegularKey: boolean = false;
     regularKeyAccount: string = '';
     regularKeyAccountSeed: string = '';
     signerQuorum: number = 0;
     multiSignSeeds: string = '';
     multiSigningEnabled: boolean = false;
     depositAuthEnabled: boolean = false;
     isNFTokenMinterEnabled: boolean = false;
     regularKeySigningEnabled: boolean = false;
     nfTokenMinterAddress: string = '';
     isUpdateMetaData: boolean = false;
     isHolderConfiguration: boolean = false;
     isExchangerConfiguration: boolean = false;
     isIssuerConfiguration: boolean = false;
     isdepositAuthAddress: boolean = false;
     isAuthorizedNFTokenMinter: boolean = false;
     depositAuthAddress: string = '';
     tickSize: string = '';
     transferRate: string = '';
     isMessageKey: boolean = false;
     domain: string = '';
     memoField: string = '';
     avatarUrl: string = '';
     masterKeyDisabled: boolean = false;
     isSimulateEnabled: boolean = false;
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
          asfAllowTrustLineLocking: false,
     };
     spinner: boolean = false;
     signers: { account: string; seed: string; weight: number }[] = [{ account: '', seed: '', weight: 1 }];
     wallets: any[] = [];
     selectedWalletIndex: number = 0;
     currentWallet = { name: '', address: '', seed: '', balance: '', isIssuer: false };

     constructor(private readonly xrplService: XrplService, private readonly utilsService: UtilsService, private readonly cdr: ChangeDetectorRef, private readonly storageService: StorageService, private readonly renderUiComponentsService: RenderUiComponentsService, private readonly xrplTransactions: XrplTransactionService) {}

     ngOnInit() {}

     ngAfterViewInit() {}

     ngAfterViewChecked() {
          if (this.result !== this.lastResult && this.resultField?.nativeElement) {
               this.renderUiComponentsService.attachSearchListener(this.resultField.nativeElement);
               this.lastResult = this.result;
               this.cdr.detectChanges();
          }
     }

     onWalletListChange(event: any[]) {
          this.wallets = event;
          if (this.wallets.length > 0 && this.selectedWalletIndex >= this.wallets.length) {
               this.selectedWalletIndex = 0;
          }
          this.onAccountChange();
     }

     handleTransactionResult(event: { result: string; isError: boolean; isSuccess: boolean }) {
          this.result = event.result;
          this.isError = event.isError;
          this.isSuccess = event.isSuccess;
          this.isEditable = !this.isSuccess;
          this.cdr.detectChanges();
     }

     async onAccountChange() {
          if (this.wallets.length === 0) return;

          this.currentWallet = {
               ...this.wallets[this.selectedWalletIndex],
               balance: this.currentWallet.balance || '0',
          };

          if (this.currentWallet.address && xrpl.isValidAddress(this.currentWallet.address)) {
               await this.getAccountDetails();
          } else if (this.currentWallet.address) {
               this.setError('Invalid XRP address');
          }
     }

     validateQuorum() {
          const totalWeight = this.signers.reduce((sum, s) => sum + (s.weight || 0), 0);
          if (this.signerQuorum > totalWeight) {
               this.signerQuorum = totalWeight;
          }
          this.cdr.detectChanges();
     }

     async toggleMultiSign() {
          try {
               if (!this.isMultiSign) {
                    this.utilsService.clearSignerList(this.signers);
               } else {
                    const wallet = await this.getWallet();
                    this.loadSignerList(wallet.classicAddress);
               }
          } catch (error: any) {
               console.log(`ERROR getting wallet in toggleMultiSign' ${error.message}`);
               this.setError('ERROR getting wallet in toggleMultiSign');
          } finally {
               this.cdr.detectChanges();
          }
     }

     async toggleUseMultiSign() {
          if (this.multiSignAddress === 'No Multi-Sign address configured for account') {
               this.multiSignSeeds = '';
          }
          this.cdr.detectChanges();
     }

     onConfigurationChange() {
          this.resetFlags();

          const type = this.configurationType || '';
          const configActions: Record<string, () => void> = {
               holder: () => this.setHolder(),
               exchanger: () => this.setExchanger(),
               issuer: () => this.setIssuer(),
          };

          configActions[type]?.();

          console.log('Configuration changed to:', this.configurationType);
          this.cdr.detectChanges();
     }

     private resetFlags() {
          Object.keys(this.flags).forEach(key => (this.flags[key as keyof AccountFlags] = false));

          ['domainField', 'transferRateField', 'tickSizeField'].forEach(id => {
               const elem = document.getElementById(id) as HTMLInputElement | null;
               if (elem) elem.value = '';
          });
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
          this.flags.asfAllowTrustLineClawback = false;
          this.flags.asfDisallowIncomingNFTokenOffer = false;
          this.flags.asfDisallowIncomingCheck = false;
          this.flags.asfDisallowIncomingPayChan = false;
          this.flags.asfDisallowIncomingTrustline = false;
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
          this.flags.asfAllowTrustLineClawback = false;
          this.flags.asfDisallowIncomingNFTokenOffer = true;
          this.flags.asfDisallowIncomingCheck = false;
          this.flags.asfDisallowIncomingPayChan = true;
          this.flags.asfDisallowIncomingTrustline = false;
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
          this.flags.asfDepositAuth = false;
          this.flags.asfAllowTrustLineClawback = true;
          this.flags.asfDisallowIncomingNFTokenOffer = true;
          this.flags.asfDisallowIncomingCheck = true;
          this.flags.asfDisallowIncomingPayChan = true;
          this.flags.asfDisallowIncomingTrustline = false;
     }

     toggleConfigurationTemplate() {
          this.cdr.detectChanges();
     }

     addSigner() {
          this.signers.push({ account: '', seed: '', weight: 1 });
     }

     removeSigner(index: number) {
          this.signers.splice(index, 1);
     }

     toggleTicketSequence() {
          this.cdr.detectChanges();
     }

     onAuthorizedNFTokenMinter() {
          this.cdr.detectChanges();
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

     async getAccountDetails() {
          console.log('Entering getAccountDetails');
          const startTime = Date.now();
          this.setSuccessProperties();
          this.configurationType = null;

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }
               this.updateSpinnerMessage(`Getting Account Details`);

               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const [accountInfo, accountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);

               // Optional: Avoid heavy stringify — log only if needed
               console.debug(`account info:`, accountInfo.result);
               console.debug(`account objects:`, accountObjects.result);

               const inputs: ValidationInputs = {
                    seed: this.currentWallet.seed,
                    account_info: accountInfo,
               };

               const errors = await this.validateInputs(inputs, 'getAccountDetails');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               AppConstants.FLAGS.forEach(flag => {
                    const input = document.getElementById(flag.name) as HTMLInputElement;
                    const flagKey = AppConstants.FLAGMAP[flag.name as keyof typeof AppConstants.FLAGMAP];
                    if (input && flagKey) {
                         input.checked = !!accountInfo.result.account_flags?.[flagKey as keyof typeof accountInfo.result.account_flags];
                    }
               });

               // Render immediately
               const sortedResult = this.utilsService.sortByLedgerEntryType(accountObjects);
               this.renderUiComponentsService.renderAccountDetails(accountInfo, sortedResult);
               this.setSuccess(this.result);

               // DEFER: Non-critical UI updates — let main render complete first
               setTimeout(async () => {
                    try {
                         this.refreshUIData(wallet, accountInfo, accountObjects);
                         this.loadSignerList(wallet.classicAddress);
                         this.clearFields(false);
                         this.updateTickets(accountObjects);
                         await this.updateXrpBalance(client, accountInfo, wallet);
                    } catch (err) {
                         console.error('Error in deferred UI updates:', err);
                    }
               }, 0);
          } catch (error: any) {
               console.error('Error in getAccountDetails:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
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

          const inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
               isRegularKeyAddress: this.isSetRegularKey,
               isMultiSign: this.useMultiSign,
               regularKeyAddress: this.regularKeyAccount ? this.regularKeyAccount : undefined,
               regularKeySeed: this.regularKeyAccountSeed ? this.regularKeyAccountSeed : undefined,
               multiSignAddresses: this.useMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.useMultiSign ? this.multiSignSeeds : undefined,
               isTicket: this.isTicket,
               selectedSingleTicket: this.isTicket ? this.selectedSingleTicket : undefined,
               signers: this.signers ? this.signers : undefined,
               signerQuorum: this.signerQuorum ? this.signerQuorum : undefined,
          };

          this.clearUiIAccountMetaData();

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Updating Account Flags (${mode})...`);

               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const [accountInfo, accountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);

               // Optional: Avoid heavy stringify — log only if needed
               console.debug(`accountInfo :`, accountInfo.result);
               console.debug(`accountObjects :`, accountObjects.result);

               const { setFlags, clearFlags } = this.utilsService.getFlagUpdates(accountInfo.result.account_flags);

               inputs.account_info = accountInfo;
               inputs.flags = accountInfo.result.account_flags;
               inputs.setFlags = setFlags;
               inputs.clearFlags = clearFlags;

               const errors = await this.validateInputs(inputs, 'updateFlags');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               const transactions = [];
               let hasError = false;
               let response;

               for (const flagValue of setFlags) {
                    response = await this.submitFlagTransaction(client, wallet, { SetFlag: parseInt(flagValue) }, this.memoField);
                    if (!this.isValidResponse(response)) {
                         this.setError('ERROR: Invalid response from submitFlagTransaction');
                         continue;
                    }
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
                    response = await this.submitFlagTransaction(client, wallet, { ClearFlag: parseInt(flagValue) }, this.memoField);
                    if (!this.isValidResponse(response)) {
                         this.setError('ERROR: Invalid response from submitFlagTransaction');
                         continue;
                    }
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

               if (this.configurationType === 'issuer') {
                    this.currentWallet.isIssuer = true;
               }

               console.log(`transactions:`, transactions);

               this.renderUiComponentsService.renderTransactionsResults(transactions, this.resultField.nativeElement);
               this.setSuccess(this.result);
               this.resultField.nativeElement.classList.add('success');

               if (!this.isSimulateEnabled) {
                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    // DEFER: Non-critical UI updates — let main render complete first
                    setTimeout(async () => {
                         try {
                              this.loadSignerList(wallet.classicAddress);
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              await this.updateXrpBalance(client, updatedAccountInfo, wallet);
                         } catch (err) {
                              console.error('Error in deferred UI updates:', err);
                         }
                    }, 0);
               }
          } catch (error: any) {
               console.error('Error in updateFlags:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving updateFlags in ${this.executionTime}ms`);
          }
     }

     async toggleMetaData() {
          console.log('Entering toggleMetaData');
          const startTime = Date.now();
          this.setSuccessProperties();

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();
               const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');

               const inputs: ValidationInputs = {
                    selectedAccount: this.currentWallet.address,
                    seed: this.currentWallet.seed,
                    account_info: accountInfo,
               };

               const errors = await this.validateInputs(inputs, 'toggleMetaData');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }
               console.debug(`accountInfo for`, accountInfo.result);

               this.refreshUiIAccountMetaData(accountInfo.result);
          } catch (error: any) {
               console.error('Error in toggleMetaData:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving toggleMetaData in ${this.executionTime}ms`);
          }
     }

     async updateMetaData() {
          console.log('Entering updateMetaData');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
               tickSize: this.tickSize,
               transferRate: this.transferRate,
               domain: this.domain,
               isRegularKeyAddress: this.isSetRegularKey,
               isMultiSign: this.useMultiSign,
               regularKeyAddress: this.regularKeyAccount ? this.regularKeyAccount : undefined,
               regularKeySeed: this.regularKeyAccountSeed ? this.regularKeyAccountSeed : undefined,
               multiSignAddresses: this.useMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.useMultiSign ? this.multiSignSeeds : undefined,
               isTicket: this.isTicket,
               selectedSingleTicket: this.isTicket ? this.selectedSingleTicket : undefined,
               signers: this.signers ? this.signers : undefined,
               signerQuorum: this.signerQuorum ? this.signerQuorum : undefined,
          };

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const [accountInfo, accountObjects, fee, currentLedger, serverInfo] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), this.xrplService.getXrplServerInfo(client, 'current', '')]);

               // Optional: Avoid heavy stringify — log only if needed
               console.debug(`accountInfo`, accountInfo.result);
               console.debug(`accountObjects:`, accountObjects.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);
               console.debug(`serverInfo :`, serverInfo);

               inputs.account_info = accountInfo;

               const errors = await this.validateInputs(inputs, 'updateMetaData');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               const accountSetTx: AccountSet = await client.autofill({
                    TransactionType: 'AccountSet',
                    Account: wallet.classicAddress,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               });

               await this.setTxOptionalFields(client, accountSetTx, wallet, accountInfo);

               const updates: (() => void)[] = [];

               if (this.tickSize) {
                    updates.push(() => this.utilsService.setTickSize(accountSetTx, parseInt(this.tickSize)));
               }

               if (this.transferRate) {
                    updates.push(() => this.utilsService.setTransferRate(accountSetTx, parseFloat(this.transferRate)));
               }

               if (this.isMessageKey && wallet.publicKey) {
                    updates.push(() => this.utilsService.setMessageKey(accountSetTx, wallet.publicKey));
               }

               if (this.domain && this.domain.trim() !== '') {
                    updates.push(() => this.utilsService.setDomain(accountSetTx, this.domain));
               }

               if (updates.length === 0) {
                    this.resultField.nativeElement.innerHTML = `No fields have data to update.\n`;
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               updates.forEach(update => update());

               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, accountSetTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Updating Meta Data (no changes will be made)...' : 'Submitting to Ledger...');

               let response: any;

               if (this.isSimulateEnabled) {
                    response = await this.xrplTransactions.simulateTransaction(client, accountSetTx);
               } else {
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isSetRegularKey, this.regularKeyAccountSeed);

                    const signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, accountSetTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

                    response = await this.xrplTransactions.submitTransaction(client, signedTx);
               }

               const isSuccess = this.utilsService.isTxSuccessful(response);
               if (!isSuccess) {
                    const resultMsg = this.utilsService.getTransactionResultMessage(response);
                    const userMessage = 'Transaction failed.\n' + this.utilsService.processErrorMessageFromLedger(resultMsg);

                    console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                    (response.result as any).errorMessage = userMessage;
               }

               // Render result
               this.renderTransactionResult(response);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               this.isUpdateMetaData = true;

               if (!this.isSimulateEnabled) {
                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              this.loadSignerList(wallet.classicAddress);
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              await this.updateXrpBalance(client, updatedAccountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
          } catch (error: any) {
               console.error('Error in updateMetaData:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
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

          const inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
               depositAuthAddress: this.depositAuthAddress,
               isRegularKeyAddress: this.isSetRegularKey,
               isMultiSign: this.useMultiSign,
               regularKeyAddress: this.regularKeyAccount ? this.regularKeyAccount : undefined,
               regularKeySeed: this.regularKeyAccountSeed ? this.regularKeyAccountSeed : undefined,
               multiSignAddresses: this.useMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.useMultiSign ? this.multiSignSeeds : undefined,
               isTicket: this.isTicket,
               selectedSingleTicket: this.isTicket ? this.selectedSingleTicket : undefined,
               signers: this.signers ? this.signers : undefined,
               signerQuorum: this.signerQuorum ? this.signerQuorum : undefined,
          };

          // Split and validate deposit auth addresses
          const addressesArray = this.utilsService.getUserEnteredAddress(this.depositAuthAddress);
          if (!addressesArray.length) {
               return this.setError('ERROR: Deposit Auth address list is empty');
          }

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Deposit Auth Set (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const [accountInfo, accountObjects, fee, currentLedger, serverInfo] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'deposit_preauth'), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), this.xrplService.getXrplServerInfo(client, 'current', '')]);

               // Optional: Avoid heavy stringify — log only if needed
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`accountObjects for ${wallet.classicAddress}:`, accountObjects.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);
               console.debug(`serverInfo :`, serverInfo);

               inputs.account_info = accountInfo;

               const errors = await this.validateInputs(inputs, 'setDepositAuthAccounts');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               // Validate each address
               for (const authorizedAddress of addressesArray) {
                    // Check for existing preauthorization
                    const alreadyAuthorized = accountObjects.result.account_objects.some((obj: any) => obj.Authorize === authorizedAddress);
                    if (authorizeFlag === 'Y' && alreadyAuthorized) {
                         return this.setError(`ERROR: Preauthorization already exists for ${authorizedAddress} (tecDUPLICATE). Use Unauthorize to remove`);
                    }
                    if (authorizeFlag === 'N' && !alreadyAuthorized) {
                         return this.setError(`ERROR: No preauthorization exists for ${authorizedAddress} to unauthorize`);
                    }
               }

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
                         this.utilsService.setMemoField(depositPreauthTx, this.memoField);
                    }

                    this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Setting Deposit Auth (no changes will be made)...' : 'Submitting to Ledger...');

                    let response: any;

                    if (this.isSimulateEnabled) {
                         response = await this.xrplTransactions.simulateTransaction(client, depositPreauthTx);

                         const isSuccess = this.utilsService.isTxSuccessful(response);
                         if (!isSuccess) {
                              const resultMsg = this.utilsService.getTransactionResultMessage(response);
                              const userMessage = 'Transaction failed.\n' + this.utilsService.processErrorMessageFromLedger(resultMsg);

                              console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                              (response.result as any).errorMessage = userMessage;
                         }

                         console.log('Submit Response:', JSON.stringify(response, null, '\t'));
                         const result = response.result;
                         results.push({ result });
                    } else {
                         const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isSetRegularKey, this.regularKeyAccountSeed);

                         const signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, depositPreauthTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                         if (!signedTx) {
                              return this.setError('ERROR: Failed to sign Payment transaction.');
                         }

                         response = await this.xrplTransactions.submitTransaction(client, signedTx);

                         const isSuccess = this.utilsService.isTxSuccessful(response);
                         if (!isSuccess) {
                              const resultMsg = this.utilsService.getTransactionResultMessage(response);
                              const userMessage = 'Transaction failed.\n' + this.utilsService.processErrorMessageFromLedger(resultMsg);

                              console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                              (response.result as any).errorMessage = userMessage;
                         }

                         const result = response.result;
                         results.push({ result });
                    }
               }

               this.renderTransactionResult(results);

               if (!this.isSimulateEnabled) {
                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              await this.updateXrpBalance(client, updatedAccountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
          } catch (error: any) {
               console.error('Error in setDepositAuthAccounts:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
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

          const inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
               isRegularKeyAddress: this.isSetRegularKey,
               isMultiSign: this.isMultiSign,
               regularKeyAddress: this.regularKeyAccount || undefined,
               regularKeySeed: this.regularKeyAccountSeed || undefined,
               multiSignAddresses: this.isMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.isMultiSign ? this.multiSignSeeds : undefined,
               isTicket: this.isTicket,
               selectedSingleTicket: this.isTicket ? this.selectedSingleTicket : undefined,
               signers: this.signers || undefined,
               signerQuorum: this.signerQuorum || undefined,
          };

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Multi Sign (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const [accountInfo, fee, currentLedger, serverInfo] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), this.xrplService.getXrplServerInfo(client, 'current', '')]);

               // Optional: Avoid heavy stringify — log only if needed
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);
               console.debug(`serverInfo :`, serverInfo);

               inputs.account_info = accountInfo;

               const errors = await this.validateInputs(inputs, 'setMultiSign');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               // Create array of signer accounts and their weights
               let signerEntries = this.createSignerEntries();

               // Format SignerEntries for XRPL transaction
               const formattedSignerEntries = this.formatSignerEntries(signerEntries);

               // Shared base tx
               const signerListTx: SignerListSet = {
                    TransactionType: 'SignerListSet',
                    Account: wallet.classicAddress,
                    SignerQuorum: 0,
                    Fee: fee,
               };

               await this.setTxOptionalFields(client, signerListTx, wallet, accountInfo);

               signerListTx.LastLedgerSequence = currentLedger + AppConstants.LAST_LEDGER_ADD_TIME;

               console.debug(`enableMultiSignFlag:`, enableMultiSignFlag);
               if (enableMultiSignFlag === 'Y') {
                    signerListTx.SignerEntries = formattedSignerEntries;
                    signerListTx.SignerQuorum = Number(this.signerQuorum);
               }

               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, signerListTx, fee)) {
                    return this.setError('ERROR: Insufficent XRP to complete transaction');
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Setting Multi Sign (no changes will be made)...' : 'Submitting to Ledger...');

               let response: any;

               if (this.isSimulateEnabled) {
                    response = await this.xrplTransactions.simulateTransaction(client, signerListTx);
               } else {
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isSetRegularKey, this.regularKeyAccountSeed);

                    const signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, signerListTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

                    response = await this.xrplTransactions.submitTransaction(client, signedTx);
               }

               const isSuccess = this.utilsService.isTxSuccessful(response);
               if (!isSuccess) {
                    const resultMsg = this.utilsService.getTransactionResultMessage(response);
                    const userMessage = 'Transaction failed.\n' + this.utilsService.processErrorMessageFromLedger(resultMsg);

                    console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                    (response.result as any).errorMessage = userMessage;
               }

               this.renderTransactionResult(response);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               if (!this.isSimulateEnabled) {
                    if (enableMultiSignFlag === 'Y') {
                         this.storageService.set(wallet.classicAddress + 'signerEntries', signerEntries);
                    } else {
                         this.storageService.removeValue('signerEntries');
                         this.signerQuorum = 0;
                    }

                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              await this.updateXrpBalance(client, updatedAccountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
          } catch (error: any) {
               console.error('Error in setMultiSign:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
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

          const inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
               isRegularKeyAddress: this.isSetRegularKey,
               isMultiSign: this.useMultiSign,
               regularKeyAddress: this.regularKeyAccount ? this.regularKeyAccount : undefined,
               regularKeySeed: this.regularKeyAccountSeed ? this.regularKeyAccountSeed : undefined,
               multiSignAddresses: this.useMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.useMultiSign ? this.multiSignSeeds : undefined,
               isTicket: this.isTicket,
               selectedSingleTicket: this.isTicket ? this.selectedSingleTicket : undefined,
               signers: this.signers ? this.signers : undefined,
               signerQuorum: this.signerQuorum ? this.signerQuorum : undefined,
          };

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Regular Key (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const [accountInfo, fee, currentLedger, serverInfo] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), this.xrplService.getXrplServerInfo(client, 'current', '')]);

               // Optional: Avoid heavy stringify — log only if needed
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);
               console.debug(`serverInfo :`, serverInfo);

               inputs.account_info = accountInfo;

               const errors = await this.validateInputs(inputs, 'setRegularKey');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               if (this.regularKeyAccount === '' || this.regularKeyAccount === 'No RegularKey configured for account' || this.regularKeyAccountSeed === '') {
                    return this.setError(`ERROR: Regular Key address and seed must be present`);
               }

               let setRegularKeyTx: xrpl.SetRegularKey = {
                    TransactionType: 'SetRegularKey',
                    Account: wallet.classicAddress,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               if (enableRegularKeyFlag === 'Y') {
                    setRegularKeyTx.RegularKey = this.regularKeyAccount;
               }

               await this.setTxOptionalFields(client, setRegularKeyTx, wallet, accountInfo);

               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, setRegularKeyTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Setting Regular Key (no changes will be made)...' : 'Submitting to Ledger...');

               let response: any;

               if (this.isSimulateEnabled) {
                    response = await this.xrplTransactions.simulateTransaction(client, setRegularKeyTx);
               } else {
                    const signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, setRegularKeyTx, false, '', fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

                    response = await this.xrplTransactions.submitTransaction(client, signedTx);
               }

               const isSuccess = this.utilsService.isTxSuccessful(response);
               if (!isSuccess) {
                    const resultMsg = this.utilsService.getTransactionResultMessage(response);
                    const userMessage = 'Transaction failed.\n' + this.utilsService.processErrorMessageFromLedger(resultMsg);

                    console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                    (response.result as any).errorMessage = userMessage;
               }

               this.renderTransactionResult(response);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               if (!this.isSimulateEnabled) {
                    const regularKeysAccount = wallet.classicAddress + 'regularKey';
                    const regularKeySeedAccount = wallet.classicAddress + 'regularKeySeed';
                    if (enableRegularKeyFlag === 'Y') {
                         this.storageService.set(regularKeysAccount, this.regularKeyAccount);
                         this.storageService.set(regularKeySeedAccount, this.regularKeyAccountSeed);
                    } else {
                         this.storageService.removeValue(regularKeysAccount);
                         this.storageService.removeValue(regularKeySeedAccount);
                    }

                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              this.loadSignerList(wallet.classicAddress);
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              await this.updateXrpBalance(client, updatedAccountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
          } catch (error: any) {
               console.error('Error in setRegularKey:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving setRegularKey in ${this.executionTime}ms`);
          }
     }

     async setNftMinterAddress(enableNftMinter: 'Y' | 'N') {
          console.log('Entering setNftMinterAddress');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
               nfTokenMinterAddress: this.nfTokenMinterAddress,
               isRegularKeyAddress: this.isSetRegularKey,
               isMultiSign: this.useMultiSign,
               regularKeyAddress: this.regularKeyAccount || undefined,
               regularKeySeed: this.regularKeyAccountSeed || undefined,
               multiSignAddresses: this.useMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.useMultiSign ? this.multiSignSeeds : undefined,
               isTicket: this.isTicket,
               selectedSingleTicket: this.isTicket ? this.selectedSingleTicket : undefined,
               signers: this.signers || undefined,
               signerQuorum: this.signerQuorum || undefined,
          };

          // Split and validate NFT minter addresses
          const addressesArray = this.utilsService.getUserEnteredAddress(this.nfTokenMinterAddress);
          if (!addressesArray.length) {
               return this.setError('ERROR: NFT Minter address list is empty');
          }

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing NFT Minter ${mode}...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const [accountInfo, fee, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), this.xrplService.getXrplServerInfo(client, 'current', '')]);

               // Optional: Avoid heavy stringify — log only if needed
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);

               inputs.account_info = accountInfo;

               const errors = await this.validateInputs(inputs, 'setNftMinterAddress');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               // Validate ALL addresses in PARALLEL (fail fast)
               try {
                    await Promise.all(addressesArray.map((address: any) => this.xrplService.getAccountInfo(client, address, 'validated', '')));
               } catch (error: any) {
                    if (error.data?.error === 'actNotFound') {
                         const missingAddress = addressesArray.find((addr: any) => error.data?.error_message?.includes(addr)) || addressesArray[0];
                         return this.setError(`ERROR: Account ${missingAddress} does not exist (tecNO_TARGET)`);
                    }
                    throw error;
               }

               // Process each address
               const results: any[] = [];

               for (const authorizedAddress of addressesArray) {
                    // Build base transaction
                    const accountSetTx: xrpl.AccountSet = await client.autofill({
                         TransactionType: 'AccountSet',
                         Account: wallet.classicAddress,
                         NFTokenMinter: enableNftMinter === 'Y' ? authorizedAddress : '',
                         Fee: fee,
                         LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                    });

                    // Optional fields
                    if (this.memoField) {
                         this.utilsService.setMemoField(accountSetTx, this.memoField);
                    }

                    // Update spinner message
                    const action = enableNftMinter === 'Y' ? 'setting' : 'clearing';
                    this.updateSpinnerMessage(this.isSimulateEnabled ? `Simulating ${action} NFT Minter for ${authorizedAddress}...` : `Submitting ${action} NFT Minter for ${authorizedAddress}...`);

                    let response: any;

                    if (this.isSimulateEnabled) {
                         response = await this.xrplTransactions.simulateTransaction(client, accountSetTx);

                         const isSuccess = this.utilsService.isTxSuccessful(response);
                         if (!isSuccess) {
                              const resultMsg = this.utilsService.getTransactionResultMessage(response);
                              const userMessage = 'Transaction failed.\n' + this.utilsService.processErrorMessageFromLedger(resultMsg);

                              console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                              (response.result as any).errorMessage = userMessage;
                         }

                         console.log('Submit Response:', JSON.stringify(response, null, '\t'));
                         const result = response.result;
                         results.push({ result });
                    } else {
                         const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isSetRegularKey, this.regularKeyAccountSeed);

                         const signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, accountSetTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                         if (!signedTx) {
                              return this.setError('ERROR: Failed to sign Payment transaction.');
                         }

                         response = await this.xrplTransactions.submitTransaction(client, signedTx);

                         const isSuccess = this.utilsService.isTxSuccessful(response);
                         if (!isSuccess) {
                              const resultMsg = this.utilsService.getTransactionResultMessage(response);
                              const userMessage = 'Transaction failed.\n' + this.utilsService.processErrorMessageFromLedger(resultMsg);

                              console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                              (response.result as any).errorMessage = userMessage;
                         }

                         const result = response.result;
                         results.push({ result });
                    }
               }

               this.renderTransactionResult(results);

               if (!this.isSimulateEnabled) {
                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              await this.updateXrpBalance(client, updatedAccountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
          } catch (error: any) {
               console.error('Error in setNftMinterAddress:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving setNftMinterAddress in ${this.executionTime}ms`);
          }
     }

     private async submitFlagTransaction1(client: xrpl.Client, wallet: xrpl.Wallet, flagPayload: any, memoField: any, fee: string, currentLedger: number, accountInfo: any, useRegularKeyWalletSignTx: boolean, regularKeyWalletSignTx: any) {
          console.log('Entering submitFlagTransaction');
          const startTime = Date.now();

          try {
               const environment = this.xrplService.getNet().environment;

               // Get flag label for UI
               const flagKey = flagPayload.SetFlag ? 'SetFlag' : 'ClearFlag';
               const flagValue = flagPayload[flagKey];
               const flagToUpdate = Array.from(AppConstants.FLAGS.values()).find((flag: any) => flag.value === flagValue);
               const flagLabel = flagToUpdate ? flagToUpdate.label : 'Flag';

               this.updateSpinnerMessage(`Submitting ${flagLabel} (${flagKey === 'SetFlag' ? 'set' : 'clear'})...`);

               // Prepare transaction
               const tx: any = {
                    TransactionType: 'AccountSet',
                    Account: wallet.classicAddress,
                    ...flagPayload,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               // Handle Ticket Sequence
               if (this.ticketSequence) {
                    const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence));
                    if (!ticketExists) {
                         return { success: false, message: `ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}` };
                    }
                    this.utilsService.setTicketSequence(tx, this.ticketSequence, true);
               } else {
                    this.utilsService.setTicketSequence(tx, accountInfo.result.account_data.Sequence, false);
               }

               // Add memo if provided
               if (this.memoField) {
                    this.utilsService.setMemoField(tx, this.memoField);
               }

               // Sign transaction
               let signedTx: { tx_blob: string; hash: string } | null = null;

               if (this.useMultiSign) {
                    const signerAddresses = this.utilsService.getMultiSignAddress(this.multiSignAddress);
                    const signerSeeds = this.utilsService.getMultiSignSeeds(this.multiSignSeeds);

                    if (signerAddresses.length === 0) {
                         return { success: false, message: 'ERROR: No signer addresses provided for multi-signing' };
                    }
                    if (signerSeeds.length === 0) {
                         return { success: false, message: 'ERROR: No signer seeds provided for multi-signing' };
                    }

                    try {
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx, signerAddresses, signerSeeds, fee });

                         signedTx = result.signedTx;
                         tx.Signers = result.signers;

                         // Recalculate fee for multisign
                         const multiSignFee = String((signerAddresses.length + 1) * Number(fee));
                         tx.Fee = multiSignFee;
                    } catch (err: any) {
                         return { success: false, message: `ERROR: ${err.message}` };
                    }
               } else {
                    const preparedTx = await client.autofill(tx);
                    signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);
               }

               // Validate balance
               const serverInfo = await this.xrplService.getXrplServerInfo(client, 'current', '');
               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, tx, tx.Fee)) {
                    return { success: false, message: 'ERROR: Insufficient XRP to complete transaction' };
               }

               if (!signedTx) {
                    return { success: false, message: 'ERROR: Failed to sign transaction.' };
               }

               // Submit or Simulate
               let response: any;
               if (this.isSimulateEnabled) {
                    // ✅ TRUE SIMULATION — use UNSIGNED tx_json
                    response = await client.request({
                         command: 'simulate',
                         tx_json: tx,
                    });
                    return { success: true, message: response };
               } else {
                    response = await client.submitAndWait(signedTx.tx_blob);
                    return { success: true, message: response };
               }
          } catch (error: any) {
               return { success: false, message: `ERROR submitting flag: ${error.message}` };
          } finally {
               console.log(`Leaving submitFlagTransaction in ${Date.now() - startTime}ms`);
          }
     }

     private async submitFlagTransaction(client: xrpl.Client, wallet: xrpl.Wallet, flagPayload: any, memoField: any) {
          console.log('Entering submitFlagTransaction');
          const startTime = Date.now();

          const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');

          if (flagPayload.SetFlag) {
               const flagToUpdate = Array.from(AppConstants.FLAGS.values()).find((flag: any) => flag.value === flagPayload.SetFlag);
               this.updateSpinnerMessage(`Submitting ${flagToUpdate ? flagToUpdate.label : 'Flag'} set flag to the Ledger...`);
          }

          if (flagPayload.ClearFlag) {
               const flagToUpdate = Array.from(AppConstants.FLAGS.values()).find((flag: any) => flag.value === flagPayload.ClearFlag);
               this.updateSpinnerMessage(`Submitting ${flagToUpdate ? flagToUpdate.label : 'Flag'} clear flag to the Ledger...`);
          }

          try {
               const environment = this.xrplService.getNet().environment;

               let regularKeyWalletSignTx: any = '';
               let useRegularKeyWalletSignTx = false;
               if (this.isSetRegularKey && !this.useMultiSign) {
                    console.log('Using Regular Key Seed for transaction signing');
                    regularKeyWalletSignTx = await this.utilsService.getWallet(this.regularKeyAccountSeed, environment);
                    useRegularKeyWalletSignTx = true;
               }

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);
               const serverInfo = await this.xrplService.getXrplServerInfo(client, 'current', '');

               const tx = {
                    TransactionType: 'AccountSet',
                    Account: wallet.classicAddress,
                    ...flagPayload,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return { success: false, message: `ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}` };
                    }
                    tx.TicketSequence = Number(this.ticketSequence);
                    tx.Sequence = 0;
               } else {
                    tx.Sequence = accountInfo.result.account_data.Sequence;
               }

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

               let signedTx: { tx_blob: string; hash: string } | null = null;

               if (this.useMultiSign) {
                    const signerAddresses = this.utilsService.getMultiSignAddress(this.multiSignAddress);
                    if (signerAddresses.length === 0) {
                         return this.setError('ERROR: No signer addresses provided for multi-signing');
                    }

                    const signerSeeds = this.utilsService.getMultiSignSeeds(this.multiSignSeeds);
                    if (signerSeeds.length === 0) {
                         return this.setError('ERROR: No signer seeds provided for multi-signing');
                    }

                    try {
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: tx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         tx.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(tx, null, 2));
                         console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         tx.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));
                    } catch (err: any) {
                         return { success: false, message: `ERROR: ${err.message}` };
                    }
               } else {
                    const preparedTx = await client.autofill(tx);
                    console.log(`preparedTx:`, preparedTx);
                    if (useRegularKeyWalletSignTx) {
                         console.log('Using RegularKey to sign transaction');
                         signedTx = regularKeyWalletSignTx.sign(preparedTx);
                    } else {
                         signedTx = wallet.sign(preparedTx);
                    }
               }

               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, tx, fee)) {
                    return { success: false, message: 'ERROR: Insufficient XRP to complete transaction' };
               }

               if (!signedTx) {
                    return { success: false, message: 'ERROR: Failed to sign transaction.' };
               }

               const response = await client.submitAndWait(signedTx.tx_blob);
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

     private renderTransactionResult(response: any): void {
          if (this.isSimulateEnabled) {
               this.renderUiComponentsService.renderSimulatedTransactionsResults(response, this.resultField.nativeElement);
          } else {
               console.debug(`Response`, response);
               this.renderUiComponentsService.renderTransactionsResults(response, this.resultField.nativeElement);
          }
     }

     private refreshUIData(wallet: xrpl.Wallet, updatedAccountInfo: any, updatedAccountObjects: xrpl.AccountObjectsResponse) {
          console.debug(`updatedAccountInfo for ${wallet.classicAddress}:`, updatedAccountInfo.result);
          console.debug(`updatedAccountObjects for ${wallet.classicAddress}:`, updatedAccountObjects.result);

          this.refreshUiAccountObjects(updatedAccountObjects, updatedAccountInfo, wallet);
          this.refreshUiAccountInfo(updatedAccountInfo);
     }

     private checkForSignerAccounts(accountObjects: xrpl.AccountObjectsResponse) {
          const signerAccounts: string[] = [];
          if (accountObjects.result && Array.isArray(accountObjects.result.account_objects)) {
               accountObjects.result.account_objects.forEach(obj => {
                    if (obj.LedgerEntryType === 'SignerList' && Array.isArray(obj.SignerEntries)) {
                         obj.SignerEntries.forEach((entry: any) => {
                              if (entry.SignerEntry?.Account) {
                                   signerAccounts.push(entry.SignerEntry.Account + '~' + entry.SignerEntry.SignerWeight);
                                   this.signerQuorum = obj.SignerQuorum;
                              }
                         });
                    }
               });
          }
          return signerAccounts;
     }

     private async updateXrpBalance(client: xrpl.Client, accountInfo: xrpl.AccountInfoResponse, wallet: xrpl.Wallet) {
          const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, accountInfo, wallet.classicAddress);

          this.ownerCount = ownerCount;
          this.totalXrpReserves = totalXrpReserves;

          const balance = (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0');
          this.currentWallet.balance = balance.toString();
     }

     private async validateInputs(inputs: ValidationInputs, action: string): Promise<string[]> {
          const errors: string[] = [];

          // Common validators as functions
          const isRequired = (value: string | null | undefined, fieldName: string): string | null => {
               if (value == null || !this.utilsService.validateInput(value)) {
                    return `${fieldName} cannot be empty`;
               }
               return null;
          };

          const isValidXrpAddress = (value: string | undefined, fieldName: string): string | null => {
               if (value && !xrpl.isValidAddress(value)) {
                    return `${fieldName} is invalid`;
               }
               return null;
          };

          const isValidSecret = (value: string | undefined, fieldName: string): string | null => {
               if (value && !xrpl.isValidSecret(value)) {
                    return `${fieldName} is invalid`;
               }
               return null;
          };

          const isValidSeed = (value: string | undefined): string | null => {
               if (value) {
                    const { type } = this.utilsService.detectXrpInputType(value);
                    if (type === 'unknown') {
                         return 'Account seed or mnemonic is invalid';
                    }
               }
               return null;
          };

          const isValidNumber = (value: string | undefined, fieldName: string, minValue?: number, maxValue?: number): string | null => {
               if (value === undefined) return null; // Not required
               const num = parseFloat(value);
               if (isNaN(num) || !isFinite(num)) {
                    return `${fieldName} must be a valid number`;
               }
               if (minValue !== undefined && num < minValue) {
                    return `${fieldName} must be at least ${minValue}`;
               }
               if (maxValue !== undefined && num > maxValue) {
                    return `${fieldName} cannot be greater than ${maxValue}`;
               }
               return null;
          };

          const validateMultiSign = (addressesStr: string | undefined, seedsStr: string | undefined): string | null => {
               if (!addressesStr || !seedsStr) return null; // Not required
               const addresses = this.utilsService.getMultiSignAddress(addressesStr);
               const seeds = this.utilsService.getMultiSignSeeds(seedsStr);
               if (addresses.length === 0) {
                    return 'At least one signer address is required for multi-signing';
               }
               if (addresses.length !== seeds.length) {
                    return 'Number of signer addresses must match number of signer seeds';
               }
               const invalidAddr = addresses.find((addr: string) => !xrpl.isValidAddress(addr));
               if (invalidAddr) {
                    return `Invalid signer address: ${invalidAddr}`;
               }
               const invalidSeed = seeds.find((seed: string) => !this.utilsService.validateSeed(seed));
               if (invalidSeed) {
                    return 'One or more signer seeds are invalid';
               }
               return null;
          };

          const validateAddresses = async (addressesStr: string | undefined, fieldName: string) => {
               const errors: string[] = [];
               if (!addressesStr) return errors;
               const addresses = this.utilsService.getUserEnteredAddress(addressesStr);
               if (!addresses.length) {
                    errors.push(`${fieldName} list is empty`);
                    return errors;
               }
               const selfAddress = (await this.getWallet()).classicAddress;
               if (addresses.includes(selfAddress)) {
                    errors.push(`Your own account cannot be in the ${fieldName.toLowerCase()} list`);
               }
               const invalidAddresses = addresses.filter((addr: string) => !xrpl.isValidClassicAddress(addr));
               if (invalidAddresses.length > 0) {
                    errors.push(`Invalid ${fieldName} addresses: ${invalidAddresses.join(', ')}`);
               }
               const duplicates = addresses.filter((addr: any, idx: any, self: string | any[]) => self.indexOf(addr) !== idx);
               if (duplicates.length > 0) {
                    errors.push(`Duplicate ${fieldName} addresses: ${[...new Set(duplicates)].join(', ')}`);
               }
               return errors;
          };

          const validateSigners = async (signers: { account: string; seed: string; weight: number }[] | undefined): Promise<string[]> => {
               const errors: string[] = [];
               if (!signers?.length) {
                    errors.push('No valid signer accounts provided');
                    return errors;
               }
               const selfAddress = (await this.getWallet()).classicAddress;
               if (signers.some(s => s.account === selfAddress)) {
                    errors.push('Your own account cannot be in the signer list');
               }
               const allAddressesValid = signers.every(s => {
                    // Empty string?
                    if (!s.account || s.account.trim() === '') return false;
                    // XRPL has isValidAddress helper
                    return xrpl.isValidAddress(s.account);
               });
               if (!allAddressesValid) {
                    errors.push(`Invalid signer addresses`);
               }
               const allSeedsValid = signers.every(s => {
                    // Empty string?
                    if (!s.seed || s.seed.trim() === '' || s.seed.trim() === ',') return false;

                    return true;
               });
               if (!allSeedsValid) {
                    errors.push(`Invalid signer seed`);
               }
               try {
                    const seedResults = signers.map(s => (s.seed ? this.utilsService.validateSeed(s.seed) : true));
                    const allSeedsValid = seedResults.every(valid => valid);
                    if (!allSeedsValid) {
                         errors.push(`Invalid signer seed`);
                    }
               } catch (error: any) {
                    console.error('Error validating signer seeds:', error.message);
                    errors.push(`Invalid signer seed`);
               }

               const addresses = signers.map(s => s.account);
               const duplicates = addresses.filter((addr, idx, self) => self.indexOf(addr) !== idx);
               if (duplicates.length > 0) {
                    errors.push(`Duplicate signer addresses: ${[...new Set(duplicates)].join(', ')}`);
               }
               if (signers.length > 8) {
                    errors.push(`XRPL allows max 8 signer entries. You provided ${signers.length}`);
               }
               const totalWeight = signers.reduce((sum, s) => sum + (s.weight || 0), 0);
               if (inputs.signerQuorum && inputs.signerQuorum < totalWeight) {
                    errors.push(`Quorum (${inputs.signerQuorum}) exceeds total signer weight (${totalWeight})`);
               }
               if (inputs.signerQuorum ? parseInt(inputs.signerQuorum.toString()) <= 0 : true) {
                    errors.push('Quorum must be greater than 0');
               }
               return errors;
          };

          // Action-specific config: required fields and custom rules
          const actionConfig: Record<string, { required: (keyof ValidationInputs)[]; customValidators?: (() => Promise<string | null>)[] }> = {
               getAccountDetails: {
                    required: ['seed'],
                    customValidators: [async () => isValidSeed(inputs.seed), async () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null)],
               },
               toggleMetaData: {
                    required: ['seed'],
                    customValidators: [async () => isValidSeed(inputs.seed)],
               },
               updateFlags: {
                    required: ['seed'],
                    customValidators: [
                         async () => isValidSeed(inputs.seed),
                         async () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                         async () => (inputs.account_info.result?.account_flags?.disableMasterKey && !inputs.isMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                         async () => (this.flags.asfNoFreeze && this.flags.asfGlobalFreeze ? 'Cannot enable both NoFreeze and GlobalFreeze' : null),
                         async () => (this.flags.asfDisableMaster && (inputs.isMultiSign || this.isSetRegularKey) ? 'Disabling the master key requires signing with the master key' : null),
                         async () => (inputs.flags.disableMasterKey && !inputs.isMultiSign && !this.isSetRegularKey ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                         async () => (inputs.setFlags.length === 0 && inputs.clearFlags.length === 0 ? 'Set Flags and Clear Flags length is 0. No flags selected for update' : null),
                         async () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                         async () => (inputs.isTicket ? isRequired(inputs.selectedSingleTicket, 'Ticket Sequence') : null),
                         async () => (inputs.isTicket ? isValidNumber(inputs.selectedSingleTicket, 'Ticket Sequence', 0) : null),
                         async () => (inputs.isRegularKeyAddress && !inputs.isMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         async () => (inputs.isRegularKeyAddress && !inputs.isMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         async () => (inputs.isRegularKeyAddress && !inputs.isMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         async () => (inputs.isRegularKeyAddress && !inputs.isMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
                    ],
               },
               updateMetaData: {
                    required: ['seed'],
                    customValidators: [
                         async () => isValidSeed(inputs.seed),
                         async () => (inputs.account_info.result.account_flags.disableMasterKey && !inputs.isMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                         async () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                         async () => (inputs.tickSize ? isValidNumber(inputs.tickSize, 'Tick Size', 0, 15) : null),
                         async () => (inputs.transferRate ? isValidNumber(inputs.transferRate, 'Transfer Rate', 0, 100) : null),
                         async () => (inputs.domain && !this.utilsService.validateInput(inputs.domain) ? 'Domain cannot be empty' : null),
                         async () => (inputs.isTicket ? isRequired(inputs.selectedSingleTicket, 'Ticket Sequence') : null),
                         async () => (inputs.isTicket ? isValidNumber(inputs.selectedSingleTicket, 'Ticket Sequence', 0) : null),
                         async () => (inputs.isRegularKeyAddress && !inputs.isMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         async () => (inputs.isRegularKeyAddress && !inputs.isMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         async () => (inputs.isRegularKeyAddress && !inputs.isMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         async () => (inputs.isRegularKeyAddress && !inputs.isMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         async () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                    ],
               },
               setDepositAuthAccounts: {
                    required: ['seed', 'depositAuthAddress'],
                    customValidators: [
                         async () => isValidSeed(inputs.seed),
                         async () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                         async () => (inputs.account_info.result.account_flags.disableMasterKey && !inputs.isMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                         async () => (await validateAddresses(inputs.depositAuthAddress, 'Deposit Auth')).join('; '),
                         async () => (inputs.isTicket ? isRequired(inputs.selectedSingleTicket, 'Ticket Sequence') : null),
                         async () => (inputs.isTicket ? isValidNumber(inputs.selectedSingleTicket, 'Ticket Sequence', 0) : null),
                         async () => (inputs.isRegularKeyAddress && !inputs.isMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         async () => (inputs.isRegularKeyAddress && !inputs.isMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         async () => (inputs.isRegularKeyAddress && !inputs.isMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         async () => (inputs.isRegularKeyAddress && !inputs.isMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         async () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                    ],
               },
               setMultiSign: {
                    required: ['seed'],
                    customValidators: [
                         async () => isValidSeed(inputs.seed),
                         async () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                         async () => (inputs.account_info.result.account_flags.disableMasterKey && !inputs.isMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                         async () => (inputs.isMultiSign ? (await validateSigners(inputs.signers)).join('; ') : null),
                         async () => (inputs.isTicket ? isRequired(inputs.selectedSingleTicket, 'Ticket Sequence') : null),
                         async () => (inputs.isTicket ? isValidNumber(inputs.selectedSingleTicket, 'Ticket Sequence', 0) : null),
                         async () => (inputs.isRegularKeyAddress && (inputs.regularKeyAddress === '' || inputs.regularKeyAddress === 'No RegularKey configured for account' || inputs.regularKeySeed === '') ? ' Regular Key address and seed must be present' : null),
                         async () => (inputs.isRegularKeyAddress && !inputs.isMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         async () => (inputs.isRegularKeyAddress && !inputs.isMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         async () => (inputs.isRegularKeyAddress && !inputs.isMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         async () => (inputs.isRegularKeyAddress && !inputs.isMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
                    ],
               },
               setRegularKey: {
                    required: ['seed'],
                    customValidators: [
                         async () => isValidSeed(inputs.seed),
                         // async () => (inputs.regularKeyAddress === '' || inputs.regularKeyAddress === 'No RegularKey configured for account' || inputs.regularKeySeed === '' ? ' Regular Key address and seed must be present' : null),
                         async () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                         async () => (inputs.account_info.result.account_flags.disableMasterKey && !inputs.isMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                         async () => (inputs.isTicket ? isRequired(inputs.selectedSingleTicket, 'Ticket Sequence') : null),
                         async () => (inputs.isTicket ? isValidNumber(inputs.selectedSingleTicket, 'Ticket Sequence', 0) : null),
                         async () => (inputs.isRegularKeyAddress && !inputs.isMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         async () => (inputs.isRegularKeyAddress && !inputs.isMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         async () => (inputs.isRegularKeyAddress && !inputs.isMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         async () => (inputs.isRegularKeyAddress && !inputs.isMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         async () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                    ],
               },
               setNftMinterAddress: {
                    required: ['seed', 'nfTokenMinterAddress'],
                    customValidators: [
                         async () => isValidSeed(inputs.seed),
                         async () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                         async () => (inputs.account_info.result.account_flags.disableMasterKey && !inputs.isMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                         async () => (await validateAddresses(inputs.nfTokenMinterAddress, 'NFT Minter')).join('; '),
                         async () => (inputs.isTicket ? isRequired(inputs.selectedSingleTicket, 'Ticket Sequence') : null),
                         async () => (inputs.isTicket ? isValidNumber(inputs.selectedSingleTicket, 'Ticket Sequence', 0) : null),
                         async () => (inputs.isRegularKeyAddress && !inputs.isMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         async () => (inputs.isRegularKeyAddress && !inputs.isMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         async () => (inputs.isRegularKeyAddress && !inputs.isMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         async () => (inputs.isRegularKeyAddress && !inputs.isMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         async () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                    ],
               },
               default: { required: [], customValidators: [] },
          };

          const config = actionConfig[action] || actionConfig['default'];

          // Check required fields
          for (const field of config.required) {
               if (field === 'signerQuorum' || field === 'signers') continue; // Skip non-string fields
               const err = isRequired(inputs[field] as string, field.charAt(0).toUpperCase() + field.slice(1));
               if (err) errors.push(err);
          }

          // Run custom validators
          if (config.customValidators) {
               for (const validator of config.customValidators) {
                    const err = await validator();
                    if (err) errors.push(err);
               }
          }

          // Always validate optional fields if provided
          // const multiErr = validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds);
          // if (multiErr) errors.push(multiErr);

          // if (errors.length == 0 && inputs.isMultiSign && (inputs.multiSignAddresses === 'No Multi-Sign address configured for account' || inputs.multiSignSeeds === '')) {
          //      errors.push('At least one signer address is required for multi-signing');
          // }

          return errors;
     }

     private async setTxOptionalFields(client: xrpl.Client, accountTx: any, wallet: xrpl.Wallet, accountInfo: any) {
          if (this.selectedSingleTicket) {
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.selectedSingleTicket));
               if (!ticketExists) {
                    return this.setError(`ERROR: Ticket Sequence ${this.selectedSingleTicket} not found for account ${wallet.classicAddress}`);
               }
               this.utilsService.setTicketSequence(accountTx, this.selectedSingleTicket, true);
          } else {
               if (this.multiSelectMode && this.selectedTickets.length > 0) {
                    console.log('Setting multiple tickets:', this.selectedTickets);
                    this.utilsService.setTicketSequence(accountTx, accountInfo.result.account_data.Sequence, false);
               }
          }

          if (this.memoField) {
               this.utilsService.setMemoField(accountTx, this.memoField);
          }
     }

     refreshUiAccountObjects(accountObjects: any, accountInfo: xrpl.AccountInfoResponse, wallet: xrpl.Wallet) {
          const signerAccounts: string[] = this.checkForSignerAccounts(accountObjects);

          if (signerAccounts?.length) {
               const singerEntriesAccount = wallet.classicAddress + 'signerEntries';
               const signerEntries: SignerEntry[] = this.storageService.get(singerEntriesAccount) || [];

               console.debug(`refreshUiAccountObjects:`, signerEntries);

               this.multiSignAddress = signerEntries.map((item: { Account: any }) => item.Account + ',\n').join('');
               this.multiSignSeeds = signerEntries.map((item: { seed: any }) => item.seed + ',\n').join('');
          } else {
               this.signerQuorum = 0;
               this.multiSignAddress = 'No Multi-Sign address configured for account';
               this.multiSignSeeds = '';
               this.storageService.removeValue('signerEntries');
          }

          this.useMultiSign = false;
          const isMasterKeyDisabled = accountInfo?.result?.account_flags?.disableMasterKey;
          if (isMasterKeyDisabled) {
               this.masterKeyDisabled = true;
          } else {
               this.masterKeyDisabled = false;
          }

          if (isMasterKeyDisabled && signerAccounts && signerAccounts.length > 0) {
               this.useMultiSign = true; // Force to true if master key is disabled
          } else {
               this.useMultiSign = false;
          }

          if (signerAccounts && signerAccounts.length > 0) {
               this.multiSigningEnabled = true;
          } else {
               this.multiSigningEnabled = false;
          }

          const preAuthAccounts: string[] = this.utilsService.findDepositPreauthObjects(accountObjects);
          if (preAuthAccounts && preAuthAccounts.length > 0) {
               this.depositAuthAddress = preAuthAccounts.map(account => account + ',\n').join('');
               this.isdepositAuthAddress = false;
               this.depositAuthEnabled = true;
          } else {
               this.depositAuthAddress = '';
               this.isdepositAuthAddress = false;
               this.depositAuthEnabled = false;
          }
     }

     refreshUiIAccountMetaData(accountInfo: any) {
          const { TickSize, TransferRate, Domain, MessageKey } = accountInfo.account_data;
          this.tickSize = TickSize || '';
          this.transferRate = TransferRate ? ((TransferRate / 1_000_000_000 - 1) * 100).toFixed(3) : '';
          this.domain = Domain ? this.utilsService.decodeHex(Domain) : '';
          this.isMessageKey = !!MessageKey;
          this.cdr.detectChanges();
     }

     refreshUiAccountInfo(accountInfo: any) {
          const nftTokenMinter = accountInfo?.result?.account_data?.NFTokenMinter;
          if (nftTokenMinter) {
               this.isAuthorizedNFTokenMinter = false;
               this.isNFTokenMinterEnabled = true;
               this.nfTokenMinterAddress = nftTokenMinter;
          } else {
               this.isAuthorizedNFTokenMinter = false;
               this.isNFTokenMinterEnabled = false;
               this.nfTokenMinterAddress = '';
          }

          const regularKey = accountInfo?.result?.account_data?.RegularKey;
          if (regularKey) {
               this.regularKeyAccount = regularKey;
               const regularKeySeedAccount = accountInfo.result.account_data.Account + 'regularKeySeed';
               this.regularKeyAccountSeed = this.storageService.get(regularKeySeedAccount);
          } else {
               this.isSetRegularKey = false;
               this.regularKeyAccount = 'No RegularKey configured for account';
               this.regularKeyAccountSeed = '';
          }

          const isMasterKeyDisabled = accountInfo?.result?.account_flags?.disableMasterKey;
          if (isMasterKeyDisabled) {
               this.masterKeyDisabled = true;
          } else {
               this.masterKeyDisabled = false;
          }

          if (isMasterKeyDisabled && xrpl.isValidAddress(this.regularKeyAccount)) {
               this.isSetRegularKey = true; // Force to true if master key is disabled
          } else {
               this.isSetRegularKey = false;
          }

          if (regularKey) {
               this.regularKeySigningEnabled = true;
          } else {
               this.regularKeySigningEnabled = false;
          }

          const tickSize = accountInfo?.result?.account_data?.TickSize;
          const transferRate = accountInfo?.result?.account_data?.TransferRate;
          const domain = accountInfo?.result?.account_data?.Domain;
          const messageKey = accountInfo?.result?.account_data?.MessageKey;
          if (tickSize || transferRate || domain || messageKey) {
               this.isUpdateMetaData = true;
               this.toggleMetaData();
          } else {
               this.isUpdateMetaData = false;
          }
     }

     private getAccountTickets(accountObjects: xrpl.AccountObjectsResponse) {
          const getAccountTickets: string[] = [];
          if (accountObjects.result && Array.isArray(accountObjects.result.account_objects)) {
               accountObjects.result.account_objects.forEach(obj => {
                    if (obj.LedgerEntryType === 'Ticket') {
                         getAccountTickets.push(obj.TicketSequence.toString());
                    }
               });
          }
          return getAccountTickets;
     }

     private cleanUpSingleSelection() {
          // Check if selected ticket still exists in available tickets
          if (this.selectedSingleTicket && !this.ticketArray.includes(this.selectedSingleTicket)) {
               this.selectedSingleTicket = ''; // Reset to "Select a ticket"
          }
     }

     private cleanUpMultiSelection() {
          // Filter out any selected tickets that no longer exist
          this.selectedTickets = this.selectedTickets.filter(ticket => this.ticketArray.includes(ticket));
     }

     updateTickets(accountObjects: xrpl.AccountObjectsResponse) {
          this.ticketArray = this.getAccountTickets(accountObjects);

          // Clean up selections based on current mode
          if (this.multiSelectMode) {
               this.cleanUpMultiSelection();
          } else {
               this.cleanUpSingleSelection();
          }
     }

     private async getWallet() {
          const environment = this.xrplService.getNet().environment;
          const seed = this.currentWallet.seed;
          const wallet = await this.utilsService.getWallet(seed, environment);
          if (!wallet) {
               throw new Error('ERROR: Wallet could not be created or is undefined');
          }
          return wallet;
     }

     loadSignerList(account: string) {
          const singerEntriesAccount = account + 'signerEntries';
          if (this.storageService.get(singerEntriesAccount) != null && this.storageService.get(singerEntriesAccount).length > 0) {
               this.signers = this.storageService.get(singerEntriesAccount).map((s: { Account: any; seed: any; SignerWeight: any }) => ({
                    account: s.Account,
                    seed: s.seed,
                    weight: s.SignerWeight,
               }));
          } else {
               this.clearSignerList();
          }
     }

     clearSignerList() {
          this.signers = [{ account: '', seed: '', weight: 1 }];
     }

     clearFields(clearAllFields: boolean) {
          if (clearAllFields) {
               this.ticketSequence = '';
               this.useMultiSign = false;
               this.isAuthorizedNFTokenMinter = false;
               this.isdepositAuthAddress = false;
               this.isUpdateMetaData = false;
               this.isSetRegularKey = false;
          }

          this.isSimulateEnabled = false;
          this.selectedTicket = '';
          this.isTicket = false;
          this.isTicketEnabled = false;
          this.multiSelectMode = false;
          this.selectedSingleTicket = '';
          this.selectedTickets = [];
          this.isMultiSign = false;
          this.memoField = '';
          this.isMemoEnabled = false;
          this.cdr.detectChanges();
     }

     isValidResponse(response: any): response is { success: boolean; message: xrpl.TxResponse<xrpl.SubmittableTransaction> | string } {
          return response && typeof response === 'object' && 'success' in response && 'message' in response && response.success === true;
     }

     private formatSignerEntries(signerEntries: { Account: string; SignerWeight: number; seed: string }[]) {
          return signerEntries.map(entry => ({
               SignerEntry: {
                    Account: entry.Account,
                    SignerWeight: entry.SignerWeight,
               },
          }));
     }

     private createSignerEntries() {
          return this.signers
               .filter(s => s.account && s.weight > 0)
               .map(s => ({
                    Account: s.account,
                    SignerWeight: Number(s.weight),
                    seed: s.seed,
               }));
     }

     clearUiIAccountMetaData() {
          this.tickSize = '';
          this.transferRate = '';
          this.domain = '';
          this.isMessageKey = false;

          this.cdr.detectChanges();
     }

     private updateSpinnerMessage(message: string) {
          this.spinnerMessage = message;
          this.cdr.detectChanges();
          console.debug('Spinner message updated:', message);
     }

     private async showSpinnerWithDelay(message: string, delayMs: number = 200) {
          this.spinner = true;
          this.updateSpinnerMessage(message);
          await new Promise(resolve => setTimeout(resolve, delayMs));
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
