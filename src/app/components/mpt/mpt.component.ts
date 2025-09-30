import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { WalletMultiInputComponent } from '../wallet-multi-input/wallet-multi-input.component';
import * as xrpl from 'xrpl';
import { StorageService } from '../../services/storage.service';
import { MPTokenIssuanceCreate, MPTokenIssuanceCreateFlags, MPTokenIssuanceSetFlags } from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';

interface ValidationInputs {
     selectedAccount?: 'account1' | 'account2' | 'issuer' | null;
     senderAddress?: string;
     seed?: string;
     account_info?: any;
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
     ticketSequence?: string;
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

@Component({
     selector: 'app-mpt',
     standalone: true,
     imports: [CommonModule, FormsModule, WalletMultiInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './mpt.component.html',
     styleUrl: './mpt.component.css',
})
export class MptComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     @ViewChild('accountForm') accountForm!: NgForm;
     selectedAccount: 'account1' | 'account2' | 'issuer' | null = 'account1';
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
     destinationTagField: string = '';
     ticketSequence: string = '';
     isTicket: boolean = false;
     isTicketEnabled: boolean = false;
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
     private knownDestinations: { [key: string]: string } = {};
     destinations: string[] = [];
     signers: { account: string; seed: string; weight: number }[] = [{ account: '', seed: '', weight: 1 }];
     // MPT_FLAGS: Record<number, string> = {
     //      0x00000001: 'MptLocked',
     //      0x00000002: 'CanLock',
     //      0x00000004: 'RequireAuth',
     //      0x00000008: 'CanEscrow',
     //      0x00000010: 'CanTrade',
     //      0x00000020: 'CanTransfer',
     //      0x00000040: 'CanClawback',
     // };

     constructor(private readonly xrplService: XrplService, private readonly utilsService: UtilsService, private readonly cdr: ChangeDetectorRef, private readonly storageService: StorageService, private readonly renderUiComponentsService: RenderUiComponentsService, private readonly xrplTransactions: XrplTransactionService) {}

     ngOnInit() {
          const storedDestinations = this.storageService.getKnownIssuers('destinations');
          if (storedDestinations) {
               this.knownDestinations = storedDestinations;
          }
          this.onAccountChange();
     }

     async ngAfterViewInit() {
          try {
               const wallet = await this.getWallet();
               this.utilsService.loadSignerList(wallet.classicAddress, this.signers);

               // if (Object.keys(this.knownDestinations).length === 0) {
               this.utilsService.populateKnownDestinations(this.knownDestinations, this.account1.address, this.account2.address, this.issuer.address);
               // }
               this.updateDestinations();
               this.destinationFields = this.issuer.address;
          } catch (error: any) {
               console.error(`No wallet could be created or is undefined ${error.message}`);
               return this.setError('ERROR: Wallet could not be created or is undefined');
          } finally {
               this.cdr.detectChanges();
          }
     }

     ngAfterViewChecked() {
          if (this.result !== this.lastResult && this.resultField?.nativeElement) {
               this.renderUiComponentsService.attachSearchListener(this.resultField.nativeElement);
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
               return this.setError('ERROR getting wallet in toggleMultiSign');
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

     async getMptDetails() {
          console.log('Entering getMptDetails');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount || '', this.account1, this.account2, this.issuer),
          };

          try {
               this.updateSpinnerMessage('Getting MPT Details...');

               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + account objects together
               const [accountInfo, accountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);

               inputs = { ...inputs, account_info: accountInfo };

               const errors = await this.validateInputs(inputs, 'get');
               if (errors.length > 0) {
                    return this.setError(`ERROR: ${errors.join('; ')}`);
               }

               // Optional: Avoid heavy stringify — log only if needed
               console.debug(`account info:`, accountInfo.result);
               console.debug(`accountObjects:`, accountObjects.result);

               // Prepare data structure
               const data = {
                    sections: [{}],
               };

               // Filter MPT-related objects
               const mptObjects = accountObjects.result.account_objects.filter((obj: any) => obj.LedgerEntryType === 'MPTokenIssuance' || obj.LedgerEntryType === 'MPToken');
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
                                   key: `MPT ${counter + 1} (ID: ${index.slice(0, 8)}...)`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'MPT Issuance ID', value: `<code>${mptIssuanceId}</code>` },
                                        { key: 'Ledger Entry Type', value: LedgerEntryType },
                                        { key: 'Previous Txn ID', value: `<code>${PreviousTxnID}</code>` },
                                        ...(ticketSequence ? [{ key: 'Ticket Sequence', value: String(ticketSequence) }] : []),
                                        ...(flags !== undefined ? [{ key: 'Flags', value: this.utilsService.getMptFlagsReadable(Number(flags)) }] : []),
                                        // Optionally display custom fields if present
                                        ...((mpt as any)['MPTAmount'] ? [{ key: 'MPTAmount', value: String((mpt as any)['MPTAmount']) }] : []),
                                        ...((mpt as any)['MPTokenMetadata'] ? [{ key: 'MPTokenMetadata', value: xrpl.convertHexToString((mpt as any)['MPTokenMetadata']) }] : []),
                                        ...((mpt as any)['MaximumAmount'] ? [{ key: 'MaximumAmount', value: String((mpt as any)['MaximumAmount']) }] : []),
                                        ...((mpt as any)['OutstandingAmount'] ? [{ key: 'OutstandingAmount', value: String((mpt as any)['OutstandingAmount']) }] : []),
                                        ...((mpt as any)['TransferFee'] ? [{ key: 'TransferFee', value: String((mpt as any)['TransferFee']) }] : []),
                                        ...((mpt as any)['MPTIssuanceID'] ? [{ key: 'MPTIssuanceID', value: String((mpt as any)['MPTIssuanceID']) }] : []),
                                   ],
                              };
                         }),
                    });
               }

               // CRITICAL: Render immediately
               this.renderUiComponentsService.renderDetails(data);
               this.setSuccess(this.result);

               this.refreshUiAccountObjects(accountObjects, accountInfo, wallet);
               this.refreshUiAccountInfo(accountInfo);

               // DEFER: Non-critical UI updates — let main render complete first
               setTimeout(async () => {
                    try {
                         this.clearFields(false);
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

     async createMpt() {
          console.log('Entering createMpt');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               senderAddress: this.utilsService.getSelectedAddressWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               destination: this.destinationFields,
               assetScaleField: this.assetScaleField,
               transferFeeField: this.flags.isTransferable ? this.transferFeeField : undefined,
               tokenCountField: this.tokenCountField,
               isRegularKeyAddress: this.isRegularKeyAddress,
               regularKeyAddress: this.isRegularKeyAddress ? this.regularKeyAddress : undefined,
               regularKeySeed: this.isRegularKeyAddress ? this.regularKeySeed : undefined,
               useMultiSign: this.useMultiSign,
               multiSignAddresses: this.useMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.useMultiSign ? this.multiSignSeeds : undefined,
               isTicket: this.isTicket,
               ticketSequence: this.isTicket ? this.ticketSequence : undefined,
               // flags: this.flags,
          };

          try {
               this.resultField.nativeElement.innerHTML = '';
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Genrate MPT (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, fee, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client)]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);

               inputs = { ...inputs, account_info: accountInfo };

               const errors = await this.validateInputs(inputs, 'generate');
               if (errors.length > 0) {
                    return this.setError(`ERROR: ${errors.join('; ')}`);
               }

               let v_flags = 0;
               if (this.isMptFlagModeEnabled) {
                    v_flags = this.getFlagsValue(this.flags);
               }

               const mPTokenIssuanceCreateTx: MPTokenIssuanceCreate = {
                    TransactionType: 'MPTokenIssuanceCreate',
                    Account: wallet.classicAddress,
                    // AssetClass: 'CTZMPT',
                    MaximumAmount: this.tokenCountField,
                    Fee: fee,
                    Flags: v_flags,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               if (this.ticketSequence) {
                    const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence));
                    if (!ticketExists) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(mPTokenIssuanceCreateTx, this.ticketSequence, true);
               } else {
                    this.utilsService.setTicketSequence(mPTokenIssuanceCreateTx, accountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(mPTokenIssuanceCreateTx, this.memoField);
               }

               if (this.assetScaleField) {
                    const assetScale = parseInt(this.assetScaleField);
                    if (assetScale < 0 || assetScale > 15) {
                         return this.setError('ERROR: Tick size must be between 3 and 15.');
                    }
                    mPTokenIssuanceCreateTx.AssetScale = assetScale;
               } else {
                    mPTokenIssuanceCreateTx.AssetScale = 0;
               }

               if (this.flags.isTransferable) {
                    if (this.transferFeeField) {
                         if (isNaN(parseInt(this.transferFeeField)) || parseInt(this.transferFeeField) < 0 || parseInt(this.transferFeeField) > 50000) {
                              return this.setError('ERROR: Transfer Fee must be a number between 0 and 50,000.');
                         }
                         mPTokenIssuanceCreateTx.TransferFee = parseInt(this.transferFeeField);
                    } else {
                         mPTokenIssuanceCreateTx.TransferFee = 0;
                    }
               }

               if (this.tokenCountField) {
                    mPTokenIssuanceCreateTx.MaximumAmount = this.tokenCountField;
               } else {
                    mPTokenIssuanceCreateTx.MaximumAmount = '10';
               }

               if (this.metaDataField) {
                    mPTokenIssuanceCreateTx.MPTokenMetadata = xrpl.convertStringToHex(this.metaDataField);
               }

               if (await this.utilsService.isInsufficientXrpBalance(client, accountInfo, '0', wallet.classicAddress, mPTokenIssuanceCreateTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               if (this.isSimulateEnabled) {
                    const simulation = await this.xrplTransactions.simulateTransaction(client, mPTokenIssuanceCreateTx);

                    const isSuccess = this.utilsService.isTxSuccessful(simulation);
                    if (!isSuccess) {
                         const resultMsg = this.utilsService.getTransactionResultMessage(simulation);
                         let userMessage = 'Transaction failed.\n';
                         userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                         (simulation['result'] as any).errorMessage = userMessage;
                         console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, simulation);
                    }

                    // Render result
                    this.renderTransactionResult(simulation);

                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.result);
               } else {
                    // PHASE 5: Get regular key wallet
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    // Sign transaction
                    let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, mPTokenIssuanceCreateTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

                    // PHASE 7: Submit or Simulate
                    this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Generate MPT (no changes will be made)...' : 'Submitting to Ledger...');

                    const response = await this.xrplTransactions.submitTransaction(client, signedTx);

                    const isSuccess = this.utilsService.isTxSuccessful(response);
                    if (!isSuccess) {
                         const resultMsg = this.utilsService.getTransactionResultMessage(response);
                         let userMessage = 'Transaction failed.\n';
                         userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                         (response.result as any).errorMessage = userMessage;
                         console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                    }

                    // Render result
                    this.renderTransactionResult(response);

                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.result);
               }

               //DEFER: Non-critical UI updates (skip for simulation)
               if (!this.isSimulateEnabled) {
                    setTimeout(async () => {
                         try {
                              this.clearFields(false);
                              await this.updateXrpBalance(client, accountInfo, wallet);
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
               console.log(`Leaving createMpt in ${this.executionTime}ms`);
          }
     }

     async mintMpt() {
          console.log('Entering mintMpt');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               senderAddress: this.utilsService.getSelectedAddressWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               destination: this.destinationFields,
               assetScaleField: this.assetScaleField,
               transferFeeField: this.flags.isTransferable ? this.transferFeeField : undefined,
               tokenCountField: this.tokenCountField,
               isRegularKeyAddress: this.isRegularKeyAddress,
               regularKeyAddress: this.isRegularKeyAddress ? this.regularKeyAddress : undefined,
               regularKeySeed: this.isRegularKeyAddress ? this.regularKeySeed : undefined,
               useMultiSign: this.useMultiSign,
               multiSignAddresses: this.useMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.useMultiSign ? this.multiSignSeeds : undefined,
               isTicket: this.isTicket,
               ticketSequence: this.isTicket ? this.ticketSequence : undefined,
               // flags: this.flags,
          };

          try {
               this.resultField.nativeElement.innerHTML = '';
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Genrate MPT (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, fee, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client)]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);

               inputs = {
                    ...inputs,
                    account_info: accountInfo,
               };

               const errors = await this.validateInputs(inputs, 'generate');
               if (errors.length > 0) {
                    return this.setError(`ERROR: ${errors.join('; ')}`);
               }

               let v_flags = 0;
               if (this.isMptFlagModeEnabled) {
                    v_flags = this.getFlagsValue(this.flags);
               }

               const mPTokenMintTx = {
                    TransactionType: 'MPTokenMint', // ✅ Still valid, even if not typed
                    Account: wallet.classicAddress,
                    MPTokenIssuanceID: this.mptIssuanceIdField,
                    Destination: this.destinationFields,
                    Amount: this.tokenCountField,
                    Fee: fee,
               };

               if (this.ticketSequence) {
                    const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence));
                    if (!ticketExists) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(mPTokenMintTx, this.ticketSequence, true);
               } else {
                    this.utilsService.setTicketSequence(mPTokenMintTx, accountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(mPTokenMintTx, this.memoField);
               }

               if (await this.utilsService.isInsufficientXrpBalance(client, accountInfo, '0', wallet.classicAddress, mPTokenMintTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               if (this.isSimulateEnabled) {
                    const simulation = await this.xrplTransactions.simulateTransaction(client, mPTokenMintTx);

                    const isSuccess = this.utilsService.isTxSuccessful(simulation);
                    if (!isSuccess) {
                         const resultMsg = this.utilsService.getTransactionResultMessage(simulation);
                         let userMessage = 'Transaction failed.\n';
                         userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                         (simulation['result'] as any).errorMessage = userMessage;
                         console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, simulation);
                    }

                    // Render result
                    this.renderTransactionResult(simulation);

                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.result);
               } else {
                    // PHASE 5: Get regular key wallet
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    // Sign transaction
                    let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, mPTokenMintTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

                    // PHASE 7: Submit or Simulate
                    this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Generate MPT (no changes will be made)...' : 'Submitting to Ledger...');

                    const response = await this.xrplTransactions.submitTransaction(client, signedTx);

                    const isSuccess = this.utilsService.isTxSuccessful(response);
                    if (!isSuccess) {
                         const resultMsg = this.utilsService.getTransactionResultMessage(response);
                         let userMessage = 'Transaction failed.\n';
                         userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                         (response.result as any).errorMessage = userMessage;
                         console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                    }

                    // Render result
                    this.renderTransactionResult(response);

                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.result);
               }

               //DEFER: Non-critical UI updates (skip for simulation)
               if (!this.isSimulateEnabled) {
                    setTimeout(async () => {
                         try {
                              this.clearFields(false);
                              await this.updateXrpBalance(client, accountInfo, wallet);
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
               console.log(`Leaving mintMpt in ${this.executionTime}ms`);
          }
     }

     async authorizeMpt() {
          console.log('Entering authorizeMpt');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               senderAddress: this.utilsService.getSelectedAddressWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               destination: this.destinationFields,
               mptIssuanceIdField: this.mptIssuanceIdField,
               isRegularKeyAddress: this.isRegularKeyAddress,
               regularKeyAddress: this.isRegularKeyAddress ? this.regularKeyAddress : undefined,
               regularKeySeed: this.isRegularKeyAddress ? this.regularKeySeed : undefined,
               useMultiSign: this.useMultiSign,
               multiSignAddresses: this.useMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.useMultiSign ? this.multiSignSeeds : undefined,
               isTicket: this.isTicket,
               ticketSequence: this.isTicket ? this.ticketSequence : undefined,
          };

          try {
               this.resultField.nativeElement.innerHTML = '';
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Authorize MPT (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, fee, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client)]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);

               inputs = {
                    ...inputs,
                    account_info: accountInfo,
               };

               const errors = await this.validateInputs(inputs, 'authorize');
               if (errors.length > 0) {
                    return this.setError(`ERROR: ${errors.join('; ')}`);
               }

               const mptIssuanceId = this.mptIssuanceIdField;

               const mPTokenAuthorizeTx: xrpl.MPTokenAuthorize = {
                    TransactionType: 'MPTokenAuthorize',
                    Account: wallet.address,
                    MPTokenIssuanceID: mptIssuanceId,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                    Fee: fee,
               };

               if (this.ticketSequence) {
                    const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence));
                    if (!ticketExists) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(mPTokenAuthorizeTx, this.ticketSequence, true);
               } else {
                    this.utilsService.setTicketSequence(mPTokenAuthorizeTx, accountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(mPTokenAuthorizeTx, this.memoField);
               }

               if (await this.utilsService.isInsufficientXrpBalance(client, accountInfo, '0', wallet.classicAddress, mPTokenAuthorizeTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               if (this.isSimulateEnabled) {
                    const simulation = await this.xrplTransactions.simulateTransaction(client, mPTokenAuthorizeTx);

                    const isSuccess = this.utilsService.isTxSuccessful(simulation);
                    if (!isSuccess) {
                         const resultMsg = this.utilsService.getTransactionResultMessage(simulation);
                         let userMessage = 'Transaction failed.\n';
                         userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                         (simulation['result'] as any).errorMessage = userMessage;
                         console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, simulation);
                    }

                    // Render result
                    this.renderTransactionResult(simulation);

                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.result);
               } else {
                    // PHASE 5: Get regular key wallet
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    // Sign transaction
                    let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, mPTokenAuthorizeTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

                    // PHASE 7: Submit or Simulate
                    this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating MPT Authorize (no changes will be made)...' : 'Submitting to Ledger...');

                    const response = await this.xrplTransactions.submitTransaction(client, signedTx);

                    const isSuccess = this.utilsService.isTxSuccessful(response);
                    if (!isSuccess) {
                         const resultMsg = this.utilsService.getTransactionResultMessage(response);
                         let userMessage = 'Transaction failed.\n';
                         userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                         (response.result as any).errorMessage = userMessage;
                         console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                    }

                    // Render result
                    this.renderTransactionResult(response);

                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.result);
               }

               //DEFER: Non-critical UI updates (skip for simulation)
               if (!this.isSimulateEnabled) {
                    setTimeout(async () => {
                         try {
                              this.clearFields(false);
                              await this.updateXrpBalance(client, accountInfo, wallet);
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

     async transferMpt() {
          console.log('Entering transferMpt');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               senderAddress: this.utilsService.getSelectedAddressWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               destination: this.destinationFields,
               assetScaleField: this.assetScaleField,
               transferFeeField: this.flags.isTransferable ? this.transferFeeField : undefined,
               tokenCountField: this.tokenCountField,
               isRegularKeyAddress: this.isRegularKeyAddress,
               regularKeyAddress: this.isRegularKeyAddress ? this.regularKeyAddress : undefined,
               regularKeySeed: this.isRegularKeyAddress ? this.regularKeySeed : undefined,
               useMultiSign: this.useMultiSign,
               multiSignAddresses: this.useMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.useMultiSign ? this.multiSignSeeds : undefined,
               isTicket: this.isTicket,
               ticketSequence: this.isTicket ? this.ticketSequence : undefined,
          };

          try {
               this.resultField.nativeElement.innerHTML = '';
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Genrate MPT (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, fee, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client)]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);

               inputs = {
                    ...inputs,
                    account_info: accountInfo,
               };

               const errors = await this.validateInputs(inputs, 'generate');
               if (errors.length > 0) {
                    return this.setError(`ERROR: ${errors.join('; ')}`);
               }

               let v_flags = 0;
               if (this.isMptFlagModeEnabled) {
                    v_flags = this.getFlagsValue(this.flags);
               }

               const mptTransferTx = {
                    TransactionType: 'MPTokenTransfer', // ✅ Still works!
                    Account: wallet.classicAddress,
                    MPTokenIssuanceID: this.mptIssuanceIdField,
                    Destination: this.destinationFields,
                    Amount: this.amountField,
                    Fee: fee,
               };

               if (this.ticketSequence) {
                    const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence));
                    if (!ticketExists) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(mptTransferTx, this.ticketSequence, true);
               } else {
                    this.utilsService.setTicketSequence(mptTransferTx, accountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(mptTransferTx, this.memoField);
               }

               if (await this.utilsService.isInsufficientXrpBalance(client, accountInfo, '0', wallet.classicAddress, mptTransferTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               if (this.isSimulateEnabled) {
                    const simulation = await this.xrplTransactions.simulateTransaction(client, mptTransferTx);

                    const isSuccess = this.utilsService.isTxSuccessful(simulation);
                    if (!isSuccess) {
                         const resultMsg = this.utilsService.getTransactionResultMessage(simulation);
                         let userMessage = 'Transaction failed.\n';
                         userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                         (simulation['result'] as any).errorMessage = userMessage;
                         console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, simulation);
                    }

                    // Render result
                    this.renderTransactionResult(simulation);

                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.result);
               } else {
                    // PHASE 5: Get regular key wallet
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    // Sign transaction
                    let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, mptTransferTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

                    // PHASE 7: Submit or Simulate
                    this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Generate MPT (no changes will be made)...' : 'Submitting to Ledger...');

                    const response = await this.xrplTransactions.submitTransaction(client, signedTx);

                    const isSuccess = this.utilsService.isTxSuccessful(response);
                    if (!isSuccess) {
                         const resultMsg = this.utilsService.getTransactionResultMessage(response);
                         let userMessage = 'Transaction failed.\n';
                         userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                         (response.result as any).errorMessage = userMessage;
                         console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                    }

                    // Render result
                    this.renderTransactionResult(response);

                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.result);
               }

               //DEFER: Non-critical UI updates (skip for simulation)
               if (!this.isSimulateEnabled) {
                    setTimeout(async () => {
                         try {
                              this.clearFields(false);
                              await this.updateXrpBalance(client, accountInfo, wallet);
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
               console.log(`Leaving transferMpt in ${this.executionTime}ms`);
          }
     }

     async sendMpt() {
          console.log('Entering sendMpt');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               senderAddress: this.utilsService.getSelectedAddressWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
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
               ticketSequence: this.isTicket ? this.ticketSequence : undefined,
          };

          try {
               this.resultField.nativeElement.innerHTML = '';
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Send MPT (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, destObjects, fee, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, this.destinationFields, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client)]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`destObjects for ${wallet.classicAddress}:`, destObjects.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);

               inputs = {
                    ...inputs,
                    account_info: accountInfo,
               };

               const errors = await this.validateInputs(inputs, 'send');
               if (errors.length > 0) {
                    return this.setError(`ERROR: ${errors.join('; ')}`);
               }

               // Check if destination can hold the MPT
               if (!destObjects || !destObjects.result || !destObjects.result.account_objects) {
                    return this.setError(`ERROR: Unable to fetch account objects for destination ${this.destinationFields}`);
               }
               const mptTokens = destObjects.result.account_objects.filter((obj: any) => obj.LedgerEntryType === 'MPToken');
               console.debug(`Destination MPT Tokens:`, mptTokens);
               console.debug('MPT Issuance ID:', this.mptIssuanceIdField);

               const authorized = mptTokens.some((obj: any) => obj.MPTokenIssuanceID === this.mptIssuanceIdField);

               if (!authorized) {
                    return this.setError(`ERROR: Destination ${this.destinationFields} is not authorized to receive this MPT (issuance ID ${this.mptIssuanceIdField}).`);
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

               if (this.ticketSequence) {
                    const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence));
                    if (!ticketExists) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(sendMptPaymentTx, this.ticketSequence, true);
               } else {
                    this.utilsService.setTicketSequence(sendMptPaymentTx, accountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(sendMptPaymentTx, this.memoField);
               }

               if (await this.utilsService.isInsufficientXrpBalance(client, accountInfo, '0', wallet.classicAddress, sendMptPaymentTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               if (this.isSimulateEnabled) {
                    const simulation = await this.xrplTransactions.simulateTransaction(client, sendMptPaymentTx);

                    const isSuccess = this.utilsService.isTxSuccessful(simulation);
                    if (!isSuccess) {
                         const resultMsg = this.utilsService.getTransactionResultMessage(simulation);
                         let userMessage = 'Transaction failed.\n';
                         userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                         (simulation['result'] as any).errorMessage = userMessage;
                         console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, simulation);
                    }

                    // Render result
                    this.renderTransactionResult(simulation);

                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.result);
               } else {
                    // PHASE 5: Get regular key wallet
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    // Sign transaction
                    let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, sendMptPaymentTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

                    // PHASE 7: Submit or Simulate
                    this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Sending MPT (no changes will be made)...' : 'Submitting to Ledger...');

                    const response = await this.xrplTransactions.submitTransaction(client, signedTx);

                    const isSuccess = this.utilsService.isTxSuccessful(response);
                    if (!isSuccess) {
                         const resultMsg = this.utilsService.getTransactionResultMessage(response);
                         let userMessage = 'Transaction failed.\n';
                         userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                         (response.result as any).errorMessage = userMessage;
                         console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                    }

                    // Render result
                    this.renderTransactionResult(response);

                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.result);
               }

               //DEFER: Non-critical UI updates (skip for simulation)
               if (!this.isSimulateEnabled) {
                    setTimeout(async () => {
                         try {
                              this.clearFields(false);
                              await this.updateXrpBalance(client, accountInfo, wallet);
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

     async setMptLocked() {
          console.log('Entering setMptLocked');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               senderAddress: this.utilsService.getSelectedAddressWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               mptIssuanceIdField: this.mptIssuanceIdField,
               isRegularKeyAddress: this.isRegularKeyAddress,
               regularKeyAddress: this.isRegularKeyAddress ? this.regularKeyAddress : undefined,
               regularKeySeed: this.isRegularKeyAddress ? this.regularKeySeed : undefined,
               useMultiSign: this.useMultiSign,
               multiSignAddresses: this.useMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.useMultiSign ? this.multiSignSeeds : undefined,
               isTicket: this.isTicket,
               ticketSequence: this.isTicket ? this.ticketSequence : undefined,
          };

          try {
               this.updateSpinnerMessage('Setting MPT Locked...');

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, mptokenObjects, fee, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, this.destinationFields, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client)]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`mptokenObjects for ${wallet.classicAddress}:`, mptokenObjects.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);

               inputs = {
                    ...inputs,
                    account_info: accountInfo,
               };

               const errors = await this.validateInputs(inputs, 'setMptLocked');
               if (errors.length > 0) {
                    return this.setError(`ERROR: ${errors.join('; ')}`);
               }

               // const mptokenObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '');
               console.debug(`MPT Account Objects: `, mptokenObjects);
               const mptokens = mptokenObjects.result.account_objects.filter((o: any) => o.LedgerEntryType === 'MPTToken' || o.LedgerEntryType === 'MPTokenIssuance' || o.LedgerEntryType === 'MPToken');
               console.debug(`MPT Objects: `, mptokens);
               console.debug('MPT Issuance ID:', this.mptIssuanceIdField);

               const accountIssuerToken = mptokens.some((obj: any) => obj.mpt_issuance_id === this.mptIssuanceIdField);

               if (!accountIssuerToken) {
                    return this.setError(`ERROR: MPT issuance ID ${this.mptIssuanceIdField} was not issued by ${wallet.classicAddress}.`);
               }

               const mPTokenIssuanceSetTx: xrpl.MPTokenIssuanceSet = {
                    TransactionType: 'MPTokenIssuanceSet',
                    Account: wallet.classicAddress,
                    MPTokenIssuanceID: this.mptIssuanceIdField,
                    AuthorizedAccounts: ['rPjuSWDPas1RdTc2AkHeqdGU3q3xrZ6o77', 'r3dVQPWtAc33XKd5SMRgjh2yGBsvo7PXgm'],
                    Flags: MPTokenIssuanceSetFlags.tfMPTLock,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                    Fee: fee,
               };

               if (this.ticketSequence) {
                    const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence));
                    if (!ticketExists) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(mPTokenIssuanceSetTx, this.ticketSequence, true);
               } else {
                    this.utilsService.setTicketSequence(mPTokenIssuanceSetTx, accountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(mPTokenIssuanceSetTx, this.memoField);
               }

               if (await this.utilsService.isInsufficientXrpBalance(client, accountInfo, '0', wallet.classicAddress, mPTokenIssuanceSetTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               if (this.isSimulateEnabled) {
                    const simulation = await this.xrplTransactions.simulateTransaction(client, mPTokenIssuanceSetTx);

                    const isSuccess = this.utilsService.isTxSuccessful(simulation);
                    if (!isSuccess) {
                         const resultMsg = this.utilsService.getTransactionResultMessage(simulation);
                         let userMessage = 'Transaction failed.\n';
                         userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                         (simulation['result'] as any).errorMessage = userMessage;
                         console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, simulation);
                    }

                    // Render result
                    this.renderTransactionResult(simulation);

                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.result);
               } else {
                    // PHASE 5: Get regular key wallet
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    // Sign transaction
                    let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, mPTokenIssuanceSetTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

                    // PHASE 7: Submit or Simulate
                    this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Locking MPT (no changes will be made)...' : 'Submitting to Ledger...');

                    const response = await this.xrplTransactions.submitTransaction(client, signedTx);

                    const isSuccess = this.utilsService.isTxSuccessful(response);
                    if (!isSuccess) {
                         const resultMsg = this.utilsService.getTransactionResultMessage(response);
                         let userMessage = 'Transaction failed.\n';
                         userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                         (response.result as any).errorMessage = userMessage;
                         console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                    }

                    // Render result
                    this.renderTransactionResult(response);

                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.result);
               }

               //DEFER: Non-critical UI updates (skip for simulation)
               if (!this.isSimulateEnabled) {
                    setTimeout(async () => {
                         try {
                              this.clearFields(false);
                              await this.updateXrpBalance(client, accountInfo, wallet);
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
               console.log(`Leaving setMptLocked in ${this.executionTime}ms`);
          }
     }

     async destroyMpt() {
          console.log('Entering destroyMpt');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               mptIssuanceIdField: this.mptIssuanceIdField,
               isRegularKeyAddress: this.isRegularKeyAddress,
               regularKeyAddress: this.isRegularKeyAddress ? this.regularKeyAddress : undefined,
               regularKeySeed: this.isRegularKeyAddress ? this.regularKeySeed : undefined,
               useMultiSign: this.useMultiSign,
               multiSignAddresses: this.useMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.useMultiSign ? this.multiSignSeeds : undefined,
               isTicket: this.isTicket,
               ticketSequence: this.isTicket ? this.ticketSequence : undefined,
          };

          try {
               this.updateSpinnerMessage('Deleting MPT...');

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, destObjects, fee, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, this.destinationFields, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client)]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`destObjects for ${wallet.classicAddress}:`, destObjects.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);

               inputs = {
                    ...inputs,
                    account_info: accountInfo,
               };

               const errors = await this.validateInputs(inputs, 'delete');
               if (errors.length > 0) {
                    return this.setError(`ERROR: ${errors.join('; ')}`);
               }

               // Check if destination can hold the MPT
               // const destObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '');
               // if (!destObjects || !destObjects.result || !destObjects.result.account_objects) {
               //      return this.setError(`ERROR: Unable to fetch account objects for ${wallet.classicAddress}`);
               // }
               // const mptTokens = destObjects.result.account_objects.filter((obj: any) => obj.LedgerEntryType === 'MPToken');
               // console.debug('MPT Tokens:', mptTokens);
               // console.debug('MPT Issuance ID:', this.mptIssuanceIdField);

               // const authorized = mptTokens.some((obj: any) => obj.MPTokenIssuanceID === this.mptIssuanceIdField);

               // if (!authorized) {
               //      return this.setError(`ERROR: Destination ${wallet.classicAddress} is not authorized to delete this MPT (issuance ID ${this.mptIssuanceIdField}).`);
               // }

               const mPTokenIssuanceDestroyTx: xrpl.MPTokenIssuanceDestroy = {
                    TransactionType: 'MPTokenIssuanceDestroy',
                    Account: wallet.classicAddress,
                    MPTokenIssuanceID: this.mptIssuanceIdField,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                    Fee: fee,
               };

               if (this.ticketSequence) {
                    const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence));
                    if (!ticketExists) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(mPTokenIssuanceDestroyTx, this.ticketSequence, true);
               } else {
                    this.utilsService.setTicketSequence(mPTokenIssuanceDestroyTx, accountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(mPTokenIssuanceDestroyTx, this.memoField);
               }

               if (this.isSimulateEnabled) {
                    const simulation = await this.xrplTransactions.simulateTransaction(client, mPTokenIssuanceDestroyTx);

                    const isSuccess = this.utilsService.isTxSuccessful(simulation);
                    if (!isSuccess) {
                         const resultMsg = this.utilsService.getTransactionResultMessage(simulation);
                         let userMessage = 'Transaction failed.\n';
                         userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                         (simulation['result'] as any).errorMessage = userMessage;
                         console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, simulation);
                    }

                    // Render result
                    this.renderTransactionResult(simulation);

                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.result);
               } else {
                    // PHASE 5: Get regular key wallet
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    // Sign transaction
                    let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, mPTokenIssuanceDestroyTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

                    // PHASE 7: Submit or Simulate
                    this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Deleting MPT (no changes will be made)...' : 'Submitting to Ledger...');

                    const response = await this.xrplTransactions.submitTransaction(client, signedTx);

                    const isSuccess = this.utilsService.isTxSuccessful(response);
                    if (!isSuccess) {
                         const resultMsg = this.utilsService.getTransactionResultMessage(response);
                         let userMessage = 'Transaction failed.\n';
                         userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                         (response.result as any).errorMessage = userMessage;
                         console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                    }

                    // Render result
                    this.renderTransactionResult(response);

                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.result);
               }

               //DEFER: Non-critical UI updates (skip for simulation)
               if (!this.isSimulateEnabled) {
                    setTimeout(async () => {
                         try {
                              this.clearFields(false);
                              await this.updateXrpBalance(client, accountInfo, wallet);
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
               console.log(`Leaving destroyMpt in ${this.executionTime}ms`);
          }
     }

     private getFlagsValue(flags: AccountFlags): number {
          let v_flags = 0;
          if (flags.isLock) {
               v_flags |= MPTokenIssuanceCreateFlags.tfMPTCanLock; // 2
          }
          if (flags.isRequireAuth) {
               v_flags |= MPTokenIssuanceCreateFlags.tfMPTRequireAuth; // 4;
          }
          if (flags.isEscrow) {
               v_flags |= MPTokenIssuanceCreateFlags.tfMPTCanEscrow; // 8;
          }
          if (flags.isTradable) {
               v_flags |= MPTokenIssuanceCreateFlags.tfMPTCanTrade; // 16;
          }
          if (flags.isTransferable) {
               v_flags |= MPTokenIssuanceCreateFlags.tfMPTCanTransfer; // 32;
          }
          if (flags.isClawback) {
               v_flags |= MPTokenIssuanceCreateFlags.tfMPTCanClawback; // 64;
          }
          return v_flags;
     }

     private renderTransactionResult(response: any): void {
          if (this.isSimulateEnabled) {
               this.renderUiComponentsService.renderSimulatedTransactionsResults(response, this.resultField.nativeElement);
          } else {
               console.debug(`Response`, response);
               this.renderUiComponentsService.renderTransactionsResults(response, this.resultField.nativeElement);
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

     private async updateXrpBalance(client: xrpl.Client, accountInfo: any, wallet: xrpl.Wallet) {
          const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, accountInfo, wallet.classicAddress);

          this.ownerCount = ownerCount;
          this.totalXrpReserves = totalXrpReserves;

          const balance = (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0');
          this.account1.balance = balance.toString();
     }

     private refreshUiAccountObjects(accountObjects: any, accountInfo: any, wallet: xrpl.Wallet) {
          const signerAccounts = this.checkForSignerAccounts(accountObjects);

          if (signerAccounts?.length) {
               const signerEntriesKey = `${wallet.classicAddress}signerEntries`;
               const signerEntries: SignerEntry[] = this.storageService.get(signerEntriesKey) || [];

               console.debug(`refreshUiAccountObjects:`, signerEntries);

               this.multiSignAddress = signerEntries.map(e => e.Account).join(',\n');
               this.multiSignSeeds = signerEntries.map(e => e.seed).join(',\n');
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
     }

     private refreshUiAccountInfo(accountInfo: any) {
          const regularKey = accountInfo?.result?.account_data?.RegularKey;

          if (regularKey) {
               this.regularKeyAddress = regularKey;
               const regularKeySeedAccount = accountInfo.result.account_data.Account + 'regularKeySeed';
               this.regularKeySeed = this.storageService.get(regularKeySeedAccount);
          } else {
               this.isRegularKeyAddress = false;
               this.regularKeyAddress = 'No RegularKey configured for account';
               this.regularKeySeed = '';
          }

          const isMasterKeyDisabled = accountInfo?.result?.account_flags?.disableMasterKey;
          if (isMasterKeyDisabled) {
               this.masterKeyDisabled = true;
          } else {
               this.masterKeyDisabled = false;
          }

          if (isMasterKeyDisabled && xrpl.isValidAddress(this.regularKeyAddress)) {
               this.isRegularKeyAddress = true; // Force to true if master key is disabled
          } else {
               this.isRegularKeyAddress = false;
          }

          if (regularKey) {
               this.regularKeySigningEnabled = true;
          } else {
               this.regularKeySigningEnabled = false;
          }
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

          // Action-specific config: required fields and custom rules
          const actionConfig: Record<
               string,
               {
                    required: (keyof ValidationInputs)[];
                    customValidators?: (() => string | null)[];
                    asyncValidators?: (() => Promise<string | null>)[];
               }
          > = {
               get: {
                    required: ['selectedAccount', 'seed'],
                    customValidators: [() => isValidSeed(inputs.seed)],
                    asyncValidators: [],
               },
               generate: {
                    required: ['selectedAccount', 'seed'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.assetScaleField, 'Asset scale', 0, 15),
                         () => isValidNumber(inputs.transferFeeField, 'Transfer fee', 0, 1000000),
                         () => isValidNumber(inputs.tokenCountField, 'Token count', 0),
                         () => isNotSelfPayment(inputs.senderAddress, inputs.destination),
                         () => (inputs.isTicket ? isRequired(inputs.ticketSequence, 'Ticket Sequence') : null),
                         () => (inputs.isTicket ? isValidNumber(inputs.ticketSequence, 'Ticket Sequence', 0) : null),
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
                    required: ['selectedAccount', 'seed', 'mptIssuanceIdField'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isRequired(inputs.mptIssuanceIdField, 'MPT Issuance ID'),
                         () => isNotSelfPayment(inputs.senderAddress, inputs.destination),
                         () => (inputs.isTicket ? isRequired(inputs.ticketSequence, 'Ticket Sequence') : null),
                         () => (inputs.isTicket ? isValidNumber(inputs.ticketSequence, 'Ticket Sequence', 0) : null),
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
               send: {
                    required: ['selectedAccount', 'seed', 'amount', 'destination', 'mptIssuanceIdField'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.amount, 'Amount', 0),
                         () => isValidXrpAddress(inputs.destination, 'Destination address'),
                         () => isRequired(inputs.mptIssuanceIdField, 'MPT Issuance ID'),
                         () => isValidNumber(inputs.destinationTag, 'Destination Tag', 0, undefined, true), // Allow empty
                         () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                         () => isNotSelfPayment(inputs.senderAddress, inputs.destination),
                         () => (inputs.isTicket ? isRequired(inputs.ticketSequence, 'Ticket Sequence') : null),
                         () => (inputs.isTicket ? isValidNumber(inputs.ticketSequence, 'Ticket Sequence', 0) : null),
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
                    required: ['selectedAccount', 'seed', 'mptIssuanceIdField'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isRequired(inputs.mptIssuanceIdField, 'MPT Issuance ID'),
                         () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                         () => (inputs.isTicket ? isRequired(inputs.ticketSequence, 'Ticket Sequence') : null),
                         () => (inputs.isTicket ? isValidNumber(inputs.ticketSequence, 'Ticket Sequence', 0) : null),
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
                    required: ['selectedAccount', 'seed', 'mptIssuanceIdField'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isRequired(inputs.mptIssuanceIdField, 'MPT Issuance ID'),
                         () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                         () => (inputs.isTicket ? isRequired(inputs.ticketSequence, 'Ticket Sequence') : null),
                         () => (inputs.isTicket ? isValidNumber(inputs.ticketSequence, 'Ticket Sequence', 0) : null),
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

          // Check required fields
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

          // Selected account check (common to most)
          if (inputs.selectedAccount === undefined || inputs.selectedAccount === null) {
               errors.push('Please select an account');
          }

          return errors;
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

     private updateDestinations() {
          this.destinations = Object.values(this.knownDestinations).filter((d): d is string => typeof d === 'string' && d.trim() !== '');
          this.storageService.setKnownIssuers('destinations', this.knownDestinations);
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
                    await this.getMptDetails();
               } else if (address) {
                    this.setError('Invalid XRP address');
               }
          } catch (error: any) {
               this.setError(`Error fetching account details: ${error.message}`);
          }
     }

     private displayDataForAccount1() {
          this.displayDataForAccount('account1');
     }

     private displayDataForAccount2() {
          this.displayDataForAccount('account2');
     }

     private displayDataForAccount3() {
          this.displayDataForAccount('issuer');
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
          console.log('Spinner message updated:', message);
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
