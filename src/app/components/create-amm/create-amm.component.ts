import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { StorageService } from '../../services/storage.service';
import { IssuedCurrencyAmount, AMMInfoRequest } from 'xrpl';
import * as xrpl from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { WalletMultiInputComponent } from '../wallet-multi-input/wallet-multi-input.component';
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';

interface ValidationInputs {
     selectedAccount?: 'account1' | 'account2' | 'issuer' | null;
     senderAddress?: string;
     seed?: string;
     account_info?: any;
     weWantAmountField?: string;
     weSpendAmountField?: string;
     weWantCurrencyField?: string;
     weSpendCurrencyField?: string;
     weWantIssuerField?: string;
     weSpendIssuerField?: string;
     lpTokenBalanceField?: string;
     withdrawlLpTokenFromPoolField?: string;
     withdrawOptions?: { bothPools: boolean; firstPoolOnly: boolean; secondPoolOnly: boolean };
     depositOptions?: { bothPools: boolean; firstPoolOnly: boolean; secondPoolOnly: boolean };
     tradingFeeField?: string;
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

interface XRPLCurrency {
     currency: string;
     issuer?: string;
}

// interface AMMAsset {
//      currency: string;
//      issuer?: string;
// }

interface CurrencyAmountXRP {
     currency: 'XRP';
     value: string;
}

interface CurrencyAmountToken {
     currency: string;
     issuer: string;
     value: string;
}

// interface CurrencyObjectXRP {
//      currency: 'XRP';
//      value: string;
// }

// interface CurrencyObjectToken {
//      currency: string;
//      issuer: string;
//      value: string;
// }

interface SectionContent {
     key: string;
     value: string;
}

interface SectionSubItem {
     key: string;
     openByDefault: boolean;
     content: SectionContent[];
}

interface Section {
     title: string;
     openByDefault: boolean;
     content?: SectionContent[];
     subItems?: SectionSubItem[];
}

// interface AMMInfoResponse {
//      result: {
//           amm?: {
//                amount: string | { currency: string; issuer: string; value: string }; // Adjusted issuer to be required for tokens
//                amount2: string | { currency: string; issuer: string; value: string }; // Adjusted issuer to be required for tokens
//                lp_token: { currency: string; issuer?: string; value: string };
//                trading_fee: number;
//                account: string; // Added for AMM account
//           };
//      };
// }

// type CurrencyObject = CurrencyObjectXRP | CurrencyObjectToken;
type CurrencyAmount = CurrencyAmountXRP | CurrencyAmountToken;

// First, extend the BookOffer type to include our custom AMM properties
// type CustomBookOffer = Partial<Omit<BookOffer, 'TakerGets' | 'TakerPays'>> & {
//      Account: string;
//      Flags: number;
//      LedgerEntryType: 'Offer';
//      Sequence: number;
//      TakerGets: string | IssuedCurrencyAmount;
//      TakerPays: string | IssuedCurrencyAmount;
//      isAMM?: boolean;
//      rate?: BigNumber;
// };

@Component({
     selector: 'app-create-amm',
     standalone: true,
     imports: [CommonModule, FormsModule, WalletMultiInputComponent, NavbarComponent, SanitizeHtmlPipe, MatTableModule, MatSortModule, MatPaginatorModule, MatButtonModule],
     templateUrl: './create-amm.component.html',
     styleUrl: './create-amm.component.css',
})
export class CreateAmmComponent implements AfterViewChecked {
     dataSource = new MatTableDataSource<any>();
     displayedColumns: string[] = ['transactionType', 'createdDate', 'creationAge', 'action', 'amountXrp', 'amountToken', 'currency', 'issuer', 'timestamp', 'transactionHash'];
     @ViewChild(MatPaginator) paginator!: MatPaginator;
     @ViewChild(MatSort) sort!: MatSort;
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     @ViewChild('accountForm') accountForm!: NgForm;
     selectedAccount: 'account1' | 'account2' | 'issuer' | null = 'account1';
     lastResult: string = '';
     transactionInput: string = '';
     result: string = '';
     currencyFieldDropDownValue: string = 'XRP';
     checkExpirationTime: string = 'seconds';
     weSpendCurrencyField: string = 'XRP';
     offerSequenceField: string = '';
     weWantCurrencyField: string = 'CTZ'; // Set to RLUSD for XRP/RLUSD pair
     weWantIssuerField: string = ''; // Official RLUSD issuer
     weWantAmountField: string = '';
     weWantTokenBalanceField: string = '';
     weSpendIssuerField: string = '';
     weSpendAmountField: string = '';
     weSpendTokenBalanceField: string = '';
     ticketCountField: string = '';
     ticketSequence: string = '';
     isTicket: boolean = false;
     isTicketEnabled = false;
     ticketArray: string[] = [];
     selectedTickets: string[] = []; // For multiple selection
     selectedSingleTicket: string = ''; // For single selection
     multiSelectMode: boolean = false; // Toggle between modes
     selectedTicket: string = ''; // The currently selected ticket
     destinationTagField: string = '';
     expirationTimeField: string = '';
     account1 = { name: '', address: '', seed: '', secretNumbers: '', mnemonic: '', balance: '' };
     account2 = { name: '', address: '', seed: '', secretNumbers: '', mnemonic: '', balance: '' };
     issuer = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '0' };
     xrpBalance1Field: string = '';
     ownerCount: string = '';
     totalXrpReserves: string = '';
     executionTime: string = '';
     currentTimeField: string = '';
     memoField: string = '';
     isMemoEnabled = false;
     useMultiSign = false;
     multiSignAddress: string = '';
     multiSignSeeds: string = '';
     signerQuorum: number = 0;
     multiSigningEnabled: boolean = false;
     regularKeySigningEnabled: boolean = false;
     isRegularKeyAddress = false;
     regularKeySeed: string = '';
     regularKeyAddress: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = false;
     spinner: boolean = false;
     issuers: string[] = [];
     selectedIssuer: string = '';
     tokenBalance: string = '';
     spinnerMessage: string = '';
     masterKeyDisabled: boolean = false;
     isSimulateEnabled: boolean = false;
     phnixExchangeXrp: string = '0'; // To store the calculated XRP amount
     xrpPrice: string = '0'; // New property to store XRP price in RLUSD
     averageExchangeRate: string = '';
     maxSellablePhnix: string = '';
     phnixCurrencyCode: string = '';
     insufficientLiquidityWarning: boolean = false;
     slippage: number = 0.2357; // Default to 23.57%
     lpTokenBalanceField: string = '0'; // LP Token balance field
     tradingFeeField: string = '0.0';
     withdrawlLpTokenFromPoolField: string = '';
     assetPool1Balance: string = '0'; // Balance of the first asset in the AMM pool
     assetPool2Balance: string = '0'; // Balance of the second asset in the AMM pool
     withdrawOptions = {
          bothPools: true, // default checked
          firstPoolOnly: false,
          secondPoolOnly: false,
     };
     depositOptions = {
          bothPools: true, // default checked
          firstPoolOnly: false,
          secondPoolOnly: false,
     };
     private knownTrustLinesIssuers: { [key: string]: string } = {
          XRP: '',
     };
     xrpOnly: string[] = [];
     currencies: string[] = [];
     newCurrency: string = '';
     newIssuer: string = '';
     tokenToRemove: string = '';
     signers: { account: string; seed: string; weight: number }[] = [{ account: '', seed: '', weight: 1 }];
     private priceRefreshInterval: any; // For polling

     constructor(private readonly xrplService: XrplService, private readonly utilsService: UtilsService, private readonly cdr: ChangeDetectorRef, private readonly storageService: StorageService, private readonly renderUiComponentsService: RenderUiComponentsService, private readonly xrplTransactions: XrplTransactionService) {}

