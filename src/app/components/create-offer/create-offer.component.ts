import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { StorageService } from '../../services/storage.service';
import { TrustSet, OfferCreate, TransactionMetadataBase, OfferCreateFlags, BookOffer, IssuedCurrencyAmount, AMMInfoRequest } from 'xrpl';
import * as xrpl from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';
import BigNumber from 'bignumber.js';
import { Observable, BehaviorSubject } from 'rxjs';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';
import { AppWalletDynamicInputComponent } from '../app-wallet-dynamic-input/app-wallet-dynamic-input.component';
import { ClickToCopyService } from '../../services/click-to-copy/click-to-copy.service';

interface ValidationInputs {
     selectedAccount?: string;
     senderAddress?: string;
     seed?: string;
     account_info?: any;
     weWantAmountField?: string;
     weSpendAmountField?: string;
     weWantCurrencyField?: string;
     weSpendCurrencyField?: string;
     weWantIssuerField?: string;
     weSpendIssuerField?: string;
     offerSequenceField?: string;
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

interface AMMAsset {
     currency: string;
     issuer?: string;
}

interface CurrencyAmountXRP {
     currency: 'XRP';
     value: string;
}

interface CurrencyAmountToken {
     currency: string;
     issuer: string;
     value: string;
}

interface CurrencyObjectXRP {
     currency: 'XRP';
     value: string;
}

interface CurrencyObjectToken {
     currency: string;
     issuer: string;
     value: string;
}

interface AMMInfoResponse {
     result: {
          amm?: {
               amount: string | { currency: string; issuer: string; value: string };
               amount2: string | { currency: string; issuer: string; value: string };
               lp_token: { currency: string; issuer?: string; value: string };
               trading_fee: number;
               account: string; // Added for AMM account
          };
     };
}

type CurrencyObject = CurrencyObjectXRP | CurrencyObjectToken;
type CurrencyAmount = CurrencyAmountXRP | CurrencyAmountToken;

type CustomBookOffer = Partial<Omit<BookOffer, 'TakerGets' | 'TakerPays'>> & {
     Account: string;
     Flags: number;
     LedgerEntryType: 'Offer';
     Sequence: number;
     TakerGets: string | IssuedCurrencyAmount;
     TakerPays: string | IssuedCurrencyAmount;
     isAMM?: boolean;
     rate?: BigNumber;
};
@Component({
     selector: 'app-create-offer',
     standalone: true,
     imports: [CommonModule, FormsModule, AppWalletDynamicInputComponent, NavbarComponent, SanitizeHtmlPipe, MatTableModule, MatSortModule, MatPaginatorModule, MatButtonModule],
     templateUrl: './create-offer.component.html',
     styleUrl: './create-offer.component.css',
     encapsulation: ViewEncapsulation.None,
})
export class CreateOfferComponent implements AfterViewChecked {
     dataSource = new MatTableDataSource<any>();
     displayedColumns: string[] = ['transactionType', 'createdDate', 'creationAge', 'action', 'amountXrp', 'amountToken', 'currency', 'issuer', 'timestamp', 'transactionHash'];
     @ViewChild(MatPaginator) paginator!: MatPaginator;
     @ViewChild(MatSort) sort!: MatSort;
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     @ViewChild('accountForm') accountForm!: NgForm;
     private lastResult: string = '';
     result: string = '';
     weSpendCurrencyField: string = 'XRP';
     offerSequenceField: string = '';
     weWantCurrencyField: string = 'CTZ'; // Set default token when page loads
     weWantIssuerField: string = '';
     weWantAmountField: string = '';
     weWantTokenBalanceField: string = '';
     weSpendIssuerField: string = '';
     weSpendAmountField: string = '';
     weSpendTokenBalanceField: string = '';
     isMarketOrder: boolean = false;
     isFillOrKill: boolean = false;
     isPassive: boolean = true;
     ticketCountField: string = '';
     ticketSequence: string = '';
     isTicket: boolean = false;
     isTicketEnabled: boolean = false;
     ticketArray: string[] = [];
     selectedTickets: string[] = [];
     selectedSingleTicket: string = '';
     multiSelectMode: boolean = false;
     selectedTicket: string = '';
     destinationTagField: string = '';
     xrpBalance1Field: string = '';
     ownerCount: string = '';
     totalXrpReserves: string = '';
     executionTime: string = '';
     amountField: string = '';
     currentTimeField: string = '';
     memoField: string = '';
     isMemoEnabled: boolean = false;
     isMultiSignTransaction: boolean = false;
     multiSignAddress: string = '';
     useMultiSign: boolean = false;
     multiSignSeeds: string = '';
     isRegularKeyAddress: boolean = false;
     regularKeySeed: string = '';
     regularKeyAddress: string = '';
     signerQuorum: number = 0;
     multiSigningEnabled: boolean = false;
     regularKeySigningEnabled: boolean = false;
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
     phnixBalance: string = '0'; // Hardcoded for now, will be fetched dynamically
     phnixExchangeXrp: string = '0'; // To store the calculated XRP amount
     xrpPrice: string = '0'; // New property to store XRP price in RLUSD
     averageExchangeRate: string = '';
     maxSellablePhnix: string = '';
     phnixCurrencyCode: string = '';
     insufficientLiquidityWarning: boolean = false;
     showManageTokens = false;
     slippage: number = 0.2357; // Default to 23.57%
     tokens$: Observable<{ transactionType: string; action: string; amountXrp: string; amountToken: string; currency: string; issuer: string; transactionHash: string; timestamp: Date; createdDate: Date; creationAge: string }[]>;
     private memeTokensSubject = new BehaviorSubject<{ transactionType: string; action: string; amountXrp: string; amountToken: string; currency: string; issuer: string; transactionHash: string; timestamp: Date; createdDate: Date; creationAge: string }[]>([]);
     memeTokens$ = this.memeTokensSubject.asObservable(); // Use Observable for UI binding
     private readonly maxTokens = 20; // Limit to 20 tokens
     // Add a map of known issuers for tokens
     knownIssuers: { [key: string]: string[] } = { XRP: [] };
     issuerToRemove: string = '';
     currencies: string[] = [];
     newCurrency: string = '';
     newIssuer: string = '';
     tokenToRemove: string = '';
     signers: { account: string; seed: string; weight: number }[] = [{ account: '', seed: '', weight: 1 }];
     private readonly priceRefreshInterval: any; // For polling
     wallets: any[] = [];
     selectedWalletIndex: number = 0;
     currentWallet = { name: '', address: '', seed: '', balance: '' };

     constructor(private readonly xrplService: XrplService, private readonly utilsService: UtilsService, private readonly cdr: ChangeDetectorRef, private readonly storageService: StorageService, private readonly renderUiComponentsService: RenderUiComponentsService, private readonly xrplTransactions: XrplTransactionService, private readonly clickToCopyService: ClickToCopyService) {
          this.tokens$ = this.xrplService.tokens$; // Initialize tokens observable
     }

     ngOnInit() {
          const storedIssuers = this.storageService.getKnownIssuers('knownIssuers');
          if (storedIssuers) {
               this.knownIssuers = storedIssuers;
          }
          this.updateCurrencies();
          this.startTokenMonitoring();
          this.memeTokens$.subscribe(tokens => {
               this.dataSource.data = tokens;
          });
     }

     ngAfterViewInit() {
          // (async () => {
          //      try {
          //           this.onAccountChange(); // Load initial
          //           this.dataSource.paginator = this.paginator;
          //           this.dataSource.sort = this.sort;
          //           this.startPriceRefresh(); // Start polling for price
          //      } catch (error: any) {
          //           console.error(`Error loading initial wallet: ${error.message}`);
          //           this.setError('ERROR: Could not load initial wallet');
          //      } finally {
          //           this.cdr.detectChanges();
          //      }
          // })();
     }

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
               await Promise.all([this.onWeWantCurrencyChange(), this.onWeSpendCurrencyChange()]);
               this.getOffers();
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

     ngOnDestroy() {
          // Clean up interval to prevent memory leaks
          if (this.priceRefreshInterval) {
               clearInterval(this.priceRefreshInterval);
          }
     }

     async getOffers() {
          console.log('Entering getOffers');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
          };

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }

