import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { StorageService } from '../../services/storage.service';
import * as xrpl from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';
import { AppWalletDynamicInputComponent } from '../app-wallet-dynamic-input/app-wallet-dynamic-input.component';

interface ValidationInputs {
     selectedAccount?: string;
     senderAddress?: string;
     account_info?: any;
     seed?: string;
     amount?: string;
     destination?: string;
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
     selector: 'app-trustlines',
     standalone: true,
     imports: [CommonModule, FormsModule, AppWalletDynamicInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './trustlines.component.html',
     styleUrl: './trustlines.component.css',
})
export class TrustlinesComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     @ViewChild('accountForm') accountForm!: NgForm;
     private lastResult: string = '';
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = true;
     currencyField: string = 'CTZ';
     destinationFields: string = '';
     issuerFields: string = '';
     currencyBalanceField: string = '';
     gatewayBalance: string = '';
     amountField: string = '';
     ticketSequence: string = '';
     isTicket: boolean = false;
     ticketArray: string[] = [];
     selectedTickets: string[] = []; // For multiple selection
     selectedSingleTicket: string = ''; // For single selection
     multiSelectMode: boolean = false; // Toggle between modes
     selectedTicket: string = ''; // The currently selected ticket
     ownerCount: string = '';
     totalXrpReserves: string = '';
     executionTime: string = '';
     destinationTagField: string = '';
     useMultiSign: boolean = false;
     multiSignAddress: string = '';
     multiSignSeeds: string = '';
     signerQuorum: number = 0;
     multiSigningEnabled: boolean = false;
     regularKeySigningEnabled: boolean = false;
     memoField: string = '';
     isMemoEnabled = false;
     isRegularKeyAddress = false;
     regularKeySeed: string = '';
     regularKeyAddress: string = '';
     spinner: boolean = false;
     spinnerMessage: string = '';
     masterKeyDisabled: boolean = false;
     isSimulateEnabled: boolean = false;
     knownTrustLinesIssuers: { [key: string]: string[] } = { XRP: [] };
     issuerToRemove: string = '';
     currencies: string[] = [];
     newCurrency: string = '';
     newIssuer: string = '';
     tokenToRemove: string = '';
     showTrustlineOptions: boolean = false; // default off
     signers: { account: string; seed: string; weight: number }[] = [{ account: '', seed: '', weight: 1 }];
     selectedAccount: string = '';
     destinations: { name?: string; address: string }[] = [];
     issuers: { name?: string; address: string }[] = [];
     wallets: any[] = [];
     selectedWalletIndex: number = 0;
     currentWallet = { name: '', address: '', seed: '', balance: '' };
     private lastCurrency: string = '';
     private lastIssuer: string = '';
     trustlineFlags: Record<string, boolean> = { ...AppConstants.TRUSTLINE.FLAGS };
     trustlineFlagList = AppConstants.TRUSTLINE.FLAG_LIST;
     flagMap = AppConstants.TRUSTLINE.FLAG_MAP;
     ledgerFlagMap = AppConstants.TRUSTLINE.LEDGER_FLAG_MAP;
     showManageTokens = false;
     private isInitialLoad = true;

     constructor(private readonly xrplService: XrplService, private readonly utilsService: UtilsService, private readonly cdr: ChangeDetectorRef, private readonly storageService: StorageService, private readonly renderUiComponentsService: RenderUiComponentsService, private readonly xrplTransactions: XrplTransactionService) {}

     ngOnInit() {
          const storedIssuers = this.storageService.getKnownIssuers('knownIssuers');
          if (storedIssuers) {
               this.knownTrustLinesIssuers = storedIssuers;
          }
          this.updateCurrencies();
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
          this.updateDestinations();
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

          this.updateDestinations();

          if (this.currentWallet.address && xrpl.isValidAddress(this.currentWallet.address)) {
               await Promise.all([this.onCurrencyChange(), this.getTrustlinesForAccount()]);
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
               return this.setError('ERROR getting wallet in toggleMultiSign');
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

     onFlagChange(flag: string) {
          if (this.trustlineFlags[flag]) {
               AppConstants.TRUSTLINE.CONFLICTS[flag]?.forEach((conflict: string | number) => {
                    this.trustlineFlags[conflict] = false;
               });
          }
     }

     async getTrustlinesForAccount() {
          console.log('Entering getTrustlinesForAccount');
          const startTime = Date.now();
          this.setSuccessProperties();

          try {
               this.resultField?.nativeElement && (this.resultField.nativeElement.innerHTML = '');
               this.updateSpinnerMessage('Getting Trustlines');

               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const [accountInfo, accountObjects, accountCurrencies] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountCurrencies(client, wallet.classicAddress, 'validated', '')]);

               console.debug('account info:', accountInfo.result);
               console.debug('account objects:', accountObjects.result);
               console.debug('account currencies:', accountCurrencies.result);

               const inputs: ValidationInputs = { seed: this.currentWallet.seed, account_info: accountInfo };
               const errors = await this.validateInputs(inputs, 'getTrustlinesForAccount');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors[0]}` : `Multiple Errors:\n${errors.join('\n')}`);
               }

               const trustLines = accountObjects.result.account_objects.filter(obj => obj.LedgerEntryType === 'RippleState');
               const activeTrustLines = trustLines.filter(line => this.utilsService.decodeIfNeeded(line.Balance.currency) === this.currencyField);

               const data: { sections: any[] } = { sections: [] };

               if (activeTrustLines.length === 0) {
                    data.sections.push({
                         title: 'Trust Lines',
                         openByDefault: true,
                         content: [
                              {
                                   key: 'Status',
                                   value: `No active trust lines found for <code>${this.currencyField}</code> and <code>${wallet.classicAddress}</code>`,
                              },
                         ],
                    });
                    this.gatewayBalance = '';
               } else {
                    const balanceByCounterparty = activeTrustLines.reduce((acc: Record<string, number>, line: xrpl.LedgerEntry.RippleState) => {
                         const currency = this.utilsService.decodeIfNeeded(line.Balance.currency);
                         const isLow = wallet.classicAddress === line.LowLimit.issuer;
                         const isHigh = wallet.classicAddress === line.HighLimit.issuer;
                         if (!isLow && !isHigh) return acc;

                         const counterparty = isLow ? line.HighLimit.issuer : line.LowLimit.issuer;
                         let balance = parseFloat(line.Balance.value);
                         if (isHigh) balance = 0;
                         else if (isLow) balance = -balance;

                         const key = `${currency}:${counterparty}`;
                         acc[key] = (acc[key] || 0) + balance;
                         return acc;
                    }, {});

                    const totalBalances = Object.entries(balanceByCounterparty).map(([key, balance]) => {
                         const [currency, counterparty] = key.split(':');
                         return {
                              key: `Total ${currency} Balance (Counterparty: ${counterparty})`,
                              value: `${this.utilsService.formatTokenBalance(balance.toString(), 2)} ${currency}`,
                         };
                    });

                    data.sections.push({
                         title: `Trust Lines (${activeTrustLines.length})`,
                         openByDefault: true,
                         content: totalBalances,
                         subItems: activeTrustLines.map((line, i) => {
                              const currency = this.utilsService.decodeIfNeeded(line.Balance.currency);
                              const isLow = wallet.classicAddress === line.LowLimit.issuer;
                              const isHigh = wallet.classicAddress === line.HighLimit.issuer;
                              const counterparty = isLow ? line.HighLimit.issuer : line.LowLimit.issuer;
                              const ourLimit = isLow ? line.LowLimit.value : line.HighLimit.value;
                              const theirLimit = isLow ? line.HighLimit.value : line.LowLimit.value;
                              let ourBalance = parseFloat(line.Balance.value);
                              let status = '';

                              if (isHigh && parseFloat(ourLimit) === 0) {
                                   status = `(Unreceivable: ${this.utilsService.formatTokenBalance(ourBalance.toString(), 2)} ${currency} owed by counterparty)`;
                                   ourBalance = 0;
                              } else if (isLow || isHigh) ourBalance = -ourBalance;

                              return {
                                   key: `Trust Line ${i + 1} (${currency}, Counterparty: ${counterparty})`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Currency', value: currency },
                                        { key: 'Account Balance', value: `${this.utilsService.formatTokenBalance(ourBalance.toString(), 2)} ${currency} ${status}` },
                                        { key: 'Account Limit', value: ourLimit },
                                        { key: 'Account Position', value: isLow ? 'Low Account' : 'High Account' },
                                        { key: 'Counterparty', value: `<code>${counterparty}</code>` },
                                        { key: 'Counter Party Limit', value: theirLimit },
                                        { key: 'Flags', value: this.decodeRippleStateFlags(line.Flags).join(', ') || 'None' },
                                   ],
                              };
                         }),
                    });
               }

               this.renderUiComponentsService.renderDetails(data);
               this.setSuccess(this.result);

               // Deferred token-balance update (shared for both branches)
               setTimeout(() => this.loadAndRenderTokenBalances(client, wallet, accountInfo, accountObjects, accountCurrencies, data), 0);
          } catch (error: any) {
               console.error('Error in getTrustlinesForAccount:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getTrustlinesForAccount in ${this.executionTime}ms`);
          }
     }

     /** Helper: load token balances, obligations, and balances, then update UI */
     private async loadAndRenderTokenBalances(client: any, wallet: any, accountInfo: any, accountObjects: any, accountCurrencies: any, data: any) {
          try {
               const tokenBalance = await this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '');
               console.debug('Token Balance:', tokenBalance.result);

               const addSection = (title: string, subItems: any[]) => data.sections.push({ title, openByDefault: true, subItems });

               // Obligations
               const obligations = tokenBalance.result.obligations;
               if (obligations && Object.keys(obligations).length > 0) {
                    const subItems = Object.entries(obligations).map(([currency, amount], i) => ({
                         key: `Obligation ${i + 1} (${this.utilsService.decodeIfNeeded(currency)})`,
                         openByDefault: false,
                         content: [
                              { key: 'Currency', value: this.utilsService.decodeIfNeeded(currency) },
                              { key: 'Amount', value: this.utilsService.formatTokenBalance(amount.toString(), 18) },
                         ],
                    }));
                    addSection(`Obligations (${subItems.length})`, subItems);
               }

               // Balances
               const assets = tokenBalance.result.assets;
               if (assets && Object.keys(assets).length > 0) {
                    const subItems: any[] = [];
                    for (const [issuer, currencies] of Object.entries(assets)) {
                         for (const { currency, value } of currencies) {
                              subItems.push({
                                   key: `${this.utilsService.formatCurrencyForDisplay(currency)} from ${issuer}`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Currency', value: this.utilsService.formatValueForKey('currency', currency) },
                                        { key: 'Issuer', value: `<code>${issuer}</code>` },
                                        { key: 'Amount', value: this.utilsService.formatTokenBalance(value, 2) },
                                   ],
                              });
                         }
                    }
                    addSection(`Balances (${subItems.length})`, subItems);
               }

               // Received/Sent currencies
               const { receive_currencies, send_currencies } = accountCurrencies.result;
               if (receive_currencies.length > 0) data.sections.push({ title: 'Received Currencies', openByDefault: true, content: [{ key: 'Status', value: this.processAccountCurrencies(accountCurrencies).receive.join(', ') }] });
               if (send_currencies.length > 0) data.sections.push({ title: 'Sent Currencies', openByDefault: true, content: [{ key: 'Status', value: this.processAccountCurrencies(accountCurrencies).send.join(', ') }] });

               // Balance parsing
               const parsedBalances = this.parseAllGatewayBalances(tokenBalance, wallet);
               console.debug('parseAllGatewayBalances:', parsedBalances);
               this.currencyBalanceField = parsedBalances?.[this.currencyField]?.[this.issuerFields] ?? '0';

               // Final render and UI updates
               this.renderUiComponentsService.renderDetails(data);
               this.refreshUIData(wallet, accountInfo, accountObjects);
               this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
               this.clearFields(true);
               this.updateTrustLineFlagsInUI(accountObjects, wallet);
               this.updateTickets(accountObjects);
               await this.updateXrpBalance(client, accountInfo, wallet);
          } catch (err) {
               console.error('Failed to load token balances:', err);
          }
     }

     // async getTrustlinesForAccount() {
     //      console.log('Entering getTrustlinesForAccount');
     //      const startTime = Date.now();
     //      this.setSuccessProperties();

     //      try {
     //           if (this.resultField?.nativeElement) {
     //                this.resultField.nativeElement.innerHTML = '';
     //           }
     //           this.updateSpinnerMessage(`Getting Trustlines`);

     //           const client = await this.xrplService.getClient();
     //           const wallet = await this.getWallet();

     //           const [accountInfo, accountObjects, accountCurrencies] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountCurrencies(client, wallet.classicAddress, 'validated', '')]);

     //           // Optional: Avoid heavy stringify — log only if needed
     //           console.debug(`account info:`, accountInfo.result);
     //           console.debug(`account objects:`, accountObjects.result);
     //           console.debug(`account currencies:`, accountCurrencies.result);

     //           const inputs: ValidationInputs = {
     //                seed: this.currentWallet.seed,
     //                account_info: accountInfo,
     //           };

     //           const errors = await this.validateInputs(inputs, 'getTrustlinesForAccount');
     //           if (errors.length > 0) {
     //                return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
     //           }

     //           const trustLinesFromObjects = accountObjects.result.account_objects.filter(obj => obj.LedgerEntryType === 'RippleState');

     //           // Filter by selected currency
     //           // const activeTrustLines = trustLinesFromObjects.filter((line: any) => {
     //           //      const decodedCurrency = this.utilsService.decodeIfNeeded(line.Balance.currency);
     //           //      // Determine which side is the issuer
     //           //      const issuerAddress = line.HighLimit.issuer === wallet.classicAddress ? line.LowLimit.issuer : line.HighLimit.issuer;
     //           //      return decodedCurrency === this.currencyField && issuerAddress === this.issuerFields;
     //           // });
     //           const activeTrustLines = trustLinesFromObjects.filter((line: any) => {
     //                const decodedCurrency = this.utilsService.decodeIfNeeded(line.Balance.currency);
     //                return decodedCurrency === this.currencyField;
     //           });

     //           type Section = {
     //                title: string;
     //                openByDefault: boolean;
     //                content?: { key: string; value: string }[];
     //                subItems?: {
     //                     key: string;
     //                     openByDefault: boolean;
     //                     content: { key: string; value: string }[];
     //                }[];
     //           };

     //           const data: { sections: Section[] } = { sections: [] };

     //           if (activeTrustLines.length === 0) {
     //                data.sections.push({
     //                     title: 'Trust Lines',
     //                     openByDefault: true,
     //                     content: [
     //                          {
     //                               key: 'Status',
     //                               value: `No active trust lines found for <code>${this.currencyField}</code> and <code>${wallet.classicAddress}</code>`,
     //                          },
     //                     ],
     //                });
     //                this.gatewayBalance = '';
     //           } else {
     //                // Group balances by counterparty
     //                const balanceByCounterparty = activeTrustLines.reduce((acc: { [key: string]: number }, line: xrpl.LedgerEntry.RippleState) => {
     //                     const currency = this.utilsService.decodeIfNeeded(line.Balance.currency);
     //                     const isOurWalletLow = wallet.classicAddress === line.LowLimit.issuer;
     //                     const isOurWalletHigh = wallet.classicAddress === line.HighLimit.issuer;

     //                     if (!isOurWalletLow && !isOurWalletHigh) return acc;

     //                     const counterparty = isOurWalletLow ? line.HighLimit.issuer : line.LowLimit.issuer;
     //                     let balance = parseFloat(line.Balance.value);

     //                     if (isOurWalletHigh) {
     //                          balance = 0;
     //                     } else if (isOurWalletLow) {
     //                          balance = -balance;
     //                     }

     //                     const key = `${currency}:${counterparty}`;
     //                     acc[key] = (acc[key] || 0) + balance;
     //                     return acc;
     //                }, {} as { [key: string]: number });

     //                // Format totals
     //                const totalBalances = Object.entries(balanceByCounterparty).map(([key, balance]) => {
     //                     const [currency, counterparty] = key.split(':');
     //                     return {
     //                          key: `Total ${currency} Balance (Counterparty: ${counterparty})`,
     //                          value: `${this.utilsService.formatTokenBalance(balance.toString(), 2)} ${currency}`,
     //                     };
     //                });

     //                data.sections.push({
     //                     title: `Trust Lines (${activeTrustLines.length})`,
     //                     openByDefault: true,
     //                     content: totalBalances,
     //                     subItems: activeTrustLines.map((line, index) => {
     //                          const currency = this.utilsService.decodeIfNeeded(line.Balance.currency);
     //                          const isOurWalletLow = wallet.classicAddress === line.LowLimit.issuer;
     //                          const isOurWalletHigh = wallet.classicAddress === line.HighLimit.issuer;
     //                          const counterparty = isOurWalletLow ? line.HighLimit.issuer : line.LowLimit.issuer;
     //                          const ourLimit = isOurWalletLow ? line.LowLimit.value : line.HighLimit.value;
     //                          const theirLimit = isOurWalletLow ? line.HighLimit.value : line.LowLimit.value;

     //                          let ourBalance = parseFloat(line.Balance.value);
     //                          let balanceStatus = '';

     //                          if (isOurWalletHigh) {
     //                               if (parseFloat(ourLimit) === 0) {
     //                                    balanceStatus = `(Unreceivable: ${this.utilsService.formatTokenBalance(ourBalance.toString(), 2)} ${currency} owed by counterparty)`;
     //                                    ourBalance = 0;
     //                               } else {
     //                                    ourBalance = -ourBalance;
     //                               }
     //                          } else if (isOurWalletLow) {
     //                               ourBalance = -ourBalance;
     //                          }

     //                          return {
     //                               key: `Trust Line ${index + 1} (${currency}, Counterparty: ${counterparty})`,
     //                               openByDefault: false,
     //                               content: [
     //                                    { key: 'Currency', value: currency },
     //                                    { key: 'Account Balance', value: `${this.utilsService.formatTokenBalance(ourBalance.toString(), 2)} ${currency} ${balanceStatus}` },
     //                                    { key: 'Account Limit', value: ourLimit },
     //                                    { key: 'Account Position', value: isOurWalletLow ? 'Low Account' : 'High Account' },
     //                                    { key: 'Counterparty', value: `<code>${counterparty}</code>` },
     //                                    { key: 'Counter Party Limit', value: theirLimit },
     //                                    { key: 'Flags', value: this.decodeRippleStateFlags(line.Flags).join(', ') || 'None' },
     //                               ],
     //                          };
     //                     }),
     //                });

     //                this.renderUiComponentsService.renderDetails(data);
     //                this.setSuccess(this.result);

     //                // DEFER: Non-critical UI updates. Fetch token balance and then re-render FULL data with all sections
     //                setTimeout(async () => {
     //                     try {
     //                          const tokenBalance = await this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '');
     //                          console.debug('Token Balance:', tokenBalance.result);

     //                          // --- Add Obligations Section ---
     //                          if (tokenBalance.result.obligations && Object.keys(tokenBalance.result.obligations).length > 0) {
     //                               const obligationsSection = {
     //                                    title: `Obligations (${Object.keys(tokenBalance.result.obligations).length})`,
     //                                    openByDefault: true,
     //                                    subItems: Object.entries(tokenBalance.result.obligations).map(([currency, amount], index) => ({
     //                                         key: `Obligation ${index + 1} (${this.utilsService.decodeIfNeeded(currency)})`,
     //                                         openByDefault: false,
     //                                         content: [
     //                                              { key: 'Currency', value: this.utilsService.decodeIfNeeded(currency) },
     //                                              { key: 'Amount', value: this.utilsService.formatTokenBalance(amount.toString(), 18) },
     //                                         ],
     //                                    })),
     //                               };
     //                               data.sections.push(obligationsSection);
     //                          }

     //                          // --- Add Balances Section ---
     //                          if (tokenBalance.result.assets && Object.keys(tokenBalance.result.assets).length > 0) {
     //                               const balanceItems = [];
     //                               for (const [issuer, currencies] of Object.entries(tokenBalance.result.assets)) {
     //                                    for (const { currency, value } of currencies) {
     //                                         const displayCurrency = this.utilsService.formatValueForKey('currency', currency);
     //                                         balanceItems.push({
     //                                              key: `${this.utilsService.formatCurrencyForDisplay(currency)} from ${issuer}`,
     //                                              openByDefault: false,
     //                                              content: [
     //                                                   { key: 'Currency', value: displayCurrency },
     //                                                   { key: 'Issuer', value: `<code>${issuer}</code>` },
     //                                                   { key: 'Amount', value: this.utilsService.formatTokenBalance(value, 2) },
     //                                              ],
     //                                         });
     //                                    }
     //                               }
     //                               const balancesSection = {
     //                                    title: `Balances (${balanceItems.length})`,
     //                                    openByDefault: true,
     //                                    subItems: balanceItems,
     //                               };
     //                               data.sections.push(balancesSection);
     //                          }

     //                          if (accountCurrencies.result.receive_currencies.length > 0) {
     //                               data.sections.push({
     //                                    title: 'Received Currencies',
     //                                    openByDefault: true,
     //                                    content: [
     //                                         {
     //                                              key: 'Status',
     //                                              value: this.processAccountCurrencies(accountCurrencies).receive.join(', '),
     //                                         },
     //                                    ],
     //                               });
     //                          }

     //                          if (accountCurrencies.result.send_currencies.length > 0) {
     //                               data.sections.push({
     //                                    title: 'Sent Currencies',
     //                                    openByDefault: true,
     //                                    content: [
     //                                         {
     //                                              key: 'Status',
     //                                              value: this.processAccountCurrencies(accountCurrencies).send.join(', '),
     //                                         },
     //                                    ],
     //                               });
     //                          }

     //                          console.debug(`parseAllGatewayBalances:`, this.parseAllGatewayBalances(tokenBalance, wallet));
     //                          const parsedBalances = this.parseAllGatewayBalances(tokenBalance, wallet);
     //                          if (parsedBalances && Object.keys(parsedBalances).length > 0) {
     //                               this.currencyBalanceField = parsedBalances?.[this.currencyField]?.[this.issuerFields] ?? '0';
     //                          } else {
     //                               this.currencyBalanceField = '0';
     //                          }

     //                          // RENDER FULL DATA — Trust Lines + Obligations + Balances
     //                          this.renderUiComponentsService.renderDetails(data);

     //                          // --- Final UI Updates ---
     //                          this.refreshUIData(wallet, accountInfo, accountObjects);
     //                          this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
     //                          this.clearFields(true);
     //                          this.updateTrustLineFlagsInUI(accountObjects, wallet);
     //                          this.updateTickets(accountObjects);
     //                          await this.updateXrpBalance(client, accountInfo, wallet);
     //                     } catch (err) {
     //                          console.error('Failed to load token balances:', err);
     //                          // Don't break UI — already rendered trust lines
     //                     }
     //                }, 0);
     //           }

     //           // If no active trustlines, render immediately
     //           if (activeTrustLines.length === 0) {
     //                data.sections.push({
     //                     title: 'Trust Lines',
     //                     openByDefault: true,
     //                     content: [
     //                          {
     //                               key: 'Status',
     //                               value: `No active trust lines found for <code>${this.currencyField}</code> and <code>${wallet.classicAddress}</code>`,
     //                          },
     //                     ],
     //                });
     //                this.gatewayBalance = '';

     //                // Render immediately
     //                this.renderUiComponentsService.renderDetails(data);
     //                this.setSuccess(this.result);

     //                // Still fetch token balances and re-render with them
     //                setTimeout(async () => {
     //                     try {
     //                          const tokenBalance = await this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '');
     //                          console.log(`tokenBalance`, tokenBalance);

     //                          // Add Obligations
     //                          if (tokenBalance.result.obligations && Object.keys(tokenBalance.result.obligations).length > 0) {
     //                               const obligationsSection = {
     //                                    title: `Obligations (${Object.keys(tokenBalance.result.obligations).length})`,
     //                                    openByDefault: true,
     //                                    subItems: Object.entries(tokenBalance.result.obligations).map(([currency, amount], index) => ({
     //                                         key: `Obligation ${index + 1} (${this.utilsService.decodeIfNeeded(currency)})`,
     //                                         openByDefault: false,
     //                                         content: [
     //                                              { key: 'Currency', value: this.utilsService.decodeIfNeeded(currency) },
     //                                              { key: 'Amount', value: String(amount) },
     //                                         ],
     //                                    })),
     //                               };
     //                               data.sections.push(obligationsSection);
     //                          }

     //                          // Add Balances
     //                          if (tokenBalance.result.assets && Object.keys(tokenBalance.result.assets).length > 0) {
     //                               const balanceItems = [];
     //                               for (const [issuer, currencies] of Object.entries(tokenBalance.result.assets)) {
     //                                    for (const { currency, value } of currencies) {
     //                                         const displayCurrency = this.utilsService.formatValueForKey('currency', currency);
     //                                         balanceItems.push({
     //                                              key: `${this.utilsService.formatCurrencyForDisplay(currency)} from ${issuer}`,
     //                                              openByDefault: false,
     //                                              content: [
     //                                                   { key: 'Currency', value: displayCurrency },
     //                                                   { key: 'Issuer', value: `<code>${issuer}</code>` },
     //                                                   { key: 'Amount', value: value },
     //                                              ],
     //                                         });
     //                                    }
     //                               }
     //                               const balancesSection = {
     //                                    title: `Balances (${balanceItems.length})`,
     //                                    openByDefault: true,
     //                                    subItems: balanceItems,
     //                               };
     //                               data.sections.push(balancesSection);
     //                          }

     //                          console.debug(`parseAllGatewayBalances`, this.parseAllGatewayBalances(tokenBalance, wallet));
     //                          const parsedBalances = this.parseAllGatewayBalances(tokenBalance, wallet);
     //                          if (parsedBalances && Object.keys(parsedBalances).length > 0) {
     //                               this.currencyBalanceField = parsedBalances?.[this.currencyField]?.[this.issuerFields] ?? '0';
     //                          } else {
     //                               this.currencyBalanceField = '0';
     //                          }

     //                          // Re-render with all sections
     //                          this.renderUiComponentsService.renderDetails(data);

     //                          // Final UI updates
     //                          this.refreshUIData(wallet, accountInfo, accountObjects);
     //                          this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
     //                          this.clearFields(false);
     //                          this.updateTrustLineFlagsInUI(accountObjects, wallet);
     //                          this.updateTickets(accountObjects);
     //                          await this.updateXrpBalance(client, accountInfo, wallet);
     //                     } catch (err) {
     //                          console.error('Failed to load token balances:', err);
     //                          // Don't break main flow — account details are already rendered
     //                     }
     //                }, 0);
     //           }
     //      } catch (error: any) {
     //           console.error('Error in getTrustlinesForAccount:', error);
     //           this.setError(`ERROR: ${error.message || 'Unknown error'}`);
     //      } finally {
     //           this.spinner = false;
     //           this.executionTime = (Date.now() - startTime).toString();
     //           console.log(`Leaving getTrustlinesForAccount in ${this.executionTime}ms`);
     //      }
     // }

     async setTrustLine() {
          console.log('Entering setTrustLine');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               seed: this.currentWallet.seed,
               selectedAccount: this.currentWallet.address,
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

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Trustline (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const [accountInfo, fee, currentLedger, accountLines, serverInfo] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', ''), this.xrplService.getXrplServerInfo(client, 'current', '')]);

               // Optional: Avoid heavy stringify — log only if needed
               console.debug(`accountInfo :`, accountInfo.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);
               console.debug(`accountLines :`, accountLines);

               inputs.account_info = accountInfo;

               const errors = await this.validateInputs(inputs, 'setTrustLine');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               if (this.trustlineFlags['tfSetNoRipple'] && this.trustlineFlags['tfClearNoRipple']) {
                    return this.setError('ERROR: Cannot set both tfSetNoRipple and tfClearNoRipple');
               }
               if (this.trustlineFlags['tfSetFreeze'] && this.trustlineFlags['tfClearFreeze']) {
                    return this.setError('ERROR: Cannot set both tfSetFreeze and tfClearFreeze');
               }

               let currencyFieldTemp = this.utilsService.encodeIfNeeded(this.currencyField);
               if (!/^[A-Z0-9]{3}$|^[0-9A-Fa-f]{40}$/.test(currencyFieldTemp)) {
                    throw new Error('Invalid currency code. Must be a 3-character code (e.g., USDC) or 40-character hex.');
               }

               // Calculate flags
               let flags = 0;
               Object.entries(this.trustlineFlags).forEach(([key, value]) => {
                    if (value) {
                         flags |= AppConstants.TRUSTLINE.FLAG_MAP[key as keyof typeof AppConstants.TRUSTLINE.FLAG_MAP];
                    }
               });

               let trustSetTx: xrpl.TrustSet = {
                    TransactionType: 'TrustSet',
                    Account: wallet.classicAddress,
                    LimitAmount: {
                         currency: currencyFieldTemp,
                         issuer: this.issuerFields,
                         value: this.amountField,
                    },
                    Flags: flags,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               await this.setTxOptionalFields(client, trustSetTx, wallet, accountInfo);

               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, trustSetTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Setting Trustline (no changes will be made)...' : 'Submitting to Ledger...');

               let response: any;

               if (this.isSimulateEnabled) {
                    response = await this.xrplTransactions.simulateTransaction(client, trustSetTx);
               } else {
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    const signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, trustSetTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

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
                              this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              await this.updateXrpBalance(client, updatedAccountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
          } catch (error: any) {
               console.error('Error in setTrustLine:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving setTrustLine in ${this.executionTime}ms`);
          }
     }

     async removeTrustline() {
          console.log('Entering removeTrustline');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               seed: this.currentWallet.seed,
               selectedAccount: this.selectedAccount,
               destination: this.destinationFields,
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
               const mode = this.isSimulateEnabled ? 'simulating removal' : 'removing';
               this.updateSpinnerMessage(`Preparing Trustline Removal (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const [accountInfo, serverInfo, fee, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getXrplServerInfo(client, 'current', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client)]);

               // Optional: Avoid heavy stringify — log only if needed
               console.debug(`accountInfo :`, accountInfo.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);
               console.debug(`serverInfo :`, serverInfo);

               inputs.account_info = accountInfo;

               const errors = await this.validateInputs(inputs, 'removeTrustline');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               if (this.trustlineFlags['tfSetNoRipple'] && this.trustlineFlags['tfClearNoRipple']) {
                    return this.setError('ERROR: Cannot set both tfSetNoRipple and tfClearNoRipple');
               }
               if (this.trustlineFlags['tfSetFreeze'] && this.trustlineFlags['tfClearFreeze']) {
                    return this.setError('ERROR: Cannot set both tfSetFreeze and tfClearFreeze');
               }

               const trustLines = await this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', '');

               const trustLine = trustLines.result.lines.find((line: any) => {
                    const lineCurrency = this.utilsService.decodeIfNeeded(line.currency);
                    return line.account === this.issuerFields && lineCurrency === this.currencyField;
               });

               if (!trustLine) {
                    this.resultField.nativeElement.innerHTML = `No trust line found for ${this.currencyField} to issuer ${this.destinationFields}`;
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               // Validate all trustlines are removable
               for (const line of trustLines.result.lines) {
                    const check = this.canRemoveTrustline(line);
                    if (!check.canRemove) {
                         return this.setError(`Cannot remove trustline ${line.currency}/${line.account}: ${check.reasons}`);
                    }
               }

               let currencyFieldTemp = this.utilsService.encodeIfNeeded(this.currencyField);
               let flags = 0;
               Object.entries(this.trustlineFlags).forEach(([key, value]) => {
                    if (value) {
                         flags |= AppConstants.TRUSTLINE.FLAG_MAP[key as keyof typeof AppConstants.TRUSTLINE.FLAG_MAP];
                    }
               });

               const trustSetTx: xrpl.TrustSet = {
                    TransactionType: 'TrustSet',
                    Account: wallet.classicAddress,
                    LimitAmount: {
                         currency: currencyFieldTemp,
                         issuer: this.issuerFields,
                         value: '0',
                    },
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               trustSetTx.Flags = flags;
               // delete trustSetTx.Flags; // Removing trustline — no flags needed

               await this.setTxOptionalFields(client, trustSetTx, wallet, accountInfo);

               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, trustSetTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Removing Trustline (no changes will be made)...' : 'Submitting to Ledger...');

               let response: any;

               if (this.isSimulateEnabled) {
                    response = await this.xrplTransactions.simulateTransaction(client, trustSetTx);
               } else {
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    const signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, trustSetTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign transaction.');
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
                              this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              await this.updateXrpBalance(client, updatedAccountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
          } catch (error: any) {
               console.error('Error in removeTrustline:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving removeTrustline in ${this.executionTime}ms`);
          }
     }

     async issueCurrency() {
          console.log('Entering issueCurrency');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               seed: this.currentWallet.seed,
               selectedAccount: this.selectedAccount,
               senderAddress: this.currentWallet.address,
               destinationTag: this.destinationTagField,
               amount: this.amountField,
               destination: this.destinationFields,
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
               const mode = this.isSimulateEnabled ? 'simulating' : 'issuing';
               this.updateSpinnerMessage(`Preparing Currency Issuance (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               let [accountInfo, fee, lastLedgerIndex, trustLines, serverInfo] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', ''), this.xrplService.getXrplServerInfo(client, 'current', '')]);

               // Optional: Avoid heavy stringify — log only if needed
               console.debug(`accountInfo :`, accountInfo.result);
               console.debug(`fee :`, fee);
               console.debug(`lastLedgerIndex :`, lastLedgerIndex);
               console.debug(`trustLines :`, trustLines);
               console.debug(`serverInfo :`, serverInfo);

               inputs.account_info = accountInfo;

               const errors = await this.validateInputs(inputs, 'issueCurrency');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               const accountFlags = accountInfo.result.account_data.Flags;
               const asfDefaultRipple = 0x00800000;
               let data: { sections: any[] } = { sections: [] };

               if ((accountFlags & asfDefaultRipple) === 0) {
                    // Need to enable DefaultRipple first
                    const accountSetTx: xrpl.AccountSet = {
                         TransactionType: 'AccountSet',
                         Account: wallet.classicAddress,
                         SetFlag: 8, // asfDefaultRipple
                         Fee: fee,
                         LastLedgerSequence: lastLedgerIndex + AppConstants.LAST_LEDGER_ADD_TIME,
                    };

                    await this.setTxOptionalFields(client, accountSetTx, wallet, accountInfo);

                    if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, accountSetTx, fee)) {
                         return this.setError('ERROR: Insufficient XRP to complete transaction');
                    }

                    let response: any;

                    if (this.isSimulateEnabled) {
                         response = await this.xrplTransactions.simulateTransaction(client, accountSetTx);
                    } else {
                         const signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, accountSetTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                         if (!signedTx) {
                              return this.setError('ERROR: Failed to sign AccountSet transaction.');
                         }

                         const response = await this.xrplTransactions.submitTransaction(client, signedTx);

                         this.renderTransactionResult(response);

                         const isSuccess = this.utilsService.isTxSuccessful(response);
                         if (!isSuccess) {
                              const resultMsg = this.utilsService.getTransactionResultMessage(response);
                              const userMessage = 'Transaction failed.\n' + this.utilsService.processErrorMessageFromLedger(resultMsg);

                              console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                              (response.result as any).errorMessage = userMessage;
                         }

                         data.sections.push({
                              title: 'DefaultRipple Enabled',
                              openByDefault: true,
                              content: [{ key: 'Status', value: `Enabled via AccountSet transaction for <code>${wallet.classicAddress}</code>` }],
                         });
                    }
                    // Update lastLedgerIndex for next transaction
                    lastLedgerIndex = await this.xrplService.getLastLedgerIndex(client);
               } else {
                    data.sections.push({
                         title: 'DefaultRipple Enabled',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `Default Ripple already enabled for <code>${wallet.classicAddress}</code>` }],
                    });
               }

               // PHASE 4: Prepare Payment transaction for currency issuance
               const curr = this.utilsService.encodeIfNeeded(this.currencyField);
               const paymentTx: xrpl.Payment = {
                    TransactionType: 'Payment',
                    Account: wallet.classicAddress,
                    Destination: this.destinationFields,
                    Amount: {
                         currency: curr,
                         value: this.amountField,
                         issuer: this.destinationFields,
                    },
                    Fee: fee,
                    LastLedgerSequence: lastLedgerIndex + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               await this.setTxOptionalFields(client, paymentTx, wallet, accountInfo);

               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, paymentTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               // if (this.utilsService.isInsufficientIouTrustlineBalance(trustLines, paymentTx, this.destinationFields)) {
               //      return this.setError('ERROR: Not enough IOU balance for this transaction');
               // }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Currency Issuance (no changes will be made)...' : 'Submitting Currency Issuance to Ledger...');

               let response;

               if (this.isSimulateEnabled) {
                    response = await this.xrplTransactions.simulateTransaction(client, paymentTx);
               } else {
                    const signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, paymentTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

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

               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               // Only fetch additional data and update UI if not in simulation mode
               if (!this.isSimulateEnabled) {
                    // Fetch updated trust lines and gateway balances in parallel
                    const [updatedTrustLines, gatewayBalances, newBalance] = await Promise.all([this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', ''), this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', ''), client.getXrpBalance(wallet.classicAddress)]);

                    // Add New Balance section
                    const decodedCurrency = this.utilsService.decodeIfNeeded(this.currencyField);
                    const newTrustLine = updatedTrustLines.result.lines.find((line: any) => line.currency === decodedCurrency && (line.account === this.destinationFields || line.account === this.destinationFields));

                    // Optional: Avoid heavy stringify in logs
                    console.debug(`updatedTrustLines :`, updatedTrustLines.result);
                    console.debug(`newTrustLine :`, newTrustLine);
                    console.debug(`gatewayBalances :`, gatewayBalances.result);

                    data.sections.push({
                         title: 'New Balance',
                         openByDefault: true,
                         content: [
                              { key: 'Destination', value: `<code>${this.destinationFields}</code>` },
                              { key: 'Currency', value: this.currencyField },
                              { key: 'Balance', value: newTrustLine ? this.utilsService.formatTokenBalance(newTrustLine.balance.toString(), 2) : 'Unknown' },
                         ],
                    });

                    // Add Issuer Obligations section
                    if (gatewayBalances.result.obligations && Object.keys(gatewayBalances.result.obligations).length > 0) {
                         data.sections.push({
                              title: `Issuer Obligations (${Object.keys(gatewayBalances.result.obligations).length})`,
                              openByDefault: true,
                              subItems: Object.entries(gatewayBalances.result.obligations).map(([oblCurrency, amount], index) => ({
                                   key: `Obligation ${index + 1} (${oblCurrency})`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Currency', value: oblCurrency },
                                        { key: 'Amount', value: this.utilsService.formatTokenBalance(amount.toString(), 2) },
                                   ],
                              })),
                         });
                    } else {
                         data.sections.push({
                              title: 'Issuer Obligations',
                              openByDefault: true,
                              content: [{ key: 'Status', value: 'No obligations issued' }],
                         });
                    }

                    // Add Account Details section
                    data.sections.push({
                         title: 'Account Details',
                         openByDefault: true,
                         content: [
                              { key: 'Issuer Address', value: `<code>${wallet.classicAddress}</code>` },
                              { key: 'Destination Address', value: `<code>${this.destinationFields}</code>` },
                              { key: 'XRP Balance (Issuer)', value: this.utilsService.formatTokenBalance(newBalance.toString(), 2) },
                              // { key: 'XRP Balance (Issuer)', value: (await client.getXrpBalance(wallet.classicAddress)).toString() },
                         ],
                    });

                    this.renderUiComponentsService.renderDetails(data);
                    (response.result as any).clearInnerHtml = false;
                    this.renderUiComponentsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.result);

                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              await this.updateCurrencyBalance(gatewayBalances, wallet);
                              // this.updateGatewayBalance(gatewayBalances, wallet);
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              await this.updateXrpBalance(client, updatedAccountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
          } catch (error: any) {
               console.error('Error in issueCurrency:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving issueCurrency in ${this.executionTime}ms`);
          }
     }

     async clawbackTokens() {
          console.log('Entering clawbackTokens');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               seed: this.currentWallet.seed,
               selectedAccount: this.selectedAccount,
               amount: this.amountField,
               destination: this.destinationFields,
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
               const mode = this.isSimulateEnabled ? 'simulating' : 'clawing back';
               this.updateSpinnerMessage(`Preparing Token Clawback (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const [accountInfo, accountObjects, trustLines, serverInfo, fee, currentLedger] = await Promise.all([
                    this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''),
                    this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''),
                    this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', ''),
                    this.xrplService.getXrplServerInfo(client, 'current', ''),
                    this.xrplService.calculateTransactionFee(client),
                    this.xrplService.getLastLedgerIndex(client),
               ]);

               // Optional: Avoid heavy stringify — log only if needed
               console.debug(`accountInfo :`, accountInfo.result);
               console.debug(`accountObjects :`, accountObjects.result);
               console.debug(`trustLines :`, trustLines.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);
               console.debug(`serverInfo :`, serverInfo);

               inputs.account_info = accountInfo;

               const errors = await this.validateInputs(inputs, 'clawbackTokens');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               const currencyFieldTemp = this.utilsService.encodeIfNeeded(this.currencyField);
               if (!/^[A-Z0-9]{3}$|^[0-9A-Fa-f]{40}$/.test(currencyFieldTemp)) {
                    throw new Error('Invalid currency code. Must be a 3-character code (e.g., USDC) or 40-character hex.');
               }

               let clawbackTx: xrpl.Clawback = {
                    TransactionType: 'Clawback',
                    Account: wallet.classicAddress,
                    Amount: {
                         currency: currencyFieldTemp,
                         issuer: this.destinationFields,
                         value: this.amountField,
                    },
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               await this.setTxOptionalFields(client, clawbackTx, wallet, accountInfo);

               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, clawbackTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               if (this.utilsService.isInsufficientIouTrustlineBalance(trustLines, clawbackTx, this.destinationFields)) {
                    return this.setError('ERROR: Not enough IOU balance for this transaction');
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Token Clawback (no tokens will be moved)...' : 'Submitting Clawback to Ledger...');

               let response;

               if (this.isSimulateEnabled) {
                    response = await this.xrplTransactions.simulateTransaction(client, clawbackTx);
               } else {
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    const signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, clawbackTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign transaction.');
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
                    const [updatedAccountInfo, updatedAccountObjects, gatewayBalancePromise] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              await this.updateCurrencyBalance(gatewayBalancePromise, wallet);
                              // this.updateGatewayBalance(gatewayBalancePromise, wallet);
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              await this.updateXrpBalance(client, updatedAccountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
          } catch (error: any) {
               console.error('Error in clawbackTokens:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving clawbackTokens in ${this.executionTime}ms`);
          }
     }

     async onCurrencyChange(): Promise<void> {
          console.log('Entering onCurrencyChange');
          const startTime = Date.now();
          this.setSuccessProperties();

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const [gatewayBalances] = await Promise.all([this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '')]);

               let balanceTotal = 0;
               const currency = this.utilsService.formatCurrencyForDisplay(this.currencyField);

               if (gatewayBalances.result.assets) {
                    for (const [issuer, currencies] of Object.entries(gatewayBalances.result.assets)) {
                         for (const { currency: cur, value } of currencies) {
                              if (this.utilsService.formatCurrencyForDisplay(cur) === currency) {
                                   balanceTotal += Number(value);
                              }
                         }
                    }
               }

               this.gatewayBalance = this.utilsService.formatTokenBalance(balanceTotal.toString(), 18);

               const encodedCurr = this.utilsService.encodeIfNeeded(this.currencyField);
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
               // let uniqueIssuers = issuerResults.filter((i): i is { name: string; address: string } => i !== null).filter((candidate, index, self) => index === self.findIndex(c => c.address === candidate.address));

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

               console.log('Unique issuers:', uniqueIssuers);

               // Always include the current wallet in issuers
               // if (!uniqueIssuers.some(i => i.address === wallet.classicAddress)) {
               //      uniqueIssuers.push({ name: this.currentWallet.name || 'Current Account', address: wallet.classicAddress });
               // }

               this.issuers = uniqueIssuers;

               const knownIssuers = this.knownTrustLinesIssuers[this.currencyField] || [];

               if (!this.issuerFields || !this.issuers.some(iss => iss.address === this.issuerFields)) {
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

                    this.issuerFields = newIssuer;
               }

               // this.issuers = uniqueIssuers;

               // const knownIssuer = this.knownTrustLinesIssuers[this.currencyField];
               // if (!this.issuerFields || !this.issuers.some(iss => iss.address === this.issuerFields)) {
               //      let newIssuer = '';
               //      if (knownIssuer && this.issuers.some(iss => iss.address === knownIssuer)) {
               //           newIssuer = knownIssuer;
               //      } else if (this.issuers.length > 0) {
               //           newIssuer = this.issuers[0].address;
               //      } else {
               //           newIssuer = '';
               //      }
               //      this.issuerFields = newIssuer;
               // }

               if (this.issuers.length === 0) {
                    console.warn(`No issuers found among wallets for currency: ${this.currencyField}`);
               }

               this.ensureDefaultNotSelected();

               await this.updateCurrencyBalance(gatewayBalances, wallet);

               const currencyChanged = this.lastCurrency !== this.currencyField;
               const issuerChanged = this.lastIssuer !== this.issuerFields;
               if (currencyChanged || issuerChanged) {
                    this.lastCurrency = this.currencyField;
                    this.lastIssuer = this.issuerFields;
               }

               // ✅ Only call getTrustlinesForAccount after the first load
               if (!this.isInitialLoad) {
                    await this.getTrustlinesForAccount();
               } else {
                    this.isInitialLoad = false; // mark that we've completed the first load
               }
               // await this.getTrustlinesForAccount();
          } catch (error: any) {
               this.currencyBalanceField = '0';
               this.gatewayBalance = '0';
               console.error('Error in onCurrencyChange:', error);
               this.setError(`ERROR: Failed to fetch balance - ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               console.log(`Leaving onCurrencyChange in ${(Date.now() - startTime).toString()}ms`);
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

     private async setTxOptionalFields(client: xrpl.Client, trustSetTx: any, wallet: xrpl.Wallet, accountInfo: any) {
          try {
               if (this.selectedSingleTicket) {
                    const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.selectedSingleTicket));
                    if (!ticketExists) {
                         // return this.setError(`ERROR: Ticket Sequence ${this.selectedSingleTicket} not found for account ${wallet.classicAddress}`);
                         throw `ERROR: Ticket Sequence ${this.selectedSingleTicket} not found for account ${wallet.classicAddress}`;
                    }
                    this.utilsService.setTicketSequence(trustSetTx, this.selectedSingleTicket, true);
               } else {
                    if (this.multiSelectMode && this.selectedTickets.length > 0) {
                         console.log('Setting multiple tickets:', this.selectedTickets);
                         this.utilsService.setTicketSequence(trustSetTx, accountInfo.result.account_data.Sequence, false);
                    }
               }

               if (this.destinationTagField && parseInt(this.destinationTagField) > 0) {
                    this.utilsService.setDestinationTag(trustSetTx, this.destinationTagField);
               }
               if (this.memoField) {
                    this.utilsService.setMemoField(trustSetTx, this.memoField);
               }
          } catch (error: any) {
               throw new Error(error.message);
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

     private updateTickets(accountObjects: xrpl.AccountObjectsResponse) {
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

          if (regularKey) {
               this.regularKeySigningEnabled = true;
          } else {
               this.regularKeySigningEnabled = false;
          }
     }

     private updateTrustLineFlagsInUI(accountObjects: xrpl.AccountObjectsResponse, wallet: xrpl.Wallet) {
          const currency = this.utilsService.encodeIfNeeded(this.currencyField ? this.currencyField : '');

          const rippleState = accountObjects.result.account_objects.find(obj => obj.LedgerEntryType === 'RippleState' && obj.Balance && obj.Balance.currency === currency) as xrpl.LedgerEntry.RippleState | undefined;

          if (rippleState) {
               this.debugTrustlineFlags(rippleState, wallet);
               const flagsNumber: number = rippleState.Flags ?? 0;

               // Correct way: check if your wallet is the low side
               const isLowAddress = wallet.classicAddress === rippleState.LowLimit.issuer;

               if (isLowAddress) {
                    this.trustlineFlags['tfSetfAuth'] = !!(flagsNumber & AppConstants.TRUSTLINE.LEDGER_FLAG_MAP.lsfLowAuth);
                    this.trustlineFlags['tfSetNoRipple'] = !!(flagsNumber & AppConstants.TRUSTLINE.LEDGER_FLAG_MAP.lsfNoRipple); // Adjusted key
                    this.trustlineFlags['tfSetFreeze'] = !!(flagsNumber & AppConstants.TRUSTLINE.LEDGER_FLAG_MAP.lsfLowFreeze);
               } else {
                    this.trustlineFlags['tfSetfAuth'] = !!(flagsNumber & AppConstants.TRUSTLINE.LEDGER_FLAG_MAP.lsfHighAuth);
                    this.trustlineFlags['tfSetNoRipple'] = !!(flagsNumber & AppConstants.TRUSTLINE.LEDGER_FLAG_MAP.lsfNoRipple); // Adjusted for high (note: constants may need lsfHighNoRipple: 0x00200000)
                    this.trustlineFlags['tfSetFreeze'] = !!(flagsNumber & AppConstants.TRUSTLINE.LEDGER_FLAG_MAP.lsfHighFreeze);
               }

               // Clear flags are just inverses
               this.trustlineFlags['tfClearNoRipple'] = !this.trustlineFlags['tfSetNoRipple'];
               this.trustlineFlags['tfClearFreeze'] = !this.trustlineFlags['tfSetFreeze'];

               // Not applicable for trustlines
               this.trustlineFlags['tfPartialPayment'] = false;
               this.trustlineFlags['tfNoDirectRipple'] = false;
               this.trustlineFlags['tfLimitQuality'] = false;

               this.showTrustlineOptions = true;
          } else {
               // No trustline → reset UI
               this.trustlineFlags = { ...AppConstants.TRUSTLINE.FLAGS };
               this.showTrustlineOptions = false;
          }
     }

     private debugTrustlineFlags(rippleState: xrpl.LedgerEntry.RippleState, wallet: xrpl.Wallet) {
          const flagsNumber: number = rippleState.Flags ?? 0;
          const isLowAddress = wallet.classicAddress === rippleState.LowLimit.issuer;
          const ledgerMap = AppConstants.TRUSTLINE.LEDGER_FLAG_MAP;

          console.debug('Trustline Debug\n -----------------------------------------');
          console.debug('Currency:', rippleState.Balance.currency);
          console.debug('You are the', isLowAddress ? 'LOW side' : 'HIGH side');
          console.debug('Flags (decimal):', flagsNumber, ' hex:', '0x' + flagsNumber.toString(16));

          if (isLowAddress) {
               console.debug('LowAuth:', !!(flagsNumber & ledgerMap.lsfLowAuth));
               console.debug('LowNoRipple:', !!(flagsNumber & ledgerMap.lsfNoRipple)); // Adjusted
               console.debug('LowFreeze:', !!(flagsNumber & ledgerMap.lsfLowFreeze));
          } else {
               console.debug('HighAuth:', !!(flagsNumber & ledgerMap.lsfHighAuth));
               console.debug('HighNoRipple:', !!(flagsNumber & ledgerMap.lsfNoRipple)); // Adjusted
               console.debug('HighFreeze:', !!(flagsNumber & ledgerMap.lsfHighFreeze));
          }
          console.debug('-----------------------------------------');
     }

     private decodeRippleStateFlags(flags: number): string[] {
          return Object.entries(AppConstants.TRUSTLINE.LEDGER_FLAG_MAP)
               .filter(([_, bit]) => (flags & bit) !== 0)
               .map(([name]) => name);
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
               getTrustlinesForAccount: {
                    required: ['seed'],
                    customValidators: [() => isValidSeed(inputs.seed), () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null)],
                    asyncValidators: [],
               },
               setTrustLine: {
                    required: ['seed', 'amount', 'destination'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.amount, 'Amount', 0),
                         () => isValidXrpAddress(inputs.destination, 'Destination'),
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
                    asyncValidators: [],
               },
               removeTrustline: {
                    required: ['seed', 'destination'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidXrpAddress(inputs.destination, 'Destination'),
                         () => isValidNumber(inputs.destinationTag, 'Destination Tag', 0),
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
                    asyncValidators: [],
               },
               issueCurrency: {
                    required: ['seed', 'amount', 'destination'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.amount, 'Amount', 0),
                         () => isValidXrpAddress(inputs.destination, 'Destination'),
                         () => isValidNumber(inputs.destinationTag, 'Destination Tag', 0, true), // Allow empty
                         () => isNotSelfPayment(inputs.senderAddress, inputs.destination),
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
               onCurrencyChange: {
                    required: ['seed'],
                    customValidators: [() => isValidSeed(inputs.seed), () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null)],
                    asyncValidators: [],
               },
               clawbackTokens: {
                    required: ['seed', 'amount', 'destination'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.amount, 'Amount', 0),
                         () => isValidXrpAddress(inputs.destination, 'Destination'),
                         () => isValidNumber(inputs.destinationTag, 'Destination Tag', 0, true), // Allow empty
                         () => isNotSelfPayment(inputs.senderAddress, inputs.destination),
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

     private ensureDefaultNotSelected() {
          const currentAddress = this.currentWallet.address;
          if (currentAddress && this.destinations.length > 0) {
               if (!this.destinationFields) {
                    const nonSelectedDest = this.destinations.find(d => d.address !== currentAddress);
                    this.destinationFields = nonSelectedDest ? nonSelectedDest.address : this.destinations[0].address;
               }
          }
          if (currentAddress && this.issuers.length > 0) {
               if (!this.issuerFields) {
                    const nonSelectedIss = this.issuers.find(i => i.address !== currentAddress);
                    this.issuerFields = nonSelectedIss ? nonSelectedIss.address : this.issuers[0].address;
               }
          }
          this.cdr.detectChanges();
     }

     updateDestinations() {
          this.destinations = this.wallets.map(w => ({ name: w.name, address: w.address }));
          this.issuers = this.wallets.map(w => ({ name: w.name, address: w.address }));
          this.ensureDefaultNotSelected();
          this.cdr.detectChanges();
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

     get currencyOptions(): string[] {
          return Object.values(this.currencies).filter(key => key !== 'XRP');
     }

     private async getWallet() {
          const environment = this.xrplService.getNet().environment;
          const seed = this.currentWallet.seed;
          const wallet = await this.utilsService.getWallet(seed, environment);
          if (!wallet) {
               throw new Error('ERROR: Wallet could not be created or is undefined');
          }
          return wallet;
     }

     clearFields(clearAllFields: boolean) {
          if (clearAllFields) {
               this.amountField = '';
               this.destinationTagField = '';
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
     }

     private async updateCurrencyBalance(gatewayBalance: xrpl.GatewayBalancesResponse, wallet: xrpl.Wallet) {
          const parsedBalances = this.parseAllGatewayBalances(gatewayBalance, wallet);
          if (parsedBalances && Object.keys(parsedBalances).length > 0) {
               this.currencyBalanceField = parsedBalances[this.currencyField]?.[wallet.classicAddress] ?? parsedBalances[this.currencyField]?.[this.issuerFields] ?? '0';
          } else {
               this.currencyBalanceField = '0';
          }
     }

     private updateGatewayBalance(gatewayBalances: xrpl.GatewayBalancesResponse, wallet: xrpl.Wallet, issuer?: string) {
          const result = gatewayBalances.result;
          const displayCurrency = this.utilsService.encodeIfNeeded(this.currencyField);
          let balance = '0';

          // --- Case 1: This account is the gateway (it issues IOUs)
          if (result.obligations && Object.keys(result.obligations).length > 0) {
               if (result.obligations[displayCurrency]) {
                    // Obligations do NOT have an issuer field (they’re from this gateway)
                    balance = this.utilsService.formatTokenBalance(result.obligations[displayCurrency], 18);
               }
          }

          // --- Case 2: This account holds assets issued BY someone else
          else if (result.assets && Object.keys(result.assets).length > 0) {
               let foundBalance: string | null = null;

               // result.assets looks like: { [issuer]: [{ currency, value }, ...] }
               for (const [issuerAddress, assetArray] of Object.entries(result.assets)) {
                    assetArray.forEach(asset => {
                         if (asset.currency === displayCurrency) {
                              // If an issuer filter is provided, match it
                              if (!issuer || issuerAddress === issuer) {
                                   foundBalance = asset.value;
                              }
                         }
                    });
               }

               if (foundBalance !== null) {
                    balance = this.utilsService.formatTokenBalance(foundBalance, 18);
               }
          }

          this.gatewayBalance = balance;
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

     private updateCurrencies() {
          this.currencies = [...Object.keys(this.knownTrustLinesIssuers)];
          this.currencies.sort((a, b) => a.localeCompare(b));
          this.currencyField = 'CZT';
     }

     private processAccountCurrencies(accountCurrencies: any) {
          const result = accountCurrencies.result;

          const receive = result.receive_currencies.map((c: string) => this.utilsService.normalizeCurrencyCode(c));
          const send = result.send_currencies.map((c: string) => this.utilsService.normalizeCurrencyCode(c));

          return { receive, send };
     }

     private canRemoveTrustline(line: any): { canRemove: boolean; reasons: string[] } {
          const reasons: string[] = [];

          if (parseFloat(line.balance) !== 0) {
               reasons.push(`Balance is ${line.balance} (must be 0)`);
          }

          if (line.no_ripple && !this.trustlineFlags['tfClearNoRipple']) {
               reasons.push(`NoRipple flag is set`);
          }
          if (line.freeze) {
               reasons.push(`Freeze flag is set`);
          }
          if (line.authorized) {
               reasons.push(`Authorized flag is set (issuer must unauthorize before deletion)`);
          }

          if (line.peer_authorized) {
               reasons.push(`Peer authorized is still enabled`);
          }

          return {
               canRemove: reasons.length === 0,
               reasons,
          };
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
