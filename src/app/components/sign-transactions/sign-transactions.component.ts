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

interface ValidationInputs {
     selectedAccount?: string;
     senderAddress?: string;
     account_info?: any;
     seed?: string;
     amount?: string;
     destination?: string;
     destinationTag?: string;
     sourceTag?: string;
     invoiceId?: string;
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
     transactionInput: string = '';
     txJson: string = ''; // Dedicated for transaction JSON (untouched on error)
     outputField: string = ''; // Dedicated for hash/blob in "Signed" field (empty on error)
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = false;
     ticketSequence: string = '';
     isTicket: boolean = false;
     isTicketEnabled: boolean = false;
     ticketArray: string[] = [];
     selectedTickets: string[] = []; // For multiple selection
     selectedSingleTicket: string = ''; // For single selection
     multiSelectMode: boolean = false; // Toggle between modes
     selectedTicket: string = ''; // The currently selected ticket
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
     showTrustlineOptions: boolean = false;
     showAccountOptions: boolean = false;
     showEscrowOptions: boolean = false;
     showCheckOptions: boolean = false;
     showSendXrpOptions: boolean = false;
     transactionTypes = [
          {
               value: 'Payment',
               label: 'Send XRP',
               description: 'Transfer XRP between accounts',
               icon: '💸',
          },
          {
               value: 'TrustSet',
               label: 'Trustline',
               description: 'Add or modify a trustline',
               icon: '🤝',
          },
          {
               value: 'OfferCreate',
               label: 'Offer',
               description: 'Create an order on the DEX',
               icon: '📈',
          },
          {
               value: 'NFTokenMint',
               label: 'Mint NFT',
               description: 'Create a new NFT on XRPL',
               icon: '🖼️',
          },
          {
               value: 'NFTokenBurn',
               label: 'Burn NFT',
               description: 'Destroy an existing NFT',
               icon: '🔥',
          },
          {
               value: 'EscrowCreate',
               label: 'Escrow',
               description: 'Lock XRP until conditions are met',
               icon: '⏳',
          },
          {
               value: 'CheckCreate',
               label: 'Check',
               description: 'Create a deferred payment check',
               icon: '✅',
          },
          {
               value: 'AccountSet',
               label: 'Account Flags',
               description: 'Configure account settings',
               icon: '⚙️',
          },
          // ➕ Add more as needed
     ];
     wallets: any[] = [];
     selectedWalletIndex: number = 0;
     currentWallet = { name: '', address: '', seed: '', balance: '' };

     constructor(private readonly xrplService: XrplService, private readonly utilsService: UtilsService, private readonly cdr: ChangeDetectorRef, private readonly storageService: StorageService, private readonly xrplTransactions: XrplTransactionService, private readonly renderUiComponentsService: RenderUiComponentsService, private readonly signTransactionUtilService: SignTransactionUtilService) {}

