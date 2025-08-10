import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { WalletInputComponent } from '../wallet-input/wallet-input.component';
import { StorageService } from '../../services/storage.service';
import { TrustSet, OfferCreate, TransactionMetadataBase, Client, OfferCreateFlags, Currency, BookOffer, IssuedCurrencyAmount, AMMInfoRequest } from 'xrpl';
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

// Helper interfaces for proper typing
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

// Update your existing CurrencyObject interfaces
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
               amount: string | { currency: string; issuer: string; value: string }; // Adjusted issuer to be required for tokens
               amount2: string | { currency: string; issuer: string; value: string }; // Adjusted issuer to be required for tokens
               lp_token: { currency: string; issuer?: string; value: string };
               trading_fee: number;
               account: string; // Added for AMM account
          };
     };
}

type CurrencyObject = CurrencyObjectXRP | CurrencyObjectToken;
type CurrencyAmount = CurrencyAmountXRP | CurrencyAmountToken;

// First, extend the BookOffer type to include our custom AMM properties
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
     imports: [CommonModule, FormsModule, WalletInputComponent, NavbarComponent, SanitizeHtmlPipe, MatTableModule, MatSortModule, MatPaginatorModule, MatButtonModule],
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
     // private weWantCurrencySubject = new Subject<string>();
     // private weSpendCurrencySubject = new Subject<string>();
     selectedAccount: 'account1' | 'account2' | null = null;
     private lastResult: string = '';
     transactionInput = '';
     result: string = '';
     currencyFieldDropDownValue: string = 'XRP';
     checkExpirationTime: string = 'seconds';
     weSpendCurrencyField: string = 'XRP';
     offerSequenceField: string = '';
     weWantCurrencyField: string = 'HONEY';
     weWantIssuerField: string = 'rHEG9KZ2RYYjHM8DCmNHEKu5SkZWwgmFUB';
     // weWantCurrencyField: string = 'RLUSD'; // Set to RLUSD for XRP/RLUSD pair
     // weWantIssuerField: string = 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De'; // Official RLUSD issuer
     // weWantCurrencyField: string = 'DOG';
     // weWantIssuerField: string = '';
     // weWantCurrencyField: string = 'PHNIX';
     // weWantIssuerField: string = 'rDFXbW2ZZCG5WgPtqwNiA2xZokLMm9ivmN';
     weWantAmountField: string = '';
     weWantTokenBalanceField: string = '';
     weSpendIssuerField: string = '';
     weSpendAmountField: string = '';
     weSpendTokenBalanceField: string = '';
     isMarketOrder: boolean = false;
     ticketCountField = '';
     ticketSequence: string = '';
     isTicket = false;
     isTicketEnabled = false;
     expirationTimeField = '';
     account1 = { name: '', address: '', seed: '', secretNumbers: '', mnemonic: '', balance: '' };
     account2 = { name: '', address: '', seed: '', secretNumbers: '', mnemonic: '', balance: '' };
     xrpBalance1Field = '';
     ownerCount = '';
     totalXrpReserves = '';
     executionTime = '';
     amountField = '';
     currentTimeField = '';
     memoField = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = false;
     spinner = false;
     issuers: string[] = [];
     selectedIssuer: string = '';
     tokenBalance: string = '';
     spinnerMessage: string = '';
     phnixBalance: string = '0'; // Hardcoded for now, will be fetched dynamically
     phnixExchangeXrp: string = '0'; // To store the calculated XRP amount
     xrpPrice: string = '0'; // New property to store XRP price in RLUSD
     averageExchangeRate: string = '';
     maxSellablePhnix: string = '';
     phnixCurrencyCode: string = '';
     insufficientLiquidityWarning: boolean = false;
     slippage: number = 0.2357; // Default to 23.57%
     tokens$: Observable<{ transactionType: string; action: string; amountXrp: string; amountToken: string; currency: string; issuer: string; transactionHash: string; timestamp: Date; createdDate: Date; creationAge: string }[]>;
     private memeTokensSubject = new BehaviorSubject<{ transactionType: string; action: string; amountXrp: string; amountToken: string; currency: string; issuer: string; transactionHash: string; timestamp: Date; createdDate: Date; creationAge: string }[]>([]);
     memeTokens$ = this.memeTokensSubject.asObservable(); // Use Observable for UI binding
     private readonly maxTokens = 20; // Limit to 20 tokens

     private priceRefreshInterval: any; // For polling

     constructor(private xrplService: XrplService, private utilsService: UtilsService, private cdr: ChangeDetectorRef, private storageService: StorageService) {
          this.tokens$ = this.xrplService.tokens$; // Initialize tokens observable
     }

     ngOnInit() {
          this.startTokenMonitoring(); // Start monitoring when component initializes
          this.memeTokens$.subscribe(tokens => {
               this.dataSource.data = tokens;
          });
     }

     async ngAfterViewInit() {
          this.dataSource.paginator = this.paginator;
          this.dataSource.sort = this.sort;
          this.cdr.detectChanges();
          this.startPriceRefresh(); // Start polling for price
          // await this.updateTokenBalanceAndExchange(); // Fetch Token balance and calculate XRP
     }

     ngOnDestroy() {
          // Clean up interval to prevent memory leaks
          if (this.priceRefreshInterval) {
               clearInterval(this.priceRefreshInterval);
          }
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

     setSlippage(slippage: number) {
          this.slippage = slippage;
          this.updateTokenBalanceAndExchange(); // Recalculate exchange with new slippage
          this.cdr.detectChanges();
     }

     onAccountChange() {
          if (!this.selectedAccount) return;
          if (this.selectedAccount === 'account1') {
               this.displayOfferDataForAccount1();
          }
          // this.updateTokenBalanceAndExchange();
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

     isValidDate(value: any): boolean {
          return value && !isNaN(new Date(value).getTime());
     }

     private isMemeCoin(token: { currency: string; issuer: string }): boolean {
          // Dynamic heuristic: Exclude known fiat/stablecoin currencies
          let isNonStandard;
          if (token.currency.length > 3) {
               isNonStandard = !AppConstants.BLACK_LISTED_MEMES.includes(this.utilsService.decodeCurrencyCode(token.currency));
          } else {
               isNonStandard = !AppConstants.BLACK_LISTED_MEMES.includes(token.currency.toUpperCase());
          }
          return isNonStandard;
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

     // Method to fetch XRP price in RLUSD
     async fetchXrpPrice() {
          console.log('Entering fetchXrpPrice');
          const startTime = Date.now();
          this.setSuccessProperties();

          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }

          try {
               const client = await this.xrplService.getClient();
               const { net, environment } = this.xrplService.getNet();
               console.log(`Connected to ${environment} ${net}`);

               // Define the trading pair (XRP/RLUSD)
               // const we_want = { currency: this.utilsService.encodeCurrencyCode('RLUSD'), issuer: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De' }; // RLUSD as taker_gets
               // Define the trading pair (XRP/PHINX)
               // const we_want = { currency: this.utilsService.encodeCurrencyCode('PHINX'), issuer: 'rDFXbW2ZZCG5WgPtqwNiA2xZokLMm9ivmN' }; // PHINX as taker_gets
               // const we_spend = { currency: 'XRP' }; // XRP as taker_pays (no value field)

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

               // Fetch order book for XRP/RLUSD (buy RLUSD with XRP)
               const orderBook = await client.request({
                    command: 'book_offers',
                    taker: this.selectedAccount === 'account1' ? this.account1.address : 'rDefaultTaker',
                    ledger_index: 'current',
                    taker_gets: we_want,
                    taker_pays: we_spend,
               });

               // Calculate price from order book
               if (orderBook.result.offers.length > 0) {
                    const stats = this.computeAverageExchangeRateBothWays(orderBook.result.offers, 1);
                    this.xrpPrice = stats.forward.vwap.toFixed(8); // RLUSD per 1 XRP (XRP/RLUSD)
                    console.log(`1 RLUSD will buy: ${this.xrpPrice} XRP`);
               } else {
                    this.xrpPrice = 'N/A';
                    console.log('No offers found for XRP/RLUSD');
               }

               this.cdr.detectChanges(); // Trigger UI update
          } catch (error: any) {
               console.error('Error fetching XRP price:', error);
               this.xrpPrice = 'Error';
               this.setError(`ERROR: Failed to fetch XRP price - ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving fetchXrpPrice in ${this.executionTime}ms`);
          }
     }

     // Start polling for price updates
     startPriceRefresh() {
          // Fetch price immediately
          // this.fetchXrpPrice();
          // Set interval to refresh every 10 seconds
          // this.priceRefreshInterval = setInterval(() => {
          // this.fetchXrpPrice();
          // }, 10000);
     }

     async getOffers() {
          console.log('Entering getOffers');
          const startTime = Date.now();
          this.setSuccessProperties();

          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }

          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
          if (!this.utilsService.validateInput(seed)) {
               return this.setError('ERROR: Account seed cannot be empty');
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               let wallet;
               if (this.selectedAccount === 'account1') {
                    wallet = await this.utilsService.getWallet(this.account1.seed, environment);
               }

               if (!wallet) {
                    return this.setError('ERROR: Wallet could not be created or is undefined');
               }

               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nGetting Account Offers\n\n`;

               // Fetch offers
               const offersResponse = await this.xrplService.getAccountOffers(client, wallet.classicAddress, 'validated', '');
               console.log('offers:', offersResponse);

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

               // Offers section
               if (!offersResponse.result.offers || offersResponse.result.offers.length <= 0) {
                    data.sections.push({
                         title: 'Offers',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No offers found for <code>${wallet.address}</code>` }],
                    });
               } else {
                    data.sections.push({
                         title: `Offers (${offersResponse.result.offers.length})`,
                         openByDefault: true,
                         subItems: offersResponse.result.offers.map((offer, index) => {
                              const takerGets = typeof offer.taker_gets === 'string' ? `${xrpl.dropsToXrp(offer.taker_gets)} XRP` : `${offer.taker_gets.value} ${offer.taker_gets.currency}${offer.taker_gets.issuer ? ` (Issuer: ${offer.taker_gets.issuer})` : ''}`;
                              const takerPays = typeof offer.taker_pays === 'string' ? `${xrpl.dropsToXrp(offer.taker_pays)} XRP` : `${offer.taker_pays.value} ${offer.taker_pays.currency}${offer.taker_pays.issuer ? ` (Issuer: ${offer.taker_pays.issuer})` : ''}`;

                              return {
                                   key: `Offer ${index + 1} (Sequence: ${offer.seq})`,
                                   openByDefault: false,
                                   content: [{ key: 'Sequence', value: String(offer.seq) }, { key: 'Taker Gets', value: takerGets }, { key: 'Taker Pays', value: takerPays }, ...(offer.expiration ? [{ key: 'Expiration', value: new Date(offer.expiration * 1000).toISOString() }] : []), ...(offer.flags ? [{ key: 'Flags', value: String(offer.flags) }] : [])],
                              };
                         }),
                    });
               }

               this.utilsService.renderPaymentChannelDetails(data);

               this.account1.balance = await this.getXrpBalance(wallet.classicAddress);
          } catch (error: any) {
               console.error('Error:', error);
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

          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }

          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
          if (!this.utilsService.validateInput(seed)) {
               return this.setError('ERROR: Account seed cannot be empty');
          }

          // Updated buildCurrencyObject to ensure correct typing
          const buildCurrencyObject = (currency: string, issuer: string, value: string): CurrencyObject => {
               if (currency === AppConstants.XRP_CURRENCY) {
                    return { currency: 'XRP', value } as CurrencyObjectXRP;
               }
               return { currency, issuer, value } as CurrencyObjectToken;
          };

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               let wallet;
               if (this.selectedAccount === 'account1') {
                    wallet = await this.utilsService.getWallet(this.account1.seed, environment);
               } else if (this.selectedAccount === 'account2') {
                    wallet = await this.utilsService.getWallet(this.account2.seed, environment);
               }

               if (!wallet) {
                    return this.setError('ERROR: Wallet could not be created or is undefined');
               }

               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nGetting Order Book\n\n`;

               // Initialize currency objects with proper typing
               const we_want: CurrencyAmount =
                    this.weWantCurrencyField === 'XRP'
                         ? { currency: 'XRP', value: this.weWantAmountField }
                         : {
                                currency: this.weWantCurrencyField.length > 3 ? this.utilsService.encodeCurrencyCode(this.weWantCurrencyField) : this.weWantCurrencyField,
                                issuer: this.weWantIssuerField,
                                value: this.weWantAmountField,
                           };

               const we_spend: CurrencyAmount =
                    this.weSpendCurrencyField === 'XRP'
                         ? { currency: 'XRP', value: this.weSpendAmountField }
                         : {
                                currency: this.weSpendCurrencyField.length > 3 ? this.utilsService.encodeCurrencyCode(this.weSpendCurrencyField) : this.weSpendCurrencyField,
                                issuer: this.weSpendIssuerField,
                                value: this.weSpendAmountField,
                           };

               // Decode currencies for display
               const displayWeWantCurrency = we_want.currency.length > 3 ? this.utilsService.decodeCurrencyCode(we_want.currency) : we_want.currency;
               const displayWeSpendCurrency = we_spend.currency.length > 3 ? this.utilsService.decodeCurrencyCode(we_spend.currency) : we_spend.currency;

               // Determine offer type
               const offerType = we_spend.currency === AppConstants.XRP_CURRENCY ? 'buy' : 'sell';

               // Fetch all market data in parallel
               const [orderBook, counterOrderBook, ammData] = await Promise.all([
                    client.request({
                         command: 'book_offers',
                         taker: wallet.address,
                         ledger_index: 'current',
                         taker_gets: we_want,
                         taker_pays: we_spend,
                    }),
                    client.request({
                         command: 'book_offers',
                         taker: wallet.address,
                         ledger_index: 'current',
                         taker_gets: we_spend,
                         taker_pays: we_want,
                    }),
                    client.request(this.createAmmRequest(we_spend, we_want)).catch(() => null) as Promise<AMMInfoResponse | null>,
               ]);
               // Process AMM data if available
               const combinedOffers: CustomBookOffer[] = [...orderBook.result.offers];
               if (ammData?.result?.amm) {
                    const amm = ammData.result.amm;

                    // Convert AMM amounts to XRPL Amount type
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
                         // Add required BookOffer fields with default values
                         BookDirectory: '0',
                         BookNode: '0',
                         OwnerNode: '0',
                         PreviousTxnID: '0',
                         PreviousTxnLgrSeq: 0,
                    };
                    combinedOffers.unshift(ammOffer);
               }

               // Calculate market stats
               const spread = this.computeBidAskSpread(offerType === 'sell' ? counterOrderBook.result.offers : combinedOffers, offerType === 'sell' ? combinedOffers : counterOrderBook.result.offers);
               const liquidity = this.computeLiquidityRatio(offerType === 'sell' ? counterOrderBook.result.offers : combinedOffers, offerType === 'sell' ? combinedOffers : counterOrderBook.result.offers, offerType === 'sell');
               const stats = this.computeAverageExchangeRateBothWays(combinedOffers, 5);

               // Prepare data for rendering
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

               // Restore original Statistics section
               if (combinedOffers.length > 0 || ammData?.result?.amm) {
                    this.populateStatsFields(stats, we_want, we_spend, spread, liquidity, offerType);

                    const pair = `${displayWeWantCurrency}/${displayWeSpendCurrency}`;
                    const reversePair = `${displayWeSpendCurrency}/${displayWeWantCurrency}`;
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
                         const spotPrice = amm.trading_fee / 1000000; // Convert to percentage
                         statsContent.push({
                              key: 'AMM Spot Price',
                              value: `${spotPrice.toFixed(8)} ${pair}`,
                         });

                         const tradingFeeBps = ammData.result.amm.trading_fee; // e.g. 38
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
                         // openByDefault: true,
                         content: statsContent,
                    });
               }

               this.utilsService.renderPaymentChannelDetails(data);
               this.setSuccess(this.result);
               this.account1.balance = await this.getXrpBalance(wallet.classicAddress);
          } catch (error: any) {
               console.error('Error:', error);
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

          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }

          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
          if (!this.utilsService.validateInput(seed)) {
               return this.setError('ERROR: Account seed cannot be empty');
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               let wallet;
               if (this.selectedAccount === 'account1') {
                    wallet = await this.utilsService.getWallet(this.account1.seed, environment);
               } else if (this.selectedAccount === 'account2') {
                    wallet = await this.utilsService.getWallet(this.account2.seed, environment);
               }

               if (!wallet) {
                    return this.setError('ERROR: Wallet could not be created or is undefined');
               }

               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nCreating Offer\n\n`;

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

               // type CurrencyObject = CurrencyObjectXRP | CurrencyObjectToken;
               // const buildCurrencyObject = (currency: string, issuer: string, value: string): CurrencyObject => (currency === AppConstants.XRP_CURRENCY ? { currency, value } : { currency, issuer, value });

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

               // Trust line setup
               let trustSetResult = null;
               let issuerAddr, issuerCur;
               if (this.weWantIssuerField === AppConstants.XRP_CURRENCY || this.weWantIssuerField === '') {
                    issuerAddr = this.weSpendIssuerField;
                    issuerCur = this.weSpendCurrencyField;
               } else {
                    issuerAddr = this.weWantIssuerField;
                    issuerCur = this.weWantCurrencyField;
               }

               console.log(`issuerAddr ${issuerAddr}`);
               console.log(`issuerCur ${issuerCur}`);

               // const trustLines = await this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', '');
               // console.log(`trustLines ${JSON.stringify(trustLines.result.lines, null, 2)}`);

               // const doesTrustLinesExists = trustLines.result.lines.filter((line: any) => {
               //      // Decode currency for comparison
               //      const decodedCurrency = line.currency.length > 3 ? this.utilsService.decodeCurrencyCode(line.currency) : line.currency;
               //      return (
               //           parseFloat(line.limit) > 0 &&
               //           parseFloat(line.balance) >= 0 &&
               //           line.account === issuerAddr && // Use 'account' as the issuer field
               //           (issuerCur ? decodedCurrency === issuerCur : true)
               //      );
               // });
               // console.debug(`Active trust lines for ${wallet.classicAddress}:`, doesTrustLinesExists);

               const fee = await this.xrplService.calculateTransactionFee(client);
               // if (doesTrustLinesExists.length <= 0) {
               //      const decodedCurrency = issuerCur.length > 3 ? this.utilsService.encodeCurrencyCode(issuerCur) : issuerCur;
               //      const currentLedger = await this.xrplService.getLastLedgerIndex(client);
               //      const trustSetTx: TrustSet = {
               //           TransactionType: 'TrustSet',
               //           Account: wallet.classicAddress,
               //           LimitAmount: {
               //                currency: decodedCurrency,
               //                issuer: issuerAddr,
               //                value: '1000000',
               //           },
               //           Fee: fee,
               //           LastLedgerSequence: currentLedger + 20,
               //      };

               //      const ts_prepared = await client.autofill(trustSetTx);
               //      const ts_signed = wallet.sign(ts_prepared);
               //      trustSetResult = await client.submitAndWait(ts_signed.tx_blob);

               //      if (trustSetResult.result.meta && typeof trustSetResult.result.meta !== 'string' && (trustSetResult.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
               //           this.utilsService.renderTransactionsResults(trustSetResult, this.resultField.nativeElement);
               //           this.resultField.nativeElement.classList.add('error');
               //           this.setErrorProperties();
               //           return;
               //      }

               //      data.sections.push({
               //           title: 'Trust Line Setup',
               //           openByDefault: true,
               //           content: [
               //                { key: 'Status', value: 'Trust line created' },
               //                { key: 'Currency', value: issuerCur },
               //                { key: 'Issuer', value: `<code>${issuerAddr}</code>` },
               //                { key: 'Limit', value: this.amountField },
               //           ],
               //      });
               // } else {
               //      data.sections.push({
               //           title: 'Trust Line Setup',
               //           openByDefault: true,
               //           content: [{ key: 'Status', value: 'Trust lines already exist' }],
               //      });
               // }

               // // Fetch reserve information
               const xrpReserve = await this.xrplService.getXrpReserveRequirements(client, wallet.address);

               // data.sections.push({
               //      title: 'Account Reserve Information',
               //      openByDefault: true,
               //      content: [
               //           { key: 'Base Reserve', value: `${xrpReserve.baseReserve} XRP` },
               //           { key: 'Owner Reserve (per object)', value: `${xrpReserve.ownerReserve} XRP` },
               //           { key: 'Owner Count', value: String(xrpReserve.ownerCount) },
               //           { key: 'Current Reserve', value: `${xrpReserve.currentReserve} XRP` },
               //      ],
               // });

               // Initial balances
               const initialXrpBalance = await client.getXrpBalance(wallet.address);
               // console.log(`Initial XRP Balance ${initialXrpBalance} (drops): ${xrpl.xrpToDrops(initialXrpBalance)}`);
               // const tokenBalance = this.weSpendCurrencyField === AppConstants.XRP_CURRENCY ? this.weWantCurrencyField : this.weSpendCurrencyField;
               // let initialTokenBalance;
               // if (this.phnixBalance != '') {
               // initialTokenBalance = this.phnixBalance;
               // } else {
               // const initialTokenBalance = await this.xrplService.getOnlyTokenBalance(client, wallet.address, tokenBalance);
               // }
               // console.log(`Initial ${tokenBalance} Balance: ${initialTokenBalance}`);
               data.sections.push({
                    title: 'Initial Balances',
                    openByDefault: true,
                    content: [
                         { key: 'XRP', value: `${initialXrpBalance} (${xrpl.xrpToDrops(initialXrpBalance)} drops)` },
                         // { key: tokenBalance, value: initialTokenBalance },
                    ],
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
               // if (this.weSpendCurrencyField === AppConstants.XRP_CURRENCY && Number(xrpl.xrpToDrops(initialXrpBalance)) < Number(this.weSpendAmountField)) {
               //      this.setError('Insufficient XRP balance');
               //      return;
               // } else if (this.weSpendCurrencyField !== AppConstants.XRP_CURRENCY && Number(initialTokenBalance) < Number(this.weSpendAmountField)) {
               //      this.setError(`Insufficient ${this.weSpendCurrencyField} balance`);
               //      return;
               // }

               if (we_want.currency.length > 3) {
                    we_want.currency = this.utilsService.encodeCurrencyCode(we_want.currency);
               }
               // if (we_spend.currency && we_spend.currency.length > 3) {
               //      we_spend.currency = this.utilsService.encodeCurrencyCode(we_spend.currency);
               // }

               const offerType = we_spend.currency ? 'sell' : 'buy';
               console.log(`Offer Type: ${offerType}`);

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
               // data.sections.push({
               //      title: 'Rate Analysis',
               //      openByDefault: true,
               //      content: rateAnalysis,
               // });

               // Market analysis
               const MAX_SLIPPAGE = 0.05;
               const orderBook = await client.request({
                    command: 'book_offers',
                    taker: wallet.address,
                    ledger_index: 'current',
                    taker_gets: we_want,
                    taker_pays: we_spend.currency ? we_spend : { currency: AppConstants.XRP_CURRENCY, value: this.weSpendAmountField },
               });
               const oppositeOrderBook = await client.request({
                    command: 'book_offers',
                    taker: wallet.address,
                    ledger_index: 'current',
                    taker_gets: we_spend.currency ? we_spend : { currency: AppConstants.XRP_CURRENCY, value: this.weSpendAmountField },
                    taker_pays: we_want,
               });

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
                    const orderBook2 = await client.request({
                         command: 'book_offers',
                         taker: wallet.address,
                         ledger_index: 'current',
                         taker_gets: we_spend.currency ? we_spend : { currency: AppConstants.XRP_CURRENCY, value: this.weSpendAmountField },
                         taker_pays: we_want,
                    });
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
                         currency: this.weWantCurrencyField.length > 3 ? this.utilsService.encodeCurrencyCode(this.weWantCurrencyField) : this.weWantCurrencyField,
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
                         currency: this.weSpendCurrencyField.length > 3 ? this.utilsService.encodeCurrencyCode(this.weSpendCurrencyField) : this.weSpendCurrencyField,
                         issuer: this.weSpendIssuerField,
                         value: this.weSpendAmountField,
                    };
               }

               let prepared: OfferCreate;
               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }

                    const currentLedger = await this.xrplService.getLastLedgerIndex(client);

                    if (typeof we_spend1 === 'object') {
                         // Token case
                         prepared = await client.autofill({
                              TransactionType: 'OfferCreate',
                              Account: wallet.classicAddress,
                              TakerGets: we_spend1,
                              TakerPays: we_want1,
                              Flags: this.isMarketOrder ? OfferCreateFlags.tfImmediateOrCancel : 0,
                              Sequence: 0,
                              Fee: fee,
                              LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                         });
                    } else {
                         // XRP case
                         prepared = await client.autofill({
                              TransactionType: 'OfferCreate',
                              Account: wallet.classicAddress,
                              TakerGets: we_spend1,
                              TakerPays: we_want1,
                              Flags: this.isMarketOrder ? OfferCreateFlags.tfImmediateOrCancel : 0,
                              Sequence: 0,
                              Fee: fee,
                              LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                         });
                    }
               } else {
                    const currentLedger = await this.xrplService.getLastLedgerIndex(client);

                    if (typeof we_spend1 === 'object') {
                         // Token case
                         prepared = await client.autofill({
                              TransactionType: 'OfferCreate',
                              Account: wallet.classicAddress,
                              TakerGets: we_spend1,
                              TakerPays: we_want1,
                              Flags: this.isMarketOrder ? OfferCreateFlags.tfImmediateOrCancel : 0,
                              Fee: fee,
                              LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                         });
                    } else {
                         // XRP case
                         prepared = await client.autofill({
                              TransactionType: 'OfferCreate',
                              Account: wallet.classicAddress,
                              TakerGets: we_spend1,
                              TakerPays: we_want1,
                              Flags: this.isMarketOrder ? OfferCreateFlags.tfImmediateOrCancel : 0,
                              Fee: fee,
                              LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                         });
                    }
               }

               if (this.memoField) {
                    prepared.Memos = [
                         {
                              Memo: {
                                   MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                                   MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                              },
                         },
                    ];
               }

               const signed = wallet.sign(prepared);
               console.log(`signed: ${signed}`);
               const tx = await client.submitAndWait(signed.tx_blob);

               if (tx.result.meta && typeof tx.result.meta !== 'string' && (tx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               // Balance changes
               let balanceChanges: { account: string; balances: any[] }[] = [];
               if (tx.result.meta && typeof tx.result.meta !== 'string') {
                    balanceChanges = xrpl.getBalanceChanges(tx.result.meta);
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

               // Updated balances
               const finalXrpBalance = await client.getXrpBalance(wallet.address);
               // const updatedTokenBalance = await this.xrplService.getOnlyTokenBalance(client, wallet.address, tokenBalance);
               data.sections.push({
                    title: 'Updated Balances',
                    openByDefault: true,
                    content: [
                         { key: 'XRP', value: finalXrpBalance.toString() },
                         // { key: tokenBalance, value: updatedTokenBalance },
                    ],
               });

               // Outstanding offers
               const acctOffers = await this.xrplService.getAccountOffers(client, wallet.classicAddress, 'validated', '');
               // Helper function to format offer amounts
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
                         { key: 'Name', value: this.account1.name },
                         { key: 'Address', value: `<code>${wallet.address}</code>` },
                         { key: 'Final XRP Balance', value: finalXrpBalance.toString() },
                    ],
               });

               this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               this.account1.balance = await this.getXrpBalance(wallet.classicAddress);
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

          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }

          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
          if (!this.utilsService.validateInput(seed)) {
               return this.setError('ERROR: Account seed cannot be empty');
          }

          const offerSequenceArray = this.offerSequenceField.split(',').map(seq => seq.trim());
          if (offerSequenceArray.length === 0 || offerSequenceArray.every(seq => !seq)) {
               return this.setError('ERROR: Offer Sequence field cannot be empty');
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               let wallet;
               if (this.selectedAccount === 'account1') {
                    wallet = await this.utilsService.getWallet(this.account1.seed, environment);
               } else if (this.selectedAccount === 'account2') {
                    wallet = await this.utilsService.getWallet(this.account2.seed, environment);
               }

               if (!wallet) {
                    return this.setError('ERROR: Wallet could not be created or is undefined');
               }

               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nCancelling Offers\n\n`;

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
                    if (isNaN(parseFloat(element))) {
                         hasError = true;
                         transactions.push({
                              type: 'OfferCancel',
                              result: {
                                   error: `Invalid Offer Sequence: ${element} is not a valid number`,
                                   OfferSequence: element,
                              },
                         });
                         continue;
                    }

                    const offerSequence = parseInt(element);
                    if (offerSequence <= 0) {
                         hasError = true;
                         transactions.push({
                              type: 'OfferCancel',
                              result: {
                                   error: `Invalid Offer Sequence: ${element} must be greater than zero`,
                                   OfferSequence: element,
                              },
                         });
                         continue;
                    }

                    try {
                         const prepared = await client.autofill({
                              TransactionType: 'OfferCancel',
                              Account: wallet.classicAddress,
                              OfferSequence: offerSequence,
                         });

                         const signed = wallet.sign(prepared);
                         const tx = await client.submitAndWait(signed.tx_blob);

                         transactions.push({
                              type: 'OfferCancel',
                              result: tx,
                         });

                         if (tx.result.meta && typeof tx.result.meta !== 'string' && (tx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
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
                    console.log('result: ', result);
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

               console.log('transactions', transactions);
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
               this.utilsService.renderTransactionsResults(transactions, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add(hasError ? 'error' : 'success');

               // Render summary and details in data.sections
               this.utilsService.renderPaymentChannelDetails(data);

               if (hasError) {
                    this.setErrorProperties();
               } else {
                    this.setSuccess(this.result);
               }

               this.account1.balance = await this.getXrpBalance(wallet.classicAddress);
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

          await this.updateTokenBalanceAndExchange();

          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }

          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
          if (!this.utilsService.validateInput(seed)) {
               return this.setError('ERROR: Account seed cannot be empty');
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               let wallet;
               if (this.selectedAccount === 'account1') {
                    wallet = await this.utilsService.getWallet(this.account1.seed, environment);
               } else if (this.selectedAccount === 'account2') {
                    wallet = await this.utilsService.getWallet(this.account2.seed, environment);
               }

               if (!wallet) {
                    return this.setError('ERROR: Wallet could not be created or is undefined');
               }

               // Fetch token balances
               const balance = await this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '');
               console.log('balance', balance);

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
                              currencyBalance = currencyBalance + value;
                              balanceItems.push({
                                   key: `${displayCurrency} from ${issuer.slice(0, 8)}...`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Currency', value: displayCurrency },
                                        { key: 'Issuer', value: `<code>${issuer}</code>` },
                                        { key: 'Amount', value: value },
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
               // else {
               //      data.sections.push({
               //           title: 'Balances',
               //           openByDefault: true,
               //           content: [{ key: 'Status', value: 'No balances (tokens held by you)' }],
               //      });
               // }

               this.utilsService.renderPaymentChannelDetails(data);

               this.setSuccess(this.result);

               this.account1.balance = await this.getXrpBalance(wallet.classicAddress);

               if (this.weWantCurrencyField === 'XRP') {
                    this.weSpendAmountField = currencyBalance
                         ? Number(currencyBalance).toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 18,
                                useGrouping: true,
                           })
                         : '0';
               } else {
                    this.weWantAmountField = currencyBalance
                         ? Number(currencyBalance).toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 18,
                                useGrouping: true,
                           })
                         : '0';
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
                    this.weWantTokenBalanceField = Number(weSpendTokenBalanceElem.value).toLocaleString(undefined, {
                         minimumFractionDigits: 0,
                         maximumFractionDigits: 18,
                         useGrouping: true,
                    });
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

     calculateRate(gets: string | IssuedCurrencyAmount | CurrencyAmount, pays: string | IssuedCurrencyAmount | CurrencyAmount): string {
          const getsValue = typeof gets === 'string' ? xrpl.dropsToXrp(gets) : gets.value;
          const paysValue = typeof pays === 'string' ? xrpl.dropsToXrp(pays) : pays.value;
          return new BigNumber(paysValue).dividedBy(getsValue).toFixed(8);
     }

     async onWeWantCurrencyChange() {
          console.log('Entering onWeWantCurrencyChange');
          const startTime = Date.now();

          if (!this.selectedAccount) {
               this.setError('Please select an account');
               this.weWantTokenBalanceField = '0';
               return;
          }
          const address = this.selectedAccount === 'account1' ? this.account1.address : this.account2.address;
          if (!this.utilsService.validateInput(address)) {
               this.setError('ERROR: Account address cannot be empty');
               this.weWantTokenBalanceField = '0';
               return;
          }

          try {
               this.spinner = true;
               let balance: string;
               if (this.weWantCurrencyField === 'XRP') {
                    balance = await this.getXrpBalance(address);
               } else {
                    const currencyCode = this.weWantCurrencyField.length > 3 ? this.utilsService.encodeCurrencyCode(this.weWantCurrencyField) : this.weWantCurrencyField;
                    balance = (await this.getCurrencyBalance(address, currencyCode)) ?? '0';
               }
               this.weWantTokenBalanceField = balance !== null ? balance : '0';
               // this.phnixBalance = Number(this.weWantTokenBalanceField).toFixed(6);
               this.phnixBalance = Number(this.weWantTokenBalanceField).toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 18, // enough to preserve precision
                    useGrouping: true,
               });
               // Number(this.weWantTokenBalanceField).toLocaleString();
               this.weWantTokenBalanceField = Number(this.weWantTokenBalanceField).toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 18, // enough to preserve precision
                    useGrouping: true,
               });
               // = Number(this.weWantTokenBalanceField).toLocaleString();
          } catch (error: any) {
               console.error('Error fetching weWant balance:', error);
               this.setError(`ERROR: Failed to fetch balance - ${error.message || 'Unknown error'}`);
               this.weWantTokenBalanceField = '0';
          } finally {
               this.spinner = false;
               this.cdr.detectChanges();
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving onWeWantCurrencyChange in ${this.executionTime}ms`);
          }
     }

     async onWeSpendCurrencyChange() {
          console.log('Entering onWeSpendCurrencyChange');
          const startTime = Date.now();

          if (!this.selectedAccount) {
               this.setError('Please select an account');
               this.weSpendTokenBalanceField = '0';
               return;
          }
          const address = this.selectedAccount === 'account1' ? this.account1.address : this.account2.address;
          if (!this.utilsService.validateInput(address)) {
               this.setError('ERROR: Account address cannot be empty');
               this.weSpendTokenBalanceField = '0';
               return;
          }

          try {
               this.spinner = true;
               let balance: string;
               if (this.weSpendCurrencyField === 'XRP') {
                    balance = await this.getXrpBalance(address);
               } else {
                    const currencyCode = this.weSpendCurrencyField.length > 3 ? this.utilsService.encodeCurrencyCode(this.weSpendCurrencyField) : this.weSpendCurrencyField;
                    balance = (await this.getCurrencyBalance(address, currencyCode, this.weSpendIssuerField)) ?? '0';
               }
               this.weSpendTokenBalanceField = balance !== null ? balance : '0';
               this.phnixExchangeXrp = this.weSpendTokenBalanceField;
          } catch (error: any) {
               console.error('Error fetching weSpend balance:', error);
               this.setError(`ERROR: Failed to fetch balance - ${error.message || 'Unknown error'}`);
               this.weSpendTokenBalanceField = '0';
          } finally {
               this.spinner = false;
               this.cdr.detectChanges();
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving onWeSpendCurrencyChange in ${this.executionTime}ms`);
          }
     }

     async getCurrencyBalance(address: string, currency: string, issuer?: string): Promise<string | null> {
          console.log('Entering getCurrencyBalance');
          const startTime = Date.now();

          try {
               const client = await this.xrplService.getClient();
               const balanceResponse = await this.xrplService.getTokenBalance(client, address, 'validated', '');

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
               }
               // return tokenTotal > 0 ? (Math.round(tokenTotal * 100) / 100).toString() : '0';
               return tokenTotal > 0 ? tokenTotal.toString() : '0';
          } catch (error: any) {
               console.error('Error fetching token balance:', error);
               throw error;
          } finally {
               this.spinner = false;
               this.cdr.detectChanges();
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getCurrencyBalance in ${this.executionTime}ms`);
          }
     }

     async updateTokenBalanceAndExchange() {
          console.log('Entering updateTokenBalanceAndExchange');
          const startTime = Date.now();
          this.setSuccessProperties();

          if (!this.selectedAccount) {
               this.setError('Please select an account');
               this.phnixBalance = '0';
               this.phnixExchangeXrp = '0';
               return;
          }

          const address = this.selectedAccount === 'account1' ? this.account1.address : this.account2.address;

          if (!this.utilsService.validateInput(address)) {
               this.setError('ERROR: Account address cannot be empty');
               this.phnixBalance = '0';
               this.phnixExchangeXrp = '0';
               return;
          }

          try {
               this.spinner = true;

               const client = await this.xrplService.getClient();
               const { net, environment } = this.xrplService.getNet();
               console.log(`Connected to ${environment} ${net}`);

               if (environment !== AppConstants.NETWORKS.MAINNET.NAME) {
                    console.warn('Not connected to Mainnet. Results may differ from XPMarket.');
               }

               if (this.weWantCurrencyField === 'XRP') {
                    this.updateTokenBalanceAndExchange1();
                    await this.updateTokenBalanceAndExchange1();
                    return;
               } else {
                    // Fetch Token balance
                    const balanceResponse = await this.xrplService.getTokenBalance(client, address, 'validated', '');
                    let phnixBalance = '0';

                    if (balanceResponse.result.assets) {
                         for (const [issuer, assets] of Object.entries(balanceResponse.result.assets)) {
                              for (const asset of assets as any[]) {
                                   const decodedCurrency = asset.currency.length > 3 ? this.utilsService.decodeCurrencyCode(asset.currency) : asset.currency;
                                   if (decodedCurrency === this.weWantCurrencyField && issuer === this.weWantIssuerField) {
                                        phnixBalance = parseFloat(asset.value).toFixed(8);
                                        break;
                                   }
                              }
                         }
                    }

                    this.phnixBalance = this.phnixBalance.replace(/,/g, '');
                    if (this.phnixBalance !== phnixBalance) {
                         this.phnixBalance = this.phnixBalance;
                    } else {
                         this.phnixBalance = phnixBalance;
                    }

                    if (parseFloat(phnixBalance) === 0) {
                         this.setError(`No PHNIX found for issuer ${this.weWantIssuerField}`);
                         return;
                    }

                    const encodedCurrency = this.weWantCurrencyField.length > 3 ? this.utilsService.encodeCurrencyCode(this.weWantCurrencyField) : this.weWantCurrencyField;
                    const weWant = { currency: 'XRP' };
                    const weSpend = {
                         currency: encodedCurrency,
                         issuer: this.weWantIssuerField,
                    };

                    console.log(`weWant ${JSON.stringify(weWant, null, 2)} weSpend ${JSON.stringify(weSpend, null, 2)}`);

                    // 1. Fetch Order Book Offers
                    const orderBook = await client.request({
                         command: 'book_offers',
                         ledger_index: 'validated',
                         taker_gets: weWant,
                         taker_pays: weSpend,
                         limit: 400, // Increased limit to capture more liquidity
                    });

                    // 2. Fetch AMM Pool (if available)
                    let ammPoolData = null;
                    try {
                         ammPoolData = await client.request({
                              command: 'amm_info',
                              asset: weSpend, // { currency: encodedCurrency, issuer: this.weWantIssuerField }
                              asset2: { currency: 'XRP' }, // XRP (no issuer)
                         });
                         console.log('AMM Pool Data:', ammPoolData);
                    } catch (ammError) {
                         console.warn('No AMM pool found for this pair:', ammError);
                    }

                    // Combine Order Book and AMM Liquidity
                    let allOffers = [...orderBook.result.offers];

                    if (ammPoolData?.result?.amm) {
                         const amm = ammPoolData.result.amm;

                         // Get the correct amounts from the AMM pool
                         // const asset1Amount = typeof amm.amount === 'object' && 'value' in amm.amount ? amm.amount.value : amm.amount; // First asset (PHNIX)
                         // const asset2Amount = typeof amm.amount2 === 'object' && 'value' in amm.amount2 ? amm.amount2.value : amm.amount2; // Second asset (XRP)

                         // Get the correct amounts from the AMM pool with proper type handling
                         const getAmountValue = (amount: any): string => {
                              if (typeof amount === 'object' && amount !== null && 'value' in amount) {
                                   return amount.value;
                              }
                              return String(amount);
                         };

                         const asset1Amount = getAmountValue(amm.amount);
                         let asset2Amount = getAmountValue(amm.amount2);

                         // Convert XRP from drops to XRP if needed
                         if (typeof amm.amount2 === 'object' && amm.amount2 !== null && 'currency' in amm.amount2) {
                              if (amm.amount2.currency === 'XRP') {
                                   asset2Amount = xrpl.dropsToXrp(asset2Amount).toString();
                              }
                         }

                         // Calculate the AMM rate
                         const ammRate = new BigNumber(asset2Amount).dividedBy(asset1Amount);

                         const ammOffer = {
                              TakerGets: { currency: 'XRP', value: asset2Amount },
                              TakerPays: {
                                   currency: encodedCurrency,
                                   issuer: this.weWantIssuerField,
                                   value: asset1Amount,
                              },
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

                    // Sort all offers by best rate (descending)
                    const sortedOffers = allOffers.sort((a, b) => {
                         const rateA = getOfferRate(a);
                         const rateB = getOfferRate(b);
                         return rateB.minus(rateA).toNumber();
                    });

                    const phnixAmount = new BigNumber(this.phnixBalance);
                    let remainingPhnix = phnixAmount;
                    let totalXrp = new BigNumber(0);

                    for (const offer of sortedOffers) {
                         const takerGets = getOfferXrpAmount(offer);
                         const takerPays = getOfferPhnixAmount(offer);

                         if (takerPays.isZero()) continue;

                         const rate = takerGets.dividedBy(takerPays);
                         const phnixToUse = BigNumber.minimum(remainingPhnix, takerPays);
                         let xrpReceived = phnixToUse.multipliedBy(rate);
                         xrpReceived = xrpReceived.dividedBy(1_000_000); // Convert to XRP

                         totalXrp = totalXrp.plus(xrpReceived.toFixed(12));
                         remainingPhnix = remainingPhnix.minus(phnixToUse);

                         console.log(`Used ${phnixToUse.toString()} PHNIX to get ${xrpReceived.toFixed(12)} XRP at rate ${rate.toFixed(8)} `);

                         if (remainingPhnix.isLessThanOrEqualTo(0)) break;
                    }

                    const usedAmount = phnixAmount.minus(remainingPhnix);
                    if (usedAmount.isZero()) {
                         this.phnixExchangeXrp = `No liquidity available`;
                         this.insufficientLiquidityWarning = true;
                    } else if (remainingPhnix.isGreaterThan(0)) {
                         this.phnixExchangeXrp = `Insufficient liquidity: Only ${usedAmount.toFixed(8)} PHNIX can be exchanged for ${totalXrp.toFixed(6)} XRP`;
                         this.insufficientLiquidityWarning = true;
                    } else {
                         this.phnixExchangeXrp = totalXrp.toFixed(12);
                         this.insufficientLiquidityWarning = false;
                    }

                    // Optional: Show average rate
                    if (usedAmount.isGreaterThan(0)) {
                         const avgRate = totalXrp.dividedBy(usedAmount);
                         console.log(`Average exchange rate: ${avgRate.toFixed(8)} XRP/PHNIX`);
                    }

                    // this.phnixBalance = Number(this.phnixBalance).toLocaleString();
                    this.phnixBalance = Number(this.phnixBalance).toLocaleString(undefined, {
                         minimumFractionDigits: 0,
                         maximumFractionDigits: 18, // enough to preserve precision
                         useGrouping: true,
                    });
               }
               this.cdr.detectChanges();
          } catch (error: any) {
               console.error('Error in updateTokenBalanceAndExchange:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
               this.phnixBalance = '0';
               this.phnixExchangeXrp = 'Error';
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving updateTokenBalanceAndExchange in ${this.executionTime}ms`);
          }

          function getOfferXrpAmount(offer: any): BigNumber {
               if (offer.taker_gets_funded) {
                    const amount = typeof offer.taker_gets_funded === 'string' ? offer.taker_gets_funded : offer.taker_gets_funded.value;
                    if (amount.includes('.')) {
                         return new BigNumber(amount);
                    } else {
                         return new BigNumber(xrpl.dropsToXrp(amount));
                    }
                    // return new BigNumber(xrpl.dropsToXrp(amount));
               }
               if (typeof offer.TakerGets === 'string') {
                    return new BigNumber(xrpl.dropsToXrp(offer.TakerGets));
               }
               return new BigNumber(offer.TakerGets.value);
          }

          function isFrozenAsset(obj: any): obj is { value: string } {
               return typeof obj === 'object' && obj !== null && 'value' in obj;
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

     async updateTokenBalanceAndExchange1() {
          console.log('Entering updateTokenBalanceAndExchange1');
          const startTime = Date.now();
          this.setSuccessProperties();

          if (!this.selectedAccount) {
               this.setError('Please select an account');
               this.phnixBalance = '0';
               this.phnixExchangeXrp = '0';
               return;
          }

          const address = this.selectedAccount === 'account1' ? this.account1.address : this.account2.address;

          if (!this.utilsService.validateInput(address)) {
               this.setError('ERROR: Account address cannot be empty');
               this.phnixBalance = '0';
               this.phnixExchangeXrp = '0';
               return;
          }

          try {
               this.spinner = true;
               this.showSpinnerWithDelay('Fetching Token balance and market data...', 2000);

               const client = await this.xrplService.getClient();
               const { net, environment } = this.xrplService.getNet();
               console.log(`Connected to ${environment} ${net}`);

               if (environment !== AppConstants.NETWORKS.MAINNET.NAME) {
                    console.warn('Not connected to Mainnet. Results may differ from XPMarket.');
               }

               // Fetch XRP balance
               const accountInfo = await client.request({
                    command: 'account_info',
                    account: address,
                    ledger_index: 'validated',
               });
               let xrpBalance = xrpl.dropsToXrp(accountInfo.result.account_data.Balance).toString();
               // this.xrpBalance = parseFloat(xrpBalance).toFixed(6);

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

               // 1. Fetch Order Book Offers
               const orderBook = await client.request({
                    command: 'book_offers',
                    ledger_index: 'validated',
                    taker_gets: weWant, // PHNIX (what you will receive)
                    taker_pays: weSpend, // XRP (what you will spend)
                    limit: 400,
               });
               // const orderBook = await client.request({
               //      command: 'book_offers',
               //      ledger_index: 'validated',
               //      taker_gets: weWant, // XRP
               //      taker_pays: weSpend, // PHNIX
               //      limit: 400,
               // });

               // 2. Fetch AMM Pool (if available)
               let ammPoolData = null;
               try {
                    ammPoolData = await client.request({
                         command: 'amm_info',
                         asset: { currency: 'XRP' }, // XRP (no issuer)
                         asset2: weWant, // PHNIX
                    });
                    console.log('AMM Pool Data:', ammPoolData);
               } catch (ammError) {
                    console.warn('No AMM pool found for this pair:', ammError);
               }

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
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving updateTokenBalanceAndExchange1 in ${this.executionTime}ms`);
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

          function isFrozenAsset(obj: any): obj is { value: string } {
               return typeof obj === 'object' && obj !== null && 'value' in obj;
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

     // async updateTokenBalanceAndExchange() {
     //      console.log('Entering updateTokenBalanceAndExchange');
     //      const startTime = Date.now();
     //      this.setSuccessProperties();

     //      if (!this.selectedAccount) {
     //           this.setError('Please select an account');
     //           this.phnixBalance = '0';
     //           this.phnixExchangeXrp = '0';
     //           return;
     //      }

     //      const address = this.selectedAccount === 'account1' ? this.account1.address : this.account2.address;

     //      if (!this.utilsService.validateInput(address)) {
     //           this.setError('ERROR: Account address cannot be empty');
     //           this.phnixBalance = '0';
     //           this.phnixExchangeXrp = '0';
     //           return;
     //      }

     //      try {
     //           this.spinner = true;
     //           this.showSpinnerWithDelay('Fetching Token balance and market data...', 2000);

     //           const client = await this.xrplService.getClient();
     //           const { net, environment } = this.xrplService.getNet();
     //           console.log(`Connected to ${environment} ${net}`);

     //           if (environment !== AppConstants.NETWORKS.MAINNET.NAME) {
     //                console.warn('Not connected to Mainnet. Results may differ from XPMarket.');
     //           }

     //           // Fetch Token balance
     //           const balanceResponse = await this.xrplService.getTokenBalance(client, address, 'validated', '');
     //           let phnixBalance = '0';

     //           if (balanceResponse.result.assets) {
     //                for (const [issuer, assets] of Object.entries(balanceResponse.result.assets)) {
     //                     for (const asset of assets as any[]) {
     //                          const decodedCurrency = asset.currency.length > 3 ? this.utilsService.decodeCurrencyCode(asset.currency) : asset.currency;
     //                          if (decodedCurrency === this.weWantCurrencyField && issuer === this.weWantIssuerField) {
     //                               phnixBalance = parseFloat(asset.value).toFixed(8);
     //                               break;
     //                          }
     //                     }
     //                }
     //           }

     //           this.phnixBalance = phnixBalance;
     //           if (parseFloat(phnixBalance) === 0) {
     //                this.setError(`No PHNIX found for issuer ${this.weWantIssuerField}`);
     //                return;
     //           }

     //           const encodedCurrency = this.weWantCurrencyField.length > 3 ? this.utilsService.encodeCurrencyCode(this.weWantCurrencyField) : this.weWantCurrencyField;
     //           const weWant = { currency: 'XRP' };
     //           const weSpend = {
     //                currency: encodedCurrency,
     //                issuer: this.weWantIssuerField,
     //           };

     //           const orderBook = await client.request({
     //                command: 'book_offers',
     //                ledger_index: 'validated',
     //                taker_gets: weWant,
     //                taker_pays: weSpend,
     //                limit: 300,
     //           });

     //           const offers = orderBook.result.offers;
     //           const phnixAmount = new BigNumber(this.phnixBalance);
     //           let remainingPhnix = phnixAmount;
     //           let totalXrp = new BigNumber(0);

     //           const sortedOffers = offers.sort((a, b) => {
     //                const rateA = getOfferRate(a);
     //                const rateB = getOfferRate(b);
     //                return rateB.minus(rateA).toNumber(); // descending
     //           });

     //           console.log(
     //                'All offers:',
     //                sortedOffers.map(o => ({
     //                     rate: getOfferRate(o).toNumber(),
     //                     pays: getOfferPhnixAmount(o).toString(),
     //                     gets: getOfferXrpAmount(o).toString(),
     //                }))
     //           );

     //           for (const offer of sortedOffers) {
     //                const takerGets = getOfferXrpAmount(offer);
     //                const takerPays = getOfferPhnixAmount(offer);

     //                if (takerPays.isZero()) continue;

     //                const rate = takerGets.dividedBy(takerPays);
     //                const phnixToUse = BigNumber.minimum(remainingPhnix, takerPays);
     //                const xrpReceived = phnixToUse.multipliedBy(rate);

     //                totalXrp = totalXrp.plus(xrpReceived);
     //                remainingPhnix = remainingPhnix.minus(phnixToUse);

     //                console.log(`Used ${phnixToUse.toString()} PHNIX to get ${xrpReceived.toString()} XRP at rate ${rate.toFixed(8)}`);

     //                if (remainingPhnix.isLessThanOrEqualTo(0)) break;
     //           }

     //           const usedAmount = phnixAmount.minus(remainingPhnix);
     //           if (usedAmount.isZero()) {
     //                this.phnixExchangeXrp = `No liquidity available`;
     //                this.insufficientLiquidityWarning = true;
     //           } else if (remainingPhnix.isGreaterThan(0)) {
     //                this.phnixExchangeXrp = `Insufficient liquidity: Only ${usedAmount.toFixed(8)} PHNIX can be exchanged for ${totalXrp.toFixed(6)} XRP`;
     //                this.insufficientLiquidityWarning = true;
     //           } else {
     //                this.phnixExchangeXrp = totalXrp.toFixed(8);
     //                this.insufficientLiquidityWarning = false;
     //           }

     //           // Optional: Show average rate
     //           if (usedAmount.isGreaterThan(0)) {
     //                const avgRate = totalXrp.dividedBy(usedAmount);
     //                console.log(`Average exchange rate: ${avgRate.toFixed(8)} XRP/PHNIX`);
     //           }

     //           this.cdr.detectChanges();
     //      } catch (error: any) {
     //           console.error('Error in updateTokenBalanceAndExchange:', error);
     //           this.setError(`ERROR: ${error.message || 'Unknown error'}`);
     //           this.phnixBalance = '0';
     //           this.phnixExchangeXrp = 'Error';
     //      } finally {
     //           this.spinner = false;
     //           this.executionTime = (Date.now() - startTime).toString();
     //           console.log(`Leaving updateTokenBalanceAndExchange in ${this.executionTime}ms`);
     //      }

     //      // === HELPERS ===
     //      function getOfferXrpAmount(offer: any): BigNumber {
     //           if (offer.taker_gets_funded) {
     //                return new BigNumber(xrpl.dropsToXrp(offer.taker_gets_funded));
     //           }
     //           if (typeof offer.TakerGets === 'string') {
     //                return new BigNumber(xrpl.dropsToXrp(offer.TakerGets));
     //           }
     //           return new BigNumber((offer.TakerGets as xrpl.IssuedCurrencyAmount).value);
     //      }

     //      function getOfferPhnixAmount(offer: any): BigNumber {
     //           if (offer.taker_pays_funded) {
     //                return new BigNumber(offer.taker_pays_funded.value);
     //           }
     //           if (typeof offer.TakerPays === 'string') {
     //                return new BigNumber(xrpl.dropsToXrp(offer.TakerPays));
     //           }
     //           return new BigNumber((offer.TakerPays as xrpl.IssuedCurrencyAmount).value);
     //      }

     //      function getOfferRate(offer: any): BigNumber {
     //           const takerGets = getOfferXrpAmount(offer);
     //           const takerPays = getOfferPhnixAmount(offer);
     //           return takerPays.isZero() ? new BigNumber(0) : takerGets.dividedBy(takerPays);
     //      }
     // }

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

     async getXrpBalance(address: string): Promise<string> {
          console.log('Entering getXrpBalance');
          const startTime = Date.now();

          try {
               const client = await this.xrplService.getClient();
               const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, address);
               this.ownerCount = ownerCount;
               this.totalXrpReserves = totalXrpReserves;
               const balance = (await client.getXrpBalance(address)) - parseFloat(this.totalXrpReserves || '0');
               return balance.toString();
          } catch (error: any) {
               console.error('Error fetching XRP balance:', error);
               throw error;
          } finally {
               this.spinner = false;
               this.cdr.detectChanges();
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getXrpBalance in ${this.executionTime}ms`);
          }
     }

     clearFields() {
          this.memoField = '';
          this.ticketSequence = '';
          this.isTicket = false;
          this.isMarketOrder = false;
          this.cdr.detectChanges();
     }

     clearMemeTokens() {
          // this.memeTokensSubject.next([]);
          this.dataSource.data = [];
     }

     async displayOfferDataForAccount1() {
          const account1name = this.storageService.getInputValue('account1name');
          const account1address = this.storageService.getInputValue('account1address');
          const account2address = this.storageService.getInputValue('account2address');
          const account1seed = this.storageService.getInputValue('account1seed');
          const account1mnemonic = this.storageService.getInputValue('account1mnemonic');
          const account1secretNumbers = this.storageService.getInputValue('account1secretNumbers');

          const memoField = document.getElementById('memoField') as HTMLInputElement | null;
          const weWantAmountField = document.getElementById('weWantAmountField') as HTMLInputElement | null;

          this.account1.name = account1name || '';
          this.account1.address = account1address || '';
          if (account1seed === '') {
               if (account1mnemonic === '') {
                    this.account1.seed = account1secretNumbers || '';
               } else {
                    this.account1.seed = account1mnemonic || '';
               }
          } else {
               this.account1.seed = account1seed || '';
          }

          this.weWantAmountField = '1';
          this.weSpendAmountField = '1';
          if (weWantAmountField && weWantAmountField.value !== 'XRP') {
               this.weWantIssuerField = account2address;
          } else {
               this.weSpendIssuerField = account2address;
          }

          if (memoField) {
               this.memoField = '';
          }

          await this.onWeWantCurrencyChange();
          await this.onWeSpendCurrencyChange();
          this.getOffers();
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
