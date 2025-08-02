import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { WalletInputComponent } from '../wallet-input/wallet-input.component';
import { StorageService } from '../../services/storage.service';
import * as xrpl from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';
import { Observable, BehaviorSubject } from 'rxjs';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';

@Component({
     selector: 'app-account',
     standalone: true,
     imports: [CommonModule, FormsModule, WalletInputComponent, NavbarComponent, SanitizeHtmlPipe, MatTableModule, MatSortModule, MatPaginatorModule, MatButtonModule],
     templateUrl: './send-xrp.component.html',
     styleUrl: './send-xrp.component.css',
     encapsulation: ViewEncapsulation.None,
})
export class SendXrpComponent implements AfterViewChecked {
     dataSource = new MatTableDataSource<any>();
     displayedColumns: string[] = ['transactionType', 'createdDate', 'creationAge', 'action', 'amountXrp', 'amountToken', 'currency', 'issuer', 'timestamp', 'transactionHash'];
     @ViewChild(MatPaginator) paginator!: MatPaginator;
     @ViewChild(MatSort) sort!: MatSort;
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     @ViewChild('accountForm') accountForm!: NgForm;
     selectedAccount: 'account1' | 'account2' | null = null;
     private lastResult: string = '';
     transactionInput = '';
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = false;
     account1 = { name: '', address: '', seed: '', secretNumbers: '', mnemonic: '', balance: '' };
     account2 = { name: '', address: '', seed: '', secretNumbers: '', mnemonic: '', balance: '' };
     ownerCount = '';
     totalXrpReserves = '';
     executionTime = '';
     amountField = '';
     destinationField = '';
     destinationTagField = '';
     invoiceIdField: string = '';
     ticketSequence: string = '';
     memoField = '';
     isMultiSignTransaction = false;
     isTicketEnabled = false;
     multiSignAddress = '';
     multiSignSeeds = '';
     signerQuorum = '';
     spinner = false;
     isMultiSign = false;
     isTicket = false;
     spinnerMessage: string = '';
     tokens$: Observable<{ transactionType: string; action: string; amountXrp: string; amountToken: string; currency: string; issuer: string; transactionHash: string; timestamp: Date; createdDate: Date; creationAge: string }[]>;
     private memeTokensSubject = new BehaviorSubject<{ transactionType: string; action: string; amountXrp: string; amountToken: string; currency: string; issuer: string; transactionHash: string; timestamp: Date; createdDate: Date; creationAge: string }[]>([]);
     memeTokens$ = this.memeTokensSubject.asObservable(); // Use Observable for UI binding
     private readonly maxTokens = 20; // Limit to 20 tokens

     constructor(private xrplService: XrplService, private utilsService: UtilsService, private cdr: ChangeDetectorRef, private storageService: StorageService) {
          this.tokens$ = this.xrplService.tokens$; // Initialize tokens observable
     }

     ngOnInit() {
          this.startTokenMonitoring(); // Start monitoring when component initializes
          this.memeTokens$.subscribe(tokens => {
               this.dataSource.data = tokens;
          });
     }

     ngAfterViewInit() {
          this.dataSource.paginator = this.paginator;
          this.dataSource.sort = this.sort;
          this.cdr.detectChanges();
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

     toggleMultiSign() {
          this.cdr.detectChanges();
     }

     toggleTicketSequence() {
          this.cdr.detectChanges();
     }

     validateQuorum() {
          this.cdr.detectChanges();
     }

     onAccountChange() {
          if (!this.selectedAccount) return;
          if (this.selectedAccount === 'account1') {
               this.displayDataForAccount1();
          } else if (this.selectedAccount === 'account2') {
               this.displayDataForAccount2();
          }
     }

     private isMemeCoin(token: { currency: string; issuer: string }): boolean {
          // Dynamic heuristic: Exclude known fiat/stablecoin currencies
          let isNonStandard;
          const nonMemeCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'BTC', 'ETH', 'XRP', 'CNY', 'USDT', 'USDC', 'DAI'];
          if (token.currency.length > 3) {
               isNonStandard = !nonMemeCurrencies.includes(this.utilsService.decodeCurrencyCode(token.currency));
          } else {
               isNonStandard = !nonMemeCurrencies.includes(token.currency.toUpperCase());
          }
          return isNonStandard;
     }