               this.updateSpinnerMessage(`Getting Offers`);

               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const [accountInfo, offersResponse, accountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountOffers(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
               this.utilsService.logAccountInfoObjects(accountInfo, accountObjects);
               this.utilsService.logObjects('offersResponse', offersResponse);

               inputs.account_info = accountInfo;

               const errors = await this.validateInputs(inputs, 'getOffers');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               const data = {
                    sections: [{}],
               };

               const offers = offersResponse.result.offers || [];

               if (offers.length <= 0) {
                    data.sections.push({
                         title: 'Offers',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No offers found for <code>${wallet.classicAddress}</code>` }],
                    });
               } else {
                    data.sections.push({
                         title: `Offers (${offers.length})`,
                         openByDefault: true,
                         subItems: offers.map((offer, index) => {
                              // Format taker_gets
                              const takerGets = typeof offer.taker_gets === 'string' ? `${xrpl.dropsToXrp(offer.taker_gets)} XRP` : `${offer.taker_gets.value} ${this.utilsService.decodeIfNeeded(offer.taker_gets.currency)}${offer.taker_gets.issuer ? ` (Issuer: ${offer.taker_gets.issuer})` : ''}`;
                              // Format taker_pays
                              const takerPays = typeof offer.taker_pays === 'string' ? `${xrpl.dropsToXrp(offer.taker_pays)} XRP` : `${offer.taker_pays.value} ${this.utilsService.decodeIfNeeded(offer.taker_pays.currency)}${offer.taker_pays.issuer ? ` (Issuer: ${offer.taker_pays.issuer})` : ''}`;
                              // Build content array
                              const content: { key: string; value: string }[] = [
                                   { key: 'Sequence', value: String(offer.seq) },
                                   { key: 'Taker Gets', value: takerGets },
                                   { key: 'Taker Pays', value: takerPays },
                                   { key: 'Rate', value: this.calculateRate(offer.taker_gets, offer.taker_pays) },
                              ];

                              if (offer.expiration) {
                                   content.push({ key: 'Expiration', value: new Date(offer.expiration * 1000).toISOString() });
                              }
                              if (offer.flags != null) {
                                   content.push({ key: 'Flags', value: String(offer.flags) });
                              }

                              return {
                                   key: `Offer ${index + 1} (Sequence: ${offer.seq})`,
                                   openByDefault: false,
                                   content,
                              };
                         }),
                    });
               }

               // Render UI
               this.renderUiComponentsService.renderDetails(data);
               this.setSuccess(this.result);
               this.clickToCopyService.attachCopy(this.resultField.nativeElement);

               // Non-critical UI updates — let main render complete first
               setTimeout(async () => {
                    try {
                         this.refreshUIData(wallet, accountInfo, accountObjects);
                         this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
                         this.clearFields(false);
                         this.updateTickets(accountObjects);
                         this.currentWallet.balance = await this.updateXrpBalance(client, accountInfo, wallet);
                    } catch (err) {
                         console.error('Error in deferred UI updates for offers:', err);
                    }
               }, 0);
          } catch (error: any) {
               console.error('Error in getOffers:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getOffers in ${this.executionTime}ms`);
          }
     }

     async getOrderBook() {
          console.log('Entering getOrderBook');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
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
               this.updateSpinnerMessage(`Getting Order Book`);

               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const [accountInfo, accountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
               this.utilsService.logAccountInfoObjects(accountInfo, accountObjects);

               inputs.account_info = accountInfo;

               const errors = await this.validateInputs(inputs, 'getOrderBook');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               // Prepare currency objects
               const we_want: CurrencyAmount = this.weWantCurrencyField === 'XRP' ? { currency: 'XRP', value: this.weWantAmountField } : { currency: this.utilsService.encodeIfNeeded(this.weWantCurrencyField), issuer: this.weWantIssuerField, value: this.weWantAmountField };
               const we_spend: CurrencyAmount = this.weSpendCurrencyField === 'XRP' ? { currency: 'XRP', value: this.weSpendAmountField } : { currency: this.utilsService.encodeIfNeeded(this.weSpendCurrencyField), issuer: this.weSpendIssuerField, value: this.weSpendAmountField };

               // Decode currencies for display
               const displayWeWantCurrency = this.utilsService.decodeIfNeeded(we_want.currency);
               const displayWeSpendCurrency = this.utilsService.decodeIfNeeded(we_spend.currency);
               const offerType = we_spend.currency === AppConstants.XRP_CURRENCY ? 'buy' : 'sell';

               // PARALLELIZE — fetch order book, counter order book, and AMM data
               const [orderBook, counterOrderBook, ammData] = await Promise.all([
                    client.request({
                         command: 'book_offers',
                         taker: wallet.classicAddress,
                         ledger_index: 'current',
                         taker_gets: we_want,
                         taker_pays: we_spend,
                    }),
                    client.request({
                         command: 'book_offers',
                         taker: wallet.classicAddress,
                         ledger_index: 'current',
                         taker_gets: we_spend,
                         taker_pays: we_want,
                    }),
                    client.request(this.createAmmRequest(we_spend, we_want)).catch(err => {
                         console.warn('No AMM pool found for this pair:', err);
                         return null; // prevent rejection
                    }) as Promise<AMMInfoResponse | null>,
               ]);

               this.utilsService.logObjects('orderBook', orderBook);
               this.utilsService.logObjects('counterOrderBook', counterOrderBook);
               this.utilsService.logObjects('ammData', ammData ? ammData.result : '');

               // Process AMM data if available
               const combinedOffers: CustomBookOffer[] = [...orderBook.result.offers];

               if (ammData?.result?.amm) {
                    const amm = ammData.result.amm;

                    const takerGets: string | IssuedCurrencyAmount = this.isTokenAmount(we_want)
                         ? {
                                currency: we_want.currency,
                                issuer: we_want.issuer!,
                                value: typeof amm.amount2 === 'string' ? String(xrpl.dropsToXrp(amm.amount2)) : amm.amount2.value,
                           }
                         : typeof amm.amount2 === 'string'
                         ? amm.amount2
                         : amm.amount2.value;

                    const takerPays: string | IssuedCurrencyAmount = this.isTokenAmount(we_spend)
                         ? {
                                currency: we_spend.currency,
                                issuer: we_spend.issuer!,
                                value: typeof amm.amount === 'string' ? String(xrpl.dropsToXrp(amm.amount)) : amm.amount.value,
                           }
                         : typeof amm.amount === 'string'
                         ? amm.amount
                         : amm.amount.value;

                    const ammOffer: CustomBookOffer = {
                         Account: amm.account || 'AMM_POOL',
                         Flags: 0,
                         LedgerEntryType: 'Offer',
                         Sequence: 0,
                         TakerGets: takerGets,
                         TakerPays: takerPays,
                         isAMM: true,
                         rate: new BigNumber(typeof amm.amount2 === 'string' ? xrpl.dropsToXrp(amm.amount2) : amm.amount2.value).dividedBy(typeof amm.amount === 'string' ? xrpl.dropsToXrp(amm.amount) : amm.amount.value),
                         BookDirectory: '0',
                         BookNode: '0',
                         OwnerNode: '0',
                         PreviousTxnID: '0',
                         PreviousTxnLgrSeq: 0,
                    };

                    combinedOffers.unshift(ammOffer);
               }

               // Calculate stats
               const spread = this.computeBidAskSpread(offerType === 'sell' ? counterOrderBook.result.offers : combinedOffers, offerType === 'sell' ? combinedOffers : counterOrderBook.result.offers);
               const liquidity = this.computeLiquidityRatio(offerType === 'sell' ? counterOrderBook.result.offers : combinedOffers, offerType === 'sell' ? combinedOffers : counterOrderBook.result.offers, offerType === 'sell');
               const stats = this.computeAverageExchangeRateBothWays(combinedOffers, 5);

               // Build UI data — RENDER IMMEDIATELY
               const pair = `${displayWeWantCurrency}/${displayWeSpendCurrency}`;
               const reversePair = `${displayWeSpendCurrency}/${displayWeWantCurrency}`;

               const data = {
                    sections: [
                         {
                              title: 'Market Pair',
                              content: [
                                   { key: 'Trading Pair', value: `${displayWeSpendCurrency}/${displayWeWantCurrency}` },
                                   { key: 'Offer Type', value: offerType === 'sell' ? 'Sell Order' : 'Buy Order' },
                              ],
                         },
                         {
                              title: `Order Book (${combinedOffers.length})${ammData?.result?.amm ? ' + AMM' : ''}`,
                              openByDefault: true,
                              subItems: combinedOffers.map((offer, index) => ({
                                   key: `${offer.isAMM ? 'AMM Pool' : `Order ${index + 1}`}`,
                                   openByDefault: index === 0,
                                   content: [{ key: 'Type', value: offer.isAMM ? 'AMM Liquidity' : 'Limit Order' }, { key: 'Taker Gets', value: this.formatCurrencyAmount(offer.TakerGets) }, { key: 'Taker Pays', value: this.formatCurrencyAmount(offer.TakerPays) }, { key: 'Rate', value: this.calculateRate(offer.TakerGets, offer.TakerPays) }, ...(offer.Sequence ? [{ key: 'Sequence', value: String(offer.Sequence) }] : []), { key: 'Account', value: `<code>${offer.Account || 'AMM Pool'}</code>` }],
                              })),
                         },
                    ],
               };

               // Add stats if available
               if (combinedOffers.length > 0 || ammData?.result?.amm) {
                    this.populateStatsFields(stats, we_want, we_spend, spread, liquidity, offerType);

                    const statsContent = [
                         { key: 'VWAP', value: `${stats.forward.vwap.toFixed(8)} ${pair}` },
                         { key: 'Simple Average', value: `${stats.forward.simpleAvg.toFixed(8)} ${pair}` },
                         { key: 'Best Rate', value: `${stats.forward.bestRate.toFixed(8)} ${pair}` },
                         { key: 'Worst Rate', value: `${stats.forward.worstRate.toFixed(8)} ${pair}` },
                         { key: '1 XRP per Token', value: `${stats.inverse.vwap.toFixed(8)} ${reversePair}` },
                         { key: '1 XRP per Token (Best Rate)', value: `${stats.inverse.bestRate.toFixed(8)} ${reversePair}` },
                         {
                              key: 'Depth (30% slippage)',
                              value: `${stats.forward.depthDOG.toFixed(2)} ${displayWeWantCurrency} for ${stats.forward.depthXRP.toFixed(2)} ${displayWeSpendCurrency}`,
                         },
                         {
                              key: `Execution (5 ${displayWeSpendCurrency})`,
                              value: stats.forward.insufficientLiquidity ? `Insufficient liquidity: ${stats.forward.executionDOG.toFixed(2)} ${displayWeWantCurrency} for ${stats.forward.executionXRP.toFixed(2)} ${displayWeSpendCurrency}, Avg Rate: ${stats.forward.executionPrice.toFixed(8)} ${pair}` : `Receive ${stats.forward.executionDOG.toFixed(2)} ${displayWeWantCurrency}, Avg Rate: ${stats.forward.executionPrice.toFixed(8)} ${pair}`,
                         },
                         {
                              key: 'Price Volatility',
                              value: `Mean ${stats.forward.simpleAvg.toFixed(8)} ${pair}, StdDev ${stats.forward.volatility.toFixed(8)} (${stats.forward.volatilityPercent.toFixed(2)}%)`,
                         },
                         {
                              key: 'Spread',
                              value: offerType === 'buy' ? `${spread.spread.toFixed(8)} ${pair} (${spread.spreadPercent.toFixed(2)}%)` : `${spread.spread.toFixed(8)} ${reversePair} (${spread.spreadPercent.toFixed(2)}%)`,
                         },
                         {
                              key: 'Liquidity Ratio',
                              value: `${liquidity.ratio.toFixed(2)} (${pair} vs ${reversePair})`,
                         },
                    ];

                    // Add AMM spot price if available
                    if (ammData?.result?.amm) {
                         const amm = ammData.result.amm;
                         const spotPrice = amm.trading_fee / 1000000;
                         statsContent.push({
                              key: 'AMM Spot Price',
                              value: `${spotPrice.toFixed(8)} ${pair}`,
                         });

                         const tradingFeeBps = amm.trading_fee;
                         data.sections.push({
                              title: 'AMM Pool',
                              content: [
                                   { key: 'Trading Fee', value: `${(tradingFeeBps / 100).toFixed(2)}%` },
                                   { key: 'Fee in XRP (per 1 XRP swap)', value: `${((1 * tradingFeeBps) / 10000).toFixed(6)} XRP` },
                              ],
                         });
                    }

                    data.sections.push({
                         title: 'Statistics',
                         content: statsContent,
                    });
               }

               // Render UI
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
                         this.currentWallet.balance = await this.updateXrpBalance(client, accountInfo, wallet);
                    } catch (err) {
                         console.error('Error updating balance after order book render:', err);
                    }
               }, 0);
          } catch (error: any) {
               console.error('Error in getOrderBook:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getOrderBook in ${this.executionTime}ms`);
          }
     }

     async createOffer() {
          console.log('Entering createOffer');
          const startTime = Date.now();
          this.setSuccessProperties();
          this.updateSpinnerMessage(``);

          const inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
               weWantAmountField: this.weWantAmountField,
               weSpendAmountField: this.weSpendAmountField,
               weWantCurrencyField: this.weWantCurrencyField,
               weSpendCurrencyField: this.weSpendCurrencyField,
               weWantIssuerField: this.weWantCurrencyField !== 'XRP' ? this.weWantIssuerField : undefined,
               weSpendIssuerField: this.weSpendCurrencyField !== 'XRP' ? this.weSpendIssuerField : undefined,
               isRegularKeyAddress: this.isRegularKeyAddress,
               regularKeyAddress: this.isRegularKeyAddress && !this.useMultiSign ? this.regularKeyAddress : undefined,
               regularKeySeed: this.isRegularKeyAddress && !this.useMultiSign ? this.regularKeySeed : undefined,
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

               const [accountInfo, fee, initialXrpBalance, trustLines, serverInfo] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), client.getXrpBalance(wallet.classicAddress), this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', ''), this.xrplService.getXrplServerInfo(client, 'current', '')]);
               this.utilsService.logAccountInfoObjects(accountInfo, null);
               this.utilsService.logObjects(`trustLines`, trustLines.result);
               this.utilsService.logObjects(`serverInfo`, serverInfo);
               this.utilsService.logObjects(`fee`, fee);

               inputs.account_info = accountInfo;

               const errors = await this.validateInputs(inputs, 'createOffer');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               interface SpendObject {
                    amount?: string; // For XRP
                    currency?: string; // For tokens
                    value?: string; // For tokens
                    issuer?: string; // For tokens
               }

               interface CurrencyObjectXRP {
                    currency: string;
                    value: string;
               }

               interface CurrencyObjectToken {
                    currency: string;
                    issuer: string;
                    value: string;
               }

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

               this.utilsService.logObjects(`issuerAddr`, issuerAddr);
               this.utilsService.logObjects(`issuerCur`, issuerCur);

               const doesTrustLinesExists = trustLines.result.lines.filter((line: any) => {
                    // Decode currency for comparison
                    const decodedCurrency = line.currency.length > 3 ? this.utilsService.decodeCurrencyCode(line.currency) : line.currency;
                    return (
                         parseFloat(line.limit) > 0 &&
                         parseFloat(line.balance) >= 0 &&
                         line.account === issuerAddr && // Use 'account' as the issuer field
                         (issuerCur ? decodedCurrency === issuerCur : true)
                    );
               });
               console.debug(`Active trust lines for ${wallet.classicAddress}:`, doesTrustLinesExists);

