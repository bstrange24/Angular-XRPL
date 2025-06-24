import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { WalletInputComponent } from '../wallet-input/wallet-input.component';
import { StorageService } from '../../services/storage.service';
import { CheckCreate, TransactionMetadataBase } from 'xrpl';
import * as xrpl from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Component({
     selector: 'app-create-offer',
     standalone: true,
     imports: [CommonModule, FormsModule, WalletInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './create-offer.component.html',
     styleUrl: './create-offer.component.css',
})
export class CreateOfferComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     // private weWantCurrencySubject = new Subject<string>();
     // private weSpendCurrencySubject = new Subject<string>();
     selectedAccount: 'account1' | 'account2' | null = null;
     private lastResult: string = AppConstants.EMPTY_STRING;
     private intervalId: any;
     transactionInput = AppConstants.EMPTY_STRING;
     result: string = AppConstants.EMPTY_STRING;
     currencyFieldDropDownValue: string = 'XRP';
     checkExpirationTime: string = 'seconds';

     weSpendCurrencyField: string = 'XRP';
     offerSequenceField: string = AppConstants.EMPTY_STRING;
     weWantCurrencyField: string = 'DOG';
     weWantIssuerField: string = AppConstants.EMPTY_STRING;
     weWantAmountField: string = AppConstants.EMPTY_STRING;
     weWantTokenBalanceField: string = AppConstants.EMPTY_STRING;
     weSpendIssuerField: string = AppConstants.EMPTY_STRING;
     weSpendAmountField: string = AppConstants.EMPTY_STRING;
     weSpendTokenBalanceField: string = AppConstants.EMPTY_STRING;

     isMarketOrder: boolean = false;
     ticketCountField = AppConstants.EMPTY_STRING;
     expirationTimeField = AppConstants.EMPTY_STRING;
     account1 = { name: AppConstants.EMPTY_STRING, address: AppConstants.EMPTY_STRING, seed: AppConstants.EMPTY_STRING, secretNumbers: AppConstants.EMPTY_STRING, mnemonic: AppConstants.EMPTY_STRING, balance: AppConstants.EMPTY_STRING };
     account2 = { name: AppConstants.EMPTY_STRING, address: AppConstants.EMPTY_STRING, seed: AppConstants.EMPTY_STRING, secretNumbers: AppConstants.EMPTY_STRING, mnemonic: AppConstants.EMPTY_STRING, balance: AppConstants.EMPTY_STRING };
     xrpBalance1Field = AppConstants.EMPTY_STRING;
     ownerCount = AppConstants.EMPTY_STRING;
     totalXrpReserves = AppConstants.EMPTY_STRING;
     executionTime = AppConstants.EMPTY_STRING;
     amountField = AppConstants.EMPTY_STRING;
     currentTimeField = AppConstants.EMPTY_STRING;
     memoField = AppConstants.EMPTY_STRING;
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = true;
     spinner = false;
     issuers: string[] = [];
     selectedIssuer: string = AppConstants.EMPTY_STRING;
     tokenBalance: string = AppConstants.EMPTY_STRING;

     constructor(private xrplService: XrplService, private utilsService: UtilsService, private cdr: ChangeDetectorRef, private storageService: StorageService) {}

     async ngOnInit(): Promise<void> {
          console.log('DOM fully loaded at', new Date().toISOString());
     }

     ngAfterViewChecked() {
          if (this.result !== this.lastResult && this.resultField?.nativeElement) {
               this.utilsService.attachSearchListener(this.resultField.nativeElement);
               this.lastResult = this.result;
               this.cdr.detectChanges();
          }
     }

     onWalletInputChange(event: { account1: any; account2: any }) {
          this.account1 = event.account1;
          this.account2 = event.account2;
     }

     handleTransactionResult(event: { result: string; isError: boolean; isSuccess: boolean }) {
          this.result = event.result;
          this.isError = event.isError;
          this.isSuccess = event.isSuccess;
          if (this.isSuccess) {
               this.isEditable = false;
          }
     }

     onAccountChange() {
          if (this.selectedAccount === 'account1') {
               this.displayOfferDataForAccount1();
          }
     }

     ngOnDestroy(): void {
          if (this.intervalId) {
               clearInterval(this.intervalId);
          }
     }

     async getOffers() {
          console.log('Entering getOffers');
          const startTime = Date.now();
          this.spinner = true;
          this.isError = false;
          this.isSuccess = false;
          this.result = AppConstants.EMPTY_STRING;
          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }
          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
          if (!this.utilsService.validatInput(seed)) {
               return this.setError('ERROR: Account seed cannot be empty');
          }
          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               let wallet;
               if (seed.split(' ').length > 1) {
                    wallet = xrpl.Wallet.fromMnemonic(seed, {
                         algorithm: environment === AppConstants.NETWORKS.MAINNET.NAME ? AppConstants.ENCRYPTION.ED25519 : AppConstants.ENCRYPTION.SECP256K1,
                    });
               } else {
                    wallet = xrpl.Wallet.fromSeed(seed, {
                         algorithm: environment === AppConstants.NETWORKS.MAINNET.NAME ? AppConstants.ENCRYPTION.ED25519 : AppConstants.ENCRYPTION.SECP256K1,
                    });
               }

               // Fetch offers
               const offersResponse = await client.request({
                    command: 'account_offers',
                    account: wallet.address,
                    ledger_index: 'validated',
               });

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

               const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, wallet.classicAddress);
               this.ownerCount = ownerCount;
               this.totalXrpReserves = totalXrpReserves;
               const balance = (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0');

               if (this.selectedAccount === 'account1') {
                    this.account1.balance = balance.toString();
               } else {
                    this.account2.balance = balance.toString();
               }
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
          this.spinner = true;
          this.isError = false;
          this.isSuccess = false;
          this.result = AppConstants.EMPTY_STRING;
          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }
          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
          if (!this.utilsService.validatInput(seed)) {
               return this.setError('ERROR: Account seed cannot be empty');
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

          type CurrencyObject = CurrencyObjectXRP | CurrencyObjectToken;

          const buildCurrencyObject = (currency: string, issuer: string, value: string): CurrencyObject => (currency === AppConstants.XRP_CURRENCY ? { currency, value } : { currency, issuer, value });

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();

               let wallet;
               if (seed.split(' ').length > 1) {
                    wallet = xrpl.Wallet.fromMnemonic(seed, {
                         algorithm: environment === AppConstants.NETWORKS.MAINNET.NAME ? AppConstants.ENCRYPTION.ED25519 : AppConstants.ENCRYPTION.SECP256K1,
                    });
               } else {
                    wallet = xrpl.Wallet.fromSeed(seed, {
                         algorithm: environment === AppConstants.NETWORKS.MAINNET.NAME ? AppConstants.ENCRYPTION.ED25519 : AppConstants.ENCRYPTION.SECP256K1,
                    });
               }

               // Prepare currency objects
               let we_want;
               let we_spend;
               if (this.weWantCurrencyField.length <= 3 && this.weSpendCurrencyField.length <= 3) {
                    we_want = buildCurrencyObject(this.weWantCurrencyField, this.weWantIssuerField, this.weWantAmountField);
                    we_spend = buildCurrencyObject(this.weSpendCurrencyField, this.weSpendIssuerField, this.weSpendAmountField);
               } else if (this.weWantCurrencyField.length > 3) {
                    const encodedCurrencyCode = this.utilsService.encodeCurrencyCode(this.weWantCurrencyField);
                    we_want = buildCurrencyObject(encodedCurrencyCode, this.weWantIssuerField, this.weWantAmountField);
                    we_spend = buildCurrencyObject(this.weSpendCurrencyField, this.weSpendIssuerField, this.weSpendAmountField);
               } else if (this.weSpendCurrencyField.length > 3) {
                    const encodedCurrencyCode = this.utilsService.encodeCurrencyCode(this.weSpendCurrencyField);
                    we_spend = buildCurrencyObject(encodedCurrencyCode, this.weSpendIssuerField, this.weSpendAmountField);
                    we_want = buildCurrencyObject(this.weWantCurrencyField, this.weWantIssuerField, this.weWantAmountField);
               }

               // Decode currencies for display
               const displayWeWantCurrency = we_want && we_want.currency && we_want.currency.length > 3 ? this.utilsService.decodeCurrencyCode(we_want.currency) : we_want?.currency ?? '';
               const displayWeSpendCurrency = we_spend && we_spend.currency && we_spend.currency.length > 3 ? this.utilsService.decodeCurrencyCode(we_spend.currency) : we_spend?.currency ?? '';

               console.log('we_want:', we_want);
               console.log('we_spend:', we_spend);

               // Determine offer type
               if (!we_spend) {
                    this.setError('ERROR: Unable to determine offer type because "we_spend" is undefined.');
                    return;
               }
               const offerType = we_spend.currency === AppConstants.XRP_CURRENCY ? 'buy' : 'sell';
               console.log(`Offer Type: ${offerType}`);

               // Prepare data for rendering
               const data = {
                    sections: [{}],
               };

               // Fetch order book
               let orderBook, buySideOrderBook, sellSideOrderBook, spread, liquidity;
               if (offerType === 'sell') {
                    if (!we_want) {
                         this.setError('ERROR: "we_want" is undefined.');
                         return;
                    }
                    console.log(`SELLING ${we_spend.currency} BUYING ${we_want.currency}`);
                    orderBook = await client.request({
                         command: 'book_offers',
                         taker: wallet.address,
                         ledger_index: 'current',
                         taker_gets: we_want,
                         taker_pays: we_spend,
                    });
                    buySideOrderBook = await client.request({
                         command: 'book_offers',
                         taker: wallet.address,
                         ledger_index: 'current',
                         taker_gets: we_spend,
                         taker_pays: we_want,
                    });
                    spread = this.computeBidAskSpread(buySideOrderBook.result.offers, orderBook.result.offers);
                    liquidity = this.computeLiquidityRatio(buySideOrderBook.result.offers, orderBook.result.offers, false);
               } else {
                    if (!we_want) {
                         this.setError('ERROR: "we_want" is undefined.');
                         return;
                    }
                    console.log(`BUYING ${we_want.currency} SELLING ${we_spend.currency}`);
                    orderBook = await client.request({
                         command: 'book_offers',
                         taker: wallet.address,
                         ledger_index: 'current',
                         taker_gets: we_want,
                         taker_pays: we_spend,
                    });
                    sellSideOrderBook = await client.request({
                         command: 'book_offers',
                         taker: wallet.address,
                         ledger_index: 'current',
                         taker_gets: we_spend,
                         taker_pays: we_want,
                    });
                    spread = this.computeBidAskSpread(orderBook.result.offers, sellSideOrderBook.result.offers);
                    liquidity = this.computeLiquidityRatio(orderBook.result.offers, sellSideOrderBook.result.offers);
               }

               // Order Book section
               if (orderBook.result.offers.length <= 0) {
                    data.sections.push({
                         title: 'Order Book',
                         openByDefault: true,
                         content: [
                              {
                                   key: 'Status',
                                   value: `No orders in the order book for ${displayWeSpendCurrency}/${displayWeWantCurrency}`,
                              },
                         ],
                    });
               } else {
                    data.sections.push({
                         title: `Order Book (${orderBook.result.offers.length})`,
                         openByDefault: true,
                         subItems: orderBook.result.offers.map((offer, index) => {
                              const takerGets = typeof offer.TakerGets === 'string' ? `${offer.TakerGets} DROPS` : `${offer.TakerGets.value} ${offer.TakerGets.currency}${offer.TakerGets.issuer ? ` (Issuer: ${offer.TakerGets.issuer})` : ''}`;
                              const takerPays = typeof offer.TakerPays === 'string' ? `${offer.TakerPays} DROPS` : `${offer.TakerPays.value} ${offer.TakerPays.currency}${offer.TakerPays.issuer ? ` (Issuer: ${offer.TakerPays.issuer})` : ''}`;
                              return {
                                   key: `Order ${index + 1} (Sequence: ${offer.Sequence})`,
                                   openByDefault: false,
                                   content: [{ key: 'Sequence', value: String(offer.Sequence) }, { key: 'Taker Gets', value: takerGets }, { key: 'Taker Pays', value: takerPays }, ...(offer.Expiration ? [{ key: 'Expiration', value: new Date(offer.Expiration * 1000).toISOString() }] : []), ...(offer.Flags ? [{ key: 'Flags', value: String(offer.Flags) }] : []), { key: 'Account', value: `<code>${offer.Account}</code>` }],
                              };
                         }),
                    });
               }

               // Statistics section
               if (orderBook.result.offers.length > 0) {
                    const stats = this.computeAverageExchangeRateBothWays(orderBook.result.offers, 15);
                    this.populateStatsFields(stats, we_want, we_spend, spread, liquidity, offerType);

                    const pair = `${displayWeWantCurrency}/${displayWeSpendCurrency}`;
                    const reversePair = `${displayWeSpendCurrency}/${displayWeWantCurrency}`;
                    data.sections.push({
                         title: 'Statistics',
                         openByDefault: true,
                         content: [
                              { key: 'VWAP', value: `${stats.forward.vwap.toFixed(8)} ${pair}` },
                              { key: 'Simple Average', value: `${stats.forward.simpleAvg.toFixed(8)} ${pair}` },
                              { key: 'Best Rate', value: `${stats.forward.bestRate.toFixed(8)} ${pair}` },
                              { key: 'Worst Rate', value: `${stats.forward.worstRate.toFixed(8)} ${pair}` },
                              {
                                   key: 'Depth (5% slippage)',
                                   value: `${stats.forward.depthDOG.toFixed(2)} ${displayWeWantCurrency} for ${stats.forward.depthXRP.toFixed(2)} ${displayWeSpendCurrency}`,
                              },
                              {
                                   key: `Execution (15 ${displayWeSpendCurrency})`,
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
                         ],
                    });
               }

               this.utilsService.renderPaymentChannelDetails(data);

               const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, wallet.classicAddress);
               this.ownerCount = ownerCount;
               this.totalXrpReserves = totalXrpReserves;
               const balance = (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0');

               if (this.selectedAccount === 'account1') {
                    this.account1.balance = balance.toString();
               } else {
                    this.account2.balance = balance.toString();
               }
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
     }

     // async createOffer() {
     //      console.log('Entering createOffer');
     //      const startTime = Date.now();
     //      this.spinner = true;
     //      this.isError = false;
     //      this.isSuccess = false;
     //      this.result = AppConstants.EMPTY_STRING;
     //      if (!this.selectedAccount) {
     //           return this.setError('Please select an account');
     //      }
     //      const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
     //      if (!this.utilsService.validatInput(seed)) {
     //           return this.setError('ERROR: Account seed cannot be empty');
     //      }

     //      interface CurrencyObjectXRP {
     //           currency: string;
     //           value: string;
     //      }

     //      interface CurrencyObjectToken {
     //           currency: string;
     //           issuer: string;
     //           value: string;
     //      }

     //      type CurrencyObject = CurrencyObjectXRP | CurrencyObjectToken;

     //      // const buildCurrencyObject = (currency: string, issuer: string, value: string): CurrencyObject => (currency === AppConstants.XRP_CURRENCY ? { currency, value } : { currency, issuer, value });

     //      // Prepare data for rendering
     //      const data = {
     //           sections: [],
     //      };

     //      // Trust line setup
     //      let trustSetResult = null;
     //      const doesTrustLinesExists = await getTrustLines(wallet.address, client);
     //      if (doesTrustLinesExists.length <= 0) {
     //           let issuerAddr, issuerCur;
     //           if (weWantIssuerField.value === AppConstants.XRP_CURRENCY || weWantIssuerField.value === '') {
     //                issuerAddr = weSpendIssuerField.value;
     //                issuerCur = weSpendCurrencyField.value;
     //           } else {
     //                issuerAddr = weWantIssuerField.value;
     //                issuerCur = weWantCurrencyField.value;
     //           }

     //           const current_ledger = await getCurrentLedger(client);
     //           const trustSetTx = {
     //                TransactionType: 'TrustSet',
     //                Account: wallet.address,
     //                LimitAmount: {
     //                     currency: issuerCur,
     //                     issuer: issuerAddr,
     //                     value: '1000000',
     //                },
     //                LastLedgerSequence: current_ledger + 50,
     //           };

     //           const ts_prepared = await client.autofill(trustSetTx);
     //           const ts_signed = wallet.sign(ts_prepared);
     //           trustSetResult = await client.submitAndWait(ts_signed.tx_blob);

     //           if (trustSetResult.result.meta.TransactionResult !== TES_SUCCESS) {
     //                throw new Error(`Unable to create trustLine from ${wallet.address} to ${issuerAddr}\nTransaction failed: ${trustSetResult.result.meta.TransactionResult}`);
     //           }
     //           data.sections.push({
     //                title: 'Trust Line Setup',
     //                openByDefault: true,
     //                content: [
     //                     { key: 'Status', value: 'Trust line created' },
     //                     { key: 'Currency', value: issuerCur },
     //                     { key: 'Issuer', value: `<code>${issuerAddr}</code>` },
     //                     { key: 'Limit', value: '1000000' },
     //                ],
     //           });
     //      } else {
     //           data.sections.push({
     //                title: 'Trust Line Setup',
     //                openByDefault: true,
     //                content: [{ key: 'Status', value: 'Trust lines already exist' }],
     //           });
     //      }

     //      // Initial balances
     //      const initialXrpBalance = await client.getXrpBalance(wallet.address);
     //      console.log(`Initial XRP Balance ${initialXrpBalance} (drops): ${xrpl.xrpToDrops(initialXrpBalance)}`);
     //      const tokenBalance = weSpendCurrencyField.value === AppConstants.XRP_CURRENCY ? weWantCurrencyField.value : weSpendCurrencyField.value;
     //      const initialTokenBalance = await getOnlyTokenBalance(client, wallet.address, tokenBalance);
     //      console.log(`Initial ${tokenBalance} Balance: ${initialTokenBalance}`);
     //      data.sections.push({
     //           title: 'Initial Balances',
     //           openByDefault: true,
     //           content: [
     //                { key: 'XRP', value: `${initialXrpBalance} (${xrpl.xrpToDrops(initialXrpBalance)} drops)` },
     //                { key: tokenBalance, value: initialTokenBalance },
     //           ],
     //      });

     //      // Build currency objects
     //      let we_want = weWantCurrencyField.value === AppConstants.XRP_CURRENCY ? { currency: AppConstants.XRP_CURRENCY, value: weWantAmountField.value } : { currency: weWantCurrencyField.value, issuer: weWantIssuerField.value, value: weWantAmountField.value };
     //      let we_spend = weSpendCurrencyField.value === AppConstants.XRP_CURRENCY ? { amount: weSpendAmountField.value } : { currency: weSpendCurrencyField.value, issuer: weSpendIssuerField.value, value: weSpendAmountField.value };

     //      // Validate balances
     //      if (weSpendCurrencyField.value === AppConstants.XRP_CURRENCY && xrpl.xrpToDrops(initialXrpBalance) < Number(weSpendAmountField.value)) {
     //           throw new Error('Insufficient XRP balance');
     //      } else if (weSpendCurrencyField.value !== AppConstants.XRP_CURRENCY && initialTokenBalance < weSpendAmountField.value) {
     //           throw new Error(`Insufficient ${weSpendCurrencyField.value} balance`);
     //      }

     //      if (we_want.currency.length > 3) {
     //           we_want.currency = encodeCurrencyCode(we_want.currency);
     //      }
     //      if (we_spend.currency && we_spend.currency.length > 3) {
     //           we_spend.currency = encodeCurrencyCode(we_spend.currency);
     //      }

     //      const offerType = we_spend.currency ? 'sell' : 'buy';
     //      console.log(`Type: ${weWantCurrencyField.valueOf}`);

     //      // Rate analysis
     //      const xrpReserve = await getXrpReserveRequirements(client, wallet.address);
     //      const proposedQuality = new BigNumber(weSpendAmountField.value).dividedBy(weWantAmountField.value);
     //      const effectiveRate = calculateEffectiveRate(proposedQuality, xrpReserve, offerType);
     //      const rateAnalysis = [
     //           {
     //                key: 'Proposed Rate',
     //                value: `1 ${we_want.currency} = ${proposedQuality.toFixed(8)} ${we_spend.currency || AppConstants.XRP_CURRENCY}`,
     //           },
     //           {
     //                key: 'Effective Rate',
     //                value: `1 ${we_want.currency} = ${effectiveRate.toFixed(8)} ${we_spend.currency || AppConstants.XRP_CURRENCY}`,
     //           },
     //      ];
     //      if (effectiveRate.gt(proposedQuality)) {
     //           rateAnalysis.push({
     //                key: 'Note',
     //                value: 'Effective rate is worse than proposed due to XRP reserve requirements',
     //           });
     //      }
     //      data.sections.push({
     //           title: 'Rate Analysis',
     //           openByDefault: true,
     //           content: rateAnalysis,
     //      });

     //      // Market analysis
     //      const MAX_SLIPPAGE = 0.05;
     //      const orderBook = await client.request({
     //           method: 'book_offers',
     //           taker: wallet.address,
     //           ledger_index: 'current',
     //           taker_gets: we_want,
     //           taker_pays: we_spend.currency ? we_spend : { currency: AppConstants.XRP_CURRENCY, value: weSpendAmountField.value },
     //      });
     //      const oppositeOrderBook = await client.request({
     //           method: 'book_offers',
     //           taker: wallet.address,
     //           ledger_index: 'current',
     //           taker_gets: we_spend.currency ? we_spend : { currency: AppConstants.XRP_CURRENCY, value: weSpendAmountField.value },
     //           taker_pays: we_want,
     //      });

     //      const offers = orderBook.result.offers;
     //      let runningTotal = new BigNumber(0);
     //      const wantAmount = new BigNumber(weWantAmountField.value);
     //      let bestOfferQuality = null;
     //      let marketAnalysis = [];
     //      if (offers.length > 0) {
     //           for (const o of offers) {
     //                const offerQuality = new BigNumber(o.quality);
     //                if (!bestOfferQuality || offerQuality.lt(bestOfferQuality)) {
     //                     bestOfferQuality = offerQuality;
     //                }
     //                if (offerQuality.lte(proposedQuality.times(1 + MAX_SLIPPAGE))) {
     //                     const slippage = proposedQuality.minus(offerQuality).dividedBy(offerQuality);
     //                     marketAnalysis = [
     //                          {
     //                               key: 'Best Rate',
     //                               value: `1 ${we_want.currency} = ${bestOfferQuality?.toFixed(6) || '0'} ${we_spend.currency || AppConstants.XRP_CURRENCY}`,
     //                          },
     //                          {
     //                               key: 'Proposed Rate',
     //                               value: `1 ${we_want.currency} = ${proposedQuality.toFixed(6)} ${we_spend.currency || AppConstants.XRP_CURRENCY}`,
     //                          },
     //                          { key: 'Slippage', value: `${slippage.times(100).toFixed(2)}%` },
     //                     ];
     //                     if (slippage.gt(MAX_SLIPPAGE)) {
     //                          marketAnalysis.push({
     //                               key: 'Warning',
     //                               value: `Slippage ${slippage.times(100).toFixed(2)}% exceeds ${MAX_SLIPPAGE * 100}%`,
     //                          });
     //                     }
     //                     runningTotal = runningTotal.plus(new BigNumber(o.owner_funds || o.TakerGets.value));
     //                     if (runningTotal.gte(wantAmount)) break;
     //                }
     //           }
     //      }

     //      if (runningTotal.eq(0)) {
     //           const orderBook2 = await client.request({
     //                method: 'book_offers',
     //                taker: wallet.address,
     //                ledger_index: 'current',
     //                taker_gets: we_spend.currency ? we_spend : { currency: AppConstants.XRP_CURRENCY, value: weSpendAmountField.value },
     //                taker_pays: we_want,
     //           });
     //           const offeredQuality = new BigNumber(weWantAmountField.value).dividedBy(weSpendAmountField.value);
     //           const offers2 = orderBook2.result.offers;
     //           let runningTotal2 = new BigNumber(0);
     //           let tallyCurrency = we_spend.currency || AppConstants.XRP_CURRENCY;
     //           if (tallyCurrency === AppConstants.XRP_CURRENCY) {
     //                tallyCurrency = 'drops of XRP';
     //           }
     //           if (offers2.length > 0) {
     //                for (const o of offers2) {
     //                     if (o.quality <= effectiveRate.toNumber()) {
     //                          const bestOfferQuality2 = new BigNumber(o.quality);
     //                          const slippage = proposedQuality.minus(bestOfferQuality2).dividedBy(bestOfferQuality2);
     //                          marketAnalysis = [
     //                               {
     //                                    key: 'Best Rate',
     //                                    value: `1 ${we_spend.currency || AppConstants.XRP_CURRENCY} = ${bestOfferQuality2.toFixed(6)} ${we_want.currency}`,
     //                               },
     //                               {
     //                                    key: 'Proposed Rate',
     //                                    value: `1 ${we_spend.currency || AppConstants.XRP_CURRENCY} = ${proposedQuality.toFixed(6)} ${we_want.currency}`,
     //                               },
     //                               { key: 'Slippage', value: `${slippage.times(100).toFixed(2)}%` },
     //                          ];
     //                          if (slippage.gt(MAX_SLIPPAGE)) {
     //                               marketAnalysis.push({
     //                                    key: 'Warning',
     //                                    value: `Slippage ${slippage.times(100).toFixed(2)}% exceeds ${MAX_SLIPPAGE * 100}%`,
     //                               });
     //                          }
     //                          runningTotal2 = runningTotal2.plus(new BigNumber(o.owner_funds));
     //                     } else {
     //                          break;
     //                     }
     //                }
     //                if (runningTotal2.gt(0)) {
     //                     marketAnalysis.push({
     //                          key: 'Order Book Position',
     //                          value: `Offer placed below at least ${runningTotal2.toFixed(2)} ${tallyCurrency}`,
     //                     });
     //                }
     //           }
     //           if (!offers2.length) {
     //                marketAnalysis.push({
     //                     key: 'Order Book Position',
     //                     value: 'No similar offers; this would be the first',
     //                });
     //           }
     //      }
     //      data.sections.push({
     //           title: 'Market Analysis',
     //           openByDefault: true,
     //           content: marketAnalysis.length ? marketAnalysis : [{ key: 'Status', value: 'No matching offers found in order book' }],
     //      });

     //      // Submit OfferCreate transaction
     //      let prepared;
     //      if (we_spend.currency) {
     //           prepared = await client.autofill({
     //                TransactionType: 'OfferCreate',
     //                Account: wallet.address,
     //                TakerGets: we_spend,
     //                TakerPays: we_want.value,
     //                Flags: isMarketOrder ? xrpl.OfferCreateFlags.tfImmediateOrCancel : 0,
     //           });
     //      } else {
     //           prepared = await client.autofill({
     //                TransactionType: 'OfferCreate',
     //                Account: wallet.address,
     //                TakerGets: we_spend.amount,
     //                TakerPays: we_want,
     //                Flags: isMarketOrder ? xrpl.OfferCreateFlags.tfImmediateOrCancel : 0,
     //           });
     //      }

     //      const signed = wallet.sign(prepared);
     //      const tx = await client.submitAndWait(signed.tx_blob);

     //      // Transaction result
     //      if (tx.result.meta.TransactionResult !== TES_SUCCESS) {
     //           data.sections.push({
     //                title: 'Transaction Details',
     //                openByDefault: true,
     //                content: [
     //                     { key: 'Status', value: `Transaction failed: ${tx.result.meta.TransactionResult}` },
     //                     { key: 'Details', value: parseXRPLTransaction(tx.result) },
     //                ],
     //           });
     //           throw new Error(`Transaction failed: ${tx.result.meta.TransactionResult}`);
     //      }

     //      // Transaction Details sections
     //      const transactionSections = buildTransactionSections(tx);
     //      data.sections.push(...Object.values(transactionSections));

     //      // Balance changes
     //      const balanceChanges = xrpl.getBalanceChanges(tx.result.meta);
     //      data.sections.push({
     //           title: 'Balance Changes',
     //           openByDefault: true,
     //           content: balanceChanges.length
     //                ? balanceChanges.map((change, index) => ({
     //                       key: `Change ${index + 1}`,
     //                       value: `${change.balance} ${change.currency}${change.issuer ? ` (Issuer: <code>${change.issuer}</code>)` : ''} for <code>${change.account}</code>`,
     //                  }))
     //                : [{ key: 'Status', value: 'No balance changes recorded' }],
     //      });

     //      // Affected offers
     //      let offersAffected = 0;
     //      for (const node of tx.result.meta.AffectedNodes) {
     //           if (node.ModifiedNode?.LedgerEntryType === 'Offer' || node.DeletedNode?.LedgerEntryType === 'Offer') {
     //                offersAffected += 1;
     //           } else if (node.CreatedNode?.LedgerEntryType === 'Offer') {
     //                const offer = node.CreatedNode.NewFields;
     //                data.sections.push({
     //                     title: 'Created Offer',
     //                     openByDefault: true,
     //                     content: [
     //                          { key: 'Owner', value: `<code>${offer.Account}</code>` },
     //                          { key: 'TakerGets', value: amt_str(offer.TakerGets) },
     //                          { key: 'TakerPays', value: amt_str(offer.TakerPays) },
     //                     ],
     //                });
     //           } else if (node.CreatedNode?.LedgerEntryType === 'RippleState') {
     //                data.sections[0].content.push({ key: 'Additional Note', value: 'Created a trust line' });
     //           }
     //      }
     //      if (offersAffected > 0) {
     //           data.sections.push({
     //                title: 'Affected Offers',
     //                openByDefault: true,
     //                content: [{ key: 'Count', value: `Modified or removed ${offersAffected} matching offer(s)` }],
     //           });
     //      }

     //      // Updated balances
     //      const finalXrpBalance = await client.getXrpBalance(wallet.address);
     //      const updatedTokenBalance = await getOnlyTokenBalance(client, wallet.address, tokenBalance);
     //      data.sections.push({
     //           title: 'Updated Balances',
     //           openByDefault: true,
     //           content: [
     //                { key: 'XRP', value: finalXrpBalance },
     //                { key: tokenBalance, value: updatedTokenBalance },
     //           ],
     //      });

     //      // Update token balance fields
     //      if (weWantCurrencyField.value === AppConstants.XRP_CURRENCY) {
     //           document.getElementById('weWantTokenBalanceField').value = finalXrpBalance;
     //           document.getElementById('weSpendTokenBalanceField').value = updatedTokenBalance;
     //      } else {
     //           document.getElementById('weWantTokenBalanceField').value = updatedTokenBalance;
     //           document.getElementById('weSpendTokenBalanceField').value = finalXrpBalance;
     //      }

     //      // Outstanding offers
     //      const acctOffers = await client.request({
     //           command: 'account_offers',
     //           account: wallet.address,
     //           ledger_index: 'validated',
     //      });
     //      if (acctOffers.result.offers.length > 0) {
     //           data.sections.push({
     //                title: `Outstanding Offers (${acctOffers.result.offers.length})`,
     //                openByDefault: false,
     //                subItems: acctOffers.result.offers.map((offer, index) => ({
     //                     key: `Offer ${index + 1}`,
     //                     openByDefault: false,
     //                     content: [{ key: 'Sequence', value: offer.seq }, { key: 'TakerGets', value: amt_str(offer.taker_gets) }, { key: 'TakerPays', value: amt_str(offer.taker_pays) }, ...(offer.expiration ? [{ key: 'Expiration', value: new Date(offer.expiration * 1000).toISOString() }] : [])],
     //                })),
     //           });
     //      }

     //      // Account Details
     //      // data.sections.push({
     //      //      title: 'Account Details',
     //      //      openByDefault: true,
     //      //      content: [
     //      //           { key: 'Name', value: accountNameField.value },
     //      //           { key: 'Address', value: `<code>${wallet.address}</code>` },
     //      //           { key: 'Final XRP Balance', value: finalXrpBalance },
     //      //      ],
     //      // });

     //      // Server Info
     //      // data.sections.push({
     //      //      title: 'Server Info',
     //      //      openByDefault: false,
     //      //      content: [{ key: 'Environment', value: environment }, { key: 'Network', value: net }, { key: 'Server Version', value: serverVersion }, ...(parseFloat(serverVersion) < 1.9 ? [{ key: 'Warning', value: 'Server version may not fully support offer creation (requires rippled 1.9.0 or higher)' }] : [])],
     //      // });

     //      // Render data
     //      renderCreateOfferDetails(data);
     // }

     async cancelOffer() {
          console.log('Entering cancelOffer');
          const startTime = Date.now();
     }

     async getTokenBalance() {
          console.log('Entering getTokenBalance');
          const startTime = Date.now();
          this.spinner = true;
          this.isError = false;
          this.isSuccess = false;
          this.result = AppConstants.EMPTY_STRING;
          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }
          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
          if (!this.utilsService.validatInput(seed)) {
               return this.setError('ERROR: Account seed cannot be empty');
          }
          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               let wallet;
               if (seed.split(' ').length > 1) {
                    wallet = xrpl.Wallet.fromMnemonic(seed, {
                         algorithm: environment === AppConstants.NETWORKS.MAINNET.NAME ? AppConstants.ENCRYPTION.ED25519 : AppConstants.ENCRYPTION.SECP256K1,
                    });
               } else {
                    wallet = xrpl.Wallet.fromSeed(seed, {
                         algorithm: environment === AppConstants.NETWORKS.MAINNET.NAME ? AppConstants.ENCRYPTION.ED25519 : AppConstants.ENCRYPTION.SECP256K1,
                    });
               }

               // Fetch token balances
               const balance = await client.request({
                    command: 'gateway_balances',
                    account: wallet.classicAddress,
                    ledger_index: 'validated',
               });

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
               } else {
                    data.sections.push({
                         title: 'Obligations',
                         openByDefault: true,
                         content: [{ key: 'Status', value: 'No obligations (tokens issued by you)' }],
                    });
               }

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
               } else {
                    data.sections.push({
                         title: 'Balances',
                         openByDefault: true,
                         content: [{ key: 'Status', value: 'No balances (tokens held by you)' }],
                    });
               }

               this.utilsService.renderPaymentChannelDetails(data);

               this.isSuccess = true;
               this.handleTransactionResult({
                    result: this.result,
                    isError: this.isError,
                    isSuccess: this.isSuccess,
               });

               const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, wallet.classicAddress);
               this.ownerCount = ownerCount;
               this.totalXrpReserves = totalXrpReserves;
               const xrpBalance = (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0');

               if (this.selectedAccount === 'account1') {
                    this.account1.balance = xrpBalance.toString();
               } else {
                    this.account2.balance = xrpBalance.toString();
               }
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getOffers in ${this.executionTime}ms`);
          }
     }

     invertOrder() {
          console.log('Entering invertOrder');

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
               this.weWantTokenBalanceField = weSpendTokenBalanceElem.value;

               this.weSpendCurrencyField = weWantCurrencyFieldTemp;
               this.weSpendIssuerField = weWantIssuerFieldTemp;
               this.weSpendAmountField = weWantAmountFieldTemp;
               this.weSpendTokenBalanceField = weWantTokenBalanceTemp;
          }
          this.getOrderBook();
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

     async onWeWantCurrencyChange() {
          if (!this.selectedAccount) {
               this.setError('Please select an account');
               this.weWantTokenBalanceField = '0';
               return;
          }
          const address = this.selectedAccount === 'account1' ? this.account1.address : this.account2.address;
          if (!this.utilsService.validatInput(address)) {
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
          } catch (error: any) {
               console.error('Error fetching weWant balance:', error);
               this.setError(`ERROR: Failed to fetch balance - ${error.message || 'Unknown error'}`);
               this.weWantTokenBalanceField = '0';
          } finally {
               this.spinner = false;
               this.cdr.detectChanges();
          }
     }

     async onWeSpendCurrencyChange() {
          if (!this.selectedAccount) {
               this.setError('Please select an account');
               this.weSpendTokenBalanceField = '0';
               return;
          }
          const address = this.selectedAccount === 'account1' ? this.account1.address : this.account2.address;
          if (!this.utilsService.validatInput(address)) {
               this.setError('ERROR: Account address cannot be empty');
               this.weSpendTokenBalanceField = '0';
               return;
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();

               this.spinner = true;
               let balance: string;
               if (this.weSpendCurrencyField === 'XRP') {
                    balance = await this.getXrpBalance(address);
               } else {
                    const currencyCode = this.weSpendCurrencyField.length > 3 ? this.utilsService.encodeCurrencyCode(this.weSpendCurrencyField) : this.weSpendCurrencyField;
                    balance = (await this.getCurrencyBalance(address, currencyCode)) ?? '0';
               }
               this.weSpendTokenBalanceField = balance !== null ? balance : '0';
          } catch (error: any) {
               console.error('Error fetching weSpend balance:', error);
               this.setError(`ERROR: Failed to fetch balance - ${error.message || 'Unknown error'}`);
               this.weSpendTokenBalanceField = '0';
          } finally {
               this.spinner = false;
               this.cdr.detectChanges();
          }
     }

     async getCurrencyBalance(address: string, currency: string, issuer?: string): Promise<string | null> {
          try {
               const client = await this.xrplService.getClient();
               const balanceResponse = await client.request({
                    command: 'gateway_balances',
                    account: address,
                    ledger_index: 'validated',
               });

               let tokenTotal = 0;
               if (balanceResponse.result.assets) {
                    Object.entries(balanceResponse.result.assets).forEach(([assetIssuer, assets]) => {
                         if (!issuer || assetIssuer === issuer) {
                              assets.forEach((asset: any) => {
                                   let assetCurrency = asset.currency.length > 3 ? this.utilsService.decodeCurrencyCode(asset.currency) : asset.currency;
                                   if (currency === assetCurrency) {
                                        const value = parseFloat(asset.value);
                                        if (!isNaN(value)) {
                                             tokenTotal += value;
                                        }
                                   }
                              });
                         }
                    });
               }
               return tokenTotal > 0 ? (Math.round(tokenTotal * 100) / 100).toString() : '0';
          } catch (error: any) {
               console.error('Error fetching token balance:', error);
               throw error;
          }
     }

     // async getCurrencyBalance(address: string, currency: string): Promise<string | null> {
     //      try {
     //           const client = await this.xrplService.getClient();
     //           const balanceResponse = await client.request({
     //                command: 'gateway_balances',
     //                account: address,
     //                ledger_index: 'validated',
     //           });

     //           let tokenTotal = 0;
     //           if (balanceResponse.result.assets) {
     //                Object.entries(balanceResponse.result.assets).forEach(([_, assets]) => {
     //                     assets.forEach((asset: any) => {
     //                          let assetCurrency = asset.currency.length > 3 ? this.utilsService.decodeCurrencyCode(asset.currency) : asset.currency;
     //                          if (currency === assetCurrency) {
     //                               const value = parseFloat(asset.value);
     //                               if (!isNaN(value)) {
     //                                    tokenTotal += value;
     //                               }
     //                          }
     //                     });
     //                });
     //           }
     //           return tokenTotal > 0 ? (Math.round(tokenTotal * 100) / 100).toString() : '0';
     //      } catch (error: any) {
     //           console.error('Error fetching token balance:', error);
     //           throw error;
     //      }
     // }

     async getXrpBalance(address: string): Promise<string> {
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
          }
     }

     async displayOfferDataForAccount1() {
          console.log('Entering displayOfferDataForAccount1');
          const startTime = Date.now();
          const account1name = this.storageService.getInputValue('account1name');
          const account1address = this.storageService.getInputValue('account1address');
          const account2address = this.storageService.getInputValue('account2address');
          const account1seed = this.storageService.getInputValue('account1seed');
          const account1mnemonic = this.storageService.getInputValue('account1mnemonic');
          const account1secretNumbers = this.storageService.getInputValue('account1secretNumbers');

          const accountName1Field = document.getElementById('accountName1Field') as HTMLInputElement | null;
          const accountAddress1Field = document.getElementById('accountAddress1Field') as HTMLInputElement | null;
          const accountSeed1Field = document.getElementById('accountSeed1Field') as HTMLInputElement | null;
          const memoField = document.getElementById('memoField') as HTMLInputElement | null;
          const weWantAmountField = document.getElementById('weWantAmountField') as HTMLInputElement | null;
          const weWantCurrencyField = document.getElementById('weWantCurrencyField') as HTMLInputElement | null;

          if (accountName1Field) accountName1Field.value = account1name || AppConstants.EMPTY_STRING;
          if (accountAddress1Field) accountAddress1Field.value = account1address || AppConstants.EMPTY_STRING;
          if (accountSeed1Field) {
               if (account1seed === AppConstants.EMPTY_STRING) {
                    if (account1mnemonic === AppConstants.EMPTY_STRING) {
                         accountSeed1Field.value = account1secretNumbers || AppConstants.EMPTY_STRING;
                    } else {
                         accountSeed1Field.value = account1mnemonic || AppConstants.EMPTY_STRING;
                    }
               } else {
                    accountSeed1Field.value = account1seed || AppConstants.EMPTY_STRING;
               }
          }

          this.weWantAmountField = '1';
          this.weSpendAmountField = '1';
          if (weWantAmountField && weWantAmountField.value !== 'XRP') {
               this.weWantIssuerField = account2address;
          } else {
               this.weSpendIssuerField = account2address;
          }

          if (memoField) {
               this.memoField = AppConstants.EMPTY_STRING;
          }

          try {
               // const { environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               // const { accountInfo, accountObjects } = await this.utilsService.getAccountInfo(account1seed, environment);
               // this.utilsService.renderAccountDetails(accountInfo, accountObjects);
               const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, account1address);
               this.ownerCount = ownerCount;
               this.totalXrpReserves = totalXrpReserves;
               this.account1.balance = ((await client.getXrpBalance(account1address)) - parseFloat(this.totalXrpReserves || '0')).toString();
               console.log('this.account1.balance', this.account1.balance);

               // Fetch initial balances for weWant and weSpend currencies
               await this.onWeWantCurrencyChange();
               await this.onWeSpendCurrencyChange();
          } catch (error: any) {
               this.setError(error.message);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving handlePaymentChannelAction in ${this.executionTime}ms`);
          }

          this.getOffers();
     }

     private setError(message: string) {
          this.isError = true;
          this.isSuccess = false;
          this.result = `${message}`;
          this.spinner = false;
     }

     public setSuccess(message: string) {
          this.result = `${message}`;
          this.isError = false;
          this.isSuccess = true;
     }
}