     ngOnInit() {
          this.showSendXrpOptions = true;
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
          this.updateDestinations();
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

     onAccountChange() {
          if (this.wallets.length === 0) return;
          this.currentWallet = {
               ...this.wallets[this.selectedWalletIndex],
               balance: this.currentWallet.balance || '0',
          };
          this.updateDestinations();
          if (this.currentWallet.address && xrpl.isValidAddress(this.currentWallet.address)) {
               this.getAccountDetails();
          } else if (this.currentWallet.address) {
               this.setError('Invalid XRP address', null);
          }
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
               return this.setError('ERROR getting wallet in toggleMultiSign', null);
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
          if (!this.isTicketEnabled) {
               this.enableTransaction();
          }
          this.cdr.markForCheck();
     }

     onTicketToggle(event: any, ticket: string) {
          if (event.target.checked) {
               this.selectedTickets = [...this.selectedTickets, ticket];
          } else {
               this.selectedTickets = this.selectedTickets.filter(t => t !== ticket);
          }
     }

     // selectTransaction(value: string) {
     //      this.selectedTransaction = value;
     //      console.log('Selected transaction:', value);
     // }

     setTransaction(type: string, event: Event) {
          const checked = (event.target as HTMLInputElement).checked;

          if (checked) {
               this.resetToggles(type);
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

     // setTransaction(type: string, event: Event) {
     //      const checked = (event.target as HTMLInputElement).checked;

     //      if (checked) {
     //           this.selectedTransaction = type;
     //           this.txJson = '';
     //           this.hashField.nativeElement.innerText = '';
     //           this.isError = false;
     //           this.errorMessage = null;
     //           this.enableTransaction();
     //      } else {
     //           this.selectedTransaction = null; // 👈 removes the whole block
     //           this.txJson = '';
     //           this.isError = false;
     //           this.errorMessage = null;
     //      }
     // }

     async getAccountDetails() {
          console.log('Entering getAccountDetails');
          const startTime = Date.now();
          this.setSuccessProperties();

          try {
               this.showSpinnerWithDelay('Getting Account Details ...', 100);

               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const [accountInfo, accountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);

               console.debug(`accountInfo:`, accountInfo.result);
               console.debug(`accountObjects:`, accountObjects.result);

               const inputs: ValidationInputs = {
                    selectedAccount: this.selectedAccount,
                    seed: this.currentWallet.seed,
                    account_info: accountInfo,
               };

               const errors = await this.validateInputs(inputs, 'getAccountDetails');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`, null);
               }

               // DEFER: Non-critical UI updates — let main render complete first
               setTimeout(async () => {
                    try {
                         this.refreshUIData(wallet, accountInfo, accountObjects);
                         this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
                         this.clearFields(false);
                         await this.updateXrpBalance(client, accountInfo, wallet);
                    } catch (err) {
                         console.error('Error in deferred UI updates:', err);
                    }
               }, 0);
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
               case 'sendXrp':
                    this.txJson = await this.signTransactionUtilService.createSendXrpRequestText({ client, wallet, isTicketEnabled: this.isTicketEnabled, ticketSequence: this.ticketSequence });
                    break;
               case 'setTrustline':
                    this.txJson = await this.signTransactionUtilService.modifyTrustlineRequestText({ client, wallet, selectedTransaction: 'setTrustline', isTicketEnabled: this.isTicketEnabled, ticketSequence: this.ticketSequence });
                    break;
               case 'removeTrustline':
                    this.txJson = await this.signTransactionUtilService.modifyTrustlineRequestText({ client, wallet, selectedTransaction: 'removeTrustline', isTicketEnabled: this.isTicketEnabled, ticketSequence: this.ticketSequence });
                    break;
               case 'accountFlagSet':
                    this.txJson = await this.signTransactionUtilService.modifyAccountFlagsRequestText({ client, wallet, selectedTransaction: 'accountFlagSet', isTicketEnabled: this.isTicketEnabled, ticketSequence: this.ticketSequence });
                    break;
               case 'accountFlagClear':
                    this.txJson = await this.signTransactionUtilService.modifyAccountFlagsRequestText({ client, wallet, selectedTransaction: 'accountFlagSet', isTicketEnabled: this.isTicketEnabled, ticketSequence: this.ticketSequence });
                    break;
               case 'createTimeEscrow':
                    this.txJson = await this.signTransactionUtilService.createTimeEscrowRequestText({ client, wallet, selectedTransaction: 'createTimeEscrow', isTicketEnabled: this.isTicketEnabled, ticketSequence: this.ticketSequence });
                    break;
               case 'finishTimeEscrow':
                    this.txJson = await this.signTransactionUtilService.finshEscrowRequestText({ client, wallet, selectedTransaction: 'finishTimeEscrow', isTicketEnabled: this.isTicketEnabled, ticketSequence: this.ticketSequence });
                    break;
               case 'createConditionEscrow':
                    this.txJson = await this.signTransactionUtilService.createEscrowRequestText({ client, wallet, selectedTransaction: 'createConditionEscrow', isTicketEnabled: this.isTicketEnabled, ticketSequence: this.ticketSequence });
                    break;
               case 'finishConditionEscrow':
                    this.txJson = await this.signTransactionUtilService.createEscrowRequestText({ client, wallet, selectedTransaction: 'finishConditionEscrow', isTicketEnabled: this.isTicketEnabled, ticketSequence: this.ticketSequence });
                    break;
               case 'cancelEscrow':
                    this.txJson = await this.signTransactionUtilService.createEscrowRequestText({ client, wallet, selectedTransaction: 'cancelEscrow', isTicketEnabled: this.isTicketEnabled, ticketSequence: this.ticketSequence });
                    break;
               case 'createCheck':
                    this.txJson = await this.signTransactionUtilService.createCheckRequestText({ client, wallet, selectedTransaction: 'createCheck', isTicketEnabled: this.isTicketEnabled, ticketSequence: this.ticketSequence });
                    break;
               case 'cashCheck':
                    this.txJson = await this.signTransactionUtilService.cashCheckRequestText({ client, wallet, selectedTransaction: 'cashCheck', isTicketEnabled: this.isTicketEnabled, ticketSequence: this.ticketSequence });
                    break;
               case 'cancelCheck':
                    this.txJson = await this.signTransactionUtilService.cancelCheckRequestText({ client, wallet, selectedTransaction: 'cancelCheck', isTicketEnabled: this.isTicketEnabled, ticketSequence: this.ticketSequence });
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
               if (this.isSimulateEnabled) {
                    txToSign.LastLedgerSequence = currentLedger;
               } else {
                    txToSign.LastLedgerSequence = currentLedger + 1000; // adjust to new ledger
               }

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
               this.setError(`ERROR: ${error.message || 'Unknown error'}`, txToSign); // Clears outputField
               // txJson remains untouched
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
               const mode = this.isSimulateEnabled ? 'simulating' : 'sending';
               this.updateSpinnerMessage(`Preparing Signed Transaction Submit (${mode})...`);

               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Sending XRP (no funds will be moved)...' : 'Submitting to Ledger...');

               if (!this.outputField.trim()) return this.setError('Signed tx blob can not be empty', null);
               const signedTxBlob = this.outputField.trim();

               const currentLedger = await client.getLedgerIndex();
               console.log('currentLedger: ', currentLedger);

               if (this.isSimulateEnabled) {
                    const txToSign = this.cleanTx(JSON.parse(this.txJson.trim()));
                    console.log('Pre txToSign', txToSign);
                    const simulation = await this.xrplTransactions.simulateTransaction(client, txToSign);

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
                    this.txJson = this.resultField.nativeElement.textContent || ''; // Sync plain JSON after render

                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.txJson, null);
               } else {
                    const response = await client.submitAndWait(signedTxBlob);

                    const isSuccess = this.utilsService.isTxSuccessful(response);
                    if (!isSuccess) {
                         const resultMsg = this.utilsService.getTransactionResultMessage(response);
                         let userMessage = 'Transaction failed.\n';
                         userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                         (response.result as any).errorMessage = userMessage;
                         console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                    }

                    this.renderTransactionResult(response);
                    this.txJson = this.resultField.nativeElement.textContent || ''; // Sync plain JSON after render
                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.txJson, null);

                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

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
               console.error('Error in submitTransaction:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`, null);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving submitTransaction in ${this.executionTime}ms`);
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
                    return !(memoDataEmpty && memoTypeEmpty);
               });

               if (editedJson.Memos.length === 0) {
                    delete editedJson.Memos;
               } else {
                    this.encodeMemo(editedJson);
               }
          }

          if (typeof editedJson.Amount === 'string') {
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

     private encodeMemo(editedJson: any) {
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

     private async updateXrpBalance(client: xrpl.Client, accountInfo: xrpl.AccountInfoResponse, wallet: xrpl.Wallet) {
          const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, accountInfo, wallet.classicAddress);

          this.ownerCount = ownerCount;
          this.totalXrpReserves = totalXrpReserves;

          const balance = (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0');
          this.currentWallet.balance = balance.toString();
     }

     private refreshUiAccountObjects(accountObjects: xrpl.AccountObjectsResponse, accountInfo: xrpl.AccountInfoResponse, wallet: xrpl.Wallet) {
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

     updateDestinations() {
          this.destinations = this.wallets.map(w => w.address);
          if (this.destinations.length > 0 && !this.destinationFields) {
               this.destinationFields = this.destinations[0];
          }
          this.cdr.markForCheck();
     }

     toggleGroup(groupKey: string, event: Event) {
          const checked = (event.target as HTMLInputElement).checked;

          // Reset all groups
          this.transactionGroups.forEach(group => {
               (this as any)[group.key] = false;
          });

          // Open selected group if checked
          if (checked) (this as any)[groupKey] = true;

          // Reset transaction & display
          this.selectedTransaction = '';
          this.txJson = '';
          this.outputField = '';
          this.isError = true;
          this.errorMessage = null;

          if (this.hashField) this.hashField.nativeElement.innerText = '';
          if (this.resultField) this.resultField.nativeElement.innerText = '';

          this.cdr.markForCheck();
     }

     private resetToggles(exceptFor?: string) {
          // Turn off every "showXYZOptions" flag
          this.transactionGroups.forEach(group => {
               (this as any)[group.key] = false;
          });

          // If a transaction name is provided, open the matching group (so sub-selection keeps parent open)
          if (exceptFor) {
               const matchingGroup = this.transactionGroups.find(group => group.transactions.includes(exceptFor));
               if (matchingGroup) {
                    (this as any)[matchingGroup.key] = true;
               }
          }
     }

     private transactionGroups = [
          { key: 'showSendXrpOptions', transactions: ['sendXrp'] },
          { key: 'showTrustlineOptions', transactions: ['setTrustline', 'removeTrustline'] },
          { key: 'showAccountOptions', transactions: ['accountFlagSet', 'accountFlagClear'] },
          { key: 'showEscrowOptions', transactions: ['createTimeEscrow', 'finishTimeEscrow', 'createConditionEscrow', 'finishConditionEscrow', 'cancelEscrow'] },
          { key: 'showCheckOptions', transactions: ['createCheck', 'cashCheck', 'cancelCheck'] },
          // add more groups here if you add new submenu transaction names
     ];

     private async getWallet() {
          const environment = this.xrplService.getNet().environment;
          const seed = this.currentWallet.seed;
          const wallet = await this.utilsService.getWallet(seed, environment);
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
               if (value === undefined || (allowEmpty && value === '')) return null;
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

          const isValidInvoiceId = (value: string | undefined): string | null => {
               if (value && !this.utilsService.validateInput(value)) {
                    return 'Invoice ID is invalid';
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
               getAccountDetails: {
                    required: ['seed'],
                    customValidators: [() => isValidSeed(inputs.seed), () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null)],
                    asyncValidators: [],
               },
               sendXrp: {
                    required: ['seed', 'amount', 'destination'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.amount, 'XRP Amount', 0),
                         () => isValidXrpAddress(inputs.destination, 'Destination'),
                         () => isValidNumber(inputs.sourceTag, 'Source Tag', 0, true),
                         () => isValidNumber(inputs.destinationTag, 'Destination Tag', 0, true),
                         () => isValidInvoiceId(inputs.invoiceId),
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

          // --- Always validate optional fields ---
          const multiErr = validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds);
          if (multiErr) errors.push(multiErr);

          if (errors.length == 0 && inputs.useMultiSign && (inputs.multiSignAddresses === 'No Multi-Sign address configured for account' || inputs.multiSignSeeds === '')) {
               errors.push('At least one signer address is required for multi-signing');
          }

          const regAddrErr = isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address');
          if (regAddrErr && inputs.regularKeyAddress !== 'No RegularKey configured for account') {
               errors.push(regAddrErr);
          }

          const regSeedErr = isValidSecret(inputs.regularKeySeed, 'Regular Key Seed');
          if (regSeedErr) errors.push(regSeedErr);

          return errors;
     }

     clearFields(clearAllFields: boolean) {
          if (clearAllFields) {
               this.amountField = '';
               this.invoiceIdField = '';
               this.destinationTagField = '';
               this.sourceTagField = '';
          }

          this.ticketSequence = '';
          this.isTicket = false;
          this.memoField = '';
          this.isMemoEnabled = false;
          this.cdr.markForCheck();
     }

     private renderTransactionResult(response: any): void {
          if (this.isSimulateEnabled) {
               this.renderUiComponentsService.renderSimulatedTransactionsResults(response, this.resultField.nativeElement);
          } else {
               console.debug(`Response`, response);
               this.renderUiComponentsService.renderTransactionsResults(response, this.resultField.nativeElement);
          }
     }

     private updateSpinnerMessage(message: string) {
          this.spinnerMessage = message;
          this.cdr.markForCheck();
          console.log('Spinner message updated:', message);
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
