import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { StorageService } from '../../services/storage.service';
import * as xrpl from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';
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

@Component({
     selector: 'app-account',
     standalone: true,
     imports: [CommonModule, FormsModule, WalletMultiInputComponent, NavbarComponent, SanitizeHtmlPipe, MatAutocompleteModule, MatTableModule, MatSortModule, MatPaginatorModule, MatInputModule, MatFormFieldModule],
     templateUrl: './send-xrp.component.html',
     styleUrl: './send-xrp.component.css',
     encapsulation: ViewEncapsulation.None,
})
export class SendXrpComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     @ViewChild('accountForm') accountForm!: NgForm;
     selectedAccount: 'account1' | 'account2' | 'issuer' | null = 'account1';
     private lastResult: string = '';
     transactionInput: string = '';
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = false;
     account1 = { name: '', address: '', seed: '', secretNumbers: '', mnemonic: '', balance: '' };
     account2 = { name: '', address: '', seed: '', secretNumbers: '', mnemonic: '', balance: '' };
     issuer = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '0' };
     ownerCount: string = '';
     totalXrpReserves: string = '';
     executionTime: string = '';
     amountField: string = '';
     destinationTagField: string = '';
     sourceTagField: string = '';
     invoiceIdField: string = '';
     ticketSequence: string = '';
     memoField: string = '';
     isMemoEnabled: boolean = false;
     isInvoiceIdEnabled: boolean = false;
     isMultiSignTransaction: boolean = false;
     isTicketEnabled: boolean = false;
     multiSignAddress: string = '';
     multiSignSeeds: string = '';
     signerQuorum: number = 0;
     spinner: boolean = false;
     isMultiSign: boolean = false;
     isRegularKeyAddress: boolean = false;
     regularKeySeed: string = '';
     regularKeyAddress: string = '';
     isTicket: boolean = false;
     spinnerMessage: string = '';
     destinationFields: string = '';
     private knownDestinations: { [key: string]: string } = {};
     destinations: string[] = [];
     signers: { account: string; seed: string; weight: number }[] = [{ account: '', seed: '', weight: 1 }];

     constructor(private xrplService: XrplService, private utilsService: UtilsService, private cdr: ChangeDetectorRef, private storageService: StorageService) {}

     ngOnInit() {
          const storedDestinations = this.storageService.getKnownIssuers('destinations');
          if (storedDestinations) {
               this.knownDestinations = storedDestinations;
          }
     }

     async ngAfterViewInit() {
          try {
               const wallet = await this.getWallet();
               this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
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

     async getAccountDetails() {
          console.log('Entering getAccountDetails');
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

               this.showSpinnerWithDelay('Getting Account Details ...', 100);

               const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
               if (accountInfo.result.account_data.length <= 0) {
                    this.resultField.nativeElement.innerHTML = `No account data found for ${wallet.classicAddress}`;
                    return;
               }
               console.debug(`accountInfo for ${wallet.classicAddress} ${JSON.stringify(accountInfo.result, null, '\t')}`);

               const accountObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '');
               console.debug(`accountObjects for ${wallet.classicAddress} ${JSON.stringify(accountObjects.result, null, '\t')}`);

               this.utilsService.renderAccountDetails(accountInfo, accountObjects);
               this.setSuccess(this.result);
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), wallet);
               this.refreshUiAccountInfo(accountInfo);
               this.utilsService.loadSignerList(wallet.classicAddress, this.signers);

               this.isMemoEnabled = false;
               this.memoField = '';

               await this.updateXrpBalance(client, wallet);
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
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               amount: this.amountField,
               destination: this.destinationFields,
               destinationTag: this.destinationTagField,
               invoiceId: this.invoiceIdField,
               regularKeyAddress: this.regularKeyAddress ? this.regularKeyAddress : undefined,
               regularKeySeed: this.regularKeySeed ? this.regularKeySeed : undefined,
               multiSignAddresses: this.isMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.isMultiSign ? this.multiSignSeeds : undefined,
               sourceTag: this.sourceTagField ? this.sourceTagField : undefined,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.isMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               this.updateSpinnerMessage('Sending XRP ...');

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               let payment: xrpl.Payment = {
                    TransactionType: 'Payment',
                    Account: wallet.classicAddress,
                    Amount: xrpl.xrpToDrops(this.amountField),
                    Destination: this.destinationFields,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(payment, this.ticketSequence, true);
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    this.utilsService.setTicketSequence(payment, getAccountInfo.result.account_data.Sequence, false);
               }

               if (this.destinationTagField && parseInt(this.destinationTagField) > 0) {
                    this.utilsService.setDestinationTag(payment, this.destinationTagField);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(payment, this.memoField);
               }

               if (this.invoiceIdField) {
                    await this.utilsService.setInvoiceIdField(payment, this.invoiceIdField);
               }

               if (this.sourceTagField) {
                    this.utilsService.setSourceTagField(payment, this.sourceTagField);
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
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: payment, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         payment.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(payment, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         payment.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));

                         if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, payment, multiSignFee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    const preparedTx = await client.autofill(payment);
                    console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                    signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                    if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, payment, fee)) {
                         return this.setError('ERROR: Insufficient XRP to complete transaction');
                    }
               }

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }
               console.log(`signedTx: ${JSON.stringify(signedTx, null, '\t')}`);

               this.updateSpinnerMessage('Submitting transaction to the Ledger ...');
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

               this.isMemoEnabled = false;
               this.memoField = '';

               await this.updateXrpBalance(client, wallet);
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

     private validateInputs(inputs: { seed?: string; amount?: string; destination?: string; sequence?: string; selectedAccount?: 'account1' | 'account2' | 'issuer' | null; multiSignAddresses?: string; multiSignSeeds?: string; regularKeyAddress?: string; regularKeySeed?: string; sourceTag?: string; destinationTag?: string; invoiceId?: string }): string | null {
          const { seed, amount, destination, selectedAccount, regularKeyAddress, regularKeySeed, multiSignAddresses, multiSignSeeds, sourceTag, destinationTag, invoiceId } = inputs;

          // 1. Account selection
          if (selectedAccount === null || selectedAccount === undefined) {
               return 'Please select an account';
          }

          // 2. Seed
          let accountSeedType = '';
          if (seed) {
               const { type, value } = this.utilsService.detectXrpInputType(seed);
               accountSeedType = type;
               if (value === 'unknown') {
                    return 'Account seed is invalid';
               }
          }

          // 3. Amount
          if (amount !== null && amount !== undefined) {
               if (amount === '' || !this.utilsService.validateInput(amount)) {
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

          // 4. Source Tag
          if (sourceTag !== null && sourceTag !== undefined && sourceTag !== '') {
               const numTag = parseFloat(sourceTag);
               if (isNaN(numTag) || !isFinite(numTag)) {
                    return 'Source Tag must be a valid number';
               }
               if (numTag <= 0) {
                    return 'Source Tag must be a positive number';
               }
          }

          // 5. Destination
          if (destination !== null && destination !== undefined && destination !== '' && !this.utilsService.validateInput(destination)) {
               return 'Destination cannot be empty';
          }

          // 6. Destination Tag
          if (destinationTag !== null && destinationTag !== undefined && destinationTag !== '') {
               const numTag = parseFloat(destinationTag);
               if (isNaN(numTag) || !isFinite(numTag)) {
                    return 'Destination Tag must be a valid number';
               }
               if (numTag <= 0) {
                    return 'Destination Tag must be a positive number';
               }
          }

          // 7. Destination
          if (invoiceId !== null && invoiceId !== undefined && invoiceId !== '' && !this.utilsService.validateInput(invoiceId)) {
               return 'InvoiceId is invalid';
          }

          // 8. Regular key
          if (regularKeyAddress && regularKeyAddress !== 'No RegularKey configured for account') {
               if (!xrpl.isValidAddress(regularKeyAddress)) {
                    return 'Regular Key Address is invalid or empty';
               }
          }

          if (regularKeySeed && !xrpl.isValidSecret(regularKeySeed)) {
               return 'ERROR: Regular Key Seed is invalid or empty';
          }

          // 9. Multi-sign
          if (multiSignAddresses && multiSignSeeds) {
               const addresses = this.utilsService.getMultiSignAddress(this.multiSignAddress);
               const seeds = this.utilsService.getMultiSignSeeds(this.multiSignSeeds);
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

               if (accountSeedType === 'seed') {
                    if (seeds.some((s: string) => !xrpl.isValidSecret(s))) {
                         return 'One or more signer seeds are invalid';
                    }
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

     private async getWallet() {
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
                    await this.getAccountDetails();
               } else if (address) {
                    this.setError('Invalid XRP address');
               }
          } catch (error: any) {
               this.setError(`Error fetching account details: ${error.message}`);
          }
     }

     private displayDataForAccount1() {
          this.displayDataForAccount('account1');
     }

     private displayDataForAccount2() {
          this.displayDataForAccount('account2');
     }

     private displayDataForAccount3() {
          this.displayDataForAccount('issuer');
     }

     clearFields() {
          this.amountField = '';
          this.memoField = '';
          this.invoiceIdField = '';
          this.ticketSequence = '';
          this.isTicket = false;
          this.isMultiSign = false;
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
