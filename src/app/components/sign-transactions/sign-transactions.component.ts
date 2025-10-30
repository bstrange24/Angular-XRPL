import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
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
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';
import { AppWalletDynamicInputComponent } from '../app-wallet-dynamic-input/app-wallet-dynamic-input.component';
import { SignTransactionUtilService } from '../../services/sign-transactions-util/sign-transaction-util.service';
import { ClickToCopyService } from '../../services/click-to-copy/click-to-copy.service';
import { AppConstants } from '../../core/app.constants';
import SignerList from 'xrpl/dist/npm/models/ledger/SignerList';

interface ValidationInputs {
     account_info?: any;
     seed?: string;
}

@Component({
     selector: 'app-sign-transactions',
     standalone: true,
     imports: [CommonModule, FormsModule, AppWalletDynamicInputComponent, NavbarComponent, SanitizeHtmlPipe, MatAutocompleteModule, MatTableModule, MatSortModule, MatPaginatorModule, MatInputModule, MatFormFieldModule],
     templateUrl: './sign-transactions.component.html',
     styleUrl: './sign-transactions.component.css',
})
export class SignTransactionsComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     @ViewChild('resultFieldError') resultFieldError!: ElementRef<HTMLDivElement>;
     @ViewChild('hashField') hashField!: ElementRef<HTMLDivElement>;
     @ViewChild('accountForm') accountForm!: NgForm;
     txJson: string = ''; // Dedicated for transaction JSON (untouched on error)
     outputField: string = ''; // Dedicated for hash/blob in "Signed" field (empty on error)
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = false;
     ticketSequence: string = '';
     isTicket: boolean = false;
     isTicketEnabled: boolean = false;
     ticketArray: string[] = [];
     selectedTickets: string[] = [];
     selectedSingleTicket: string = '';
     defaultTicketSequence: string | null = null; // store defaulted ticket
     multiSelectMode: boolean = false;
     selectedTicket: string = '';
     selectedAccount: string = '';
     ownerCount: string = '';
     totalXrpReserves: string = '';
     executionTime: string = '';
     amountField: string = '';
     destinationTagField: string = '';
     sourceTagField: string = '';
     invoiceIdField: string = '';
     memoField: string = '';
     isMemoEnabled: boolean = false;
     isInvoiceIdEnabled: boolean = false;
     isMultiSignTransaction: boolean = false;
     multiSignAddress: string = '';
     multiSignSeeds: string = '';
     signerQuorum: number = 0;
     isOnlySignTransactionEnabled: boolean = false;
     isSubmitSignedTransactionEnabled: boolean = false;
     signedTransactionField: string = '';
     submittedTxField: string = '';
     spinner: boolean = false;
     useMultiSign: boolean = false;
     multiSigningEnabled: boolean = false;
     regularKeySigningEnabled: boolean = false;
     isRegularKeyAddress: boolean = false;
     regularKeySeed: string = '';
     regularKeyAddress: string = '';
     spinnerMessage: string = '';
     masterKeyDisabled: boolean = false;
     isSimulateEnabled: boolean = false;
     destinationFields: string = '';
     destinations: string[] = [];
     signers: { account: string; seed: string; weight: number }[] = [{ account: '', seed: '', weight: 1 }];
     errorMessage: string | null = null;
     selectedTransaction: string | null = null;
     editedTxJson: any = {};
     isSendXrpEnabled: boolean = false;
     isSetTrustlineEnabled: boolean = false;
     isRemoveTrustlineEnabled: boolean = false;
     isAccountFlagEnabled: boolean = false;
     multiSignedBlobs: string[] = []; // store partial multi-signed blobs
     combinedTxBlob: string = ''; // store combined tx blob for submission
     multiSignedHtml: string = '';
     wallets: any[] = [];
     selectedWalletIndex: number = 0;
     currentWallet = { name: '', address: '', seed: '', balance: '' };
     multiSignedTxBlob: string = ''; // Final combined tx blob
     availableSigners: any[] = [];
     requiredQuorum: number = 0;
     selectedQuorum: number = 0;

     constructor(private readonly xrplService: XrplService, private readonly utilsService: UtilsService, private readonly cdr: ChangeDetectorRef, private readonly storageService: StorageService, private readonly xrplTransactions: XrplTransactionService, private readonly renderUiComponentsService: RenderUiComponentsService, private readonly signTransactionUtilService: SignTransactionUtilService, private readonly clickToCopyService: ClickToCopyService) {}

     ngOnInit() {
          if (this.ticketArray && this.ticketArray.length > 0) {
               this.defaultTicketSequence = this.ticketArray[0];
               this.selectedSingleTicket = this.defaultTicketSequence;
          }

          this.selectedTransaction = 'sendXrp';
          this.enableTransaction();
          this.cdr.detectChanges();
     }

     ngAfterViewInit() {}

     ngAfterViewChecked() {}

     onWalletListChange(event: any[]) {
          this.wallets = event;
          if (this.wallets.length > 0 && this.selectedWalletIndex >= this.wallets.length) {
               this.selectedWalletIndex = 0;
          }
          this.onAccountChange();
     }

     syncTxJsonFromField() {
          if (this.resultField && this.resultField.nativeElement.textContent) {
               this.txJson = this.resultField.nativeElement.textContent;
               this.txJson = this.txJson.slice(this.txJson.indexOf('{'));
          }
     }

     handleTransactionResult(event: { result: string; isError: boolean; isSuccess: boolean }, tx: any) {
          if (event.isError) {
               this.errorMessage = event.result;
               // txJson remains untouched
          } else {
               this.txJson = event.result;
          }
          this.isError = event.isError;
          this.isSuccess = event.isSuccess;
          this.isEditable = !this.isSuccess;
          this.cdr.detectChanges();
     }

     onTransactionChange(): void {
          this.txJson = '';
          this.outputField = '';
          this.isError = false;
          this.errorMessage = null;
          if (this.hashField) this.hashField.nativeElement.innerText = '';
          if (this.resultField) this.resultField.nativeElement.innerText = '';

          // Enable the newly selected transaction (fills the JSON pane)
          this.enableTransaction();
     }

     onAccountChange() {
          if (this.wallets.length === 0) return;

          this.currentWallet = {
               ...this.wallets[this.selectedWalletIndex],
               balance: this.currentWallet.balance || '0',
          };

          if (this.currentWallet.address && xrpl.isValidAddress(this.currentWallet.address)) {
               this.getAccountDetails();
          } else if (this.currentWallet.address) {
               this.setError('Invalid XRP address', null);
          }

          // this.availableSigners = this.wallets.filter(w => w.address !== this.currentWallet.address && this.signerAddresses.includes(w.address));
          this.resetSigners();

          this.cdr.detectChanges();
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
               this.setError('ERROR getting wallet in toggleMultiSign', null);
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

     onTicketChange(newValue: any) {
          // Check if user changed from default
          if (Array.isArray(newValue)) {
               // multi-select mode
               if (!newValue.includes(this.defaultTicketSequence)) {
                    this.toggleTicketSequence();
               }
          } else if (newValue !== this.defaultTicketSequence) {
               // single-select mode
               this.toggleTicketSequence();
          }
     }

     toggleTicketSequence() {
          this.enableTransaction();
          this.cdr.markForCheck();
     }

     onTicketToggle(event: any, ticket: string) {
          if (event.target.checked) {
               this.selectedTickets = [...this.selectedTickets, ticket];
          } else {
               this.selectedTickets = this.selectedTickets.filter(t => t !== ticket);
          }
     }

     getTransactionJSON() {
          this.onTransactionChange();
     }

     get currentQuorumSelected(): number {
          return this.availableSigners.filter(w => w.isSelectedSigner).reduce((sum, w) => sum + (w.quorum || 0), 0);
     }

     updateSelectedQuorum() {
          // Sum the weights (SignerWeight) of all checked signers
          this.selectedQuorum = this.availableSigners.filter(w => w.isSelectedSigner).reduce((sum, w) => sum + (w.quorum || 0), 0);
     }

     setTransaction(type: string, event: Event) {
          const checked = (event.target as HTMLInputElement).checked;

          if (checked) {
               this.selectedTransaction = type;
               this.txJson = ''; // clear until data appears
               this.outputField = '';
               this.isError = false;
               this.errorMessage = null;
               if (this.hashField) this.hashField.nativeElement.innerText = '';
               if (this.resultField) this.resultField.nativeElement.innerText = '';
               this.enableTransaction?.();
          } else {
               this.selectedTransaction = null;
               this.txJson = '';
               this.outputField = '';
               this.isError = false;
               this.errorMessage = null;
          }

          this.cdr.markForCheck();
     }

     async getAccountDetails() {
          console.log('Entering getAccountDetails');
          const startTime = Date.now();
          this.setSuccessProperties();

          try {
               this.showSpinnerWithDelay('Getting Account Details ...', 100);

               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const [accountInfo, accountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);

               const inputs: ValidationInputs = {
                    seed: this.currentWallet.seed,
                    account_info: accountInfo,
               };

               const errors = await this.validateInputs(inputs, 'getAccountDetails');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`, null);
               }

               this.getSignerAccountsList(accountObjects);

               // DEFER: Non-critical UI updates — let main render complete first
               setTimeout(async () => {
                    try {
                         this.refreshUIData(wallet, accountInfo, accountObjects);
                         this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
                         this.updateTickets(accountObjects);
                         this.clearFields(false);
                         await this.updateXrpBalance(client, accountInfo, wallet);
                    } catch (err) {
                         console.error('Error in deferred UI updates:', err);
                    }
               }, 0);

               this.enableTransaction();
          } catch (error: any) {
               console.error('Error in getAccountDetails:', error);
               this.setError(error.message || 'Unknown error', null);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getAccountDetails in ${this.executionTime}ms`);
          }
     }

     async enableTransaction() {
          const client = await this.xrplService.getClient();
          const wallet = await this.getWallet();

          switch (this.selectedTransaction) {
               case 'batch':
                    this.txJson = await this.signTransactionUtilService.createBatchpRequestText({ client, wallet });
                    break;
               case 'sendXrp':
                    this.txJson = await this.signTransactionUtilService.createSendXrpRequestText({ client, wallet, isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'setTrustline':
                    this.txJson = await this.signTransactionUtilService.modifyTrustlineRequestText({ client, wallet, selectedTransaction: 'setTrustline', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'removeTrustline':
                    this.txJson = await this.signTransactionUtilService.modifyTrustlineRequestText({ client, wallet, selectedTransaction: 'removeTrustline', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'issueCurrency':
                    this.txJson = await this.signTransactionUtilService.issueCurrencyRequestText({ client, wallet, selectedTransaction: 'issueCurrency', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'accountFlagSet':
                    this.txJson = await this.signTransactionUtilService.modifyAccountFlagsRequestText({ client, wallet, selectedTransaction: 'accountFlagSet', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'accountFlagClear':
                    this.txJson = await this.signTransactionUtilService.modifyAccountFlagsRequestText({ client, wallet, selectedTransaction: 'accountFlagSet', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'createTimeEscrow':
                    this.txJson = await this.signTransactionUtilService.createTimeEscrowRequestText({ client, wallet, selectedTransaction: 'createTimeEscrow', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'finishTimeEscrow':
                    this.txJson = await this.signTransactionUtilService.finshTimeEscrowRequestText({ client, wallet, selectedTransaction: 'finishTimeEscrow', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'createTimeEscrowToken':
                    this.txJson = await this.signTransactionUtilService.createTimeEscrowRequestText({ client, wallet, selectedTransaction: 'createTimeEscrowToken', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'finishTimeEscrowToken':
                    this.txJson = await this.signTransactionUtilService.finshTimeEscrowRequestText({ client, wallet, selectedTransaction: 'finishTimeEscrowToken', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'createConditionEscrow':
                    this.txJson = await this.signTransactionUtilService.createConditionalEscrowRequestText({ client, wallet, selectedTransaction: 'createConditionEscrow', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'finishConditionEscrow':
                    this.txJson = await this.signTransactionUtilService.finsishConditionalEscrowRequestText({ client, wallet, selectedTransaction: 'finishConditionEscrow', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'createConditionEscrowToken':
                    this.txJson = await this.signTransactionUtilService.createConditionalEscrowRequestText({ client, wallet, selectedTransaction: 'createConditionEscrowToken', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'finishConditionEscrowToken':
                    this.txJson = await this.signTransactionUtilService.finsishConditionalEscrowRequestText({ client, wallet, selectedTransaction: 'finishConditionEscrowToken', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'cancelEscrow':
                    this.txJson = await this.signTransactionUtilService.cancelEscrowRequestText({ client, wallet, selectedTransaction: 'cancelEscrow', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'createCheck':
                    this.txJson = await this.signTransactionUtilService.createCheckRequestText({ client, wallet, selectedTransaction: 'createCheck', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'createCheckToken':
                    this.txJson = await this.signTransactionUtilService.createCheckRequestText({ client, wallet, selectedTransaction: 'createCheckToken', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'cashCheck':
                    this.txJson = await this.signTransactionUtilService.cashCheckRequestText({ client, wallet, selectedTransaction: 'cashCheck', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'cashCheckToken':
                    this.txJson = await this.signTransactionUtilService.cashCheckRequestText({ client, wallet, selectedTransaction: 'cashCheckToken', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'cancelCheck':
                    this.txJson = await this.signTransactionUtilService.cancelCheckRequestText({ client, wallet, selectedTransaction: 'cancelCheck', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'createMPT':
                    this.txJson = await this.signTransactionUtilService.createMPTRequestText({ client, wallet, selectedTransaction: 'createMPT', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'authorizeMPT':
                    this.txJson = await this.signTransactionUtilService.authorizeMPTRequestText({ client, wallet, selectedTransaction: 'authorizeMPT', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'unauthorizeMPT':
                    this.txJson = await this.signTransactionUtilService.unauthorizeMPTRequestText({ client, wallet, selectedTransaction: 'unauthorizeMPT', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'sendMPT':
                    this.txJson = await this.signTransactionUtilService.sendMPTRequestText({ client, wallet, selectedTransaction: 'sendMPT', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'lockMPT':
                    this.txJson = await this.signTransactionUtilService.lockMPTRequestText({ client, wallet, selectedTransaction: 'lockMPT', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'unlockMPT':
                    this.txJson = await this.signTransactionUtilService.unlockMPTRequestText({ client, wallet, selectedTransaction: 'unlockMPT', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               case 'destroyMPT':
                    this.txJson = await this.signTransactionUtilService.destroyMPTRequestText({ client, wallet, selectedTransaction: 'destroyMPT', isTicketEnabled: this.isTicket, ticketSequence: this.selectedSingleTicket });
                    break;
               // add others as needed
               default:
                    console.warn(`Unknown transaction type: ${this.selectedTransaction}`);
          }

          this.cdr.markForCheck();
     }

     async unsignedTransaction() {
          console.log('Entering unsignedTransaction');
          const startTime = Date.now();
          this.setSuccessProperties();

          try {
               this.errorMessage = ''; // Clear any prior error
               const mode = this.isSimulateEnabled ? 'simulating' : 'sending';
               this.updateSpinnerMessage(`Preparing Unsigned Transaction (${mode})...`);

               if (!this.txJson.trim()) return this.setError('Transaction cannot be empty', null);

               const editedString = this.txJson.trim();
               let editedJson = JSON.parse(editedString);
               let cleanedJson = this.cleanTx(editedJson);
               console.log('Edited JSON:', editedJson);
               console.log('Cleaned JSON:', cleanedJson);

               const serialized = xrpl.encode(cleanedJson);
               const unsignedHash = xrpl.hashes.hashTx(serialized);
               console.log('Unsigned Transaction hash (hex):', unsignedHash);

               this.outputField = unsignedHash; // Set property
               this.isError = false;
          } catch (error: any) {
               console.error('Error in unsignedTransaction:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`, null);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving unsignedTransaction in ${this.executionTime}ms`);
          }
     }

     async signedTransaction() {
          console.log('Entering signedTransaction');
          const startTime = Date.now();
          this.setSuccessProperties();

          let txToSign: any;

          try {
               const mode = this.isSimulateEnabled ? 'simulating' : 'sending';
               this.updateSpinnerMessage(`Preparing Signed Transaction (${mode})...`);

               const wallet = await this.getWallet();

               if (!this.txJson.trim()) {
                    return this.setError('Transaction cannot be empty', null);
               }

               const editedString = this.txJson.trim();
               let editedJson = JSON.parse(editedString);
               txToSign = this.cleanTx(editedJson);
               console.log('Pre txToSign', txToSign);

               const client = await this.xrplService.getClient();
               const currentLedger = await client.getLedgerIndex();
               console.log('currentLedger: ', currentLedger);
               txToSign.LastLedgerSequence = currentLedger + 1000; // adjust to new ledger

               console.log('Post txToSign', txToSign);

               const signed = wallet.sign(txToSign);
               // Use tx_blob instead of signedTransaction
               this.outputField = signed.tx_blob; // Set property

               console.log('Signed TX blob:', signed.tx_blob);
               console.log('Transaction ID (hash):', signed.hash);

               // decode blob to JSON
               const decodedTx = xrpl.decode(signed.tx_blob);
               console.log(decodedTx);
          } catch (error: any) {
               console.error('Error in signedTransaction:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`, txToSign);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving signedTransaction in ${this.executionTime}ms`);
          }
     }

     async submitTransaction() {
          console.log('Entering submitTransaction');
          const startTime = Date.now();
          this.setSuccessProperties();

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               if (!this.outputField.trim()) {
                    if (this.hashField && this.hashField.nativeElement.textContent) {
                         this.outputField = this.hashField.nativeElement.textContent;
                    } else {
                         return this.setError('Signed tx blob can not be empty', null);
                    }
               }

               const signedTxBlob = this.outputField.trim();

               const txType = this.getTransactionLabel(this.selectedTransaction ?? '');
               this.updateSpinnerMessage(this.isSimulateEnabled ? `Simulating ${txType} (no funds will be moved)...` : `Submitting ${txType} to Ledger...`);

               let response: any;

               if (this.isSimulateEnabled) {
                    const txToSign = this.cleanTx(JSON.parse(this.txJson.trim()));
                    console.log('Pre txToSign', txToSign);
                    const currentLedger = await client.getLedgerIndex();
                    console.log('currentLedger: ', currentLedger);
                    txToSign.LastLedgerSequence = currentLedger + 5;
                    response = await this.xrplTransactions.simulateTransaction(client, txToSign);
               } else {
                    response = await client.submitAndWait(signedTxBlob);
               }

               const isSuccess = this.utilsService.isTxSuccessful(response);
               if (!isSuccess) {
                    const resultMsg = this.utilsService.getTransactionResultMessage(response);
                    const userMessage = 'Transaction failed.\n' + this.utilsService.processErrorMessageFromLedger(resultMsg);

                    console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                    (response.result as any).errorMessage = userMessage;
               }

               // Render result
               this.renderTransactionResult(response);
               this.txJson = this.resultField.nativeElement.textContent || ''; // Sync plain JSON after render
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.txJson, null);

               if (!this.isSimulateEnabled) {
                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              // Reset selected checkboxes
                              this.resetSigners();
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
               console.error('Error in submitTransaction:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`, null);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving submitTransaction in ${this.executionTime}ms`);
          }
     }

     async submitMultiSignedTransaction() {
          console.log('Entering submitMultiSignedTransaction');
          const startTime = Date.now();
          this.setSuccessProperties();

          try {
               if (!this.outputField.trim()) {
                    if (this.hashField && this.hashField.nativeElement.textContent) {
                         this.outputField = this.hashField.nativeElement.textContent;
                    } else {
                         return this.setError('Signed tx blob can not be empty', null);
                    }
               }

               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const multiSignedTxBlob = this.outputField.trim();
               console.log('multiSignedTxBlob', multiSignedTxBlob);

               const txType = this.getTransactionLabel(this.selectedTransaction ?? '');
               this.updateSpinnerMessage(this.isSimulateEnabled ? `Simulating ${txType} (no funds will be moved)...` : `Submitting ${txType} to Ledger...`);

               let response: any;

               if (this.isSimulateEnabled) {
                    const txToSign = this.cleanTx(JSON.parse(this.txJson.trim()));
                    console.log('Pre txToSign', txToSign);
                    const currentLedger = await client.getLedgerIndex();
                    console.log('currentLedger: ', currentLedger);
                    txToSign.LastLedgerSequence = currentLedger + 5;
                    response = await this.xrplTransactions.simulateTransaction(client, txToSign);
               } else {
                    response = await client.submitAndWait(multiSignedTxBlob);
               }

               const isSuccess = this.utilsService.isTxSuccessful(response);
               if (!isSuccess) {
                    const resultMsg = this.utilsService.getTransactionResultMessage(response);
                    const userMessage = 'Transaction failed.\n' + this.utilsService.processErrorMessageFromLedger(resultMsg);

                    console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                    (response.result as any).errorMessage = userMessage;
               }

               // Render result
               this.renderTransactionResult(response);
               this.txJson = this.resultField.nativeElement.textContent || ''; // Sync plain JSON after render
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.txJson, null);

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
               console.error('Error in submitMultiSignedTransaction:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`, null);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving submitMultiSignedTransaction in ${this.executionTime}ms`);
          }
     }

     async signForMultiSign() {
          console.log('Entering signForMultiSign');
          const startTime = Date.now();
          this.setSuccessProperties();

          let txToSign: any;

          try {
               if (!this.txJson.trim()) {
                    return this.setError('Transaction cannot be empty', null);
               }

               const editedString = this.txJson.trim();
               let editedJson = JSON.parse(editedString);
               txToSign = this.cleanTx(editedJson);
               console.log('Pre txToSign', txToSign);

               const client = await this.xrplService.getClient();
               const currentLedger = await client.getLedgerIndex();
               console.log('currentLedger: ', currentLedger);
               txToSign.LastLedgerSequence = currentLedger + 1000; // adjust to new ledger

               console.log('Post txToSign', txToSign);

               // Get selected signer wallets
               const selectedSigners = this.availableSigners.filter(w => w.isSelectedSigner);

               if (!selectedSigners.length) {
                    return this.setError('Select at least one signer.', null);
               }

               const addresses = selectedSigners.map(acc => acc.address).join(',');
               const seeds = selectedSigners.map(acc => acc.seed).join(',');
               console.log('Addresses:', addresses);
               console.log('Seeds:', seeds);

               const fee = await this.xrplService.calculateTransactionFee(client);
               const wallet = await this.getWallet();
               const signerAddresses = this.utilsService.getMultiSignAddress(addresses);
               const signerSeeds = this.utilsService.getMultiSignSeeds(seeds);
               const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, tx: txToSign, signerAddresses, signerSeeds, fee });
               console.info(`result`, result);
               this.outputField = result.signedTx?.tx_blob ? result.signedTx?.tx_blob : 'Error';
          } catch (error: any) {
               console.error('Error in signForMultiSign:', error);
               this.setError(`Error: ${error.message || error}`, null);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving signForMultiSign in ${this.executionTime}ms`);
          }
     }

     cleanTx(editedJson: any) {
          const defaults: Record<string, any[]> = {
               DestinationTag: [0],
               SourceTag: [0],
               InvoiceID: [0, ''],
          };

          for (const field in defaults) {
               if (editedJson.hasOwnProperty(field) && defaults[field].includes(editedJson[field])) {
                    delete editedJson[field];
               }
          }

          if (Array.isArray(editedJson.Memos)) {
               editedJson.Memos = editedJson.Memos.filter((memoObj: any) => {
                    const memo = memoObj?.Memo;
                    if (!memo) return false;

                    // Check if both fields are effectively empty
                    const memoDataEmpty = !memo.MemoData || memo.MemoData === '' || memo.MemoData === 0;
                    const memoTypeEmpty = !memo.MemoType || memo.MemoType === '' || memo.MemoType === 0;

                    // Remove if both are empty
                    return !(memoDataEmpty || memoTypeEmpty);
               });

               if (editedJson.Memos.length === 0) {
                    delete editedJson.Memos;
               } else {
                    this.encodeMemo(editedJson);
               }
          }

          if (typeof editedJson.Amount === 'string' && this.selectedTransaction === 'sendXrp') {
               editedJson.Amount = xrpl.xrpToDrops(editedJson.Amount);
          }

          if (this.isSimulateEnabled) {
               delete editedJson.Sequence;
          }

          return editedJson;
     }

     populateTxDetails() {
          if (!this.outputField.trim()) return;
          const decodedTx = xrpl.decode(this.outputField.trim());
          console.log(decodedTx);

          this.txJson = JSON.stringify(decodedTx, null, 3); // Update txJson with decoded
     }

     encodeMemo(editedJson: any) {
          editedJson.Memos = editedJson.Memos.map((memoObj: any) => {
               // Ensure the structure is correct
               if (!memoObj || !memoObj.Memo) {
                    return memoObj; // Return as-is if structure is unexpected
               }

               const { MemoData, MemoType, MemoFormat, ...rest } = memoObj.Memo;

               return {
                    Memo: {
                         ...rest,
                         ...(MemoData && { MemoData: xrpl.convertStringToHex(MemoData) }),
                         ...(MemoType && { MemoType: xrpl.convertStringToHex(MemoType) }),
                         ...(MemoFormat && { MemoFormat: xrpl.convertStringToHex(MemoFormat) }),
                    },
               };
          });
     }

     highlightJson(json: string): string {
          if (!json) return '';
          json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, match => {
               let cls = 'number';
               if (/^"/.test(match)) {
                    cls = /:$/.test(match) ? 'key' : 'string';
               } else if (/true|false/.test(match)) {
                    cls = 'boolean';
               } else if (/null/.test(match)) {
                    cls = 'null';
               }
               return `<span class="${cls}">${match}</span>`;
          });
     }

     private refreshUIData(wallet: xrpl.Wallet, updatedAccountInfo: any, updatedAccountObjects: xrpl.AccountObjectsResponse) {
          this.utilsService.logAccountInfoObjects(updatedAccountInfo, updatedAccountObjects);

          this.refreshUiAccountObjects(updatedAccountObjects, updatedAccountInfo, wallet);
          this.refreshUiAccountInfo(updatedAccountInfo);
     }

     private checkForSignerAccounts(accountObjects: xrpl.AccountObjectsResponse): string[] {
          const accountObjectsArray = accountObjects.result?.account_objects;
          if (!Array.isArray(accountObjectsArray)) return [];

          const signerAccounts: string[] = [];

          for (const obj of accountObjectsArray) {
               if (obj.LedgerEntryType === 'SignerList' && Array.isArray(obj.SignerEntries)) {
                    // Set quorum once
                    if (obj.SignerQuorum !== undefined) {
                         this.signerQuorum = obj.SignerQuorum;
                    }

                    for (const entry of obj.SignerEntries) {
                         const account = entry.SignerEntry?.Account;
                         if (account) {
                              signerAccounts.push(`${account}~${entry.SignerEntry.SignerWeight ?? ''}`);
                         }
                    }
               }
          }

          return signerAccounts;
     }

     private getSignerAccountsList(accountObjects: xrpl.AccountObjectsResponse) {
          const signerList = accountObjects.result.account_objects?.find((obj: any): obj is SignerList => obj.LedgerEntryType === 'SignerList');
          this.requiredQuorum = signerList?.SignerQuorum || 0;

          const signerData = this.checkForSignerAccounts(accountObjects).map(s => {
               const [address, weight] = s.split('~');
               return { address, weight: parseInt(weight, 10) };
          });
          this.availableSigners = this.wallets
               .filter(w => w.address !== this.currentWallet.address)
               .filter(w => signerData.some(s => s.address === w.address))
               .map(w => {
                    const match = signerData.find(s => s.address === w.address);
                    return {
                         ...w,
                         quorum: match ? match.weight : null,
                         isSelectedSigner: false,
                    };
               });
     }

     private getAccountTickets(accountObjects: xrpl.AccountObjectsResponse): string[] {
          const objects = accountObjects.result?.account_objects;
          if (!Array.isArray(objects)) return [];

          const tickets = objects.reduce((acc: number[], obj) => {
               if (obj.LedgerEntryType === 'Ticket' && typeof obj.TicketSequence === 'number') {
                    acc.push(obj.TicketSequence);
               }
               return acc;
          }, []);

          return tickets.sort((a, b) => a - b).map(String);
     }

     public cleanUpSingleSelection() {
          // Check if selected ticket still exists in available tickets
          if (this.selectedSingleTicket && !this.ticketArray.includes(this.selectedSingleTicket)) {
               this.selectedSingleTicket = ''; // Reset to "Select a ticket"
          }
     }

     public cleanUpMultiSelection() {
          // Filter out any selected tickets that no longer exist
          this.selectedTickets = this.selectedTickets.filter(ticket => this.ticketArray.includes(ticket));
     }

     updateTickets(accountObjects: xrpl.AccountObjectsResponse) {
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

     public refreshUiAccountObjects(accountObjects: xrpl.AccountObjectsResponse, accountInfo: xrpl.AccountInfoResponse, wallet: xrpl.Wallet): void {
          // Tickets
          this.ticketArray = this.getAccountTickets(accountObjects);
          this.selectedTicket = this.ticketArray[0] || this.selectedTicket;

          // Signer accounts
          const signerAccounts = this.checkForSignerAccounts(accountObjects);
          const hasSignerAccounts = signerAccounts?.length > 0;

          if (hasSignerAccounts) {
               const signerEntries = this.storageService.get(`${wallet.classicAddress}signerEntries`) || [];
               this.multiSignAddress = signerEntries.map((e: { Account: any }) => e.Account).join(',\n');
               this.multiSignSeeds = signerEntries.map((e: { seed: any }) => e.seed).join(',\n');
          } else {
               this.signerQuorum = 0;
               this.multiSignAddress = 'No Multi-Sign address configured for account';
               this.multiSignSeeds = '';
               this.storageService.removeValue('signerEntries');
          }

          // Boolean flags
          this.multiSigningEnabled = hasSignerAccounts;
          this.useMultiSign = false;
          this.masterKeyDisabled = Boolean(accountInfo?.result?.account_flags?.disableMasterKey);

          this.clearFields(false);
     }

     public refreshUiAccountInfo(accountInfo: xrpl.AccountInfoResponse): void {
          const accountData = accountInfo?.result?.account_data;
          if (!accountData) return;

          const regularKey = accountData.RegularKey;
          const isMasterKeyDisabled = accountInfo?.result?.account_flags?.disableMasterKey ?? false;

          // Set regular key properties
          this.setRegularKeyProperties(regularKey, accountData.Account);

          // Set master key property
          this.masterKeyDisabled = isMasterKeyDisabled;

          // Set regular key signing enabled flag
          this.regularKeySigningEnabled = !!regularKey;
     }

     private setRegularKeyProperties(regularKey: string | undefined, account: string): void {
          if (regularKey) {
               this.regularKeyAddress = regularKey;
               this.regularKeySeed = this.storageService.get(`${account}regularKeySeed`) || '';
          } else {
               this.regularKeyAddress = 'No RegularKey configured for account';
               this.regularKeySeed = '';
               this.isRegularKeyAddress = false;
          }
     }

     private async getWallet() {
          const wallet = await this.utilsService.getWallet(this.currentWallet.seed);
          if (!wallet) {
               throw new Error('ERROR: Wallet could not be created or is undefined');
          }
          return wallet;
     }

     private async validateInputs(inputs: ValidationInputs, action: string): Promise<string[]> {
          const errors: string[] = [];

          // --- Common validators ---
          const isRequired = (value: string | null | undefined, fieldName: string): string | null => {
               if (value == null || !this.utilsService.validateInput(value)) {
                    return `${fieldName} cannot be empty`;
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

          // --- Action-specific config ---
          const actionConfig: Record<
               string,
               {
                    required: (keyof ValidationInputs)[];
                    customValidators?: (() => string | null)[];
                    asyncValidators?: (() => Promise<string | null>)[];
               }
          > = {
               getAccountDetails: {
                    required: ['seed'],
                    customValidators: [() => isValidSeed(inputs.seed), () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null)],
                    asyncValidators: [],
               },
               default: { required: [], customValidators: [], asyncValidators: [] },
          };

          const config = actionConfig[action] || actionConfig['default'];

          // --- Run required checks ---
          config.required.forEach((field: keyof ValidationInputs) => {
               const err = isRequired(inputs[field], field.charAt(0).toUpperCase() + field.slice(1));
               if (err) errors.push(err);
          });

          // --- Run sync custom validators ---
          config.customValidators?.forEach(validator => {
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

          return errors;
     }

     clearFields(clearAllFields: boolean) {
          if (clearAllFields) {
               this.amountField = '';
               this.invoiceIdField = '';
               this.destinationTagField = '';
               this.sourceTagField = '';
          }

          this.selectedSingleTicket = '';
          this.isTicket = false;
          this.memoField = '';
          this.isMemoEnabled = false;
          this.resetSigners();
          this.cdr.markForCheck();
     }

     resetSigners() {
          this.availableSigners.forEach(w => (w.isSelectedSigner = false));
          this.selectedQuorum = 0;
     }

     private renderTransactionResult(response: any): void {
          if (this.isSimulateEnabled) {
               this.renderUiComponentsService.renderSimulatedTransactionsResults(response, this.resultField.nativeElement);
          } else {
               console.debug(`Response`, response);
               this.renderUiComponentsService.renderTransactionsResults(response, this.resultField.nativeElement);
          }
          this.clickToCopyService.attachCopy(this.resultField.nativeElement);
     }

     getTransactionLabel(key: string): string {
          return (AppConstants.SIGN_TRANSACTION_LABEL_MAP as Record<string, string>)[key] || key;
     }

     private updateSpinnerMessage(message: string) {
          this.spinnerMessage = message;
          this.cdr.markForCheck();
     }

     private async showSpinnerWithDelay(message: string, delayMs: number = 200) {
          this.spinner = true;
          this.updateSpinnerMessage(message);
          await new Promise(resolve => setTimeout(resolve, delayMs));
     }

     private setErrorProperties() {
          this.isSuccess = false;
          this.isError = true;
          this.spinner = false;
     }

     private setError(message: string, txToSign: any) {
          this.setErrorProperties();
          this.outputField = ''; // Ensure hash field is empty
          this.errorMessage = message;
          this.cdr.markForCheck();
     }

     private setSuccessProperties() {
          this.isSuccess = true;
          this.isError = false;
          this.spinner = true;
          // this.txJson = '';
     }

     private setSuccess(message: string, txToSign: any) {
          this.setSuccessProperties();
          this.errorMessage = null; // Clear error
          this.txJson = message; // Set the success message/JSON
          this.cdr.markForCheck();
     }
}
