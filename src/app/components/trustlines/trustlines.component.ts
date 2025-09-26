import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { StorageService } from '../../services/storage.service';
import * as xrpl from 'xrpl';
import { TrustSetFlags } from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';
import { WalletMultiInputComponent } from '../wallet-multi-input/wallet-multi-input.component';
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';

interface ValidationInputs {
     selectedAccount?: 'account1' | 'account2' | 'issuer' | null;
     senderAddress?: string;
     seed?: string;
     account_info?: any;
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
     ticketSequence?: string;
     signerQuorum?: number;
     signers?: { account: string; weight: number }[];
}

interface TrustLine {
     currency: string;
     issuer?: string; // Optional, as some currencies (e.g., XRP) may not have an issuer
     account: string;
     balance: string;
     limit: string;
     limit_peer: string;
     flags: number;
     no_ripple: boolean | undefined;
     no_ripple_peer: boolean | undefined;
     quality_in: number;
     quality_out: number;
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
     imports: [CommonModule, FormsModule, WalletMultiInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './trustlines.component.html',
     styleUrl: './trustlines.component.css',
})
export class TrustlinesComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     selectedAccount: 'account1' | 'account2' | 'issuer' | null = 'account1';
     private lastResult: string = '';
     transactionInput: string = '';
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = true;
     currencyField: string = '';
     destinationFields: string = '';
     currencyBalanceField: string = '';
     gatewayBalance: string = '';
     amountField: string = '';
     ticketSequence: string = '';
     isTicket = false;
     isTicketEnabled = false;
     account1 = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '0' };
     account2 = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '0' };
     issuer = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '0' };
     ownerCount: string = '';
     totalXrpReserves: string = '';
     executionTime: string = '';
     destinationTagField: string = '';
     useMultiSign: boolean = false;
     multiSignAddress: string = '';
     isUpdateMetaData = false;
     multiSignSeeds: string = '';
     signerQuorum: number = 0;
     multiSigningEnabled: boolean = false;
     regularKeySigningEnabled: boolean = false;
     memoField: string = '';
     isMemoEnabled = false;
     isRegularKeyAddress = false;
     regularKeySeed: string = '';
     regularKeyAddress: string = '';
     spinner = false;
     spinnerMessage: string = '';
     masterKeyDisabled: boolean = false;
     isSimulateEnabled: boolean = false;
     private knownTrustLinesIssuers: { [key: string]: string } = { XRP: '' };
     private knownDestinations: { [key: string]: string } = {};
     currencies: string[] = [];
     destinations: string[] = [];
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

     ledgerFlagMap: { [key: string]: number } = {
          lsfLowAuth: 0x00010000,
          lsfHighAuth: 0x00040000,
          lsfNoRipple: 0x00020000,
          lsfLowFreeze: 0x00400000,
          lsfHighFreeze: 0x00800000,
     };

     decodeRippleStateFlags(flags: number): string[] {
          return Object.entries(this.ledgerFlagMap)
               .filter(([_, bit]) => (flags & bit) !== 0)
               .map(([name]) => name);
     }

     constructor(private readonly xrplService: XrplService, private readonly utilsService: UtilsService, private readonly cdr: ChangeDetectorRef, private readonly storageService: StorageService, private readonly renderUiComponentsService: RenderUiComponentsService, private readonly xrplTransactions: XrplTransactionService) {}

     ngOnInit() {
          const storedIssuers = this.storageService.getKnownIssuers('knownIssuers');
          if (storedIssuers) {
               this.knownTrustLinesIssuers = storedIssuers;
          }
          const storedDestinations = this.storageService.getKnownIssuers('destinations');
          if (storedDestinations) {
               this.knownDestinations = storedDestinations;
          }
          this.updateCurrencies();
          this.currencyField = 'CTZ'; // Set default selected currency if available
     }

     async ngAfterViewInit() {
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
          } catch (error: any) {
               console.error(`No wallet could be created or is undefined ${error.message}`);
               return this.setError('ERROR: Wallet could not be created or is undefined');
          } finally {
               this.cdr.detectChanges();
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

     onFlagChange(flag: string) {
          if (this.trustlineFlags[flag]) {
               this.conflicts[flag]?.forEach(conflict => {
                    this.trustlineFlags[conflict] = false;
               });
          }
     }

     async getTrustlinesForAccount() {
          console.log('Entering getTrustlinesForAccount');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount || '', this.account1, this.account2, this.issuer),
          };

          try {
               this.resultField.nativeElement.innerHTML = '';
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Getting Trustlines (${mode})...`);

               // Get client + wallet
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // Fetch account info + credential objects in PARALLEL
               const [accountInfo, accountObjects, accountCurrencies] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountCurrencies(client, wallet.classicAddress, 'validated', '')]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`accountObjects for ${wallet.classicAddress}:`, accountObjects.result);
               console.debug(`accountCurrencies for ${wallet.classicAddress}:`, accountCurrencies.result);

               inputs = { ...inputs, account_info: accountInfo };

               const errors = await this.validateInputs(inputs, 'getTrustlinesForAccount');
               if (errors.length > 0) {
                    return this.setError(`ERROR: ${errors.join('; ')}`);
               }

               const trustLinesFromObjects = accountObjects.result.account_objects.filter(obj => obj.LedgerEntryType === 'RippleState');

               // Filter by selected currency
               const activeTrustLines = trustLinesFromObjects.filter((line: any) => {
                    const decodedCurrency = this.utilsService.decodeIfNeeded(line.Balance.currency);
                    return decodedCurrency === this.currencyField;
               });

               type Section = {
                    title: string;
                    openByDefault: boolean;
                    content?: { key: string; value: string }[];
                    subItems?: {
                         key: string;
                         openByDefault: boolean;
                         content: { key: string; value: string }[];
                    }[];
               };

               const data: { sections: Section[] } = { sections: [] };

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
                    // Group balances by counterparty
                    const balanceByCounterparty = activeTrustLines.reduce((acc: { [key: string]: number }, line: xrpl.LedgerEntry.RippleState) => {
                         const currency = this.utilsService.decodeIfNeeded(line.Balance.currency);
                         const isOurWalletLow = wallet.classicAddress === line.LowLimit.issuer;
                         const isOurWalletHigh = wallet.classicAddress === line.HighLimit.issuer;

                         if (!isOurWalletLow && !isOurWalletHigh) return acc;

                         const counterparty = isOurWalletLow ? line.HighLimit.issuer : line.LowLimit.issuer;
                         let balance = parseFloat(line.Balance.value);

                         if (isOurWalletHigh) {
                              balance = 0;
                         } else if (isOurWalletLow) {
                              balance = -balance;
                         }

                         const key = `${currency}:${counterparty}`;
                         acc[key] = (acc[key] || 0) + balance;
                         return acc;
                    }, {} as { [key: string]: number });

                    // Format totals
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
                         subItems: activeTrustLines.map((line, index) => {
                              const currency = this.utilsService.decodeIfNeeded(line.Balance.currency);
                              const isOurWalletLow = wallet.classicAddress === line.LowLimit.issuer;
                              const isOurWalletHigh = wallet.classicAddress === line.HighLimit.issuer;
                              const counterparty = isOurWalletLow ? line.HighLimit.issuer : line.LowLimit.issuer;
                              const ourLimit = isOurWalletLow ? line.LowLimit.value : line.HighLimit.value;
                              const theirLimit = isOurWalletLow ? line.HighLimit.value : line.LowLimit.value;

                              let ourBalance = parseFloat(line.Balance.value);
                              let balanceStatus = '';

                              if (isOurWalletHigh) {
                                   if (parseFloat(ourLimit) === 0) {
                                        balanceStatus = `(Unreceivable: ${this.utilsService.formatTokenBalance(ourBalance.toString(), 2)} ${currency} owed by counterparty)`;
                                        ourBalance = 0;
                                   } else {
                                        ourBalance = -ourBalance;
                                   }
                              } else if (isOurWalletLow) {
                                   ourBalance = -ourBalance;
                              }

                              return {
                                   key: `Trust Line ${index + 1} (${currency}, Counterparty: ${counterparty})`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Currency', value: currency },
                                        { key: 'Account Balance', value: `${this.utilsService.formatTokenBalance(ourBalance.toString(), 2)} ${currency} ${balanceStatus}` },
                                        { key: 'Account Limit', value: ourLimit },
                                        { key: 'Account Position', value: isOurWalletLow ? 'Low Account' : 'High Account' },
                                        { key: 'Counterparty', value: `<code>${counterparty}</code>` },
                                        { key: 'Counter Party Limit', value: theirLimit },
                                        { key: 'Flags', value: this.decodeRippleStateFlags(line.Flags).join(', ') || 'None' },
                                   ],
                              };
                         }),
                    });

                    // Render trust lines immediately
                    this.utilsService.renderDetails(data);
                    this.setSuccess(this.result);

                    // DEFER: Non-critical UI updates. Fetch token balance and then re-render FULL data with all sections
                    setTimeout(async () => {
                         try {
                              const tokenBalance = await this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '');

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
                                                       { key: 'Amount', value: this.utilsService.formatTokenBalance(value, 2) },
                                                  ],
                                             });
                                        }
                                   }
                                   const balancesSection = {
                                        title: `Balances (${balanceItems.length})`,
                                        openByDefault: true,
                                        subItems: balanceItems,
                                   };
                                   data.sections.push(balancesSection);
                              }

                              if (accountCurrencies.result.receive_currencies.length > 0) {
                                   data.sections.push({
                                        title: 'Received Currencies',
                                        openByDefault: true,
                                        content: [
                                             {
                                                  key: 'Status',
                                                  value: this.processAccountCurrencies(accountCurrencies).receive.join(', '),
                                             },
                                        ],
                                   });
                              }

                              if (accountCurrencies.result.send_currencies.length > 0) {
                                   data.sections.push({
                                        title: 'Sent Currencies',
                                        openByDefault: true,
                                        content: [
                                             {
                                                  key: 'Status',
                                                  value: this.processAccountCurrencies(accountCurrencies).send.join(', '),
                                             },
                                        ],
                                   });
                              }

                              // RENDER FULL DATA — Trust Lines + Obligations + Balances
                              this.utilsService.renderDetails(data);

                              // --- Final UI Updates ---
                              this.refreshUiAccountObjects(accountObjects, accountInfo, wallet);
                              this.refreshUiAccountInfo(accountInfo);
                              this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
                              this.clearFields(true);
                              this.updateTrustLineFlagsInUI(accountObjects, wallet);
                              await this.updateXrpBalance(client, accountInfo, wallet);
                         } catch (err) {
                              console.error('Failed to load token balances:', err);
                              // Don't break UI — already rendered trust lines
                         }
                    }, 0);
               }

               // If no active trustlines, render immediately
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

                    // Render immediately
                    this.utilsService.renderDetails(data);
                    this.setSuccess(this.result);

                    // Still fetch token balances and re-render with them
                    setTimeout(async () => {
                         try {
                              const tokenBalance = await this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '');

                              // Add Obligations
                              if (tokenBalance.result.obligations && Object.keys(tokenBalance.result.obligations).length > 0) {
                                   const obligationsSection = {
                                        title: `Obligations (${Object.keys(tokenBalance.result.obligations).length})`,
                                        openByDefault: true,
                                        subItems: Object.entries(tokenBalance.result.obligations).map(([currency, amount], index) => ({
                                             key: `Obligation ${index + 1} (${this.utilsService.decodeIfNeeded(currency)})`,
                                             openByDefault: false,
                                             content: [
                                                  { key: 'Currency', value: this.utilsService.decodeIfNeeded(currency) },
                                                  { key: 'Amount', value: String(amount) },
                                             ],
                                        })),
                                   };
                                   data.sections.push(obligationsSection);
                              }

                              // Add Balances
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
                                                       { key: 'Amount', value: value },
                                                  ],
                                             });
                                        }
                                   }
                                   const balancesSection = {
                                        title: `Balances (${balanceItems.length})`,
                                        openByDefault: true,
                                        subItems: balanceItems,
                                   };
                                   data.sections.push(balancesSection);
                              }

                              // Re-render with all sections
                              this.utilsService.renderDetails(data);

                              // Final UI updates
                              this.refreshUiAccountObjects(accountObjects, accountInfo, wallet);
                              this.refreshUiAccountInfo(accountInfo);
                              this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
                              this.clearFields(false);
                              this.updateTrustLineFlagsInUI(accountObjects, wallet);
                              await this.updateXrpBalance(client, accountInfo, wallet);
                         } catch (err) {
                              console.error('Failed to load token balances:', err);
                         }
                    }, 0);
               }
          } catch (error: any) {
               console.error('Error in getTrustlinesForAccount:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.cdr.detectChanges();
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getTrustlinesForAccount in ${this.executionTime}ms`);
          }
     }

     async setTrustLine() {
          console.log('Entering setTrustLine');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount || '', this.account1, this.account2, this.issuer),
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
               ticketSequence: this.isTicket ? this.ticketSequence : undefined,
          };

          try {
               this.resultField.nativeElement.innerHTML = '';
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Trustline (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, fee, currentLedger, accountLines, serverInfo] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', ''), this.xrplService.getXrplServerInfo(client, 'current', '')]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);

               inputs = { ...inputs, account_info: accountInfo };

               const errors = await this.validateInputs(inputs, 'setTrustLine');
               if (errors.length > 0) {
                    return this.setError(`ERROR: ${errors.join('; ')}`);
               }

               // PHASE 2: Validate flags + currency
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
               Object.keys(this.trustlineFlags).forEach(key => {
                    if (this.trustlineFlags[key]) {
                         flags |= this.flagMap[key];
                    }
               });

               // PHASE 3: Prepare TrustSet transaction
               let trustSetTx: xrpl.TrustSet = {
                    TransactionType: 'TrustSet',
                    Account: wallet.classicAddress,
                    LimitAmount: {
                         currency: currencyFieldTemp,
                         issuer: this.destinationFields,
                         value: this.amountField,
                    },
                    Flags: flags,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               // Handle Ticket Sequence
               if (this.ticketSequence) {
                    const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence));
                    if (!ticketExists) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(trustSetTx, this.ticketSequence, true);
               } else {
                    // Use pre-fetched sequence — no redundant call!
                    this.utilsService.setTicketSequence(trustSetTx, accountInfo.result.account_data.Sequence, false);
               }

               // Optional fields
               if (this.memoField) {
                    this.utilsService.setMemoField(trustSetTx, this.memoField);
               }

               // PHASE 4: Validate balance
               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, trustSetTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }
               console.log('Sufficient XRP balance, good to go');

               if (this.utilsService.isInsufficientIouBalance(accountLines, trustSetTx)) {
                    return this.setError('ERROR: Not enough IOU balance for this transaction');
               }
               console.log('Sufficient IOU balance, good to go');

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Setting Trustline (no changes will be made)...' : 'Submitting to Ledger...');

               if (this.isSimulateEnabled) {
                    const simulation = await this.xrplTransactions.simulateTransaction(client, trustSetTx);

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
                    let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, trustSetTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

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

                    //DEFER: Non-critical UI updates (skip for simulation)
                    if (!this.isSimulateEnabled) {
                         setTimeout(async () => {
                              try {
                                   this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
                                   this.clearFields(false);
                                   await this.updateXrpBalance(client, updatedAccountInfo, wallet);
                              } catch (err) {
                                   console.error('Error in post-tx cleanup:', err);
                              }
                         }, 0);
                    }
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

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount || '', this.account1, this.account2, this.issuer),
               destination: this.destinationFields,
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
               const mode = this.isSimulateEnabled ? 'simulating removal' : 'removing';
               this.updateSpinnerMessage(`Preparing Trustline Removal (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, serverInfo, fee, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getXrplServerInfo(client, 'current', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client)]);

               inputs = { ...inputs, account_info: accountInfo };

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo :`, accountInfo.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);

               const errors = await this.validateInputs(inputs, 'removeTrustline');
               if (errors.length > 0) {
                    return this.setError(`ERROR: ${errors.join('; ')}`);
               }

               // PHASE 2: Validate flags
               if (this.trustlineFlags['tfSetNoRipple'] && this.trustlineFlags['tfClearNoRipple']) {
                    return this.setError('ERROR: Cannot set both tfSetNoRipple and tfClearNoRipple');
               }
               if (this.trustlineFlags['tfSetFreeze'] && this.trustlineFlags['tfClearFreeze']) {
                    return this.setError('ERROR: Cannot set both tfSetFreeze and tfClearFreeze');
               }

               // PHASE 3: Fetch and validate trustline
               const trustLines = await this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', '');

               const trustLine = trustLines.result.lines.find((line: any) => {
                    const lineCurrency = this.utilsService.decodeIfNeeded(line.currency);
                    return line.account === this.destinationFields && lineCurrency === this.currencyField;
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

               // PHASE 4: Prepare TrustSet transaction
               let currencyFieldTemp = this.utilsService.encodeIfNeeded(this.currencyField);
               let flags = 0;
               Object.keys(this.trustlineFlags).forEach(key => {
                    if (this.trustlineFlags[key]) {
                         flags |= this.flagMap[key];
                    }
               });

               const trustSetTx: xrpl.TrustSet = {
                    TransactionType: 'TrustSet',
                    Account: wallet.classicAddress,
                    LimitAmount: {
                         currency: currencyFieldTemp,
                         issuer: this.destinationFields,
                         value: '0',
                    },
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               trustSetTx.Flags = flags;
               // delete trustSetTx.Flags; // Removing trustline — no flags needed

               // Handle Ticket Sequence
               if (this.ticketSequence) {
                    const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence));
                    if (!ticketExists) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(trustSetTx, this.ticketSequence, true);
               } else {
                    // Use pre-fetched sequence — no redundant call!
                    this.utilsService.setTicketSequence(trustSetTx, accountInfo.result.account_data.Sequence, false);
               }

               // Optional fields
               if (this.memoField) {
                    this.utilsService.setMemoField(trustSetTx, this.memoField);
               }

               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, trustSetTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }
               console.log('Sufficient XRP balance, good to go');

               if (this.utilsService.isInsufficientIouBalance(trustLines, trustSetTx)) {
                    return this.setError('ERROR: Not enough IOU balance for this transaction');
               }
               console.log('Sufficient IOU balance, good to go');

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Removing Trustline (no changes will be made)...' : 'Submitting to Ledger...');

               if (this.isSimulateEnabled) {
                    const simulation = await this.xrplTransactions.simulateTransaction(client, trustSetTx);

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

                    // PHASE 6: Sign transaction
                    let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, trustSetTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign transaction.');
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

                    //DEFER: Non-critical UI updates (skip for simulation)
                    setTimeout(async () => {
                         try {
                              this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
                              this.clearFields(false);
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

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount || '', this.account1, this.account2, this.issuer),
               senderAddress: this.utilsService.getSelectedAddressWithIssuer(this.selectedAccount || '', this.account1, this.account2, this.issuer),
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
               ticketSequence: this.isTicket ? this.ticketSequence : undefined,
          };

          try {
               this.resultField.nativeElement.innerHTML = '';
               const mode = this.isSimulateEnabled ? 'simulating' : 'issuing';
               this.updateSpinnerMessage(`Preparing Currency Issuance (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index + trust lines
               let [accountInfo, accountObjects, fee, lastLedgerIndex, trustLines, serverInfo] = await Promise.all([
                    this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''),
                    this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''),
                    this.xrplService.calculateTransactionFee(client),
                    this.xrplService.getLastLedgerIndex(client),
                    this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', ''),
                    this.xrplService.getXrplServerInfo(client, 'current', ''),
               ]);

               inputs = { ...inputs, account_info: accountInfo };

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo :`, accountInfo.result);
               console.debug(`fee :`, fee);
               console.debug(`lastLedgerIndex :`, lastLedgerIndex);
               console.debug(`trustLines :`, trustLines);

               const errors = await this.validateInputs(inputs, 'issueCurrency');
               if (errors.length > 0) {
                    return this.setError(`ERROR: ${errors.join('; ')}`);
               }

               // PHASE 2: Get regular key wallet
               const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               // PHASE 3: Check if DefaultRipple needs to be enabled
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

                    // Handle Ticket Sequence
                    if (this.ticketSequence) {
                         const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence));
                         if (!ticketExists) {
                              return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                         }
                         this.utilsService.setTicketSequence(accountSetTx, this.ticketSequence, true);
                    } else {
                         this.utilsService.setTicketSequence(accountSetTx, accountInfo.result.account_data.Sequence, false);
                    }

                    if (this.memoField) {
                         this.utilsService.setMemoField(accountSetTx, this.memoField);
                    }

                    if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, accountSetTx, fee)) {
                         return this.setError('ERROR: Insufficient XRP to complete transaction');
                    }
                    console.log('Sufficient XRP balance, good to go');

                    if (this.utilsService.isInsufficientIouBalance(trustLines, accountSetTx)) {
                         return this.setError('ERROR: Not enough IOU balance for this transaction');
                    }
                    console.log('Sufficient IOU balance, good to go');

                    if (this.isSimulateEnabled) {
                         const simulation = await this.xrplTransactions.simulateTransaction(client, accountSetTx);

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
                         // Sign transaction
                         let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, accountSetTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                         if (!signedTx) {
                              return this.setError('ERROR: Failed to sign AccountSet transaction.');
                         }

                         // Submit or Simulate
                         const response = await this.xrplTransactions.submitTransaction(client, signedTx);

                         // Render result
                         this.renderTransactionResult(response);

                         const isSuccess = this.utilsService.isTxSuccessful(response);
                         if (!isSuccess) {
                              const resultMsg = this.utilsService.getTransactionResultMessage(response);
                              let userMessage = 'Transaction failed.\n';
                              userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                              console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);

                              // Optional: Set user-friendly error
                              this.setError(`ERROR: Transaction failed with result: ${userMessage}`);
                              return;
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
                         issuer: this.issuer.address,
                    },
                    Fee: fee,
                    LastLedgerSequence: lastLedgerIndex + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               // Handle Ticket Sequence
               if (this.ticketSequence) {
                    const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence));
                    if (!ticketExists) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(paymentTx, this.ticketSequence, true);
               } else {
                    // Use fresh account info for sequence
                    const freshAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    this.utilsService.setTicketSequence(paymentTx, freshAccountInfo.result.account_data.Sequence, false);
               }

               // Optional fields
               if (this.memoField) {
                    this.utilsService.setMemoField(paymentTx, this.memoField);
               }
               if (this.destinationTagField && parseInt(this.destinationTagField) > 0) {
                    this.utilsService.setDestinationTag(paymentTx, this.destinationTagField);
               }

               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, paymentTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }
               console.log('Sufficient XRP balance, good to go');

               if (this.utilsService.isInsufficientIouBalance(trustLines, paymentTx)) {
                    return this.setError('ERROR: Not enough IOU balance for this transaction');
               }
               console.log('Sufficient IOU balance, good to go');

               let response;
               if (this.isSimulateEnabled) {
                    const simulation = await this.xrplTransactions.simulateTransaction(client, paymentTx);

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
                    // Sign transaction
                    let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, paymentTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

                    // Submit or Simulate
                    this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Currency Issuance (no changes will be made)...' : 'Submitting Currency Issuance to Ledger...');

                    response = await this.xrplTransactions.submitTransaction(client, signedTx);

                    const isSuccess = this.utilsService.isTxSuccessful(response);
                    if (!isSuccess) {
                         const resultMsg = this.utilsService.getTransactionResultMessage(response);
                         let userMessage = 'Transaction failed.\n';
                         userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                         (response.result as any).errorMessage = userMessage;
                         console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                    }

                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.result);
               }

               // Only fetch additional data and update UI if not in simulation mode
               if (!this.isSimulateEnabled) {
                    // Fetch updated trust lines and gateway balances in parallel
                    const [updatedTrustLines, gatewayBalances] = await Promise.all([this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', ''), this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '')]);

                    // Add New Balance section
                    const decodedCurrency = this.utilsService.decodeIfNeeded(this.currencyField);
                    const newTrustLine = updatedTrustLines.result.lines.find((line: any) => line.currency === decodedCurrency && (line.account === this.issuer.address || line.account === this.destinationFields));

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
                              { key: 'Balance', value: newTrustLine ? newTrustLine.balance : 'Unknown' },
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
                                        { key: 'Amount', value: amount },
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
                              { key: 'XRP Balance (Issuer)', value: (await client.getXrpBalance(wallet.classicAddress)).toString() },
                         ],
                    });

                    this.renderUiComponentsService.renderDetails(data);
                    (response.result as any).clearInnerHtml = false;
                    this.renderUiComponentsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.result);

                    // PARALLELIZE
                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    //DEFER: Non-critical UI updates (skip for simulation)
                    setTimeout(async () => {
                         try {
                              this.clearFields(false);
                              await this.updateXrpBalance(client, updatedAccountInfo, wallet);
                              await this.updateCurrencyBalance(wallet, accountObjects);
                              this.updateGatewayBalance(gatewayBalances);
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

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount || '', this.account1, this.account2, this.issuer),
               amount: this.amountField,
               destination: this.destinationFields,
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
               const mode = this.isSimulateEnabled ? 'simulating' : 'clawing back';
               this.updateSpinnerMessage(`Preparing Token Clawback (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, accountObjects, trustLines, serverInfo, fee, currentLedger] = await Promise.all([
                    this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''),
                    this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''),
                    this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', ''),
                    this.xrplService.getXrplServerInfo(client, 'current', ''),
                    this.xrplService.calculateTransactionFee(client),
                    this.xrplService.getLastLedgerIndex(client),
               ]);

               inputs = { ...inputs, account_info: accountInfo };

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo :`, accountInfo.result);
               console.debug(`accountObjects :`, accountObjects.result);
               console.debug(`trustLines :`, trustLines.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);

               const errors = await this.validateInputs(inputs, 'clawbackTokens');
               if (errors.length > 0) {
                    return this.setError(`ERROR: ${errors.join('; ')}`);
               }

               // PHASE 2: Validate currency
               const currencyFieldTemp = this.utilsService.encodeIfNeeded(this.currencyField);
               if (!/^[A-Z0-9]{3}$|^[0-9A-Fa-f]{40}$/.test(currencyFieldTemp)) {
                    throw new Error('Invalid currency code. Must be a 3-character code (e.g., USDC) or 40-character hex.');
               }

               // PHASE 3: Get regular key wallet
               const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               // PHASE 4: Prepare Clawback transaction
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

               // Handle Ticket Sequence
               if (this.ticketSequence) {
                    const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence));
                    if (!ticketExists) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(clawbackTx, this.ticketSequence, true);
               } else {
                    // Use pre-fetched sequence — no redundant call!
                    this.utilsService.setTicketSequence(clawbackTx, accountInfo.result.account_data.Sequence, false);
               }

               // Optional fields
               if (this.memoField) {
                    this.utilsService.setMemoField(clawbackTx, this.memoField);
               }

               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, clawbackTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }
               console.log('Sufficient XRP balance, good to go');

               if (this.utilsService.isInsufficientIouBalance(trustLines, clawbackTx)) {
                    return this.setError('ERROR: Not enough IOU balance for this transaction');
               }
               console.log('Sufficient IOU balance, good to go');

               let response;
               if (this.isSimulateEnabled) {
                    const simulation = await this.xrplTransactions.simulateTransaction(client, clawbackTx);

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
                    // PHASE 5: Sign transaction
                    let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, clawbackTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign transaction.');
                    }

                    // PHASE 6: Submit or Simulate
                    this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Token Clawback (no tokens will be moved)...' : 'Submitting Clawback to Ledger...');

                    response = await this.xrplTransactions.submitTransaction(client, signedTx);

                    const isSuccess = this.utilsService.isTxSuccessful(response);
                    if (!isSuccess) {
                         const resultMsg = this.utilsService.getTransactionResultMessage(response);
                         let userMessage = 'Transaction failed.\n';
                         userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                         (response.result as any).errorMessage = userMessage;
                         console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                    }

                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.result);

                    // PARALLELIZE
                    const [updatedAccountInfo, updatedAccountObjects, gatewayBalancePromise] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    //DEFER: Non-critical UI updates (skip for simulation)
                    setTimeout(async () => {
                         try {
                              this.clearFields(false);
                              await this.updateXrpBalance(client, updatedAccountInfo, wallet);
                              this.updateCurrencyBalance(wallet, updatedAccountObjects);
                              this.updateGatewayBalance(gatewayBalancePromise);
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

     async onCurrencyChange() {
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
                              if (this.utilsService.formatCurrencyForDisplay(currency) === this.currencyField) {
                                   balanceTotal += Number(value);
                              }
                         }
                    }
                    this.gatewayBalance = this.utilsService.formatTokenBalance(balanceTotal.toString(), 18);
               } else {
                    this.gatewayBalance = '0';
               }

               // PHASE 3: Update destination field
               this.destinationFields = this.knownTrustLinesIssuers[this.currencyField];

               // PHASE 4: Defer getTrustlinesForAccount — don't block UI
               setTimeout(() => {
                    this.getTrustlinesForAccount();
               }, 0);
          } catch (error: any) {
               console.error('Error in onCurrencyChange:', error);
               this.currencyBalanceField = '0';
               this.gatewayBalance = '0';
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

          this.clearFields(false);
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

     private updateTrustLineFlagsInUI(accountObjects: xrpl.AccountObjectsResponse, wallet: xrpl.Wallet) {
          const currency = this.utilsService.decodeIfNeeded(this.currencyField ? this.currencyField : '');

          const rippleState = accountObjects.result.account_objects.find(obj => obj.LedgerEntryType === 'RippleState' && obj.Balance && obj.Balance.currency === currency) as xrpl.LedgerEntry.RippleState | undefined;

          if (rippleState) {
               this.debugTrustlineFlags(rippleState, wallet);
               const flagsNumber: number = rippleState.Flags ?? 0;

               // Correct way: check if your wallet is the low side
               const isLowAddress = wallet.classicAddress === rippleState.LowLimit.issuer;

               if (isLowAddress) {
                    this.trustlineFlags['tfSetfAuth'] = !!(flagsNumber & this.ledgerFlagMap['lsfLowAuth']);
                    this.trustlineFlags['tfSetNoRipple'] = !!(flagsNumber & this.ledgerFlagMap['lsfLowNoRipple']);
                    this.trustlineFlags['tfSetFreeze'] = !!(flagsNumber & this.ledgerFlagMap['lsfLowFreeze']);
               } else {
                    this.trustlineFlags['tfSetfAuth'] = !!(flagsNumber & this.ledgerFlagMap['lsfHighAuth']);
                    this.trustlineFlags['tfSetNoRipple'] = !!(flagsNumber & this.ledgerFlagMap['lsfHighNoRipple']);
                    this.trustlineFlags['tfSetFreeze'] = !!(flagsNumber & this.ledgerFlagMap['lsfHighFreeze']);
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
               Object.keys(this.trustlineFlags).forEach(key => {
                    this.trustlineFlags[key as keyof typeof this.trustlineFlags] = false;
               });
               this.showTrustlineOptions = false;
          }
     }

     private debugTrustlineFlags(rippleState: xrpl.LedgerEntry.RippleState, wallet: xrpl.Wallet) {
          const flagsNumber: number = rippleState.Flags ?? 0;
          const isLowAddress = wallet.classicAddress === rippleState.LowLimit.issuer;

          console.log('🔍 Trustline Debug\n -----------------------------------------');
          console.log('Currency:', rippleState.Balance.currency);
          console.log('You are the', isLowAddress ? 'LOW side' : 'HIGH side');
          console.log('Flags (decimal):', flagsNumber, ' hex:', '0x' + flagsNumber.toString(16));

          if (isLowAddress) {
               console.log('LowAuth:', !!(flagsNumber & this.ledgerFlagMap['lsfLowAuth']));
               console.log('LowNoRipple:', !!(flagsNumber & this.ledgerFlagMap['lsfLowNoRipple']));
               console.log('LowFreeze:', !!(flagsNumber & this.ledgerFlagMap['lsfLowFreeze']));
          } else {
               console.log('HighAuth:', !!(flagsNumber & this.ledgerFlagMap['lsfHighAuth']));
               console.log('HighNoRipple:', !!(flagsNumber & this.ledgerFlagMap['lsfHighNoRipple']));
               console.log('HighFreeze:', !!(flagsNumber & this.ledgerFlagMap['lsfHighFreeze']));
          }
          console.log('-----------------------------------------');
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

          const isValidNumber = (value: string | undefined, fieldName: string, minValue?: number, allowEmpty: boolean = false): string | null => {
               if (value === undefined || (allowEmpty && value === '')) return null; // Skip if undefined or empty (when allowed)
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
               return null;
          };

          // Action-specific config: required fields and custom rules
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
                    required: ['selectedAccount', 'seed'],
                    customValidators: [() => isValidSeed(inputs.seed), () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null)],
                    asyncValidators: [],
               },
               setTrustLine: {
                    required: ['selectedAccount', 'seed', 'amount', 'destination'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.amount, 'Amount', 0),
                         () => isValidXrpAddress(inputs.destination, 'Destination'),
                         () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                         () => (inputs.account_info.result.account_flags.disableMasterKey && !inputs.useMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                         () => (inputs.isTicket ? isRequired(inputs.ticketSequence, 'Ticket Sequence') : null),
                         () => (inputs.isTicket ? isValidNumber(inputs.ticketSequence, 'Ticket Sequence', 0) : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                    ],
                    asyncValidators: [],
               },
               removeTrustline: {
                    required: ['selectedAccount', 'seed', 'destination'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidXrpAddress(inputs.destination, 'Destination'),
                         () => isValidNumber(inputs.destinationTag, 'Destination Tag', 0),
                         () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                         () => (inputs.account_info.result.account_flags.disableMasterKey && !inputs.useMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                         () => (inputs.isTicket ? isRequired(inputs.ticketSequence, 'Ticket Sequence') : null),
                         () => (inputs.isTicket ? isValidNumber(inputs.ticketSequence, 'Ticket Sequence', 0) : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                    ],
                    asyncValidators: [],
               },
               issueCurrency: {
                    required: ['selectedAccount', 'seed', 'amount', 'destination'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.amount, 'Amount', 0),
                         () => isValidXrpAddress(inputs.destination, 'Destination'),
                         () => isValidNumber(inputs.destinationTag, 'Destination Tag', 0, true), // Allow empty
                         () => isValidNumber(inputs.ticketSequence, 'Ticket', 0, true),
                         () => isNotSelfPayment(inputs.senderAddress, inputs.destination),
                         () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                         () => (inputs.account_info.result.account_flags.disableMasterKey && !inputs.useMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                         () => (inputs.isTicket ? isRequired(inputs.ticketSequence, 'Ticket Sequence') : null),
                         () => (inputs.isTicket ? isValidNumber(inputs.ticketSequence, 'Ticket Sequence', 0) : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                    ],
                    asyncValidators: [checkDestinationTagRequirement],
               },
               onCurrencyChange: {
                    required: ['selectedAccount', 'seed'],
                    customValidators: [() => isValidSeed(inputs.seed), () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null)],
                    asyncValidators: [],
               },
               clawbackTokens: {
                    required: ['selectedAccount', 'seed', 'amount', 'destination'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.amount, 'Amount', 0),
                         () => isValidXrpAddress(inputs.destination, 'Destination'),
                         () => isValidNumber(inputs.destinationTag, 'Destination Tag', 0, true), // Allow empty
                         () => isValidNumber(inputs.ticketSequence, 'Ticket', 0, true),
                         () => isNotSelfPayment(inputs.senderAddress, inputs.destination),
                         () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                         () => (inputs.account_info.result.account_flags.disableMasterKey && !inputs.useMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                         () => (inputs.isTicket ? isRequired(inputs.ticketSequence, 'Ticket Sequence') : null),
                         () => (inputs.isTicket ? isValidNumber(inputs.ticketSequence, 'Ticket Sequence', 0) : null),
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

          if (errors.length == 0 && inputs.useMultiSign && (inputs.multiSignAddresses === 'No Multi-Sign address configured for account' || inputs.multiSignSeeds === '')) {
               errors.push('At least one signer address is required for multi-signing');
          }

          // Selected account check (common to most)
          if (inputs.selectedAccount === undefined || inputs.selectedAccount === null) {
               errors.push('Please select an account');
          }

          return errors;
     }

     private updateDestinations() {
          const knownDestinationsTemp = this.utilsService.populateKnownDestinations(this.knownDestinations, this.account1.address, this.account2.address, this.issuer.address);
          this.destinations = Object.values(this.knownDestinations).filter((d): d is string => typeof d === 'string' && d.trim() !== '' && d !== 'XRP');
          this.storageService.setKnownIssuers('destinations', knownDestinationsTemp);
          this.destinationFields = this.issuer.address;
     }

     get currencyOptions(): string[] {
          return Object.values(this.currencies).filter(key => key !== 'XRP');
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
                    // await Promise.all([this.onCurrencyChange(), this.getTrustlinesForAccount()]);
                    await Promise.all([this.onCurrencyChange()]);
               } else if (address) {
                    this.setError('Invalid XRP address');
               }
          } catch (error: any) {
               this.setError(`Error fetching account details: ${error.message}`);
          }
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

     private async showSpinnerWithDelay(message: string, delayMs: number = 200) {
          this.spinner = true;
          this.updateSpinnerMessage(message);
          await new Promise(resolve => setTimeout(resolve, delayMs)); // Minimum display time for initial spinner
     }

     private async updateCurrencyBalance(wallet: xrpl.Wallet, accountObjects: any) {
          let balance: string;
          const currencyCode = this.utilsService.encodeIfNeeded(this.currencyField);
          if (wallet.classicAddress) {
               const balanceResult = await this.utilsService.getCurrencyBalance(currencyCode, accountObjects);
               balance = balanceResult !== null ? balanceResult.toString() : '0';
               this.currencyBalanceField = this.utilsService.formatTokenBalance(balance, 18);
          } else {
               this.currencyBalanceField = '0';
          }
     }

     private updateGatewayBalance(gatewayBalances: xrpl.GatewayBalancesResponse) {
          if (gatewayBalances.result.obligations && Object.keys(gatewayBalances.result.obligations).length > 0) {
               const displayCurrency = this.utilsService.encodeIfNeeded(this.currencyField);
               this.gatewayBalance = this.utilsService.formatTokenBalance(gatewayBalances.result.obligations[displayCurrency], 18);
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
     }
}
