import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { WalletMultiInputComponent } from '../wallet-multi-input/wallet-multi-input.component';
import { StorageService } from '../../services/storage.service';
import { CheckCreate, CheckCash, CheckCancel, TransactionMetadataBase } from 'xrpl';
import * as xrpl from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';

interface ValidationInputs {
     selectedAccount?: 'account1' | 'account2' | 'issuer' | null;
     senderAddress?: string;
     seed?: string;
     amount?: string;
     destination?: string;
     checkId?: string;
     destinationTag?: string;
     multiSignAddresses?: string;
     multiSignSeeds?: string;
     regularKeyAddress?: string;
     regularKeySeed?: string;
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
     selector: 'app-send-checks',
     standalone: true,
     imports: [CommonModule, FormsModule, WalletMultiInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './send-checks.component.html',
     styleUrl: './send-checks.component.css',
})
export class SendChecksComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     @ViewChild('accountForm') accountForm!: NgForm;
     selectedAccount: 'account1' | 'account2' | 'issuer' | null = 'account1';
     private lastResult: string = '';
     transactionInput: string = '';
     result: string = '';
     currencyFieldDropDownValue: string = 'XRP';
     checkExpirationTime: string = 'seconds';
     expirationTimeField: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = false;
     account1 = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '0' };
     account2 = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '0' };
     issuer = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '0' };
     xrpBalance1Field: string = '';
     checkIdField: string = '';
     ownerCount: string = '';
     totalXrpReserves: string = '';
     executionTime: string = '';
     amountField: string = '';
     destinationFields: string = '';
     destinationTagField: string = '';
     memoField: string = '';
     isMemoEnabled: boolean = false;
     multiSignAddress: string = '';
     isMultiSign: boolean = false;
     multiSignSeeds: string = '';
     isRegularKeyAddress: boolean = false;
     regularKeySeed: string = '';
     regularKeyAddress: string = '';
     signerQuorum: number = 0;
     ticketSequence: string = '';
     isTicket: boolean = false;
     isTicketEnabled: boolean = false;
     spinner: boolean = false;
     spinnerMessage: string = '';
     issuers: string[] = [];
     selectedIssuer: string = '';
     tokenBalance: string = '';
     private knownTrustLinesIssuers: { [key: string]: string } = {
          RLUSD: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De',
     };
     private knownDestinations: { [key: string]: string } = {};
     destinations: string[] = [];
     currencies: string[] = [];
     currencyIssuers: string[] = [];
     newCurrency: string = '';
     newIssuer: string = '';
     tokenToRemove: string = '';
     signers: { account: string; seed: string; weight: number }[] = [{ account: '', seed: '', weight: 1 }];

     constructor(private xrplService: XrplService, private utilsService: UtilsService, private cdr: ChangeDetectorRef, private storageService: StorageService) {}

     async ngOnInit(): Promise<void> {
          const storedIssuers = this.storageService.getKnownIssuers('knownIssuers');
          if (storedIssuers) {
               this.knownTrustLinesIssuers = storedIssuers;
          }
          const storedDestinations = this.storageService.getKnownIssuers('destinations');
          if (storedDestinations) {
               this.knownDestinations = storedDestinations;
          }
          this.updateCurrencies();
          this.currencyFieldDropDownValue = 'XRP'; // Set default to XRP
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
               this.destinationFields = this.issuer.address;
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

     async toggleIssuerField() {
          this.issuers = [];
          this.selectedIssuer = '';
          this.tokenBalance = '';
          if (this.currencyFieldDropDownValue !== 'XRP' && this.selectedAccount) {
               const seed = this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer);
               const address = this.utilsService.getSelectedAddressWithIssuer(this.selectedAccount, this.account1, this.account2, this.issuer);
               if (this.utilsService.validateInput(seed) && this.utilsService.validateInput(address)) {
                    try {
                         const client = await this.xrplService.getClient();
                         const tokenBalanceData = await this.utilsService.getTokenBalance(client, address, this.currencyFieldDropDownValue, '');
                         this.issuers = tokenBalanceData.issuers;
                         this.tokenBalance = tokenBalanceData.total.toString();
                         const balanceResult = await this.utilsService.getCurrencyBalance(this.currencyFieldDropDownValue, address);
                         console.log(`balanceResult ${balanceResult}`);
                         if (balanceResult) {
                              this.tokenBalance = Math.abs(balanceResult).toString();
                         }
                         if (this.selectedAccount === 'account1') {
                              this.account1.balance = tokenBalanceData.xrpBalance.toString();
                         } else if (this.selectedAccount === 'account2') {
                              this.account2.balance = tokenBalanceData.xrpBalance.toString();
                         } else {
                              this.issuer.balance = tokenBalanceData.xrpBalance.toString();
                         }
                         this.currencyIssuers = [this.knownTrustLinesIssuers[this.currencyFieldDropDownValue] || ''];
                    } catch (error: any) {
                         console.error('Error fetching token balance:', error);
                         this.setError(`ERROR: Failed to fetch token balance - ${error.message || 'Unknown error'}`);
                    }
               }
          }
          this.cdr.detectChanges();
     }

     async getChecks() {
          console.log('Entering getChecks');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
          };
          const errors = await this.validateInputs(inputs, 'get');
          if (errors.length > 0) {
               return this.setError(`ERROR: ${errors.join('; ')}`);
          }

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               this.showSpinnerWithDelay('Getting Checks ...', 250);

               const check_objects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'check');
               console.debug(`Check objects: ${JSON.stringify(check_objects, null, '\t')}`);

               const data = {
                    sections: [{}],
               };

               if (check_objects.result.account_objects.length <= 0) {
                    data.sections.push({
                         title: 'Checks',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No checks found for <code>${wallet.classicAddress}</code>` }],
                    });
               } else {
                    data.sections.push({
                         title: `Checks (${check_objects.result.account_objects.length})`,
                         openByDefault: true,
                         subItems: check_objects.result.account_objects.map((check, counter) => {
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
                              const amountDisplay = amountValue ? (typeof amountValue === 'string' ? `${xrpl.dropsToXrp(amountValue)} XRP` : `${amountValue.value} ${amountValue.currency} (<code>${amountValue.issuer}</code>)`) : 'N/A';
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

               this.utilsService.renderPaymentChannelDetails(data);
               this.setSuccess(this.result);
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), wallet);
               this.refreshUiAccountInfo(await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''));
               this.utilsService.loadSignerList(wallet.classicAddress, this.signers);

               this.isMemoEnabled = false;
               this.memoField = '';

               await this.toggleIssuerField();
               await this.updateXrpBalance(client, wallet);
          } catch (error: any) {
               console.error('Error:', error);
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

          const inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               senderAddress: this.utilsService.getSelectedAddressWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               destination: this.destinationFields,
               destinationTag: this.destinationTagField,
               amount: this.amountField,
          };
          const errors = await this.validateInputs(inputs, 'send');
          if (errors.length > 0) {
               return this.setError(`ERROR: ${errors.join('; ')}`);
          }

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
               const balance = Number(this.tokenBalance);

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
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.isMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               // Build SendMax amount
               let sendMax;
               if (this.currencyFieldDropDownValue === AppConstants.XRP_CURRENCY) {
                    sendMax = xrpl.xrpToDrops(this.amountField);
               } else {
                    sendMax = {
                         currency: this.currencyFieldDropDownValue,
                         value: this.amountField,
                         issuer: wallet.address,
                    };
               }

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               let tx: CheckCreate = await client.autofill({
                    TransactionType: 'CheckCreate',
                    Account: wallet.classicAddress,
                    SendMax: sendMax,
                    Destination: this.destinationFields,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               });

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(tx, this.ticketSequence, true);
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    this.utilsService.setTicketSequence(tx, getAccountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(tx, this.memoField);
               }

               if (checkExpiration && checkExpiration != '') {
                    this.utilsService.setExpiration(tx, Number(checkExpiration));
               }

               if (this.destinationTagField && parseInt(this.destinationTagField) > 0) {
                    this.utilsService.setDestinationTag(tx, this.destinationTagField);
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
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: tx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         tx.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(tx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }
                         console.log('signed:', JSON.stringify(signedTx, null, '\t'));

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         tx.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));

                         if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, multiSignFee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    const preparedTx = await client.autofill(tx);
                    console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                    signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, fee)) {
                         return this.setError('ERROR: Insufficient XRP to complete transaction');
                    }
               }

               console.debug(`Parse Tx Flags: ${JSON.stringify(xrpl.parseTransactionFlags(tx), null, '\t')}`);

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }
               console.log('signed:', JSON.stringify(signedTx, null, '\t'));

               this.updateSpinnerMessage('Submitting transaction to the Ledger ...');
               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Submit Response:', JSON.stringify(response, null, 2));

               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               await this.updateXrpBalance(client, wallet);
          } catch (error: any) {
               console.error('Error:', error);
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

          const inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               destination: this.destinationFields,
               amount: this.amountField,
               checkId: this.checkIdField,
          };
          const errors = await this.validateInputs(inputs, 'cash');
          if (errors.length > 0) {
               return this.setError(`ERROR: ${errors.join('; ')}`);
          }

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.isMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               if (this.currencyFieldDropDownValue !== AppConstants.XRP_CURRENCY) {
                    const check_objects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'check');
                    console.debug(`Check objects: ${JSON.stringify(check_objects, null, '\t')}`);
                    const issuer = this.getIssuerForCheck(check_objects.result.account_objects, this.checkIdField);
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
                                currency: this.currencyFieldDropDownValue,
                                issuer: this.selectedIssuer,
                           };

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               let tx: CheckCash = await client.autofill({
                    TransactionType: 'CheckCash',
                    Account: wallet.classicAddress,
                    Amount: amountToCash,
                    CheckID: this.checkIdField,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               });

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(tx, this.ticketSequence, true);
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    this.utilsService.setTicketSequence(tx, getAccountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(tx, this.memoField);
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
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: tx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         tx.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(tx, null, 2));
                         console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }
                         console.log('signed:', JSON.stringify(signedTx, null, '\t'));

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         tx.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));

                         if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, multiSignFee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    const preparedTx = await client.autofill(tx);
                    console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                    signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, fee)) {
                         return this.setError('ERROR: Insufficient XRP to complete transaction');
                    }
               }

               console.debug(`Parse Tx Flags: ${JSON.stringify(xrpl.parseTransactionFlags(tx), null, '\t')}`);

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }
               console.log('signed:', JSON.stringify(signedTx, null, '\t'));

               this.updateSpinnerMessage('Submitting transaction to the Ledger ...');
               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Submit Response:', JSON.stringify(response, null, 2));

               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               await this.updateXrpBalance(client, wallet);
          } catch (error: any) {
               console.error('Error:', error);
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

          const inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               checkId: this.checkIdField,
          };
          const errors = await this.validateInputs(inputs, 'cancel');
          if (errors.length > 0) {
               return this.setError(`ERROR: ${errors.join('; ')}`);
          }

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.isMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               let tx: CheckCancel = await client.autofill({
                    TransactionType: 'CheckCancel',
                    Account: wallet.classicAddress,
                    CheckID: this.checkIdField,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               });

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(tx, this.ticketSequence, true);
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    this.utilsService.setTicketSequence(tx, getAccountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(tx, this.memoField);
               }

               // if (this.currencyFieldDropDownValue === AppConstants.XRP_CURRENCY) {
               //      if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, tx, fee)) {
               //           return this.setError('ERROR: Insufficent XRP to complete transaction');
               //      }
               // } else {
               //      if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, fee)) {
               //           return this.setError('ERROR: Insufficent XRP to complete transaction');
               //      }
               // }

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
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: tx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         tx.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(tx, null, 2));
                         console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }
                         console.log('signed:', JSON.stringify(signedTx, null, '\t'));

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         tx.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));

                         if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, multiSignFee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    const preparedTx = await client.autofill(tx);
                    console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                    signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, fee)) {
                         return this.setError('ERROR: Insufficient XRP to complete transaction');
                    }
               }

               console.debug(`Parse Tx Flags: ${JSON.stringify(xrpl.parseTransactionFlags(tx), null, '\t')}`);

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }
               console.log('signed:', JSON.stringify(signedTx, null, '\t'));

               this.updateSpinnerMessage('Submitting transaction to the Ledger ...');
               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Submit Response:', JSON.stringify(response, null, 2));

               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               await this.updateXrpBalance(client, wallet);
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving cancelCheck in ${this.executionTime}ms`);
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
          } else {
               this.isRegularKeyAddress = false;
               this.regularKeyAddress = 'No RegularKey configured for account';
               this.regularKeySeed = '';
          }
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

          const isNotSelfPayment = (sender: string | undefined, receiver: string | undefined): string | null => {
               if (sender && receiver && sender === receiver) {
                    return `Sender and receiver cannot be the same`;
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

          // Action-specific config: required fields and custom rules
          const actionConfig: Record<
               string,
               {
                    required: (keyof ValidationInputs)[];
                    customValidators?: (() => string | null)[];
                    asyncValidators?: (() => Promise<string | null>)[];
               }
          > = {
               get: {
                    required: ['selectedAccount', 'seed'],
                    customValidators: [() => isValidSeed(inputs.seed)],
                    asyncValidators: [],
               },
               send: {
                    required: ['selectedAccount', 'seed', 'destination', 'amount'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidXrpAddress(inputs.destination, 'Destination'),
                         () => isValidNumber(inputs.amount, 'Amount', 0),
                         () => isValidNumber(inputs.destinationTag, 'Destination Tag', 0, true), // Allow empty
                         () => isNotSelfPayment(inputs.senderAddress, inputs.destination),
                    ],
                    asyncValidators: [checkDestinationTagRequirement],
               },
               cash: {
                    required: ['selectedAccount', 'seed', 'destination', 'amount', 'checkId'],
                    customValidators: [() => isValidSeed(inputs.seed), () => isValidXrpAddress(inputs.destination, 'Destination'), () => isValidNumber(inputs.amount, 'Amount', 0), () => isRequired(inputs.checkId, 'Check ID'), () => isNotSelfPayment(inputs.senderAddress, inputs.destination)],
                    asyncValidators: [checkDestinationTagRequirement],
               },
               cancel: {
                    required: ['selectedAccount', 'seed', 'checkId'],
                    customValidators: [() => isValidSeed(inputs.seed), () => isRequired(inputs.checkId, 'Check ID')],
                    asyncValidators: [],
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

          // Selected account check (common to most)
          if (inputs.selectedAccount === undefined || inputs.selectedAccount === null) {
               errors.push('Please select an account');
          }

          return errors;
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
                    await this.getChecks();
               } else if (address) {
                    this.setError('Invalid XRP address');
               }
          } catch (error: any) {
               this.setError(`Error fetching account details: ${error.message}`);
          }
     }

     async displayDataForAccount1() {
          this.displayDataForAccount('account1');
     }

     async displayDataForAccount2() {
          this.displayDataForAccount('account2');
     }

     private displayDataForAccount3() {
          this.displayDataForAccount('issuer');
     }

     clearFields(clearAllFields: boolean) {
          this.amountField = '';
          this.expirationTimeField = '';
          this.memoField = '';
          this.checkIdField = '';
          this.ticketSequence = '';
          this.isTicket = false;
          this.cdr.detectChanges();
     }

     private updateSpinnerMessage(message: string) {
          this.spinnerMessage = message;
          this.cdr.detectChanges();
          console.log('Spinner message updated:', message); // For debugging
     }

     private async showSpinnerWithDelay(message: string, delayMs: number = 200) {
          this.spinner = true;
          this.updateSpinnerMessage(message);
          await new Promise(resolve => setTimeout(resolve, delayMs)); // Minimum display time for initial spinner
     }

     private updateCurrencies() {
          this.currencies = [...Object.keys(this.knownTrustLinesIssuers)];
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
     }
}
