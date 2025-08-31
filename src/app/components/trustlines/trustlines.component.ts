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
     currencyBalanceField: string = '';
     destinationField: string = '';
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

     constructor(private xrplService: XrplService, private utilsService: UtilsService, private cdr: ChangeDetectorRef, private storageService: StorageService) {}

     ngOnInit() {
          const storedIssuers = this.storageService.getKnownIssuers('knownIssuers');
          if (storedIssuers) {
               this.knownTrustLinesIssuers = storedIssuers;
          }
          this.updateCurrencies();
          this.currencyField = 'USD'; // BOB Set default selected currency if available
     }

     async ngAfterViewInit() {
          try {
               const wallet = await this.getWallet();
               this.loadSignerList(wallet.classicAddress);
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
          if (!this.selectedAccount) return;
          if (this.selectedAccount === 'account1') {
               this.displayDataForAccount1();
          } else if (this.selectedAccount === 'account2') {
               this.displayDataForAccount2();
          } else {
               this.displayDataForAccount3();
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

     toggleTicketSequence() {
          this.cdr.detectChanges();
     }

     validateQuorum() {
          const totalWeight = this.signers.reduce((sum, s) => sum + (s.weight || 0), 0);
          if (this.signerQuorum > totalWeight) {
               this.signerQuorum = totalWeight;
          }
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
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed,
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
               console.debug(`accountInfo for ${wallet.classicAddress} ${JSON.stringify(accountInfo.result, null, '\t')}`);

               const accountObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '');
               if (accountObjects.result.account_objects.length <= 0) {
                    this.resultField.nativeElement.innerHTML = `No account objects found for ${wallet.classicAddress}`;
                    return;
               }
               console.debug(`accountObjects for ${wallet.classicAddress} ${JSON.stringify(accountObjects.result, null, '\t')}`);

               const trustLines = await this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', '');
               console.debug(`Trust lines for ${wallet.classicAddress} ${JSON.stringify(trustLines, null, '\t')}`);
               const activeTrustLine = trustLines.result.lines.filter((line: any) => {
                    // Decode currency for comparison
                    const decodedCurrency = line.currency.length > 3 ? this.utilsService.decodeCurrencyCode(line.currency) : line.currency;
                    return line.currency ? decodedCurrency === this.currencyField : true;
               });
               console.debug(`Active Trust lines for ${wallet.classicAddress} ${JSON.stringify(activeTrustLine, null, '\t')}`);

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

               const activeTrustLines: TrustLine[] = activeTrustLine as TrustLine[];
               if (activeTrustLines.length === 0) {
                    data.sections.push({
                         title: 'Trust Lines',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No active trust lines found for <code>${this.currencyField}</code> and <code>${wallet.classicAddress}</code>` }],
                    });
               } else {
                    // Group trust lines by currency and issuer, and calculate total balance for each
                    const balanceByToken = activeTrustLines.reduce((acc: { [key: string]: number }, line: TrustLine) => {
                         const currency = line.currency.length > 3 ? this.utilsService.decodeCurrencyCode(line.currency) : line.currency;
                         const issuer = line.issuer || 'no-issuer'; // Handle cases with no issuer
                         const key = `${currency}:${issuer}`;
                         acc[key] = (acc[key] || 0) + parseFloat(line.balance);
                         return acc;
                    }, {});

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
                              const displayCurrency = line.currency.length > 3 ? this.utilsService.decodeCurrencyCode(line.currency) : line.currency;
                              return {
                                   key: `Trust Line ${index + 1} (${displayCurrency}${line.issuer ? `, Issuer: ${line.issuer}` : ''})`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Currency', value: displayCurrency ?? '' },
                                        { key: 'Issuer', value: line.issuer ? `<code>${line.issuer}</code>` : '' },
                                        { key: 'Account', value: line.account ?? '' },
                                        { key: 'Limit', value: line.limit ?? '' },
                                        { key: 'Balance', value: line.balance != null ? `${line.balance} ${displayCurrency}` : '' },
                                        // { key: 'Freeze', value: line.freeze ?? '' }, // Removed: TrustLine does not have 'freeze'
                                        { key: 'Limit Peer', value: line.limit_peer ?? '' },
                                        { key: 'No Ripple', value: line.no_ripple != null ? String(line.no_ripple) : '' },
                                        { key: 'No Ripple Peer', value: line.no_ripple_peer != null ? String(line.no_ripple_peer) : '' },
                                        { key: 'Quality In', value: line.quality_in != null ? String(line.quality_in) : '' },
                                        { key: 'Quality Out', value: line.quality_out != null ? String(line.quality_out) : '' },
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

                    // Balances section (tokens held by the account)
                    if (tokenBalance.result.assets && Object.keys(tokenBalance.result.assets).length > 0) {
                         const balanceItems = [];
                         for (const [issuer, currencies] of Object.entries(tokenBalance.result.assets)) {
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
                    }
               }

               this.utilsService.renderPaymentChannelDetails(data);
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), wallet);
               this.refreshUiAccountInfo(accountInfo);
               this.loadSignerList(wallet.classicAddress);
               this.setSuccess(this.result);

               this.isMemoEnabled = false;
               this.memoField = '';
               this.amountField = '';

               const currency = this.currencyField.length > 3 ? this.utilsService.decodeCurrencyCode(this.currencyField) : this.currencyField;
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
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed,
               amount: this.amountField,
               destination: this.destinationField,
               multiSignAddresses: this.isMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.isMultiSign ? this.multiSignSeeds : undefined,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();

               let regularKeyWalletSignTx: any = '';
               let useRegularKeyWalletSignTx = false;
               if (this.isRegularKeyAddress && !this.isMultiSign) {
                    console.log('Using Regular Key Seed for transaction signing');
                    regularKeyWalletSignTx = await this.utilsService.getWallet(this.regularKeySeed, environment);
                    useRegularKeyWalletSignTx = true;
               }

               const wallet = await this.getWallet();

               this.updateSpinnerMessage('Setting Trustline...');

               // Validate flag combinations
               if (this.trustlineFlags['tfSetNoRipple'] && this.trustlineFlags['tfClearNoRipple']) {
                    return this.setError('ERROR: Cannot set both tfSetNoRipple and tfClearNoRipple');
               }
               if (this.trustlineFlags['tfSetFreeze'] && this.trustlineFlags['tfClearFreeze']) {
                    return this.setError('ERROR: Cannot set both tfSetFreeze and tfClearFreeze');
               }

               let currencyFieldTemp: string = this.currencyField.length > 3 ? this.utilsService.encodeCurrencyCode(this.currencyField) : this.currencyField;

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
                         issuer: this.destinationField,
                         value: this.amountField,
                    },
                    Flags: flags, // numeric bitmask of selected options
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    trustSetTx.TicketSequence = Number(this.ticketSequence);
                    trustSetTx.Sequence = 0;
               } else {
                    const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    trustSetTx.Sequence = accountInfo.result.account_data.Sequence;
               }

               if (this.memoField) {
                    trustSetTx.Memos = [
                         {
                              Memo: {
                                   MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                                   MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                              },
                         },
                    ];
               }

               let signedTx: { tx_blob: string; hash: string } | null = null;

               if (this.isMultiSign) {
                    const signerAddresses = this.multiSignAddress
                         .split(',')
                         .map(s => s.trim())
                         .filter(s => s.length > 0); // removes empty strings

                    if (signerAddresses.length === 0) {
                         return this.setError('ERROR: No signers provided for multi-signing');
                    }

                    const signerSeeds = this.multiSignSeeds.split(',').map(s => s.trim());

                    try {
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: trustSetTx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         trustSetTx.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(trustSetTx, null, 2));
                         console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         trustSetTx.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    console.log(`trustSetTx: ${JSON.stringify(trustSetTx, null, '\t')}`);
                    const preparedTx = await client.autofill(trustSetTx);
                    console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                    if (useRegularKeyWalletSignTx) {
                         signedTx = regularKeyWalletSignTx.sign(preparedTx);
                    } else {
                         signedTx = wallet.sign(preparedTx);
                    }
               }

               this.updateSpinnerMessage('Submitting transaction to the Ledger...');

               if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, trustSetTx, fee)) {
                    return this.setError('ERROR: Insufficent XRP to complete transaction');
               }

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }

               console.log('signed:', signedTx);

               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Response', response);

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
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed,
               multiSignAddresses: this.isMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.isMultiSign ? this.multiSignSeeds : undefined,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();

               let regularKeyWalletSignTx: any = '';
               let useRegularKeyWalletSignTx = false;
               if (this.isRegularKeyAddress && !this.isMultiSign) {
                    console.log('Using Regular Key Seed for transaction signing');
                    regularKeyWalletSignTx = await this.utilsService.getWallet(this.regularKeySeed, environment);
                    useRegularKeyWalletSignTx = true;
               }

               const wallet = await this.getWallet();

               // Validate flag combinations
               if (this.trustlineFlags['tfSetNoRipple'] && this.trustlineFlags['tfClearNoRipple']) {
                    return this.setError('ERROR: Cannot set both tfSetNoRipple and tfClearNoRipple');
               }
               if (this.trustlineFlags['tfSetFreeze'] && this.trustlineFlags['tfClearFreeze']) {
                    return this.setError('ERROR: Cannot set both tfSetFreeze and tfClearFreeze');
               }

               this.updateSpinnerMessage('Removing Trustline...');

               const trustLines = await this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', '');
               console.debug(`All trust lines for ${wallet.classicAddress} ${JSON.stringify(trustLines, null, '\t')}`);

               // Normalize currency for comparison
               const currencyMatch = this.currencyField.length > 3 ? this.utilsService.encodeCurrencyCode(this.currencyField) : this.currencyField;

               // Find the specific trustline to the issuer (destinationField)
               const trustLine = trustLines.result.lines.find((line: any) => {
                    const lineCurrency = line.currency.length > 3 ? this.utilsService.decodeCurrencyCode(line.currency) : line.currency;
                    return line.account === this.destinationField && lineCurrency === this.currencyField;
               });

               // If not found, exit early
               if (!trustLine) {
                    this.resultField.nativeElement.innerHTML = `No trust line found for ${this.currencyField} to issuer ${this.destinationField}`;
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

               let currencyFieldTemp: string = this.currencyField.length > 3 ? this.utilsService.encodeCurrencyCode(this.currencyField) : this.currencyField;

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
                         issuer: this.destinationField,
                         value: '0',
                    },
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               delete trustSetTx.Flags;

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    trustSetTx.TicketSequence = Number(this.ticketSequence);
                    trustSetTx.Sequence = 0;
               } else {
                    const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    trustSetTx.Sequence = accountInfo.result.account_data.Sequence;
               }

               if (this.memoField) {
                    trustSetTx.Memos = [
                         {
                              Memo: {
                                   MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                                   MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                              },
                         },
                    ];
               }

               let signedTx: { tx_blob: string; hash: string } | null = null;

               if (this.isMultiSign) {
                    const signerAddresses = this.multiSignAddress
                         .split(',')
                         .map(s => s.trim())
                         .filter(s => s.length > 0); // removes empty strings

                    if (signerAddresses.length === 0) {
                         return this.setError('ERROR: No signers provided for multi-signing');
                    }

                    const signerSeeds = this.multiSignSeeds.split(',').map(s => s.trim());

                    try {
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: trustSetTx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         trustSetTx.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(trustSetTx, null, 2));
                         console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         trustSetTx.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    console.log(`trustSetTx: ${JSON.stringify(trustSetTx, null, '\t')}`);
                    const preparedTx = await client.autofill(trustSetTx);
                    console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                    if (useRegularKeyWalletSignTx) {
                         signedTx = regularKeyWalletSignTx.sign(preparedTx);
                    } else {
                         signedTx = wallet.sign(preparedTx);
                    }
               }

               this.updateSpinnerMessage('Submitting transaction to the Ledger...');

               if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, trustSetTx, fee)) {
                    return this.setError('ERROR: Insufficent XRP to complete transaction');
               }

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }

               console.log('signed:', signedTx);

               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Response', response);

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
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed,
               amount: this.amountField,
               destination: this.destinationField,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          // const currencyBalanceField = document.getElementById('currencyBalanceField') as HTMLInputElement | null;
          // if (parseFloat(this.amountField) > parseFloat(currencyBalanceField?.value || '0')) {
          //      return this.setError('ERROR: Currency Amount must be less than the currency balance.');
          // }

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();

               let regularKeyWalletSignTx: any = '';
               let useRegularKeyWalletSignTx = false;
               if (this.isRegularKeyAddress && !this.isMultiSign) {
                    console.log('Using Regular Key Seed for transaction signing');
                    regularKeyWalletSignTx = await this.utilsService.getWallet(this.regularKeySeed, environment);
                    useRegularKeyWalletSignTx = true;
               }

               const wallet = await this.getWallet();

               this.updateSpinnerMessage('Issuing Currency...');

               // if (this.currencyField !== AppConstants.XRP_CURRENCY) {
               //      if (parseFloat(this.amountField) > parseFloat(this.currencyBalanceField)) {
               //           return this.setError('ERROR: Insufficent Currency balance to complete transaction');
               //      }
               // }

               const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
               if (accountInfo == null) {
                    return this.setError(`Issuer account ${wallet.classicAddress} is not funded.`);
               }
               console.debug(`accountInfo for ${wallet.classicAddress} ${JSON.stringify(accountInfo.result, null, '\t')}`);

               const trustLines = await this.xrplService.getAccountLines(client, wallet.classicAddress, 'validated', '');
               console.debug(`Trust lines for ${wallet.classicAddress} ${JSON.stringify(trustLines, null, '\t')}`);

               const activeTrustLine = trustLines.result.lines.filter((line: any) => {
                    // Decode currency for comparison
                    const decodedCurrency = line.currency.length > 3 ? this.utilsService.decodeCurrencyCode(line.currency) : line.currency;
                    return line.account === this.destinationField && (line.currency ? decodedCurrency === this.currencyField : true);
               });
               console.debug(`Active trust lines for ${wallet.classicAddress} ${JSON.stringify(activeTrustLine, null, '\t')}`);

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
                         content: [{ key: 'Status', value: `No active trust lines found from <code>${wallet.classicAddress}</code> to <code>${this.destinationField}</code>` }],
                    });
               } else {
                    data.sections.push({
                         title: 'Trust Lines',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `Trust lines found from <code>${wallet.classicAddress}</code> to <code>${this.destinationField}</code>` }],
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
                         accountSetTx.TicketSequence = Number(this.ticketSequence);
                         accountSetTx.Sequence = 0;
                    } else {
                         const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                         accountSetTx.Sequence = accountInfo.result.account_data.Sequence;
                    }

                    if (this.memoField) {
                         accountSetTx.Memos = [
                              {
                                   Memo: {
                                        MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                                        MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                                   },
                              },
                         ];
                    }

                    let signedTx: { tx_blob: string; hash: string } | null = null;

                    if (this.isMultiSign) {
                         const signerAddresses = this.multiSignAddress
                              .split(',')
                              .map(s => s.trim())
                              .filter(s => s.length > 0); // removes empty strings

                         if (signerAddresses.length === 0) {
                              return this.setError('ERROR: No signers provided for multi-signing');
                         }

                         const signerSeeds = this.multiSignSeeds.split(',').map(s => s.trim());

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
                         } catch (err: any) {
                              return this.setError(`ERROR: ${err.message}`);
                         }
                    } else {
                         console.log(`accountSetTx: ${JSON.stringify(accountSetTx, null, '\t')}`);
                         const preparedTx = await client.autofill(accountSetTx);
                         console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                         if (useRegularKeyWalletSignTx) {
                              signedTx = regularKeyWalletSignTx.sign(preparedTx);
                         } else {
                              signedTx = wallet.sign(preparedTx);
                         }
                    }

                    this.updateSpinnerMessage('Submitting transaction to the Ledger...');

                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, accountSetTx, fee)) {
                         return this.setError('ERROR: Insufficent XRP to complete transaction');
                    }

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign transaction.');
                    }

                    console.log('signed:', signedTx);

                    const response = await client.submitAndWait(signedTx.tx_blob);
                    console.log('Response', response);

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

               const curr = this.currencyField.length > 3 ? this.utilsService.decodeCurrencyCode(this.currencyField) : this.currencyField;
               const paymentTx: Payment = {
                    TransactionType: 'Payment',
                    Account: wallet.classicAddress,
                    Destination: this.destinationField,
                    Amount: {
                         currency: curr,
                         value: this.amountField,
                         issuer: this.issuer.address,
                         // issuer: wallet.classicAddress,
                    },
                    Fee: fee,
                    LastLedgerSequence: lastLedgerIndex + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    paymentTx.TicketSequence = Number(this.ticketSequence);
                    paymentTx.Sequence = 0;
               } else {
                    const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    paymentTx.Sequence = accountInfo.result.account_data.Sequence;
               }

               if (this.memoField) {
                    paymentTx.Memos = [
                         {
                              Memo: {
                                   MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                                   MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                              },
                         },
                    ];
               }

               let signedTx: { tx_blob: string; hash: string } | null = null;

               if (this.isMultiSign) {
                    const signerAddresses = this.multiSignAddress
                         .split(',')
                         .map(s => s.trim())
                         .filter(s => s.length > 0); // removes empty strings

                    if (signerAddresses.length === 0) {
                         return this.setError('ERROR: No signers provided for multi-signing');
                    }

                    const signerSeeds = this.multiSignSeeds.split(',').map(s => s.trim());

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
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    const preparedTx = await client.autofill(paymentTx);
                    console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                    if (useRegularKeyWalletSignTx) {
                         signedTx = regularKeyWalletSignTx.sign(preparedTx);
                    } else {
                         signedTx = wallet.sign(preparedTx);
                    }
               }

               this.updateSpinnerMessage('Submitting transaction to the Ledger...');

               if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, paymentTx, fee)) {
                    return this.setError('ERROR: Insufficent XRP to complete transaction');
               }

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }
               console.log(`signedTx: ${JSON.stringify(signedTx, null, '\t')}`);

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
               interface UpdatedTrustLine {
                    account: string;
                    currency: string;
                    balance: string;
                    [key: string]: any;
               }

               console.debug(`UpdatedTrustLines ${wallet.classicAddress} ${JSON.stringify(updatedTrustLines.result, null, '\t')}`);

               const decodedCurrency = this.currencyField.length > 3 ? this.utilsService.decodeCurrencyCode(this.currencyField) : this.currencyField;
               const newTrustLine: UpdatedTrustLine | undefined = updatedTrustLines.result.lines.find((line: UpdatedTrustLine) => line.currency === decodedCurrency && (line.account === this.issuer.address || line.account === this.destinationField));
               data.sections.push({
                    title: 'New Balance',
                    openByDefault: true,
                    content: [
                         {
                              key: 'Destination',
                              value: `<code>${this.destinationField}</code>`,
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
                         { key: 'Destination Address', value: `<code>${this.destinationField}</code>` },
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

          if (!this.selectedAccount) {
               this.setError('Please select an account');
               this.currencyBalanceField = '0';
               this.setErrorProperties();
               return;
          }
          const address = this.selectedAccount === 'account1' ? this.account1.address : this.selectedAccount === 'account2' ? this.account2.address : this.issuer.address;
          if (!this.utilsService.validateInput(address)) {
               this.setError('ERROR: Account address cannot be empty');
               this.currencyBalanceField = '0';
               this.setErrorProperties();
               return;
          }

          try {
               const client = await this.xrplService.getClient();

               this.spinner = true;
               let balance: string;
               const currencyCode = this.currencyField && this.currencyField.length > 3 ? this.utilsService.encodeCurrencyCode(this.currencyField) : this.currencyField ? this.currencyField : '';
               if (address) {
                    const balanceResult = await this.utilsService.getCurrencyBalance(currencyCode, address);
                    balance = balanceResult !== null ? balanceResult.toString() : '0';
                    this.currencyBalanceField = balance;
               } else {
                    this.currencyBalanceField = '0';
               }

               // Fetch token balances
               const gatewayBalances = await this.xrplService.getTokenBalance(client, address, 'validated', '');
               console.debug(`gatewayBalances ${address} ${JSON.stringify(gatewayBalances.result, null, '\t')}`);

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
                              const displayCurrency = oblCurrency.length > 3 ? this.utilsService.decodeCurrencyCode(oblCurrency) : oblCurrency;
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
                         title: 'Issuer Obligations',
                         openByDefault: true,
                         content: [{ key: 'Status', value: 'No obligations issued' }],
                    });
               }

               // Balances section (tokens held by the account)
               if (gatewayBalances.result.assets && Object.keys(gatewayBalances.result.assets).length > 0) {
                    const balanceItems = [];
                    for (const [issuer, currencies] of Object.entries(gatewayBalances.result.assets)) {
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
               this.destinationField = this.knownTrustLinesIssuers[this.currencyField];
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

     private updateSpinnerMessage(message: string) {
          this.spinnerMessage = message;
          this.cdr.detectChanges();
     }

     private async showSpinnerWithDelay(message: string, delayMs: number = 200) {
          this.spinner = true;
          this.updateSpinnerMessage(message);
          await new Promise(resolve => setTimeout(resolve, delayMs)); // Minimum display time for initial spinner
     }

     private async updateXrpBalance(client: xrpl.Client, wallet: xrpl.Wallet) {
          const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, wallet.classicAddress);
          this.ownerCount = ownerCount;
          this.totalXrpReserves = totalXrpReserves;
          const balance = (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0');
          if (this.selectedAccount === 'account1') {
               this.account1.balance = balance.toString();
          } else if (this.selectedAccount === 'account2') {
               this.account1.balance = balance.toString();
          } else {
               this.account1.balance = balance.toString();
          }
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
     }

     private validateInputs(inputs: { seed?: string; amount?: string; destination?: string; sequence?: string; selectedAccount?: 'account1' | 'account2' | 'issuer' | null; multiSignAddresses?: string; multiSignSeeds?: string }): string | null {
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
          this.amountField = '';
          this.currencyField = '';
          this.currencyBalanceField = '0';
          this.memoField = '';
          this.ticketSequence = '';
          this.isTicket = false;
          this.cdr.detectChanges();
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

     async getWallet() {
          const environment = this.xrplService.getNet().environment;
          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed;
          const wallet = await this.utilsService.getWallet(seed, environment);
          if (!wallet) {
               throw new Error('ERROR: Wallet could not be created or is undefined');
          }
          return wallet;
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

     clearSignerList() {
          this.signers = [{ account: '', seed: '', weight: 1 }];
     }

     /**
      * Checks if a trustline can be removed.
      * @param line The trustline object from account_lines
      * @returns { canRemove: boolean, reasons: string[] }
      */
     canRemoveTrustline(line: any): { canRemove: boolean; reasons: string[] } {
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
          this.destinationField = this.storageService.getInputValue(`${otherPrefix}address`) || AppConstants.EMPTY_STRING;

          // Fetch account details and trustlines
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
