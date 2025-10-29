import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { StorageService } from '../../services/storage.service';
import { CheckCreate, CheckCash, CheckCancel } from 'xrpl';
import * as xrpl from 'xrpl';
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
     checkId?: string;
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

@Component({
     selector: 'app-send-checks',
     standalone: true,
     imports: [CommonModule, FormsModule, AppWalletDynamicInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './send-checks.component.html',
     styleUrl: './send-checks.component.css',
})
export class SendChecksComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     @ViewChild('accountForm') accountForm!: NgForm;
     lastResult: string = '';
     result: string = '';
     currencyFieldDropDownValue: string = 'XRP';
     checkExpirationTime: string = 'seconds';
     expirationTimeField: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = false;
     ticketSequence: string = '';
     isTicket: boolean = false;
     ticketArray: string[] = [];
     selectedTickets: string[] = [];
     selectedSingleTicket: string = '';
     multiSelectMode: boolean = false;
     selectedTicket: string = '';
     selectedAccount: string = '';
     checkIdField: string = '';
     ownerCount: string = '';
     totalXrpReserves: string = '';
     executionTime: string = '';
     amountField: string = '';
     destinationTagField: string = '';
     mptIssuanceIdField: string = '';
     isMptEnabled: boolean = false;
     memoField: string = '';
     isMemoEnabled: boolean = false;
     multiSignAddress: string = '';
     useMultiSign: boolean = false;
     multiSignSeeds: string = '';
     isRegularKeyAddress: boolean = false;
     regularKeySeed: string = '';
     regularKeyAddress: string = '';
     signerQuorum: number = 0;
     multiSigningEnabled: boolean = false;
     regularKeySigningEnabled: boolean = false;
     spinner: boolean = false;
     issuers: { name?: string; address: string }[] = [];
     destinationFields: string = '';
     spinnerMessage: string = '';
     masterKeyDisabled: boolean = false;
     tokenBalance: string = '0';
     gatewayBalance: string = '0';
     // private knownTrustLinesIssuers: { [key: string]: string } = {XRP: '',};
     knownTrustLinesIssuers: { [key: string]: string[] } = { XRP: [] };
     issuerToRemove: string = '';
     currencies: string[] = [];
     // currencyIssuers: string[] = [];
     newCurrency: string = '';
     newIssuer: string = '';
     tokenToRemove: string = '';
     selectedIssuer: string = '';
     isSimulateEnabled: boolean = false;
     signers: { account: string; seed: string; weight: number }[] = [{ account: '', seed: '', weight: 1 }];
     wallets: any[] = [];
     selectedWalletIndex: number = 0;
     currentWallet = { name: '', address: '', seed: '', balance: '' };
     destinations: { name?: string; address: string }[] = [];
     currencyIssuers: { name?: string; address: string }[] = [];
     private lastCurrency: string = '';
     private lastIssuer: string = '';
     showManageTokens: boolean = false;

     constructor(private readonly xrplService: XrplService, private readonly utilsService: UtilsService, private readonly cdr: ChangeDetectorRef, private readonly storageService: StorageService, private readonly renderUiComponentsService: RenderUiComponentsService, private readonly xrplTransactions: XrplTransactionService, private readonly clickToCopyService: ClickToCopyService) {}

     ngOnInit() {
          const storedIssuers = this.storageService.getKnownIssuers('knownIssuers');
          if (storedIssuers) {
               this.knownTrustLinesIssuers = storedIssuers;
          }
          this.updateCurrencies();
          this.currencyFieldDropDownValue = 'XRP'; // Set default to XRP
     }

     ngAfterViewInit() {}

     ngAfterViewChecked() {
          if (this.result !== this.lastResult && this.resultField?.nativeElement) {
               this.renderUiComponentsService.attachSearchListener(this.resultField.nativeElement);
               this.lastResult = this.result;
               this.cdr.markForCheck();
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
          this.cdr.markForCheck();
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
               await this.getChecks();
          } else if (this.currentWallet.address) {
               this.setError('Invalid XRP address');
          }
     }

     validateQuorum() {
          const totalWeight = this.signers.reduce((sum, s) => sum + (s.weight || 0), 0);
          if (this.signerQuorum > totalWeight) {
               this.signerQuorum = totalWeight;
          }
          this.cdr.markForCheck();
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
               this.cdr.markForCheck();
          }
     }

     async toggleUseMultiSign() {
          if (this.multiSignAddress === 'No Multi-Sign address configured for account') {
               this.multiSignSeeds = '';
          }
          this.cdr.markForCheck();
     }

     toggleTicketSequence() {
          this.cdr.markForCheck();
     }

     onTicketToggle(event: any, ticket: string) {
          if (event.target.checked) {
               this.selectedTickets = [...this.selectedTickets, ticket];
          } else {
               this.selectedTickets = this.selectedTickets.filter(t => t !== ticket);
          }
     }

     async getChecks() {
          console.log('Entering getChecks');
          const startTime = Date.now();
          this.setSuccessProperties();
          this.updateSpinnerMessage(``);

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }
               this.updateSpinnerMessage(`Getting Checks`);

               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const [accountInfo, checkObjects, accountObjects, tokenBalance, mptAccountTokens] = await Promise.all([
                    this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''),
                    this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'check'),
                    this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''),
                    this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', ''),
                    this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'mptoken'),
               ]);
               this.utilsService.logAccountInfoObjects(accountInfo, accountObjects);
               this.utilsService.logObjects('checkObjects', checkObjects);
               this.utilsService.logObjects('tokenBalance', tokenBalance);
               this.utilsService.logObjects('mptAccountTokens', mptAccountTokens);

               const inputs: ValidationInputs = {
                    seed: this.currentWallet.seed,
                    account_info: accountInfo,
               };

               const errors = await this.validateInputs(inputs, 'getChecks');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               const data = { sections: [{}] };

               if (checkObjects.result.account_objects.length <= 0) {
                    data.sections.push({
                         title: 'Checks',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No checks found for <code>${wallet.classicAddress}</code>` }],
                    });
               } else {
                    data.sections.push({
                         title: `Checks (${checkObjects.result.account_objects.length})`,
                         openByDefault: true,
                         subItems: checkObjects.result.account_objects.map((check, counter) => {
                              const Account = (check as any)['Account'];
                              const Destination = (check as any)['Destination'];
                              const Amount = (check as any)['Amount'];
                              const Expiration = (check as any)['Expiration'];
                              const InvoiceID = (check as any)['InvoiceID'];
                              const DestinationTag = (check as any)['DestinationTag'];
                              const SourceTag = (check as any)['SourceTag'];
                              const PreviousTxnID = (check as any)['PreviousTxnID'];
                              const PreviousTxnLgrSeq = (check as any)['PreviousTxnLgrSeq'];
                              const Sequence = (check as any)['Sequence'];
                              const index = (check as any)['index'];
                              const sendMax = (check as any).SendMax;
                              const amountValue = Amount || sendMax;
                              const amountDisplay = amountValue ? (typeof amountValue === 'string' ? `${xrpl.dropsToXrp(amountValue)} XRP` : `${this.utilsService.formatTokenBalance(amountValue.value.toString(), 18)} ${amountValue.currency} (<code>${amountValue.issuer}</code>)`) : 'N/A';
                              return {
                                   key: `Check ${counter + 1} (ID: ${PreviousTxnID?.slice(0, 8) || ''}...)`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Account', value: `<code>${Account}</code>` },
                                        { key: 'Destination', value: `<code>${Destination}</code>` },
                                        { key: 'Check ID / Ledger Index', value: `<code>${index}</code>` },
                                        { key: 'Previous Txn ID', value: `<code>${PreviousTxnID}</code>` },
                                        { key: 'Previous Txn Ledger Sequence', value: `<code>${PreviousTxnLgrSeq}</code>` },
                                        { key: Amount ? 'Amount' : 'SendMax', value: amountDisplay },
                                        { key: 'Sequence', value: `<code>${Sequence}</code>` },
                                        ...(Expiration ? [{ key: 'Expiration', value: new Date(Expiration * 1000).toLocaleString() }] : []),
                                        ...(InvoiceID ? [{ key: 'Invoice ID', value: `<code>${InvoiceID}</code>` }] : []),
                                        ...(DestinationTag ? [{ key: 'Destination Tag', value: String(DestinationTag) }] : []),
                                        ...(SourceTag ? [{ key: 'Source Tag', value: String(SourceTag) }] : []),
                                   ],
                              };
                         }),
                    });
               }

               // --- Add Obligations Section ---
               if (tokenBalance.result.obligations && Object.keys(tokenBalance.result.obligations).length > 0) {
                    const obligationsSection = {
                         title: `Obligations (${Object.keys(tokenBalance.result.obligations).length})`,
                         openByDefault: true,
                         subItems: Object.entries(tokenBalance.result.obligations).map(([currency, amount], index) => ({
                              key: `Obligation ${index + 1} (${this.utilsService.decodeIfNeeded(currency)})`,
                              openByDefault: false,
                              content: [
                                   { key: 'Currency', value: this.utilsService.decodeIfNeeded(currency) },
                                   { key: 'Amount', value: this.utilsService.formatTokenBalance(amount.toString(), 18) },
                              ],
                         })),
                    };
                    data.sections.push(obligationsSection);
               }

               // --- Add Balances Section ---
               if (tokenBalance.result.assets && Object.keys(tokenBalance.result.assets).length > 0) {
                    const balanceItems = [];
                    for (const [issuer, currencies] of Object.entries(tokenBalance.result.assets)) {
                         for (const { currency, value } of currencies) {
                              const displayCurrency = this.utilsService.formatValueForKey('currency', currency);
                              balanceItems.push({
                                   key: `${this.utilsService.formatCurrencyForDisplay(currency)} from ${issuer}`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Currency', value: displayCurrency },
                                        { key: 'Issuer', value: `<code>${issuer}</code>` },
                                        { key: 'Amount', value: this.utilsService.formatTokenBalance(value.toString(), 18) },
                                   ],
                              });
                         }
                    }
                    const balancesSection = {
                         title: `IOU Tokens (${balanceItems.length})`,
                         openByDefault: true,
                         subItems: balanceItems,
                    };
                    data.sections.push(balancesSection);
               }

               // const mptokens = (mptAccountTokens.result.account_objects as any[]).filter((obj: any) => this.utilsService.isMPT(obj) && 'MPTAmount' in obj) as unknown as MPToken[];

               // if (mptokens.length <= 0) {
               //      data.sections.push({
               //           title: 'MPT Tokens',
               //           openByDefault: true,
               //           content: [{ key: 'Status', value: `No MPT tokens found for <code>${wallet.classicAddress}</code>` }],
               //      });
               // } else {
               //      // Sort by Sequence (oldest first)
               //      const sortedMPT = [...mptokens].sort((a, b) => {
               //           const seqA = (a as any).Sequence ?? Number.MAX_SAFE_INTEGER;
               //           const seqB = (b as any).Sequence ?? Number.MAX_SAFE_INTEGER;
               //           return seqA - seqB;
               //      });

               //      data.sections.push({
               //           title: `MPT Token (${mptokens.length})`,
               //           openByDefault: true,
               //           subItems: sortedMPT.map((mpt, counter) => {
               //                const { LedgerEntryType, PreviousTxnID, index } = mpt;
               //                // TicketSequence and Flags may not exist on all AccountObject types
               //                const ticketSequence = (mpt as any).TicketSequence;
               //                const flags = (mpt as any).Flags;
               //                const mptIssuanceId = (mpt as any).mpt_issuance_id || (mpt as any).MPTokenIssuanceID;
               //                return {
               //                     key: `MPT ${counter + 1} (ID: ${index.slice(0, 8)}...)`,
               //                     openByDefault: false,
               //                     content: [
               //                          { key: 'MPT Issuance ID', value: `<code>${mptIssuanceId}</code>` },
               //                          { key: 'Ledger Entry Type', value: LedgerEntryType },
               //                          { key: 'Previous Txn ID', value: `<code>${PreviousTxnID}</code>` },
               //                          ...(ticketSequence ? [{ key: 'Ticket Sequence', value: String(ticketSequence) }] : []),
               //                          ...(flags !== undefined ? [{ key: 'Flags', value: this.utilsService.getMptFlagsReadable(Number(flags)) }] : []),
               //                          // Optionally display custom fields if present
               //                          ...((mpt as any)['MPTAmount'] ? [{ key: 'MPTAmount', value: String((mpt as any)['MPTAmount']) }] : []),
               //                          ...((mpt as any)['MPTokenMetadata'] ? [{ key: 'MPTokenMetadata', value: xrpl.convertHexToString((mpt as any)['MPTokenMetadata']) }] : []),
               //                          ...((mpt as any)['MaximumAmount'] ? [{ key: 'MaximumAmount', value: String((mpt as any)['MaximumAmount']) }] : []),
               //                          ...((mpt as any)['OutstandingAmount'] ? [{ key: 'OutstandingAmount', value: String((mpt as any)['OutstandingAmount']) }] : []),
               //                          ...((mpt as any)['TransferFee'] ? [{ key: 'TransferFee', value: String((mpt as any)['TransferFee']) }] : []),
               //                          ...((mpt as any)['MPTIssuanceID'] ? [{ key: 'MPTIssuanceID', value: String((mpt as any)['MPTIssuanceID']) }] : []),
               //                     ],
               //                };
               //           }),
               //      });
               // }

               if (this.currencyFieldDropDownValue !== 'XRP' && this.selectedIssuer !== '') {
                    const tokenBalance = await this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '');
                    console.debug('Token Balance:', tokenBalance.result);

                    console.debug(`parseAllGatewayBalances:`, this.parseAllGatewayBalances(tokenBalance, wallet));
                    const parsedBalances = this.parseAllGatewayBalances(tokenBalance, wallet);
                    if (parsedBalances && Object.keys(parsedBalances).length > 0) {
                         this.tokenBalance = parsedBalances?.[this.currencyFieldDropDownValue]?.[this.selectedIssuer] ?? '0';
                    } else {
                         this.tokenBalance = '0';
                    }
               }

               this.renderUiComponentsService.renderDetails(data);
               this.setSuccess(this.result);
               this.clickToCopyService.attachCopy(this.resultField.nativeElement);

               // DEFER: Non-critical UI updates — let main render complete first
               setTimeout(async () => {
                    try {
                         this.refreshUIData(wallet, accountInfo, accountObjects);
                         this.utilsService.loadSignerList(wallet.classicAddress, this.signers);

                         // await this.toggleIssuerField();
                         // if (this.currencyFieldDropDownValue !== 'XRP') {
                         //      await this.updateCurrencyBalance(gatewayBalances, wallet);
                         // }

                         this.updateTickets(accountObjects);
                         // this.updateGatewayBalance(await this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', ''));
                         await this.updateXrpBalance(client, accountInfo, wallet);
                         this.clearFields(false);
                    } catch (err) {
                         console.error('Error in deferred UI updates:', err);
                    }
               }, 0);
          } catch (error: any) {
               console.error('Error in getChecks:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getChecks in ${this.executionTime}ms`);
          }
     }

     async sendCheck() {
          console.log('Entering sendCheck');
          const startTime = Date.now();
          this.setSuccessProperties();
          this.updateSpinnerMessage(``);

          const inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
               senderAddress: this.currentWallet.address,
               amount: this.amountField,
               destination: this.destinationFields,
               destinationTag: this.destinationTagField,
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

          let checkExpiration = '';
          if (this.expirationTimeField != '') {
               if (isNaN(parseFloat(this.expirationTimeField)) || parseFloat(this.expirationTimeField) <= 0) {
                    return this.setError('ERROR: Expiration time must be a valid number greater than zero');
               }
               const expirationTimeValue = this.expirationTimeField;
               checkExpiration = this.utilsService.addTime(parseInt(expirationTimeValue), this.checkExpirationTime as 'seconds' | 'minutes' | 'hours' | 'days').toString();
               console.log(`Raw expirationTime: ${expirationTimeValue} finishUnit: ${this.checkExpirationTime} checkExpiration: ${this.utilsService.convertXRPLTime(parseInt(checkExpiration))}`);
          }

          // Check for positive number (greater than 0)
          if (this.tokenBalance && this.tokenBalance !== '' && this.currencyFieldDropDownValue !== AppConstants.XRP_CURRENCY) {
               const balance = Number(this.utilsService.removeCommaFromAmount(this.tokenBalance));

               if (isNaN(balance)) {
                    return this.setError('ERROR: Token balance must be a number');
               }

               if (balance <= 0) {
                    return this.setError('ERROR: Token balance must be greater than 0');
               }

               if (parseFloat(balance.toString()) < parseFloat(this.amountField)) {
                    return this.setError(`ERROR: Insufficient token balance. Amount is to high`);
               }
          }

          if (this.issuers && this.tokenBalance != '' && Number(this.tokenBalance) > 0 && this.issuers.length === 0) {
               return this.setError('ERROR: Issuer can not be empty when sending a token for a check');
          }

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }

               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const [accountInfo, trustLines, fee, currentLedger, serverInfo] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), this.xrplService.getXrplServerInfo(client, 'current', '')]);
               this.utilsService.logAccountInfoObjects(accountInfo, null);
               this.utilsService.logObjects('trustLines', trustLines);
               this.utilsService.logLedgerObjects(fee, currentLedger, serverInfo);

               inputs.account_info = accountInfo;

               const errors = await this.validateInputs(inputs, 'sendCheck');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               // Build SendMax amount
               const curr: xrpl.MPTAmount = {
                    mpt_issuance_id: this.mptIssuanceIdField,
                    value: this.amountField,
               };

               let sendMax;
               if (this.currencyFieldDropDownValue === AppConstants.XRP_CURRENCY) {
                    // if (this.isMptEnabled) {
                    // sendMax = curr;
                    // } else {
                    sendMax = xrpl.xrpToDrops(this.amountField);
                    // }
               } else {
                    sendMax = {
                         currency: this.utilsService.encodeIfNeeded(this.currencyFieldDropDownValue),
                         value: this.amountField,
                         issuer: this.selectedIssuer,
                    };
               }

               let checkCreateTx: CheckCreate = await client.autofill({
                    TransactionType: 'CheckCreate',
                    Account: wallet.classicAddress,
                    SendMax: sendMax,
                    Destination: this.destinationFields,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               });

               await this.setTxOptionalFields(client, checkCreateTx, wallet, accountInfo, checkExpiration, 'create');

               if (this.currencyFieldDropDownValue === AppConstants.XRP_CURRENCY) {
                    if (this.amountField || this.amountField === '') {
                         if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, checkCreateTx, fee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    } else {
                         if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, this.amountField, wallet.classicAddress, checkCreateTx, fee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    }
               } else {
                    if (this.utilsService.isInsufficientIouTrustlineBalance(trustLines, checkCreateTx, this.destinationFields)) {
                         return this.setError('ERROR: Not enough IOU balance for this transaction');
                    }
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Sending Check (no changes will be made)...' : 'Submitting Send Check to Ledger...');

               let response: any;

               if (this.isSimulateEnabled) {
                    response = await this.xrplTransactions.simulateTransaction(client, checkCreateTx);
               } else {
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    const signedTx = await this.xrplTransactions.signTransaction(client, wallet, checkCreateTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

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
                    const [updatedAccountInfo, updatedAccountObjects, gatewayBalances] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              if (this.currencyFieldDropDownValue !== 'XRP') {
                                   await this.updateCurrencyBalance(gatewayBalances, wallet);
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
               console.error('Error in sendCheck:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving sendCheck in ${this.executionTime}ms`);
          }
     }

     async cashCheck() {
          console.log('Entering cashCheck');
          const startTime = Date.now();
          this.setSuccessProperties();
          this.updateSpinnerMessage(``);

          const inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.currentWallet.seed,
               destination: this.destinationFields,
               amount: this.amountField,
               checkId: this.checkIdField,
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

               const [accountInfo, trustLines, checkObjects, fee, currentLedger, serverInfo] = await Promise.all([
                    this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''),
                    this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', ''),
                    this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'check'),
                    this.xrplService.calculateTransactionFee(client),
                    this.xrplService.getLastLedgerIndex(client),
                    this.xrplService.getXrplServerInfo(client, 'current', ''),
               ]);
               this.utilsService.logAccountInfoObjects(accountInfo, null);
               this.utilsService.logObjects('trustLines', trustLines);
               this.utilsService.logObjects('checkObjects', checkObjects);
               this.utilsService.logLedgerObjects(fee, currentLedger, serverInfo);

               inputs.account_info = accountInfo;

               const errors = await this.validateInputs(inputs, 'cashCheck');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               if (this.currencyFieldDropDownValue !== AppConstants.XRP_CURRENCY) {
                    console.debug(`checkObjects for ${wallet.classicAddress}:`, checkObjects.result);
                    const issuer = this.getIssuerForCheck(checkObjects.result.account_objects, this.checkIdField);
                    console.log('Issuer:', issuer);
                    if (issuer) {
                         this.selectedIssuer = issuer;
                    }
               }

               // Build amount object depending on currency
               const amountToCash =
                    this.currencyFieldDropDownValue === AppConstants.XRP_CURRENCY
                         ? xrpl.xrpToDrops(this.amountField)
                         : {
                                value: this.amountField,
                                currency: this.utilsService.encodeIfNeeded(this.currencyFieldDropDownValue),
                                issuer: this.selectedIssuer,
                           };

               let checkCashTx: CheckCash = await client.autofill({
                    TransactionType: 'CheckCash',
                    Account: wallet.classicAddress,
                    Amount: amountToCash,
                    CheckID: this.checkIdField,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               });

               await this.setTxOptionalFields(client, checkCashTx, wallet, accountInfo, null, 'finish');

               if (this.currencyFieldDropDownValue === AppConstants.XRP_CURRENCY) {
                    if (this.amountField || this.amountField === '') {
                         if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, checkCashTx, fee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    } else {
                         if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, this.amountField, wallet.classicAddress, checkCashTx, fee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    }
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Cashing Check (no changes will be made)...' : 'Submitting Cash Check to Ledger...');

               let response: any;

               if (this.isSimulateEnabled) {
                    response = await this.xrplTransactions.simulateTransaction(client, checkCashTx);
               } else {
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    const signedTx = await this.xrplTransactions.signTransaction(client, wallet, checkCashTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

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
                    const [updatedAccountInfo, updatedAccountObjects, gatewayBalances] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              if (this.currencyFieldDropDownValue !== 'XRP') {
                                   await this.updateCurrencyBalance(gatewayBalances, wallet);
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
               console.error('Error in cashCheck:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving cashCheck in ${this.executionTime}ms`);
          }
     }

     async cancelCheck() {
          console.log('Entering cancelCheck');
          const startTime = Date.now();
          this.setSuccessProperties();
          this.updateSpinnerMessage(``);

          const inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
               checkId: this.checkIdField,
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

               const errors = await this.validateInputs(inputs, 'cancelCheck');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               let checkCancelTx: CheckCancel = await client.autofill({
                    TransactionType: 'CheckCancel',
                    Account: wallet.classicAddress,
                    CheckID: this.checkIdField,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               });

               await this.setTxOptionalFields(client, checkCancelTx, wallet, accountInfo, null, 'cancelCheck');

               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, checkCancelTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Canceling Check (no changes will be made)...' : 'Submitting Cancel Check to Ledger...');

               let response: any;

               if (this.isSimulateEnabled) {
                    response = await this.xrplTransactions.simulateTransaction(client, checkCancelTx);
               } else {
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    const signedTx = await this.xrplTransactions.signTransaction(client, wallet, checkCancelTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

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
                    const [updatedAccountInfo, updatedAccountObjects, gatewayBalances] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              if (this.currencyFieldDropDownValue !== 'XRP') {
                                   await this.updateCurrencyBalance(gatewayBalances, wallet);
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
               console.error('Error in cancelCheck:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving cancelCheck in ${this.executionTime}ms`);
          }
     }

     async toggleIssuerField() {
          console.log('Entering onCurrencyChange');
          const startTime = Date.now();
          this.setSuccessProperties();
          this.updateSpinnerMessage('Updating Currency...');

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const [gatewayBalances] = await Promise.all([this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '')]);

               // Calculate total balance for selected currency
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

               const encodedCurr = this.utilsService.encodeIfNeeded(this.currencyFieldDropDownValue);
               const issuerPromises = this.wallets
                    .filter(w => xrpl.isValidAddress(w.address))
                    .map(async w => {
                         try {
                              const tokenBalance = await this.xrplService.getTokenBalance(client, w.address, 'validated', '');
                              const hasObligation = tokenBalance.result.obligations?.[encodedCurr];

                              if (hasObligation && hasObligation !== '0') {
                                   return { name: w.name, address: w.address };
                              } else if (w.isIssuer === true) {
                                   return { name: w.name, address: w.address };
                              }
                         } catch (err) {
                              console.warn(`Issuer check failed for ${w.address}:`, err);
                         }
                         return null;
                    });

               const issuerResults = await Promise.all(issuerPromises);

               // Step 1: filter out nulls
               const nonNullIssuers = issuerResults.filter((i): i is { name: string; address: string } => {
                    const isValid = i !== null;
                    console.debug('Filtering null:', i, '->', isValid);
                    return isValid;
               });

               // Step 2: remove duplicates by address
               const uniqueIssuers = nonNullIssuers.filter((candidate, index, self) => {
                    const firstIndex = self.findIndex(c => c.address === candidate.address);
                    const isUnique = index === firstIndex;
                    console.debug('Checking uniqueness:', candidate, 'Index:', index, 'First index:', firstIndex, 'Unique?', isUnique);
                    return isUnique;
               });

               console.debug('Unique issuers:', uniqueIssuers);

               this.issuers = uniqueIssuers;

               const knownIssuers = this.knownTrustLinesIssuers[this.currencyFieldDropDownValue] || [];

               if (!this.selectedIssuer || !this.issuers.some(iss => iss.address === this.selectedIssuer)) {
                    let newIssuer = '';

                    // Find the first matching known issuer that exists in available issuers
                    const matchedKnownIssuer = knownIssuers.find(known => this.issuers.some(iss => iss.address === known));

                    if (matchedKnownIssuer) {
                         newIssuer = matchedKnownIssuer;
                    } else if (this.issuers.length > 0) {
                         newIssuer = this.issuers[0].address;
                    } else {
                         newIssuer = '';
                    }

                    this.selectedIssuer = newIssuer;
               }

               if (this.issuers.length === 0) {
                    console.warn(`No issuers found among wallets for currency: ${this.currencyFieldDropDownValue}`);
               }

               if (this.currencyFieldDropDownValue === 'XRP') {
                    this.destinationFields = this.wallets[1]?.address || ''; // Default to first wallet address for XRP
               } else {
                    const currencyChanged = this.lastCurrency !== this.currencyFieldDropDownValue;
                    const issuerChanged = this.lastIssuer !== this.selectedIssuer;
                    if (currencyChanged || issuerChanged) {
                         this.lastCurrency = this.currencyFieldDropDownValue;
                         this.lastIssuer = this.selectedIssuer;
                    }
                    await this.updateCurrencyBalance(gatewayBalances, wallet);
               }
               this.ensureDefaultNotSelected();
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

     private renderTransactionResult(response: any): void {
          if (this.isSimulateEnabled) {
               this.renderUiComponentsService.renderSimulatedTransactionsResults(response, this.resultField.nativeElement);
          } else {
               console.debug(`Response`, response);
               this.renderUiComponentsService.renderTransactionsResults(response, this.resultField.nativeElement);
          }
          this.clickToCopyService.attachCopy(this.resultField.nativeElement);
     }

     private async setTxOptionalFields(client: xrpl.Client, checkTx: any, wallet: xrpl.Wallet, accountInfo: any, checkExpiration: any, txType: string) {
          if (txType === 'create') {
               if (checkExpiration && checkExpiration != '') {
                    this.utilsService.setExpiration(checkTx, Number(checkExpiration));
               }
          }

          if (this.selectedSingleTicket) {
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.selectedSingleTicket));
               if (!ticketExists) {
                    return this.setError(`ERROR: Ticket Sequence ${this.selectedSingleTicket} not found for account ${wallet.classicAddress}`);
               }
               this.utilsService.setTicketSequence(checkTx, this.selectedSingleTicket, true);
          } else {
               if (this.multiSelectMode && this.selectedTickets.length > 0) {
                    console.log('Setting multiple tickets:', this.selectedTickets);
                    this.utilsService.setTicketSequence(checkTx, accountInfo.result.account_data.Sequence, false);
               }
          }

          if (txType === 'create') {
               if (this.destinationTagField && parseInt(this.destinationTagField) > 0) {
                    this.utilsService.setDestinationTag(checkTx, this.destinationTagField);
               }
          }

          if (this.memoField) {
               this.utilsService.setMemoField(checkTx, this.memoField);
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

          const isValidNumber = (value: string | undefined, fieldName: string, minValue?: number, allowEmpty: boolean = false): string | null => {
               // Skip number validation if value is empty — required() will handle it
               if (shouldSkipNumericValidation(value) || (allowEmpty && value === '')) return null;

               // Type-safe parse
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

          const isNotSelfPayment = (sender: string | undefined, receiver: string | undefined): string | null => {
               if (sender && receiver && sender === receiver) {
                    return `Sender and receiver cannot be the same`;
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
               getChecks: {
                    required: ['seed'],
                    customValidators: [() => isValidSeed(inputs.seed)],
                    asyncValidators: [],
               },
               sendCheck: {
                    required: ['seed', 'destination', 'amount'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidXrpAddress(inputs.destination, 'Destination'),
                         () => isValidNumber(inputs.amount, 'Amount', 0),
                         () => isValidNumber(inputs.destinationTag, 'Destination Tag', 0, true), // Allow empty
                         () => isNotSelfPayment(inputs.senderAddress, inputs.destination),
                    ],
                    asyncValidators: [checkDestinationTagRequirement],
               },
               cashCheck: {
                    required: ['seed', 'destination', 'amount', 'checkId'],
                    customValidators: [() => isValidSeed(inputs.seed), () => isValidXrpAddress(inputs.destination, 'Destination'), () => isValidNumber(inputs.amount, 'Amount', 0), () => isRequired(inputs.checkId, 'Check ID'), () => isNotSelfPayment(inputs.senderAddress, inputs.destination)],
                    asyncValidators: [checkDestinationTagRequirement],
               },
               cancelCheck: {
                    required: ['seed', 'checkId'],
                    customValidators: [() => isValidSeed(inputs.seed), () => isRequired(inputs.checkId, 'Check ID')],
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

     private async updateCurrencyBalance(gatewayBalance: xrpl.GatewayBalancesResponse, wallet: xrpl.Wallet) {
          const parsedBalances = this.parseAllGatewayBalances(gatewayBalance, wallet);
          if (parsedBalances && Object.keys(parsedBalances).length > 0) {
               this.tokenBalance = parsedBalances[this.currencyFieldDropDownValue]?.[wallet.classicAddress] ?? parsedBalances[this.currencyFieldDropDownValue]?.[this.selectedIssuer] ?? '0';
          } else {
               this.tokenBalance = '0';
          }
     }

     private parseAllGatewayBalances(gatewayBalances: xrpl.GatewayBalancesResponse, wallet: xrpl.Wallet) {
          const result = gatewayBalances.result;
          const grouped: Record<string, Record<string, string>> = {};
          // structure: { [currency]: { [issuer]: balance } }

          // --- Case 1: Obligations (this account is the gateway/issuer)
          if (result.obligations && Object.keys(result.obligations).length > 0) {
               for (const [currencyCode, value] of Object.entries(result.obligations)) {
                    const decodedCurrency = this.utilsService.normalizeCurrencyCode(currencyCode);

                    if (!grouped[decodedCurrency]) grouped[decodedCurrency] = {};

                    // Obligations are what the gateway owes → negative
                    const formatted = '-' + this.utilsService.formatTokenBalance(value, 18);
                    grouped[decodedCurrency][wallet.address] = formatted;
               }
          }

          // --- Case 2: Assets (tokens issued by others, held by this account)
          if (result.assets && Object.keys(result.assets).length > 0) {
               for (const [issuer, assetArray] of Object.entries(result.assets)) {
                    assetArray.forEach(asset => {
                         const decodedCurrency = this.utilsService.normalizeCurrencyCode(asset.currency);

                         if (!grouped[decodedCurrency]) grouped[decodedCurrency] = {};
                         grouped[decodedCurrency][issuer] = this.utilsService.formatTokenBalance(asset.value, 18);
                    });
               }
          }

          // --- Case 3: Balances (owed TO this account)
          if (result.balances && Object.keys(result.balances).length > 0) {
               for (const [issuer, balanceArray] of Object.entries(result.balances)) {
                    balanceArray.forEach(balanceObj => {
                         const decodedCurrency = this.utilsService.normalizeCurrencyCode(balanceObj.currency);

                         if (!grouped[decodedCurrency]) grouped[decodedCurrency] = {};
                         grouped[decodedCurrency][issuer] = this.utilsService.formatTokenBalance(balanceObj.value, 18);
                    });
               }
          }

          return grouped;
     }

     private ensureDefaultNotSelected() {
          const currentAddress = this.currentWallet.address;
          if (currentAddress && this.destinations.length > 0) {
               if (!this.destinationFields || this.destinationFields === currentAddress) {
                    const nonSelectedDest = this.destinations.find(d => d.address !== currentAddress);
                    this.destinationFields = nonSelectedDest ? nonSelectedDest.address : this.destinations[0].address;
               }
          }
          if (currentAddress && this.currencyIssuers.length > 0) {
               if (!this.selectedIssuer || this.selectedIssuer === currentAddress) {
                    const nonSelectedIss = this.currencyIssuers.find(i => i.address !== currentAddress);
                    this.selectedIssuer = nonSelectedIss ? nonSelectedIss.address : this.currencyIssuers[0].address;
               }
          }
          this.cdr.detectChanges();
     }

     updateDestinations() {
          this.destinations = this.wallets.map(w => ({ name: w.name, address: w.address }));
          if (this.destinations.length > 0 && !this.destinationFields) {
               this.destinationFields = this.destinations[0].address;
          }
          this.ensureDefaultNotSelected();
     }

     private async getWallet() {
          const wallet = await this.utilsService.getWallet(this.currentWallet.seed);
          if (!wallet) {
               throw new Error('ERROR: Wallet could not be created or is undefined');
          }
          return wallet;
     }

     clearFields(clearAllFields: boolean) {
          if (clearAllFields) {
               this.amountField = '';
               this.expirationTimeField = '';
          }

          this.isMemoEnabled = false;
          this.memoField = '';
          this.checkIdField = '';
          this.ticketSequence = '';
          this.isTicket = false;
          this.cdr.detectChanges();
     }

     private updateSpinnerMessage(message: string) {
          this.spinnerMessage = message;
          this.cdr.detectChanges();
     }

     private updateCurrencies() {
          this.currencies = [...Object.keys(this.knownTrustLinesIssuers)];
          // this.currencies.push('MPT');
          this.currencies.sort((a, b) => a.localeCompare(b));
     }

     onTokenChange(): void {
          const issuers = this.knownTrustLinesIssuers[this.tokenToRemove] || [];

          if (issuers.length > 0) {
               // Auto-select the first issuer
               this.issuerToRemove = issuers[0];
          } else {
               // No issuers found
               this.issuerToRemove = '';
          }
     }

     addToken() {
          if (this.newCurrency && this.newCurrency.trim() && this.newIssuer && this.newIssuer.trim()) {
               const currency = this.newCurrency.trim();
               const issuer = this.newIssuer.trim();

               // Validate currency code
               if (!this.utilsService.isValidCurrencyCode(currency)) {
                    this.setError('Invalid currency code: Must be 3-20 characters or valid hex');
                    return;
               }

               // Validate XRPL address
               if (!xrpl.isValidAddress(issuer)) {
                    this.setError('Invalid issuer address');
                    return;
               }

               // Initialize array if not present
               if (!this.knownTrustLinesIssuers[currency]) {
                    this.knownTrustLinesIssuers[currency] = [];
               }

               // Check for duplicates
               if (this.knownTrustLinesIssuers[currency].includes(issuer)) {
                    this.setError(`Issuer ${issuer} already exists for ${currency}`);
                    return;
               }

               // Add new issuer
               this.knownTrustLinesIssuers[currency].push(issuer);

               // Persist and update
               this.storageService.setKnownIssuers('knownIssuers', this.knownTrustLinesIssuers);
               this.updateCurrencies();

               this.newCurrency = '';
               this.newIssuer = '';
               this.setSuccess(`Added issuer ${issuer} for ${currency}`);
               this.cdr.detectChanges();
          } else {
               this.setError('Currency code and issuer address are required');
          }

          this.spinner = false;
     }

     removeToken() {
          if (this.tokenToRemove && this.issuerToRemove) {
               const currency = this.tokenToRemove;
               const issuer = this.issuerToRemove;

               if (this.knownTrustLinesIssuers[currency]) {
                    this.knownTrustLinesIssuers[currency] = this.knownTrustLinesIssuers[currency].filter(addr => addr !== issuer);

                    // Remove the currency entirely if no issuers remain
                    if (this.knownTrustLinesIssuers[currency].length === 0) {
                         delete this.knownTrustLinesIssuers[currency];
                    }

                    this.storageService.setKnownIssuers('knownIssuers', this.knownTrustLinesIssuers);
                    this.updateCurrencies();
                    this.setSuccess(`Removed issuer ${issuer} from ${currency}`);
                    this.cdr.detectChanges();
               } else {
                    this.setError(`Currency ${currency} not found`);
               }
          } else if (this.tokenToRemove) {
               // Remove entire token and all issuers
               delete this.knownTrustLinesIssuers[this.tokenToRemove];
               this.storageService.setKnownIssuers('knownIssuers', this.knownTrustLinesIssuers);
               this.updateCurrencies();
               this.setSuccess(`Removed all issuers for ${this.tokenToRemove}`);
               this.tokenToRemove = '';
               this.cdr.detectChanges();
          } else {
               this.setError('Select a token to remove');
          }

          this.spinner = false;
     }

     // addToken() {
     //      if (this.newCurrency && this.newCurrency.trim() && this.newIssuer && this.newIssuer.trim()) {
     //           const currency = this.newCurrency.trim();
     //           if (this.knownTrustLinesIssuers[currency]) {
     //                this.setError(`Currency ${currency} already exists`);
     //                return;
     //           }
     //           if (!this.utilsService.isValidCurrencyCode(currency)) {
     //                this.setError('Invalid currency code: Must be 3-20 characters or valid hex');
     //                return;
     //           }
     //           if (!xrpl.isValidAddress(this.newIssuer.trim())) {
     //                this.setError('Invalid issuer address');
     //                return;
     //           }
     //           this.knownTrustLinesIssuers[currency] = this.newIssuer.trim();
     //           this.storageService.setKnownIssuers('knownIssuers', this.knownTrustLinesIssuers);
     //           this.updateCurrencies();
     //           this.newCurrency = '';
     //           this.newIssuer = '';
     //           this.setSuccess(`Added ${currency} with issuer ${this.knownTrustLinesIssuers[currency]}`);
     //           this.cdr.detectChanges();
     //      } else {
     //           this.setError('Currency code and issuer address are required');
     //      }
     //      this.spinner = false;
     // }

     // removeToken() {
     //      if (this.tokenToRemove) {
     //           delete this.knownTrustLinesIssuers[this.tokenToRemove];
     //           this.storageService.setKnownIssuers('knownIssuers', this.knownTrustLinesIssuers);
     //           this.updateCurrencies();
     //           this.setSuccess(`Removed ${this.tokenToRemove}`);
     //           this.tokenToRemove = '';
     //           this.cdr.detectChanges();
     //      } else {
     //           this.setError('Select a token to remove');
     //      }
     //      this.spinner = false;
     // }

     getIssuerForCheck(checks: any[], checkIndex: string): string | null {
          const check = checks.find(c => c.index === checkIndex);
          return check?.SendMax?.issuer || null;
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
