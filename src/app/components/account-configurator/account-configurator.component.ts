import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
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

interface SignerEntry {
     account: string;
     seed: string;
     weight: number;
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
     selectedAccount: 'account1' | 'account2' | null = 'account1';
     configurationType: 'holder' | 'exchanger' | 'issuer' | null = null;
     private lastResult: string = '';
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = false;
     account1 = { name: '', address: '', seed: '', balance: '' };
     account2 = { name: '', address: '', seed: '', balance: '' };
     issuer = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '0' };
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
     spinner: boolean = false;
     signers: { account: string; seed: string; weight: number }[] = [{ account: '', seed: '', weight: 1 }];

     constructor(private xrplService: XrplService, private utilsService: UtilsService, private cdr: ChangeDetectorRef, private storageService: StorageService) {}

     ngOnInit(): void {}

     async ngAfterViewInit() {
          try {
               const wallet = await this.getWallet();
               this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
          } catch (error) {
               return this.setError('ERROR: Wallet could not be created or is undefined');
          } finally {
               this.cdr.detectChanges();
          }
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
          const accountHandlers: Record<string, () => void> = {
               account1: () => this.displayDataForAccount1(),
               account2: () => this.displayDataForAccount2(),
               issuer: () => this.displayDataForAccount3(),
          };
          (accountHandlers[this.selectedAccount ?? 'issuer'] || accountHandlers['issuer'])();
          this.configurationType = null;
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
                    this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
               }
          } catch (error) {
               return this.setError('ERROR: Wallet could not be created or is undefined');
          } finally {
               this.cdr.detectChanges();
          }
     }

     async toggleUseMultiSign() {
          try {
               if (this.multiSignAddress === 'No Multi-Sign address configured for account') {
                    this.multiSignSeeds = '';
                    this.cdr.detectChanges();
                    return;
               }
          } catch (error) {
               return this.setError('ERROR: Wallet could not be created or is undefined');
          } finally {
               this.cdr.detectChanges();
          }
     }

     onConfigurationChange() {
          // Reset all flags to ensure a clean state
          this.resetFlags();

          // Call the appropriate method based on configurationType
          const configActions: Record<string, () => void> = {
               holder: () => this.setHolder(),
               exchanger: () => this.setExchanger(),
               issuer: () => this.setIssuer(),
          };

          const type = this.configurationType;
          if (type && configActions[type]) {
               configActions[type]();
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
          ['domainField', 'transferRateField', 'tickSizeField'].forEach(id => {
               const elem = document.getElementById(id) as HTMLInputElement | null;
               if (elem) elem.value = '';
          });

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
          this.flags.asfDepositAuth = false;
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

     async toggleMetaData() {
          console.log('Entering toggleMetaData');
          const startTime = Date.now();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
               console.debug(`accountInfo for ${wallet.classicAddress} ${JSON.stringify(accountInfo.result, null, '\t')}`);

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
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               this.showSpinnerWithDelay('Getting Account Details...', 200);

               const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
               if (accountInfo.result.account_data.length <= 0) {
                    this.resultField.nativeElement.innerHTML = `No account data found for ${wallet.classicAddress}`;
                    return;
               }
               console.debug(`accountInfo for ${wallet.classicAddress} ${JSON.stringify(accountInfo.result, null, '\t')}`);

               const accountObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '');
               console.debug(`accountObjects for ${wallet.classicAddress} ${JSON.stringify(accountObjects.result, null, '\t')}`);

               // Set flags from account info
               AppConstants.FLAGS.forEach(flag => {
                    const input = document.getElementById(flag.name) as HTMLInputElement;
                    const flagKey = AppConstants.FLAGMAP[flag.name as keyof typeof AppConstants.FLAGMAP];
                    if (input && flagKey) {
                         input.checked = !!accountInfo.result.account_flags?.[flagKey as keyof typeof accountInfo.result.account_flags];
                    }
               });

               this.utilsService.renderAccountDetails(accountInfo, accountObjects);
               this.setSuccess(this.result);
               this.refreshUiIAccountMetaData(accountInfo.result);
               this.refreshUiAccountObjects(accountObjects, wallet);
               this.refreshUiAccountInfo(accountInfo);
               this.loadSignerList(wallet.classicAddress);

               this.isMemoEnabled = false;
               this.memoField = '';
               this.ticketSequence = '';

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
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }
          if (this.flags.asfNoFreeze && this.flags.asfGlobalFreeze) {
               return this.setError('ERROR: Cannot enable both NoFreeze and GlobalFreeze');
          }

          this.clearUiIAccountMetaData();

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               this.updateSpinnerMessage('Updating Account Flags...');

               const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
               console.debug(`accountInfo for ${wallet.classicAddress} ${JSON.stringify(accountInfo.result, null, '\t')}`);

               const { setFlags, clearFlags } = this.utilsService.getFlagUpdates(accountInfo.result.account_flags);

               if (setFlags.length === 0 && clearFlags.length === 0) {
                    this.resultField.nativeElement.innerHTML = 'Set Flags and Clear Flags length is 0. No flags selected for update';
                    return;
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

               console.log(`transactions ${JSON.stringify(transactions, null, '\t')}`);

               // Render all successful transactions
               this.utilsService.renderTransactionsResults(transactions, this.resultField.nativeElement);
               this.setSuccess(this.result);
               this.resultField.nativeElement.classList.add('success');

               this.isMemoEnabled = false;
               this.memoField = '';

               this.refreshUiAccountInfo(await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''));
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), wallet);

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
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.isMultiSign, this.isSetRegularKey, this.regularKeyAccountSeed);

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

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(accountSetTx, this.ticketSequence, true);
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    this.utilsService.setTicketSequence(accountSetTx, getAccountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(accountSetTx, this.memoField);
               }

               if (this.tickSize) {
                    const tickSize = parseInt(this.tickSize);
                    if (tickSize == 0) {
                         updatedData = true;
                         this.utilsService.setTickSize(accountSetTx, tickSize);
                    } else {
                         if (tickSize < 3 || tickSize > 15) {
                              return this.setError('ERROR: Tick size must be between 3 and 15.');
                         }
                         updatedData = true;
                         this.utilsService.setTickSize(accountSetTx, tickSize);
                    }
               }

               if (this.transferRate) {
                    const transferRate = parseFloat(this.transferRate);
                    if (transferRate == 0) {
                         updatedData = true;
                         this.utilsService.setTransferRate(accountSetTx, transferRate);
                    } else {
                         if (transferRate > 100) {
                              return this.setError('ERROR: Transfer rate cannot be greater than 100%.');
                         }
                         updatedData = true;
                         this.utilsService.setTransferRate(accountSetTx, transferRate);
                    }
               }

               if (this.isMessageKey) {
                    updatedData = true;
                    this.utilsService.setMessageKey(accountSetTx, wallet.publicKey);
               } else {
                    this.utilsService.setMessageKey(accountSetTx, '');
               }

               if (this.domain) {
                    updatedData = true;
                    this.utilsService.setDomain(accountSetTx, this.domain);
               } else {
                    this.utilsService.setDomain(accountSetTx, '');
               }

               if (updatedData) {
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
                              const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: accountSetTx, signerAddresses, signerSeeds, fee });
                              signedTx = result.signedTx;
                              accountSetTx.Signers = result.signers;

                              console.log('Payment with Signers:', JSON.stringify(accountSetTx, null, 2));

                              if (!signedTx) {
                                   return this.setError('ERROR: No valid signature collected for multisign transaction');
                              }

                              const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                              console.log(`multiSignFee: ${multiSignFee}`);
                              accountSetTx.Fee = multiSignFee;
                              const finalTx = xrpl.decode(signedTx.tx_blob);
                              console.debug(`Decoded Final Tx: ${JSON.stringify(finalTx, null, '\t')}`);

                              if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, accountSetTx, multiSignFee)) {
                                   return this.setError('ERROR: Insufficent XRP to complete transaction');
                              }
                         } catch (err: any) {
                              return this.setError(`ERROR: ${err.message}`);
                         }
                    } else {
                         const preparedTx = await client.autofill(accountSetTx);
                         console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                         signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                         if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, accountSetTx, fee)) {
                              return this.setError('ERROR: Insufficent XRP to complete transaction');
                         }
                    }

                    console.debug(`Parse Tx Flags: ${wallet.classicAddress} ${JSON.stringify(xrpl.parseTransactionFlags(accountSetTx), null, '\t')}`);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign transaction.');
                    }
                    console.log(`signedTx: ${JSON.stringify(signedTx, null, '\t')}`);

                    this.updateSpinnerMessage('Submitting transaction to the Ledger ...');
                    const response = await client.submitAndWait(signedTx.tx_blob);
                    console.log('Submit Response:', JSON.stringify(response, null, '\t'));

                    if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                         console.error(`Transaction failed: ${JSON.stringify(response, null, 2)}`);
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

               this.isMemoEnabled = false;
               this.memoField = '';

               this.refreshUiAccountInfo(await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''));
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), wallet);

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
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
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
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.isMultiSign, this.isSetRegularKey, this.regularKeyAccountSeed);

               this.updateSpinnerMessage('Setting Deposit Auth accounts...');

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
               console.debug(`accountObjects for ${wallet.classicAddress} ${JSON.stringify(accountObjects.result, null, '\t')}`);

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
                    console.debug(`accountInfo for ${authorizedAddress} ${JSON.stringify(accountInfo.result, null, '\t')}`);

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
                         this.utilsService.setMemoField(depositPreauthTx, this.memoField);
                    }

                    // if (this.ticketSequence) {
                    //      if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                    //           return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    //      }
                    //      this.utilsService.setTicketSequence(depositPreauthTx, this.ticketSequence, true);
                    // } else {
                    //      const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    //      this.utilsService.setTicketSequence(depositPreauthTx, getAccountInfo.result.account_data.Sequence, false);
                    // }

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
                              const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: depositPreauthTx, signerAddresses, signerSeeds, fee });
                              signedTx = result.signedTx;
                              depositPreauthTx.Signers = result.signers;

                              console.log('Payment with Signers:', JSON.stringify(depositPreauthTx, null, 2));

                              if (!signedTx) {
                                   return this.setError('ERROR: No valid signature collected for multisign transaction');
                              }

                              const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                              console.log(`multiSignFee: ${multiSignFee}`);
                              depositPreauthTx.Fee = multiSignFee;
                              const finalTx = xrpl.decode(signedTx.tx_blob);
                              console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));

                              if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, signedTx, multiSignFee)) {
                                   return this.setError('ERROR: Insufficient XRP to complete transaction');
                              }
                         } catch (err: any) {
                              return this.setError(`ERROR: ${err.message}`);
                         }
                    } else {
                         const preparedTx = await client.autofill(depositPreauthTx);
                         console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                         signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                         if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, signedTx, fee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    }

                    console.log(`Parse Tx Flags: ${JSON.stringify(xrpl.parseTransactionFlags(depositPreauthTx), null, '\t')}`);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign transaction.');
                    }
                    console.log(`signedTx: ${JSON.stringify(signedTx, null, '\t')}`);

                    this.updateSpinnerMessage(`Submitting DepositPreauth for ${authorizedAddress} to the Ledger...`);
                    const response = await client.submitAndWait(signedTx.tx_blob);
                    console.log('Submit Response:', JSON.stringify(response, null, '\t'));

                    if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                         console.error(`Transaction failed: ${JSON.stringify(response, null, 2)}`);
                         this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                         this.resultField.nativeElement.classList.add('error');
                         this.setErrorProperties();
                         return this.setError(`ERROR: Transaction failed for ${authorizedAddress}`);
                    }

                    const result = response.result;
                    results.push({ result });
               }

               // All transactions successful
               this.utilsService.renderTransactionsResults(results, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               this.isMemoEnabled = false;
               this.memoField = '';

               this.refreshUiAccountInfo(await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''));
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), wallet);

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
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               this.updateSpinnerMessage('Setting Multi Sign...');

               const fee = await this.xrplService.calculateTransactionFee(client);

               let signerEntries;
               let signerListTx: SignerListSet = await client.autofill({
                    TransactionType: 'SignerListSet',
                    Account: wallet.classicAddress,
                    SignerQuorum: 0,
                    Fee: fee,
               });

               if (enableMultiSignFlag === 'Y') {
                    // Create array of signer accounts and their weights
                    signerEntries = this.signers
                         .filter(s => s.account && s.weight > 0)
                         .map(s => ({
                              Account: s.account,
                              SignerWeight: Number(s.weight),
                              seed: s.seed,
                         }));

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

                    const singerEntriesAccount = wallet.classicAddress + 'signerEntries';
                    this.storageService.set(singerEntriesAccount, signerEntries);

                    // Format SignerEntries for XRPL transaction
                    const formattedSignerEntries = signerEntries.map(entry => ({
                         SignerEntry: {
                              Account: entry.Account,
                              SignerWeight: entry.SignerWeight,
                         },
                    }));

                    const currentLedger = await this.xrplService.getLastLedgerIndex(client);

                    if (this.ticketSequence) {
                         if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                              return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                         }
                         this.utilsService.setTicketSequence(signerListTx, this.ticketSequence, true);
                    } else {
                         const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                         this.utilsService.setTicketSequence(signerListTx, getAccountInfo.result.account_data.Sequence, false);
                    }

                    if (this.memoField) {
                         this.utilsService.setMemoField(signerListTx, this.memoField);
                    }

                    signerListTx.SignerEntries = formattedSignerEntries;
                    signerListTx.SignerQuorum = SignerQuorum;
                    signerListTx.LastLedgerSequence = currentLedger + AppConstants.LAST_LEDGER_ADD_TIME;
                    console.error(`signerListTx enableMultiSignFlag = Y ${JSON.stringify(signerListTx, null, 2)}`);
               } else {
                    // Disable multi-sign (set SignerQuorum to 0 and empty SignerEntries)
                    const currentLedger = await this.xrplService.getLastLedgerIndex(client);

                    if (this.ticketSequence) {
                         if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                              return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                         }
                         this.utilsService.setTicketSequence(signerListTx, this.ticketSequence, true);
                    } else {
                         const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                         this.utilsService.setTicketSequence(signerListTx, getAccountInfo.result.account_data.Sequence, false);
                    }
                    signerListTx.LastLedgerSequence = currentLedger + AppConstants.LAST_LEDGER_ADD_TIME;
                    console.error(`signerListTx enableMultiSignFlag = N ${JSON.stringify(signerListTx, null, 2)}`);
               }

               if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, signerListTx, fee)) {
                    return this.setError('ERROR: Insufficent XRP to complete transaction');
               }

               this.updateSpinnerMessage('Submitting transaction to the Ledger...');

               const response = await client.submitAndWait(signerListTx, { wallet });
               console.log(`response, ${JSON.stringify(response, null, '\t')}`);
               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    console.error(`Transaction failed: ${JSON.stringify(response, null, 2)}`);
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               if (enableMultiSignFlag === 'Y') {
                    const singerEntriesAccount = wallet.classicAddress + 'signerEntries';
                    this.storageService.set(singerEntriesAccount, signerEntries);
               } else {
                    this.storageService.removeValue('signerEntries');
                    this.signerQuorum = 0;
               }

               this.refreshUiAccountInfo(await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''));
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), wallet);

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

     async setMultiSign1(enableMultiSignFlag: 'Y' | 'N') {
          console.log('Entering setMultiSign');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               this.updateSpinnerMessage('Setting Multi Sign...');

               const fee = await this.xrplService.calculateTransactionFee(client);

               let signerListTx: SignerListSet;
               let signerEntries;
               if (enableMultiSignFlag === 'Y') {
                    // Create array of signer accounts and their weights
                    signerEntries = this.signers
                         .filter(s => s.account && s.weight > 0)
                         .map(s => ({
                              Account: s.account,
                              SignerWeight: Number(s.weight),
                              seed: s.seed,
                         }));

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

                    const singerEntriesAccount = wallet.classicAddress + 'signerEntries';
                    this.storageService.set(singerEntriesAccount, signerEntries);

                    // Format SignerEntries for XRPL transaction
                    const formattedSignerEntries = signerEntries.map(entry => ({
                         SignerEntry: {
                              Account: entry.Account,
                              SignerWeight: entry.SignerWeight,
                         },
                    }));

                    const currentLedger = await this.xrplService.getLastLedgerIndex(client);

                    signerListTx = await client.autofill({
                         TransactionType: 'SignerListSet',
                         Account: wallet.classicAddress,
                         SignerQuorum,
                         SignerEntries: formattedSignerEntries,
                         Fee: fee,
                         LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                    });

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
                              this.utilsService.setMemoField(signerListTx, this.memoField);
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
                              this.utilsService.setMemoField(signerListTx, this.memoField);
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
                              this.utilsService.setMemoField(signerListTx, this.memoField);
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
                              this.utilsService.setMemoField(signerListTx, this.memoField);
                         }
                    }
               }

               if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, signerListTx, fee)) {
                    return this.setError('ERROR: Insufficent XRP to complete transaction');
               }

               this.updateSpinnerMessage('Submitting transaction to the Ledger...');

               const response = await client.submitAndWait(signerListTx, { wallet });
               console.log(`response, ${JSON.stringify(response, null, '\t')}`);
               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    console.error(`Transaction failed: ${JSON.stringify(response, null, 2)}`);
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               if (enableMultiSignFlag === 'Y') {
                    const singerEntriesAccount = wallet.classicAddress + 'signerEntries';
                    this.storageService.set(singerEntriesAccount, signerEntries);
               } else {
                    this.storageService.removeValue('signerEntries');
                    this.signerQuorum = 0;
               }

               this.refreshUiAccountInfo(await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''));
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), wallet);

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
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               multiSignAddresses: this.isMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.isMultiSign ? this.multiSignSeeds : undefined,
               regularKeyAccount: this.regularKeyAccount ? this.regularKeyAccount : undefined,
               regularKeyAccountSeeds: this.regularKeyAccountSeed ? this.regularKeyAccountSeed : undefined,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

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
                    this.utilsService.setMemoField(setRegularKeyTx, this.memoField);
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
               console.log('Submit Response:', JSON.stringify(response, null, '\t'));

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

               this.isMemoEnabled = false;
               this.memoField = '';

               // if (enableRegularKeyFlag === 'Y') {
               //      this.storageService.set('regularKey', this.regularKeyAccount);
               //      this.storageService.set('regularKeySeed', this.regularKeyAccountSeed);
               // } else {
               //      this.storageService.removeValue('regularKey');
               //      this.storageService.removeValue('regularKeySeed');
               // }

               const regularKeysAccount = wallet.classicAddress + 'regularKey';
               const regularKeySeedAccount = wallet.classicAddress + 'regularKeySeed';
               if (enableRegularKeyFlag === 'Y') {
                    // this.storageService.set('regularKey', this.regularKeyAccount);
                    // this.storageService.set('regularKeySeed', this.regularKeyAccountSeed);
                    this.storageService.set(regularKeysAccount, this.regularKeyAccount);
                    this.storageService.set(regularKeySeedAccount, this.regularKeyAccountSeed);
               } else {
                    // this.storageService.removeValue('regularKey');
                    // this.storageService.removeValue('regularKeySeed');
                    this.storageService.removeValue(regularKeysAccount);
                    this.storageService.removeValue(regularKeySeedAccount);
               }

               this.refreshUiAccountInfo(await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''));
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), wallet);

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
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
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
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

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
               console.debug(`accountObjects for ${wallet.classicAddress} ${JSON.stringify(accountObjects.result, null, '\t')}`);

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
                    console.debug(`accountInfo for ${authorizedAddress} ${JSON.stringify(accountInfo.result, null, '\t')}`);
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
                         this.utilsService.setMemoField(accountSetTx, this.memoField);
                    }

                    // Check XRP balance for each transaction
                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, accountSetTx, fee)) {
                         return this.setError(`ERROR: Insufficient XRP to complete transaction for ${authorizedAddress}`);
                    }

                    this.updateSpinnerMessage(`Submitting DepositPreauth for ${authorizedAddress} to the Ledger...`);

                    // Submit transaction
                    const response = await client.submitAndWait(accountSetTx, { wallet });
                    console.debug(`response ${wallet.classicAddress} ${JSON.stringify(response, null, '\t')}`);

                    const result = response.result;
                    results.push({ result });

                    // Check transaction result
                    if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                         console.error(`Transaction failed: ${JSON.stringify(response, null, 2)}`);
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

               this.isMemoEnabled = false;
               this.memoField = '';

               this.refreshUiAccountInfo(await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''));
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), wallet);

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
                    const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
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
                    console.log('Tx:', JSON.stringify(tx, null, 2));
                    const preparedTx = await client.autofill(tx);
                    console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                    if (useRegularKeyWalletSignTx) {
                         console.log('Using RegularKey to sign transaction');
                         signedTx = regularKeyWalletSignTx.sign(preparedTx);
                    } else {
                         signedTx = wallet.sign(preparedTx);
                    }
               }

               if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, fee)) {
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

     private checkForSignerAccounts(accountObjects: xrpl.AccountObjectsResponse) {
          const signerAccounts: string[] = [];
          if (accountObjects.result && Array.isArray(accountObjects.result.account_objects)) {
               accountObjects.result.account_objects.forEach(obj => {
                    if (obj.LedgerEntryType === 'SignerList' && Array.isArray(obj.SignerEntries)) {
                         obj.SignerEntries.forEach((entry: any) => {
                              if (entry.SignerEntry && entry.SignerEntry.Account) {
                                   signerAccounts.push(entry.SignerEntry.Account + '~' + entry.SignerEntry.SignerWeight);
                                   this.signerQuorum = obj.SignerQuorum;
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
          this.account1.balance = balance.toString();
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

     refreshUiAccountObjects(accountObjects: any, wallet: any) {
          const signerAccounts: string[] = this.checkForSignerAccounts(accountObjects);
          if (signerAccounts && signerAccounts.length > 0) {
               if (Array.isArray(signerAccounts) && signerAccounts.length > 0) {
                    const singerEntriesAccount = wallet.classicAddress + 'signerEntries';
                    const signerEntries: SignerEntry[] = this.storageService.get(singerEntriesAccount) || [];
                    console.debug(`refreshUiAccountObjects singerEntriesAccount ${wallet.classicAddress} ${JSON.stringify(this.storageService.get(singerEntriesAccount), null, '\t')}`);

                    const addresses = signerEntries.map((item: { Account: any }) => item.Account + ',\n').join('');
                    const seeds = signerEntries.map((item: { seed: any }) => item.seed + ',\n').join('');
                    this.multiSignSeeds = seeds;
                    this.multiSignAddress = addresses;
                    // this.isMultiSign = true;
               }
          } else {
               this.signerQuorum = 0;
               this.multiSignAddress = 'No Multi-Sign address configured for account';
               this.multiSignSeeds = ''; // Clear seeds if no signer accounts
               this.isMultiSign = false;
               this.useMultiSign = false;
               this.storageService.removeValue('signerEntries');
          }

          const preAuthAccounts: string[] = this.utilsService.findDepositPreauthObjects(accountObjects);
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
          const nftTokenMinter = accountInfo?.result?.account_data?.NFTokenMinter;
          if (nftTokenMinter) {
               this.isAuthorizedNFTokenMinter = true;
               this.nfTokenMinterAddress = nftTokenMinter;
          } else {
               this.isAuthorizedNFTokenMinter = false;
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
     }

     async getWallet() {
          const environment = this.xrplService.getNet().environment;
          const seed = this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer);
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

     private async displayDataForAccount(accountKey: 'account1' | 'account2' | 'issuer') {
          const isIssuer = accountKey === 'issuer';
          const prefix = isIssuer ? 'issuer' : accountKey;

          // Define casing differences in keys
          const formatKey = (key: string) => (isIssuer ? `${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}` : `${prefix}${key}`);

          // Fetch stored values
          const name = this.storageService.getInputValue(formatKey('name')) || AppConstants.EMPTY_STRING;
          const address = this.storageService.getInputValue(formatKey('address')) || AppConstants.EMPTY_STRING;
          const seed = this.storageService.getInputValue(formatKey('seed')) || this.storageService.getInputValue(formatKey('mnemonic')) || this.storageService.getInputValue(formatKey('secretNumbers')) || AppConstants.EMPTY_STRING;

          // Update account object
          const accountMap = {
               account1: this.account1,
               account2: this.account2,
               issuer: this.issuer,
          };
          const account = accountMap[accountKey];
          account.name = name;
          account.address = address;
          account.seed = seed;

          // DOM manipulation (map field IDs instead of repeating)
          const fieldMap: Record<'name' | 'address' | 'seed', string> = {
               name: 'accountName1Field',
               address: 'accountAddress1Field',
               seed: 'accountSeed1Field',
          };

          (Object.entries(fieldMap) as [keyof typeof fieldMap, string][]).forEach(([key, id]) => {
               const el = document.getElementById(id) as HTMLInputElement | null;
               if (el) el.value = account[key];
          });

          this.cdr.detectChanges(); // sync with ngModel

          // Fetch account details
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

     clearFields() {
          this.memoField = '';
          this.ticketSequence = '';
          this.isTicket = false;
          this.isMultiSign = false;
          this.useMultiSign = false;
          this.multiSignAddress = '';
          this.isUpdateMetaData = false;
          this.cdr.detectChanges();
     }

     isValidResponse(response: any): response is { success: boolean; message: xrpl.TxResponse<xrpl.SubmittableTransaction> | string } {
          return response && typeof response === 'object' && 'success' in response && 'message' in response;
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
