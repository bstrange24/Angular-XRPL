import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import * as xrpl from 'xrpl';
import { StorageService } from '../../services/storage.service';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';
import { AppWalletDynamicInputComponent } from '../app-wallet-dynamic-input/app-wallet-dynamic-input.component';
import { ClickToCopyService } from '../../services/click-to-copy/click-to-copy.service';

interface ValidationInputs {
     selectedAccount?: string;
     senderAddress?: string;
     account_info?: any;
     seed?: string;
     amount?: string;
     destination?: string;
     mptIssuanceIdField?: string;
     destinationTag?: string;
     tokenCountField?: string;
     assetScaleField?: string;
     transferFeeField?: string;
     isRegularKeyAddress?: boolean;
     regularKeyAddress?: string;
     regularKeySeed?: string;
     useMultiSign?: boolean;
     multiSignSeeds?: string;
     multiSignAddresses?: string;
     isTicket?: boolean;
     selectedSingleTicket?: string;
     selectedTicket?: string;
     signerQuorum?: number;
     signers?: { account: string; weight: number }[];
}

interface AccountFlags {
     isClawback: boolean;
     isLock: boolean;
     isRequireAuth: boolean;
     isTransferable: boolean;
     isTradable: boolean;
     isEscrow: boolean;
}

@Component({
     selector: 'app-mpt-send',
     standalone: true,
     imports: [CommonModule, FormsModule, AppWalletDynamicInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './mpt-send.component.html',
     styleUrl: './mpt-send.component.css',
})
export class MptSendComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     @ViewChild('accountForm') accountForm!: NgForm;
     lastResult: string = '';
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = false;
     ticketSequence: string = '';
     isTicket: boolean = false;
     isTicketEnabled: boolean = false;
     ticketArray: string[] = [];
     selectedTickets: string[] = [];
     selectedSingleTicket: string = '';
     multiSelectMode: boolean = false;
     selectedTicket: string = '';
     ownerCount: string = '';
     totalXrpReserves: string = '';
     executionTime: string = '';
     destinationTagField: string = '';
     useMultiSign: boolean = false;
     multiSignAddress: string = '';
     multiSignSeeds: string = '';
     signerQuorum: number = 0;
     metaDataField: string = '';
     mptIssuanceIdField: string = '';
     tokenCountField: string = '';
     assetScaleField: string = '';
     isdepositAuthAddress: boolean = false;
     isMptFlagModeEnabled: boolean = false;
     depositAuthAddress: string = '';
     isMessageKey: boolean = false;
     transferFeeField: string = '';
     memoField: string = '';
     isMemoEnabled: boolean = false;
     isRegularKeyAddress: boolean = false;
     regularKeySeed: string = '';
     regularKeyAddress: string = '';
     multiSigningEnabled: boolean = false;
     regularKeySigningEnabled: boolean = false;
     amountField: string = '';
     spinnerMessage: string = '';
     isSimulateEnabled: boolean = false;
     masterKeyDisabled: boolean = false;
     flags: AccountFlags = {
          isClawback: false,
          isLock: false,
          isRequireAuth: false,
          isTransferable: false,
          isTradable: false,
          isEscrow: false,
     };
     spinner: boolean = false;
     destinationFields: string = '';
     destinations: { name?: string; address: string }[] = [];
     signers: { account: string; seed: string; weight: number }[] = [{ account: '', seed: '', weight: 1 }];
     isAuthorized: boolean = false;
     isUnauthorize: boolean = false;
     wallets: any[] = [];
     selectedWalletIndex: number = 0;
     currentWallet = { name: '', address: '', seed: '', balance: '' };

     constructor(private readonly xrplService: XrplService, private readonly utilsService: UtilsService, private readonly cdr: ChangeDetectorRef, private readonly storageService: StorageService, private readonly renderUiComponentsService: RenderUiComponentsService, private readonly xrplTransactions: XrplTransactionService, private readonly clickToCopyService: ClickToCopyService) {}

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
               this.updateDestinations();
               this.ensureDefaultNotSelected();
               this.getMptDetails();
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
               if (!this.useMultiSign) {
                    this.utilsService.clearSignerList(this.signers);
               } else {
                    const wallet = await this.getWallet();
                    this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
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

     toggleTicketSequence() {
          this.cdr.detectChanges();
     }

     onTicketToggle(event: any, ticket: string) {
          if (event.target.checked) {
               this.selectedTickets = [...this.selectedTickets, ticket];
          } else {
               this.selectedTickets = this.selectedTickets.filter(t => t !== ticket);
          }
     }

     async getMptDetails() {
          console.log('Entering getMptDetails');
          const startTime = Date.now();
          this.setSuccessProperties();
          this.updateSpinnerMessage(``);

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }
               this.updateSpinnerMessage('Getting MPT Details...');

               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const [accountInfo, accountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
               this.utilsService.logAccountInfoObjects(accountInfo, accountObjects);

               const inputs: ValidationInputs = {
                    seed: this.currentWallet.seed,
                    account_info: accountInfo,
               };

               const errors = await this.validateInputs(inputs, 'get');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               // Prepare data structure
               const data = {
                    sections: [{}],
               };

               // Filter MPT-related objects
               const mptObjects = accountObjects.result.account_objects.filter((obj: any) => obj.LedgerEntryType === 'MPTokenIssuance' || obj.LedgerEntryType === 'MPToken');
               console.debug(`mptObjects:`, mptObjects);
               if (mptObjects.length <= 0) {
                    data.sections.push({
                         title: 'MPT Tokens',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No MPT tokens found for <code>${wallet.classicAddress}</code>` }],
                    });
               } else {
                    // Sort by Sequence (oldest first)
                    const sortedMPT = [...mptObjects].sort((a, b) => {
                         const seqA = (a as any).Sequence ?? Number.MAX_SAFE_INTEGER;
                         const seqB = (b as any).Sequence ?? Number.MAX_SAFE_INTEGER;
                         return seqA - seqB;
                    });

                    data.sections.push({
                         title: `MPT Token (${mptObjects.length})`,
                         openByDefault: true,
                         subItems: sortedMPT.map((mpt, counter) => {
                              const { LedgerEntryType, PreviousTxnID, index } = mpt;
                              // TicketSequence and Flags may not exist on all AccountObject types
                              const ticketSequence = (mpt as any).TicketSequence;
                              const flags = (mpt as any).Flags;
                              const mptIssuanceId = (mpt as any).mpt_issuance_id || (mpt as any).MPTokenIssuanceID;
                              return {
                                   key: `MPT ${counter + 1} (ID: ${mptIssuanceId.slice(0, 10)}...)`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Ledger Entry Type', value: LedgerEntryType },
                                        { key: 'MPT Issuance ID', value: `<code>${mptIssuanceId}</code>` },
                                        // { key: 'Previous Txn ID', value: `<code>${PreviousTxnID}</code>` },
                                        ...(ticketSequence ? [{ key: 'Ticket Sequence', value: String(ticketSequence) }] : []),
                                        ...(flags !== undefined ? [{ key: 'Flags', value: this.utilsService.getMptFlagsReadable(Number(flags)) }] : []),
                                        // Optionally display custom fields if present
                                        ...((mpt as any)['MPTAmount'] ? [{ key: 'MPTAmount', value: String((mpt as any)['MPTAmount']) }] : []),
                                        ...((mpt as any)['MPTokenMetadata'] ? [{ key: 'MPTokenMetadata', value: xrpl.convertHexToString((mpt as any)['MPTokenMetadata']) }] : []),
                                        ...((mpt as any)['MaximumAmount'] ? [{ key: 'MaximumAmount', value: String((mpt as any)['MaximumAmount']) }] : []),
                                        ...((mpt as any)['OutstandingAmount'] ? [{ key: 'OutstandingAmount', value: String((mpt as any)['OutstandingAmount']) }] : []),
                                        ...((mpt as any)['TransferFee'] ? [{ key: 'TransferFee', value: (Number((mpt as any)['TransferFee']) / 1000).toFixed(3) + ' %' }] : []),
                                        // ...((mpt as any)['MPTIssuanceID'] ? [{ key: 'MPTIssuanceID', value: String((mpt as any)['MPTIssuanceID']) }] : []),
                                   ],
                              };
                         }),
                    });
               }

               // Render immediately
               this.renderUiComponentsService.renderDetails(data);
               this.setSuccess(this.result);
               this.clickToCopyService.attachCopy(this.resultField.nativeElement);

               // DEFER: Non-critical UI updates — let main render complete first
               setTimeout(async () => {
                    try {
                         this.refreshUIData(wallet, accountInfo, accountObjects);
                         this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
                         this.clearFields(false);
                         this.updateTickets(accountObjects);
                         await this.updateXrpBalance(client, accountInfo, wallet);
                    } catch (err) {
                         console.error('Error in deferred UI updates for MPT:', err);
                    }
               }, 0);
          } catch (error: any) {
               console.error('Error in getMptDetails:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getMptDetails in ${this.executionTime}ms`);
          }
     }

     async authorizeMpt(authorizeFlag: 'Y' | 'N') {
          console.log('Entering authorizeMpt');
          const startTime = Date.now();
          this.setSuccessProperties();
          this.updateSpinnerMessage(``);

          const inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
               senderAddress: this.currentWallet.address,
               destination: this.isAuthorized ? undefined : this.destinationFields,
               mptIssuanceIdField: this.mptIssuanceIdField,
               isRegularKeyAddress: this.isRegularKeyAddress,
               regularKeyAddress: this.isRegularKeyAddress ? this.regularKeyAddress : undefined,
               regularKeySeed: this.isRegularKeyAddress ? this.regularKeySeed : undefined,
               useMultiSign: this.useMultiSign,
               multiSignAddresses: this.useMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.useMultiSign ? this.multiSignSeeds : undefined,
               isTicket: this.isTicket,
               selectedTicket: this.selectedTicket,
               selectedSingleTicket: this.selectedSingleTicket,
          };

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }

               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const [accountInfo, fee, currentLedger, serverInfo] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), this.xrplService.getXrplServerInfo(client, 'current', '')]);
               this.utilsService.logAccountInfoObjects(accountInfo, null);
               this.utilsService.logLedgerObjects(fee, currentLedger, serverInfo);

               inputs.account_info = accountInfo;

               const errors = await this.validateInputs(inputs, 'authorize');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               const mPTokenAuthorizeTx: xrpl.MPTokenAuthorize = {
                    TransactionType: 'MPTokenAuthorize',
                    Account: wallet.address,
                    MPTokenIssuanceID: this.mptIssuanceIdField,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                    Fee: fee,
               };

               if (authorizeFlag === 'N') {
                    mPTokenAuthorizeTx.Flags = xrpl.MPTokenAuthorizeFlags.tfMPTUnauthorize;
               }

               await this.setTxOptionalFields(client, mPTokenAuthorizeTx, wallet, accountInfo, 'generate');

               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, mPTokenAuthorizeTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating MPT Authorize (no changes will be made)...' : 'Submitting MPT Authorize to Ledger...');

               let response: any;

               if (this.isSimulateEnabled) {
                    response = await this.xrplTransactions.simulateTransaction(client, mPTokenAuthorizeTx);
               } else {
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    const signedTx = await this.xrplTransactions.signTransaction(client, wallet, mPTokenAuthorizeTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

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
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving authorizeMpt in ${this.executionTime}ms`);
          }
     }

     async sendMpt() {
          console.log('Entering sendMpt');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
               senderAddress: this.currentWallet.address,
               amount: this.amountField,
               destination: this.destinationFields,
               destinationTag: this.destinationTagField,
               mptIssuanceIdField: this.mptIssuanceIdField,
               isRegularKeyAddress: this.isRegularKeyAddress,
               regularKeyAddress: this.isRegularKeyAddress ? this.regularKeyAddress : undefined,
               regularKeySeed: this.isRegularKeyAddress ? this.regularKeySeed : undefined,
               useMultiSign: this.useMultiSign,
               multiSignAddresses: this.useMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.useMultiSign ? this.multiSignSeeds : undefined,
               isTicket: this.isTicket,
               selectedTicket: this.selectedTicket,
               selectedSingleTicket: this.selectedSingleTicket,
          };

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }

               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const [accountInfo, accountObjects, destObjects, fee, currentLedger, serverInfo] = await Promise.all([
                    this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''),
                    this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''),
                    this.xrplService.getAccountObjects(client, this.destinationFields, 'validated', ''),
                    this.xrplService.calculateTransactionFee(client),
                    this.xrplService.getLastLedgerIndex(client),
                    this.xrplService.getXrplServerInfo(client, 'current', ''),
               ]);
               this.utilsService.logAccountInfoObjects(accountInfo, accountObjects);
               this.utilsService.logObjects('destObjects', destObjects);
               this.utilsService.logLedgerObjects(fee, currentLedger, serverInfo);

               inputs.account_info = accountInfo;

               const errors = await this.validateInputs(inputs, 'send');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               // Check if destination can hold the MPT
               if (!destObjects?.result?.account_objects) {
                    return this.setError(`ERROR: Unable to fetch account objects for destination ${this.destinationFields}`);
               }

               const walletMptTokens = accountObjects.result.account_objects.filter((obj: any) => obj.LedgerEntryType === 'MPTokenIssuance');
               console.debug(`Wallet MPT Tokens:`, walletMptTokens);
               console.debug('MPT Issuance ID:', this.mptIssuanceIdField);
               const walletMptToken = walletMptTokens.find((obj: any) => obj.mpt_issuance_id === this.mptIssuanceIdField);

               const mptTokens = destObjects.result.account_objects.filter((obj: any) => obj.LedgerEntryType === 'MPToken');
               console.debug(`Destination MPT Tokens:`, mptTokens);
               console.debug('MPT Issuance ID:', this.mptIssuanceIdField);
               const authorized = mptTokens.some((obj: any) => obj.MPTokenIssuanceID === this.mptIssuanceIdField);

               if (!authorized) {
                    return this.setError(`ERROR: Destination ${this.destinationFields} is not authorized to receive this MPT (issuance ID ${this.mptIssuanceIdField}). Please ensure authorization has been completed.`);
               }

               if (walletMptToken) {
                    const decodedFlags = this.decodeMPTFlags((walletMptToken as any).Flags);
                    const authorized = decodedFlags.some((obj: any) => obj.MPTokenIssuanceID === 'tfMPTRequireAuth');
                    if (authorized) {
                         // Since no specific authorized flag on MPToken, assume existence after proper auth process suffices
                         // If needed, user can rely on simulation or submission error
                         console.warn('MPT requires authorization; assuming existence of MPToken entry indicates approval.');
                    }
               }

               const sendMptPaymentTx: xrpl.Payment = {
                    TransactionType: 'Payment',
                    Account: wallet.classicAddress,
                    Amount: {
                         mpt_issuance_id: this.mptIssuanceIdField,
                         value: this.amountField,
                    },
                    Destination: this.destinationFields,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                    Fee: fee,
               };

               await this.setTxOptionalFields(client, sendMptPaymentTx, wallet, accountInfo, 'send');

               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, sendMptPaymentTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Sending MPT (no changes will be made)...' : 'Submitting Send MPT to Ledger...');

               let response: any;

               if (this.isSimulateEnabled) {
                    response = await this.xrplTransactions.simulateTransaction(client, sendMptPaymentTx);
               } else {
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    const signedTx = await this.xrplTransactions.signTransaction(client, wallet, sendMptPaymentTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

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
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving sendMpt in ${this.executionTime}ms`);
          }
     }

     decodeMPTFlags(flags: number) {
          const MPT_FLAGS = {
               tfMPTCanLock: 0x00000002,
               tfMPTCanEscrow: 0x00000004,
               tfMPTCanTrade: 0x00000008,
               tfMPTCanClawback: 0x00000010,
               tfMPTRequireAuth: 0x00000020,
               tfMPTImmutable: 0x00000040,
               tfMPTDisallowIncoming: 0x00000080,
          };

          const activeFlags = [];
          for (const [name, value] of Object.entries(MPT_FLAGS)) {
               if ((flags & value) !== 0) {
                    activeFlags.push(name);
               }
          }
          return activeFlags;
     }

     private renderTransactionResult(response: any): void {
          if (this.isSimulateEnabled) {
               this.renderUiComponentsService.renderSimulatedTransactionsResults(response, this.resultField.nativeElement);
          } else {
               console.debug(`Response`, response);
               this.renderUiComponentsService.renderTransactionsResults(response, this.resultField.nativeElement);
          }
          this.clickToCopyService.attachCopy(this.resultField.nativeElement);
     }

     private async setTxOptionalFields(client: xrpl.Client, mptTx: any, wallet: xrpl.Wallet, accountInfo: any, txType: string) {
          if (this.selectedSingleTicket) {
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.selectedSingleTicket));
               if (!ticketExists) {
                    return this.setError(`ERROR: Ticket Sequence ${this.selectedSingleTicket} not found for account ${wallet.classicAddress}`);
               }
               this.utilsService.setTicketSequence(mptTx, this.selectedSingleTicket, true);
          } else {
               if (this.multiSelectMode && this.selectedTickets.length > 0) {
                    console.log('Setting multiple tickets:', this.selectedTickets);
                    this.utilsService.setTicketSequence(mptTx, accountInfo.result.account_data.Sequence, false);
               }
          }

          if (this.memoField) {
               this.utilsService.setMemoField(mptTx, this.memoField);
          }
     }

     private refreshUIData(wallet: xrpl.Wallet, updatedAccountInfo: any, updatedAccountObjects: xrpl.AccountObjectsResponse) {
          this.utilsService.logAccountInfoObjects(updatedAccountInfo, updatedAccountObjects);

          this.refreshUiAccountObjects(updatedAccountObjects, updatedAccountInfo, wallet);
          this.refreshUiAccountInfo(updatedAccountInfo);
     }

     private checkForSignerAccounts(accountObjects: xrpl.AccountObjectsResponse): string[] {
          const accountObjectsArray = accountObjects.result?.account_objects;
          if (!Array.isArray(accountObjectsArray)) return [];

          const signerAccounts: string[] = [];

          for (const obj of accountObjectsArray) {
               if (obj.LedgerEntryType === 'SignerList' && Array.isArray(obj.SignerEntries)) {
                    // Set quorum once
                    if (obj.SignerQuorum !== undefined) {
                         this.signerQuorum = obj.SignerQuorum;
                    }

                    for (const entry of obj.SignerEntries) {
                         const account = entry.SignerEntry?.Account;
                         if (account) {
                              signerAccounts.push(`${account}~${entry.SignerEntry.SignerWeight ?? ''}`);
                         }
                    }
               }
          }

          return signerAccounts;
     }

     private getAccountTickets(accountObjects: xrpl.AccountObjectsResponse): string[] {
          const objects = accountObjects.result?.account_objects;
          if (!Array.isArray(objects)) return [];

          const tickets = objects.reduce((acc: number[], obj) => {
               if (obj.LedgerEntryType === 'Ticket' && typeof obj.TicketSequence === 'number') {
                    acc.push(obj.TicketSequence);
               }
               return acc;
          }, []);

          return tickets.sort((a, b) => a - b).map(String);
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

     private async updateXrpBalance(client: xrpl.Client, accountInfo: xrpl.AccountInfoResponse, wallet: xrpl.Wallet) {
          const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, accountInfo, wallet.classicAddress);

          this.ownerCount = ownerCount;
          this.totalXrpReserves = totalXrpReserves;

          const balance = (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0');
          this.currentWallet.balance = balance.toString();
     }

     public refreshUiAccountObjects(accountObjects: xrpl.AccountObjectsResponse, accountInfo: xrpl.AccountInfoResponse, wallet: xrpl.Wallet): void {
          // Tickets
          this.ticketArray = this.getAccountTickets(accountObjects);
          this.selectedTicket = this.ticketArray[0] || this.selectedTicket;

          // Signer accounts
          const signerAccounts = this.checkForSignerAccounts(accountObjects);
          const hasSignerAccounts = signerAccounts?.length > 0;

          if (hasSignerAccounts) {
               const signerEntries = this.storageService.get(`${wallet.classicAddress}signerEntries`) || [];
               this.multiSignAddress = signerEntries.map((e: { Account: any }) => e.Account).join(',\n');
               this.multiSignSeeds = signerEntries.map((e: { seed: any }) => e.seed).join(',\n');
          } else {
               this.signerQuorum = 0;
               this.multiSignAddress = 'No Multi-Sign address configured for account';
               this.multiSignSeeds = '';
               this.storageService.removeValue('signerEntries');
          }

          // Boolean flags
          this.multiSigningEnabled = hasSignerAccounts;
          this.useMultiSign = false;
          this.masterKeyDisabled = Boolean(accountInfo?.result?.account_flags?.disableMasterKey);

          this.clearFields(false);
     }

     public refreshUiAccountInfo(accountInfo: xrpl.AccountInfoResponse): void {
          const accountData = accountInfo?.result?.account_data;
          if (!accountData) return;

          const regularKey = accountData.RegularKey;
          const isMasterKeyDisabled = accountInfo?.result?.account_flags?.disableMasterKey ?? false;

          // Set regular key properties
          this.setRegularKeyProperties(regularKey, accountData.Account);

          // Set master key property
          this.masterKeyDisabled = isMasterKeyDisabled;

          // Set regular key signing enabled flag
          this.regularKeySigningEnabled = !!regularKey;
     }

     private setRegularKeyProperties(regularKey: string | undefined, account: string): void {
          if (regularKey) {
               this.regularKeyAddress = regularKey;
               this.regularKeySeed = this.storageService.get(`${account}regularKeySeed`) || '';
          } else {
               this.regularKeyAddress = 'No RegularKey configured for account';
               this.regularKeySeed = '';
               this.isRegularKeyAddress = false;
          }
     }

     private async validateInputs(inputs: ValidationInputs, action: string): Promise<string[]> {
          const errors: string[] = [];

          // --- Common validators ---
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

          const isNotSelfPayment = (sender: string | undefined, receiver: string | undefined): string | null => {
               if (sender && receiver && sender === receiver) {
                    return `Sender and receiver cannot be the same`;
               }
               return null;
          };

          const isValidNumber = (value: string | undefined, fieldName: string, minValue?: number, maxValue?: number, allowEmpty: boolean = false): string | null => {
               if (value === undefined || (allowEmpty && value === '')) return null; // Skip if undefined or empty (when allowed)
               const num = parseFloat(value);
               if (isNaN(num) || !isFinite(num)) {
                    return `${fieldName} must be a valid number`;
               }
               if (minValue !== undefined && num < minValue) {
                    return `${fieldName} must be greater than or equal to ${minValue}`;
               }
               if (maxValue !== undefined && num > maxValue) {
                    return `${fieldName} must be less than or equal to ${maxValue}`;
               }
               return null;
          };

          const isValidSeed = (value: string | undefined): string | null => {
               if (value) {
                    const { value: detectedValue } = this.utilsService.detectXrpInputType(value);
                    if (detectedValue === 'unknown') {
                         return 'Account seed is invalid';
                    }
               }
               return null;
          };

          const validateMultiSign = (addressesStr: string | undefined, seedsStr: string | undefined): string | null => {
               if (!addressesStr || !seedsStr) return null;
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
               const invalidSeed = seeds.find((seed: string) => !xrpl.isValidSecret(seed));
               if (invalidSeed) {
                    return 'One or more signer seeds are invalid';
               }
               return null;
          };

          // --- Async validator: check if destination account requires a destination tag ---
          const checkDestinationTagRequirement = async (): Promise<string | null> => {
               if (!inputs.destination) return null; // Skip if no destination provided
               try {
                    const client = await this.xrplService.getClient();
                    const accountInfo = await this.xrplService.getAccountInfo(client, inputs.destination, 'validated', '');
                    if (accountInfo.result.account_flags.requireDestinationTag && (!inputs.destinationTag || inputs.destinationTag.trim() === '')) {
                         return `ERROR: Receiver requires a Destination Tag for payment`;
                    }
               } catch (err) {
                    console.error('Failed to check destination tag requirement:', err);
                    return `Could not validate destination account`;
               }
               return null;
          };

          // --- Action-specific config ---
          const actionConfig: Record<
               string,
               {
                    required: (keyof ValidationInputs)[];
                    customValidators?: (() => string | null)[];
                    asyncValidators?: (() => Promise<string | null>)[];
               }
          > = {
               get: {
                    required: ['seed'],
                    customValidators: [() => isValidSeed(inputs.seed)],
                    asyncValidators: [],
               },
               generate: {
                    required: ['seed'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.assetScaleField, 'Asset scale', 0, 15),
                         () => isValidNumber(inputs.transferFeeField, 'Transfer fee', 0, 50000),
                         () => isValidNumber(inputs.tokenCountField, 'Token count', 0),
                         // () => isNotSelfPayment(inputs.senderAddress, inputs.destination),
                         () => (inputs.isTicket ? isRequired(inputs.selectedSingleTicket, 'Ticket Sequence') : null),
                         () => (inputs.isTicket ? isValidNumber(inputs.selectedSingleTicket, 'Ticket Sequence', 0) : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                         () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                         () => (inputs.account_info.result.account_flags.disableMasterKey && !inputs.useMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                    ],
                    asyncValidators: [checkDestinationTagRequirement],
               },
               authorize: {
                    required: ['seed', 'mptIssuanceIdField'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isRequired(inputs.mptIssuanceIdField, 'MPT Issuance ID'),
                         () => (!this.isAuthorized ? isRequired(inputs.destination, 'Holder Address') : null),
                         () => (!this.isAuthorized ? isValidXrpAddress(inputs.destination, 'Holder Address') : null),
                         () => isNotSelfPayment(inputs.senderAddress, inputs.destination),
                         () => (inputs.isTicket ? isRequired(inputs.selectedSingleTicket, 'Ticket Sequence') : null),
                         () => (inputs.isTicket ? isValidNumber(inputs.selectedSingleTicket, 'Ticket Sequence', 0) : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                         () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                         () => (inputs.account_info.result.account_flags.disableMasterKey && !inputs.useMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                    ],
                    asyncValidators: [checkDestinationTagRequirement],
               },
               send: {
                    required: ['seed', 'amount', 'destination', 'mptIssuanceIdField'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.amount, 'Amount', 0),
                         () => isValidXrpAddress(inputs.destination, 'Destination address'),
                         () => isRequired(inputs.mptIssuanceIdField, 'MPT Issuance ID'),
                         () => isValidNumber(inputs.destinationTag, 'Destination Tag', 0, undefined, true), // Allow empty
                         () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                         () => isNotSelfPayment(inputs.senderAddress, inputs.destination),
                         () => (inputs.isTicket ? isRequired(inputs.selectedSingleTicket, 'Ticket Sequence') : null),
                         () => (inputs.isTicket ? isValidNumber(inputs.selectedSingleTicket, 'Ticket Sequence', 0) : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                         () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                         () => (inputs.account_info.result.account_flags.disableMasterKey && !inputs.useMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                    ],
                    asyncValidators: [checkDestinationTagRequirement],
               },
               delete: {
                    required: ['seed', 'mptIssuanceIdField'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isRequired(inputs.mptIssuanceIdField, 'MPT Issuance ID'),
                         () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                         () => (inputs.isTicket ? isRequired(inputs.selectedSingleTicket, 'Ticket Sequence') : null),
                         () => (inputs.isTicket ? isValidNumber(inputs.selectedSingleTicket, 'Ticket Sequence', 0) : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                         () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                         () => (inputs.account_info.result.account_flags.disableMasterKey && !inputs.useMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                    ],
                    asyncValidators: [],
               },
               setMptLocked: {
                    required: ['seed', 'mptIssuanceIdField'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isRequired(inputs.mptIssuanceIdField, 'MPT Issuance ID'),
                         () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                         () => (inputs.isTicket ? isRequired(inputs.selectedSingleTicket, 'Ticket Sequence') : null),
                         () => (inputs.isTicket ? isValidNumber(inputs.selectedSingleTicket, 'Ticket Sequence', 0) : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                         () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                         () => (inputs.account_info.result.account_flags.disableMasterKey && !inputs.useMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                    ],
                    asyncValidators: [],
               },
               default: { required: [], customValidators: [], asyncValidators: [] },
          };

          const config = actionConfig[action] || actionConfig['default'];

          // --- Run required checks ---
          config.required.forEach((field: keyof ValidationInputs) => {
               const err = isRequired(inputs[field], field.charAt(0).toUpperCase() + field.slice(1));
               if (err) errors.push(err);
          });

          // Run custom validators
          config.customValidators?.forEach((validator: () => string | null) => {
               const err = validator();
               if (err) errors.push(err);
          });

          // --- Run async validators ---
          if (config.asyncValidators) {
               for (const validator of config.asyncValidators) {
                    const err = await validator();
                    if (err) errors.push(err);
               }
          }

          // Always validate optional fields if provided (e.g., multi-sign, regular key)
          const multiErr = validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds);
          if (multiErr) errors.push(multiErr);

          const regAddrErr = isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address');
          if (regAddrErr && inputs.regularKeyAddress !== 'No RegularKey configured for account') errors.push(regAddrErr);

          const regSeedErr = isValidSecret(inputs.regularKeySeed, 'Regular Key Seed');
          if (regSeedErr) errors.push(regSeedErr);

          if (errors.length == 0 && inputs.useMultiSign && (inputs.multiSignAddresses === 'No Multi-Sign address configured for account' || inputs.multiSignSeeds === '')) {
               errors.push('At least one signer address is required for multi-signing');
          }

          return errors;
     }

     private async getWallet() {
          const wallet = await this.utilsService.getWallet(this.currentWallet.seed);
          if (!wallet) {
               throw new Error('ERROR: Wallet could not be created or is undefined');
          }
          return wallet;
     }

     updateDestinations() {
          this.destinations = this.wallets.map(w => ({ name: w.name, address: w.address }));
          if (this.destinations.length > 0 && !this.destinationFields) {
               this.destinationFields = this.destinations[0].address;
          }
          this.ensureDefaultNotSelected();
     }

     private ensureDefaultNotSelected() {
          const currentAddress = this.currentWallet.address;
          if (currentAddress && this.destinations.length > 0) {
               if (!this.destinationFields || this.destinationFields === currentAddress) {
                    const nonSelectedDest = this.destinations.find(d => d.address !== currentAddress);
                    this.destinationFields = nonSelectedDest ? nonSelectedDest.address : this.destinations[0].address;
               }
          }
          this.cdr.detectChanges();
     }

     clearFields(clearAllFields: boolean) {
          if (clearAllFields) {
               this.isRegularKeyAddress = false;
               this.isMptFlagModeEnabled = false;
               this.tokenCountField = '';
               this.assetScaleField = '';
               this.transferFeeField = '';
               this.mptIssuanceIdField = '';
               this.metaDataField = '';
               this.amountField = '';
               this.flags.isClawback = false;
               this.flags.isLock = false;
               this.flags.isRequireAuth = false;
               this.flags.isTransferable = false;
               this.flags.isTradable = false;
               this.flags.isEscrow = false;
               this.destinationTagField = '';
               this.isSimulateEnabled = false;
          }

          this.isMemoEnabled = false;
          this.memoField = '';
          this.useMultiSign = false;

          this.isTicket = false;
          this.isTicketEnabled = false;
          this.ticketSequence = '';
          this.cdr.detectChanges();
     }

     private updateSpinnerMessage(message: string) {
          this.spinnerMessage = message;
          this.cdr.detectChanges();
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
          this.cdr.detectChanges();
     }
}