     private async startTokenMonitoring() {
          try {
               await this.xrplService.monitorNewTokens();
               this.tokens$.subscribe(tokens => {
                    const currentMemeTokens = this.memeTokensSubject.getValue();
                    // console.log('Current Meme Tokens:', currentMemeTokens);
                    const newMemeTokens = tokens
                         .filter(token => this.isMemeCoin(token) && !currentMemeTokens.some(t => t.currency === token.currency && t.issuer === token.issuer))
                         .map(token => {
                              if (token.currency.length > 10) {
                                   const curr = this.utilsService.decodeCurrencyCode(token.currency.toUpperCase());
                                   // console.log(`Meme coin detected: ${curr} - Transaction Hash: ${token.transactionHash}`);
                                   return { ...token, currency: curr }; // Decode currency code
                              } else {
                                   // console.log(`Meme coin detected: ${token.currency} - Transaction Hash: ${token.transactionHash}`);
                                   return token;
                              }
                         });

                    if (newMemeTokens.length > 0) {
                         // Keep only the most recent maxTokens (sorted by timestamp, newest first)
                         const updatedTokens = [...currentMemeTokens, ...newMemeTokens].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, this.maxTokens);
                         this.memeTokensSubject.next(updatedTokens);
                    }
               });
          } catch (error) {
               console.error('Error starting token monitoring:', error);
               this.setError('Failed to start token monitoring');
          }
     }

     clearMemeTokens() {
          // this.memeTokensSubject.next([]);
          this.dataSource.data = [];
     }

     async getAccountDetails(address: string) {
          console.log('Entering getAccountDetails');
          const startTime = Date.now();
          try {
               const client = await this.xrplService.getClient();

               this.showSpinnerWithDelay('Getting Account Details ...', 250);

               const accountInfo = await this.xrplService.getAccountInfo(client, address, 'validated', '');
               const accountObjects = await this.xrplService.getAccountObjects(client, address, 'validated', '');

               if (accountInfo.result.account_data.length <= 0) {
                    this.resultField.nativeElement.innerHTML = `No account data found for ${address}`;
                    return;
               }

               console.debug(`accountObjects ${JSON.stringify(accountObjects, null, 2)} accountInfo ${JSON.stringify(accountInfo, null, 2)}`);

               const signerAccounts: string[] = this.checkForSignerAccounts(accountObjects);
               if (signerAccounts && signerAccounts.length > 0) {
                    if (Array.isArray(signerAccounts) && signerAccounts.length > 0) {
                         this.multiSignAddress = signerAccounts.map(account => account.split('~')[0] + ',\n').join('');
                         // this.signer1Account = signerAccounts[0]?.split('~')[0] || '';
                         // this.signer1Weight = signerAccounts[0]?.split('~')[1] || '';
                         // this.signer2Account = signerAccounts[1]?.split('~')[0] || '';
                         // this.signer2Weight = signerAccounts[1]?.split('~')[1] || '';
                         // this.signer3Account = signerAccounts[2]?.split('~')[0] || '';
                         // this.signer3Weight = signerAccounts[2]?.split('~')[1] || '';
                         this.isMultiSign = true;
                    }
               } else {
                    this.multiSignAddress = '';
                    this.isMultiSign = false;
               }

               this.utilsService.renderAccountDetails(accountInfo, accountObjects);
               await this.updateXrpBalance(client, address);
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(error.message);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getAccountDetails in ${this.executionTime}ms`);
          }
     }

     async sendXrp() {
          console.log('Entering sendXrp');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed,
               amount: this.amountField,
               destination: this.destinationField,
               multiSignAddresses: this.isMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.isMultiSign ? this.multiSignSeeds : undefined,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
               const wallet = await this.utilsService.getWallet(seed, environment);

               if (!wallet) {
                    return this.setError('ERROR: Wallet could not be created or is undefined');
               }

               this.showSpinnerWithDelay('Sending XRP ...', 250);

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               let payment: xrpl.Payment = {
                    TransactionType: 'Payment',
                    Account: wallet.classicAddress,
                    Amount: xrpl.xrpToDrops(this.amountField),
                    Destination: this.destinationField,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    payment.TicketSequence = Number(this.ticketSequence);
                    payment.Sequence = 0;
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    payment.Sequence = getAccountInfo.result.account_data.Sequence;
               }

               if (this.destinationTagField && parseInt(this.destinationTagField) > 0) {
                    payment.DestinationTag = parseInt(this.destinationTagField, 10);
               }

               if (this.memoField) {
                    payment.Memos = [
                         {
                              Memo: {
                                   MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                                   MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                              },
                         },
                    ];
               }

               if (this.invoiceIdField) {
                    const validInvoiceID = await this.getValidInvoiceID(this.invoiceIdField);
                    if (validInvoiceID) {
                         payment.InvoiceID = validInvoiceID;
                    }
               }

               let signedTx: { tx_blob: string; hash: string } | null = null;

               if (this.isMultiSign) {
                    // const signerAddresses = this.multiSignAddress.split(',').map(s => s.trim());
                    const signerAddresses = this.multiSignAddress
                         .split(',')
                         .map(s => s.trim())
                         .filter(s => s); // removes empty strings

                    if (signerAddresses.length === 0) {
                         return this.setError('ERROR: No signers provided for multi-signing');
                    }

                    const signerSeeds = this.multiSignSeeds.split(',').map(s => s.trim());

                    try {
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: payment, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         payment.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(payment, null, 2));
                         console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    const preparedTx = await client.autofill(payment);
                    signedTx = wallet.sign(preparedTx);
               }

               this.updateSpinnerMessage('Submitting transaction to the Ledger ...');

               if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, payment, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Submit Response:', JSON.stringify(response, null, 2));

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

               await this.updateXrpBalance(client, wallet.classicAddress);
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving sendXrp in ${this.executionTime}ms`);
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
                                   this.signerQuorum = obj.SignerQuorum.toString();
                              }
                         });
                    }
               });
          }
          return signerAccounts;
     }

     private async showSpinnerWithDelay(message: string, delayMs: number = 200) {
          this.spinner = true;
          this.updateSpinnerMessage(message);
          await new Promise(resolve => setTimeout(resolve, delayMs)); // Minimum display time for initial spinner
     }

     private updateSpinnerMessage(message: string) {
          this.spinnerMessage = message;
          this.cdr.detectChanges();
          console.log('Spinner message updated:', message); // For debugging
     }

     private async getValidInvoiceID(input: string): Promise<string | null> {
          if (!input) {
               return null;
          }
          if (/^[0-9A-Fa-f]{64}$/.test(input)) {
               return input.toUpperCase();
          }
          try {
               const encoder = new TextEncoder();
               const data = encoder.encode(input);
               const hashBuffer = await crypto.subtle.digest('SHA-256', data);
               const hashArray = Array.from(new Uint8Array(hashBuffer));
               const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
               return hashHex.toUpperCase();
          } catch (error) {
               throw new Error('Failed to hash InvoiceID');
          }
     }

     clearFields() {
          this.amountField = '';
          this.memoField = '';
          this.invoiceIdField = '';
          this.ticketSequence = '';
          this.isTicket = false;
          this.isMultiSign = false;
          this.multiSignAddress = '';
          this.cdr.detectChanges();
     }

     private async updateXrpBalance(client: xrpl.Client, address: string) {
          const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, address);
          this.ownerCount = ownerCount;
          this.totalXrpReserves = totalXrpReserves;
          const balance = (await client.getXrpBalance(address)) - parseFloat(this.totalXrpReserves || '0');
          this.account1.balance = balance.toString();
     }

     private validateInputs(inputs: { seed?: string; amount?: string; destination?: string; sequence?: string; selectedAccount?: 'account1' | 'account2' | null; multiSignAddresses?: string; multiSignSeeds?: string }): string | null {
          if (inputs.selectedAccount !== undefined && !inputs.selectedAccount) {
               return 'Please select an account';
          }
          if (inputs.seed != undefined) {
               if (!this.utilsService.validateInput(inputs.seed)) {
                    return 'Account seed cannot be empty';
               }
               if (!xrpl.isValidSecret(inputs.seed)) {
                    return 'Account seed is invalid';
               }
          } else {
               return 'Account seed is invalid';
          }
          if (inputs.amount != undefined) {
               if (!this.utilsService.validateInput(inputs.amount)) {
                    return 'XRP Amount cannot be empty';
               }
               if (isNaN(parseFloat(inputs.amount ?? '')) || !isFinite(parseFloat(inputs.amount ?? ''))) {
                    return 'XRP Amount must be a valid number';
               }
               if (inputs.amount && parseFloat(inputs.amount) <= 0) {
                    return 'XRP Amount must be a positive number';
               }
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

     private displayDataForAccount(accountKey: 'account1' | 'account2') {
          const prefix = accountKey === 'account1' ? 'account1' : 'account2';
          const otherPrefix = accountKey === 'account1' ? 'account2' : 'account1';

          // Fetch stored values
          const name = this.storageService.getInputValue(`${prefix}name`) || '';
          const address = this.storageService.getInputValue(`${prefix}address`) || '';
          const seed = this.storageService.getInputValue(`${prefix}seed`) || '';
          const mnemonic = this.storageService.getInputValue(`${prefix}mnemonic`) || '';
          const secretNumbers = this.storageService.getInputValue(`${prefix}secretNumbers`) || '';
          const otherAddress = this.storageService.getInputValue(`${otherPrefix}address`) || '';

          const accountName1Field = document.getElementById('accountName1Field') as HTMLInputElement | null;
          const accountAddress1Field = document.getElementById('accountAddress1Field') as HTMLInputElement | null;
          const accountSeed1Field = document.getElementById('accountSeed1Field') as HTMLInputElement | null;

          // Update account data
          const account = accountKey === 'account1' ? this.account1 : this.account2;
          account.name = name;
          if (accountName1Field) {
               accountName1Field.value = account.name;
          }
          account.address = address;
          if (accountAddress1Field) {
               accountAddress1Field.value = account.address;
          }
          account.seed = seed || mnemonic || secretNumbers;
          if (accountSeed1Field) {
               accountSeed1Field.value = account.seed;
          }
          this.destinationField = otherAddress;

          this.cdr.detectChanges();

          if (account.address && xrpl.isValidAddress(account.address)) {
               this.getAccountDetails(account.address);
          } else if (account.address) {
               this.setError('Invalid XRP address');
          }
     }

     private displayDataForAccount1() {
          this.displayDataForAccount('account1');
     }

     private displayDataForAccount2() {
          this.displayDataForAccount('account2');
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
