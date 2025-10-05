import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { WalletMultiInputComponent } from '../wallet-multi-input/wallet-multi-input.component';
import { StorageService } from '../../services/storage.service';
import * as xrpl from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';
import * as cc from 'five-bells-condition';
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';

interface ValidationInputs {
     selectedAccount?: 'account1' | 'account2' | 'issuer' | null;
     senderAddress?: string;
     account_info?: any;
     seed?: string;
     amount?: string;
     destination?: string;
     conditionField?: string;
     fulfillment?: string;
     escrowSequence?: string;
     cancelTime?: string;
     sequence?: string;
     selectedIssuer?: string;
     currency?: string;
     escrow_objects?: any;
     destinationTag?: string;
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

interface EscrowObject {
     Account: string;
     index: string;
     Expiration?: number;
     Destination: string;
     Condition: string;
     CancelAfter: string;
     FinshAfter: string;
     Amount: string;
     DestinationTag: string;
     Balance: string;
     SourceTag: number;
     PreviousTxnID: string;
     Memo: string | null | undefined;
     Sequence: number | null | undefined;
     TicketSequence: number | null | undefined;
}

interface EscrowWithTxData {
     LedgerEntryType: 'Escrow';
     Account: string;
     Amount?: string | { currency: string; value: string } | { mpt_issuance_id: string; value: string };
     Destination: string;
     PreviousTxnID?: string;
     Condition?: string;
     CancelAfter?: number;
     FinishAfter?: number;
     DestinationTag?: number;
     SourceTag?: number;
     Sequence?: number | null;
     TicketSequence?: string | number;
     Memo?: string | null;
}

interface RippleState {
     LedgerEntryType: 'RippleState';
     Balance: { currency: string; value: string };
     HighLimit: { issuer: string };
}

interface MPToken {
     LedgerEntryType: 'MPToken';
     index: string;
     mpt_issuance_id?: string;
     MPTokenIssuanceID?: string;
     PreviousTxnID: string;
     Flags?: number;
     MPTAmount?: string | number;
     MaximumAmount?: string | number;
     OutstandingAmount?: string | number;
     TransferFee?: string | number;
     MPTokenMetadata?: string;
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
     selector: 'app-create-conditional-escrow',
     standalone: true,
     imports: [CommonModule, FormsModule, WalletMultiInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './create-conditional-escrow.component.html',
     styleUrl: './create-conditional-escrow.component.css',
})
export class CreateConditionalEscrowComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     @ViewChild('accountForm') accountForm!: NgForm;
     selectedAccount: 'account1' | 'account2' | 'issuer' | null = 'account1';
     private lastResult: string = '';
     transactionInput: string = '';
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = false;
     ticketSequence: string = '';
     isTicket: boolean = false;
     isTicketEnabled: boolean = false;
     ticketArray: string[] = [];
     selectedTickets: string[] = []; // For multiple selection
     selectedSingleTicket: string = ''; // For single selection
     multiSelectMode: boolean = false; // Toggle between modes
     selectedTicket: string = ''; // The currently selected ticket
     account1 = { name: '', address: '', seed: '', secretNumbers: '', mnemonic: '', balance: '' };
     account2 = { name: '', address: '', seed: '', secretNumbers: '', mnemonic: '', balance: '' };
     issuer = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '0' };
     channelIDField: string = '';
     settleDelayField: string = '';
     ownerCount: string = '';
     totalXrpReserves: string = '';
     executionTime: string = '';
     amountField: string = '';
     destinationField: string = '';
     destinationTagField: string = '';
     escrowFinishTimeField: string = '';
     escrowFinishTimeUnit: string = 'seconds';
     escrowCancelTimeUnit: string = 'seconds';
     escrowConditionField: string = '';
     escrowFulfillmentField: string = '';
     escrowCancelTimeField: string = '';
     escrowOwnerField: string = '';
     escrowSequenceNumberField: string = '';
     mptIssuanceIdField: string = '';
     isMptEnabled: boolean = false;
     memoField: string = '';
     isMemoEnabled: boolean = false;
     isMultiSignTransaction: boolean = false;
     useMultiSign: boolean = false;
     multiSignSeeds: string = '';
     multiSignAddress: string = '';
     isRegularKeyAddress: boolean = false;
     regularKeySeed: string = '';
     regularKeyAddress: string = '';
     signerQuorum: number = 0;
     multiSigningEnabled: boolean = false;
     regularKeySigningEnabled: boolean = false;
     spinner: boolean = false;
     issuers: string[] = [];
     destinationFields: string = '';
     spinnerMessage: string = '';
     masterKeyDisabled: boolean = false;
     tokenBalance: string = '0';
     gatewayBalance: string = '0';
     private knownTrustLinesIssuers: { [key: string]: string } = {
          XRP: '',
     };
     currencies: string[] = [];
     currencyIssuers: string[] = [];
     newCurrency: string = '';
     newIssuer: string = '';
     tokenToRemove: string = '';
     currencyFieldDropDownValue: string = 'XRP';
     selectedIssuer: string = '';
     isSimulateEnabled: boolean = false;
     private knownDestinations: { [key: string]: string } = {};
     destinations: string[] = [];
     signers: { account: string; seed: string; weight: number }[] = [{ account: '', seed: '', weight: 1 }];
     escrowCancelDateTimeField: string = '';
     escrowFinishDateTimeField: string = '';

     constructor(private readonly xrplService: XrplService, private readonly utilsService: UtilsService, private readonly cdr: ChangeDetectorRef, private readonly storageService: StorageService, private readonly renderUiComponentsService: RenderUiComponentsService, private readonly xrplTransactions: XrplTransactionService) {}

     async ngOnInit(): Promise<void> {
          const storedDestinations = this.storageService.getKnownIssuers('destinations');
          if (storedDestinations) {
               this.knownDestinations = storedDestinations;
          }
          const storedIssuers = this.storageService.getKnownIssuers('knownIssuers');
          if (storedIssuers) {
               this.knownTrustLinesIssuers = storedIssuers;
          }
          this.updateCurrencies();
          this.currencyFieldDropDownValue = 'XRP'; // Set default to XRP
     }

     ngAfterViewInit() {
          (async () => {
               try {
                    const wallet = await this.getWallet();
                    this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
                    let storedIssuers = this.storageService.getKnownIssuers('knownIssuers');
                    if (storedIssuers) {
                         this.storageService.removeValue('knownIssuers');
                         this.knownTrustLinesIssuers = this.utilsService.normalizeAccounts(storedIssuers, this.issuer.address);
                         this.storageService.setKnownIssuers('knownIssuers', this.knownTrustLinesIssuers);
                    }
                    this.updateDestinations();
                    this.destinationFields = this.issuer.address;
                    this.currencyFieldDropDownValue = 'XRP'; // Set default to XRP
               } catch (error: any) {
                    console.error(`No wallet could be created or is undefined ${error.message}`);
                    return this.setError('ERROR: Wallet could not be created or is undefined');
               } finally {
                    this.cdr.detectChanges();
               }
          })();
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

     onTicketToggle(event: any, ticket: string) {
          if (event.target.checked) {
               // Add to selection
               this.selectedTickets = [...this.selectedTickets, ticket];
          } else {
               // Remove from selection
               this.selectedTickets = this.selectedTickets.filter(t => t !== ticket);
          }
     }

     async toggleIssuerField() {
          console.log('Entering onCurrencyChange');
          const startTime = Date.now();
          this.setSuccessProperties();

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();
               const accountObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '');

               // PHASE 1: PARALLELIZE — update balance + fetch gateway balances
               const [balanceUpdate, gatewayBalances] = await Promise.all([this.updateCurrencyBalance(wallet, accountObjects), this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '')]);

               // PHASE 2: Calculate total balance for selected currency
               let balanceTotal: number = 0;

               if (gatewayBalances.result.assets && Object.keys(gatewayBalances.result.assets).length > 0) {
                    for (const [issuer, currencies] of Object.entries(gatewayBalances.result.assets)) {
                         for (const { currency, value } of currencies) {
                              if (this.utilsService.formatCurrencyForDisplay(currency) === this.currencyFieldDropDownValue) {
                                   balanceTotal += Number(value);
                              }
                         }
                    }
                    this.gatewayBalance = this.utilsService.formatTokenBalance(balanceTotal.toString(), 18);
               } else {
                    this.gatewayBalance = '0';
               }

               // PHASE 3: Update destination field
               if (this.currencyFieldDropDownValue === 'XRP') {
                    this.destinationFields = this.issuer.address;
               } else {
                    this.currencyIssuers = [this.knownTrustLinesIssuers[this.currencyFieldDropDownValue] || ''];
                    this.destinationFields = this.knownTrustLinesIssuers[this.currencyFieldDropDownValue] || '';
               }
          } catch (error: any) {
               this.tokenBalance = '0';
               this.gatewayBalance = '0';
               console.error('Error in onCurrencyChange:', error);
               this.setError(`ERROR: Failed to fetch balance - ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving onCurrencyChange in ${this.executionTime}ms`);
          }
     }

     async getEscrowOwnerAddress() {
          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               senderAddress: this.utilsService.getSelectedAddressWithIssuer(this.selectedAccount || '', this.account1, this.account2, this.issuer),
          };

          const senderAddress = inputs.senderAddress || '';
          if (!senderAddress) {
               this.escrowOwnerField = '';
               return;
          }

          try {
               const client = await this.xrplService.getClient();
               const escrowsTx = await this.xrplService.getAccountObjects(client, senderAddress, 'validated', 'escrow');

               inputs = { ...inputs, account_info: escrowsTx };

               const errors = await this.validateInputs(inputs, 'getEscrowOwnerAddress');
               if (errors.length > 0) {
                    if (errors.length === 1) {
                         return this.setError(`Error:\n${errors.join('\n')}`);
                    } else {
                         return this.setError(`Multiple Error's:\n${errors.join('\n')}`);
                    }
               }

               // Optional: Simplify debug log — avoid expensive stringify
               console.debug(`Escrow objects for ${senderAddress}:`, escrowsTx.result);

               const escrowObjects = escrowsTx.result.account_objects;
               if (escrowObjects.length === 0) {
                    this.escrowOwnerField = senderAddress;
                    return;
               }

               const targetSequence = Number(this.escrowSequenceNumberField);
               if (isNaN(targetSequence)) {
                    this.escrowOwnerField = senderAddress;
                    return;
               }

               // 🚀 PARALLELIZE: Fetch all tx data at once
               const txPromises = escrowObjects.map(escrow => {
                    const previousTxnID = escrow.PreviousTxnID;
                    if (typeof previousTxnID !== 'string') {
                         return Promise.resolve({ escrow, sequence: null });
                    }
                    return this.xrplService
                         .getTxData(client, previousTxnID)
                         .then(sequenceTx => {
                              const offerSequence = sequenceTx.result.tx_json.Sequence;
                              return { escrow, sequence: offerSequence ?? null };
                         })
                         .catch(err => {
                              console.error(`Failed to fetch tx ${previousTxnID}:`, err.message || err);
                              return { escrow, sequence: null };
                         });
               });

               const results = await Promise.all(txPromises);

               // 🔍 Find first escrow matching target sequence
               const match = results.find(r => r.sequence === targetSequence);
               if (match && 'Account' in match.escrow) {
                    this.escrowOwnerField = match.escrow.Account;
               } else {
                    this.escrowOwnerField = senderAddress; // fallback
               }
          } catch (error: any) {
               console.error('Error in getEscrowOwnerAddress:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
               this.escrowOwnerField = senderAddress; // safe fallback
          }
     }

     async getEscrows() {
          console.log('Entering getEscrows');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
          };

          try {
               this.showSpinnerWithDelay('Getting Escrows ...', 250);

               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // Fetch account info and all objects in parallel
               const [accountInfo, accountObjects, escrowObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'escrow')]);

               console.debug(`accountInfo for ${wallet.classicAddress}`, accountInfo.result);
               console.debug(`accountObjects for ${wallet.classicAddress}`, accountObjects.result);
               console.debug(`Escrow objects:`, escrowObjects.result);

               inputs = { ...inputs, account_info: accountInfo };

               const errors = await this.validateInputs(inputs, 'get');
               if (errors.length > 0) {
                    if (errors.length === 1) {
                         return this.setError(`Error:\n${errors.join('\n')}`);
                    } else {
                         return this.setError(`Multiple Error's:\n${errors.join('\n')}`);
                    }
               }

               const data: any = { sections: [{}] };

               // --- Escrows ---
               const escrowList = escrowObjects.result.account_objects.filter(this.utilsService.isEscrow) as unknown as EscrowWithTxData[];

               if (escrowList.length === 0) {
                    data.sections.push({
                         title: 'Escrows',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No escrows found for <code>${wallet.classicAddress}</code>` }],
                    });
               } else {
                    const txPromises = escrowList.map(escrow => {
                         const previousTxnID = escrow.PreviousTxnID;
                         if (!previousTxnID) return Promise.resolve({ Sequence: null, TicketSequence: 'N/A', Memo: null });

                         return this.xrplService
                              .getTxData(client, previousTxnID)
                              .then(sequenceTx => {
                                   const txJson = sequenceTx.result.tx_json;
                                   return {
                                        Sequence: txJson.Sequence ?? null,
                                        TicketSequence: txJson.TicketSequence ?? 'N/A',
                                        Memo: txJson.Memos?.[0]?.Memo?.MemoData ?? null,
                                   };
                              })
                              .catch(err => {
                                   console.error(`Failed to fetch tx ${previousTxnID}:`, err.message || err);
                                   return { Sequence: null, TicketSequence: 'N/A', Memo: null };
                              });
                    });

                    const txResults = await Promise.all(txPromises);

                    const escrows: EscrowWithTxData[] = escrowList.map((escrow, idx) => ({
                         ...escrow,
                         ...txResults[idx],
                    }));

                    data.sections.push({
                         title: `Escrows (${escrows.length})`,
                         openByDefault: true,
                         subItems: escrows.map((escrow, index) => {
                              let amount = escrow.Amount;
                              let displayAmount: any;

                              if (typeof amount === 'string') {
                                   // Ensure we're passing a string to dropsToXrp
                                   displayAmount = xrpl.dropsToXrp(amount) + ' XRP';
                              } else if (amount && typeof amount === 'object' && 'currency' in amount) {
                                   displayAmount = `${amount.value} ${this.utilsService.decodeIfNeeded(amount.currency)}`;
                              } else if (amount && typeof amount === 'object' && 'mpt_issuance_id' in amount) {
                                   displayAmount = `${amount.value} [MPT: ${amount.mpt_issuance_id}]`;
                              } else {
                                   displayAmount = 'Unknown';
                              }

                              return {
                                   key: `Escrow ${index + 1} (ID: ${escrow.PreviousTxnID?.slice(0, 8) ?? 'N/A'}...)`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Owner', value: `<code>${escrow.Account}</code>` },
                                        { key: 'Sequence', value: escrow.Sequence != null ? String(escrow.Sequence) : 'N/A' },
                                        { key: 'Amount', value: displayAmount },
                                        { key: 'Destination', value: `<code>${escrow.Destination}</code>` },
                                        ...(escrow.Condition ? [{ key: 'Condition', value: `<code>${escrow.Condition}</code>` }] : []),
                                        ...(escrow.CancelAfter ? [{ key: 'Cancel After', value: this.utilsService.convertXRPLTime(escrow.CancelAfter) }] : []),
                                        ...(escrow.FinishAfter ? [{ key: 'Finish After', value: this.utilsService.convertXRPLTime(escrow.FinishAfter) }] : []),
                                        ...(escrow.DestinationTag ? [{ key: 'Destination Tag', value: String(escrow.DestinationTag) }] : []),
                                        ...(escrow.Memo ? [{ key: 'Memo', value: this.utilsService.decodeHex(escrow.Memo) }] : []),
                                        { key: 'Ticket Sequence', value: escrow.TicketSequence?.toString() ?? 'N/A' },
                                        { key: 'Previous Txn ID', value: `<code>${escrow.PreviousTxnID ?? 'N/A'}</code>` },
                                        ...(escrow.SourceTag ? [{ key: 'Source Tag', value: String(escrow.SourceTag) }] : []),
                                   ],
                              };
                         }),
                    });
               }

               // --- IOUs ---
               const iouObjects = accountObjects.result.account_objects.filter(this.utilsService.isRippleState) as unknown as RippleState[];
               if (iouObjects.length > 0) {
                    const balanceItems = iouObjects.map((iou, idx) => ({
                         // key: `${iou.Balance.value} ${iou.Balance.currency} from ${iou.HighLimit.issuer}`,
                         key: `${this.utilsService.formatCurrencyForDisplay(iou.Balance.currency)} from ${iou.HighLimit.issuer}`,
                         openByDefault: false,
                         content: [
                              { key: 'Currency', value: this.utilsService.formatCurrencyForDisplay(iou.Balance.currency) },
                              { key: 'Issuer', value: `<code>${iou.HighLimit.issuer}</code>` },
                              { key: 'Amount', value: this.utilsService.formatTokenBalance(iou.Balance.value, 2) },
                         ],
                    }));

                    data.sections.push({
                         title: `IOU Tokens (${balanceItems.length})`,
                         openByDefault: true,
                         subItems: balanceItems,
                    });
               }

               // --- MPTs ---
               const mptObjects = accountObjects.result.account_objects.filter(this.utilsService.isMPT) as unknown as MPToken[];
               if (mptObjects.length === 0) {
                    data.sections.push({
                         title: 'MPT Tokens',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No MPT tokens found for <code>${wallet.classicAddress}</code>` }],
                    });
               } else {
                    data.sections.push({
                         title: `MPT Tokens (${mptObjects.length})`,
                         openByDefault: true,
                         subItems: mptObjects.map((mpt, idx) => {
                              const mptIssuanceId = mpt.mpt_issuance_id || mpt.MPTokenIssuanceID;
                              return {
                                   key: `MPT ${idx + 1} (ID: ${mpt.index.slice(0, 8)}...)`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'MPT Issuance ID', value: `<code>${mptIssuanceId}</code>` },
                                        { key: 'Ledger Entry Type', value: mpt.LedgerEntryType },
                                        { key: 'Previous Txn ID', value: `<code>${mpt.PreviousTxnID}</code>` },
                                        ...(mpt.Flags !== undefined ? [{ key: 'Flags', value: this.utilsService.getMptFlagsReadable(Number(mpt.Flags)) }] : []),
                                        ...(mpt.MPTAmount ? [{ key: 'MPTAmount', value: String(mpt.MPTAmount) }] : []),
                                        ...(mpt.MaximumAmount ? [{ key: 'MaximumAmount', value: String(mpt.MaximumAmount) }] : []),
                                        ...(mpt.OutstandingAmount ? [{ key: 'OutstandingAmount', value: String(mpt.OutstandingAmount) }] : []),
                                        ...(mpt.TransferFee ? [{ key: 'TransferFee', value: String(mpt.TransferFee) }] : []),
                                        ...(mpt.MPTokenMetadata ? [{ key: 'MPTokenMetadata', value: xrpl.convertHexToString(mpt.MPTokenMetadata) }] : []),
                                   ],
                              };
                         }),
                    });
               }

               this.renderUiComponentsService.renderDetails(data);
               this.setSuccess(this.result);

               // Deferred UI updates
               setTimeout(async () => {
                    try {
                         this.refreshUiAccountObjects(accountObjects, accountInfo, wallet);
                         this.refreshUiAccountInfo(accountInfo);
                         this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
                         this.getEscrowOwnerAddress();

                         await this.updateXrpBalance(client, accountInfo, wallet);
                         this.clearFields(false);
                    } catch (err) {
                         console.error('Error in deferred UI updates:', err);
                    }
               }, 0);
          } catch (error: any) {
               console.error('Error in getEscrows:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getEscrows in ${this.executionTime}ms`);
          }
     }

     async createConditionalEscrow() {
          console.log('Entering createConditionalEscrow');
          const startTime = Date.now();
          this.setSuccessProperties();

          const t = this.utilsService.convertDateTimeToRippleTime(this.escrowFinishDateTimeField);
          console.log('t: ', t);
          const r = this.utilsService.convertDateTimeToRippleTime(this.escrowCancelDateTimeField);
          console.log('r: ', r);

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               senderAddress: this.utilsService.getSelectedAddressWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               amount: this.amountField,
               destination: this.destinationFields,
               conditionField: this.escrowConditionField,
               cancelTime: this.escrowCancelTimeField,
               destinationTag: this.destinationTagField,
               selectedIssuer: this.selectedIssuer,
               currency: this.currencyFieldDropDownValue,
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
               this.resultField.nativeElement.innerHTML = '';
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Create Conditional Based Escrow (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, trustLines, fee, currentLedger, serverInfo] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), this.xrplService.getXrplServerInfo(client, 'current', '')]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`trustLines :`, trustLines);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);
               console.debug(`serverInfo :`, serverInfo);

               inputs = { ...inputs, account_info: accountInfo };

               const errors = await this.validateInputs(inputs, 'create');
               if (errors.length > 0) {
                    if (errors.length === 1) {
                         return this.setError(`Error:\n${errors.join('\n')}`);
                    } else {
                         return this.setError(`Multiple Error's:\n${errors.join('\n')}`);
                    }
               }

               const finishAfterTime = this.utilsService.addTime(this.escrowFinishTimeField, this.escrowFinishTimeUnit as 'seconds' | 'minutes' | 'hours' | 'days');
               const cancelAfterTime = this.utilsService.addTime(this.escrowCancelTimeField, this.escrowCancelTimeUnit as 'seconds' | 'minutes' | 'hours' | 'days');
               console.log(`finishUnit: ${this.escrowFinishTimeUnit} cancelUnit: ${this.escrowCancelTimeUnit}`);
               console.log(`finishTime: ${this.utilsService.convertXRPLTime(finishAfterTime)} cancelTime: ${this.utilsService.convertXRPLTime(cancelAfterTime)}`);

               let escrowCreateTx: xrpl.EscrowCreate = {
                    TransactionType: 'EscrowCreate',
                    Account: wallet.address,
                    Amount: xrpl.xrpToDrops(this.amountField),
                    Destination: this.destinationFields,
                    CancelAfter: cancelAfterTime,
                    Condition: this.escrowConditionField,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               await this.setTxOptionalFields(client, escrowCreateTx, wallet, accountInfo, 'create');

               if (this.currencyFieldDropDownValue === AppConstants.XRP_CURRENCY) {
                    if (this.amountField || this.amountField === '') {
                         if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, escrowCreateTx, fee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    } else {
                         if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, this.amountField, wallet.classicAddress, escrowCreateTx, fee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    }
               } else {
                    if (this.utilsService.isInsufficientIouTrustlineBalance(trustLines, escrowCreateTx, this.destinationFields)) {
                         return this.setError('ERROR: Not enough IOU balance for this transaction');
                    }
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Creating Conditional Escrow (no changes will be made)...' : 'Submitting to Ledger...');

               if (this.isSimulateEnabled) {
                    const simulation = await this.xrplTransactions.simulateTransaction(client, escrowCreateTx);

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
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    // Sign transaction
                    let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, escrowCreateTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

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

                    // PARALLELIZE
                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    // DEFER: Non-critical UI updates (skip for simulation)
                    setTimeout(async () => {
                         try {
                              if (this.currencyFieldDropDownValue !== 'XRP') {
                                   await this.updatedTokenBalance(client, updatedAccountInfo, updatedAccountObjects, wallet);
                                   await this.toggleIssuerField();
                              }
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              await this.updateXrpBalance(client, updatedAccountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
          } catch (error: any) {
               console.error('Error in createConditionalEscrow:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving createConditionalEscrow in ${this.executionTime}ms`);
          }
     }

     async finishConditionalEscrow() {
          console.log('Entering finishConditionalEscrow');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               conditionField: this.escrowConditionField,
               fulfillment: this.escrowFulfillmentField,
               escrowSequence: this.escrowSequenceNumberField,
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

          // If condition is provided, fulfillment is required
          if (this.escrowConditionField && !this.utilsService.validateInput(this.escrowFulfillmentField)) {
               return this.setError('ERROR: Fulfillment is required when a condition is provided');
          }

          try {
               this.resultField.nativeElement.innerHTML = '';
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Finish Conditional Based Escrow (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, escrowObjects, escrow, trustLines, fee, currentLedger, serverInfo] = await Promise.all([
                    this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''),
                    this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'escrow'),
                    this.xrplService.getEscrowBySequence(client, wallet.classicAddress, Number(this.escrowSequenceNumberField)),
                    this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', ''),
                    // this.xrplService.calculateTransactionFee(client),
                    String(4 * Number(await this.xrplService.calculateTransactionFee(client))),
                    this.xrplService.getLastLedgerIndex(client),
                    this.xrplService.getXrplServerInfo(client, 'current', ''),
               ]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`escrowObjects for ${wallet.classicAddress}:`, escrowObjects.result);
               console.debug(`escrow for ${wallet.classicAddress}:`, escrow);
               console.debug(`trustLines:`, trustLines);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);
               console.debug(`serverInfo:`, serverInfo);

               inputs = { ...inputs, account_info: accountInfo, escrow_objects: escrowObjects };

               const errors = await this.validateInputs(inputs, 'finish');
               if (errors.length > 0) {
                    if (errors.length === 1) {
                         return this.setError(`Error:\n${errors.join('\n')}`);
                    } else {
                         return this.setError(`Multiple Error's:\n${errors.join('\n')}`);
                    }
               }
               const escrowOwner = escrow.Account;

               // Check if the escrow can be canceled based on the CancelAfter time
               const currentRippleTime = await this.xrplService.getCurrentRippleTime(client);
               const escrowStatus = this.utilsService.checkEscrowStatus({ FinishAfter: escrow.FinshAfter ? Number(escrow.FinshAfter) : undefined, CancelAfter: escrow.CancelAfter ? Number(escrow.CancelAfter) : undefined, Condition: this.escrowConditionField, owner: escrowOwner }, currentRippleTime, wallet.classicAddress, 'finishEscrow', this.escrowFulfillmentField);

               if (!escrowStatus.canFinish) {
                    return this.setError(`ERROR: ${escrowStatus.reasonFinish}`);
               }

               let escrowFinishTx: xrpl.EscrowFinish = {
                    TransactionType: 'EscrowFinish',
                    Account: wallet.classicAddress,
                    Owner: this.escrowOwnerField,
                    OfferSequence: parseInt(this.escrowSequenceNumberField),
                    Condition: this.escrowConditionField,
                    Fulfillment: this.escrowFulfillmentField,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               await this.setTxOptionalFields(client, escrowFinishTx, wallet, accountInfo, 'finish');

               if (this.currencyFieldDropDownValue === AppConstants.XRP_CURRENCY) {
                    if (this.amountField || this.amountField === '') {
                         if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, escrowFinishTx, fee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    } else {
                         if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, this.amountField, wallet.classicAddress, escrowFinishTx, fee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    }
               } else {
                    if (this.utilsService.isInsufficientIouTrustlineBalance(trustLines, escrowFinishTx, this.destinationFields)) {
                         return this.setError('ERROR: Not enough IOU balance for this transaction');
                    }
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Finishing Conditional Escrow (no changes will be made)...' : 'Submitting to Ledger...');

               if (this.isSimulateEnabled) {
                    const simulation = await this.xrplTransactions.simulateTransaction(client, escrowFinishTx);

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
                    let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, escrowFinishTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

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

                    // PARALLELIZE
                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              if (this.currencyFieldDropDownValue !== 'XRP') {
                                   await this.updatedTokenBalance(client, updatedAccountInfo, updatedAccountObjects, wallet);
                                   await this.toggleIssuerField();
                              }
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              await this.updateXrpBalance(client, updatedAccountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
          } catch (error: any) {
               console.error('Error in finishConditionalEscrow:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving finishConditionalEscrow in ${this.executionTime}ms`);
          }
     }

     async cancelEscrow() {
          console.log('Entering cancelEscrow');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               escrowSequence: this.escrowSequenceNumberField,
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
               this.resultField.nativeElement.innerHTML = '';
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Cancel Conditional Based Escrow (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, escrowObjects, fee, currentLedger, serverInfo] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'escrow'), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), this.xrplService.getXrplServerInfo(client, 'current', '')]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`escrowObjects for ${wallet.classicAddress}:`, escrowObjects.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);
               console.debug(`serverInfo :`, serverInfo);

               inputs = { ...inputs, account_info: accountInfo, escrow_objects: escrowObjects };

               const errors = await this.validateInputs(inputs, 'cancel');
               if (errors.length > 0) {
                    if (errors.length === 1) {
                         return this.setError(`Error:\n${errors.join('\n')}`);
                    } else {
                         return this.setError(`Multiple Error's:\n${errors.join('\n')}`);
                    }
               }

               let foundSequenceNumber = false;
               let escrowOwner = this.account1.address;
               let escrow: EscrowObject | undefined = undefined;
               for (const [ignore, obj] of escrowObjects.result.account_objects.entries()) {
                    if (obj.PreviousTxnID) {
                         const sequenceTx = await this.xrplService.getTxData(client, obj.PreviousTxnID);
                         if (sequenceTx.result.tx_json.Sequence === Number(this.escrowSequenceNumberField)) {
                              foundSequenceNumber = true;
                              escrow = obj as unknown as EscrowObject;
                              escrowOwner = escrow.Account;
                              break;
                         } else if (sequenceTx.result.tx_json.TicketSequence != undefined && sequenceTx.result.tx_json.TicketSequence === Number(this.escrowSequenceNumberField)) {
                              foundSequenceNumber = true;
                              escrow = obj as unknown as EscrowObject;
                              escrowOwner = escrow.Account;
                              break;
                         }
                    }
               }

               if (!escrow) {
                    return this.setError(`No escrow found for sequence ${this.escrowSequenceNumberField}`);
               }

               // Check if the escrow can be canceled based on the CancelAfter time
               const currentRippleTime = await this.xrplService.getCurrentRippleTime(client);
               const escrowStatus = this.utilsService.checkEscrowStatus({ FinishAfter: escrow.FinshAfter ? Number(escrow.FinshAfter) : undefined, CancelAfter: escrow.CancelAfter ? Number(escrow.CancelAfter) : undefined, Condition: this.escrowConditionField, owner: escrowOwner }, currentRippleTime, wallet.classicAddress, 'finishEscrow', this.escrowFulfillmentField);
               console.log(`escrowStatus: `, escrowStatus);

               // if (!escrowStatus.canFinish) {
               // return this.setError(`ERROR: ${escrowStatus.reasonFinish}`);
               // }

               let escrowCancelTx: xrpl.EscrowCancel = {
                    TransactionType: 'EscrowCancel',
                    Account: wallet.classicAddress,
                    Owner: escrowOwner,
                    OfferSequence: parseInt(this.escrowSequenceNumberField),
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               await this.setTxOptionalFields(client, escrowCancelTx, wallet, accountInfo, 'cancel');

               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, escrowCancelTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Cancelling Conditional Escrow (no changes will be made)...' : 'Submitting to Ledger...');

               if (this.isSimulateEnabled) {
                    const simulation = await this.xrplTransactions.simulateTransaction(client, escrowCancelTx);

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
                    let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, escrowCancelTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

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

                    // PARALLELIZE
                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              if (this.currencyFieldDropDownValue !== 'XRP') {
                                   await this.updatedTokenBalance(client, updatedAccountInfo, updatedAccountObjects, wallet);
                                   await this.toggleIssuerField();
                              }
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              await this.updateXrpBalance(client, updatedAccountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
          } catch (error: any) {
               console.error('Error in cancelEscrow:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving cancelEscrow in ${this.executionTime}ms`);
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

     private async setTxOptionalFields(client: xrpl.Client, escrowTx: any, wallet: xrpl.Wallet, accountInfo: any, txType: string) {
          if (this.selectedSingleTicket) {
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.selectedSingleTicket));
               if (!ticketExists) {
                    return this.setError(`ERROR: Ticket Sequence ${this.selectedSingleTicket} not found for account ${wallet.classicAddress}`);
               }
               this.utilsService.setTicketSequence(escrowTx, this.selectedSingleTicket, true);
          } else {
               if (this.multiSelectMode && this.selectedTickets.length > 0) {
                    console.log('Setting multiple tickets:', this.selectedTickets);
                    this.utilsService.setTicketSequence(escrowTx, accountInfo.result.account_data.Sequence, false);
               }
          }

          if (this.destinationTagField && parseInt(this.destinationTagField) > 0) {
               this.utilsService.setDestinationTag(escrowTx, this.destinationTagField);
          }
          if (this.memoField) {
               this.utilsService.setMemoField(escrowTx, this.memoField);
          }

          if (txType === 'create') {
               if (this.isMptEnabled) {
                    const curr: xrpl.MPTAmount = {
                         mpt_issuance_id: this.mptIssuanceIdField,
                         value: this.amountField,
                    };
                    escrowTx.Amount = curr;
               } else if (this.currencyFieldDropDownValue !== 'XRP') {
                    const curr: xrpl.IssuedCurrencyAmount = {
                         currency: this.currencyFieldDropDownValue.length > 3 ? this.utilsService.encodeCurrencyCode(this.currencyFieldDropDownValue) : this.currencyFieldDropDownValue,
                         issuer: this.selectedIssuer,
                         value: this.amountField,
                    };
                    escrowTx.Amount = curr;
               } else {
                    escrowTx.Amount = xrpl.xrpToDrops(this.amountField);
               }
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
                                   const weight = entry.SignerEntry.SignerWeight ?? '';
                                   signerAccounts.push(`${entry.SignerEntry.Account}~${weight}`);
                                   this.signerQuorum = obj.SignerQuorum;
                              }
                         });
                    }
               });
          }
          return signerAccounts;
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

     private async updateXrpBalance(client: xrpl.Client, accountInfo: xrpl.AccountInfoResponse, wallet: xrpl.Wallet) {
          const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, accountInfo, wallet.classicAddress);

          this.ownerCount = ownerCount;
          this.totalXrpReserves = totalXrpReserves;

          const balance = (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0');
          this.account1.balance = balance.toString();
     }

     private refreshUiAccountObjects(accountObjects: xrpl.AccountObjectsResponse, accountInfo: xrpl.AccountInfoResponse, wallet: xrpl.Wallet) {
          this.ticketArray = this.getAccountTickets(accountObjects);
          if (this.ticketArray.length > 0) {
               this.selectedTicket = this.ticketArray[0];
          }

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

          // if (isMasterKeyDisabled && signerAccounts && signerAccounts.length > 0) {
          //      this.useMultiSign = true; // Force to true if master key is disabled
          // } else {
          //      this.useMultiSign = false;
          // }

          if (signerAccounts && signerAccounts.length > 0) {
               this.multiSigningEnabled = true;
          } else {
               this.multiSigningEnabled = false;
          }

          this.clearFields(false);
     }

     private refreshUiAccountInfo(accountInfo: xrpl.AccountInfoResponse) {
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

          // if (isMasterKeyDisabled && xrpl.isValidAddress(this.regularKeyAddress)) {
          //      this.isRegularKeyAddress = true; // Force to true if master key is disabled
          // } else {
          //      this.isRegularKeyAddress = false;
          // }

          if (regularKey) {
               this.regularKeySigningEnabled = true;
          } else {
               this.regularKeySigningEnabled = false;
          }
     }

     private async validateInputs(inputs: ValidationInputs, action: string): Promise<string[]> {
          const errors: string[] = [];

          // --- Shared skip helper ---
          const shouldSkipNumericValidation = (value: string | undefined): boolean => {
               return value === undefined || value === null || value.trim() === '';
          };

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

          const isValidNumber = (value: string | undefined, fieldName: string, minValue?: number, allowEmpty: boolean = false): string | null => {
               // Skip number validation if value is empty — required() will handle it
               if (shouldSkipNumericValidation(value) || (allowEmpty && value === '')) return null;

               // ✅ Type-safe parse
               const num = parseFloat(value as string);

               if (isNaN(num) || !isFinite(num)) {
                    return `${fieldName} must be a valid number`;
               }
               if (minValue !== undefined && num <= minValue) {
                    return `${fieldName} must be greater than ${minValue}`;
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

          const isValidCondition = (value: string | undefined): string | null => {
               if (value && !this.utilsService.validateCondition(value)) {
                    return 'Escrow condition is invalid';
               }
               return null;
          };

          const isValidFulfillment = (value: string | undefined, condition: string | undefined): string | null => {
               if (value && !this.utilsService.validateFulfillment(value, condition ?? '')) {
                    return 'Escrow fulfillment is invalid';
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
               getEscrowOwnerAddress: {
                    required: ['senderAddress'],
                    customValidators: [() => isValidXrpAddress(inputs.senderAddress, 'Account not found'), () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null)],
                    asyncValidators: [],
               },
               toggleIssuerField: {
                    required: ['selectedAccount', 'seed'],
                    customValidators: [() => isValidSeed(inputs.seed), () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null)],
                    asyncValidators: [],
               },
               get: {
                    required: ['selectedAccount', 'seed'],
                    customValidators: [() => isValidSeed(inputs.seed), () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null)],
                    asyncValidators: [],
               },
               create: {
                    required: ['selectedAccount', 'seed', 'amount', 'destination', 'conditionField', 'cancelTime'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.amount, 'XRP Amount', 0),
                         () => isValidXrpAddress(inputs.destination, 'Destination'),
                         () => isValidNumber(inputs.cancelTime, 'Escrow cancel time', 0),
                         () => isValidCondition(inputs.conditionField),
                         () => isValidNumber(inputs.destinationTag, 'Destination Tag', 0, true), // Allow empty
                         () => isNotSelfPayment(inputs.senderAddress, inputs.destination),
                         () => (inputs.currency !== 'XRP' && !inputs.selectedIssuer ? 'Issuer is required for non-XRP currencies' : null),
                         () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                         () => (inputs.account_info.result.account_flags.disableMasterKey && !inputs.useMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                         () => (inputs.isTicket ? isRequired(inputs.selectedSingleTicket, 'Ticket Sequence') : null),
                         () => (inputs.isTicket ? isValidNumber(inputs.selectedSingleTicket, 'Ticket Sequence', 0) : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                    ],
                    asyncValidators: [checkDestinationTagRequirement],
               },
               finish: {
                    required: ['selectedAccount', 'seed', 'escrowSequence', 'conditionField', 'fulfillment'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.escrowSequence, 'Escrow sequence number', 0),
                         () => isValidCondition(inputs.conditionField),
                         () => isValidFulfillment(inputs.fulfillment, inputs.conditionField),
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
               cancel: {
                    required: ['selectedAccount', 'seed', 'escrowSequence'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.escrowSequence, 'Escrow sequence number', 0),
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

          // Selected account check (common to most)
          if (inputs.selectedAccount === undefined || inputs.selectedAccount === null) {
               errors.push('Please select an account');
          }

          return errors;
     }

     private async updateCurrencyBalance(wallet: xrpl.Wallet, accountObjects: any) {
          let balance: string;
          const currencyCode = this.utilsService.encodeIfNeeded(this.currencyFieldDropDownValue);
          if (wallet.classicAddress) {
               const balanceResult = await this.utilsService.getCurrencyBalance(currencyCode, accountObjects);
               balance = balanceResult !== null ? balanceResult.toString() : '0';
               this.tokenBalance = this.utilsService.formatTokenBalance(balance, 18);
          } else {
               this.tokenBalance = '0';
          }
     }

     private updateDestinations() {
          const knownDestinationsTemp = this.utilsService.populateKnownDestinations(this.knownDestinations, this.account1.address, this.account2.address, this.issuer.address);
          // this.destinations = [...Object.values(knownDestinationsTemp)];
          this.destinations = Object.values(this.knownDestinations).filter((d): d is string => typeof d === 'string' && d.trim() !== '');
          this.storageService.setKnownIssuers('destinations', knownDestinationsTemp);
          this.destinationFields = this.issuer.address;
     }

     private async getWallet() {
          const environment = this.xrplService.getNet().environment;
          const seed = this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer);
          const wallet = await this.utilsService.getWallet(seed, environment);
          if (!wallet) {
               throw new Error('ERROR: Wallet could not be created or is undefined');
          }
          return wallet;
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
                    await this.getEscrows();
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
               this.escrowConditionField = '';
               this.escrowFulfillmentField = '';
               this.escrowCancelTimeField = '';
               this.escrowFinishTimeField = '';
          }

          this.amountField = '';
          this.destinationTagField = '';
          this.escrowSequenceNumberField = '';
          this.isMemoEnabled = false;
          this.memoField = '';
          this.ticketSequence = '';
          this.isTicket = false;
          this.cdr.detectChanges();
     }

     private async showSpinnerWithDelay(message: string, delayMs: number = 200) {
          this.spinner = true;
          this.updateSpinnerMessage(message);
          await new Promise(resolve => setTimeout(resolve, delayMs)); // Minimum display time for initial spinner
     }

     private updateSpinnerMessage(message: string) {
          this.spinnerMessage = message;
          this.cdr.detectChanges();
          console.log('Spinner message updated:', message); // For debugging
     }

     private updateCurrencies() {
          this.currencies = [...Object.keys(this.knownTrustLinesIssuers)];
     }

     addToken() {
          if (this.newCurrency && this.newCurrency.trim() && this.newIssuer && this.newIssuer.trim()) {
               const currency = this.newCurrency.trim();
               if (this.knownTrustLinesIssuers[currency]) {
                    this.setError(`Currency ${currency} already exists`);
                    return;
               }
               if (!this.utilsService.isValidCurrencyCode(currency)) {
                    this.setError('Invalid currency code: Must be 3-20 characters or valid hex');
                    return;
               }
               if (!xrpl.isValidAddress(this.newIssuer.trim())) {
                    this.setError('Invalid issuer address');
                    return;
               }
               this.knownTrustLinesIssuers[currency] = this.newIssuer.trim();
               this.storageService.setKnownIssuers('knownIssuers', this.knownTrustLinesIssuers);
               this.updateCurrencies();
               this.newCurrency = '';
               this.newIssuer = '';
               this.setSuccess(`Added ${currency} with issuer ${this.knownTrustLinesIssuers[currency]}`);
               this.cdr.detectChanges();
          } else {
               this.setError('Currency code and issuer address are required');
          }
          this.spinner = false;
     }

     removeToken() {
          if (this.tokenToRemove) {
               delete this.knownTrustLinesIssuers[this.tokenToRemove];
               this.storageService.setKnownIssuers('knownIssuers', this.knownTrustLinesIssuers);
               this.updateCurrencies();
               this.setSuccess(`Removed ${this.tokenToRemove}`);
               this.tokenToRemove = '';
               this.cdr.detectChanges();
          } else {
               this.setError('Select a token to remove');
          }
          this.spinner = false;
     }

     getCondition() {
          const { condition, fulfillment } = this.generateCondition();
          this.escrowConditionField = condition;
          this.escrowFulfillmentField = fulfillment;
     }

     generateCondition(): { condition: string; fulfillment: string } {
          console.log('Generating a cryptographic condition and fulfillment for XRPL escrow');

          // Use Web Crypto API to generate 32 random bytes
          const preimage = new Uint8Array(32);
          globalThis.crypto.getRandomValues(preimage); // Browser-compatible random bytes

          // Create a PREIMAGE-SHA-256 condition
          const fulfillment = new cc.PreimageSha256();
          fulfillment.setPreimage(Buffer.from(preimage)); // Convert Uint8Array to Buffer

          // Get the condition (hash of the preimage) in hexadecimal
          const condition = fulfillment.getConditionBinary().toString('hex').toUpperCase();

          // Get the fulfillment (preimage) in hexadecimal, to be kept secret
          const fulfillment_hex = fulfillment.serializeBinary().toString('hex').toUpperCase();

          console.log('Condition:', condition);
          console.log('Fulfillment (keep secret until ready to finish escrow):', fulfillment_hex);

          return { condition, fulfillment: fulfillment_hex };
     }

     populateDefaultDateTime() {
          if (!this.escrowCancelDateTimeField) {
               const now = new Date();

               const year = now.getFullYear();
               const month = String(now.getMonth() + 1).padStart(2, '0');
               const day = String(now.getDate()).padStart(2, '0');
               const hours = String(now.getHours()).padStart(2, '0');
               const minutes = String(now.getMinutes()).padStart(2, '0');
               const seconds = String(now.getSeconds()).padStart(2, '0');

               this.escrowCancelDateTimeField = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
          }
     }

     displayAmount(amount: any): string {
          let displayAmount;
          if (typeof amount === 'string') {
               // Native XRP escrow
               displayAmount = `${xrpl.dropsToXrp(amount)} XRP`;
          } else if (typeof amount === 'object' && amount.currency) {
               // IOU or MPT
               let currency = amount.currency;

               // Detect hex MPT currency code
               if (/^[0-9A-F]{40}$/i.test(currency)) {
                    try {
                         currency = this.utilsService.normalizeCurrencyCode(currency);
                    } catch (e) {
                         // fallback: leave as hex if decode fails
                    }
               }

               displayAmount = `${amount.value} ${currency} Issuer: <code>${amount.issuer}</code>`;
          } else {
               displayAmount = 'N/A';
          }
          return displayAmount;
     }

     private async updatedTokenBalance(client: xrpl.Client, accountInfo: any, accountObjects: any, wallet: xrpl.Wallet) {
          const tokenBalanceData = await this.utilsService.getTokenBalance(client, accountInfo, wallet.classicAddress, this.currencyFieldDropDownValue, '');
          this.issuers = tokenBalanceData.issuers;
          this.tokenBalance = tokenBalanceData.total.toString();
          const balanceResult = await this.utilsService.getCurrencyBalance(this.currencyFieldDropDownValue, accountObjects);
          console.log(`balanceResult ${balanceResult}`);
          if (balanceResult) {
               this.tokenBalance = Math.abs(balanceResult).toString();
          }
          if (this.selectedAccount === 'account1') {
               this.account1.balance = tokenBalanceData.xrpBalance.toString();
          } else if (this.selectedAccount === 'account2') {
               this.account2.balance = tokenBalanceData.xrpBalance.toString();
          } else {
               this.issuer.balance = tokenBalanceData.xrpBalance.toString();
          }
          this.currencyIssuers = [this.knownTrustLinesIssuers[this.currencyFieldDropDownValue] || ''];
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
