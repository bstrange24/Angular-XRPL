import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { StorageService } from '../../services/storage.service';
import { OfferCreate, TransactionMetadataBase, OfferCreateFlags, BookOffer, IssuedCurrencyAmount, AMMInfoRequest, TrustSetFlags } from 'xrpl';
import * as xrpl from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';
import BigNumber from 'bignumber.js';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { WalletMultiInputComponent } from '../wallet-multi-input/wallet-multi-input.component';

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

// Ensure correct typing for XRPL 'Currency' type
interface XRPLCurrency {
     currency: string;
     issuer?: string; // Optional for XRP
}

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
     weWantCurrencyField: string = 'RLUSD'; // Set to RLUSD for XRP/RLUSD pair
     weWantIssuerField: string = 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De'; // Official RLUSD issuer
     weWantAmountField: string = '';
     weWantTokenBalanceField: string = '';
     weSpendIssuerField: string = '';
     weSpendAmountField: string = '';
     weSpendTokenBalanceField: string = '';
     isMarketOrder: boolean = false;
     ticketCountField: string = '';
     ticketSequence: string = '';
     isTicket: boolean = false;
     isTicketEnabled = false;
     expirationTimeField: string = '';
     account1 = { name: '', address: '', seed: '', secretNumbers: '', mnemonic: '', balance: '' };
     account2 = { name: '', address: '', seed: '', secretNumbers: '', mnemonic: '', balance: '' };
     issuer = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '0' };
     xrpBalance1Field: string = '';
     ownerCount: string = '';
     totalXrpReserves: string = '';
     executionTime: string = '';
     amountField: string = '';
     currentTimeField: string = '';
     memoField: string = '';
     isMemoEnabled = false;
     isMultiSign = false;
     multiSignAddress: string = '';
     multiSignSeeds: string = '';
     signerQuorum: number = 0;
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
     phnixBalance: string = '0'; // Hardcoded for now, will be fetched dynamically
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
          RLUSD: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De',
     };
     currencies: string[] = [];
     newCurrency: string = '';
     newIssuer: string = '';
     tokenToRemove: string = '';
     showTrustlineOptions: boolean = false; // default off
     signers: { account: string; seed: string; weight: number }[] = [{ account: '', seed: '', weight: 1 }];

     conflicts: { [key: string]: string[] } = {
          tfSetNoRipple: ['tfClearNoRipple'],
          tfClearNoRipple: ['tfSetNoRipple'],
          tfSetFreeze: ['tfClearFreeze'],
          tfClearFreeze: ['tfSetFreeze'],
     };

     trustlineFlags: Record<string, boolean> = {
          tfSetfAuth: false,
          tfSetNoRipple: false,
          tfClearNoRipple: false,
          tfSetFreeze: false,
          tfClearFreeze: false,
     };

     trustlineFlagList = [
          { key: 'tfSetfAuth', label: 'Require Authorization (tfSetfAuth)' },
          { key: 'tfSetNoRipple', label: 'Set No Ripple (tfSetNoRipple)' },
          { key: 'tfClearNoRipple', label: 'Clear No Ripple (tfClearNoRipple)' },
          { key: 'tfSetFreeze', label: 'Set Freeze (tfSetFreeze)' },
          { key: 'tfClearFreeze', label: 'Clear Freeze (tfClearFreeze)' },
     ];

     flagMap: { [key: string]: number } = {
          tfSetfAuth: TrustSetFlags.tfSetfAuth,
          tfSetNoRipple: TrustSetFlags.tfSetNoRipple,
          tfClearNoRipple: TrustSetFlags.tfClearNoRipple,
          tfSetFreeze: TrustSetFlags.tfSetFreeze,
          tfClearFreeze: TrustSetFlags.tfClearFreeze,
     };

     private priceRefreshInterval: any; // For polling

     constructor(private xrplService: XrplService, private utilsService: UtilsService, private cdr: ChangeDetectorRef, private storageService: StorageService) {}

     ngOnInit() {
          const storedIssuers = this.storageService.getKnownIssuers('knownIssuers');
          if (storedIssuers) {
               this.knownTrustLinesIssuers = storedIssuers;
          }
          this.updateCurrencies();
          this.weWantCurrencyField = 'USD'; // BOB Set default selected currency if available
     }

     async ngAfterViewInit() {
          try {
               const wallet = await this.getWallet();
               this.loadSignerList(wallet.classicAddress);
               this.dataSource.paginator = this.paginator;
               this.dataSource.sort = this.sort;
               // this.startPriceRefresh(); // Start polling for price
               // await this.updateTokenBalanceAndExchange(); // Fetch Token balance and calculate XRP
          } catch (error) {
               return this.setError('ERROR: Wallet could not be created or is undefined');
          } finally {
               this.cdr.detectChanges();
          }
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

     setSlippage(slippage: number) {
          this.slippage = slippage;
          this.updateTokenBalanceAndExchange(); // Recalculate exchange with new slippage
          this.cdr.detectChanges();
     }

     onAccountChange() {
          if (!this.selectedAccount) return;
          if (this.selectedAccount === 'account1') {
               this.displayDataForAccount1();
          } else if (this.selectedAccount === 'account2') {
               this.displayDataForAccount2();
          } else {
               this.displayDataForAccount3();
          }
     }

     toggleTicketSequence() {
          this.cdr.detectChanges();
     }

     updateSpinnerMessage(message: string) {
          this.spinnerMessage = message;
          this.cdr.detectChanges();
          console.log('Spinner message updated:', message);
     }

     onFlagChange(flag: string) {
          if (this.trustlineFlags[flag]) {
               this.conflicts[flag]?.forEach(conflict => {
                    this.trustlineFlags[conflict] = false;
               });
          }
     }

     async toggleMultiSign() {
          try {
               if (!this.isMultiSign) {
                    this.clearSignerList();
               } else {
                    const wallet = await this.getWallet();
                    this.loadSignerList(wallet.classicAddress);
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

     validateQuorum() {
          const totalWeight = this.signers.reduce((sum, s) => sum + (s.weight || 0), 0);
          if (this.signerQuorum > totalWeight) {
               this.signerQuorum = totalWeight;
          }
          this.cdr.detectChanges();
     }

     async showSpinnerWithDelay(message: string, delayMs: number = 200) {
          this.spinner = true;
          this.updateSpinnerMessage(message);
          await new Promise(resolve => setTimeout(resolve, delayMs));
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

     async getAMMPoolInfo() {
          console.log('Entering getAMMPoolInfo');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               this.showSpinnerWithDelay('Getting AMM Pool Info...', 200);

               // Ensure correct typing for XRPL 'Currency' type
               // const toXRPLCurrency = (currency: string, issuer: string) => {
               //      if (currency === AppConstants.XRP_CURRENCY) {
               //           return { currency: AppConstants.XRP_CURRENCY };
               //      }
               //      return {
               //           currency: currency.length > 3 ? this.utilsService.encodeCurrencyCode(currency) : currency,
               //           issuer: issuer,
               //      };
               // };

               // const asset = toXRPLCurrency(this.weWantCurrencyField, this.weWantIssuerField);
               // const asset2 = toXRPLCurrency(this.weSpendCurrencyField, this.weSpendIssuerField);
               const asset = this.toXRPLCurrency(this.weWantCurrencyField, this.selectedAccount === 'account1' ? this.account1.address : this.selectedAccount === 'account2' ? this.account2.address : this.issuer.address);
               const asset2 = this.toXRPLCurrency(this.weSpendCurrencyField, this.selectedAccount === 'account1' ? this.account1.address : this.selectedAccount === 'account2' ? this.account2.address : this.issuer.address);
               console.debug(`asset ${JSON.stringify(asset, null, '\t')}`);
               console.debug(`asset2 ${JSON.stringify(asset2, null, '\t')}`);

               const ammInfoRequest = {
                    command: 'amm_info',
                    asset: asset as any, // Type assertion to satisfy XRPL typings
                    asset2: asset2 as any,
                    ledger_index: 'validated',
               };
               console.info(JSON.stringify(ammInfoRequest, null, 2));

               let ammResponse: any;
               try {
                    ammResponse = await client.request({
                         command: 'amm_info',
                         asset: asset as any, // Type assertion to satisfy XRPL typings
                         asset2: asset2 as any,
                         ledger_index: 'validated',
                    });
               } catch (error: any) {
                    if (error.name === 'RippledError') {
                         if (error.data?.error === 'actNotFound') {
                              console.warn('No AMM pool exists yet for this asset pair.');
                         } else {
                              console.error('RippledError:', error.data?.error_message || error.message);
                         }
                    } else {
                         throw new Error(error);
                    }
               }

               const data: { sections: Section[] } = {
                    sections: [],
               };

               console.debug(`AMM Info ${JSON.stringify(ammResponse?.result, null, '\t')}`);

               const amm = ammResponse?.result?.amm;

               if (!amm) {
                    data.sections.push({
                         title: 'AMM Pool Info',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No AMM pool found for selected pair` }],
                    });

                    const participation = await this.checkAmmParticipation(client, wallet.classicAddress);
                    console.debug(`participation ${JSON.stringify(participation, null, '\t')}`);

                    if (participation) {
                         // LP Token section
                         data.sections.push({
                              title: 'AMM Pool Participant',
                              openByDefault: true,
                              content: [
                                   { key: 'AMM Pool', value: participation.isAmmPool ? 'Yes' : 'No' },
                                   { key: 'Liquidity Provider', value: participation.isLiquidityProvider ? 'Yes' : 'No' },
                                   ...participation.lpTokens.map((lp, i) => ({
                                        key: `Liquidity Provider #${i + 1}`,
                                        value: `LP Balance: ${lp.balance} (issuer: ${lp.issuer}, currency: ${lp.currency})`,
                                   })),
                              ],
                         });
                    }
               } else {
                    data.sections.push({
                         title: 'AMM Pool Info',
                         openByDefault: true,
                         content: [
                              { key: 'Account', value: amm.account },
                              { key: 'Asset', value: typeof amm.amount === 'string' ? 'XRP' : (amm.amount.currency.length > 3 ? this.utilsService.decodeCurrencyCode(amm.amount.currency) : amm.amount.currency) + (amm.amount.issuer ? ` (Issuer: ${amm.amount.issuer})` : '') },
                              { key: 'Asset2', value: typeof amm.amount2 === 'string' ? 'XRP' : (amm.amount2.currency.length > 3 ? this.utilsService.decodeCurrencyCode(amm.amount2.currency) : amm.amount2.currency) + (amm.amount2.issuer ? ` (Issuer: ${amm.amount2.issuer})` : '') },
                              { key: 'LP Token Balance', value: `${amm.lp_token.value} ${amm.lp_token.currency}` },
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
                              subItems: amm.vote_slots.map((slot: { account: any; trading_fee: number; vote_weight: number }, index: number) => ({
                                   key: `Vote Slot ${index + 1}`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Account', value: slot.account },
                                        { key: 'Trading Fee', value: `${slot.trading_fee / 1000}%` },
                                        { key: 'Votinf Weight', value: slot.vote_weight },
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
                              { key: 'Balance', value: amm.lp_token.value },
                         ],
                    });
               }

               this.utilsService.renderPaymentChannelDetails(data);
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), wallet);
               this.refreshUiAccountInfo(await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''));
               this.loadSignerList(wallet.classicAddress);
               this.setSuccess(this.result);

               this.isMemoEnabled = false;
               this.memoField = '';
               this.amountField = '';

               this.account1.balance = await this.getXrpBalance(wallet.classicAddress);
          } catch (error: any) {
               console.error('Error:', error);
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

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed,
               amount: this.amountField,
               weWantAmountField: this.weWantAmountField,
               weSpendAmountField: this.weSpendAmountField,
               multiSignAddresses: this.isMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.isMultiSign ? this.multiSignSeeds : undefined,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();
               // Prepare data for rendering
               // interface SectionContent {
               //      key: string;
               //      value: string;
               // }

               // interface SectionSubItem {
               //      key: string;
               //      openByDefault: boolean;
               //      content: SectionContent[];
               // }

               // interface Section {
               //      title: string;
               //      openByDefault: boolean;
               //      content?: SectionContent[];
               //      subItems?: SectionSubItem[];
               // }

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

               console.log(`issuerAddr ${JSON.stringify(issuerAddr, null, '\t')}`);
               console.log(`issuerCur ${JSON.stringify(issuerCur, null, '\t')}`);

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);
               const xrpReserve = await this.xrplService.getXrpReserveRequirements(client, wallet.address);
               const initialXrpBalance = await client.getXrpBalance(wallet.address);

               console.log(`Initial XRP Balance ${initialXrpBalance} (drops): ${xrpl.xrpToDrops(initialXrpBalance)}`);
               const tokenBalance = this.weSpendCurrencyField === AppConstants.XRP_CURRENCY ? this.weWantCurrencyField : this.weSpendCurrencyField;
               let initialTokenBalance;
               if (this.phnixBalance != '') {
                    initialTokenBalance = this.phnixBalance;
               } else {
                    const initialTokenBalance = await this.xrplService.getOnlyTokenBalance(client, wallet.address, tokenBalance);
               }
               console.log(`Initial ${tokenBalance} Balance: ${initialTokenBalance}`);

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

               const offerType = we_spend.currency ? 'sell' : 'buy';
               console.log(`Offer Type: ${offerType}`);

               const tx: xrpl.AMMCreate = {
                    TransactionType: 'AMMCreate',
                    Account: wallet.classicAddress, // the funding account
                    Amount: '10000000', // e.g., 10 XRP (in drops)
                    Amount2: {
                         currency: 'BOB',
                         issuer: 'rQUch4yZo1UgqW2PdoMajVZp4Kw36itjeL',
                         value: '10',
                    },
                    TradingFee: 500, // 0.5%
                    // Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               const preparedTx = await client.autofill(tx);
               console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
               const signed = wallet.sign(preparedTx);
               const result = await client.submitAndWait(signed.tx_blob);
               console.log(`result: ${JSON.stringify(result, null, '\t')}`);

               this.utilsService.renderTransactionsResults(result, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               this.isMemoEnabled = false;
               this.memoField = '';

               this.account1.balance = await this.getXrpBalance(wallet.classicAddress);
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

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed,
               amount: this.weWantAmountField,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

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

               const fee = await this.xrplService.calculateTransactionFee(client);
               const initialXrpBalance = await client.getXrpBalance(wallet.address);
               console.log(`Initial XRP Balance ${initialXrpBalance} (drops): ${xrpl.xrpToDrops(initialXrpBalance)}`);

               const tokenBalance = this.weSpendCurrencyField === AppConstants.XRP_CURRENCY ? this.weWantCurrencyField : this.weSpendCurrencyField;
               let initialTokenBalance = await this.xrplService.getOnlyTokenBalance(client, wallet.address, tokenBalance);
               console.log(`Initial ${tokenBalance} Balance: ${initialTokenBalance}`);

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

               const tx: xrpl.AMMDeposit = {
                    TransactionType: 'AMMDeposit',
                    Account: wallet.classicAddress,
                    Asset: assetDef,
                    Asset2: asset2Def,
                    Amount: assetAmount,
                    Amount2: asset2Amount,
                    Flags: xrpl.AMMDepositFlags.tfTwoAsset,
                    Fee: fee,
               };

               console.log(`tx ${JSON.stringify(tx, null, '\t')}`);
               const prepared = await client.autofill(tx);
               const signed = wallet.sign(prepared);
               const response = await client.submitAndWait(signed.tx_blob);
               console.log(`Response ${JSON.stringify(response, null, '\t')}`);

               if (response.result.meta && typeof response.result.meta !== 'string' && response.result.meta.TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    console.error(`Transaction failed: ${JSON.stringify(response, null, 2)}`);
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), wallet);
               this.refreshUiAccountInfo(await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''));
               this.loadSignerList(wallet.classicAddress);
               this.setSuccess(this.result);

               this.isMemoEnabled = false;
               this.memoField = '';
               this.amountField = '';

               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               this.isMemoEnabled = false;
               this.memoField = '';

               this.account1.balance = await this.getXrpBalance(wallet.classicAddress);
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

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const fee = await this.xrplService.calculateTransactionFee(client);
               const initialXrpBalance = await client.getXrpBalance(wallet.address);
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

               const asset = this.toXRPLCurrency(this.weWantCurrencyField, this.selectedAccount === 'account1' ? this.account1.address : this.selectedAccount === 'account2' ? this.account2.address : this.issuer.address);
               const asset2 = this.toXRPLCurrency(this.weSpendCurrencyField, this.selectedAccount === 'account1' ? this.account1.address : this.selectedAccount === 'account2' ? this.account2.address : this.issuer.address);
               console.debug(`asset ${JSON.stringify(asset, null, '\t')}`);
               console.debug(`asset2 ${JSON.stringify(asset2, null, '\t')}`);

               const assetDef: xrpl.Currency = {
                    currency: 'XRP',
               };
               const asset2Def: xrpl.Currency = {
                    currency: we_want.currency,
                    issuer: we_want.issuer ?? '', // fallback empty string if undefined
               };

               const participation = await this.checkAmmParticipation(client, wallet.classicAddress);
               console.debug(`participation ${JSON.stringify(participation, null, '\t')}`);

               const ammIssuer = participation.lpTokens[0].issuer;
               const ammCurrency = participation.lpTokens[0].currency;
               const lpTokenIn = { currency: ammCurrency, issuer: ammIssuer, value: this.withdrawlLpTokenFromPoolField };

               const tx: xrpl.AMMWithdraw = {
                    TransactionType: 'AMMWithdraw',
                    Account: wallet.classicAddress,
                    Asset: assetDef,
                    Asset2: asset2Def,
                    LPTokenIn: lpTokenIn,
                    Flags: xrpl.AMMDepositFlags.tfLPToken,
                    Fee: fee,
               };

               console.log(`tx ${JSON.stringify(tx, null, '\t')}`);
               const prepared = await client.autofill(tx);
               const signed = wallet.sign(prepared);
               const response = await client.submitAndWait(signed.tx_blob);
               console.log(`Response ${JSON.stringify(response, null, '\t')}`);

               if (response.result.meta && typeof response.result.meta !== 'string' && response.result.meta.TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    console.error(`Transaction failed: ${JSON.stringify(response, null, 2)}`);
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), wallet);
               this.refreshUiAccountInfo(await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''));
               this.loadSignerList(wallet.classicAddress);
               this.setSuccess(this.result);

               this.isMemoEnabled = false;
               this.memoField = '';
               this.amountField = '';

               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               this.isMemoEnabled = false;
               this.memoField = '';

               this.account1.balance = await this.getXrpBalance(wallet.classicAddress);
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving withdrawlTokenFromAMM in ${this.executionTime}ms`);
          }
     }

     async withdrawlLpFromAMM() {
          console.log('Entering withdrawlLpFromAMM');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const fee = await this.xrplService.calculateTransactionFee(client);
               const initialXrpBalance = await client.getXrpBalance(wallet.address);
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

               const asset = this.toXRPLCurrency(this.weWantCurrencyField, this.selectedAccount === 'account1' ? this.account1.address : this.selectedAccount === 'account2' ? this.account2.address : this.issuer.address);
               const asset2 = this.toXRPLCurrency(this.weSpendCurrencyField, this.selectedAccount === 'account1' ? this.account1.address : this.selectedAccount === 'account2' ? this.account2.address : this.issuer.address);
               console.debug(`asset ${JSON.stringify(asset, null, '\t')}`);
               console.debug(`asset2 ${JSON.stringify(asset2, null, '\t')}`);

               const assetDef: xrpl.Currency = {
                    currency: 'XRP',
               };
               const asset2Def: xrpl.Currency = {
                    currency: we_want.currency,
                    issuer: we_want.issuer ?? '', // fallback empty string if undefined
               };

               const participation = await this.checkAmmParticipation(client, wallet.classicAddress);
               console.debug(`participation ${JSON.stringify(participation, null, '\t')}`);

               const ammIssuer = participation.lpTokens[0].issuer;
               const ammCurrency = participation.lpTokens[0].currency;
               const lpTokenIn = { currency: ammCurrency, issuer: ammIssuer, value: this.withdrawlLpTokenFromPoolField };

               const tx: xrpl.AMMWithdraw = {
                    TransactionType: 'AMMWithdraw',
                    Account: wallet.classicAddress,
                    Asset: assetDef,
                    Asset2: asset2Def,
                    LPTokenIn: lpTokenIn,
                    Flags: xrpl.AMMDepositFlags.tfLPToken,
                    Fee: fee,
               };

               console.log(`tx ${JSON.stringify(tx, null, '\t')}`);
               const prepared = await client.autofill(tx);
               const signed = wallet.sign(prepared);
               const response = await client.submitAndWait(signed.tx_blob);
               console.log(`Response ${JSON.stringify(response, null, '\t')}`);

               if (response.result.meta && typeof response.result.meta !== 'string' && response.result.meta.TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    console.error(`Transaction failed: ${JSON.stringify(response, null, 2)}`);
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), wallet);
               this.refreshUiAccountInfo(await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''));
               this.loadSignerList(wallet.classicAddress);
               this.setSuccess(this.result);

               this.isMemoEnabled = false;
               this.memoField = '';
               this.amountField = '';

               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               this.isMemoEnabled = false;
               this.memoField = '';

               this.account1.balance = await this.getXrpBalance(wallet.classicAddress);
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving withdrawlLpFromAMM in ${this.executionTime}ms`);
          }
     }

     async swapViaAMM() {
          console.log('Entering swapViaAMM');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               this.showSpinnerWithDelay('Swap via AMM...', 200);

               const asset = this.toXRPLCurrency(this.weWantCurrencyField, this.issuer.address);
               const asset2 = this.toXRPLCurrency(this.weSpendCurrencyField, this.issuer.address);
               console.debug(`asset ${JSON.stringify(asset, null, '\t')}`);
               console.debug(`asset2 ${JSON.stringify(asset2, null, '\t')}`);

               // Define Amount based on weWantCurrencyField
               const amount: xrpl.Amount = this.weWantCurrencyField === 'XRP' ? xrpl.xrpToDrops(this.weWantAmountField.toString()) : { currency: asset.currency, issuer: asset.issuer!, value: this.weWantAmountField.toString() };

               const tx: xrpl.Payment = {
                    TransactionType: 'Payment',
                    Account: wallet.classicAddress,
                    Destination: wallet.classicAddress,
                    Amount: amount,
                    SendMax: this.weSpendCurrencyField === 'XRP' ? xrpl.xrpToDrops(this.weSpendAmountField.toString()) : { currency: asset2.currency, issuer: asset2.issuer!, value: '10' },
                    Flags: 131072,
               };

               console.log(`tx ${JSON.stringify(tx, null, '\t')}`);
               const prepared = await client.autofill(tx);
               const signed = wallet.sign(prepared);
               const response = await client.submitAndWait(signed.tx_blob);
               console.log(`Response ${JSON.stringify(response, null, '\t')}`);

               if (response.result.meta && typeof response.result.meta !== 'string' && response.result.meta.TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    console.error(`Transaction failed: ${JSON.stringify(response, null, 2)}`);
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), wallet);
               this.refreshUiAccountInfo(await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''));
               this.loadSignerList(wallet.classicAddress);
               this.setSuccess(this.result);

               this.isMemoEnabled = false;
               this.memoField = '';
               this.amountField = '';

               this.account1.balance = await this.getXrpBalance(wallet.classicAddress);
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving swapViaAMM in ${this.executionTime}ms`);
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

          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed;
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

     async onWeWantCurrencyChange() {
          console.log('Entering onWeWantCurrencyChange');
          const startTime = Date.now();
          this.setSuccessProperties();

          if (!this.selectedAccount) {
               this.setError('Please select an account');
               this.weWantTokenBalanceField = '0';
               this.setErrorProperties();
               return;
          }
          const address = this.selectedAccount === 'account1' ? this.account1.address : this.selectedAccount === 'account2' ? this.account2.address : this.issuer.address;
          if (!this.utilsService.validateInput(address)) {
               this.setError('ERROR: Account address cannot be empty');
               this.weWantTokenBalanceField = '0';
               this.setErrorProperties();
               return;
          }

          try {
               // const client = await this.xrplService.getClient();

               // this.spinner = true;
               // let balance: string;
               // const currencyCode = this.weWantCurrencyField && this.weWantCurrencyField.length > 3 ? this.utilsService.encodeCurrencyCode(this.weWantCurrencyField) : this.weWantCurrencyField ? this.weWantCurrencyField : '';
               // if (address) {
               //      const balanceResult = await this.utilsService.getCurrencyBalance(currencyCode, address);
               //      balance = balanceResult !== null ? balanceResult.toString() : '0';
               //      this.weWantCurrencyField = balance;
               // } else {
               //      this.weWantCurrencyField = '0';
               // }

               // // Fetch token balances
               // const gatewayBalances = await this.xrplService.getTokenBalance(client, address, 'validated', '');
               // console.debug(`gatewayBalances ${address} ${JSON.stringify(gatewayBalances.result, null, '\t')}`);

               // // Prepare data for rendering
               // interface SectionContent {
               //      key: string;
               //      value: string;
               // }

               // interface SectionSubItem {
               //      key: string;
               //      openByDefault: boolean;
               //      content: SectionContent[];
               // }

               // interface Section {
               //      title: string;
               //      openByDefault: boolean;
               //      content?: SectionContent[];
               //      subItems?: SectionSubItem[];
               // }

               // const data: { sections: Section[] } = {
               //      sections: [],
               // };

               // interface SectionContent {
               //      key: string;
               //      value: string;
               // }

               // interface SectionSubItem {
               //      key: string;
               //      openByDefault: boolean;
               //      content: SectionContent[];
               // }

               // interface Section {
               //      title: string;
               //      openByDefault: boolean;
               //      content?: SectionContent[];
               //      subItems?: SectionSubItem[];
               // }

               // // Obligations section (tokens issued by the account)
               // if (gatewayBalances.result.obligations && Object.keys(gatewayBalances.result.obligations).length > 0) {
               //      data.sections.push({
               //           title: `Issuer Obligations (${Object.keys(gatewayBalances.result.obligations).length})`,
               //           openByDefault: true,
               //           subItems: Object.entries(gatewayBalances.result.obligations).map(([oblCurrency, amount], index) => {
               //                const displayCurrency = oblCurrency.length > 3 ? this.utilsService.decodeCurrencyCode(oblCurrency) : oblCurrency;
               //                return {
               //                     key: `Obligation ${index + 1} (${displayCurrency})`,
               //                     openByDefault: false,
               //                     content: [
               //                          { key: 'Currency', value: displayCurrency },
               //                          { key: 'Amount', value: amount },
               //                     ],
               //                };
               //           }),
               //      });
               // } else {
               //      data.sections.push({
               //           title: 'Issuer Obligations',
               //           openByDefault: true,
               //           content: [{ key: 'Status', value: 'No obligations issued' }],
               //      });
               // }

               // // Balances section (tokens held by the account)
               // if (gatewayBalances.result.assets && Object.keys(gatewayBalances.result.assets).length > 0) {
               //      const balanceItems = [];
               //      for (const [issuer, currencies] of Object.entries(gatewayBalances.result.assets)) {
               //           for (const { currency, value } of currencies) {
               //                let displayCurrency = currency;
               //                if (currency.length > 3) {
               //                     const tempCurrency = currency;
               //                     displayCurrency = this.utilsService.decodeCurrencyCode(currency);
               //                     if (displayCurrency.length > 8) {
               //                          displayCurrency = tempCurrency;
               //                     }
               //                }
               //                balanceItems.push({
               //                     key: `${displayCurrency} from ${issuer.slice(0, 8)}...`,
               //                     openByDefault: false,
               //                     content: [
               //                          { key: 'Currency', value: displayCurrency },
               //                          { key: 'Issuer', value: `<code>${issuer}</code>` },
               //                          { key: 'Amount', value: value },
               //                     ],
               //                });
               //           }
               //      }
               //      data.sections.push({
               //           title: `Balances (${balanceItems.length})`,
               //           openByDefault: true,
               //           subItems: balanceItems,
               //      });
               // } else {
               //      data.sections.push({
               //           title: 'Balances',
               //           openByDefault: true,
               //           content: [{ key: 'Status', value: 'No balances (tokens held by you)' }],
               //      });
               // }

               // this.utilsService.renderPaymentChannelDetails(data);
               // this.weWantCurrencyField = this.knownTrustLinesIssuers[this.weWantCurrencyField];
               this.spinner = true;
               let balance: string;
               if (this.weWantCurrencyField === 'XRP') {
                    balance = await this.getXrpBalance(address);
               } else {
                    const currencyCode = this.weWantCurrencyField.length > 3 ? this.utilsService.encodeCurrencyCode(this.weWantCurrencyField) : this.weWantCurrencyField;
                    balance = (await this.getCurrencyBalance(address, currencyCode)) ?? '0';
                    this.weWantIssuerField = this.knownTrustLinesIssuers[this.weWantCurrencyField];
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
          const address = this.selectedAccount === 'account1' ? this.account1.address : this.selectedAccount === 'account2' ? this.account2.address : this.issuer.address;
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

          const address = this.selectedAccount === 'account1' ? this.account1.address : this.selectedAccount === 'account2' ? this.account2.address : this.issuer.address;
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

          const address = this.selectedAccount === 'account1' ? this.account1.address : this.selectedAccount === 'account2' ? this.account2.address : this.issuer.address;
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
     }

     refreshUiAccountObjects(accountObjects: any, wallet: any) {
          const signerAccounts: string[] = this.checkForSignerAccounts(accountObjects);
          if (signerAccounts && signerAccounts.length > 0) {
               if (Array.isArray(signerAccounts) && signerAccounts.length > 0) {
                    const singerEntriesAccount = wallet.classicAddress + 'signerEntries';
                    const signerEntries: SignerEntry[] = this.storageService.get(singerEntriesAccount) || [];
                    console.log(`refreshUiAccountObjects: ${JSON.stringify(this.storageService.get(singerEntriesAccount), null, '\t')}`);

                    const addresses = signerEntries.map((item: { Account: any }) => item.Account + ',\n').join('');
                    const seeds = signerEntries.map((item: { seed: any }) => item.seed + ',\n').join('');
                    this.multiSignSeeds = seeds;
                    this.multiSignAddress = addresses;
               }
          } else {
               this.signerQuorum = 0;
               this.multiSignAddress = 'No Multi-Sign address configured for account';
               this.multiSignSeeds = ''; // Clear seeds if no signer accounts
               this.isMultiSign = false;
               this.storageService.removeValue('signerEntries');
          }

          this.isMemoEnabled = false;
          this.memoField = '';
     }

     refreshUiAccountInfo(accountInfo: any) {
          if (accountInfo.result.account_data && accountInfo.result.account_data.RegularKey) {
               this.regularKeyAddress = accountInfo.result.account_data.RegularKey;
               this.regularKeySeed = this.storageService.get('regularKeySeed');
          } else {
               this.isRegularKeyAddress = false;
               this.regularKeyAddress = 'No RegularKey configured for account';
               this.regularKeySeed = '';
          }
          this.weWantAmountField = '';
          this.weSpendAmountField = '';
     }

     async checkAmmParticipation(client: xrpl.Client, account: string) {
          let result: { isAmmPool: boolean; isLiquidityProvider: boolean; ammInfo?: any; lpTokens: { issuer: string; currency: string; balance: string }[] } = {
               isAmmPool: false,
               isLiquidityProvider: false,
               ammInfo: undefined,
               lpTokens: [], // always an array
          };

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

               this.lpTokenBalanceField = '';

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
          } catch (e) {
               console.error('Error checking LP tokens:', e);
          }

          return result;
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

     toXRPLCurrency(currency: string, issuerAddress: string): XRPLCurrency {
          if (currency === 'XRP') {
               return { currency: 'XRP' };
          }
          return { currency, issuer: issuerAddress };
     }

     private validateInputs(inputs: { seed?: string; amount?: string; destination?: string; sequence?: string; selectedAccount?: 'account1' | 'account2' | 'issuer' | null; multiSignAddresses?: string; multiSignSeeds?: string; weWantAmountField?: string; weSpendAmountField?: string }): string | null {
          if (inputs.selectedAccount !== undefined && !inputs.selectedAccount) {
               return 'Please select an account';
          }
          if (inputs.seed != undefined && !this.utilsService.validateInput(inputs.seed)) {
               return 'Account seed cannot be empty';
          }
          if (inputs.amount != undefined && !this.utilsService.validateInput(inputs.amount)) {
               return 'Amount cannot be empty';
          }
          if (inputs.amount != undefined) {
               if (isNaN(parseFloat(inputs.amount ?? '')) || !isFinite(parseFloat(inputs.amount ?? ''))) {
                    return 'Amount must be a valid number';
               }
          }
          if (inputs.amount != undefined && inputs.amount && parseFloat(inputs.amount) <= 0) {
               return 'Amount must be a positive number';
          }
          if (inputs.weWantAmountField != undefined && inputs.weWantAmountField && parseFloat(inputs.weWantAmountField) <= 0) {
               return 'First pool amount must be a positive number';
          }
          if (inputs.weSpendAmountField != undefined && inputs.weSpendAmountField && parseFloat(inputs.weSpendAmountField) <= 0) {
               return 'Second pool amount must be a positive number';
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
               if (addresses.length !== seeds.length) {
                    return 'Number of signer addresses must match number of signer seeds';
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

     clearSignerList() {
          this.signers = [{ account: '', seed: '', weight: 1 }];
     }

     async getWallet() {
          const environment = this.xrplService.getNet().environment;
          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed;
          const wallet = await this.utilsService.getWallet(seed, environment);
          if (!wallet) {
               throw new Error('ERROR: Wallet could not be created or is undefined');
          }
          return wallet;
     }

     private async displayDataForAccount1() {
          await this.displayDataForAccount('account1');
     }

     private async displayDataForAccount2() {
          await this.displayDataForAccount('account2');
     }

     private async displayDataForAccount3() {
          await this.displayDataForAccount('issuer');
     }

     private async displayDataForAccount(accountKey: 'account1' | 'account2' | 'issuer') {
          const prefix = accountKey === 'issuer' ? 'issuer' : accountKey;

          let name;
          let address;
          let seed;

          // Fetch stored values
          if (prefix === 'issuer') {
               name = this.storageService.getInputValue(`${prefix}Name`) || AppConstants.EMPTY_STRING;
               address = this.storageService.getInputValue(`${prefix}Address`) || AppConstants.EMPTY_STRING;
               seed = this.storageService.getInputValue(`${prefix}Seed`) || this.storageService.getInputValue(`${prefix}Mnemonic`) || this.storageService.getInputValue(`${prefix}SecretNumbers`) || AppConstants.EMPTY_STRING;
          } else {
               name = this.storageService.getInputValue(`${prefix}name`) || AppConstants.EMPTY_STRING;
               address = this.storageService.getInputValue(`${prefix}address`) || AppConstants.EMPTY_STRING;
               seed = this.storageService.getInputValue(`${prefix}seed`) || this.storageService.getInputValue(`${prefix}mnemonic`) || this.storageService.getInputValue(`${prefix}secretNumbers`) || AppConstants.EMPTY_STRING;
          }

          // Update account data
          const account = accountKey === 'account1' ? this.account1 : accountKey === 'account2' ? this.account2 : this.issuer;
          account.name = name;
          account.address = address;
          account.seed = seed;

          // DOM manipulation
          const accountName1Field = document.getElementById('accountName1Field') as HTMLInputElement | null;
          const accountAddress1Field = document.getElementById('accountAddress1Field') as HTMLInputElement | null;
          const accountSeed1Field = document.getElementById('accountSeed1Field') as HTMLInputElement | null;

          if (accountName1Field) accountName1Field.value = name;
          if (accountAddress1Field) accountAddress1Field.value = address;
          if (accountSeed1Field) accountSeed1Field.value = seed;

          // Trigger change detection to sync with ngModel
          this.cdr.detectChanges();

          // Update destination field (set to other account's address)
          const otherPrefix = accountKey === 'account1' ? 'account2' : accountKey === 'account2' ? 'account1' : 'account1';
          // this.destinationField = this.storageService.getInputValue(`${otherPrefix}address`) || AppConstants.EMPTY_STRING;

          // Fetch account details and trustlines
          try {
               if (address && xrpl.isValidAddress(address)) {
                    await this.onWeWantCurrencyChange();
                    await this.onWeSpendCurrencyChange();
                    await this.getAMMPoolInfo();
               } else if (address) {
                    this.setError('Invalid XRP address');
               }
          } catch (error: any) {
               this.setError(`Error fetching account details: ${error.message}`);
          }
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
          this.getAMMPoolInfo();
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
