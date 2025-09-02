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
     // destinationField: string = '';
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
     // Add a map of known issuers for tokens
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
               this.loadSignerList(wallet.classicAddress);

               if (Object.keys(this.knownDestinations).length === 0) {
                    this.knownDestinations = {
                         Account1: this.account1.address,
                         Account2: this.account2.address,
                         Account3: this.issuer.address,
                    };
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
               this.loadSignerList(wallet.classicAddress);

               this.isMemoEnabled = false;
               this.memoField = '';

               await this.toggleIssuerField();
               await this.updateXrpBalance(client, wallet.classicAddress);
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

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               destination: this.destinationFields,
               amount: this.amountField,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
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

               let regularKeyWalletSignTx: any = '';
               let useRegularKeyWalletSignTx = false;
               if (this.isRegularKeyAddress && !this.isMultiSign) {
                    console.log('Using Regular Key Seed for transaction signing');
                    regularKeyWalletSignTx = await this.utilsService.getWallet(this.regularKeySeed, environment);
                    useRegularKeyWalletSignTx = true;
               }

               const wallet = await this.getWallet();

               if (this.currencyFieldDropDownValue === AppConstants.XRP_CURRENCY) {
                    if (parseFloat(this.amountField) > (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0')) {
                         return this.setError('ERROR: Insufficent XRP to send check');
                    }
               }

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
                    tx.TicketSequence = Number(this.ticketSequence);
                    tx.Sequence = 0;
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    tx.Sequence = getAccountInfo.result.account_data.Sequence;
               }

               if (this.memoField && this.memoField != '') {
                    tx.Memos = [
                         {
                              Memo: {
                                   MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                                   MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                              },
                         },
                    ];
               }

               if (checkExpiration && checkExpiration != '') {
                    tx.Expiration = Number(checkExpiration);
               }

               const destinationTagText = this.destinationTagField;
               if (destinationTagText) {
                    if (parseInt(destinationTagText) <= 0) {
                         return this.setError('ERROR: Destination Tag must be a valid number and greater than zero');
                    }
                    tx.DestinationTag = parseInt(destinationTagText, 10);
               }

               if (this.currencyFieldDropDownValue === AppConstants.XRP_CURRENCY) {
                    if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, tx, fee)) {
                         return this.setError('ERROR: Insufficent XRP to complete transaction');
                    }
               } else {
                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, fee)) {
                         return this.setError('ERROR: Insufficent XRP to complete transaction');
                    }
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
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: tx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         tx.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(tx, null, 2));
                         console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         tx.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    const preparedTx = await client.autofill(tx);
                    console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                    if (useRegularKeyWalletSignTx) {
                         signedTx = regularKeyWalletSignTx.sign(preparedTx);
                    } else {
                         signedTx = wallet.sign(preparedTx);
                    }
               }

               console.debug(`Parse Tx Flags: ${JSON.stringify(xrpl.parseTransactionFlags(tx), null, '\t')}`);
               this.updateSpinnerMessage('Submitting transaction to the Ledger ...');

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }

               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Submit Response:', JSON.stringify(response, null, 2));

               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               await this.updateXrpBalance(client, wallet.classicAddress);
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

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               destination: this.destinationFields,
               amount: this.amountField,
               checkId: this.checkIdField,
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
                    tx.TicketSequence = Number(this.ticketSequence);
                    tx.Sequence = 0;
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    tx.Sequence = getAccountInfo.result.account_data.Sequence;
               }

               if (this.currencyFieldDropDownValue === AppConstants.XRP_CURRENCY) {
                    if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, tx, fee)) {
                         return this.setError('ERROR: Insufficent XRP to complete transaction');
                    }
               } else {
                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, fee)) {
                         return this.setError('ERROR: Insufficent XRP to complete transaction');
                    }
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
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: tx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         tx.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(tx, null, 2));
                         console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         tx.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    const preparedTx = await client.autofill(tx);
                    console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                    if (useRegularKeyWalletSignTx) {
                         signedTx = regularKeyWalletSignTx.sign(preparedTx);
                    } else {
                         signedTx = wallet.sign(preparedTx);
                    }
                    console.debug(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
               }

               console.debug(`Parse Tx Flags: ${JSON.stringify(xrpl.parseTransactionFlags(tx), null, '\t')}`);
               this.updateSpinnerMessage('Submitting transaction to the Ledger ...');

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }

               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Submit Response:', JSON.stringify(response, null, 2));

               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               await this.updateXrpBalance(client, wallet.classicAddress);
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

          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }

          const seed = this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer);
          if (!this.utilsService.validateInput(seed)) {
               return this.setError('ERROR: Account seed cannot be empty');
          }

          if (!this.utilsService.validateInput(this.checkIdField)) {
               return this.setError('ERROR: Check ID cannot be empty');
          }

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               checkId: this.checkIdField,
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
                    tx.TicketSequence = Number(this.ticketSequence);
                    tx.Sequence = 0;
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    tx.Sequence = getAccountInfo.result.account_data.Sequence;
               }

               if (this.currencyFieldDropDownValue === AppConstants.XRP_CURRENCY) {
                    if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, tx, fee)) {
                         return this.setError('ERROR: Insufficent XRP to complete transaction');
                    }
               } else {
                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, fee)) {
                         return this.setError('ERROR: Insufficent XRP to complete transaction');
                    }
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
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: tx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         tx.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(tx, null, 2));
                         console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         tx.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    const preparedTx = await client.autofill(tx);
                    console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                    if (useRegularKeyWalletSignTx) {
                         signedTx = regularKeyWalletSignTx.sign(preparedTx);
                    } else {
                         signedTx = wallet.sign(preparedTx);
                    }
               }

               console.debug(`Parse Tx Flags: ${JSON.stringify(xrpl.parseTransactionFlags(tx), null, '\t')}`);
               this.updateSpinnerMessage('Submitting transaction to the Ledger ...');

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }

               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Submit Response:', JSON.stringify(response, null, 2));

               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               await this.updateXrpBalance(client, wallet.classicAddress);
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving cancelCheck in ${this.executionTime}ms`);
          }
     }

     updateSpinnerMessage(message: string) {
          this.spinnerMessage = message;
          this.cdr.detectChanges();
          console.log('Spinner message updated:', message); // For debugging
     }

     async showSpinnerWithDelay(message: string, delayMs: number = 200) {
          this.spinner = true;
          this.updateSpinnerMessage(message);
          await new Promise(resolve => setTimeout(resolve, delayMs)); // Minimum display time for initial spinner
     }

     private updateCurrencies() {
          this.currencies = [...Object.keys(this.knownTrustLinesIssuers)];
     }

     private updateDestinations() {
          this.destinations = [...Object.values(this.knownDestinations)];
          this.storageService.setKnownIssuers('destinations', this.knownDestinations);
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

     private async updateXrpBalance(client: xrpl.Client, address: string) {
          const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, address);
          this.ownerCount = ownerCount;
          this.totalXrpReserves = totalXrpReserves;
          const balance = (await client.getXrpBalance(address)) - parseFloat(this.totalXrpReserves || '0');
          this.account1.balance = balance.toString();
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

     getIssuerForCheck(checks: any[], checkIndex: string): string | null {
          const check = checks.find(c => c.index === checkIndex);
          return check?.SendMax?.issuer || null;
     }

     private validateInputs(inputs: { seed?: string; amount?: string; destination?: string; checkId?: string; selectedAccount?: 'account1' | 'account2' | 'issuer' | null }): string | null {
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
          if (inputs.checkId != undefined) {
               if (!this.utilsService.validateInput(inputs.checkId)) {
                    return 'Check ID cannot be empty';
               }
          }
          return null;
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
          // this.signerQuorum = 0;
     }

     clearFields() {
          this.amountField = '';
          this.expirationTimeField = '';
          this.memoField = '';
          this.checkIdField = '';
          this.ticketSequence = '';
          this.isTicket = false;
          this.cdr.detectChanges();
     }

     private displayDataForAccount(accountKey: 'account1' | 'account2' | 'issuer') {
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

          if (account.address && xrpl.isValidAddress(account.address)) {
               this.getChecks();
          } else if (account.address) {
               this.setError('Invalid XRP address');
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
