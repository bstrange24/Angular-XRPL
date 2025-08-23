import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { WalletInputComponent } from '../wallet-input/wallet-input.component';
import { StorageService } from '../../services/storage.service';
import { AccountSet, TransactionMetadataBase, TicketCreate } from 'xrpl';
import * as xrpl from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';

// Define the interface for signer entries
interface SignerEntry {
     Account: string;
     SignerWeight: number;
     SingnerSeed: string; // Note: 'SingnerSeed' seems to be a typo in your JSON, should it be 'SignerSeed'?
}

@Component({
     selector: 'app-create-tickets',
     standalone: true,
     imports: [CommonModule, FormsModule, WalletInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './create-tickets.component.html',
     styleUrl: './create-tickets.component.css',
})
export class CreateTicketsComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     @ViewChild('accountForm') accountForm!: NgForm;
     selectedAccount: 'account1' | 'account2' | null = 'account1';
     private lastResult: string = '';
     transactionInput = '';
     result: string = '';
     currencyFieldDropDownValue: string = 'XRP';
     checkExpirationTime: string = 'seconds';
     ticketCountField = '';
     expirationTimeField = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = false;
     account1 = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '0' };
     account2 = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '0' };
     xrpBalance1Field = '';
     checkIdField = '';
     ownerCount = '';
     totalXrpReserves = '';
     executionTime = '';
     amountField = '';
     destinationField = '';
     memoField = '';
     isMemoEnabled = false;
     ticketSequence: string = '';
     isMultiSignTransaction = false;
     multiSignAddress: string = '';
     isMultiSign = false;
     multiSignSeeds = '';
     isRegularKeyAddress = false;
     regularKeySeed = '';
     regularKeyAddress = '';
     signerQuorum = '';
     isTicket = false;
     isTicketEnabled = false;
     spinner = false;
     issuers: string[] = [];
     selectedIssuer: string = '';
     tokenBalance: string = '';
     spinnerMessage: string = '';

     constructor(private xrplService: XrplService, private utilsService: UtilsService, private cdr: ChangeDetectorRef, private storageService: StorageService) {}

     ngAfterViewInit() {
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
          }
     }

     toggleTicketSequence() {
          this.cdr.detectChanges();
     }

     validateQuorum() {
          this.cdr.detectChanges();
     }

     toggleMultiSign() {
          if (this.multiSignAddress === 'No Multi-Sign address configured for account') {
               this.multiSignSeeds = '';
               this.cdr.detectChanges();
               return;
          }

          if (this.isMultiSign && this.storageService.get('signerEntries') != null && this.storageService.get('signerEntries').length > 0) {
               const signers = this.storageService.get('signerEntries');
               const addresses = signers.map((item: { Account: any }) => item.Account + ',\n').join('');
               const seeds = signers.map((item: { SingnerSeed: any }) => item.SingnerSeed + ',\n').join('');
               this.multiSignAddress = addresses;
               this.multiSignSeeds = seeds;
          }
          this.cdr.detectChanges();
     }

     async getTickets() {
          console.log('Entering getTickets');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
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

               const ticket_objects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'ticket');
               console.debug('Ticket Objects: ', ticket_objects);

               const accountObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '');
               const signerAccounts: string[] = this.checkForSignerAccounts(accountObjects);
               if (signerAccounts && signerAccounts.length > 0) {
                    if (Array.isArray(signerAccounts) && signerAccounts.length > 0) {
                         const signerEntries: SignerEntry[] = this.storageService.get('signerEntries') || [];

                         this.multiSignAddress = signerAccounts.map(account => account.split('~')[0] + ',\n').join('');
                         this.multiSignSeeds = signerAccounts
                              .map(account => {
                                   const address = account.split('~')[0];
                                   const entry = signerEntries.find((entry: SignerEntry) => entry.Account === address);
                                   return entry ? entry.SingnerSeed : null;
                              })
                              .filter(seed => seed !== null)
                              .join(',\n');
                         this.isMultiSign = true;
                    }
               } else {
                    this.multiSignAddress = 'No Multi-Sign address configured for account';
                    this.multiSignSeeds = ''; // Clear seeds if no signer accounts
                    this.isMultiSign = false;
               }

               // Prepare data for renderAccountDetails
               const data = {
                    sections: [{}],
               };

               if (ticket_objects.result.account_objects.length <= 0) {
                    data.sections.push({
                         title: 'Tickets',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No tickets found for <code>${wallet.classicAddress}</code>` }],
                    });
               } else {
                    // Sort tickets from oldest to newest.
                    const sortedTickets = ticket_objects.result.account_objects.sort((a, b) => {
                         const seqA = (a as any).TicketSequence ?? Number.MAX_SAFE_INTEGER;
                         const seqB = (b as any).TicketSequence ?? Number.MAX_SAFE_INTEGER;
                         return seqA - seqB;
                    });

                    data.sections.push({
                         title: `Tickets (${ticket_objects.result.account_objects.length})`,
                         openByDefault: true,
                         subItems: sortedTickets.map((ticket, counter) => {
                              const { LedgerEntryType, PreviousTxnID, index } = ticket;
                              // TicketSequence and Flags may not exist on all AccountObject types
                              const ticketSequence = (ticket as any).TicketSequence;
                              const flags = (ticket as any).Flags;
                              return {
                                   key: `Ticket ${counter + 1} (ID: ${index.slice(0, 8)}...)`,
                                   openByDefault: false,
                                   content: [{ key: 'Ticket ID', value: `<code>${index}</code>` }, { key: 'Ledger Entry Type', value: LedgerEntryType }, { key: 'Previous Txn ID', value: `<code>${PreviousTxnID}</code>` }, ...(ticketSequence ? [{ key: 'Ticket Sequence', value: String(ticketSequence) }] : []), ...(flags !== undefined ? [{ key: 'Flags', value: String(flags) }] : [])],
                              };
                         }),
                    });
               }

               this.utilsService.renderPaymentChannelDetails(data);
               this.setSuccess(this.result);

               this.isMemoEnabled = false;
               this.memoField = '';

               const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
               if (accountInfo.result.account_data && accountInfo.result.account_data.RegularKey) {
                    this.isRegularKeyAddress = true;
                    this.regularKeyAddress = accountInfo.result.account_data.RegularKey;
                    this.regularKeySeed = this.storageService.get('regularKeySeed');
               } else {
                    this.isRegularKeyAddress = false;
                    this.regularKeyAddress = '';
                    this.regularKeySeed = '';
               }

               await this.updateXrpBalance(client, wallet.classicAddress);
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getTickets in ${this.executionTime}ms`);
          }
     }

     async createTicket() {
          console.log('Entering createTicket');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed,
               ticketCount: this.ticketCountField,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               let seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;

               if (this.isRegularKeyAddress && !this.isMultiSign) {
                    if (!this.regularKeyAddress || !xrpl.isValidAddress(this.regularKeyAddress)) {
                         return this.setError('ERROR: Regular Key Address is invalid or empty');
                    }
                    if (!this.regularKeySeed || !xrpl.isValidSecret(this.regularKeySeed)) {
                         return this.setError('ERROR: Regular Key Seed is invalid or empty');
                    }
                    if (this.regularKeyAddress && this.regularKeySeed) {
                         // Override seed with Regular Key Seed
                         console.log('Using Regular Key Seed for transaction signing');
                         seed = this.regularKeySeed;
                    }
               }
               const wallet = await this.utilsService.getWallet(seed, environment);

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               const tx: TicketCreate = {
                    TransactionType: 'TicketCreate',
                    Account: wallet.classicAddress,
                    TicketCount: parseInt(this.ticketCountField),
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               if (this.memoField) {
                    tx.Memos = tx.Memos || [];
                    tx.Memos.push({
                         Memo: {
                              MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                              MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                         },
                    });
               }

               if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, fee)) {
                    return this.setError('ERROR: Insufficent XRP to complete transaction');
               }

               let preparedTx = await client.autofill(tx);
               const signed = wallet.sign(preparedTx);

               this.updateSpinnerMessage('Submitting transaction to the Ledger ...');

               const response = await client.submitAndWait(signed.tx_blob);
               console.log('Response', response);

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
               console.log(`Leaving createTicket in ${this.executionTime}ms`);
          }
     }

     async cancelTicket() {
          console.log('Entering cancelTicket');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed,
               ticketSequence: this.ticketSequence,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               let seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;

               if (this.isRegularKeyAddress && !this.isMultiSign) {
                    if (!this.regularKeyAddress || !xrpl.isValidAddress(this.regularKeyAddress)) {
                         return this.setError('ERROR: Regular Key Address is invalid or empty');
                    }
                    if (!this.regularKeySeed || !xrpl.isValidSecret(this.regularKeySeed)) {
                         return this.setError('ERROR: Regular Key Seed is invalid or empty');
                    }
                    if (this.regularKeyAddress && this.regularKeySeed) {
                         // Override seed with Regular Key Seed
                         console.log('Using Regular Key Seed for transaction signing');
                         seed = this.regularKeySeed;
                    }
               }
               const wallet = await this.utilsService.getWallet(seed, environment);

               if (!wallet) {
                    return this.setError('ERROR: Wallet could not be created or is undefined');
               }

               const ticket_objects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'ticket');
               console.debug('Ticket Objects: ', ticket_objects);

               const ticketExists = ticket_objects.result.account_objects.some((ticket: any) => ticket.TicketSequence === Number(this.ticketSequence));

               if (!ticketExists) {
                    return this.setError(`Ticket ${this.ticketSequence} does not exist for account ${wallet.classicAddress}`);
               }

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               const tx: AccountSet = {
                    TransactionType: 'AccountSet',
                    Account: wallet.classicAddress,
                    TicketSequence: Number(this.ticketSequence),
                    Sequence: 0,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               if (this.memoField) {
                    tx.Memos = tx.Memos || [];
                    tx.Memos.push({
                         Memo: {
                              MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                              MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                         },
                    });
               }

               if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, fee)) {
                    return this.setError('ERROR: Insufficent XRP to complete transaction');
               }

               let preparedTx = await client.autofill(tx);
               console.log(`preparedTx: ${JSON.stringify(preparedTx, null, 2)}`);

               const signed = wallet.sign(preparedTx);
               console.log(`signed: ${JSON.stringify(signed, null, 2)}`);

               this.updateSpinnerMessage('Submitting transaction to the Ledger ...');

               const response = await client.submitAndWait(signed.tx_blob);
               console.log('Response', response);

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
               console.log(`Leaving cancelTicket in ${this.executionTime}ms`);
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

     private async updateXrpBalance(client: xrpl.Client, address: string) {
          const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, address);
          this.ownerCount = ownerCount;
          this.totalXrpReserves = totalXrpReserves;
          const balance = (await client.getXrpBalance(address)) - parseFloat(this.totalXrpReserves || '0');
          this.account1.balance = balance.toString();
     }

     private validateInputs(inputs: { seed?: string; amount?: string; destination?: string; ticketCount?: string; ticketSequence?: string; selectedAccount?: 'account1' | 'account2' | 'issuer' | null }): string | null {
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
          if (inputs.ticketCount != undefined) {
               if (isNaN(parseFloat(inputs.ticketCount ?? '')) || !isFinite(parseFloat(inputs.ticketCount ?? ''))) {
                    return 'Ticket count must be a valid number';
               }
               if (parseFloat(inputs.ticketCount) <= 0) {
                    return 'Ticket count must be a positive number';
               }
          }
          if (inputs.ticketSequence != undefined) {
               if (isNaN(parseFloat(inputs.ticketSequence ?? '')) || !isFinite(parseFloat(inputs.ticketSequence ?? ''))) {
                    return 'Ticket sequence must be a valid number';
               }
               if (parseFloat(inputs.ticketSequence) <= 0) {
                    return 'Ticket sequence must be a positive number';
               }
          }
          return null;
     }

     clearFields() {
          this.amountField = '';
          this.expirationTimeField = '';
          this.memoField = '';
          this.ticketCountField = '';
          this.cdr.detectChanges();
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
               this.getTickets();
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