               if (doesTrustLinesExists.length <= 0) {
                    const decodedCurrency = issuerCur.length > 3 ? this.utilsService.encodeCurrencyCode(issuerCur) : issuerCur;
                    const currentLedger = await this.xrplService.getLastLedgerIndex(client);
                    const trustSetTx: TrustSet = {
                         TransactionType: 'TrustSet',
                         Account: wallet.classicAddress,
                         LimitAmount: {
                              currency: decodedCurrency,
                              issuer: issuerAddr,
                              value: '100000000',
                         },
                         Fee: fee,
                         LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                    };

                    if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, trustSetTx, fee)) {
                         return this.setError('ERROR: Insufficient XRP to complete transaction');
                    }

                    this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Trustline (no changes will be made)...' : 'Submitting Trustline to Ledger...');

                    let response: any;

                    if (this.isSimulateEnabled) {
                         response = await this.xrplTransactions.simulateTransaction(client, trustSetTx);
                    } else {
                         const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                         const signedTx = await this.xrplTransactions.signTransaction(client, wallet, trustSetTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

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
               }

               if (!this.isSimulateEnabled) {
                    data.sections.push({
                         title: 'Trust Line Setup',
                         openByDefault: true,
                         content: [
                              { key: 'Status', value: 'Trust line created' },
                              { key: 'Currency', value: issuerCur },
                              { key: 'Issuer', value: `<code>${issuerAddr}</code>` },
                              { key: 'Limit', value: this.amountField },
                         ],
                    });
               } else {
                    data.sections.push({
                         title: 'Trust Line Setup',
                         openByDefault: true,
                         content: [{ key: 'Status', value: 'Trust lines already exist' }],
                    });
               }

               // // Fetch reserve information
               const xrpReserve = await this.xrplService.getXrpReserveRequirements(accountInfo, serverInfo);

               data.sections.push({
                    title: 'Account Reserve Information',
                    openByDefault: true,
                    content: [
                         { key: 'Base Reserve', value: `${xrpReserve.baseReserve} XRP` },
                         { key: 'Owner Reserve (per object)', value: `${xrpReserve.ownerReserve} XRP` },
                         { key: 'Owner Count', value: String(xrpReserve.ownerCount) },
                         { key: 'Current Reserve', value: `${xrpReserve.currentReserve} XRP` },
                    ],
               });

               // Initial balances
               console.log(`Initial XRP Balance ${initialXrpBalance} (drops): ${xrpl.xrpToDrops(initialXrpBalance)}`);

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
                         currency: this.utilsService.encodeIfNeeded(this.weSpendCurrencyField),
                         value: this.weSpendAmountField,
                         issuer: this.weSpendIssuerField,
                    };
               }

               we_want.currency = this.utilsService.encodeIfNeeded(we_want.currency);

               const offerType = we_spend.currency ? 'sell' : 'buy';
               this.utilsService.logObjects(`offerType`, offerType);

               // Rate analysis
               const proposedQuality = new BigNumber(this.weSpendAmountField).dividedBy(this.weWantAmountField);
               const effectiveRate = this.calculateEffectiveRate(proposedQuality, xrpReserve, offerType);
               const rateAnalysis = [
                    {
                         key: 'Proposed Rate',
                         value: `1 ${we_want.currency} = ${proposedQuality.toFixed(8)} ${we_spend.currency || AppConstants.XRP_CURRENCY}`,
                    },
                    {
                         key: 'Effective Rate',
                         value: `1 ${we_want.currency} = ${effectiveRate.toFixed(8)} ${we_spend.currency || AppConstants.XRP_CURRENCY}`,
                    },
               ];
               if (effectiveRate.gt(proposedQuality)) {
                    rateAnalysis.push({
                         key: 'Note',
                         value: 'Effective rate is worse than proposed due to XRP reserve requirements',
                    });
               }

               // fetch order book, counter order book, and AMM data
               const [orderBook, orderBook2] = await Promise.all([
                    client.request({
                         command: 'book_offers',
                         taker: wallet.address,
                         taker_gets: we_want,
                         taker_pays: we_spend.currency ? we_spend : { currency: AppConstants.XRP_CURRENCY, value: this.weSpendAmountField },
                         ledger_index: 'current',
                    }),
                    client.request({
                         command: 'book_offers',
                         taker: wallet.address,
                         taker_gets: we_spend.currency ? we_spend : { currency: AppConstants.XRP_CURRENCY, value: this.weSpendAmountField },
                         taker_pays: we_want,
                         ledger_index: 'current',
                    }),
               ]);

               const MAX_SLIPPAGE = 0.05;
               const offers = orderBook.result.offers;
               let runningTotal = new BigNumber(0);
               const wantAmount = new BigNumber(this.weWantAmountField);
               let bestOfferQuality = null;
               let marketAnalysis: MarketAnalysisItem[] = [];
               if (offers.length > 0) {
                    for (const o of offers) {
                         const offerQuality = new BigNumber(o.quality ?? '0');
                         if (!bestOfferQuality || offerQuality.lt(bestOfferQuality)) {
                              bestOfferQuality = offerQuality;
                         }
                         if (offerQuality.lte(proposedQuality.times(1 + MAX_SLIPPAGE))) {
                              const slippage = proposedQuality.minus(offerQuality).dividedBy(offerQuality);
                              marketAnalysis = [
                                   {
                                        key: 'Best Rate',
                                        value: `1 ${we_want.currency} = ${bestOfferQuality?.toFixed(6) || '0'} ${we_spend.currency || AppConstants.XRP_CURRENCY}`,
                                   },
                                   {
                                        key: 'Proposed Rate',
                                        value: `1 ${we_want.currency} = ${proposedQuality.toFixed(6)} ${we_spend.currency || AppConstants.XRP_CURRENCY}`,
                                   },
                                   { key: 'Slippage', value: `${slippage.times(100).toFixed(2)}%` },
                              ];
                              if (slippage.gt(MAX_SLIPPAGE)) {
                                   marketAnalysis.push({
                                        key: 'Warning',
                                        value: `Slippage ${slippage.times(100).toFixed(2)}% exceeds ${MAX_SLIPPAGE * 100}%`,
                                   });
                              }
                              runningTotal = runningTotal.plus(new BigNumber(o.owner_funds || (typeof o.TakerGets === 'object' && 'value' in o.TakerGets ? o.TakerGets.value : o.TakerGets)));
                              if (runningTotal.gte(wantAmount)) break;
                         }
                    }
               }

               if (runningTotal.eq(0)) {
                    const offeredQuality = new BigNumber(this.weWantAmountField).dividedBy(this.weSpendAmountField);
                    const offers2 = orderBook2.result.offers;
                    let runningTotal2 = new BigNumber(0);
                    let tallyCurrency = we_spend.currency || AppConstants.XRP_CURRENCY;
                    if (tallyCurrency === AppConstants.XRP_CURRENCY) {
                         tallyCurrency = 'drops of XRP';
                    }
                    if (offers2.length > 0) {
                         for (const o of offers2) {
                              if (typeof o.quality !== 'undefined' && Number(o.quality) <= effectiveRate.toNumber()) {
                                   const bestOfferQuality2 = new BigNumber(o.quality);
                                   const slippage = proposedQuality.minus(bestOfferQuality2).dividedBy(bestOfferQuality2);
                                   marketAnalysis = [
                                        {
                                             key: 'Best Rate',
                                             value: `1 ${we_spend.currency || AppConstants.XRP_CURRENCY} = ${bestOfferQuality2.toFixed(6)} ${we_want.currency}`,
                                        },
                                        {
                                             key: 'Proposed Rate',
                                             value: `1 ${we_spend.currency || AppConstants.XRP_CURRENCY} = ${proposedQuality.toFixed(6)} ${we_want.currency}`,
                                        },
                                        { key: 'Slippage', value: `${slippage.times(100).toFixed(2)}%` },
                                   ];
                                   if (slippage.gt(MAX_SLIPPAGE)) {
                                        marketAnalysis.push({
                                             key: 'Warning',
                                             value: `Slippage ${slippage.times(100).toFixed(2)}% exceeds ${MAX_SLIPPAGE * 100}%`,
                                        });
                                   }
                                   runningTotal2 = runningTotal2.plus(new BigNumber(o.owner_funds || '0'));
                              } else {
                                   break;
                              }
                         }
                         if (runningTotal2.gt(0)) {
                              marketAnalysis.push({
                                   key: 'Order Book Position',
                                   value: `Offer placed below at least ${runningTotal2.toFixed(2)} ${tallyCurrency}`,
                              });
                         }
                    }
                    if (!offers2.length) {
                         marketAnalysis.push({
                              key: 'Order Book Position',
                              value: 'No similar offers; this would be the first',
                         });
                    }
               }
               interface MarketAnalysisItem {
                    key: string;
                    value: string;
               }

               data.sections.push({
                    title: 'Market Analysis',
                    openByDefault: true,
                    content: (marketAnalysis.length ? marketAnalysis : [{ key: 'Status', value: 'No matching offers found in order book' }]) as MarketAnalysisItem[],
               });

               // Properly assign and type we_want1 and we_spend1 for OfferCreate
               let we_want1: string | { currency: string; issuer: string; value: string };
               let we_spend1: string | { currency: string; issuer: string; value: string };

               // we_want1
               if (this.weWantCurrencyField === AppConstants.XRP_CURRENCY) {
                    if (!this.weWantAmountField) {
                         throw new Error('weWantAmountField is required for XRP');
                    }
                    // XRP is represented as drops (string)
                    we_want1 = xrpl.xrpToDrops(this.weWantAmountField);
               } else {
                    if (!this.weWantAmountField || !this.weWantIssuerField) {
                         throw new Error('weWantAmountField and weWantIssuerField are required for token');
                    }
                    we_want1 = {
                         currency: this.utilsService.encodeIfNeeded(this.weWantCurrencyField),
                         issuer: this.weWantIssuerField,
                         value: this.weWantAmountField,
                    };
               }

               // we_spend1
               if (this.weSpendCurrencyField === AppConstants.XRP_CURRENCY) {
                    if (!this.weSpendAmountField) {
                         throw new Error('weSpendAmountField is required for XRP');
                    }
                    we_spend1 = xrpl.xrpToDrops(this.weSpendAmountField);
               } else {
                    if (!this.weSpendAmountField || !this.weSpendIssuerField) {
                         throw new Error('weSpendAmountField and weSpendIssuerField are required for token');
                    }
                    we_spend1 = {
                         currency: this.utilsService.encodeIfNeeded(this.weSpendCurrencyField),
                         issuer: this.weSpendIssuerField,
                         value: this.weSpendAmountField,
                    };
               }

               let flags = 0;

               if (this.isMarketOrder) {
                    // For a market order, you might want ImmediateOrCancel
                    flags |= OfferCreateFlags.tfImmediateOrCancel;
               } else if (this.isFillOrKill) {
                    // Optional: if you also want FillOrKill
                    flags |= OfferCreateFlags.tfFillOrKill;
               } else {
                    // For a passive order, use tfPassive
                    flags |= OfferCreateFlags.tfPassive;
               }

               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               let offerCreateTx: OfferCreate = {
                    TransactionType: 'OfferCreate',
                    Account: wallet.classicAddress,
                    TakerGets: we_spend1,
                    TakerPays: we_want1,
                    Flags: flags, // numeric bitmask of selected options
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               await this.setTxOptionalFields(client, offerCreateTx, wallet, accountInfo, 'createOffer');

               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, offerCreateTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }
               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Create Offer (no changes will be made)...' : 'Submitting Create Offer to Ledger...');

               let response: any;

               if (this.isSimulateEnabled) {
                    response = await this.xrplTransactions.simulateTransaction(client, offerCreateTx);
               } else {
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    const signedTx = await this.xrplTransactions.signTransaction(client, wallet, offerCreateTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

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

               // Balance changes
               let balanceChanges: { account: string; balances: any[] }[] = [];
               if (response.result.meta && typeof response.result.meta !== 'string') {
                    balanceChanges = xrpl.getBalanceChanges(response.result.meta);
               }
               data.sections.push({
                    title: 'Balance Changes',
                    openByDefault: true,
                    content: balanceChanges.length
                         ? balanceChanges.flatMap((change, index) =>
                                change.balances.map((bal, balIdx) => ({
                                     key: `Change ${index + 1}${change.balances.length > 1 ? `.${balIdx + 1}` : ''}`,
                                     value: `${bal.value} ${bal.currency}${bal.issuer ? ` (Issuer: <code>${bal.issuer}</code>)` : ''} for <code>${change.account}</code>`,
                                }))
                           )
                         : [{ key: 'Status', value: 'No balance changes recorded' }],
               });

               const [finalXrpBalance, acctOffers] = await Promise.all([client.getXrpBalance(wallet.classicAddress), this.xrplService.getAccountOffers(client, wallet.classicAddress, 'validated', '')]);

               data.sections.push({
                    title: 'Updated Balances',
                    openByDefault: true,
                    content: [
                         { key: 'XRP', value: finalXrpBalance.toString() },
                         // { key: tokenBalance, value: updatedTokenBalance },
                    ],
               });

               // Outstanding offers
               function amt_str(amt: any): string {
                    if (typeof amt === 'string') {
                         // Assume XRP in drops
                         return `${xrpl.dropsToXrp(amt)} XRP`;
                    } else if (amt && typeof amt === 'object') {
                         // Assume token object
                         return `${amt.value} ${amt.currency}${amt.issuer ? ` (Issuer: ${amt.issuer})` : ''}`;
                    }
                    return String(amt);
               }
               if (acctOffers.result.offers && acctOffers.result.offers.length > 0) {
                    data.sections.push({
                         title: `Outstanding Offers (${acctOffers.result.offers.length})`,
                         openByDefault: false,
                         subItems: acctOffers.result.offers.map((offer: any, index: number) => ({
                              key: `Offer ${index + 1}`,
                              openByDefault: false,
                              content: [{ key: 'Sequence', value: offer.seq }, { key: 'TakerGets', value: amt_str(offer.taker_gets) }, { key: 'TakerPays', value: amt_str(offer.taker_pays) }, ...(offer.expiration ? [{ key: 'Expiration', value: new Date(offer.expiration * 1000).toISOString() }] : [])],
                         })),
                    });
               }

               // Account Details
               data.sections.push({
                    title: 'Account Details',
                    openByDefault: true,
                    content: [
                         { key: 'Name', value: this.currentWallet.balance },
                         { key: 'Address', value: `<code>${wallet.address}</code>` },
                         { key: 'Final XRP Balance', value: finalXrpBalance.toString() },
                    ],
               });

               // Render result
               this.renderTransactionResult(response);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               if (!this.isSimulateEnabled) {
                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              this.currentWallet.balance = await this.updateXrpBalance(client, updatedAccountInfo, wallet);
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
               console.log(`Leaving createOffer in ${this.executionTime}ms`);
          }
     }

     async cancelOffer() {
          console.log('Entering cancelOffer');
          const startTime = Date.now();
          this.setSuccessProperties();
          this.updateSpinnerMessage(``);

          const inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.balance,
               seed: this.currentWallet.seed,
               offerSequenceField: this.offerSequenceField,
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

          const offerSequenceArray = this.offerSequenceField
               .split(',')
               .map(seq => seq.trim())
               .filter(seq => seq !== '');

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }

               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();
               const [accountInfo, fee] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client)]);
               this.utilsService.logAccountInfoObjects(accountInfo, null);

               inputs.account_info = accountInfo;

               const errors = await this.validateInputs(inputs, 'cancelOffer');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               // Define interfaces for rendering
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

               const data: { sections: Section[] } = {
                    sections: [],
               };

               // Collect all transaction results
               const transactions: { type: string; result: any }[] = [];
               let hasError = false;

               for (const element of offerSequenceArray) {
                    const offerSequence = parseInt(element);

                    let signedTx: { tx_blob: string; hash: string } | null = null;
                    let lastLedgerIndex = await this.xrplService.getLastLedgerIndex(client);

                    try {
                         const offerCancelTx = await client.autofill({
                              TransactionType: 'OfferCancel',
                              Account: wallet.classicAddress,
                              OfferSequence: offerSequence,
                              LastLedgerSequence: lastLedgerIndex + AppConstants.LAST_LEDGER_ADD_TIME,
                         });

                         await this.setTxOptionalFields(client, offerCancelTx, wallet, accountInfo, 'cancelOffer');

                         if (await this.utilsService.isInsufficientXrpBalance(client, accountInfo, '0', wallet.classicAddress, offerCancelTx, fee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }

                         const preparedTx = await client.autofill(offerCancelTx);
                         console.log(`preparedTx:`, preparedTx);
                         signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                         if (!signedTx) {
                              return this.setError('ERROR: Failed to sign transaction.');
                         }
                         console.log(`signed:`, signedTx);

                         this.updateSpinnerMessage('Submitting transaction to the Ledger...');
                         const response = await client.submitAndWait(signedTx.tx_blob);
                         console.log(`Response:`, response);

                         transactions.push({
                              type: 'OfferCancel',
                              result: response,
                         });

                         if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                              hasError = true;
                         }
                    } catch (error: any) {
                         hasError = true;
                         transactions.push({
                              type: 'OfferCancel',
                              result: {
                                   error: `Error cancelling offer ${element}: ${error.message || 'Unknown error'}`,
                                   OfferSequence: element,
                              },
                         });
                    }
               }

               // Add detailed transaction data to data.sections
               const transactionDetails: SectionSubItem[] = transactions.map((tx, index) => {
                    const result = tx.result || {};
                    const isSuccess = !result.error && result.meta?.TransactionResult === AppConstants.TRANSACTION.TES_SUCCESS;
                    const content: SectionContent[] = [
                         { key: 'Transaction Type', value: 'OfferCancel' },
                         { key: 'Offer Sequence', value: `<code>${result.result.tx_json.OfferSequence || 'N/A'}</code>` },
                         { key: 'Sequence', value: `<code>${result.result.tx_json.Sequence || 'N/A'}</code>` },
                         { key: 'Hash', value: result.result.hash ? `<code>${result.result.hash}</code>` : 'N/A' },
                         { key: 'Result', value: result.error ? `<span class="error-result">${result.error}</span>` : result.meta?.TransactionResult || 'N/A' },
                         { key: 'Ledger Index', value: result.result.ledger_index || 'N/A' },
                         { key: 'Validated', value: result.result.validated !== undefined ? result.result.validated.toString() : 'N/A' },
                         { key: 'Date', value: result.result.close_time_iso ? new Date(result.result.close_time_iso).toLocaleString() : result.result.close_time_iso || 'N/A' },
                    ];

                    // Add Account if available
                    if (result.result.tx_json?.Account) {
                         content.push({ key: 'Account', value: `<code>${result.result.tx_json.Account}</code>` });
                    }

                    // Add Meta Data if available
                    if (result.result.meta) {
                         content.push({ key: 'Transaction Index', value: result.result.meta.TransactionIndex || 'N/A' }, { key: 'Delivered Amount', value: result.result.meta.delivered_amount ? this.utilsService.formatAmount(result.result.meta.delivered_amount) : 'N/A' });
                    }

                    return {
                         key: `OfferCancel ${index + 1} (Sequence: ${result.result.tx_json.OfferSequence || result.result.tx_json?.OfferSequence || 'Unknown'})`,
                         openByDefault: !isSuccess, // Open by default if failed
                         content,
                    };
               });

               data.sections.push({
                    title: `Offer Cancellation Details (${transactions.length})`,
                    openByDefault: true,
                    subItems: transactionDetails,
               });

               // Add summary section
               data.sections.push({
                    title: 'Offer Cancellation Summary',
                    openByDefault: true,
                    content: [
                         {
                              key: 'Status',
                              value: hasError ? 'Some offer cancellations failed' : 'All offers cancelled successfully',
                         },
                         {
                              key: 'Total Offers Processed',
                              value: String(transactions.length),
                         },
                         {
                              key: 'Successful Cancellations',
                              value: String(transactions.filter(tx => !tx.result.error && tx.result.result.meta?.TransactionResult === AppConstants.TRANSACTION.TES_SUCCESS).length),
                         },
                    ],
               });

               // Render detailed transaction results
               this.renderUiComponentsService.renderTransactionsResults(transactions, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add(hasError ? 'error' : 'success');

               // Render summary and details in data.sections
               this.renderUiComponentsService.renderDetails(data);

               if (hasError) {
                    this.setErrorProperties();
               } else {
                    this.setSuccess(this.result);
               }

               if (!this.isSimulateEnabled) {
                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              this.currentWallet.balance = await this.updateXrpBalance(client, updatedAccountInfo, wallet);
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
               console.log(`Leaving cancelOffer in ${this.executionTime}ms`);
          }
     }

     async getTokenBalance() {
          console.log('Entering getTokenBalance');
          const startTime = Date.now();
          this.setSuccessProperties();
          this.updateSpinnerMessage(``);

          // await this.updateTokenBalanceAndExchange();

          const inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
          };

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.utilsService.getWallet(this.currentWallet.seed);

               // PARALLELIZE — fetch account info + account objects together
               const [accountInfo, balance] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '')]);
               this.utilsService.logAccountInfoObjects(accountInfo, null);
               this.utilsService.logObjects(`balance`, balance);

               inputs.account_info = accountInfo;

               const errors = await this.validateInputs(inputs, 'getTokenBalance');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               // Prepare data for rendering
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

               const data: { sections: Section[] } = {
                    sections: [],
               };

               // Obligations section (tokens issued by the account)
               if (balance.result.obligations && Object.keys(balance.result.obligations).length > 0) {
                    data.sections.push({
                         title: `Obligations (${Object.keys(balance.result.obligations).length})`,
                         openByDefault: true,
                         subItems: Object.entries(balance.result.obligations).map(([currency, amount], index) => {
                              const displayCurrency = currency.length > 3 ? this.utilsService.decodeCurrencyCode(currency) : currency;
                              return {
                                   key: `Obligation ${index + 1} (${displayCurrency})`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Currency', value: displayCurrency },
                                        { key: 'Amount', value: amount },
                                   ],
                              };
                         }),
                    });
               }

               let currencyBalance = '0';
               // Balances section (tokens held by the account)
               if (balance.result.assets && Object.keys(balance.result.assets).length > 0) {
                    const balanceItems = [];

                    for (const [issuer, currencies] of Object.entries(balance.result.assets)) {
                         for (const { currency, value } of currencies) {
                              let displayCurrency = currency;
                              if (currency.length > 3) {
                                   const tempCurrency = currency;
                                   displayCurrency = this.utilsService.decodeCurrencyCode(currency);
                                   if (displayCurrency.length > 8) {
                                        displayCurrency = tempCurrency;
                                   }
                              }

                              // Only add to total if this issuer matches the one we want
                              const issuerField = this.weWantIssuerField == '' ? this.weSpendIssuerField : this.weWantIssuerField;
                              const currencyField = this.weWantCurrencyField == 'XRP' ? this.weSpendCurrencyField : this.weWantCurrencyField;
                              if (issuer === issuerField && displayCurrency === currencyField) {
                                   const parsed = parseFloat(value);
                                   currencyBalance += Number.isFinite(parsed) ? parsed : 0;
                              }

                              balanceItems.push({
                                   key: `${displayCurrency} from ${issuer.slice(0, 8)}...`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Currency', value: displayCurrency },
                                        { key: 'Issuer', value: `<code>${issuer}</code>` },
                                        {
                                             key: 'Amount',
                                             value: this.utilsService.formatTokenBalance(value, 18),
                                        },
                                   ],
                              });
                         }
                    }
                    data.sections.push({
                         title: `Balances (${balanceItems.length})`,
                         openByDefault: true,
                         subItems: balanceItems,
                    });
               }

               this.renderUiComponentsService.renderDetails(data);
               this.setSuccess(this.result);
               this.currentWallet.balance = await this.updateXrpBalance(client, accountInfo, wallet);

               // Format and set the UI fields (fall back to '0' if balance is 0)
               const formattedBalance = currencyBalance ? this.utilsService.formatTokenBalance(currencyBalance, 18) : '0';
               if (this.weWantCurrencyField === 'XRP') {
                    this.weSpendTokenBalanceField = formattedBalance;
               } else {
                    this.weWantTokenBalanceField = formattedBalance;
               }
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getTokenBalance in ${this.executionTime}ms`);
          }
     }

     invertOrder() {
          const weWantCurrencyElem = document.getElementById('weWantCurrencyField') as HTMLInputElement | null;
          const weWantIssuerElem = document.getElementById('weWantIssuerField') as HTMLInputElement | null;
          const weWantAmountElem = document.getElementById('weWantAmountField') as HTMLInputElement | null;
          const weWantTokenBalanceElem = document.getElementById('weWantTokenBalanceField') as HTMLInputElement | null;

          const weSpendCurrencyElem = document.getElementById('weSpendCurrencyField') as HTMLInputElement | null;
          const weSpendIssuerElem = document.getElementById('weSpendIssuerField') as HTMLInputElement | null;
          const weSpendAmountElem = document.getElementById('weSpendAmountField') as HTMLInputElement | null;
          const weSpendTokenBalanceElem = document.getElementById('weSpendTokenBalanceField') as HTMLInputElement | null;

          if (weWantCurrencyElem && weWantIssuerElem && weWantAmountElem && weWantTokenBalanceElem && weSpendCurrencyElem && weSpendIssuerElem && weSpendAmountElem && weSpendTokenBalanceElem) {
               const weWantCurrencyFieldTemp = weWantCurrencyElem.value;
               const weWantIssuerFieldTemp = weWantIssuerElem.value;
               const weWantAmountFieldTemp = weWantAmountElem.value;
               const weWantTokenBalanceTemp = weWantTokenBalanceElem.value;

               this.weWantCurrencyField = weSpendCurrencyElem.value;
               this.weWantIssuerField = weSpendIssuerElem.value;
               this.weWantAmountField = weSpendAmountElem.value;
               if (weSpendTokenBalanceElem.value.includes('.')) {
                    this.weWantTokenBalanceField = weSpendTokenBalanceElem.value;
               } else {
                    this.weWantTokenBalanceField = weSpendTokenBalanceElem.value ? this.utilsService.formatTokenBalance(weSpendTokenBalanceElem.value, 18) : '0';
               }
               this.weSpendCurrencyField = weWantCurrencyFieldTemp;
               this.weSpendIssuerField = weWantIssuerFieldTemp;
               this.weSpendAmountField = weWantAmountFieldTemp;
               this.weSpendTokenBalanceField = weWantTokenBalanceTemp;
          }
          this.getOrderBook();
          this.cdr.detectChanges();
          // this.swapBalances();
     }

     computeBidAskSpread(tokenXrpOffers: any, xrpTokenOffers: any) {
          let bestTokenXrp = 0;
          if (tokenXrpOffers.length > 0) {
               const getsValue = tokenXrpOffers[0].TakerGets.value ? parseFloat(tokenXrpOffers[0].TakerGets.value) : parseFloat(tokenXrpOffers[0].TakerGets) / 1_000_000;
               const paysValue = tokenXrpOffers[0].TakerPays.value ? parseFloat(tokenXrpOffers[0].TakerPays.value) : parseFloat(tokenXrpOffers[0].TakerPays) / 1_000_000;
               bestTokenXrp = getsValue / paysValue;
          }

          let bestXrpToken = 0;
          if (xrpTokenOffers.length > 0) {
               const getsValue = xrpTokenOffers[0].TakerGets.value ? parseFloat(xrpTokenOffers[0].TakerGets.value) : parseFloat(xrpTokenOffers[0].TakerGets) / 1_000_000;
               const paysValue = xrpTokenOffers[0].TakerPays.value ? parseFloat(xrpTokenOffers[0].TakerPays.value) : parseFloat(xrpTokenOffers[0].TakerPays) / 1_000_000;
               bestXrpToken = getsValue / paysValue;
          }

          const bestXrpTokenInverse = bestXrpToken > 0 ? 1 / bestXrpToken : 0;
          const spread = bestTokenXrp > 0 && bestXrpToken > 0 ? Math.abs(bestTokenXrp - bestXrpTokenInverse) : 0;
          const midPrice = bestTokenXrp > 0 && bestXrpToken > 0 ? (bestTokenXrp + bestXrpTokenInverse) / 2 : 0;
          const spreadPercent = midPrice > 0 ? (spread / midPrice) * 100 : 0;
          return { spread, spreadPercent, bestTokenXrp, bestXrpToken };
     }

     computeLiquidityRatio(tokenXrpOffers: any, xrpTokenOffers: any, isTokenXrp = true) {
          let tokenVolume = 0;
          if (tokenXrpOffers.length > 0) {
               tokenVolume = tokenXrpOffers.reduce((sum: number, offer: { TakerGets: { value?: string } | string }) => sum + (typeof offer.TakerGets === 'object' && 'value' in offer.TakerGets && offer.TakerGets.value ? parseFloat(offer.TakerGets.value) : parseFloat(typeof offer.TakerGets === 'string' ? offer.TakerGets : '') / 1_000_000), 0);
          }

          let xrpVolume = 0;
          if (xrpTokenOffers.length > 0) {
               xrpVolume = xrpTokenOffers.reduce((sum: number, offer: { TakerGets: { value?: string } | string }) => sum + (typeof offer.TakerGets === 'object' && 'value' in offer.TakerGets && offer.TakerGets.value ? parseFloat(offer.TakerGets.value) : parseFloat(typeof offer.TakerGets === 'string' ? offer.TakerGets : '') / 1_000_000), 0);
          }

          const ratio = isTokenXrp ? (xrpVolume > 0 ? tokenVolume / xrpVolume : 0) : tokenVolume > 0 ? xrpVolume / tokenVolume : 0;
          return { tokenVolume, xrpVolume, ratio };
     }

     computeAverageExchangeRateBothWays(offers: any, tradeSizeXRP = 15) {
          let totalPays = 0; // XRP
          let totalGets = 0; // TOKEN
          interface ExchangeRates {
               vwap: number;
               simpleAvg: number;
               bestRate: number;
               worstRate: number;
               depthDOG: number;
               depthXRP: number;
               executionPrice: number;
               executionDOG: number;
               executionXRP: number;
               insufficientLiquidity: boolean;
               volatility: number;
               volatilityPercent: number;
          }

          interface InverseRates {
               vwap: number;
               simpleAvg: number;
               bestRate: number;
               worstRate: number;
          }

          interface ExchangeRateResult {
               forward: ExchangeRates;
               inverse: InverseRates;
          }

          let forwardRates: number[] = []; // TOKEN/XRP
          let inverseRates: number[] = []; // XRP/TOKEN
          let bestQuality = Infinity;

          interface Offer {
               TakerGets: { value?: string } | string;
               TakerPays: { value?: string } | string;
          }

          const offersTyped: Offer[] = offers as Offer[];
          offersTyped.forEach((offer: Offer) => {
               let getsValue: number = typeof offer.TakerGets === 'string' ? parseFloat(offer.TakerGets) / 1_000_000 : parseFloat(offer.TakerGets.value as string); // TOKEN
               let paysValue: number = typeof offer.TakerPays === 'string' ? parseFloat(offer.TakerPays) / 1_000_000 : parseFloat(offer.TakerPays.value as string); // XRP
               if (getsValue > 0 && paysValue > 0) {
                    totalPays += paysValue;
                    totalGets += getsValue;
                    forwardRates.push(getsValue / paysValue); // TOKEN/XRP
                    inverseRates.push(paysValue / getsValue); // XRP/TOKEN
                    bestQuality = Math.min(bestQuality, paysValue / getsValue); // Quality = XRP/TOKEN
               }
          });

          // Depth at 5% slippage
          const maxQuality = bestQuality * 1.05;
          let depthGets = 0; // TOKEN
          let depthPays = 0; // XRP
          interface Offer {
               TakerGets: { value?: string } | string;
               TakerPays: { value?: string } | string;
          }

          (offers as Offer[]).forEach((offer: Offer) => {
               const getsValue: number = typeof offer.TakerGets === 'string' ? parseFloat(offer.TakerGets) / 1_000_000 : parseFloat(offer.TakerGets.value as string);
               const paysValue: number = typeof offer.TakerPays === 'string' ? parseFloat(offer.TakerPays) / 1_000_000 : parseFloat(offer.TakerPays.value as string);
               if (paysValue / getsValue <= maxQuality) {
                    depthGets += getsValue;
                    depthPays += paysValue;
               }
          });

          // Execution price for paying tradeSizeXRP XRP
          let execGets = 0; // TOKEN
          let execPays = 0; // XRP
          let remainingPays = tradeSizeXRP; // Want to pay tradeSizeXRP XRP
          let insufficientLiquidity = false;
          for (const offer of offers) {
               const getsValue = typeof offer.TakerGets === 'string' ? parseFloat(offer.TakerGets) / 1_000_000 : parseFloat(offer.TakerGets.value);
               const paysValue = typeof offer.TakerPays === 'string' ? parseFloat(offer.TakerPays) / 1_000_000 : parseFloat(offer.TakerPays.value);
               const paysToUse = Math.min(remainingPays, paysValue);
               if (paysToUse > 0) {
                    execGets += (paysToUse / paysValue) * getsValue;
                    execPays += paysToUse;
                    remainingPays -= paysToUse;
               }
               if (remainingPays <= 0) break;
          }
          if (remainingPays > 0) {
               insufficientLiquidity = true;
          }

          // Volatility
          const meanForward = forwardRates.length > 0 ? forwardRates.reduce((a, b) => a + b, 0) / forwardRates.length : 0;
          const varianceForward = forwardRates.length > 0 ? forwardRates.reduce((sum, rate) => sum + Math.pow(rate - meanForward, 2), 0) / forwardRates.length : 0;
          const stdDevForward = Math.sqrt(varianceForward);

          return {
               forward: {
                    // TOKEN/XRP
                    vwap: totalPays > 0 ? totalGets / totalPays : 0,
                    simpleAvg: meanForward,
                    bestRate: forwardRates.length > 0 ? Math.max(...forwardRates) : 0,
                    worstRate: forwardRates.length > 0 ? Math.min(...forwardRates) : 0,
                    depthDOG: depthGets,
                    depthXRP: depthPays,
                    executionPrice: execPays > 0 ? execGets / execPays : 0, // TOKEN/XRP
                    executionDOG: execGets,
                    executionXRP: execPays,
                    insufficientLiquidity,
                    volatility: stdDevForward,
                    volatilityPercent: meanForward > 0 ? (stdDevForward / meanForward) * 100 : 0,
               },
               inverse: {
                    // XRP/TOKEN
                    vwap: totalGets > 0 ? totalPays / totalGets : 0,
                    simpleAvg: inverseRates.length > 0 ? inverseRates.reduce((a, b) => a + b, 0) / inverseRates.length : 0,
                    bestRate: inverseRates.length > 0 ? Math.max(...inverseRates) : 0,
                    worstRate: inverseRates.length > 0 ? Math.min(...inverseRates) : 0,
               },
          };
     }

     calculateEffectiveRate(proposedQuality: any, reserveInfo: any, offerType: any) {
          // Convert to BigNumber for precise calculations
          const quality = new BigNumber(proposedQuality);

          // Estimate additional reserve requirements for this offer
          // Each new offer typically requires 2 XRP owner reserve
          const additionalReserveCost = new BigNumber(reserveInfo.ownerReserve);

          // For simplicity, we'll amortize the reserve cost over the offer amount
          // This is a simplified model - adjust based on your trading strategy
          const reserveCostFactor = additionalReserveCost
               .dividedBy(new BigNumber(10).pow(6)) // Convert to XRP
               .dividedBy(quality); // Spread over the offer amount

          // Adjust the quality based on reserve costs
          // For buy offers: effective rate is slightly worse (higher)
          // For sell offers: effective rate is slightly worse (lower)
          const adjustmentFactor = offerType === 'buy' ? new BigNumber(1).plus(reserveCostFactor) : new BigNumber(1).minus(reserveCostFactor);

          return quality.multipliedBy(adjustmentFactor);
     }

     populateStatsFields(stats: any, we_want: any, we_spend: any, spread: any, liquidity: any, offerType: any) {
          const orderBookDirectionField = document.getElementById('orderBookDirectionField') as HTMLInputElement | null;
          if (orderBookDirectionField) orderBookDirectionField.value = `${we_want.currency}/${we_spend.currency}`;
          const vwapField = document.getElementById('vwapField') as HTMLInputElement | null;
          if (vwapField) vwapField.value = stats.forward.vwap.toFixed(8);
          const simpleAverageField = document.getElementById('simpleAverageField') as HTMLInputElement | null;
          if (simpleAverageField) simpleAverageField.value = stats.forward.simpleAvg.toFixed(8);
          const bestRateField = document.getElementById('bestRateField') as HTMLInputElement | null;
          if (bestRateField) bestRateField.value = stats.forward.bestRate.toFixed(8);
          const worstRateField = document.getElementById('worstRateField') as HTMLInputElement | null;
          if (worstRateField) worstRateField.value = stats.forward.worstRate.toFixed(8);
          const depthField = document.getElementById('depthField') as HTMLInputElement | null;
          if (depthField) depthField.value = `${stats.forward.depthDOG.toFixed(2)} ${we_want.currency} for ${stats.forward.depthXRP.toFixed(2)} ${we_spend.currency}`;

          const liquidityField = document.getElementById('liquidityField') as HTMLInputElement | null;
          const averageRateField = document.getElementById('averageRateField') as HTMLInputElement | null;
          if (stats.forward.insufficientLiquidity) {
               if (liquidityField) liquidityField.value = `${15} ${we_spend.currency}: Insufficient liquidity (only ${stats.forward.executionDOG.toFixed(2)} ${we_want.currency} for ${stats.forward.executionXRP.toFixed(2)} ${we_spend.currency} available)`;
               if (averageRateField) averageRateField.value = `${stats.forward.executionPrice.toFixed(8)} ${we_want.currency}/${we_spend.currency}`;
          } else {
               if (liquidityField) liquidityField.value = `${15} ${we_spend.currency} for ${stats.forward.executionDOG.toFixed(2)} ${we_want.currency}`;
               if (averageRateField) averageRateField.value = `${stats.forward.executionPrice.toFixed(8)} ${we_want.currency}/${we_spend.currency}`;
          }

          const liquidityRatioField = document.getElementById('liquidityRatioField') as HTMLInputElement | null;
          if (liquidityRatioField) liquidityRatioField.value = `${liquidity.ratio.toFixed(2)} (${we_want.currency}/${we_spend.currency} vs ${we_spend.currency}/${we_want.currency})`;
          const priceVolatilityField = document.getElementById('priceVolatilityField') as HTMLInputElement | null;
          if (priceVolatilityField) priceVolatilityField.value = `${stats.forward.simpleAvg.toFixed(8)} ${we_want.currency}/${we_spend.currency}`;
          const stdDeviationField = document.getElementById('stdDeviationField') as HTMLInputElement | null;
          if (stdDeviationField) stdDeviationField.value = `${stats.forward.volatility.toFixed(8)} (${stats.forward.volatilityPercent.toFixed(2)}%)`;

          const spreadField = document.getElementById('spreadField') as HTMLInputElement | null;
          if (offerType === 'buy') {
               if (spreadField) spreadField.value = `${spread.spread.toFixed(8)} ${we_want.currency}/${we_spend.currency} (${spread.spreadPercent.toFixed(2)}%)`;
          } else {
               if (spreadField) spreadField.value = `${spread.spread.toFixed(8)} ${we_spend.currency}/${we_want.currency} (${spread.spreadPercent.toFixed(2)}%)`;
          }
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

     normalizeAmount = (val: string | IssuedCurrencyAmount | CurrencyAmount) => {
          if (typeof val === 'string') {
               // Only convert if it's an integer (drops)
               return /^\d+$/.test(val) ? xrpl.dropsToXrp(val) : val;
          }
          return val.value; // Already a decimal string
     };

     calculateRate(gets: string | IssuedCurrencyAmount | CurrencyAmount, pays: string | IssuedCurrencyAmount | CurrencyAmount): string {
          const getsValue = this.normalizeAmount(gets);
          const paysValue = this.normalizeAmount(pays);
          return new BigNumber(paysValue).dividedBy(getsValue).toFixed(15);
     }

     async onWeWantCurrencyChange() {
          console.log('Entering onWeWantCurrencyChange');
          const startTime = Date.now();
          this.setSuccessProperties();
          this.updateSpinnerMessage(``);

          const inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
          };

          const errors = await this.validateInputs(inputs, 'onWeWantCurrencyChange');
          if (errors.length > 0) {
               this.weWantTokenBalanceField = '0';
               return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
          }

          // this.weWantIssuerField = this.knownIssuers[this.weWantCurrencyField] || '';
          const known = this.knownIssuers[this.weWantCurrencyField] || [];
          this.weWantIssuerField = known.length > 0 ? known[0] : '';

          const client = await this.xrplService.getClient();
          const wallet = await this.getWallet();

          const [accountInfo, balanceResponse] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '')]);

          try {
               this.spinner = true;
               let balance: string;
               if (this.weWantCurrencyField === 'XRP') {
                    balance = await this.updateXrpBalance(client, accountInfo, wallet);
               } else {
                    const currencyCode = this.weWantCurrencyField.length > 3 ? this.utilsService.encodeCurrencyCode(this.weWantCurrencyField) : this.weWantCurrencyField;
                    balance = (await this.getCurrencyBalance(balanceResponse, wallet.classicAddress, currencyCode, this.weWantIssuerField)) ?? '0';
               }
               this.weWantTokenBalanceField = balance !== null ? balance : '0';
               this.phnixBalance = this.utilsService.formatTokenBalance(balance, 18);
               await this.updateTokenBalanceAndExchange(); // Recalculate exchange
          } catch (error: any) {
               console.error('Error fetching weWant balance:', error);
               this.setError(`ERROR: Failed to fetch balance - ${error.message || 'Unknown error'}`);
               this.weWantTokenBalanceField = '0';
          } finally {
               this.spinner = false;
               this.cdr.detectChanges();
               let executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving onWeWantCurrencyChange in ${executionTime}ms`);
          }
     }

     async onWeSpendCurrencyChange() {
          console.log('Entering onWeSpendCurrencyChange');
          const startTime = Date.now();
          this.setSuccessProperties();
          this.updateSpinnerMessage(``);

          // Set default issuer for the selected currency
          // this.weSpendIssuerField = this.knownIssuers[this.weSpendCurrencyField] || '';
          const known = this.knownIssuers[this.weSpendCurrencyField] || [];
          this.weSpendIssuerField = known.length > 0 ? known[0] : '';

          const inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
          };
          const errors = await this.validateInputs(inputs, 'onWeSpendCurrencyChange');
          if (errors.length > 0) {
               this.weSpendTokenBalanceField = '0';
               return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
          }

          const client = await this.xrplService.getClient();
          const wallet = await this.getWallet();

          // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
          const [accountInfo, balanceResponse] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '')]);

          try {
               this.spinner = true;
               let balance: string;
               if (this.weSpendCurrencyField === 'XRP') {
                    balance = await this.updateXrpBalance(client, accountInfo, wallet);
               } else {
                    const currencyCode = this.weSpendCurrencyField.length > 3 ? this.utilsService.encodeCurrencyCode(this.weSpendCurrencyField) : this.weSpendCurrencyField;
                    balance = (await this.getCurrencyBalance(balanceResponse, wallet.classicAddress, currencyCode, this.weSpendIssuerField)) ?? '0';
               }
               this.weSpendTokenBalanceField = balance !== null ? balance : '0';
               this.phnixExchangeXrp = balance;
               await this.updateTokenBalanceAndExchange(); // Recalculate exchange
          } catch (error: any) {
               console.error('Error fetching weSpend balance:', error);
               this.setError(`ERROR: Failed to fetch balance - ${error.message || 'Unknown error'}`);
               this.weSpendTokenBalanceField = '0';
          } finally {
               this.spinner = false;
               this.cdr.detectChanges();
               let executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving onWeSpendCurrencyChange in ${executionTime}ms`);
          }
     }

     async getCurrencyBalance(balanceResponse: xrpl.GatewayBalancesResponse, address: string, currency: string, issuer?: string): Promise<string | null> {
          console.log('Entering getCurrencyBalance');
          const startTime = Date.now();
          this.setSuccessProperties();
          this.updateSpinnerMessage(``);

          try {
               let tokenTotal = new BigNumber(0);
               if (balanceResponse.result.assets) {
                    Object.entries(balanceResponse.result.assets).forEach(([assetIssuer, assets]) => {
                         if (!issuer || assetIssuer === issuer) {
                              assets.forEach((asset: any) => {
                                   let assetCurrency = asset.currency.length > 3 ? this.utilsService.decodeCurrencyCode(asset.currency) : asset.currency;
                                   let assetCur = currency.length > 3 ? this.utilsService.decodeCurrencyCode(currency) : currency;
                                   if (assetCur === assetCurrency) {
                                        const value = parseFloat(asset.value);
                                        if (!isNaN(Number(asset.value))) {
                                             tokenTotal = tokenTotal.plus(asset.value);
                                        }
                                   }
                              });
                         }
                    });
               }
               // return tokenTotal > 0 ? (Math.round(tokenTotal * 100) / 100).toString() : '0';
               // return tokenTotal > 0 ? tokenTotal.toString() : '0';
               return tokenTotal.isGreaterThan(0) ? tokenTotal.toFixed() : '0';
          } catch (error: any) {
               console.error('Error fetching token balance:', error);
               throw error;
          } finally {
               this.spinner = false;
               this.cdr.detectChanges();
               let executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getCurrencyBalance in ${executionTime}ms`);
          }
     }

     async updateTokenBalanceAndExchange() {
          console.log('Entering updateTokenBalanceAndExchange');
          const startTime = Date.now();
          this.setSuccessProperties();
          this.updateSpinnerMessage(``);

          const inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               weWantCurrencyField: this.weWantCurrencyField,
               weSpendCurrencyField: this.weSpendCurrencyField,
               weWantIssuerField: this.weWantCurrencyField !== 'XRP' ? this.weWantIssuerField : undefined,
               weSpendIssuerField: this.weSpendCurrencyField !== 'XRP' ? this.weSpendIssuerField : undefined,
               weSpendAmountField: this.weSpendAmountField,
          };

          const errors = await this.validateInputs(inputs, 'updateTokenBalanceAndExchange');
          if (errors.length > 0) {
               this.phnixBalance = '0';
               this.phnixExchangeXrp = '0';
               this.weWantAmountField = '0';
               return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
          }

          try {
               this.spinner = true;

               const client = await this.xrplService.getClient();
               const environment = this.xrplService.getNet().environment;
               const wallet = await this.getWallet();

               const [accountInfo, balanceResponse, fee] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client)]);

               if (environment !== AppConstants.NETWORKS.MAINNET.NAME) {
                    console.warn('Not connected to Mainnet. Results may differ from XPMarket.');
               }

               // Fetch transaction fee
               const feeInXrp = Number(xrpl.dropsToXrp(String(fee)));

               // Define currency objects
               const weWant: CurrencyAmount =
                    this.weWantCurrencyField === 'XRP'
                         ? { currency: 'XRP', value: this.weWantAmountField }
                         : {
                                currency: this.weWantCurrencyField.length > 3 ? this.utilsService.encodeCurrencyCode(this.weWantCurrencyField) : this.weWantCurrencyField,
                                issuer: this.weWantIssuerField,
                                value: this.weWantAmountField,
                           };

               const weSpend: CurrencyAmount =
                    this.weSpendCurrencyField === 'XRP'
                         ? { currency: 'XRP', value: this.weSpendAmountField }
                         : {
                                currency: this.weSpendCurrencyField.length > 3 ? this.utilsService.encodeCurrencyCode(this.weSpendCurrencyField) : this.weSpendCurrencyField,
                                issuer: this.weSpendIssuerField,
                                value: this.weSpendAmountField,
                           };

               // Fetch balance for weWant currency
               let balance: string;
               if (this.weWantCurrencyField === 'XRP') {
                    balance = await this.updateXrpBalance(client, accountInfo, wallet);
               } else {
                    const currencyCode = this.weWantCurrencyField.length > 3 ? this.utilsService.encodeCurrencyCode(this.weWantCurrencyField) : this.weWantCurrencyField;
                    balance = (await this.getCurrencyBalance(balanceResponse, wallet.classicAddress, currencyCode, this.weWantIssuerField)) ?? '0';
               }
               this.weWantTokenBalanceField = balance !== null ? balance : '0';
               this.phnixBalance = this.utilsService.formatTokenBalance(balance, 18);

               // If weSpend is XRP, calculate token amount (e.g., RLUSD) to receive
               if (this.weSpendAmountField && parseFloat(this.weSpendAmountField) > 0) {
                    const xrpAmount = new BigNumber(this.weSpendAmountField);

                    // Check if balance is sufficient (amount + fee)
                    const spendableXrp = new BigNumber(await this.updateXrpBalance(client, accountInfo, wallet));
                    if (xrpAmount.plus(feeInXrp).gt(spendableXrp)) {
                         this.setError('Insufficient XRP balance (including fee)');
                         this.weWantAmountField = '0';
                         return;
                    }

                    // PARALLELIZE — fetch order book, counter order book, and AMM data
                    const [orderBook, ammPoolData] = await Promise.all([
                         client.request({
                              command: 'book_offers',
                              taker: wallet.address,
                              ledger_index: 'current',
                              taker_gets: weWant,
                              taker_pays: weSpend,
                              limit: 400,
                         }),
                         client.request(this.createAmmRequest(weSpend, weWant)).catch(err => {
                              console.warn('No AMM pool found for this pair:', err);
                              return null; // prevent rejection
                         }) as Promise<AMMInfoResponse | null>,
                    ]);

                    console.log('Order Book:', orderBook);
                    console.log('AMM Pool Data:', ammPoolData); // will be null if not found

                    // Combine Order Book and AMM Liquidity
                    let allOffers: CustomBookOffer[] = [...orderBook.result.offers];

                    if (ammPoolData?.result?.amm) {
                         const amm = ammPoolData.result.amm;
                         const tradingFeeBps = amm.trading_fee; // e.g., 1000 = 0.1%
                         const tradingFee = tradingFeeBps / 1000000; // Convert to decimal (0.001 = 0.1%)

                         const getAmountValue = (amount: any): string => {
                              if (typeof amount === 'object' && amount !== null && 'value' in amount) {
                                   return String(amount.value);
                              }
                              return String(amount);
                         };

                         const asset1Amount = getAmountValue(amm.amount); // First asset
                         let asset2Amount = getAmountValue(amm.amount2); // Second asset

                         // Determine which asset is XRP and which is token
                         let xrpAmount: string, tokenAmount: string;

                         if (typeof amm.amount === 'string' || (typeof amm.amount === 'object' && amm.amount.currency === 'XRP')) {
                              xrpAmount = typeof amm.amount === 'string' ? xrpl.dropsToXrp(asset1Amount).toString() : String(amm.amount.value);
                              tokenAmount = String(asset2Amount);
                         } else {
                              xrpAmount = typeof amm.amount2 === 'string' ? xrpl.dropsToXrp(asset2Amount).toString() : String(amm.amount2.value);
                              tokenAmount = String(asset1Amount);
                         }

                         // Calculate AMM rate (token per XRP)
                         const ammRate = new BigNumber(tokenAmount).dividedBy(xrpAmount);

                         const ammOffer: CustomBookOffer = {
                              Account: amm.account || 'AMM_POOL',
                              Flags: 0,
                              LedgerEntryType: 'Offer',
                              Sequence: 0,
                              TakerGets: this.isTokenAmount(weWant) ? { currency: weWant.currency, issuer: weWant.issuer!, value: String(tokenAmount) } : String(tokenAmount),
                              TakerPays: this.isTokenAmount(weSpend) ? { currency: weSpend.currency, issuer: weSpend.issuer!, value: String(xrpAmount) } : String(xrpAmount),
                              isAMM: true,
                              rate: ammRate,
                              BookDirectory: '0',
                              BookNode: '0',
                              OwnerNode: '0',
                              PreviousTxnID: '0',
                              PreviousTxnLgrSeq: 0,
                         };
                         allOffers.push(ammOffer);
                    }

                    // Sort offers by best rate (ascending, since we want token per XRP)
                    const sortedOffers = allOffers.sort((a, b) => {
                         const rateA = this.calculateRate(a.TakerGets, a.TakerPays);
                         const rateB = this.calculateRate(b.TakerGets, b.TakerPays);
                         return new BigNumber(rateA).minus(rateB).toNumber();
                    });

                    let remainingXrp = xrpAmount;
                    let totalToken = new BigNumber(0);
                    let totalFee = new BigNumber(0); // AMM fees only; tx fee separate

                    // let remainingXrp = xrpAmount.minus(feeInXrp); // Deduct transaction fee
                    // let totalToken = new BigNumber(0);
                    // let totalFee = new BigNumber(feeInXrp); // Start with transaction fee

                    for (const offer of sortedOffers) {
                         const takerGets = new BigNumber(this.normalizeAmount(offer.TakerGets)); // Token
                         const takerPays = new BigNumber(this.normalizeAmount(offer.TakerPays)); // XRP

                         if (takerPays.isZero()) continue;

                         const rate = takerGets.dividedBy(takerPays); // Token per XRP
                         const xrpToUse = BigNumber.minimum(remainingXrp, takerPays);
                         let tokenReceived = xrpToUse.multipliedBy(rate);

                         // Apply AMM trading fee if applicable
                         if (offer.isAMM && ammPoolData?.result?.amm) {
                              const tradingFeeBps = ammPoolData.result.amm.trading_fee;
                              const tradingFee = tradingFeeBps / 1000000;
                              tokenReceived = tokenReceived.multipliedBy(1 - tradingFee);
                              totalFee = totalFee.plus(xrpToUse.multipliedBy(tradingFee));
                         }

                         totalToken = totalToken.plus(tokenReceived);
                         remainingXrp = remainingXrp.minus(xrpToUse);

                         console.log(`Used ${xrpToUse.toFixed(6)} XRP to get ${tokenReceived.toFixed(8)} ${this.weWantCurrencyField} at rate ${rate.toFixed(8)}`);

                         if (remainingXrp.isLessThanOrEqualTo(0)) break;
                    }

                    if (totalToken.isZero()) {
                         this.phnixExchangeXrp = `No liquidity available`;
                         this.weWantAmountField = '0';
                         this.insufficientLiquidityWarning = true;
                    } else if (remainingXrp.isGreaterThan(0)) {
                         this.phnixExchangeXrp = `Insufficient liquidity: Only ${xrpAmount.minus(remainingXrp).toFixed(6)} XRP can be exchanged for ${totalToken.toFixed(8)} ${this.weWantCurrencyField}`;
                         this.weWantAmountField = totalToken.toFixed(8);
                         this.insufficientLiquidityWarning = true;
                    } else {
                         this.phnixExchangeXrp = totalToken.toFixed(8);
                         this.weWantAmountField = totalToken.toFixed(8);
                         this.insufficientLiquidityWarning = false;
                    }

                    // Log total fees
                    console.log(`Total fees: ${totalFee.toFixed(6)} XRP (AMM fees) + ${feeInXrp} XRP (tx fee)`);
                    console.log(`Total fees: ${totalFee.toFixed(6)} XRP (Transaction: ${feeInXrp}, AMM: ${totalFee.minus(feeInXrp).toFixed(6)})`);

                    this.cdr.detectChanges();
               } else {
                    // Handle token to XRP case (if needed)
                    this.weWantAmountField = '0';
                    this.phnixExchangeXrp = '0';
               }
          } catch (error: any) {
               console.error('Error in updateTokenBalanceAndExchange:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
               this.phnixBalance = '0';
               this.phnixExchangeXrp = 'Error';
               this.weWantAmountField = '0';
          } finally {
               this.spinner = false;
               let executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving updateTokenBalanceAndExchange in ${executionTime}ms`);
          }
     }

     async updateTokenBalanceAndExchange1() {
          console.log('Entering updateTokenBalanceAndExchange1');
          const startTime = Date.now();
          this.setSuccessProperties();
          this.updateSpinnerMessage(``);

          const inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               weSpendCurrencyField: this.weSpendCurrencyField,
               weSpendIssuerField: this.weSpendCurrencyField !== 'XRP' ? this.weSpendIssuerField : undefined,
          };

          const errors = await this.validateInputs(inputs, 'updateTokenBalanceAndExchange1');
          if (errors.length > 0) {
               this.phnixBalance = '0';
               this.phnixExchangeXrp = '0';
               return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
          }

          const client = await this.xrplService.getClient();
          const wallet = await this.getWallet();

          const [accountInfo] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '')]);

          try {
               this.spinner = true;
               this.showSpinnerWithDelay('Fetching Token balance and market data...', 2000);

               const client = await this.xrplService.getClient();
               const environment = this.xrplService.getNet().environment;

               if (environment !== AppConstants.NETWORKS.MAINNET.NAME) {
                    console.warn('Not connected to Mainnet. Results may differ from XPMarket.');
               }

               let xrpBalance = xrpl.dropsToXrp(accountInfo.result.account_data.Balance).toString();

               if (parseFloat(xrpBalance) === 0) {
                    this.setError('No XRP balance found');
                    this.phnixExchangeXrp = '0';
                    return;
               }

               const encodedCurrency = this.weSpendCurrencyField.length < 3 ? this.weSpendCurrencyField : this.utilsService.encodeCurrencyCode(this.weSpendCurrencyField);
               const weWant = {
                    currency: encodedCurrency,
                    issuer: this.weSpendIssuerField,
               };
               const weSpend = { currency: 'XRP' };

               // PHASE 3: PARALLELIZE — fetch order book, counter order book, and AMM data
               const [orderBook, ammPoolData] = await Promise.all([
                    client.request({
                         command: 'book_offers',
                         taker: wallet.address,
                         ledger_index: 'current',
                         taker_gets: weWant,
                         taker_pays: weSpend,
                         limit: 400,
                    }),
                    client
                         .request({
                              command: 'amm_info',
                              asset: { currency: 'XRP' }, // XRP (no issuer)
                              asset2: weWant,
                         })
                         .catch(err => {
                              console.warn('No AMM pool found for this pair:', err);
                              return null; // prevent rejection
                         }),
               ]);

               // Combine Order Book and AMM Liquidity
               let allOffers = [...orderBook.result.offers];

               if (ammPoolData?.result?.amm) {
                    const amm = ammPoolData.result.amm;

                    const getAmountValue = (amount: any): string => {
                         if (typeof amount === 'object' && amount !== null && 'value' in amount) {
                              return amount.value;
                         }
                         return String(amount);
                    };

                    const asset1Amount = getAmountValue(amm.amount); // XRP or PHNIX
                    let asset2Amount = getAmountValue(amm.amount2); // PHNIX or XRP

                    // Determine which asset is XRP and which is PHNIX
                    let xrpAmount, phnixAmount;
                    if (typeof amm.amount2 === 'string') {
                         // amount2 is XRP (in drops)
                         xrpAmount = xrpl.dropsToXrp(asset2Amount).toString();
                         phnixAmount = asset1Amount;
                    } else {
                         // amount2 is PHNIX, amount is XRP (in drops)
                         xrpAmount = xrpl.dropsToXrp(asset1Amount).toString();
                         phnixAmount = asset2Amount;
                    }

                    // Calculate the AMM rate (PHNIX per XRP)
                    const ammRate = new BigNumber(phnixAmount).dividedBy(xrpAmount);

                    const ammOffer = {
                         TakerGets: {
                              currency: encodedCurrency,
                              issuer: this.weWantIssuerField,
                              value: phnixAmount,
                         },
                         TakerPays: { currency: 'XRP', value: xrpAmount },
                         rate: ammRate,
                         isAMM: true,
                         LedgerEntryType: 'Offer',
                         Flags: 0,
                         Account: 'AMM_POOL',
                         Sequence: 0,
                         Expiration: null,
                         BookDirectory: '',
                         BookNode: '',
                         OwnerNode: '',
                         PreviousTxnID: '',
                         PreviousTxnLgrSeq: 0,
                    };
                    allOffers.push(ammOffer as any);
               }

               // Sort all offers by best rate (ascending, since we want PHNIX per XRP)
               const sortedOffers = allOffers.sort((a, b) => {
                    const rateA = getOfferRate(a); // PHNIX per XRP
                    const rateB = getOfferRate(b);
                    return rateA.minus(rateB).toNumber(); // Ascending for best PHNIX/XRP rate
               });

               const xrpAmount = new BigNumber(parseFloat(xrpBalance).toFixed(6));
               let remainingXrp = xrpAmount;
               let totalPhnix = new BigNumber(0);

               for (const offer of sortedOffers) {
                    const takerGets = getOfferPhnixAmount(offer); // PHNIX
                    const takerPays = getOfferXrpAmount(offer); // XRP

                    if (takerGets.isZero()) continue;

                    const rate = takerGets.dividedBy(takerPays); // PHNIX per XRP
                    const xrpToUse = BigNumber.minimum(remainingXrp, takerPays);
                    const phnixReceived = xrpToUse.multipliedBy(rate);

                    totalPhnix = totalPhnix.plus(phnixReceived.toFixed(8));
                    remainingXrp = remainingXrp.minus(xrpToUse);

                    console.log(`Used ${xrpToUse.toFixed(6)} XRP to get ${phnixReceived.toFixed(8)} PHNIX at rate ${rate.toFixed(8)}`);

                    if (remainingXrp.isLessThanOrEqualTo(0)) break;
               }

               const usedAmount = xrpAmount.minus(remainingXrp);
               if (usedAmount.isZero()) {
                    this.phnixExchangeXrp = `No liquidity available`;
                    this.insufficientLiquidityWarning = true;
               } else if (remainingXrp.isGreaterThan(0)) {
                    this.phnixExchangeXrp = `Insufficient liquidity: Only ${usedAmount.toFixed(6)} XRP can be exchanged for ${totalPhnix.toFixed(8)} PHNIX`;
                    this.insufficientLiquidityWarning = true;
               } else {
                    this.phnixExchangeXrp = totalPhnix.toFixed(8);
                    this.insufficientLiquidityWarning = false;
               }

               // Optional: Show average rate
               if (usedAmount.isGreaterThan(0)) {
                    const avgRate = totalPhnix.dividedBy(usedAmount);
                    console.log(`Average exchange rate: ${avgRate.toFixed(8)} PHNIX/XRP`);
               }

               this.cdr.detectChanges();
          } catch (error: any) {
               console.error('Error in updateTokenBalanceAndExchange1:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
               // this.xrpBalance = '0';
               this.phnixExchangeXrp = 'Error';
          } finally {
               this.spinner = false;
               let executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving updateTokenBalanceAndExchange1 in ${executionTime}ms`);
          }

          function getOfferXrpAmount(offer: any): BigNumber {
               if (offer.taker_gets_funded) {
                    const amount = typeof offer.taker_gets_funded === 'string' ? offer.taker_gets_funded : offer.taker_gets_funded.value;
                    if (amount.includes('.')) {
                         return new BigNumber(amount);
                    } else {
                         return new BigNumber(xrpl.dropsToXrp(amount));
                    }
               }
               if (typeof offer.TakerGets === 'string') {
                    return new BigNumber(xrpl.dropsToXrp(offer.TakerGets));
               }
               return new BigNumber(offer.TakerGets.value);
          }

          function getOfferPhnixAmount(offer: any): BigNumber {
               if (offer.taker_pays_funded) {
                    return new BigNumber(offer.taker_pays_funded.value);
               }
               if (typeof offer.TakerPays === 'string') {
                    // This should never happen for tokens, but just in case
                    return new BigNumber(offer.TakerPays);
               }
               return new BigNumber(offer.TakerPays.value);
          }

          function getOfferRate(offer: any): BigNumber {
               const takerGets = getOfferXrpAmount(offer);
               const takerPays = getOfferPhnixAmount(offer);
               return takerPays.isZero() ? new BigNumber(0) : takerGets.dividedBy(takerPays);
          }
     }

     async onWeSpendAmountChange() {
          if (!this.weSpendAmountField || isNaN(parseFloat(this.weSpendAmountField))) {
               this.weWantAmountField = '0';
               this.cdr.detectChanges();
               return;
          }
          await this.updateTokenBalanceAndExchange();
     }

     private async startTokenMonitoring() {
          try {
               // await this.xrplService.monitorNewTokens();
               // this.tokens$.subscribe(tokens => {
               //      const currentMemeTokens = this.memeTokensSubject.getValue();
               //      // console.log('Current Meme Tokens:', currentMemeTokens);
               //      const newMemeTokens = tokens
               //           .filter(token => this.isMemeCoin(token) && !currentMemeTokens.some(t => t.currency === token.currency && t.issuer === token.issuer))
               //           .map(token => {
               //                if (token.currency.length > 10) {
               //                     const curr = this.utilsService.decodeCurrencyCode(token.currency.toUpperCase());
               //                     // console.log(`Meme coin detected: ${curr} - Transaction Hash: ${token.transactionHash}`);
               //                     return { ...token, currency: curr }; // Decode currency code
               //                } else {
               //                     // console.log(`Meme coin detected: ${token.currency} - Transaction Hash: ${token.transactionHash}`);
               //                     return token;
               //                }
               //           });
               //      if (newMemeTokens.length > 0) {
               //           // Keep only the most recent maxTokens (sorted by timestamp, newest first)
               //           const updatedTokens = [...currentMemeTokens, ...newMemeTokens].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, this.maxTokens);
               //           this.memeTokensSubject.next(updatedTokens);
               //      }
               // });
          } catch (error) {
               console.error('Error starting token monitoring:', error);
               this.setError('Failed to start token monitoring');
          }
     }

     async fetchXrpPrice() {
          // Method to fetch XRP price in RLUSD
          console.log('Entering fetchXrpPrice');
          const startTime = Date.now();
          this.setSuccessProperties();
          this.updateSpinnerMessage(``);

          const inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.balance,
               weWantCurrencyField: this.weWantCurrencyField,
               weSpendCurrencyField: this.weSpendCurrencyField,
               weWantIssuerField: this.weWantCurrencyField !== 'XRP' ? this.weWantIssuerField : undefined,
               weSpendIssuerField: this.weSpendCurrencyField !== 'XRP' ? this.weSpendIssuerField : undefined,
          };

          const errors = await this.validateInputs(inputs, 'fetchXrpPrice');
          if (errors.length > 0) {
               this.xrpPrice = 'Error';
               return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
          }

          try {
               const client = await this.xrplService.getClient();

               interface CurrencyObjectXRP {
                    currency: string;
                    value: string;
               }

               interface CurrencyObjectToken {
                    currency: string;
                    issuer: string;
                    value: string;
               }

               type CurrencyObject = CurrencyObjectXRP | CurrencyObjectToken;
               const buildCurrencyObject = (currency: string, issuer: string, value: string): CurrencyObject => (currency === AppConstants.XRP_CURRENCY ? { currency, value } : { currency, issuer, value });

               let we_want: CurrencyObjectXRP | undefined = undefined;
               let we_spend: CurrencyObjectXRP | undefined = undefined;
               if (this.weWantCurrencyField.length <= 3 && this.weSpendCurrencyField.length <= 3) {
                    we_want = buildCurrencyObject(this.weWantCurrencyField, this.weWantIssuerField, this.weWantAmountField) as CurrencyObjectXRP;
                    we_spend = buildCurrencyObject(this.weSpendCurrencyField, this.weSpendIssuerField, this.weSpendAmountField) as CurrencyObjectXRP;
               } else if (this.weWantCurrencyField.length > 3) {
                    console.warn('New stuff: ', this.utilsService.normalizeCurrencyCode(this.weWantCurrencyField, 20));
                    const encodedCurrencyCode = this.utilsService.encodeCurrencyCode(this.weWantCurrencyField);
                    we_want = buildCurrencyObject(encodedCurrencyCode, this.weWantIssuerField, this.weWantAmountField) as CurrencyObjectXRP;
                    we_spend = buildCurrencyObject(this.weSpendCurrencyField, this.weSpendIssuerField, this.weSpendAmountField) as CurrencyObjectXRP;
               } else if (this.weSpendCurrencyField.length > 3) {
                    const encodedCurrencyCode = this.utilsService.encodeCurrencyCode(this.weSpendCurrencyField);
                    we_spend = buildCurrencyObject(encodedCurrencyCode, this.weSpendIssuerField, this.weSpendAmountField) as CurrencyObjectXRP;
                    we_want = buildCurrencyObject(this.weWantCurrencyField, this.weWantIssuerField, this.weWantAmountField) as CurrencyObjectXRP;
               }

               // Ensure both are defined before request
               if (!we_want || !we_spend) {
                    throw new Error('Both taker_gets and taker_pays must be defined');
               }

               // Decode currencies for display
               const displayWeWantCurrency = we_want && we_want.currency && we_want.currency.length > 3 ? this.utilsService.decodeCurrencyCode(we_want.currency) : we_want?.currency ?? '';
               const displayWeSpendCurrency = we_spend && we_spend.currency && we_spend.currency.length > 3 ? this.utilsService.decodeCurrencyCode(we_spend.currency) : we_spend?.currency ?? '';
               console.log(`displayWeWantCurrency: ${displayWeWantCurrency} and displayWeSpendCurrency: ${displayWeSpendCurrency}`);

               console.log('we_want:', we_want);
               console.log('we_spend:', we_spend);

               // Build destination_amount for path_find (must include value for tokens)
               let destination_amount: string | { currency: string; issuer: string; value: string };
               if (we_want.currency === 'XRP') {
                    destination_amount = we_want.value;
               } else {
                    destination_amount = {
                         currency: we_want.currency,
                         issuer: (we_want as CurrencyObjectToken).issuer,
                         value: we_want.value,
                    };
               }

               const pathFind = await client.request({
                    command: 'ripple_path_find',
                    source_account: this.currentWallet.balance ? this.currentWallet.balance : 'rDefaultTaker',
                    destination_account: this.currentWallet.balance ? this.currentWallet.balance : 'rDefaultTaker',
                    source_amount: we_spend,
                    destination_amount,
               });

               // Extract the best delivered amount (CTZ per 1 XRP)
               // if (pathFind.result && 'alternatives' in pathFind.result && Array.isArray((pathFind.result as any).alternatives) && (pathFind.result as any).alternatives.length > 0) {
               //      const bestPath = (pathFind.result as any).alternatives[0];
               //      const deliveredAmount = typeof bestPath.destination_amount === 'string' ? parseFloat(bestPath.destination_amount) : parseFloat(bestPath.destination_amount.value);
               //      this.xrpPrice = deliveredAmount.toFixed(8); // CTZ per 1 XRP
               //      console.log(`1 XRP will buy: ${this.xrpPrice} CTZ`);
               // } else {
               //      this.xrpPrice = 'N/A';
               //      console.log('No paths found for XRP/CTZ');
               // }

               if (pathFind.result && 'alternatives' in pathFind.result && Array.isArray((pathFind.result as any).alternatives) && (pathFind.result as any).alternatives.length > 0) {
                    const bestPath = (pathFind.result as any).alternatives[0];

                    const amountObj = bestPath.source_amount;
                    const deliveredAmount = typeof amountObj === 'string' ? parseFloat(amountObj) : parseFloat(amountObj.value);

                    this.xrpPrice = deliveredAmount.toFixed(8);
                    console.log(`1 XRP will buy: ${this.xrpPrice} ${displayWeWantCurrency}`);
               } else {
                    this.xrpPrice = 'N/A';
                    console.log(`No paths found for ${displayWeSpendCurrency}/${displayWeWantCurrency}`);
               }

               // // Fetch order book for XRP/RLUSD (buy RLUSD with XRP)
               // const orderBook = await client.request({
               //      command: 'book_offers',
               //      taker: this.selectedAccount === 'account1' ? this.account1.address : 'rDefaultTaker',
               //      ledger_index: 'current',
               //      taker_gets: we_want,
               //      taker_pays: we_spend,
               // });

               // // Calculate price from order book
               // if (orderBook.result.offers.length > 0) {
               //      const stats = this.computeAverageExchangeRateBothWays(orderBook.result.offers, 1);
               //      this.xrpPrice = stats.forward.vwap.toFixed(8); // RLUSD per 1 XRP (XRP/RLUSD)
               //      console.log(`1 RLUSD will buy: ${this.xrpPrice} XRP`);
               // } else {
               //      this.xrpPrice = 'N/A';
               //      console.log('No offers found for XRP/RLUSD');
               // }

               this.cdr.detectChanges(); // Trigger UI update
          } catch (error: any) {
               console.error('Error fetching XRP price:', error);
               this.xrpPrice = 'Error';
               this.setError(`ERROR: Failed to fetch XRP price - ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               let executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving fetchXrpPrice in ${executionTime}ms`);
          }
     }

     // Start polling for price updates
     startPriceRefresh() {
          // Fetch price immediately
          // this.fetchXrpPrice();
          // // Set interval to refresh every 10 seconds
          // this.priceRefreshInterval = setInterval(() => {
          //      this.fetchXrpPrice();
          // }, 10000);
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

     private async setTxOptionalFields(client: xrpl.Client, offerTx: any, wallet: xrpl.Wallet, accountInfo: any, txType: string) {
          if (txType === 'createOffer' || txType === 'cancelOffer') {
               if (this.selectedSingleTicket) {
                    const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.selectedSingleTicket));
                    if (!ticketExists) {
                         return this.setError(`ERROR: Ticket Sequence ${this.selectedSingleTicket} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(offerTx, this.selectedSingleTicket, true);
               } else {
                    if (this.multiSelectMode && this.selectedTickets.length > 0) {
                         console.log('Setting multiple tickets:', this.selectedTickets);
                         this.utilsService.setTicketSequence(offerTx, accountInfo.result.account_data.Sequence, false);
                    }
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(offerTx, this.memoField);
               }
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
          if (this.selectedSingleTicket && !this.ticketArray.includes(this.selectedSingleTicket)) {
               this.selectedSingleTicket = ''; // Reset to "Select a ticket"
          }
     }

     private cleanUpMultiSelection() {
          this.selectedTickets = this.selectedTickets.filter(ticket => this.ticketArray.includes(ticket));
     }

     updateTickets(accountObjects: xrpl.AccountObjectsResponse) {
          this.ticketArray = this.getAccountTickets(accountObjects);

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
          return this.utilsService.formatTokenBalance(balance.toString(), 18);
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

     swapBalances() {
          // Store the current values
          const tempToken = this.phnixBalance;
          const tempXrp = this.phnixExchangeXrp;

          // Swap the values
          this.phnixBalance = tempXrp;
          this.phnixExchangeXrp = tempToken;

          // Trigger any necessary updates
          if (this.weWantCurrencyField === 'XRP') {
               this.updateTokenBalanceAndExchange1();
          } else {
               this.updateTokenBalanceAndExchange();
          }
     }
     private async validateInputs(inputs: ValidationInputs, action: string): Promise<string[]> {
          const errors: string[] = [];

          // Common validators as functions
          const isRequired = (value: string | null | undefined, fieldName: string): string | null => {
               if (value == null) {
                    return `${fieldName} cannot be empty`;
               }
               if (!this.utilsService.validateInput(value)) {
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

          const isValidNumber = (value: string | undefined, fieldName: string, minValue?: number): string | null => {
               if (value === undefined) return null; // Not required, so skip
               const num = parseFloat(value);
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

          const validateOfferSequences = (sequencesStr: string | undefined): string | null => {
               if (!sequencesStr) return null; // Not required
               const sequences = sequencesStr.split(',').map(seq => seq.trim());
               if (sequences.length === 0 || sequences.every(seq => !seq)) {
                    return 'Offer Sequence field cannot be empty';
               }
               const invalidSequence = sequences.find(seq => isNaN(parseFloat(seq)) || parseInt(seq) <= 0);
               if (invalidSequence) {
                    return `Invalid Offer Sequence: ${invalidSequence} must be a valid positive number`;
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
               fetchXrpPrice: {
                    required: ['selectedAccount', 'weWantCurrencyField', 'weSpendCurrencyField'],
                    customValidators: [
                         () => isValidCurrency(inputs.weWantCurrencyField, 'We want currency'),
                         () => isValidCurrency(inputs.weSpendCurrencyField, 'We spend currency'),
                         () => (inputs.weWantCurrencyField !== 'XRP' ? isRequired(inputs.weWantIssuerField, 'We want issuer') : null),
                         () => (inputs.weSpendCurrencyField !== 'XRP' ? isRequired(inputs.weSpendIssuerField, 'We spend issuer') : null),
                         () => (inputs.weWantCurrencyField !== 'XRP' ? isValidXrpAddress(inputs.weWantIssuerField, 'We want issuer address') : null),
                         () => (inputs.weSpendCurrencyField !== 'XRP' ? isValidXrpAddress(inputs.weSpendIssuerField, 'We spend issuer address') : null),
                    ],
                    asyncValidators: [],
               },
               getOffers: {
                    required: ['selectedAccount', 'seed'],
                    customValidators: [() => isValidSeed(inputs.seed)],
                    asyncValidators: [],
               },
               getOrderBook: {
                    required: ['selectedAccount', 'seed', 'weWantCurrencyField', 'weSpendCurrencyField'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidCurrency(inputs.weWantCurrencyField, 'We want currency'),
                         () => isValidCurrency(inputs.weSpendCurrencyField, 'We spend currency'),
                         () => (inputs.weWantCurrencyField !== 'XRP' ? isRequired(inputs.weWantIssuerField, 'We want issuer') : null),
                         () => (inputs.weSpendCurrencyField !== 'XRP' ? isRequired(inputs.weSpendIssuerField, 'We spend issuer') : null),
                         () => (inputs.weWantCurrencyField !== 'XRP' ? isValidXrpAddress(inputs.weWantIssuerField, 'We want issuer address') : null),
                         () => (inputs.weSpendCurrencyField !== 'XRP' ? isValidXrpAddress(inputs.weSpendIssuerField, 'We spend issuer address') : null),
                         // Ticket flow
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
               createOffer: {
                    required: ['selectedAccount', 'seed', 'weWantAmountField', 'weSpendAmountField', 'weWantCurrencyField', 'weSpendCurrencyField'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.weWantAmountField, 'We want amount', 0),
                         () => isValidNumber(inputs.weSpendAmountField, 'We spend amount', 0),
                         () => isValidCurrency(inputs.weWantCurrencyField, 'We want currency'),
                         () => isValidCurrency(inputs.weSpendCurrencyField, 'We spend currency'),
                         () => (inputs.weWantCurrencyField !== 'XRP' ? isRequired(inputs.weWantIssuerField, 'We want issuer') : null),
                         () => (inputs.weSpendCurrencyField !== 'XRP' ? isRequired(inputs.weSpendIssuerField, 'We spend issuer') : null),
                         () => (inputs.weWantCurrencyField !== 'XRP' ? isValidXrpAddress(inputs.weWantIssuerField, 'We want issuer address') : null),
                         () => (inputs.weSpendCurrencyField !== 'XRP' ? isValidXrpAddress(inputs.weSpendIssuerField, 'We spend issuer address') : null),
                         () => isNotSelfPayment(inputs.senderAddress, inputs.weSpendIssuerField),
                         () => isNotSelfPayment(inputs.senderAddress, inputs.weWantCurrencyField),
                         // Ticket flow
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
               cancelOffer: {
                    required: ['selectedAccount', 'seed', 'offerSequenceField'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => validateOfferSequences(inputs.offerSequenceField),
                         // Ticket flow
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
               getTokenBalance: {
                    required: ['selectedAccount', 'seed'],
                    customValidators: [() => isValidSeed(inputs.seed)],
                    asyncValidators: [],
               },
               onWeWantCurrencyChange: {
                    required: ['selectedAccount'],
                    customValidators: [() => isValidXrpAddress('r9DZiCr2eejjRUqqTnTahL5UpLfku9Fe9D', 'Account address')],
                    asyncValidators: [],
               },
               onWeSpendCurrencyChange: {
                    required: ['selectedAccount'],
                    customValidators: [() => isValidXrpAddress('r9DZiCr2eejjRUqqTnTahL5UpLfku9Fe9D', 'Account address')],
                    asyncValidators: [],
               },
               updateTokenBalanceAndExchange: {
                    required: ['selectedAccount', 'weWantCurrencyField', 'weSpendCurrencyField'],
                    customValidators: [
                         () => isValidXrpAddress('r9DZiCr2eejjRUqqTnTahL5UpLfku9Fe9D', 'Account address'),
                         () => isValidCurrency(inputs.weWantCurrencyField, 'We want currency'),
                         () => isValidCurrency(inputs.weSpendCurrencyField, 'We spend currency'),
                         () => (inputs.weWantCurrencyField !== 'XRP' ? isRequired(inputs.weWantIssuerField, 'We want issuer') : null),
                         () => (inputs.weSpendCurrencyField !== 'XRP' ? isRequired(inputs.weSpendIssuerField, 'We spend issuer') : null),
                         () => (inputs.weWantCurrencyField !== 'XRP' ? isValidXrpAddress(inputs.weWantIssuerField, 'We want issuer address') : null),
                         () => (inputs.weSpendCurrencyField !== 'XRP' ? isValidXrpAddress(inputs.weSpendIssuerField, 'We spend issuer address') : null),
                         // () => (inputs.weSpendAmountField ? isValidNumber(inputs.weSpendAmountField, 'We spend amount', 0) : null),
                    ],
                    asyncValidators: [],
               },
               updateTokenBalanceAndExchange1: {
                    required: ['selectedAccount', 'weSpendCurrencyField'],
                    customValidators: [() => isValidXrpAddress('r9DZiCr2eejjRUqqTnTahL5UpLfku9Fe9D', 'Account address'), () => isValidCurrency(inputs.weSpendCurrencyField, 'We spend currency'), () => (inputs.weSpendCurrencyField !== 'XRP' ? isRequired(inputs.weSpendIssuerField, 'We spend issuer') : null), () => (inputs.weSpendCurrencyField !== 'XRP' ? isValidXrpAddress(inputs.weSpendIssuerField, 'We spend issuer address') : null)],
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

          // Always validate optional fields if provided
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

     clearFields(clearAllFields: boolean) {
          if (clearAllFields) {
               this.weSpendAmountField = '';
               this.weWantAmountField = '';
          }

          this.isMemoEnabled = false;
          this.memoField = '';
          this.isTicket = false;
          this.ticketSequence = '';
          this.isMarketOrder = false;
          // this.isPassive = false;
          this.isFillOrKill = false;
          this.cdr.detectChanges();
     }

     onOrderTypeChange(selectedType: string) {
          // Reset all to false first
          this.isPassive = false;
          this.isMarketOrder = false;
          this.isFillOrKill = false;

          // Set the selected one to true
          switch (selectedType) {
               case 'passive':
                    this.isPassive = true;
                    break;
               case 'marketOrder':
                    this.isMarketOrder = true;
                    break;
               case 'fillOrKill':
                    this.isFillOrKill = true;
                    break;
          }
     }

     clearMemeTokens() {
          // this.memeTokensSubject.next([]);
          this.dataSource.data = [];
     }

     async getWallet() {
          const wallet = await this.utilsService.getWallet(this.currentWallet.seed);
          if (!wallet) {
               throw new Error('ERROR: Wallet could not be created or is undefined');
          }
          return wallet;
     }

     updateSpinnerMessage(message: string) {
          this.spinnerMessage = message;
          this.cdr.detectChanges();
     }

     async showSpinnerWithDelay(message: string, delayMs: number = 200) {
          this.spinner = true;
          this.updateSpinnerMessage(message);
          await new Promise(resolve => setTimeout(resolve, delayMs));
     }

     setSlippage(slippage: number) {
          this.slippage = slippage;
          this.updateTokenBalanceAndExchange(); // Recalculate exchange with new slippage
          this.cdr.detectChanges();
     }

     onTokenChange(): void {
          const issuers = this.knownIssuers[this.tokenToRemove] || [];

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
               if (!this.knownIssuers[currency]) {
                    this.knownIssuers[currency] = [];
               }

               // Check for duplicates
               if (this.knownIssuers[currency].includes(issuer)) {
                    this.setError(`Issuer ${issuer} already exists for ${currency}`);
                    return;
               }

               // Add new issuer
               this.knownIssuers[currency].push(issuer);

               // Persist and update
               this.storageService.setKnownIssuers('knownIssuers', this.knownIssuers);
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

               if (this.knownIssuers[currency]) {
                    this.knownIssuers[currency] = this.knownIssuers[currency].filter(addr => addr !== issuer);

                    // Remove the currency entirely if no issuers remain
                    if (this.knownIssuers[currency].length === 0) {
                         delete this.knownIssuers[currency];
                    }

                    this.storageService.setKnownIssuers('knownIssuers', this.knownIssuers);
                    this.updateCurrencies();
                    this.setSuccess(`Removed issuer ${issuer} from ${currency}`);
                    this.cdr.detectChanges();
               } else {
                    this.setError(`Currency ${currency} not found`);
               }
          } else if (this.tokenToRemove) {
               // Remove entire token and all issuers
               delete this.knownIssuers[this.tokenToRemove];
               this.storageService.setKnownIssuers('knownIssuers', this.knownIssuers);
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
     //           if (this.knownIssuers[currency]) {
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
     //           this.knownIssuers[currency] = this.newIssuer.trim();
     //           this.storageService.setKnownIssuers('knownIssuers', this.knownIssuers);
     //           this.updateCurrencies();
     //           this.newCurrency = '';
     //           this.newIssuer = '';
     //           this.setSuccess(`Added ${currency} with issuer ${this.knownIssuers[currency]}`);
     //           this.cdr.detectChanges();
     //      } else {
     //           this.setError('Currency code and issuer address are required');
     //      }
     //      this.spinner = false;
     // }

     // removeToken() {
     //      if (this.tokenToRemove) {
     //           if (this.tokenToRemove === 'XRP') {
     //                this.setError('Cannot remove XRP');
     //                return;
     //           }
     //           delete this.knownIssuers[this.tokenToRemove];
     //           this.storageService.setKnownIssuers('knownIssuers', this.knownIssuers);
     //           this.updateCurrencies();
     //           if (this.weWantCurrencyField === this.tokenToRemove) {
     //                this.weWantCurrencyField = 'XRP';
     //                this.weWantIssuerField = '';
     //           }
     //           if (this.weSpendCurrencyField === this.tokenToRemove) {
     //                this.weSpendCurrencyField = 'XRP';
     //                this.weSpendIssuerField = '';
     //           }
     //           this.setSuccess(`Removed ${this.tokenToRemove}`);
     //           this.tokenToRemove = '';
     //           this.cdr.detectChanges();
     //      } else {
     //           this.setError('Select a token to remove');
     //      }
     //      this.spinner = false;
     // }

     private updateCurrencies() {
          this.currencies = ['XRP', ...Object.keys(this.knownIssuers).filter(c => c !== 'XRP')];
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