     ngOnInit() {
          const storedIssuers = this.storageService.getKnownIssuers('knownIssuers');
          if (storedIssuers) {
               this.knownTrustLinesIssuers = storedIssuers;
          }
          this.updateCurrencies();
          this.weWantCurrencyField = 'CTZ'; // BOB Set default selected currency if available
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
                    this.dataSource.paginator = this.paginator;
                    this.dataSource.sort = this.sort;
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
     ngOnDestroy() {
          // Clean up interval to prevent memory leaks
          if (this.priceRefreshInterval) {
               clearInterval(this.priceRefreshInterval);
          }
     }

     async getAMMPoolInfo() {
          console.log('Entering getAMMPoolInfo');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount || '', this.account1, this.account2, this.issuer),
               weWantCurrencyField: this.weWantCurrencyField,
               weSpendCurrencyField: this.weSpendCurrencyField,
               weWantIssuerField: this.weWantCurrencyField !== 'XRP' ? this.weWantIssuerField : undefined,
               weSpendIssuerField: this.weSpendCurrencyField !== 'XRP' ? this.weSpendIssuerField : undefined,
          };

          try {
               this.showSpinnerWithDelay('Getting AMM Pool Info...', 200);

               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const asset = this.toXRPLCurrency(this.utilsService.encodeIfNeeded(this.weWantCurrencyField), this.weWantIssuerField);
               const asset2 = this.toXRPLCurrency(this.utilsService.encodeIfNeeded(this.weSpendCurrencyField), this.weSpendIssuerField);

               // Optional: Log lightweight version
               console.info(`asset:`, asset);
               console.info(`asset2:`, asset2);

               const [accountInfo, accountObjects, ammResponse, participation] = await Promise.all([
                    this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''),
                    this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''),
                    this.xrplService.getAMMInfo(client, asset, asset2, wallet.classicAddress, 'validated').catch(err => {
                         if (err.name === 'RippledError' && err.data?.error === 'actNotFound') {
                              console.warn('No AMM pool exists yet for this asset pair.');
                              return null; // Graceful fallback
                         }
                         console.error('Error fetching AMM info:', err);
                         throw err; // Re-throw if not handled
                    }),
                    this.checkAmmParticipation(client, wallet.classicAddress).catch(err => {
                         console.error('Error checking AMM participation:', err);
                         return null;
                    }),
               ]);

               // Optional: Log lightweight version
               console.info(`accountInfo:`, accountInfo.result);
               console.info(`accountObjects:`, accountObjects.result);

               inputs = { ...inputs, account_info: accountInfo };

               const errors = await this.validateInputs(inputs, 'getPoolInfo');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               // PHASE 4: Build UI data — RENDER IMMEDIATELY
               const data: { sections: Section[] } = { sections: [] };

               const amm = ammResponse?.result?.amm;

               if (!amm) {
                    data.sections.push({
                         title: 'AMM Pool Info',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No AMM pool found for selected pair` }],
                    });

                    if (participation) {
                         data.sections.push({
                              title: 'AMM Pool Participant',
                              openByDefault: true,
                              content: [
                                   { key: 'AMM Pool', value: participation.isAmmPool ? 'Yes' : 'No' },
                                   { key: 'Liquidity Provider', value: participation.isLiquidityProvider ? 'Yes' : 'No' },
                                   ...participation.lpTokens.map((lp, i) => ({
                                        key: `Liquidity Provider #${i + 1}`,
                                        value: `LP Balance: ${this.utilsService.formatTokenBalance(lp.balance, 2)} (issuer: ${lp.issuer}, currency: ${this.utilsService.decodeIfNeeded(lp.currency)})`,
                                   })),
                              ],
                         });
                    }
               } else {
                    // Format balances
                    this.assetPool1Balance = typeof amm.amount === 'string' ? xrpl.dropsToXrp(amm.amount) || amm.amount : this.utilsService.formatTokenBalance(amm.amount.value, 18).toString();
                    this.assetPool2Balance = typeof amm.amount2 === 'string' ? xrpl.dropsToXrp(amm.amount2) || amm.amount2.value : this.utilsService.formatTokenBalance(amm.amount2.value, 18).toString();

                    // Decode currencies for display
                    const assetCurrency = typeof amm.amount === 'string' ? 'XRP' : (amm.amount.currency.length > 3 ? this.utilsService.decodeCurrencyCode(amm.amount.currency) : amm.amount.currency) + (amm.amount.issuer ? ` (Issuer: ${amm.amount.issuer})` : '');
                    const asset2Currency = typeof amm.amount2 === 'string' ? 'XRP' : (amm.amount2.currency.length > 3 ? this.utilsService.decodeCurrencyCode(amm.amount2.currency) : amm.amount2.currency) + (amm.amount2.issuer ? ` (Issuer: ${amm.amount2.issuer})` : '');

                    data.sections.push({
                         title: 'AMM Pool Info',
                         openByDefault: true,
                         content: [
                              { key: 'Account', value: amm.account },
                              { key: 'Asset', value: assetCurrency },
                              { key: 'Asset Amount', value: this.assetPool1Balance },
                              { key: 'Asset2', value: asset2Currency },
                              { key: 'Asset2 Amount', value: this.assetPool2Balance },
                              { key: 'LP Token Balance', value: `${this.utilsService.formatTokenBalance(amm.lp_token.value, 2)} ${amm.lp_token.currency}` },
                              { key: 'Asset Frozen', value: String(amm.asset_frozen || false) },
                              { key: 'Trading Fee', value: `${amm.trading_fee / 1000}%` },
                              { key: 'Vote Slots', value: String(amm.vote_slots?.length || 0) },
                         ],
                    });

                    // Optional: Show vote slots
                    if (amm.vote_slots && amm.vote_slots.length > 0) {
                         data.sections.push({
                              title: 'Vote Slots',
                              openByDefault: false,
                              subItems: amm.vote_slots.map((slot: any, index: number) => ({
                                   key: `Vote Slot ${index + 1}`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Account', value: slot.account },
                                        { key: 'Trading Fee', value: `${slot.trading_fee / 1000}%` },
                                        { key: 'Voting Weight', value: slot.vote_weight },
                                   ],
                              })),
                         });
                    }

                    this.tradingFeeField = `${amm.trading_fee / 10000}`;

                    // LP Token section
                    data.sections.push({
                         title: 'LP Token',
                         openByDefault: true,
                         content: [
                              { key: 'Currency', value: amm.lp_token.currency },
                              { key: 'Issuer', value: amm.lp_token.issuer },
                              { key: 'Balance', value: this.utilsService.formatTokenBalance(amm.lp_token.value, 2) },
                         ],
                    });
               }

               // Render immediately
               this.renderUiComponentsService.renderDetails(data);
               this.setSuccess(this.result);

               // Non-critical UI updates — let main render complete first
               setTimeout(async () => {
                    try {
                         // Use pre-fetched data — no redundant API calls!
                         this.refreshUiAccountObjects(accountObjects, accountInfo, wallet);
                         this.refreshUiAccountInfo(accountInfo);
                         this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
                         this.clearFields(false);
                         this.updateTickets(accountObjects);
                         this.account1.balance = await this.updateXrpBalance(client, accountInfo, wallet);
                    } catch (err) {
                         console.error('Error in deferred UI updates for AMM:', err);
                    }
               }, 0);
          } catch (error: any) {
               console.error('Error in getAMMPoolInfo:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getAMMPoolInfo in ${this.executionTime}ms`);
          }
     }

     async createAMM() {
          console.log('Entering createAMM');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               weWantAmountField: this.weWantAmountField,
               weSpendAmountField: this.weSpendAmountField,
               weWantCurrencyField: this.weWantCurrencyField,
               weSpendCurrencyField: this.weSpendCurrencyField,
               weWantIssuerField: this.weWantCurrencyField !== 'XRP' ? this.weWantIssuerField : undefined,
               weSpendIssuerField: this.weSpendCurrencyField !== 'XRP' ? this.weSpendIssuerField : undefined,
               tradingFeeField: this.tradingFeeField,
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
               this.updateSpinnerMessage(`Preparing AMM Create (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + account objects together
               const [accountInfo, fee, currentLedger, initialXrpBalance, serverInfo] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), client.getXrpBalance(wallet.classicAddress), this.xrplService.getXrplServerInfo(client, 'current', '')]);

               inputs = { ...inputs, account_info: accountInfo };

               const errors = await this.validateInputs(inputs, 'create');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               // Optional: Avoid heavy stringify — log only if needed
               console.debug(`account info:`, accountInfo.result);
               console.debug(`fee:`, fee);
               console.debug(`currentLedger:`, currentLedger);
               console.log(`Initial XRP Balance ${initialXrpBalance} (drops): ${xrpl.xrpToDrops(initialXrpBalance)}`);

               const data: { sections: Section[] } = {
                    sections: [],
               };

               // Trust line setup
               let issuerAddr, issuerCur;
               if (this.weWantIssuerField === AppConstants.XRP_CURRENCY || this.weWantIssuerField === '') {
                    issuerAddr = this.weSpendIssuerField;
                    issuerCur = this.weSpendCurrencyField;
               } else {
                    issuerAddr = this.weWantIssuerField;
                    issuerCur = this.weWantCurrencyField;
               }

               console.debug(`issuerAddr:`, issuerAddr);
               console.debug(`issuerCur:`, issuerCur);

               const tokenBalance = this.weSpendCurrencyField === AppConstants.XRP_CURRENCY ? this.weWantCurrencyField : this.weSpendCurrencyField;
               let initialTokenBalance;
               if (this.weWantTokenBalanceField != '') {
                    initialTokenBalance = this.weWantTokenBalanceField;
               } else {
                    initialTokenBalance = await this.xrplService.getOnlyTokenBalance(client, wallet.address, tokenBalance);
               }
               console.log(`TokenBalance ${tokenBalance} InitialTokenBalance: ${initialTokenBalance}`);

               data.sections.push({
                    title: 'Initial Balances',
                    openByDefault: true,
                    content: [{ key: 'XRP', value: `${initialXrpBalance} (${xrpl.xrpToDrops(initialXrpBalance)} drops)` }],
               });

               // Build currency objects
               let we_want = this.weWantCurrencyField === AppConstants.XRP_CURRENCY ? { currency: AppConstants.XRP_CURRENCY, value: this.weWantAmountField } : { currency: this.weWantCurrencyField, issuer: this.weWantIssuerField, value: this.weWantAmountField };
               let we_spend = this.weSpendCurrencyField === AppConstants.XRP_CURRENCY ? { amount: this.weSpendAmountField } : { currency: this.weSpendCurrencyField, issuer: this.weSpendIssuerField, value: this.weSpendAmountField };

               if (this.weSpendCurrencyField === AppConstants.XRP_CURRENCY) {
                    if (!this.weSpendAmountField) {
                         throw new Error('weSpendAmountField is required for XRP');
                    }
                    we_spend = { amount: this.weSpendAmountField };
               } else {
                    if (!this.weSpendAmountField || !this.weSpendIssuerField) {
                         throw new Error('weSpendAmountField and weSpendIssuerField are required for token');
                    }
                    we_spend = {
                         currency: this.weSpendCurrencyField.length > 3 ? this.utilsService.encodeCurrencyCode(this.weSpendCurrencyField) : this.weSpendCurrencyField,
                         value: this.weSpendAmountField,
                         issuer: this.weSpendIssuerField,
                    };
               }

               // Validate balances
               if (this.weSpendCurrencyField === AppConstants.XRP_CURRENCY && Number(xrpl.xrpToDrops(initialXrpBalance)) < Number(this.weSpendAmountField)) {
                    this.setError('Insufficient XRP balance');
                    return;
               } else if (this.weSpendCurrencyField !== AppConstants.XRP_CURRENCY && Number(initialTokenBalance) < Number(this.weSpendAmountField)) {
                    this.setError(`Insufficient ${this.weSpendCurrencyField} balance`);
                    return;
               }

               if (we_want.currency && we_want.currency.length > 3) {
                    we_want.currency = this.utilsService.encodeCurrencyCode(we_want.currency);
               }
               if (we_spend.currency && we_spend.currency.length > 3) {
                    we_spend.currency = this.utilsService.encodeCurrencyCode(we_spend.currency);
               }

               if (we_spend.amount === undefined) {
                    throw new Error('Amount is undefined');
               }

               if (!we_want.issuer) {
                    throw new Error('Issuer is undefined');
               }
               const ammCreateTx: xrpl.AMMCreate = {
                    TransactionType: 'AMMCreate',
                    Account: wallet.classicAddress, // the funding account
                    Amount: xrpl.xrpToDrops(we_spend.amount.toString()), // e.g., 10 XRP (in drops)
                    Amount2: {
                         currency: we_want.currency,
                         issuer: we_want.issuer,
                         value: we_want.value,
                    },
                    TradingFee: Number(this.tradingFeeField), // 500, // 0.5%
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               // Optional fields
               await this.setTxOptionalFields(client, ammCreateTx, wallet, accountInfo, 'createAmm');

               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, ammCreateTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Create AMM (no changes will be made)...' : 'Submitting to Ledger...');

               if (this.isSimulateEnabled) {
                    const simulation = await this.xrplTransactions.simulateTransaction(client, ammCreateTx);

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
                    let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, ammCreateTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

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

                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              this.account1.balance = await this.updateXrpBalance(client, accountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving createAMM in ${this.executionTime}ms`);
          }
     }

     async depositToAMM() {
          console.log('Entering depositToAMM');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               weWantAmountField: this.depositOptions.bothPools || this.depositOptions.firstPoolOnly ? this.weWantAmountField : undefined,
               weSpendAmountField: this.depositOptions.bothPools || this.depositOptions.secondPoolOnly ? this.weSpendAmountField : undefined,
               depositOptions: this.depositOptions,
               withdrawOptions: this.withdrawOptions,
               weWantCurrencyField: this.weWantCurrencyField,
               weSpendCurrencyField: this.weSpendCurrencyField,
               weWantIssuerField: this.weWantCurrencyField !== 'XRP' ? this.weWantIssuerField : undefined,
               weSpendIssuerField: this.weSpendCurrencyField !== 'XRP' ? this.weSpendIssuerField : undefined,
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
               this.updateSpinnerMessage(`Preparing AMM Deposit (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + account objects together
               const [accountInfo, fee, currentLedger, initialXrpBalance] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), client.getXrpBalance(wallet.classicAddress)]);

               inputs = { ...inputs, account_info: accountInfo };

               const errors = await this.validateInputs(inputs, 'deposit');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               // Optional: Avoid heavy stringify — log only if needed
               console.debug(`account info:`, accountInfo.result);
               console.debug(`fee:`, fee);
               console.debug(`currentLedger:`, currentLedger);

               let issuerAddr, issuerCur, issuerAmount;
               if (this.weWantIssuerField === AppConstants.XRP_CURRENCY || this.weWantIssuerField === '') {
                    issuerAddr = this.weSpendIssuerField;
                    issuerCur = this.weSpendCurrencyField;
                    issuerAmount = this.weSpendAmountField;
               } else {
                    issuerAddr = this.weWantIssuerField;
                    issuerCur = this.weWantCurrencyField;
                    issuerAmount = this.weWantAmountField;
               }

               console.log(`issuerAddr ${issuerAddr} issuerCur ${issuerCur} issuerAmount ${issuerAmount}`);

               console.log(`Initial XRP Balance ${initialXrpBalance} (drops): ${xrpl.xrpToDrops(initialXrpBalance)}`);

               const tokenBalance = this.weSpendCurrencyField === AppConstants.XRP_CURRENCY ? this.weWantCurrencyField : this.weSpendCurrencyField;
               let initialTokenBalance = await this.xrplService.getOnlyTokenBalance(client, wallet.address, tokenBalance);
               console.log(`Initial ${tokenBalance} Balance: ${initialTokenBalance}`);

               // Build currency objects
               let we_want = this.weWantCurrencyField === AppConstants.XRP_CURRENCY ? { currency: AppConstants.XRP_CURRENCY, value: this.weWantAmountField } : { currency: this.weWantCurrencyField, issuer: this.weWantIssuerField, value: this.weWantAmountField };
               let we_spend = this.weSpendCurrencyField === AppConstants.XRP_CURRENCY ? { amount: this.weSpendAmountField } : { currency: this.weSpendCurrencyField, issuer: this.weSpendIssuerField, value: this.weSpendAmountField };

               if (this.depositOptions.firstPoolOnly) {
                    this.weSpendAmountField = '0';
               }
               if (this.depositOptions.secondPoolOnly) {
                    this.weWantAmountField = '0';
               }

               if (this.weSpendCurrencyField === AppConstants.XRP_CURRENCY) {
                    if (!this.weSpendAmountField) {
                         throw new Error('weSpendAmountField is required for XRP');
                    }
                    we_spend = { amount: this.weSpendAmountField };
               } else {
                    if (!this.weSpendAmountField || !this.weSpendIssuerField) {
                         throw new Error('weSpendAmountField and weSpendIssuerField are required for token');
                    }
                    we_spend = {
                         currency: this.weSpendCurrencyField.length > 3 ? this.utilsService.encodeCurrencyCode(this.weSpendCurrencyField) : this.weSpendCurrencyField,
                         value: this.weSpendAmountField,
                         issuer: this.weSpendIssuerField,
                    };
               }

               console.log('we_want', we_want);
               console.log('we_spend', we_spend);

               // Validate balances
               if (this.weSpendCurrencyField === AppConstants.XRP_CURRENCY && Number(xrpl.xrpToDrops(initialXrpBalance)) < Number(this.weSpendAmountField)) {
                    this.setError('Insufficient XRP balance');
                    return;
               } else if (this.weSpendCurrencyField !== AppConstants.XRP_CURRENCY && Number(initialTokenBalance) < Number(this.weSpendAmountField)) {
                    this.setError(`Insufficient ${this.weSpendCurrencyField} balance`);
                    return;
               }

               if (we_want.currency.length > 3) {
                    we_want.currency = this.utilsService.encodeCurrencyCode(we_want.currency);
               }

               const assetDef: xrpl.Currency = {
                    currency: 'XRP',
               };
               const asset2Def: xrpl.Currency = {
                    currency: we_want.currency,
                    issuer: we_want.issuer ?? '', // fallback empty string if undefined
               };

               let assetAmount: string = '0';
               if (we_spend.amount) {
                    assetAmount = xrpl.xrpToDrops(we_spend.amount); // must be string in drops for XRP
               }

               const asset2Amount: xrpl.IssuedCurrencyAmount = {
                    currency: we_want.currency,
                    issuer: we_want.issuer ?? '',
                    value: we_want.value ?? '0', // must always be a string
               };

               let ammDepositTx: xrpl.AMMDeposit;
               if (this.depositOptions.bothPools) {
                    ammDepositTx = {
                         TransactionType: 'AMMDeposit',
                         Account: wallet.classicAddress,
                         Asset: assetDef,
                         Asset2: asset2Def,
                         Amount: assetAmount,
                         Amount2: asset2Amount,
                         Flags: xrpl.AMMDepositFlags.tfTwoAsset,
                         Fee: fee,
                    };
               } else if (this.depositOptions.firstPoolOnly) {
                    ammDepositTx = {
                         TransactionType: 'AMMDeposit',
                         Account: wallet.classicAddress,
                         Asset: assetDef, // { currency: "XRP" }
                         Asset2: asset2Def, // { currency: "USD", issuer: ... }
                         Amount: asset2Amount, // e.g. { currency:"USD", issuer:..., value:"500" }
                         Flags: xrpl.AMMDepositFlags.tfOneAssetLPToken,
                         Fee: fee,
                    };
               } else {
                    ammDepositTx = {
                         TransactionType: 'AMMDeposit',
                         Account: wallet.classicAddress,
                         Asset: assetDef, // { currency: "XRP" }
                         Asset2: asset2Def, // { currency: "USD", issuer: ... }
                         Amount: assetAmount, // e.g. xrpl.xrpToDrops("10")
                         Flags: xrpl.AMMDepositFlags.tfOneAssetLPToken, // one-asset deposit
                         Fee: fee,
                    };
               }

               await this.setTxOptionalFields(client, ammDepositTx, wallet, accountInfo, 'createAmm');

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Deposit to AMM (no changes will be made)...' : 'Submitting to Ledger...');

               if (this.isSimulateEnabled) {
                    const simulation = await this.xrplTransactions.simulateTransaction(client, ammDepositTx);

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
                    let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, ammDepositTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

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

                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    //DEFER: Non-critical UI updates (skip for simulation)
                    setTimeout(async () => {
                         try {
                              this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              this.account1.balance = await this.updateXrpBalance(client, accountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving depositToAMM in ${this.executionTime}ms`);
          }
     }

     async withdrawlTokenFromAMM() {
          console.log('Entering withdrawlTokenFromAMM');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               lpTokenBalanceField: this.lpTokenBalanceField,
               weWantAmountField: this.withdrawOptions.bothPools || this.withdrawOptions.firstPoolOnly ? this.weWantAmountField : undefined,
               weSpendAmountField: this.withdrawOptions.bothPools || this.withdrawOptions.secondPoolOnly ? this.weSpendAmountField : undefined,
               depositOptions: this.depositOptions,
               withdrawOptions: this.withdrawOptions,
               withdrawlLpTokenFromPoolField: this.withdrawlLpTokenFromPoolField,
               weWantCurrencyField: this.weWantCurrencyField,
               weSpendCurrencyField: this.weSpendCurrencyField,
               weWantIssuerField: this.weWantCurrencyField !== 'XRP' ? this.weWantIssuerField : undefined,
               weSpendIssuerField: this.weSpendCurrencyField !== 'XRP' ? this.weSpendIssuerField : undefined,
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
               this.updateSpinnerMessage(`Preparing AMM Withdrawl (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + account objects together
               const [accountInfo, fee, currentLedger, initialXrpBalance] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), client.getXrpBalance(wallet.classicAddress)]);

               inputs = { ...inputs, account_info: accountInfo };

               const errors = await this.validateInputs(inputs, 'withdraw');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               // Optional: Avoid heavy stringify — log only if needed
               console.debug(`account info:`, accountInfo.result);
               console.debug(`fee:`, fee);
               console.debug(`currentLedger:`, currentLedger);

               console.log(`Initial XRP Balance ${initialXrpBalance} (drops): ${xrpl.xrpToDrops(initialXrpBalance)}`);
               const tokenBalance = this.weSpendCurrencyField === AppConstants.XRP_CURRENCY ? this.weWantCurrencyField : this.weSpendCurrencyField;
               let initialTokenBalance = await this.xrplService.getOnlyTokenBalance(client, wallet.address, tokenBalance);
               console.log(`Initial ${tokenBalance} Balance: ${initialTokenBalance}`);

               // Build currency objects
               let we_want = this.weWantCurrencyField === AppConstants.XRP_CURRENCY ? { currency: AppConstants.XRP_CURRENCY, value: this.weWantAmountField } : { currency: this.weWantCurrencyField, issuer: this.weWantIssuerField, value: this.weWantAmountField };
               let we_spend = this.weSpendCurrencyField === AppConstants.XRP_CURRENCY ? { amount: this.weSpendAmountField } : { currency: this.weSpendCurrencyField, issuer: this.weSpendIssuerField, value: this.weSpendAmountField };

               console.log('we_want', we_want);
               console.log('we_spend', we_spend);

               // Validate balances
               if (this.weSpendCurrencyField === AppConstants.XRP_CURRENCY && Number(xrpl.xrpToDrops(initialXrpBalance)) < Number(this.weSpendAmountField)) {
                    this.setError('Insufficient XRP balance');
                    return;
               } else if (this.weSpendCurrencyField !== AppConstants.XRP_CURRENCY && Number(initialTokenBalance) < Number(this.weSpendAmountField)) {
                    this.setError(`Insufficient ${this.weSpendCurrencyField} balance`);
                    return;
               }

               if (we_want.currency.length > 3) {
                    we_want.currency = this.utilsService.encodeCurrencyCode(we_want.currency);
               }

               const asset = this.toXRPLCurrency(this.utilsService.encodeIfNeeded(this.weWantCurrencyField), this.utilsService.getSelectedAddressWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer));
               const asset2 = this.toXRPLCurrency(this.utilsService.encodeIfNeeded(this.weSpendCurrencyField), this.utilsService.getSelectedAddressWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer));
               console.info(`asset ${JSON.stringify(asset, null, '\t')}`);
               console.info(`asset2 ${JSON.stringify(asset2, null, '\t')}`);

               const assetDef: xrpl.Currency = {
                    currency: 'XRP',
               };
               const asset2Def: xrpl.Currency = {
                    currency: we_want.currency,
                    issuer: we_want.issuer ?? '', // fallback empty string if undefined
               };

               const participation = await this.checkAmmParticipation(client, wallet.classicAddress);
               console.info(`participation:`, participation);

               const ammIssuer = participation.lpTokens[0].issuer;
               const ammCurrency = participation.lpTokens[0].currency;

               this.withdrawlLpTokenFromPoolField = this.utilsService.removeCommaFromAmount(this.withdrawlLpTokenFromPoolField);
               const lpTokenIn = { currency: ammCurrency, issuer: ammIssuer, value: this.withdrawlLpTokenFromPoolField };

               const asset2Amount: xrpl.IssuedCurrencyAmount = {
                    currency: we_want.currency,
                    issuer: we_want.issuer ?? '',
                    value: we_want.value ?? '0', // must always be a string
               };

               let ammWithdrawTx: xrpl.AMMWithdraw;
               if (this.withdrawOptions.bothPools) {
                    console.log('Both Pools selected');
                    ammWithdrawTx = {
                         TransactionType: 'AMMWithdraw',
                         Account: wallet.classicAddress,
                         Asset: assetDef,
                         Asset2: asset2Def,
                         LPTokenIn: lpTokenIn,
                         Flags: xrpl.AMMDepositFlags.tfLPToken,
                         Fee: fee,
                    };
               } else if (this.withdrawOptions.firstPoolOnly) {
                    console.log('First Pool Only selected');
                    ammWithdrawTx = {
                         TransactionType: 'AMMWithdraw',
                         Account: wallet.classicAddress,
                         Asset: assetDef, // { currency: "XRP" }
                         Asset2: asset2Def, // { currency: "USD", issuer: ... }
                         LPTokenIn: lpTokenIn,
                         Flags: xrpl.AMMDepositFlags.tfSingleAsset,
                         Amount: '0', // e.g. { currency:"USD", issuer:..., value:"500" }
                         Amount2: asset2Amount,
                         Fee: fee,
                    };
               } else {
                    console.log('Second Pool Only selected');
                    ammWithdrawTx = {
                         TransactionType: 'AMMWithdraw',
                         Account: wallet.classicAddress,
                         Asset: assetDef, // XRP
                         Asset2: asset2Def, // Token
                         LPTokenIn: lpTokenIn,
                         Flags: xrpl.AMMWithdrawFlags.tfSingleAsset,
                         Amount: xrpl.xrpToDrops(this.weSpendAmountField),
                         Fee: fee,
                    };
               }

               await this.setTxOptionalFields(client, ammWithdrawTx, wallet, accountInfo, 'createAmm');

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Withdrawing from AMM (no changes will be made)...' : 'Submitting to Ledger...');

               if (this.isSimulateEnabled) {
                    const simulation = await this.xrplTransactions.simulateTransaction(client, ammWithdrawTx);

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
                    let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, ammWithdrawTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

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

                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    //DEFER: Non-critical UI updates (skip for simulation)
                    setTimeout(async () => {
                         try {
                              this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              this.account1.balance = await this.updateXrpBalance(client, accountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving withdrawlTokenFromAMM in ${this.executionTime}ms`);
          }
     }

     async clawbackFromAMM() {
          console.log('Entering clawbackFromAMM');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               lpTokenBalanceField: this.lpTokenBalanceField, // how much LP to claw back
               weWantCurrencyField: this.weWantCurrencyField, // AMM asset
               weWantIssuerField: this.weWantIssuerField !== 'XRP' ? this.weWantIssuerField : undefined,
               weSpendCurrencyField: this.weSpendCurrencyField,
               weSpendIssuerField: this.weSpendIssuerField !== 'XRP' ? this.weSpendIssuerField : undefined,
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
               this.updateSpinnerMessage(`Preparing AMM Clawback (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + account objects together
               const [accountInfo, fee, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client)]);

               inputs = { ...inputs, account_info: accountInfo };

               const errors = await this.validateInputs(inputs, 'ammclawback');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               // Optional: Avoid heavy stringify — log only if needed
               console.debug(`account info:`, accountInfo.result);
               console.debug(`fee:`, fee);
               console.debug(`currentLedger:`, currentLedger);

               // Build Asset + Asset2 (AMM pool definition)
               const assetDef: xrpl.Currency = {
                    currency: this.weSpendCurrencyField === AppConstants.XRP_CURRENCY ? 'XRP' : this.utilsService.encodeCurrencyCode(this.weSpendCurrencyField),
                    issuer: this.weSpendCurrencyField !== AppConstants.XRP_CURRENCY ? this.weSpendIssuerField : '',
               };

               const asset2Def: xrpl.Currency = {
                    currency: this.weWantCurrencyField === AppConstants.XRP_CURRENCY ? 'XRP' : this.utilsService.encodeCurrencyCode(this.weWantCurrencyField),
                    issuer: this.weWantCurrencyField !== AppConstants.XRP_CURRENCY ? this.weWantIssuerField : '',
               };

               const ammClawbackTx: xrpl.AMMClawback = {
                    TransactionType: 'AMMClawback',
                    Account: wallet.classicAddress,
                    Asset: assetDef,
                    Asset2: asset2Def,
                    Amount: {
                         currency: 'AMM', // LP tokens are represented as AMM token
                         issuer: wallet.classicAddress,
                         value: this.lpTokenBalanceField,
                    },
                    Holder: '',
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                    Fee: fee,
               };

               await this.setTxOptionalFields(client, ammClawbackTx, wallet, accountInfo, 'createAmm');

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Clawing Back Token from AMM (no changes will be made)...' : 'Submitting to Ledger...');

               if (this.isSimulateEnabled) {
                    const simulation = await this.xrplTransactions.simulateTransaction(client, ammClawbackTx);

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
                    let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, ammClawbackTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

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

                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    //DEFER: Non-critical UI updates (skip for simulation)
                    setTimeout(async () => {
                         try {
                              this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              this.account1.balance = await this.updateXrpBalance(client, accountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving clawbackFromAMM in ${this.executionTime}ms`);
          }
     }

     async swapViaAMM() {
          console.log('Entering swapViaAMM');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               weWantAmountField: this.weWantAmountField,
               weSpendAmountField: this.weSpendAmountField,
               weWantCurrencyField: this.weWantCurrencyField,
               weSpendCurrencyField: this.weSpendCurrencyField,
               weWantIssuerField: this.weWantCurrencyField !== 'XRP' ? this.weWantIssuerField : undefined,
               weSpendIssuerField: this.weSpendCurrencyField !== 'XRP' ? this.weSpendIssuerField : undefined,
               selectedTicket: this.selectedTicket,
               selectedSingleTicket: this.selectedSingleTicket,
          };

          try {
               this.resultField.nativeElement.innerHTML = '';
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing AMM Swap (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + account objects together
               const [accountInfo, fee, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client)]);

               inputs = { ...inputs, account_info: accountInfo };

               const errors = await this.validateInputs(inputs, 'swap');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               // Optional: Avoid heavy stringify — log only if needed
               console.debug(`account info:`, accountInfo.result);
               console.debug(`fee:`, fee);
               console.debug(`currentLedger:`, currentLedger);

               const asset = this.toXRPLCurrency(this.utilsService.encodeIfNeeded(this.weWantCurrencyField), this.issuer.address);
               const asset2 = this.toXRPLCurrency(this.utilsService.encodeIfNeeded(this.weSpendCurrencyField), this.issuer.address);
               console.info(`asset ${JSON.stringify(asset, null, '\t')}`);
               console.info(`asset2 ${JSON.stringify(asset2, null, '\t')}`);

               // Define Amount based on weWantCurrencyField
               const amount: xrpl.Amount = this.weWantCurrencyField === 'XRP' ? xrpl.xrpToDrops(this.weWantAmountField.toString()) : { currency: asset.currency, issuer: asset.issuer!, value: this.weWantAmountField.toString() };

               const swapPaymentTx: xrpl.Payment = {
                    TransactionType: 'Payment',
                    Account: wallet.classicAddress,
                    Destination: wallet.classicAddress,
                    Amount: amount,
                    SendMax: this.weSpendCurrencyField === 'XRP' ? xrpl.xrpToDrops(this.weSpendAmountField.toString()) : { currency: asset2.currency, issuer: asset2.issuer!, value: '10' },
                    Flags: 131072,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               await this.setTxOptionalFields(client, swapPaymentTx, wallet, accountInfo, 'swamViaAMM');

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Swap via AMM (no changes will be made)...' : 'Submitting to Ledger...');

               if (this.isSimulateEnabled) {
                    const simulation = await this.xrplTransactions.simulateTransaction(client, swapPaymentTx);

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
                    let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, swapPaymentTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

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

                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    //DEFER: Non-critical UI updates (skip for simulation)
                    setTimeout(async () => {
                         try {
                              this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              this.account1.balance = await this.updateXrpBalance(client, accountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving swapViaAMM in ${this.executionTime}ms`);
          }
     }

     async onWeWantCurrencyChange() {
          console.log('Entering onWeWantCurrencyChange');
          this.setSuccessProperties();

          this.weWantIssuerField = this.issuer.address;
          const inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
          };

          const errors = await this.validateInputs(inputs, 'weWantCurrencyChange');
          if (errors.length > 0) {
               return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
          }

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE
               const [accountInfo, balanceResponse] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '')]);

               let balance: string;

               if (this.weWantCurrencyField === 'XRP') {
                    const client = await this.xrplService.getClient();
                    balance = await this.updateXrpBalance(client, accountInfo, wallet);
                    this.weWantTokenBalanceField = balance !== null ? balance : '0';
                    this.weWantIssuerField = '';
               } else {
                    const currencyCode = this.weWantCurrencyField.length > 3 ? this.utilsService.encodeCurrencyCode(this.weWantCurrencyField) : this.weWantCurrencyField;
                    this.weWantIssuerField = this.knownTrustLinesIssuers[this.weWantCurrencyField];

                    balance = (await this.getCurrencyBalance(balanceResponse, wallet.classicAddress, currencyCode)) ?? '0';
                    this.weWantTokenBalanceField = balance !== null ? balance : '0';
               }

               if (this.weWantTokenBalanceField !== '0') {
                    this.weWantTokenBalanceField = this.utilsService.formatTokenBalance(this.weWantTokenBalanceField, 18);
               }
          } catch (error: any) {
               console.error('Error fetching weWant balance:', error);
               this.setError(`ERROR: Failed to fetch balance - ${error.message || 'Unknown error'}`);
               this.weWantTokenBalanceField = '0';
          } finally {
               this.spinner = false;
               this.cdr.detectChanges();
               console.log(`Leaving onWeWantCurrencyChange`);
          }
     }

     async onWeSpendCurrencyChange() {
          console.log('Entering onWeSpendCurrencyChange');
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
          };

          const errors = await this.validateInputs(inputs, 'weSpendCurrencyChange');
          if (errors.length > 0) {
               return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
          }

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, balanceResponse] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '')]);

               let balance: string;

               if (this.weSpendCurrencyField === 'XRP') {
                    balance = await this.updateXrpBalance(client, accountInfo, wallet);
                    this.weSpendTokenBalanceField = balance !== null ? balance : '0';
                    this.weSpendIssuerField = '';
               } else {
                    const currencyCode = this.weSpendCurrencyField.length > 3 ? this.utilsService.encodeCurrencyCode(this.weSpendCurrencyField) : this.weSpendCurrencyField;
                    this.weSpendIssuerField = this.knownTrustLinesIssuers[this.weWantCurrencyField];

                    balance = (await this.getCurrencyBalance(balanceResponse, wallet.classicAddress, currencyCode, this.weSpendIssuerField)) ?? '0';
                    this.weSpendTokenBalanceField = balance !== null ? balance : '0';
               }

               if (this.weSpendTokenBalanceField !== '0') {
                    this.weSpendTokenBalanceField = this.utilsService.formatTokenBalance(this.weSpendTokenBalanceField, 18);
               }
          } catch (error: any) {
               console.error('Error fetching weSpend balance:', error);
               this.setError(`ERROR: Failed to fetch balance - ${error.message || 'Unknown error'}`);
               this.weSpendTokenBalanceField = '0';
          } finally {
               this.spinner = false;
               this.cdr.detectChanges();
               console.log(`Leaving onWeSpendCurrencyChange`);
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

     private async setTxOptionalFields(client: xrpl.Client, ammTx: any, wallet: xrpl.Wallet, accountInfo: any, txType: string) {
          if (txType === 'createAmm' || txType === 'swamViaAMM') {
               if (this.selectedSingleTicket) {
                    const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.selectedSingleTicket));
                    if (!ticketExists) {
                         return this.setError(`ERROR: Ticket Sequence ${this.selectedSingleTicket} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(ammTx, this.selectedSingleTicket, true);
               } else {
                    if (this.multiSelectMode && this.selectedTickets.length > 0) {
                         console.log('Setting multiple tickets:', this.selectedTickets);
                         this.utilsService.setTicketSequence(ammTx, accountInfo.result.account_data.Sequence, false);
                    }
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(ammTx, this.memoField);
               }
          }

          if (txType === 'swamViaAMM') {
               if (this.destinationTagField && parseInt(this.destinationTagField) > 0) {
                    this.utilsService.setDestinationTag(ammTx, this.destinationTagField);
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
          return balance.toString();
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
          this.weWantAmountField = '';
          this.weSpendAmountField = '';

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

          const isValidNumber = (value: string | undefined, fieldName: string, minValue?: number, maxValue?: number): string | null => {
               if (value === undefined) return null; // Not required, so skip
               const num = parseFloat(value);
               if (isNaN(num) || !isFinite(num)) {
                    return `${fieldName} must be a valid number`;
               }
               if (minValue !== undefined && num <= minValue) {
                    return `${fieldName} must be greater than ${minValue}`;
               }
               if (maxValue !== undefined && num > maxValue) {
                    return `${fieldName} must be less than or equal to ${maxValue}`;
               }
               return null;
          };

          const isValidSeed = (value: string | undefined): string | null => {
               if (value) {
                    const { type, value: detectedValue } = this.utilsService.detectXrpInputType(value);
                    if (detectedValue === 'unknown') {
                         return 'Account seed is invalid';
                    }
               }
               return null;
          };

          const isValidCurrency = (value: string | undefined, fieldName: string): string | null => {
               if (value && !this.utilsService.isValidCurrencyCode(value)) {
                    return `${fieldName} must be a valid currency code (3-20 characters or valid hex)`;
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

          function commonValidators(inputs: ValidationInputs) {
               return [
                    // Ticket flow
                    () => (inputs.isTicket ? isRequired(inputs.selectedSingleTicket, 'Ticket Sequence') : null),
                    () => (inputs.isTicket ? isValidNumber(inputs.selectedSingleTicket, 'Ticket Sequence', 0) : null),

                    // RegularKey flow
                    () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                    () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                    () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                    () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),

                    // Multi-sign
                    () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),

                    // Account info + master key
                    () => (inputs.account_info === undefined || inputs.account_info === null ? 'No account data found' : null),
                    () => (inputs.account_info?.result?.account_flags?.disableMasterKey && !inputs.useMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
               ];
          }

          // Action-specific config: required fields and custom rules
          const actionConfig: Record<
               string,
               {
                    required: (keyof ValidationInputs)[];
                    customValidators?: (() => string | null)[];
                    asyncValidators?: (() => Promise<string | null>)[];
               }
          > = {
               getPoolInfo: {
                    required: ['selectedAccount', 'seed', 'weWantCurrencyField', 'weSpendCurrencyField'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidCurrency(inputs.weWantCurrencyField, 'We want currency'),
                         () => isValidCurrency(inputs.weSpendCurrencyField, 'We spend currency'),
                         () => (inputs.weWantCurrencyField !== 'XRP' ? isRequired(inputs.weWantIssuerField, 'We want issuer') : null),
                         () => (inputs.weSpendCurrencyField !== 'XRP' ? isRequired(inputs.weSpendIssuerField, 'We spend issuer') : null),
                         () => (inputs.weWantCurrencyField !== 'XRP' ? isValidXrpAddress(inputs.weWantIssuerField, 'We want issuer address') : null),
                         () => (inputs.weSpendCurrencyField !== 'XRP' ? isValidXrpAddress(inputs.weSpendIssuerField, 'We spend issuer address') : null),
                         () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                    ],
                    asyncValidators: [],
               },
               create: {
                    required: ['selectedAccount', 'seed', 'weWantAmountField', 'weSpendAmountField', 'weWantCurrencyField', 'weSpendCurrencyField'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.weWantAmountField, 'First pool amount', 0),
                         () => isValidNumber(inputs.weSpendAmountField, 'Second pool amount', 0),
                         () => isValidNumber(inputs.tradingFeeField, 'Trading fee', 0, 1000),
                         () => isValidCurrency(inputs.weWantCurrencyField, 'We want currency'),
                         () => isValidCurrency(inputs.weSpendCurrencyField, 'We spend currency'),
                         () => (inputs.weWantCurrencyField !== 'XRP' ? isRequired(inputs.weWantIssuerField, 'We want issuer') : null),
                         () => (inputs.weSpendCurrencyField !== 'XRP' ? isRequired(inputs.weSpendIssuerField, 'We spend issuer') : null),
                         () => (inputs.weWantCurrencyField !== 'XRP' ? isValidXrpAddress(inputs.weWantIssuerField, 'We want issuer address') : null),
                         () => (inputs.weSpendCurrencyField !== 'XRP' ? isValidXrpAddress(inputs.weSpendIssuerField, 'We spend issuer address') : null),
                         () => isNotSelfPayment(inputs.senderAddress, inputs.weSpendIssuerField),
                         () => isNotSelfPayment(inputs.senderAddress, inputs.weWantCurrencyField),
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
               deposit: {
                    required: ['selectedAccount', 'seed', ...(inputs.depositOptions?.bothPools || inputs.depositOptions?.firstPoolOnly ? (['weWantAmountField'] as (keyof ValidationInputs)[]) : []), ...(inputs.depositOptions?.bothPools || inputs.depositOptions?.secondPoolOnly ? (['weSpendAmountField'] as (keyof ValidationInputs)[]) : []), 'weWantCurrencyField', 'weSpendCurrencyField'],
                    ...(inputs.depositOptions?.firstPoolOnly ? (['weWantAmountField'] as (keyof ValidationInputs)[]) : []),
                    ...(inputs.depositOptions?.secondPoolOnly ? (['weSpendAmountField'] as (keyof ValidationInputs)[]) : []),
                    customValidators: [
                         () => isValidSeed(inputs.seed),

                         // Amount checks
                         () => (inputs.weWantAmountField ? isValidNumber(inputs.weWantAmountField, 'We want amount', 0) : null),
                         () => (inputs.weSpendAmountField ? isValidNumber(inputs.weSpendAmountField, 'We spend amount', 0) : null),

                         // Currency + issuer checks
                         () => isValidCurrency(inputs.weWantCurrencyField, 'We want currency'),
                         () => isValidCurrency(inputs.weSpendCurrencyField, 'We spend currency'),

                         () => (inputs.weWantCurrencyField !== 'XRP' ? isRequired(inputs.weWantIssuerField, 'We want issuer') : null),
                         () => (inputs.weWantCurrencyField !== 'XRP' ? isValidXrpAddress(inputs.weWantIssuerField, 'We want issuer address') : null),

                         () => (inputs.weSpendCurrencyField !== 'XRP' ? isRequired(inputs.weSpendIssuerField, 'We spend issuer') : null),
                         () => (inputs.weSpendCurrencyField !== 'XRP' ? isValidXrpAddress(inputs.weSpendIssuerField, 'We spend issuer address') : null),

                         // Shared rules
                         ...commonValidators(inputs),
                    ],
               },
               withdraw: {
                    required: [
                         'selectedAccount',
                         'seed',
                         'lpTokenBalanceField',
                         ...(inputs.withdrawOptions?.bothPools || inputs.withdrawOptions?.firstPoolOnly ? (['weWantCurrencyField'] as (keyof ValidationInputs)[]) : []),
                         ...(inputs.withdrawOptions?.bothPools || inputs.withdrawOptions?.secondPoolOnly ? (['weSpendCurrencyField'] as (keyof ValidationInputs)[]) : []),
                         ...(inputs.withdrawOptions?.firstPoolOnly ? (['weWantAmountField'] as (keyof ValidationInputs)[]) : []),
                         ...(inputs.withdrawOptions?.secondPoolOnly ? (['weSpendAmountField'] as (keyof ValidationInputs)[]) : []),
                    ],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.lpTokenBalanceField, 'LP token amount', 0),
                         () => isValidNumber(inputs.withdrawlLpTokenFromPoolField, 'LP withdraw amount', 0),

                         // Conditionally validate currencies
                         () => (inputs.withdrawOptions?.bothPools || inputs.withdrawOptions?.firstPoolOnly ? isValidCurrency(inputs.weWantCurrencyField, 'We want currency') : null),
                         () => (inputs.withdrawOptions?.bothPools || inputs.withdrawOptions?.secondPoolOnly ? isValidCurrency(inputs.weSpendCurrencyField, 'We spend currency') : null),

                         // Conditionally validate amounts
                         () => (inputs.weWantAmountField ? isValidNumber(inputs.weWantAmountField, 'We want amount', 0) : null),
                         () => (inputs.weSpendAmountField ? isValidNumber(inputs.weSpendAmountField, 'We spend amount', 0) : null),

                         // Issuers only if non-XRP
                         () => (inputs.weWantCurrencyField !== 'XRP' ? isRequired(inputs.weWantIssuerField, 'We want issuer') : null),
                         () => (inputs.weWantCurrencyField !== 'XRP' ? isValidXrpAddress(inputs.weWantIssuerField, 'We want issuer address') : null),

                         () => (inputs.weSpendCurrencyField !== 'XRP' ? isRequired(inputs.weSpendIssuerField, 'We spend issuer') : null),
                         () => (inputs.weSpendCurrencyField !== 'XRP' ? isValidXrpAddress(inputs.weSpendIssuerField, 'We spend issuer address') : null),

                         // Shared rules
                         ...commonValidators(inputs),
                    ],
               },
               swap: {
                    required: ['selectedAccount', 'seed', 'weWantAmountField', 'weWantCurrencyField', 'weSpendCurrencyField'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.weWantAmountField, 'Amount', 0),
                         () => (inputs.weSpendAmountField ? isValidNumber(inputs.weSpendAmountField, 'Send max amount', 0) : null),
                         () => isValidCurrency(inputs.weWantCurrencyField, 'We want currency'),
                         () => isValidCurrency(inputs.weSpendCurrencyField, 'We spend currency'),
                         () => (inputs.weWantCurrencyField !== 'XRP' ? isRequired(inputs.weWantIssuerField, 'We want issuer') : null),
                         () => (inputs.weSpendCurrencyField !== 'XRP' ? isRequired(inputs.weSpendIssuerField, 'We spend issuer') : null),
                         () => (inputs.weWantCurrencyField !== 'XRP' ? isValidXrpAddress(inputs.weWantIssuerField, 'We want issuer address') : null),
                         () => (inputs.weSpendCurrencyField !== 'XRP' ? isValidXrpAddress(inputs.weSpendIssuerField, 'We spend issuer address') : null),
                    ],
               },
               clawback: {
                    required: ['selectedAccount', 'seed', 'lpTokenBalanceField', 'weWantCurrencyField', 'weSpendCurrencyField'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.lpTokenBalanceField, 'LP token amount to claw back', 0),
                         () => isValidCurrency(inputs.weWantCurrencyField, 'We want currency'),
                         () => isValidCurrency(inputs.weSpendCurrencyField, 'We spend currency'),
                         () => (inputs.weWantCurrencyField !== 'XRP' ? isRequired(inputs.weWantIssuerField, 'We want issuer') : null),
                         () => (inputs.weSpendCurrencyField !== 'XRP' ? isRequired(inputs.weSpendIssuerField, 'We spend issuer') : null),
                         () => (inputs.weWantCurrencyField !== 'XRP' ? isValidXrpAddress(inputs.weWantIssuerField, 'We want issuer address') : null),
                         () => (inputs.weSpendCurrencyField !== 'XRP' ? isValidXrpAddress(inputs.weSpendIssuerField, 'We spend issuer address') : null),
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
               tokenBalance: {
                    required: ['selectedAccount', 'seed'],
                    customValidators: [() => isValidSeed(inputs.seed)],
                    asyncValidators: [],
               },
               weWantCurrencyChange: {
                    required: ['selectedAccount'],
                    customValidators: [() => isValidXrpAddress(this.utilsService.getSelectedAddressWithIssuer(inputs.selectedAccount || '', this.account1, this.account2, this.issuer), 'Account address')],
                    asyncValidators: [],
               },
               weSpendCurrencyChange: {
                    required: ['selectedAccount'],
                    customValidators: [() => isValidXrpAddress(this.utilsService.getSelectedAddressWithIssuer(inputs.selectedAccount || '', this.account1, this.account2, this.issuer), 'Account address')],
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
                    await Promise.all([this.onWeWantCurrencyChange(), this.onWeSpendCurrencyChange(), this.getAMMPoolInfo()]);
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
               this.weSpendAmountField = '';
               this.weWantAmountField = '';
          }
          this.isMemoEnabled = false;
          this.memoField = '';
          this.ticketSequence = '';
          this.isTicket = false;
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
          await new Promise(resolve => setTimeout(resolve, delayMs)); // Minimum display time for initial spinner
     }

     createAmmRequest(we_spend: CurrencyAmount, we_want: CurrencyAmount): AMMInfoRequest {
          return {
               command: 'amm_info',
               asset: this.isTokenAmount(we_spend) ? { currency: we_spend.currency, issuer: we_spend.issuer } : { currency: 'XRP' },
               asset2: this.isTokenAmount(we_want) ? { currency: we_want.currency, issuer: we_want.issuer } : { currency: 'XRP' },
          };
     }

     isTokenAmount(amount: CurrencyAmount): amount is CurrencyAmountToken {
          return amount.currency !== 'XRP';
     }

     formatCurrencyAmount(amount: string | IssuedCurrencyAmount | CurrencyAmount): string {
          if (typeof amount === 'string') {
               return `${xrpl.dropsToXrp(amount)} XRP`;
          }
          if ('issuer' in amount) {
               return `${amount.value} ${amount.currency} (${amount.issuer})`;
          }
          return `${amount.value} XRP`;
     }

     async getCurrencyBalance(balanceResponse: xrpl.GatewayBalancesResponse, address: string, currency: string, issuer?: string): Promise<string | null> {
          console.log('Entering getCurrencyBalance');
          this.setSuccessProperties();

          try {
               let tokenTotal = 0;
               if (balanceResponse.result.assets) {
                    Object.entries(balanceResponse.result.assets).forEach(([assetIssuer, assets]) => {
                         if (!issuer || assetIssuer === issuer) {
                              assets.forEach((asset: any) => {
                                   let assetCurrency = asset.currency.length > 3 ? this.utilsService.decodeCurrencyCode(asset.currency) : asset.currency;
                                   let assetCur = currency.length > 3 ? this.utilsService.decodeCurrencyCode(currency) : currency;
                                   if (assetCur === assetCurrency) {
                                        const value = parseFloat(asset.value);
                                        if (!isNaN(value)) {
                                             tokenTotal += value;
                                        }
                                   }
                              });
                         }
                    });
               } else if (balanceResponse.result.obligations) {
                    Object.entries(balanceResponse.result.obligations).forEach(([assetCurrency, value]) => {
                         // Decode if necessary
                         let decodedCurrency = assetCurrency.length > 3 ? this.utilsService.decodeCurrencyCode(assetCurrency) : assetCurrency;
                         let assetCur = currency.length > 3 ? this.utilsService.decodeCurrencyCode(currency) : currency;
                         if (assetCur === decodedCurrency) {
                              const numValue = parseFloat(value);
                              if (!isNaN(numValue)) {
                                   tokenTotal += numValue;
                              }
                         }
                    });
               }
               return tokenTotal > 0 ? tokenTotal.toString() : '0';
          } catch (error: any) {
               console.error('Error fetching token balance:', error);
               throw error;
          } finally {
               this.spinner = false;
               this.cdr.detectChanges();
               console.log(`Leaving getCurrencyBalance`);
          }
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

     private updateCurrencies() {
          this.currencies = [...Object.keys(this.knownTrustLinesIssuers)];
          this.xrpOnly = ['XRP'];
     }

     async checkAmmParticipation(client: xrpl.Client, account: string) {
          let result: { isAmmPool: boolean; isLiquidityProvider: boolean; ammInfo?: any; lpTokens: { issuer: string; currency: string; balance: string }[] } = {
               isAmmPool: false,
               isLiquidityProvider: false,
               ammInfo: undefined,
               lpTokens: [], // always an array
          };

          this.lpTokenBalanceField = '0';

          // 1. Check if the account itself is an AMM pool
          try {
               const ammResponse = await client.request({
                    command: 'amm_info',
                    amm_account: account,
               });

               if (ammResponse.result && ammResponse.result.amm) {
                    result.isAmmPool = true;
                    result.ammInfo = ammResponse.result.amm;
               }
          } catch (e) {
               // Not an AMM, ignore
          }

          // 2. Check if the account holds LP tokens (liquidity provider)
          try {
               const linesResponse = await client.request({
                    command: 'account_lines',
                    account: account,
               });

               for (const line of linesResponse.result.lines) {
                    // LP tokens are issued by AMM accounts and usually have a 40-char hex currency code
                    if (/^[A-F0-9]{40}$/i.test(line.currency)) {
                         result.isLiquidityProvider = true;
                         result.lpTokens.push({
                              issuer: line.account,
                              currency: line.currency,
                              balance: line.balance,
                         });
                         this.lpTokenBalanceField = line.balance;
                    }
               }
               console.log('LP Tokens found:', result.lpTokens);
               this.lpTokenBalanceField = this.utilsService.formatTokenBalance(this.lpTokenBalanceField, 18);
               console.log('this.lpTokenBalanceField: ', this.lpTokenBalanceField);
          } catch (e) {
               console.error('Error checking LP tokens:', e);
          }

          return result;
     }

     selectDepositOption(option: 'bothPools' | 'firstPoolOnly' | 'secondPoolOnly') {
          // Reset all options to false
          Object.keys(this.depositOptions).forEach(key => {
               this.depositOptions[key as keyof typeof this.depositOptions] = false;
          });

          // Set the clicked one to true
          this.depositOptions[option] = true;
     }

     selectWithdrawOption(option: 'bothPools' | 'firstPoolOnly' | 'secondPoolOnly') {
          // Reset all to false
          Object.keys(this.withdrawOptions).forEach(key => {
               this.withdrawOptions[key as keyof typeof this.withdrawOptions] = false;
          });

          // Enable the selected option
          this.withdrawOptions[option] = true;
     }

     toXRPLCurrency(currency: string, issuerAddress: string): XRPLCurrency {
          if (currency === 'XRP') {
               return { currency: 'XRP' };
          }
          return { currency, issuer: issuerAddress };
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
