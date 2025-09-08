import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { StorageService } from '../../services/storage.service';
import * as xrpl from 'xrpl';
import { TrustSet, TransactionMetadataBase, AccountSet, Payment, TrustSetFlags } from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';
import { WalletMultiInputComponent } from '../wallet-multi-input/wallet-multi-input.component';

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
     isMultiSign = false;
     multiSignAddress: string = '';
     isUpdateMetaData = false;
     multiSignSeeds: string = '';
     signerQuorum: number = 0;
     memoField: string = '';
     isMemoEnabled = false;
     isRegularKeyAddress = false;
     regularKeySeed: string = '';
     regularKeyAddress: string = '';
     spinner = false;
     spinnerMessage: string = '';
     private knownTrustLinesIssuers: { [key: string]: string } = {
          RLUSD: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De',
     };
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

     decodeRippleStateFlags(flags: number): string[] {
          const ledgerFlagMap: { [key: string]: number } = {
               lsfLowAuth: 0x00010000,
               lsfHighAuth: 0x00040000,
               lsfNoRipple: 0x00020000,
               lsfLowFreeze: 0x00400000,
               lsfHighFreeze: 0x00800000,
          };

          return Object.entries(ledgerFlagMap)
               .filter(([_, bit]) => (flags & bit) !== 0)
               .map(([name]) => name);
     }

     constructor(private xrplService: XrplService, private utilsService: UtilsService, private cdr: ChangeDetectorRef, private storageService: StorageService) {}

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
          this.currencyField = 'USD'; // BOB Set default selected currency if available
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
          } catch (error) {
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
               if (!this.isMultiSign) {
                    this.utilsService.clearSignerList(this.signers);
               } else {
                    const wallet = await this.getWallet();
                    this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
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

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               this.showSpinnerWithDelay('Getting Trustlines...', 200);

               const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
               if (accountInfo.result.account_data.length <= 0) {
                    this.resultField.nativeElement.innerHTML = `No account data found for ${wallet.classicAddress}`;
                    return;
               }
               console.info(`accountInfo for ${wallet.classicAddress} ${JSON.stringify(accountInfo.result, null, '\t')}`);

               const accountObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '');
               console.debug(`accountObjects for ${wallet.classicAddress} ${JSON.stringify(accountObjects.result, null, '\t')}`);

               const trustLinesFromObjects = accountObjects.result.account_objects.filter(obj => obj.LedgerEntryType === 'RippleState');
               console.debug(`trustLinesFromObjects for ${wallet.classicAddress} ${JSON.stringify(trustLinesFromObjects, null, '\t')}`);

               // Optional: filter by currency if you only want one
               const activeTrustLines = trustLinesFromObjects.filter((line: any) => {
                    const decodedCurrency = this.utilsService.decodeIfNeeded(line.Balance.currency);
                    return decodedCurrency === this.currencyField;
               });
               console.info(`activeTrustLines for ${wallet.classicAddress} ${JSON.stringify(activeTrustLines, null, '\t')}`);

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
               const data: { sections: Section[] } = {
                    sections: [],
               };

               // const activeTrustLines: TrustLine[] = activeTrustLine as TrustLine[];
               if (activeTrustLines.length === 0) {
                    data.sections.push({
                         title: 'Trust Lines',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No active trust lines found for <code>${this.currencyField}</code> and <code>${wallet.classicAddress}</code>` }],
                    });
                    this.gatewayBalance = '';
               } else {
                    // Group trust lines by currency and issuer, and calculate total balance for each
                    const balanceByToken = activeTrustLines.reduce((acc: { [key: string]: number }, line: xrpl.LedgerEntry.RippleState) => {
                         const currency = this.utilsService.decodeIfNeeded(line.Balance.currency);

                         const isLow = wallet.classicAddress < line.HighLimit.issuer;
                         const issuer = isLow ? line.HighLimit.issuer : line.LowLimit.issuer;
                         const balance = parseFloat(line.Balance.value);

                         const key = `${currency}:${issuer}`;
                         acc[key] = (acc[key] || 0) + balance;
                         return acc;
                    }, {} as { [key: string]: number });

                    // Format totals for display
                    const totalBalances = Object.entries(balanceByToken).map(([key, balance]) => {
                         const [currency, issuer] = key.split(':');
                         const formattedBalance = balance.toFixed(8);
                         return {
                              key: `Total ${currency} Balance${issuer !== 'no-issuer' ? ` (Issuer: ${issuer})` : ''}`,
                              value: `${formattedBalance} ${currency}`,
                         };
                    });

                    data.sections.push({
                         title: `Trust Lines (${activeTrustLines.length})`,
                         openByDefault: true,
                         content: totalBalances, // Display all token totals
                         subItems: activeTrustLines.map((line, index) => {
                              const currency = this.utilsService.decodeIfNeeded(line.Balance.currency);
                              const isLow = wallet.classicAddress < line.HighLimit.issuer;
                              const issuer = isLow ? line.HighLimit.issuer : line.LowLimit.issuer;
                              const limit = isLow ? line.LowLimit.value : line.HighLimit.value;
                              const balance = line.Balance.value;

                              return {
                                   key: `Trust Line ${index + 1} (${currency}, Issuer: ${issuer})`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Currency', value: currency },
                                        { key: 'Issuer', value: `<code>${issuer}</code>` },
                                        { key: 'Balance', value: `${balance} ${currency}` },
                                        { key: 'Limit', value: limit },
                                        { key: 'Flags', value: this.decodeRippleStateFlags(line.Flags).join(', ') || 'None' },
                                        { key: 'PreviousTxnID', value: String(line.PreviousTxnID) },
                                        { key: 'Index', value: String(line.index) },
                                   ],
                              };
                         }),
                    });

                    const tokenBalance = await this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '');
                    // Obligations section (tokens issued by the account)
                    if (tokenBalance.result.obligations && Object.keys(tokenBalance.result.obligations).length > 0) {
                         data.sections.push({
                              title: `Obligations (${Object.keys(tokenBalance.result.obligations).length})`,
                              openByDefault: true,
                              subItems: Object.entries(tokenBalance.result.obligations).map(([currency, amount], index) => {
                                   const displayCurrency = this.utilsService.decodeIfNeeded(currency);
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

                    // Balances section (tokens held by the account)
                    if (tokenBalance.result.assets && Object.keys(tokenBalance.result.assets).length > 0) {
                         const balanceItems = [];
                         for (const [issuer, currencies] of Object.entries(tokenBalance.result.assets)) {
                              for (const { currency, value } of currencies) {
                                   let displayCurrency = currency;
                                   const curr = this.utilsService.decodeIfNeeded(this.currencyField);
                                   if (currency.length > 3) {
                                        const tempCurrency = currency;
                                        displayCurrency = this.utilsService.decodeCurrencyCode(currency);
                                        if (displayCurrency.length > 8) {
                                             displayCurrency = tempCurrency;
                                        }
                                   }
                                   balanceItems.push({
                                        key: `${displayCurrency} from ${issuer}`,
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
               }

               this.utilsService.renderPaymentChannelDetails(data);
               this.setSuccess(this.result);
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), wallet);
               this.refreshUiAccountInfo(accountInfo);
               this.utilsService.loadSignerList(wallet.classicAddress, this.signers);

               this.isMemoEnabled = false;
               this.memoField = '';
               this.amountField = '';

               const currency = this.utilsService.decodeIfNeeded(this.currencyField ? this.currencyField : '');
               const rippleState = accountObjects.result.account_objects.find(obj => obj.LedgerEntryType === 'RippleState' && obj.Balance && obj.Balance.currency === currency);

               if (rippleState && 'LedgerEntryType' in rippleState && rippleState.LedgerEntryType === 'RippleState') {
                    const flagsNumber: number = rippleState.Flags ?? 0;

                    const ledgerFlagMap: { [key: string]: number } = {
                         lsfNoRipple: 0x00020000,
                         lsfLowFreeze: 0x00400000,
                         lsfHighFreeze: 0x00800000,
                         lsfLowAuth: 0x00010000,
                         lsfHighAuth: 0x00040000,
                    };

                    const isLowAddress = wallet.classicAddress < (rippleState as xrpl.LedgerEntry.RippleState).HighLimit.issuer;

                    this.trustlineFlags['tfSetfAuth'] = !!(flagsNumber & (isLowAddress ? ledgerFlagMap['lsfLowAuth'] : ledgerFlagMap['lsfHighAuth']));
                    this.trustlineFlags['tfSetNoRipple'] = !!(flagsNumber & ledgerFlagMap['lsfNoRipple']);
                    this.trustlineFlags['tfClearNoRipple'] = !(flagsNumber & ledgerFlagMap['lsfNoRipple']);
                    this.trustlineFlags['tfSetFreeze'] = !!(flagsNumber & (isLowAddress ? ledgerFlagMap['lsfLowFreeze'] : ledgerFlagMap['lsfHighFreeze']));
                    this.trustlineFlags['tfClearFreeze'] = !(flagsNumber & (isLowAddress ? ledgerFlagMap['lsfLowFreeze'] : ledgerFlagMap['lsfHighFreeze']));
                    this.trustlineFlags['tfPartialPayment'] = false;
                    this.trustlineFlags['tfNoDirectRipple'] = false;
                    this.trustlineFlags['tfLimitQuality'] = false;

                    this.cdr.detectChanges();
               } else {
                    Object.keys(this.trustlineFlags).forEach(key => {
                         this.trustlineFlags[key as keyof typeof this.trustlineFlags] = false;
                    });
                    this.cdr.detectChanges();
               }

               await this.updateXrpBalance(client, wallet);
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getTrustlinesForAccount in ${this.executionTime}ms`);
          }
     }

     async setTrustLine() {
          console.log('Entering setTrustLine');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               amount: this.amountField,
               destination: this.destinationFields,
               multiSignAddresses: this.isMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.isMultiSign ? this.multiSignSeeds : undefined,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.isMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               this.updateSpinnerMessage('Setting Trustline...');

               // Validate flag combinations
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

               let flags = 0;
               Object.keys(this.trustlineFlags).forEach(key => {
                    if (this.trustlineFlags[key]) {
                         flags |= this.flagMap[key];
                    }
               });

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               let trustSetTx: TrustSet = {
                    TransactionType: 'TrustSet',
                    Account: wallet.classicAddress,
                    LimitAmount: {
                         currency: currencyFieldTemp,
                         issuer: this.destinationFields,
                         value: this.amountField,
                    },
                    Flags: flags, // numeric bitmask of selected options
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(trustSetTx, this.ticketSequence, true);
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    this.utilsService.setTicketSequence(trustSetTx, getAccountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(trustSetTx, this.memoField);
               }

               if (this.currencyField === AppConstants.XRP_CURRENCY) {
                    if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, trustSetTx, fee)) {
                         return this.setError('ERROR: Insufficent XRP to complete transaction');
                    }
               } else {
                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, trustSetTx, fee)) {
                         return this.setError('ERROR: Insufficent XRP to complete transaction');
                    }
               }

               let signedTx: { tx_blob: string; hash: string } | null = null;

               if (this.isMultiSign) {
                    const signerAddresses = this.utilsService.getMultiSignAddress(this.multiSignAddress);
                    if (signerAddresses.length === 0) {
                         return this.setError('ERROR: No signer addresses provided for multi-signing');
                    }

                    const signerSeeds = this.utilsService.getMultiSignSeeds(this.multiSignSeeds);
                    if (signerSeeds.length === 0) {
                         return this.setError('ERROR: No signer seeds provided for multi-signing');
                    }

                    try {
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: trustSetTx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         trustSetTx.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(trustSetTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         trustSetTx.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));

                         if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, trustSetTx, multiSignFee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    console.log(`trustSetTx: ${JSON.stringify(trustSetTx, null, '\t')}`);
                    const preparedTx = await client.autofill(trustSetTx);
                    console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                    signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, trustSetTx, fee)) {
                         return this.setError('ERROR: Insufficient XRP to complete transaction');
                    }
               }

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }
               console.log('signed:', JSON.stringify(signedTx, null, '\t'));

               this.updateSpinnerMessage('Submitting transaction to the Ledger...');
               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Response:', JSON.stringify(response, null, '\t'));

               if (response.result.meta && typeof response.result.meta !== 'string' && response.result.meta.TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    console.error(`Transaction failed: ${JSON.stringify(response, null, 2)}`);
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               this.isMemoEnabled = false;
               this.memoField = '';

               await this.updateXrpBalance(client, wallet);
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
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

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               multiSignAddresses: this.isMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.isMultiSign ? this.multiSignSeeds : undefined,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.isMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               // Validate flag combinations
               if (this.trustlineFlags['tfSetNoRipple'] && this.trustlineFlags['tfClearNoRipple']) {
                    return this.setError('ERROR: Cannot set both tfSetNoRipple and tfClearNoRipple');
               }
               if (this.trustlineFlags['tfSetFreeze'] && this.trustlineFlags['tfClearFreeze']) {
                    return this.setError('ERROR: Cannot set both tfSetFreeze and tfClearFreeze');
               }

               this.updateSpinnerMessage('Removing Trustline...');

               const trustLines = await this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', '');
               console.info(`All trust lines for ${wallet.classicAddress} ${JSON.stringify(trustLines, null, '\t')}`);

               // Normalize currency for comparison
               const currencyMatch = this.utilsService.encodeIfNeeded(this.currencyField);

               // Find the specific trustline to the issuer (destinationField)
               const trustLine = trustLines.result.lines.find((line: any) => {
                    const lineCurrency = this.utilsService.decodeIfNeeded(line.currency);
                    return line.account === this.destinationFields && lineCurrency === this.currencyField;
               });

               // If not found, exit early
               if (!trustLine) {
                    this.resultField.nativeElement.innerHTML = `No trust line found for ${this.currencyField} to issuer ${this.destinationFields}`;
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               for (const line of trustLines.result.lines) {
                    const check = this.canRemoveTrustline(line);
                    if (!check.canRemove) {
                         return this.setError(`Cannot remove trustline ${line.currency}/${line.account}: ${check.reasons}`);
                    } else {
                         console.log(`Trustline ${line.currency}/${line.account} is removable ✅`);
                    }
               }

               if (trustLine.peer_authorized) {
                    return this.setError('ERROR: Cannot remove authorized trust line. Authorization flag prevents deletion.');
               }

               // If balance is non-zero, cannot remove
               if (parseFloat(trustLine.balance) !== 0) {
                    return this.setError(`ERROR: Cannot remove trust line: Balance is ${trustLine.balance}. Balance must be 0.`);
               }

               let currencyFieldTemp = this.utilsService.encodeIfNeeded(this.currencyField);

               let flags = 0;
               Object.keys(this.trustlineFlags).forEach(key => {
                    if (this.trustlineFlags[key]) {
                         flags |= this.flagMap[key];
                    }
               });

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               const trustSetTx: TrustSet = {
                    TransactionType: 'TrustSet',
                    Account: wallet.classicAddress,
                    LimitAmount: {
                         currency: currencyFieldTemp,
                         issuer: this.destinationFields,
                         value: '0',
                    },
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               delete trustSetTx.Flags;

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(trustSetTx, this.ticketSequence, true);
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    this.utilsService.setTicketSequence(trustSetTx, getAccountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(trustSetTx, this.memoField);
               }

               if (this.currencyField === AppConstants.XRP_CURRENCY) {
                    if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, trustSetTx, fee)) {
                         return this.setError('ERROR: Insufficent XRP to complete transaction');
                    }
               } else {
                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, trustSetTx, fee)) {
                         return this.setError('ERROR: Insufficent XRP to complete transaction');
                    }
               }

               let signedTx: { tx_blob: string; hash: string } | null = null;

               if (this.isMultiSign) {
                    const signerAddresses = this.utilsService.getMultiSignAddress(this.multiSignAddress);
                    if (signerAddresses.length === 0) {
                         return this.setError('ERROR: No signer addresses provided for multi-signing');
                    }

                    const signerSeeds = this.utilsService.getMultiSignSeeds(this.multiSignSeeds);
                    if (signerSeeds.length === 0) {
                         return this.setError('ERROR: No signer seeds provided for multi-signing');
                    }

                    try {
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: trustSetTx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         trustSetTx.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(trustSetTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         trustSetTx.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));

                         if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, trustSetTx, multiSignFee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    console.log(`trustSetTx: ${JSON.stringify(trustSetTx, null, '\t')}`);
                    const preparedTx = await client.autofill(trustSetTx);
                    console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                    signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                    if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, trustSetTx, fee)) {
                         return this.setError('ERROR: Insufficient XRP to complete transaction');
                    }
               }

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }
               console.log('signed:', JSON.stringify(signedTx, null, '\t'));

               this.updateSpinnerMessage('Submitting transaction to the Ledger...');
               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Response:', JSON.stringify(response, null, '\t'));

               if (response.result.meta && typeof response.result.meta !== 'string' && response.result.meta.TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    console.error(`Transaction failed: ${JSON.stringify(response, null, 2)}`);
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               this.isMemoEnabled = false;
               this.memoField = '';

               await this.updateXrpBalance(client, wallet);
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
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

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               amount: this.amountField,
               destination: this.destinationFields,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.isMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               this.updateSpinnerMessage('Issuing Currency...');

               const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
               if (accountInfo == null) {
                    return this.setError(`Issuer account ${wallet.classicAddress} is not funded.`);
               }
               console.debug(`accountInfo for ${wallet.classicAddress} ${JSON.stringify(accountInfo.result, null, '\t')}`);

               const trustLines = await this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', '');
               console.debug(`Trust lines for ${wallet.classicAddress} ${JSON.stringify(trustLines, null, '\t')}`);

               const activeTrustLine = trustLines.result.lines.filter((line: any) => {
                    const decodedCurrency = this.utilsService.decodeIfNeeded(line.currency);
                    return line.account === this.destinationFields && (line.currency ? decodedCurrency === this.currencyField : true);
               });
               console.info(`Active trust lines for ${wallet.classicAddress} ${JSON.stringify(activeTrustLine, null, '\t')}`);

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
               const data: { sections: Section[] } = {
                    sections: [],
               };

               const activeTrustLines: TrustLine[] = (activeTrustLine as TrustLine[]).filter((line: TrustLine) => parseFloat(line.limit) > 0);
               if (activeTrustLines.length === 0) {
                    data.sections.push({
                         title: 'Trust Lines',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No active trust lines found from <code>${wallet.classicAddress}</code> to <code>${this.destinationFields}</code>` }],
                    });
               } else {
                    data.sections.push({
                         title: 'Trust Lines',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `Trust lines found from <code>${wallet.classicAddress}</code> to <code>${this.destinationFields}</code>` }],
                    });
               }

               let tx = null;
               const accountFlags = accountInfo.result.account_data.Flags;
               const asfDefaultRipple = 0x00800000;

               const fee = await this.xrplService.calculateTransactionFee(client);
               let lastLedgerIndex = await this.xrplService.getLastLedgerIndex(client);

               this.updateSpinnerMessage('Submitting transaction to the Ledger...');

               if ((accountFlags & asfDefaultRipple) === 0) {
                    const accountSetTx: AccountSet = {
                         TransactionType: 'AccountSet',
                         Account: wallet.classicAddress,
                         SetFlag: 8, // asfDefaultRipple
                         LastLedgerSequence: lastLedgerIndex + AppConstants.LAST_LEDGER_ADD_TIME,
                         Fee: fee,
                    };

                    if (this.ticketSequence) {
                         if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                              return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                         }
                         this.utilsService.setTicketSequence(accountSetTx, this.ticketSequence, true);
                    } else {
                         const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                         this.utilsService.setTicketSequence(accountSetTx, getAccountInfo.result.account_data.Sequence, false);
                    }

                    if (this.memoField) {
                         this.utilsService.setMemoField(accountSetTx, this.memoField);
                    }

                    if (this.currencyField === AppConstants.XRP_CURRENCY) {
                         if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, accountSetTx, fee)) {
                              return this.setError('ERROR: Insufficent XRP to complete transaction');
                         }
                    } else {
                         if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, accountSetTx, fee)) {
                              return this.setError('ERROR: Insufficent XRP to complete transaction');
                         }
                    }

                    let signedTx: { tx_blob: string; hash: string } | null = null;

                    if (this.isMultiSign) {
                         const signerAddresses = this.utilsService.getMultiSignAddress(this.multiSignAddress);
                         if (signerAddresses.length === 0) {
                              return this.setError('ERROR: No signer addresses provided for multi-signing');
                         }

                         const signerSeeds = this.utilsService.getMultiSignSeeds(this.multiSignSeeds);
                         if (signerSeeds.length === 0) {
                              return this.setError('ERROR: No signer seeds provided for multi-signing');
                         }
                         try {
                              const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: accountSetTx, signerAddresses, signerSeeds, fee });
                              signedTx = result.signedTx;
                              accountSetTx.Signers = result.signers;

                              console.log('Payment with Signers:', JSON.stringify(accountSetTx, null, 2));
                              console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                              if (!signedTx) {
                                   return this.setError('ERROR: No valid signature collected for multisign transaction');
                              }

                              const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                              console.log(`multiSignFee: ${multiSignFee}`);
                              accountSetTx.Fee = multiSignFee;
                              const finalTx = xrpl.decode(signedTx.tx_blob);
                              console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));

                              if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, accountSetTx, multiSignFee)) {
                                   return this.setError('ERROR: Insufficient XRP to complete transaction');
                              }
                         } catch (err: any) {
                              return this.setError(`ERROR: ${err.message}`);
                         }
                    } else {
                         console.log(`accountSetTx: ${JSON.stringify(accountSetTx, null, '\t')}`);
                         const preparedTx = await client.autofill(accountSetTx);
                         console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                         signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                         if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, accountSetTx, fee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    }

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign transaction.');
                    }
                    console.log('signed:', JSON.stringify(signedTx, null, '\t'));

                    this.updateSpinnerMessage('Submitting transaction to the Ledger...');
                    const response = await client.submitAndWait(signedTx.tx_blob);
                    console.log('Response:', JSON.stringify(response, null, '\t'));

                    if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                         console.error(`Transaction failed: ${JSON.stringify(response, null, 2)}`);
                         this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                         this.resultField.nativeElement.classList.add('error');
                         this.setErrorProperties();
                         return;
                    }

                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.result);

                    console.debug(`DefaultRipple enabled ${wallet.classicAddress}:`, tx);
                    console.debug(`DefaultRipple enabled ${wallet.classicAddress} ${JSON.stringify(tx, null, '\t')}`);

                    data.sections.push({
                         title: 'DefaultRipple Enabled',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `Enabled via AccountSet transaction for <code>${wallet.classicAddress}</code>` }],
                    });
               } else {
                    data.sections.push({
                         title: 'DefaultRipple Enabled',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `Default Ripple already enable for <code>${wallet.classicAddress}</code>` }],
                    });
               }

               lastLedgerIndex = await this.xrplService.getLastLedgerIndex(client);

               const curr = this.utilsService.encodeIfNeeded(this.currencyField);
               const paymentTx: Payment = {
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

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(paymentTx, this.ticketSequence, true);
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    this.utilsService.setTicketSequence(paymentTx, getAccountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(paymentTx, this.memoField);
               }

               if (this.currencyField === AppConstants.XRP_CURRENCY) {
                    if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, paymentTx, fee)) {
                         return this.setError('ERROR: Insufficent XRP to complete transaction');
                    }
               } else {
                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, paymentTx, fee)) {
                         return this.setError('ERROR: Insufficent XRP to complete transaction');
                    }
               }

               let signedTx: { tx_blob: string; hash: string } | null = null;

               if (this.isMultiSign) {
                    const signerAddresses = this.utilsService.getMultiSignAddress(this.multiSignAddress);
                    if (signerAddresses.length === 0) {
                         return this.setError('ERROR: No signer addresses provided for multi-signing');
                    }

                    const signerSeeds = this.utilsService.getMultiSignSeeds(this.multiSignSeeds);
                    if (signerSeeds.length === 0) {
                         return this.setError('ERROR: No signer seeds provided for multi-signing');
                    }

                    try {
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: paymentTx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         paymentTx.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(paymentTx, null, 2));
                         console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         paymentTx.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));

                         if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, multiSignFee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    const preparedTx = await client.autofill(paymentTx);
                    console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                    signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                    if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, tx, fee)) {
                         return this.setError('ERROR: Insufficient XRP to complete transaction');
                    }
               }

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }
               console.log(`signedTx: ${JSON.stringify(signedTx, null, '\t')}`);

               this.updateSpinnerMessage('Submitting transaction to the Ledger...');
               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log(`Response: ${JSON.stringify(response, null, '\t')}`);

               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               // New Balance section
               const updatedTrustLines = await this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', '');
               console.debug(`UpdatedTrustLines ${wallet.classicAddress} ${JSON.stringify(updatedTrustLines.result, null, '\t')}`);

               interface UpdatedTrustLine {
                    account: string;
                    currency: string;
                    balance: string;
                    [key: string]: any;
               }

               const decodedCurrency = this.utilsService.decodeIfNeeded(this.currencyField);
               const newTrustLine: UpdatedTrustLine | undefined = updatedTrustLines.result.lines.find((line: UpdatedTrustLine) => line.currency === decodedCurrency && (line.account === this.issuer.address || line.account === this.destinationFields));
               data.sections.push({
                    title: 'New Balance',
                    openByDefault: true,
                    content: [
                         {
                              key: 'Destination',
                              value: `<code>${this.destinationFields}</code>`,
                         },
                         {
                              key: 'Currency',
                              value: this.currencyField,
                         },
                         {
                              key: 'Balance',
                              value: newTrustLine ? newTrustLine.balance : 'Unknown',
                         },
                    ],
               });

               // Issuer Obligations section
               const gatewayBalances = await this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '');
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

               // Account Details section
               data.sections.push({
                    title: 'Account Details',
                    openByDefault: true,
                    content: [
                         { key: 'Issuer Address', value: `<code>${wallet.classicAddress}</code>` },
                         { key: 'Destination Address', value: `<code>${this.destinationFields}</code>` },
                         { key: 'XRP Balance (Issuer)', value: (await client.getXrpBalance(wallet.classicAddress)).toString() },
                    ],
               });

               this.utilsService.renderPaymentChannelDetails(data);
               // this.utilsService.renderTransactionsResults1(response, this.resultField.nativeElement, false);
               (response.result as any).clearInnerHtml = false;
               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               this.isMemoEnabled = false;
               this.memoField = '';

               await this.updateXrpBalance(client, wallet);
               await this.updateCurrencyBalance(wallet);
               this.updateGatewayBalance(gatewayBalances);
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving issueCurrency in ${this.executionTime}ms`);
          }
     }

     async onCurrencyChange() {
          console.log('Entering onCurrencyChange');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               this.spinner = true;
               await this.updateCurrencyBalance(wallet);

               // Fetch token balances
               const gatewayBalances = await this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '');
               console.debug(`gatewayBalances ${wallet.classicAddress} ${JSON.stringify(gatewayBalances.result, null, '\t')}`);

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

               // Obligations section (tokens issued by the account)
               if (gatewayBalances.result.obligations && Object.keys(gatewayBalances.result.obligations).length > 0) {
                    data.sections.push({
                         title: `Issuer Obligations (${Object.keys(gatewayBalances.result.obligations).length})`,
                         openByDefault: true,
                         subItems: Object.entries(gatewayBalances.result.obligations).map(([oblCurrency, amount], index) => {
                              const displayCurrency = this.utilsService.decodeIfNeeded(oblCurrency);
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
                    this.gatewayBalance = '';
                    data.sections.push({
                         title: 'Issuer Obligations',
                         openByDefault: true,
                         content: [{ key: 'Status', value: 'No obligations issued' }],
                    });
               }

               // Balances section (tokens held by the account)
               let balanceTotal: number = 0;
               if (gatewayBalances.result.assets && Object.keys(gatewayBalances.result.assets).length > 0) {
                    const balanceItems = [];
                    for (const [issuer, currencies] of Object.entries(gatewayBalances.result.assets)) {
                         for (const { currency, value } of currencies) {
                              let displayCurrency = currency;
                              const curr = this.utilsService.decodeIfNeeded(this.currencyField);
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

                              if (displayCurrency === this.currencyField) {
                                   balanceTotal = balanceTotal + Number(value);
                              }
                         }
                    }
                    data.sections.push({
                         title: `Balances (${balanceItems.length})`,
                         openByDefault: true,
                         subItems: balanceItems,
                    });
                    this.gatewayBalance = balanceTotal.toString();
               } else {
                    this.updateGatewayBalance(gatewayBalances);
                    data.sections.push({
                         title: 'Balances',
                         openByDefault: true,
                         content: [{ key: 'Status', value: 'No balances (tokens held by you)' }],
                    });
               }

               this.utilsService.renderPaymentChannelDetails(data);
               this.destinationFields = this.knownTrustLinesIssuers[this.currencyField];
          } catch (error: any) {
               console.error('Error fetching weWant balance:', error);
               this.currencyBalanceField = '0';
               return this.setError(`ERROR: Failed to fetch balance - ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving onCurrencyChange in ${this.executionTime}ms`);
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

     private async updateXrpBalance(client: xrpl.Client, wallet: xrpl.Wallet) {
          const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, wallet.classicAddress);

          this.ownerCount = ownerCount;
          this.totalXrpReserves = totalXrpReserves;

          const balance = (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0');
          this.account1.balance = balance.toString();
     }

     private refreshUiAccountObjects(accountObjects: any, wallet: any) {
          const signerAccounts = this.checkForSignerAccounts(accountObjects);

          if (signerAccounts?.length) {
               const signerEntriesKey = `${wallet.classicAddress}signerEntries`;
               const signerEntries: SignerEntry[] = this.storageService.get(signerEntriesKey) || [];

               console.log(`refreshUiAccountObjects: ${JSON.stringify(signerEntries, null, 2)}`);

               this.multiSignAddress = signerEntries.map(e => e.Account).join(',\n');
               this.multiSignSeeds = signerEntries.map(e => e.seed).join(',\n');
          } else {
               this.signerQuorum = 0;
               this.multiSignAddress = 'No Multi-Sign address configured for account';
               this.multiSignSeeds = '';
               this.isMultiSign = false;
               this.storageService.removeValue('signerEntries');
          }

          // Always reset memo fields
          this.isMemoEnabled = false;
          this.memoField = '';
     }

     private refreshUiAccountInfo(accountInfo: any) {
          const regularKey = accountInfo?.result?.account_data?.RegularKey;

          if (regularKey) {
               this.regularKeyAddress = regularKey;
               const regularKeySeedAccount = accountInfo.result.account_data.Account + 'regularKeySeed';
               this.regularKeySeed = this.storageService.get(regularKeySeedAccount);
               // this.isRegularKeyAddress = true;
          } else {
               this.isRegularKeyAddress = false;
               this.regularKeyAddress = 'No RegularKey configured for account';
               this.regularKeySeed = '';
          }
     }

     private validateInputs(inputs: { seed?: string; amount?: string; destination?: string; sequence?: string; selectedAccount?: 'account1' | 'account2' | 'issuer' | null; multiSignAddresses?: string; multiSignSeeds?: string; regularKeyAddress?: string; regularKeySeed?: string }): string | null {
          const { seed, amount, destination, selectedAccount, regularKeyAddress, regularKeySeed, multiSignAddresses, multiSignSeeds } = inputs;

          // 1. Account selection
          if (selectedAccount === null || selectedAccount === undefined) {
               return 'Please select an account';
          }

          // 2. Seed
          if (seed) {
               const { type, value } = this.utilsService.detectXrpInputType(seed);
               if (value === 'unknown') {
                    return 'Account seed is invalid';
               }
          }

          // 3. Amount
          if (amount) {
               if (!this.utilsService.validateInput(amount)) {
                    return 'XRP Amount cannot be empty';
               }
               const numAmount = parseFloat(amount);
               if (isNaN(numAmount) || !isFinite(numAmount)) {
                    return 'XRP Amount must be a valid number';
               }
               if (numAmount <= 0) {
                    return 'XRP Amount must be a positive number';
               }
          }

          // 5. Destination
          if (destination && !this.utilsService.validateInput(destination)) {
               return 'Destination cannot be empty';
          }

          // 6. Regular key
          if (regularKeyAddress && regularKeyAddress !== 'No RegularKey configured for account') {
               if (!xrpl.isValidAddress(regularKeyAddress)) {
                    return 'Regular Key Address is invalid or empty';
               }
          }

          if (regularKeySeed && !xrpl.isValidSecret(regularKeySeed)) {
               return 'ERROR: Regular Key Seed is invalid or empty';
          }

          // 7. Multi-sign
          if (multiSignAddresses && multiSignSeeds) {
               const addresses = multiSignAddresses
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
               const seeds = multiSignSeeds
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);

               if (addresses.length === 0) {
                    return 'At least one signer address is required for multi-signing';
               }
               if (addresses.length !== seeds.length) {
                    return 'Number of signer addresses must match number of signer seeds';
               }

               const invalidAddr = addresses.find(addr => !xrpl.isValidAddress(addr));
               if (invalidAddr) {
                    return `Invalid signer address: ${invalidAddr}`;
               }

               if (seeds.some(s => !xrpl.isValidSecret(s))) {
                    return 'One or more signer seeds are invalid';
               }
          }

          return null;
     }

     private updateDestinations() {
          const knownDestinationsTemp = this.utilsService.populateKnownDestinations(this.knownDestinations, this.account1.address, this.account2.address, this.issuer.address);
          this.destinations = [...Object.values(knownDestinationsTemp)];
          this.storageService.setKnownIssuers('destinations', knownDestinationsTemp);
          this.destinationFields = this.issuer.address;
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
                    await this.onCurrencyChange();
                    await this.getTrustlinesForAccount();
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

     clearFields() {
          this.amountField = '';
          this.currencyField = '';
          this.currencyBalanceField = '0';
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

     private async updateCurrencyBalance(wallet: xrpl.Wallet) {
          let balance: string;
          const currencyCode = this.utilsService.encodeIfNeeded(this.currencyField);
          if (wallet.classicAddress) {
               const balanceResult = await this.utilsService.getCurrencyBalance(currencyCode, wallet.classicAddress);
               balance = balanceResult !== null ? balanceResult.toString() : '0';
               this.currencyBalanceField = balance;
          } else {
               this.currencyBalanceField = '0';
          }
     }

     private updateGatewayBalance(gatewayBalances: xrpl.GatewayBalancesResponse) {
          if (gatewayBalances.result.obligations && Object.keys(gatewayBalances.result.obligations).length > 0) {
               const displayCurrency = this.utilsService.encodeIfNeeded(this.currencyField);
               this.gatewayBalance = gatewayBalances.result.obligations[displayCurrency];
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

     private canRemoveTrustline(line: any): { canRemove: boolean; reasons: string[] } {
          const reasons: string[] = [];

          if (parseFloat(line.balance) !== 0) {
               reasons.push(`Balance is ${line.balance} (must be 0)`);
          }

          if (line.no_ripple) {
               reasons.push(`NoRipple flag is set`);
          }
          if (line.freeze) {
               reasons.push(`Freeze flag is set`);
          }
          if (line.authorized) {
               reasons.push(`Authorized flag is set (issuer must unauthorize before deletion)`);
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
