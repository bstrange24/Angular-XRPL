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
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';

interface ValidationInputs {
     selectedAccount?: 'account1' | 'account2' | 'issuer' | null;
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
     ticketSequence?: string;
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
     imports: [CommonModule, FormsModule, WalletMultiInputComponent, NavbarComponent, SanitizeHtmlPipe, MatAutocompleteModule, MatTableModule, MatSortModule, MatPaginatorModule, MatInputModule, MatFormFieldModule],
     templateUrl: './sign-transactions.component.html',
     styleUrl: './sign-transactions.component.css',
})
export class SignTransactionsComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     @ViewChild('resultFieldError') resultFieldError!: ElementRef<HTMLDivElement>;
     @ViewChild('hashField') hashField!: ElementRef<HTMLDivElement>;
     @ViewChild('accountForm') accountForm!: NgForm;
     selectedAccount: 'account1' | 'account2' | 'issuer' | null = 'account1';
     private lastResult: string = '';
     transactionInput: string = '';
     txJson: string = ''; // Dedicated for transaction JSON (untouched on error)
     outputField: string = ''; // Dedicated for hash/blob in "Signed" field (empty on error)
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
     isTicket: boolean = false;
     spinnerMessage: string = '';
     masterKeyDisabled: boolean = false;
     isSimulateEnabled: boolean = false;
     destinationFields: string = '';
     private knownDestinations: { [key: string]: string } = {};
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
     transactionTypes = [
          { value: 'Payment', label: 'Send XRP', description: 'Transfer XRP between accounts', icon: '💸' },
          { value: 'TrustSet', label: 'Trustline', description: 'Add or modify a trustline', icon: '🤝' },
          { value: 'OfferCreate', label: 'Offer', description: 'Create an order on the DEX', icon: '📈' },
          { value: 'NFTokenMint', label: 'Mint NFT', description: 'Create a new NFT on XRPL', icon: '🖼️' },
          { value: 'NFTokenBurn', label: 'Burn NFT', description: 'Destroy an existing NFT', icon: '🔥' },
          { value: 'EscrowCreate', label: 'Escrow', description: 'Lock XRP until conditions are met', icon: '⏳' },
          { value: 'CheckCreate', label: 'Check', description: 'Create a deferred payment check', icon: '✅' },
          { value: 'AccountSet', label: 'Account Flags', description: 'Configure account settings', icon: '⚙️' },
          // ➕ Add more as needed
     ];

     constructor(private readonly xrplService: XrplService, private readonly utilsService: UtilsService, private readonly cdr: ChangeDetectorRef, private readonly storageService: StorageService, private readonly xrplTransactions: XrplTransactionService, private readonly renderUiComponentsService: RenderUiComponentsService) {}

     ngOnInit() {}

     async ngAfterViewInit() {
          try {
               const wallet = await this.getWallet();
               this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
               this.updateDestinations();
          } catch (error: any) {
               console.error(`No wallet could be created or is undefined ${error.message}`);
               return this.setError('ERROR: Wallet could not be created or is undefined', null);
          } finally {
               this.cdr.detectChanges();
          }
     }

     ngAfterViewChecked() {}

     onWalletInputChange(event: { account1: any; account2: any; issuer: any }) {
          this.account1 = { ...event.account1, balance: '0' };
          this.account2 = { ...event.account2, balance: '0' };
          this.issuer = { ...event.issuer, balance: '0' };
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
               console.error(`No wallet could be created or is undefined ${error.message}`);
               return this.setError('ERROR: Wallet could not be created or is undefined', null);
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
          if (!this.isTicketEnabled) {
               this.enableTransaction();
          }
          this.cdr.detectChanges();
     }

     // onResultFieldChange() {
     //      try {
     //           const text = this.resultField.nativeElement.innerText; // or innerText if you want plain text
     //           this.editedTxJson = JSON.parse(text);
     //      } catch (err) {
     //           console.warn('Invalid JSON in resultField, cannot parse yet');
     //           this.editedTxJson = null;
     //      }
     // }

     selectTransaction(value: string) {
          this.selectedTransaction = value;
          console.log('Selected transaction:', value);
          // 👉 You can trigger form changes, show relevant inputs, etc.
     }

     setTransaction1(type: string, event: Event) {
          const checked = (event.target as HTMLInputElement).checked;

          if (checked) {
               this.selectedTransaction = type; // turn this one on
               this.resultFieldError.nativeElement.innerText = '';
               this.enableTransaction();
          } else {
               this.selectedTransaction = null; // allow all off if you want
               this.resultFieldError.nativeElement.innerText = '';
               this.resultField.nativeElement.innerText = '';
               this.hashField.nativeElement.innerText = '';
          }
     }

     setTransaction(type: string, event: Event) {
          const checked = (event.target as HTMLInputElement).checked;

          if (checked) {
               this.selectedTransaction = type;
               this.txJson = '';
               this.hashField.nativeElement.innerText = '';
               this.isError = false;
               this.errorMessage = null;
               this.enableTransaction();
          } else {
               this.selectedTransaction = null; // 👈 removes the whole block
               this.txJson = '';
               this.isError = false;
               this.errorMessage = null;
          }
     }

     async getAccountDetails() {
          console.log('Entering getAccountDetails');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount || '', this.account1, this.account2, this.issuer),
          };

          try {
               this.showSpinnerWithDelay('Getting Account Details ...', 100);

               // Phase 1: Get client + wallet
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // Phase 2: Fetch account info + objects in PARALLEL
               const [accountInfo, accountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);

               inputs = {
                    ...inputs,
                    account_info: accountInfo,
               };

               const errors = await this.validateInputs(inputs, 'getAccountDetails');
               if (errors.length > 0) {
                    return this.setError(`ERROR: ${errors.join('; ')}`, null);
               }

               this.refreshUiAccountObjects(accountObjects, accountInfo, wallet);
               this.refreshUiAccountInfo(accountInfo);

               // DEFER: Non-critical UI updates — let main render complete first
               setTimeout(async () => {
                    try {
                         this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
                         this.clearFields(false);
                         await this.updateXrpBalance(client, accountInfo, wallet);
                    } catch (err) {
                         console.error('Error in deferred UI updates:', err);
                         // Don't break main flow — account details are already rendered
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

     async enableTransaction1() {
          const client = await this.xrplService.getClient();
          const wallet = await this.getWallet();

          if (this.selectedTransaction === 'sendXrp') {
               this.createSendXrpRequestText(client, wallet);
          } else if (this.selectedTransaction === 'setTrustline' || this.selectedTransaction === 'removeTrustline') {
               this.modifyTrustlineRequestText(client, wallet);
          } else if (this.selectedTransaction === 'accountFlagSet' || this.selectedTransaction === 'accountFlagClear') {
               this.modifyAccountFlagsRequestText(client, wallet);
          }
          this.cdr.detectChanges();
     }

     async enableTransaction() {
          const client = await this.xrplService.getClient();
          const wallet = await this.getWallet();

          switch (this.selectedTransaction) {
               case 'sendXrp':
                    await this.createSendXrpRequestText(client, wallet);
                    break;
               case 'setTrustline':
                    await this.modifyTrustlineRequestText(client, wallet);
                    break;
               case 'accountFlagSet':
                    await this.modifyAccountFlagsRequestText(client, wallet);
                    break;
               // add others as needed
               default:
                    console.warn(`Unknown transaction type: ${this.selectedTransaction}`);
          }

          this.cdr.detectChanges();
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

     // async signedTransaction1() {
     //      const startTime = Date.now();
     //      this.setSuccessProperties();

     //      try {
     //           const wallet = await this.getWallet();
     //           if (!this.resultField.nativeElement.innerText.trim()) return this.setError('Transaction cannot be empty');

     //           const editedJson = JSON.parse(this.resultField.nativeElement.innerText.trim());
     //           const txToSign = this.cleanTx(editedJson);

     //           // Adjust LastLedgerSequence to avoid tefMAX_LEDGER
     //           const client = await this.xrplService.getClient();
     //           const currentLedger = await client.getLedgerIndex();
     //           txToSign.LastLedgerSequence = currentLedger + 1000;

     //           if (this.useMultiSign && this.signers.length > 0) {
     //                // Step 1: Each signer signs tx using signAs
     //                this.multiSignedBlobs = this.signers.map(signer => {
     //                     const sWallet = xrpl.Wallet.fromSeed(signer.seed);
     //                     const partial = sWallet.sign(txToSign, signer.account);
     //                     return partial.tx_blob;
     //                });

     //                // Step 2: Combine signatures into a single multi-signed tx blob
     //                const signatures = this.signers.map((s, idx) => ({
     //                     signingAccount: s.account,
     //                     txnSignature: xrpl.decode(this.multiSignedBlobs[idx])['TxnSignature'],
     //                }));

     //                const combinedTx = {
     //                     ...txToSign,
     //                     Signers: this.multiSignedBlobs.map(blob => {
     //                          const decoded = xrpl.decode(blob);
     //                          return { Signer: decoded };
     //                     }),
     //                };

     //                // Step 3: Render in hashField
     //                this.multiSignedHtml = `
     //            <b>Partial Signatures:</b><br>
     //            ${this.multiSignedBlobs.map((b, i) => `Signer ${i + 1}:<br><pre>${b}</pre>`).join('<br>')}
     //            <br><b>Combined Multi-Signed TX Blob:</b><br>
     //            <pre>${this.combinedTxBlob}</pre>
     //        `;
     //           } else {
     //                // Single-signer
     //                const signed = wallet.sign(txToSign);
     //                this.multiSignedHtml = `
     //            <b>Signed TX Blob:</b><br>
     //            <pre>${signed.tx_blob}</pre>
     //            <br><b>Transaction ID (hash):</b><br>${signed.hash}
     //        `;
     //                this.combinedTxBlob = signed.tx_blob;
     //           }
     //      } catch (err: any) {
     //           console.error('Error in signedTransaction:', err);
     //           this.setError(`ERROR: ${err.message || 'Unknown error'}`);
     //      } finally {
     //           this.spinner = false;
     //           this.executionTime = (Date.now() - startTime).toString();
     //      }
     // }

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

     // async submitTransaction1() {
     //      if (!this.combinedTxBlob) return this.setError('No signed transaction available');

     //      const client = await this.xrplService.getClient();

     //      try {
     //           const response = await client.submitAndWait(this.combinedTxBlob);
     //           const isSuccess = this.utilsService.isTxSuccessful(response);

     //           if (!isSuccess) {
     //                const resultMsg = this.utilsService.getTransactionResultMessage(response);
     //                console.error('Transaction failed:', resultMsg, response);
     //           }

     //           this.renderTransactionResult(response);
     //      } catch (err: any) {
     //           console.error('Error submitting transaction:', err);
     //           this.setError(err.message || 'Unknown error submitting transaction');
     //      }
     // }

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

                    // Render result
                    this.renderTransactionResult(response);
                    this.txJson = this.resultField.nativeElement.textContent || ''; // Sync plain JSON after render

                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.txJson, null);

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
               console.error('Error in submitTransaction:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`, null);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving submitTransaction in ${this.executionTime}ms`);
          }
     }

     async createSendXrpRequestText(client: xrpl.Client, wallet: xrpl.Wallet) {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let xrpPaymentRequest: any = {
               TransactionType: 'Payment',
               Account: wallet.classicAddress,
               Destination: 'rB59o63jhXxHU9RHDMUq2bypc8pW4m5f6s',
               Amount: '1000000', // 1 XRP in drops
               Fee: '10',
               LastLedgerSequence: currentLedger,
               Sequence: accountInfo.result.account_data.Sequence,
               DestinationTag: 0,
               SourceTag: 0,
               InvoiceID: 0,
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
               ],
          };

          // If using a Ticket
          if (this.isTicketEnabled && this.ticketSequence) {
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence));

               if (!ticketExists) {
                    return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`, null);
               }

               // Overwrite fields for ticketed tx
               xrpPaymentRequest.TicketSequence = Number(this.ticketSequence);
               xrpPaymentRequest.Sequence = 0;
          }

          const txString = JSON.stringify(xrpPaymentRequest, null, 2);
          this.txJson = txString; // Set property instead of DOM
     }

     async modifyTrustlineRequestText(client: xrpl.Client, wallet: xrpl.Wallet) {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let modifyTrustlineRequest: any = {
               TransactionType: 'TrustSet',
               Account: wallet.classicAddress,
               Destination: 'rB59o63jhXxHU9RHDMUq2bypc8pW4m5f6s',
               Fee: '10',
               QualityIn: 0,
               QualityOut: 0,
               Flags: 0,
               LastLedgerSequence: currentLedger,
               Sequence: accountInfo.result.account_data.Sequence,
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
               ],
          };

          if (this.selectedTransaction === 'setTrustline') {
               modifyTrustlineRequest.LimitAmount = {
                    currency: 'CTZ',
                    issuer: 'rsP3mgGb2tcYUrxiLFiHJiQXhsziegtwBc',
                    value: '100',
               };
          } else {
               modifyTrustlineRequest.LimitAmount = {
                    currency: 'CTZ',
                    issuer: 'rsP3mgGb2tcYUrxiLFiHJiQXhsziegtwBc',
                    value: '0',
               };
          }

          if (this.isTicketEnabled && this.ticketSequence) {
               // If using a Ticket
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence));

               if (!ticketExists) {
                    return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`, null);
               }

               // Overwrite fields for ticketed tx
               modifyTrustlineRequest.TicketSequence = Number(this.ticketSequence);
               modifyTrustlineRequest.Sequence = 0;
          }

          const txString = JSON.stringify(modifyTrustlineRequest, null, 2);
          this.txJson = txString; // Set property instead of DOM
     }

     async modifyAccountFlagsRequestText(client: xrpl.Client, wallet: xrpl.Wallet) {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let modifyAccountSetRequest: any = {
               TransactionType: 'AccountSet',
               Account: wallet.classicAddress,
               Fee: '10',
               Flags: 0,
               LastLedgerSequence: currentLedger,
               Sequence: accountInfo.result.account_data.Sequence,
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
               ],
          };

          if (this.selectedTransaction === 'accountFlagSet') {
               modifyAccountSetRequest.SetFlag = 0;
          } else {
               modifyAccountSetRequest.ClearFlag = 1;
          }

          if (this.isTicketEnabled && this.ticketSequence) {
               // If using a Ticket
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence));

               if (!ticketExists) {
                    return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`, null);
               }

               // Overwrite fields for ticketed tx
               modifyAccountSetRequest.TicketSequence = Number(this.ticketSequence);
               modifyAccountSetRequest.Sequence = 0;
          }

          const txString = JSON.stringify(modifyAccountSetRequest, null, 2);
          this.txJson = txString; // Set property instead of DOM
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
          this.account1.balance = balance.toString();
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
                    this.setError('Invalid XRP address', null);
               }
          } catch (error: any) {
               this.setError(`Error fetching account details: ${error.message}`, null);
          }
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
                    required: ['selectedAccount', 'seed'],
                    customValidators: [() => isValidSeed(inputs.seed), () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null)],
                    asyncValidators: [],
               },
               sendXrp: {
                    required: ['selectedAccount', 'seed', 'amount', 'destination'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.amount, 'XRP Amount', 0),
                         () => isValidXrpAddress(inputs.destination, 'Destination'),
                         () => isValidNumber(inputs.sourceTag, 'Source Tag', 0, true),
                         () => isValidNumber(inputs.destinationTag, 'Destination Tag', 0, true),
                         () => isValidNumber(inputs.ticketSequence, 'Ticket', 0, true),
                         () => isValidInvoiceId(inputs.invoiceId),
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

          if (inputs.selectedAccount === undefined || inputs.selectedAccount === null) {
               errors.push('Please select an account');
          }

          return errors;
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
          this.cdr.detectChanges();
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
          this.cdr.detectChanges();
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
          this.cdr.detectChanges();
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
          this.cdr.detectChanges();
     }
}
// import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
// import { MatSortModule } from '@angular/material/sort';
// import { MatPaginatorModule } from '@angular/material/paginator';
// import { MatInputModule } from '@angular/material/input';
// import { MatFormFieldModule } from '@angular/material/form-field';
// import { MatTableModule } from '@angular/material/table';
// import { MatAutocompleteModule } from '@angular/material/autocomplete';
// import { CommonModule } from '@angular/common';
// import { FormsModule, NgForm } from '@angular/forms';
// import { XrplService } from '../../services/xrpl.service';
// import { UtilsService } from '../../services/utils.service';
// import { StorageService } from '../../services/storage.service';
// import * as xrpl from 'xrpl';
// import { NavbarComponent } from '../navbar/navbar.component';
// import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
// import { AppConstants } from '../../core/app.constants';
// import { WalletMultiInputComponent } from '../wallet-multi-input/wallet-multi-input.component';
// import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';
// import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';

// interface ValidationInputs {
//      selectedAccount?: 'account1' | 'account2' | 'issuer' | null;
//      senderAddress?: string;
//      account_info?: any;
//      seed?: string;
//      amount?: string;
//      destination?: string;
//      destinationTag?: string;
//      sourceTag?: string;
//      invoiceId?: string;
//      isRegularKeyAddress?: boolean;
//      regularKeyAddress?: string;
//      regularKeySeed?: string;
//      useMultiSign?: boolean;
//      multiSignSeeds?: string;
//      multiSignAddresses?: string;
//      isTicket?: boolean;
//      ticketSequence?: string;
//      signerQuorum?: number;
//      signers?: { account: string; weight: number }[];
// }

// interface SignerEntry {
//      Account: string;
//      SignerWeight: number;
//      SingnerSeed: string;
// }

// interface SignerEntry {
//      account: string;
//      seed: string;
//      weight: number;
// }

// @Component({
//      selector: 'app-sign-transactions',
//      standalone: true,
//      imports: [CommonModule, FormsModule, WalletMultiInputComponent, NavbarComponent, SanitizeHtmlPipe, MatAutocompleteModule, MatTableModule, MatSortModule, MatPaginatorModule, MatInputModule, MatFormFieldModule],
//      templateUrl: './sign-transactions.component.html',
//      styleUrl: './sign-transactions.component.css',
// })
// export class SignTransactionsComponent implements AfterViewChecked {
//      @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
//      @ViewChild('resultFieldError') resultFieldError!: ElementRef<HTMLDivElement>;
//      @ViewChild('hashField') hashField!: ElementRef<HTMLDivElement>;
//      @ViewChild('accountForm') accountForm!: NgForm;
//      selectedAccount: 'account1' | 'account2' | 'issuer' | null = 'account1';
//      private lastResult: string = '';
//      transactionInput: string = '';
//      result: string = '';
//      isError: boolean = false;
//      isSuccess: boolean = false;
//      isEditable: boolean = false;
//      account1 = { name: '', address: '', seed: '', secretNumbers: '', mnemonic: '', balance: '' };
//      account2 = { name: '', address: '', seed: '', secretNumbers: '', mnemonic: '', balance: '' };
//      issuer = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '0' };
//      ownerCount: string = '';
//      totalXrpReserves: string = '';
//      executionTime: string = '';
//      amountField: string = '';
//      destinationTagField: string = '';
//      sourceTagField: string = '';
//      invoiceIdField: string = '';
//      ticketSequence: string = '';
//      memoField: string = '';
//      isMemoEnabled: boolean = false;
//      isInvoiceIdEnabled: boolean = false;
//      isMultiSignTransaction: boolean = false;
//      isTicketEnabled: boolean = false;
//      multiSignAddress: string = '';
//      multiSignSeeds: string = '';
//      signerQuorum: number = 0;
//      isOnlySignTransactionEnabled: boolean = false;
//      isSubmitSignedTransactionEnabled: boolean = false;
//      signedTransactionField: string = '';
//      submittedTxField: string = '';
//      spinner: boolean = false;
//      useMultiSign: boolean = false;
//      multiSigningEnabled: boolean = false;
//      regularKeySigningEnabled: boolean = false;
//      isRegularKeyAddress: boolean = false;
//      regularKeySeed: string = '';
//      regularKeyAddress: string = '';
//      isTicket: boolean = false;
//      spinnerMessage: string = '';
//      masterKeyDisabled: boolean = false;
//      isSimulateEnabled: boolean = false;
//      destinationFields: string = '';
//      private knownDestinations: { [key: string]: string } = {};
//      destinations: string[] = [];
//      signers: { account: string; seed: string; weight: number }[] = [{ account: '', seed: '', weight: 1 }];

//      errorMessage: string | null = null;
//      selectedTransaction: string | null = null;
//      editedTxJson: any = {};
//      isSendXrpEnabled: boolean = false;
//      isSetTrustlineEnabled: boolean = false;
//      isRemoveTrustlineEnabled: boolean = false;
//      isAccountFlagEnabled: boolean = false;
//      multiSignedBlobs: string[] = []; // store partial multi-signed blobs
//      combinedTxBlob: string = ''; // store combined tx blob for submission
//      multiSignedHtml: string = '';
//      transactionTypes = [
//           { value: 'Payment', label: 'Send XRP', description: 'Transfer XRP between accounts', icon: '💸' },
//           { value: 'TrustSet', label: 'Trustline', description: 'Add or modify a trustline', icon: '🤝' },
//           { value: 'OfferCreate', label: 'Offer', description: 'Create an order on the DEX', icon: '📈' },
//           { value: 'NFTokenMint', label: 'Mint NFT', description: 'Create a new NFT on XRPL', icon: '🖼️' },
//           { value: 'NFTokenBurn', label: 'Burn NFT', description: 'Destroy an existing NFT', icon: '🔥' },
//           { value: 'EscrowCreate', label: 'Escrow', description: 'Lock XRP until conditions are met', icon: '⏳' },
//           { value: 'CheckCreate', label: 'Check', description: 'Create a deferred payment check', icon: '✅' },
//           { value: 'AccountSet', label: 'Account Flags', description: 'Configure account settings', icon: '⚙️' },
//           // ➕ Add more as needed
//      ];

//      constructor(private readonly xrplService: XrplService, private readonly utilsService: UtilsService, private readonly cdr: ChangeDetectorRef, private readonly storageService: StorageService, private readonly xrplTransactions: XrplTransactionService, private readonly renderUiComponentsService: RenderUiComponentsService) {}

//      ngOnInit() {}

//      async ngAfterViewInit() {
//           try {
//                const wallet = await this.getWallet();
//                this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
//                this.updateDestinations();
//           } catch (error: any) {
//                console.error(`No wallet could be created or is undefined ${error.message}`);
//                return this.setError('ERROR: Wallet could not be created or is undefined', null);
//           } finally {
//                this.cdr.detectChanges();
//           }
//      }

//      ngAfterViewChecked() {}

//      onWalletInputChange(event: { account1: any; account2: any; issuer: any }) {
//           this.account1 = { ...event.account1, balance: '0' };
//           this.account2 = { ...event.account2, balance: '0' };
//           this.issuer = { ...event.issuer, balance: '0' };
//           this.onAccountChange();
//      }

//      handleTransactionResult(event: { result: string; isError: boolean; isSuccess: boolean }, tx: any) {
//           if (event.isError) {
//                if (tx) {
//                     const jsonObj = { ...tx, error: event.result };
//                     this.result = JSON.stringify(jsonObj, null, 2);
//                }
//                this.isError = true;
//                this.errorMessage = event.result; // still for red text
//           } else {
//                this.result = event.result;
//           }
//           this.isError = event.isError;
//           this.isSuccess = event.isSuccess;
//           this.isEditable = !this.isSuccess;
//           this.cdr.detectChanges();
//      }

//      onAccountChange() {
//           const accountHandlers: Record<string, () => void> = {
//                account1: () => this.displayDataForAccount1(),
//                account2: () => this.displayDataForAccount2(),
//                issuer: () => this.displayDataForAccount3(),
//           };
//           (accountHandlers[this.selectedAccount ?? 'issuer'] || accountHandlers['issuer'])();
//      }

//      validateQuorum() {
//           const totalWeight = this.signers.reduce((sum, s) => sum + (s.weight || 0), 0);
//           if (this.signerQuorum > totalWeight) {
//                this.signerQuorum = totalWeight;
//           }
//           this.cdr.detectChanges();
//      }

//      async toggleMultiSign() {
//           try {
//                if (!this.useMultiSign) {
//                     this.utilsService.clearSignerList(this.signers);
//                } else {
//                     const wallet = await this.getWallet();
//                     this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
//                }
//           } catch (error: any) {
//                console.error(`No wallet could be created or is undefined ${error.message}`);
//                return this.setError('ERROR: Wallet could not be created or is undefined', null);
//           } finally {
//                this.cdr.detectChanges();
//           }
//      }

//      async toggleUseMultiSign() {
//           if (this.multiSignAddress === 'No Multi-Sign address configured for account') {
//                this.multiSignSeeds = '';
//           }
//           this.cdr.detectChanges();
//      }

//      toggleTicketSequence() {
//           if (!this.isTicketEnabled) {
//                this.enableTransaction();
//           }
//           this.cdr.detectChanges();
//      }

//      // onResultFieldChange() {
//      //      try {
//      //           const text = this.resultField.nativeElement.innerText; // or innerText if you want plain text
//      //           this.editedTxJson = JSON.parse(text);
//      //      } catch (err) {
//      //           console.warn('Invalid JSON in resultField, cannot parse yet');
//      //           this.editedTxJson = null;
//      //      }
//      // }

//      selectTransaction(value: string) {
//           this.selectedTransaction = value;
//           console.log('Selected transaction:', value);
//           // 👉 You can trigger form changes, show relevant inputs, etc.
//      }

//      setTransaction1(type: string, event: Event) {
//           const checked = (event.target as HTMLInputElement).checked;

//           if (checked) {
//                this.selectedTransaction = type; // turn this one on
//                this.resultFieldError.nativeElement.innerText = '';
//                this.enableTransaction();
//           } else {
//                this.selectedTransaction = null; // allow all off if you want
//                this.resultFieldError.nativeElement.innerText = '';
//                this.resultField.nativeElement.innerText = '';
//                this.hashField.nativeElement.innerText = '';
//           }
//      }

//      setTransaction(type: string, event: Event) {
//           const checked = (event.target as HTMLInputElement).checked;

//           if (checked) {
//                this.selectedTransaction = type;
//                this.result = '';
//                this.isError = false;
//                this.errorMessage = null;
//                this.enableTransaction();
//           } else {
//                this.selectedTransaction = null; // 👈 removes the whole block
//                this.result = '';
//                this.isError = false;
//                this.errorMessage = null;
//           }
//      }

//      async getAccountDetails() {
//           console.log('Entering getAccountDetails');
//           const startTime = Date.now();
//           this.setSuccessProperties();

//           let inputs: ValidationInputs = {
//                selectedAccount: this.selectedAccount,
//                seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount || '', this.account1, this.account2, this.issuer),
//           };

//           try {
//                this.showSpinnerWithDelay('Getting Account Details ...', 100);

//                // Phase 1: Get client + wallet
//                const client = await this.xrplService.getClient();
//                const wallet = await this.getWallet();

//                // Phase 2: Fetch account info + objects in PARALLEL
//                const [accountInfo, accountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);

//                inputs = {
//                     ...inputs,
//                     account_info: accountInfo,
//                };

//                const errors = await this.validateInputs(inputs, 'getAccountDetails');
//                if (errors.length > 0) {
//                     return this.setError(`ERROR: ${errors.join('; ')}`, null);
//                }

//                this.refreshUiAccountObjects(accountObjects, accountInfo, wallet);
//                this.refreshUiAccountInfo(accountInfo);

//                // DEFER: Non-critical UI updates — let main render complete first
//                setTimeout(async () => {
//                     try {
//                          this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
//                          this.clearFields(false);
//                          await this.updateXrpBalance(client, accountInfo, wallet);
//                     } catch (err) {
//                          console.error('Error in deferred UI updates:', err);
//                          // Don't break main flow — account details are already rendered
//                     }
//                }, 0);
//           } catch (error: any) {
//                console.error('Error in getAccountDetails:', error);
//                this.setError(error.message || 'Unknown error', null);
//           } finally {
//                this.spinner = false;
//                this.executionTime = (Date.now() - startTime).toString();
//                console.log(`Leaving getAccountDetails in ${this.executionTime}ms`);
//           }
//      }

//      async enableTransaction1() {
//           const client = await this.xrplService.getClient();
//           const wallet = await this.getWallet();

//           if (this.selectedTransaction === 'sendXrp') {
//                this.createSendXrpRequestText(client, wallet);
//           } else if (this.selectedTransaction === 'setTrustline' || this.selectedTransaction === 'removeTrustline') {
//                this.modifyTrustlineRequestText(client, wallet);
//           } else if (this.selectedTransaction === 'accountFlagSet' || this.selectedTransaction === 'accountFlagClear') {
//                this.modifyAccountFlagsRequestText(client, wallet);
//           }
//           this.cdr.detectChanges();
//      }

//      async enableTransaction() {
//           const client = await this.xrplService.getClient();
//           const wallet = await this.getWallet();

//           switch (this.selectedTransaction) {
//                case 'sendXrp':
//                     this.createSendXrpRequestText(client, wallet);
//                     break;
//                case 'setTrustline':
//                     this.modifyTrustlineRequestText(client, wallet);
//                     break;
//                case 'accountFlagSet':
//                     this.modifyAccountFlagsRequestText(client, wallet);
//                     break;
//                // add others as needed
//                default:
//                     console.warn(`Unknown transaction type: ${this.selectedTransaction}`);
//           }

//           this.cdr.detectChanges();
//      }

//      async unsignedTransaction() {
//           console.log('Entering unsignedTransaction');
//           const startTime = Date.now();
//           this.setSuccessProperties();

//           try {
//                this.resultFieldError.nativeElement.innerHTML = '';
//                const mode = this.isSimulateEnabled ? 'simulating' : 'sending';
//                this.updateSpinnerMessage(`Preparing Unsigned Transaction (${mode})...`);

//                if (!this.resultField.nativeElement.innerText.trim()) return this.setError('Transaction cannot be empty', null);

//                const editedString = this.resultField.nativeElement.innerText.trim();
//                let editedJson = JSON.parse(editedString);
//                let cleanedJson = this.cleanTx(editedJson);
//                console.log('Edited JSON:', editedJson);
//                console.log('Cleaned JSON:', cleanedJson);

//                const serialized = xrpl.encode(cleanedJson);
//                const unsignedHash = xrpl.hashes.hashTx(serialized);
//                console.log('Unsigned Transaction hash (hex):', unsignedHash);

//                this.hashField.nativeElement.innerText = unsignedHash;
//           } catch (error: any) {
//                console.error('Error in unsignedTransaction:', error);
//                this.setError(`ERROR: ${error.message || 'Unknown error'}`, null);
//           } finally {
//                this.spinner = false;
//                this.executionTime = (Date.now() - startTime).toString();
//                console.log(`Leaving unsignedTransaction in ${this.executionTime}ms`);
//           }
//      }

//      // async signedTransaction1() {
//      //      const startTime = Date.now();
//      //      this.setSuccessProperties();

//      //      try {
//      //           const wallet = await this.getWallet();
//      //           if (!this.resultField.nativeElement.innerText.trim()) return this.setError('Transaction cannot be empty');

//      //           const editedJson = JSON.parse(this.resultField.nativeElement.innerText.trim());
//      //           const txToSign = this.cleanTx(editedJson);

//      //           // Adjust LastLedgerSequence to avoid tefMAX_LEDGER
//      //           const client = await this.xrplService.getClient();
//      //           const currentLedger = await client.getLedgerIndex();
//      //           txToSign.LastLedgerSequence = currentLedger + 1000;

//      //           if (this.useMultiSign && this.signers.length > 0) {
//      //                // Step 1: Each signer signs tx using signAs
//      //                this.multiSignedBlobs = this.signers.map(signer => {
//      //                     const sWallet = xrpl.Wallet.fromSeed(signer.seed);
//      //                     const partial = sWallet.sign(txToSign, signer.account);
//      //                     return partial.tx_blob;
//      //                });

//      //                // Step 2: Combine signatures into a single multi-signed tx blob
//      //                const signatures = this.signers.map((s, idx) => ({
//      //                     signingAccount: s.account,
//      //                     txnSignature: xrpl.decode(this.multiSignedBlobs[idx])['TxnSignature'],
//      //                }));

//      //                const combinedTx = {
//      //                     ...txToSign,
//      //                     Signers: this.multiSignedBlobs.map(blob => {
//      //                          const decoded = xrpl.decode(blob);
//      //                          return { Signer: decoded };
//      //                     }),
//      //                };

//      //                // Step 3: Render in hashField
//      //                this.multiSignedHtml = `
//      //            <b>Partial Signatures:</b><br>
//      //            ${this.multiSignedBlobs.map((b, i) => `Signer ${i + 1}:<br><pre>${b}</pre>`).join('<br>')}
//      //            <br><b>Combined Multi-Signed TX Blob:</b><br>
//      //            <pre>${this.combinedTxBlob}</pre>
//      //        `;
//      //           } else {
//      //                // Single-signer
//      //                const signed = wallet.sign(txToSign);
//      //                this.multiSignedHtml = `
//      //            <b>Signed TX Blob:</b><br>
//      //            <pre>${signed.tx_blob}</pre>
//      //            <br><b>Transaction ID (hash):</b><br>${signed.hash}
//      //        `;
//      //                this.combinedTxBlob = signed.tx_blob;
//      //           }
//      //      } catch (err: any) {
//      //           console.error('Error in signedTransaction:', err);
//      //           this.setError(`ERROR: ${err.message || 'Unknown error'}`);
//      //      } finally {
//      //           this.spinner = false;
//      //           this.executionTime = (Date.now() - startTime).toString();
//      //      }
//      // }

//      async signedTransaction() {
//           console.log('Entering signedTransaction');
//           const startTime = Date.now();
//           this.setSuccessProperties();

//           let txToSign;

//           try {
//                const mode = this.isSimulateEnabled ? 'simulating' : 'sending';
//                this.updateSpinnerMessage(`Preparing Signed Transaction (${mode})...`);

//                const wallet = await this.getWallet();

//                if (!this.resultField.nativeElement.innerText.trim()) {
//                     return this.setError('Transaction cannot be empty', null);
//                }

//                const editedString = this.resultField.nativeElement.innerText.trim();
//                let editedJson = JSON.parse(editedString);
//                txToSign = this.cleanTx(editedJson);
//                console.log('Pre txToSign', txToSign);

//                const client = await this.xrplService.getClient();
//                const currentLedger = await client.getLedgerIndex();
//                console.log('currentLedger: ', currentLedger);
//                if (this.isSimulateEnabled) {
//                     txToSign.LastLedgerSequence = currentLedger;
//                } else {
//                     txToSign.LastLedgerSequence = currentLedger + 1000; // adjust to new ledger
//                }

//                console.log('Post txToSign', txToSign);

//                const signed = wallet.sign(txToSign);
//                // Use tx_blob instead of signedTransaction
//                this.hashField.nativeElement.innerText = signed.tx_blob;

//                console.log('Signed TX blob:', signed.tx_blob);
//                console.log('Transaction ID (hash):', signed.hash);

//                // decode blob to JSON
//                const decodedTx = xrpl.decode(signed.tx_blob);
//                console.log(decodedTx);
//           } catch (error: any) {
//                console.error('Error in signedTransaction:', error);
//                this.setError(`ERROR: ${error.message || 'Unknown error'}`, txToSign);
//           } finally {
//                this.spinner = false;
//                this.executionTime = (Date.now() - startTime).toString();
//                console.log(`Leaving signedTransaction in ${this.executionTime}ms`);
//           }
//      }

//      // async submitTransaction1() {
//      //      if (!this.combinedTxBlob) return this.setError('No signed transaction available');

//      //      const client = await this.xrplService.getClient();

//      //      try {
//      //           const response = await client.submitAndWait(this.combinedTxBlob);
//      //           const isSuccess = this.utilsService.isTxSuccessful(response);

//      //           if (!isSuccess) {
//      //                const resultMsg = this.utilsService.getTransactionResultMessage(response);
//      //                console.error('Transaction failed:', resultMsg, response);
//      //           }

//      //           this.renderTransactionResult(response);
//      //      } catch (err: any) {
//      //           console.error('Error submitting transaction:', err);
//      //           this.setError(err.message || 'Unknown error submitting transaction');
//      //      }
//      // }

//      async submitTransaction() {
//           console.log('Entering submitTransaction');
//           const startTime = Date.now();
//           this.setSuccessProperties();

//           try {
//                const mode = this.isSimulateEnabled ? 'simulating' : 'sending';
//                this.updateSpinnerMessage(`Preparing Signed Transaction Submit (${mode})...`);

//                const client = await this.xrplService.getClient();
//                const wallet = await this.getWallet();

//                this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Sending XRP (no funds will be moved)...' : 'Submitting to Ledger...');

//                if (!this.hashField.nativeElement.innerText.trim()) return this.setError('Signed tx blob can not be empty', null);
//                const signedTxBlob = this.hashField.nativeElement.innerText.trim();

//                const currentLedger = await client.getLedgerIndex();
//                console.log('currentLedger: ', currentLedger);

//                if (this.isSimulateEnabled) {
//                     const txToSign = this.cleanTx(JSON.parse(this.resultField.nativeElement.innerText.trim()));
//                     console.log('Pre txToSign', txToSign);
//                     const simulation = await this.xrplTransactions.simulateTransaction(client, txToSign);

//                     const isSuccess = this.utilsService.isTxSuccessful(simulation);
//                     if (!isSuccess) {
//                          const resultMsg = this.utilsService.getTransactionResultMessage(simulation);
//                          let userMessage = 'Transaction failed.\n';
//                          userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

//                          (simulation['result'] as any).errorMessage = userMessage;
//                          console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, simulation);
//                     }

//                     // Render result
//                     this.renderTransactionResult(simulation);

//                     this.resultField.nativeElement.classList.add('success');
//                     this.setSuccess(this.result, null);
//                } else {
//                     const response = await client.submitAndWait(signedTxBlob);

//                     const isSuccess = this.utilsService.isTxSuccessful(response);
//                     if (!isSuccess) {
//                          const resultMsg = this.utilsService.getTransactionResultMessage(response);
//                          let userMessage = 'Transaction failed.\n';
//                          userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

//                          (response.result as any).errorMessage = userMessage;
//                          console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
//                     }

//                     // Render result
//                     this.renderTransactionResult(response);

//                     this.resultField.nativeElement.classList.add('success');
//                     this.setSuccess(this.result, null);

//                     // PARALLELIZE
//                     const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
//                     this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

//                     //DEFER: Non-critical UI updates (skip for simulation)
//                     setTimeout(async () => {
//                          try {
//                               this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
//                               this.clearFields(false);
//                               await this.updateXrpBalance(client, updatedAccountInfo, wallet);
//                          } catch (err) {
//                               console.error('Error in post-tx cleanup:', err);
//                          }
//                     }, 0);
//                }
//           } catch (error: any) {
//                console.error('Error in submitTransaction:', error);
//                this.setError(`ERROR: ${error.message || 'Unknown error'}`, null);
//           } finally {
//                this.spinner = false;
//                this.executionTime = (Date.now() - startTime).toString();
//                console.log(`Leaving submitTransaction in ${this.executionTime}ms`);
//           }
//      }

//      async createSendXrpRequestText(client: xrpl.Client, wallet: xrpl.Wallet) {
//           const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

//           let xrpPaymentRequest: any = {
//                TransactionType: 'Payment',
//                Account: wallet.classicAddress,
//                Destination: 'rB59o63jhXxHU9RHDMUq2bypc8pW4m5f6s',
//                Amount: '1000000', // 1 XRP in drops
//                Fee: '10',
//                LastLedgerSequence: currentLedger,
//                Sequence: accountInfo.result.account_data.Sequence,
//                DestinationTag: 0,
//                SourceTag: 0,
//                InvoiceID: 0,
//                Memos: [
//                     {
//                          Memo: {
//                               MemoData: '',
//                               MemoType: '',
//                          },
//                     },
//                     {
//                          Memo: {
//                               MemoData: '',
//                               MemoType: '',
//                          },
//                     },
//                ],
//           };

//           // If using a Ticket
//           if (this.isTicketEnabled && this.ticketSequence) {
//                const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence));

//                if (!ticketExists) {
//                     return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`, null);
//                }

//                // Overwrite fields for ticketed tx
//                xrpPaymentRequest.TicketSequence = Number(this.ticketSequence);
//                xrpPaymentRequest.Sequence = 0;
//           }

//           const txString = JSON.stringify(xrpPaymentRequest, null, 2);
//           this.resultField.nativeElement.innerText = `${txString}`;
//      }

//      async modifyTrustlineRequestText(client: xrpl.Client, wallet: xrpl.Wallet) {
//           const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

//           let modifyTrustlineRequest: any = {
//                TransactionType: 'TrustSet',
//                Account: wallet.classicAddress,
//                Destination: 'rB59o63jhXxHU9RHDMUq2bypc8pW4m5f6s',
//                Fee: '10',
//                QualityIn: 0,
//                QualityOut: 0,
//                Flags: 0,
//                LastLedgerSequence: currentLedger,
//                Sequence: accountInfo.result.account_data.Sequence,
//                Memos: [
//                     {
//                          Memo: {
//                               MemoData: '',
//                               MemoType: '',
//                          },
//                     },
//                     {
//                          Memo: {
//                               MemoData: '',
//                               MemoType: '',
//                          },
//                     },
//                ],
//           };

//           if (this.selectedTransaction === 'setTrustline') {
//                modifyTrustlineRequest.LimitAmount = {
//                     currency: 'CTZ',
//                     issuer: 'rsP3mgGb2tcYUrxiLFiHJiQXhsziegtwBc',
//                     value: '100',
//                };
//           } else {
//                modifyTrustlineRequest.LimitAmount = {
//                     currency: 'CTZ',
//                     issuer: 'rsP3mgGb2tcYUrxiLFiHJiQXhsziegtwBc',
//                     value: '0',
//                };
//           }

//           if (this.isTicketEnabled && this.ticketSequence) {
//                // If using a Ticket
//                const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence));

//                if (!ticketExists) {
//                     return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`, null);
//                }

//                // Overwrite fields for ticketed tx
//                modifyTrustlineRequest.TicketSequence = Number(this.ticketSequence);
//                modifyTrustlineRequest.Sequence = 0;
//           }

//           const txString = JSON.stringify(modifyTrustlineRequest, null, 2);
//           this.resultField.nativeElement.innerText = `${txString}`;
//      }

//      async modifyAccountFlagsRequestText(client: xrpl.Client, wallet: xrpl.Wallet) {
//           const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

//           let modifyAccountSetRequest: any = {
//                TransactionType: 'AccountSet',
//                Account: wallet.classicAddress,
//                Fee: '10',
//                Flags: 0,
//                LastLedgerSequence: currentLedger,
//                Sequence: accountInfo.result.account_data.Sequence,
//                Memos: [
//                     {
//                          Memo: {
//                               MemoData: '',
//                               MemoType: '',
//                          },
//                     },
//                     {
//                          Memo: {
//                               MemoData: '',
//                               MemoType: '',
//                          },
//                     },
//                ],
//           };

//           if (this.selectedTransaction === 'accountFlagSet') {
//                modifyAccountSetRequest.SetFlag = 0;
//           } else {
//                modifyAccountSetRequest.ClearFlag = 1;
//           }

//           if (this.isTicketEnabled && this.ticketSequence) {
//                // If using a Ticket
//                const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence));

//                if (!ticketExists) {
//                     return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`, null);
//                }

//                // Overwrite fields for ticketed tx
//                modifyAccountSetRequest.TicketSequence = Number(this.ticketSequence);
//                modifyAccountSetRequest.Sequence = 0;
//           }

//           const txString = JSON.stringify(modifyAccountSetRequest, null, 2);
//           this.resultField.nativeElement.innerText = `${txString}`;
//      }

//      cleanTx(editedJson: any) {
//           const defaults: Record<string, any[]> = {
//                DestinationTag: [0],
//                SourceTag: [0],
//                InvoiceID: [0, ''],
//           };

//           for (const field in defaults) {
//                if (editedJson.hasOwnProperty(field) && defaults[field].includes(editedJson[field])) {
//                     delete editedJson[field];
//                }
//           }

//           if (Array.isArray(editedJson.Memos)) {
//                editedJson.Memos = editedJson.Memos.filter((memoObj: any) => {
//                     const memo = memoObj?.Memo;
//                     if (!memo) return false;

//                     // Check if both fields are effectively empty
//                     const memoDataEmpty = !memo.MemoData || memo.MemoData === '' || memo.MemoData === 0;
//                     const memoTypeEmpty = !memo.MemoType || memo.MemoType === '' || memo.MemoType === 0;

//                     // Remove if both are empty
//                     return !(memoDataEmpty && memoTypeEmpty);
//                });

//                if (editedJson.Memos.length === 0) {
//                     delete editedJson.Memos;
//                } else {
//                     this.encodeMemo(editedJson);
//                }
//           }

//           if (typeof editedJson.Amount === 'string') {
//                editedJson.Amount = xrpl.xrpToDrops(editedJson.Amount);
//           }

//           if (this.isSimulateEnabled) {
//                delete editedJson.Sequence;
//           }

//           return editedJson;
//      }

//      populateTxDetails() {
//           if (!this.hashField.nativeElement.innerText.trim()) return;
//           const decodedTx = xrpl.decode(this.hashField.nativeElement.innerText.trim());
//           console.log(decodedTx);

//           // this.resultField.nativeElement.innerText = JSON.stringify(decodedTx, null, 3);
//           this.result = JSON.stringify(decodedTx, null, 3);
//      }

//      private encodeMemo(editedJson: any) {
//           editedJson.Memos = editedJson.Memos.map((memoObj: any) => {
//                // Ensure the structure is correct
//                if (!memoObj || !memoObj.Memo) {
//                     return memoObj; // Return as-is if structure is unexpected
//                }

//                const { MemoData, MemoType, MemoFormat, ...rest } = memoObj.Memo;

//                return {
//                     Memo: {
//                          ...rest,
//                          ...(MemoData && { MemoData: xrpl.convertStringToHex(MemoData) }),
//                          ...(MemoType && { MemoType: xrpl.convertStringToHex(MemoType) }),
//                          ...(MemoFormat && { MemoFormat: xrpl.convertStringToHex(MemoFormat) }),
//                     },
//                };
//           });
//      }

//      highlightJson(json: string): string {
//           if (!json) return '';
//           json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
//           return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, match => {
//                let cls = 'number';
//                if (/^"/.test(match)) {
//                     cls = /:$/.test(match) ? 'key' : 'string';
//                } else if (/true|false/.test(match)) {
//                     cls = 'boolean';
//                } else if (/null/.test(match)) {
//                     cls = 'null';
//                }
//                return `<span class="${cls}">${match}</span>`;
//           });
//      }

//      private refreshUIData(wallet: xrpl.Wallet, updatedAccountInfo: any, updatedAccountObjects: xrpl.AccountObjectsResponse) {
//           console.debug(`updatedAccountInfo for ${wallet.classicAddress}:`, updatedAccountInfo.result);
//           console.debug(`updatedAccountObjects for ${wallet.classicAddress}:`, updatedAccountObjects.result);

//           this.refreshUiAccountObjects(updatedAccountObjects, updatedAccountInfo, wallet);
//           this.refreshUiAccountInfo(updatedAccountInfo);
//      }

//      private checkForSignerAccounts(accountObjects: xrpl.AccountObjectsResponse) {
//           const signerAccounts: string[] = [];
//           if (accountObjects.result && Array.isArray(accountObjects.result.account_objects)) {
//                accountObjects.result.account_objects.forEach(obj => {
//                     if (obj.LedgerEntryType === 'SignerList' && Array.isArray(obj.SignerEntries)) {
//                          obj.SignerEntries.forEach((entry: any) => {
//                               if (entry.SignerEntry && entry.SignerEntry.Account) {
//                                    signerAccounts.push(entry.SignerEntry.Account + '~' + entry.SignerEntry.SignerWeight);
//                                    this.signerQuorum = obj.SignerQuorum;
//                               }
//                          });
//                     }
//                });
//           }
//           return signerAccounts;
//      }

//      private async updateXrpBalance(client: xrpl.Client, accountInfo: xrpl.AccountInfoResponse, wallet: xrpl.Wallet) {
//           const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, accountInfo, wallet.classicAddress);

//           this.ownerCount = ownerCount;
//           this.totalXrpReserves = totalXrpReserves;

//           const balance = (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0');
//           this.account1.balance = balance.toString();
//      }

//      private refreshUiAccountObjects(accountObjects: xrpl.AccountObjectsResponse, accountInfo: xrpl.AccountInfoResponse, wallet: xrpl.Wallet) {
//           const signerAccounts = this.checkForSignerAccounts(accountObjects);

//           if (signerAccounts?.length) {
//                const signerEntriesKey = `${wallet.classicAddress}signerEntries`;
//                const signerEntries: SignerEntry[] = this.storageService.get(signerEntriesKey) || [];

//                console.debug(`refreshUiAccountObjects:`, signerEntries);

//                this.multiSignAddress = signerEntries.map(e => e.Account).join(',\n');
//                this.multiSignSeeds = signerEntries.map(e => e.seed).join(',\n');
//           } else {
//                this.signerQuorum = 0;
//                this.multiSignAddress = 'No Multi-Sign address configured for account';
//                this.multiSignSeeds = '';
//                this.storageService.removeValue('signerEntries');
//           }

//           this.useMultiSign = false;
//           const isMasterKeyDisabled = accountInfo?.result?.account_flags?.disableMasterKey;
//           if (isMasterKeyDisabled) {
//                this.masterKeyDisabled = true;
//           } else {
//                this.masterKeyDisabled = false;
//           }

//           if (isMasterKeyDisabled && signerAccounts && signerAccounts.length > 0) {
//                this.useMultiSign = true; // Force to true if master key is disabled
//           } else {
//                this.useMultiSign = false;
//           }

//           if (signerAccounts && signerAccounts.length > 0) {
//                this.multiSigningEnabled = true;
//           } else {
//                this.multiSigningEnabled = false;
//           }
//      }

//      private refreshUiAccountInfo(accountInfo: xrpl.AccountInfoResponse) {
//           const regularKey = accountInfo?.result?.account_data?.RegularKey;
//           if (regularKey) {
//                this.regularKeyAddress = regularKey;
//                const regularKeySeedAccount = accountInfo.result.account_data.Account + 'regularKeySeed';
//                this.regularKeySeed = this.storageService.get(regularKeySeedAccount);
//           } else {
//                this.isRegularKeyAddress = false;
//                this.regularKeyAddress = 'No RegularKey configured for account';
//                this.regularKeySeed = '';
//           }

//           const isMasterKeyDisabled = accountInfo?.result?.account_flags?.disableMasterKey;
//           if (isMasterKeyDisabled) {
//                this.masterKeyDisabled = true;
//           } else {
//                this.masterKeyDisabled = false;
//           }

//           if (isMasterKeyDisabled && xrpl.isValidAddress(this.regularKeyAddress)) {
//                this.isRegularKeyAddress = true; // Force to true if master key is disabled
//           } else {
//                this.isRegularKeyAddress = false;
//           }

//           if (regularKey) {
//                this.regularKeySigningEnabled = true;
//           } else {
//                this.regularKeySigningEnabled = false;
//           }
//      }

//      private updateDestinations() {
//           const knownDestinationsTemp = this.utilsService.populateKnownDestinations(this.knownDestinations, this.account1.address, this.account2.address, this.issuer.address);
//           this.destinations = [...Object.values(knownDestinationsTemp)];
//           this.storageService.setKnownIssuers('destinations', knownDestinationsTemp);
//           this.destinationFields = this.issuer.address;
//      }

//      private async getWallet() {
//           const environment = this.xrplService.getNet().environment;
//           const seed = this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer);
//           const wallet = await this.utilsService.getWallet(seed, environment);
//           if (!wallet) {
//                throw new Error('ERROR: Wallet could not be created or is undefined');
//           }
//           return wallet;
//      }

//      private async displayDataForAccount(accountKey: 'account1' | 'account2' | 'issuer') {
//           const isIssuer = accountKey === 'issuer';
//           const prefix = isIssuer ? 'issuer' : accountKey;

//           // Define casing differences in keys
//           const formatKey = (key: string) => (isIssuer ? `${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}` : `${prefix}${key}`);

//           // Fetch stored values
//           const name = this.storageService.getInputValue(formatKey('name')) || AppConstants.EMPTY_STRING;
//           const address = this.storageService.getInputValue(formatKey('address')) || AppConstants.EMPTY_STRING;
//           const seed = this.storageService.getInputValue(formatKey('seed')) || this.storageService.getInputValue(formatKey('mnemonic')) || this.storageService.getInputValue(formatKey('secretNumbers')) || AppConstants.EMPTY_STRING;

//           // Update account object
//           const accountMap = {
//                account1: this.account1,
//                account2: this.account2,
//                issuer: this.issuer,
//           };
//           const account = accountMap[accountKey];
//           account.name = name;
//           account.address = address;
//           account.seed = seed;

//           // DOM manipulation (map field IDs instead of repeating)
//           const fieldMap: Record<'name' | 'address' | 'seed', string> = {
//                name: 'accountName1Field',
//                address: 'accountAddress1Field',
//                seed: 'accountSeed1Field',
//           };

//           (Object.entries(fieldMap) as [keyof typeof fieldMap, string][]).forEach(([key, id]) => {
//                const el = document.getElementById(id) as HTMLInputElement | null;
//                if (el) el.value = account[key];
//           });

//           this.cdr.detectChanges(); // sync with ngModel

//           // Fetch account details
//           try {
//                if (address && xrpl.isValidAddress(address)) {
//                     await this.getAccountDetails();
//                } else if (address) {
//                     this.setError('Invalid XRP address', null);
//                }
//           } catch (error: any) {
//                this.setError(`Error fetching account details: ${error.message}`, null);
//           }
//      }

//      private async validateInputs(inputs: ValidationInputs, action: string): Promise<string[]> {
//           const errors: string[] = [];

//           // --- Common validators ---
//           const isRequired = (value: string | null | undefined, fieldName: string): string | null => {
//                if (value == null || !this.utilsService.validateInput(value)) {
//                     return `${fieldName} cannot be empty`;
//                }
//                return null;
//           };

//           const isValidXrpAddress = (value: string | undefined, fieldName: string): string | null => {
//                if (value && !xrpl.isValidAddress(value)) {
//                     return `${fieldName} is invalid`;
//                }
//                return null;
//           };

//           const isValidSecret = (value: string | undefined, fieldName: string): string | null => {
//                if (value && !xrpl.isValidSecret(value)) {
//                     return `${fieldName} is invalid`;
//                }
//                return null;
//           };

//           const isValidNumber = (value: string | undefined, fieldName: string, minValue?: number, allowEmpty: boolean = false): string | null => {
//                if (value === undefined || (allowEmpty && value === '')) return null;
//                const num = parseFloat(value);
//                if (isNaN(num) || !isFinite(num)) {
//                     return `${fieldName} must be a valid number`;
//                }
//                if (minValue !== undefined && num <= minValue) {
//                     return `${fieldName} must be greater than ${minValue}`;
//                }
//                return null;
//           };

//           const isValidSeed = (value: string | undefined): string | null => {
//                if (value) {
//                     const { value: detectedValue } = this.utilsService.detectXrpInputType(value);
//                     if (detectedValue === 'unknown') {
//                          return 'Account seed is invalid';
//                     }
//                }
//                return null;
//           };

//           const isNotSelfPayment = (sender: string | undefined, receiver: string | undefined): string | null => {
//                if (sender && receiver && sender === receiver) {
//                     return `Sender and receiver cannot be the same`;
//                }
//                return null;
//           };

//           const isValidInvoiceId = (value: string | undefined): string | null => {
//                if (value && !this.utilsService.validateInput(value)) {
//                     return 'Invoice ID is invalid';
//                }
//                return null;
//           };

//           const validateMultiSign = (addressesStr: string | undefined, seedsStr: string | undefined): string | null => {
//                if (!addressesStr || !seedsStr) return null;
//                const addresses = this.utilsService.getMultiSignAddress(addressesStr);
//                const seeds = this.utilsService.getMultiSignSeeds(seedsStr);
//                if (addresses.length === 0) {
//                     return 'At least one signer address is required for multi-signing';
//                }
//                if (addresses.length !== seeds.length) {
//                     return 'Number of signer addresses must match number of signer seeds';
//                }
//                const invalidAddr = addresses.find((addr: string) => !xrpl.isValidAddress(addr));
//                if (invalidAddr) {
//                     return `Invalid signer address: ${invalidAddr}`;
//                }
//                return null;
//           };

//           // --- Async validator: check if destination account requires a destination tag ---
//           const checkDestinationTagRequirement = async (): Promise<string | null> => {
//                if (!inputs.destination) return null; // Skip if no destination provided
//                try {
//                     const client = await this.xrplService.getClient();
//                     const accountInfo = await this.xrplService.getAccountInfo(client, inputs.destination, 'validated', '');

//                     if (accountInfo.result.account_flags.requireDestinationTag && (!inputs.destinationTag || inputs.destinationTag.trim() === '')) {
//                          return `ERROR: Receiver requires a Destination Tag for payment`;
//                     }
//                } catch (err) {
//                     console.error('Failed to check destination tag requirement:', err);
//                     return `Could not validate destination account`;
//                }
//                return null;
//           };

//           // --- Action-specific config ---
//           const actionConfig: Record<
//                string,
//                {
//                     required: (keyof ValidationInputs)[];
//                     customValidators?: (() => string | null)[];
//                     asyncValidators?: (() => Promise<string | null>)[];
//                }
//           > = {
//                getAccountDetails: {
//                     required: ['selectedAccount', 'seed'],
//                     customValidators: [() => isValidSeed(inputs.seed), () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null)],
//                     asyncValidators: [],
//                },
//                sendXrp: {
//                     required: ['selectedAccount', 'seed', 'amount', 'destination'],
//                     customValidators: [
//                          () => isValidSeed(inputs.seed),
//                          () => isValidNumber(inputs.amount, 'XRP Amount', 0),
//                          () => isValidXrpAddress(inputs.destination, 'Destination'),
//                          () => isValidNumber(inputs.sourceTag, 'Source Tag', 0, true),
//                          () => isValidNumber(inputs.destinationTag, 'Destination Tag', 0, true),
//                          () => isValidNumber(inputs.ticketSequence, 'Ticket', 0, true),
//                          () => isValidInvoiceId(inputs.invoiceId),
//                          () => isNotSelfPayment(inputs.senderAddress, inputs.destination),
//                          () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
//                          () => (inputs.account_info.result.account_flags.disableMasterKey && !inputs.useMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
//                          () => (inputs.isTicket ? isRequired(inputs.ticketSequence, 'Ticket Sequence') : null),
//                          () => (inputs.isTicket ? isValidNumber(inputs.ticketSequence, 'Ticket Sequence', 0) : null),
//                          () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
//                          () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
//                          () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
//                          () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
//                          () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
//                     ],
//                     asyncValidators: [checkDestinationTagRequirement],
//                },
//                default: { required: [], customValidators: [], asyncValidators: [] },
//           };

//           const config = actionConfig[action] || actionConfig['default'];

//           // --- Run required checks ---
//           config.required.forEach((field: keyof ValidationInputs) => {
//                const err = isRequired(inputs[field], field.charAt(0).toUpperCase() + field.slice(1));
//                if (err) errors.push(err);
//           });

//           // --- Run sync custom validators ---
//           config.customValidators?.forEach(validator => {
//                const err = validator();
//                if (err) errors.push(err);
//           });

//           // --- Run async validators ---
//           if (config.asyncValidators) {
//                for (const validator of config.asyncValidators) {
//                     const err = await validator();
//                     if (err) errors.push(err);
//                }
//           }

//           // --- Always validate optional fields ---
//           const multiErr = validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds);
//           if (multiErr) errors.push(multiErr);

//           if (errors.length == 0 && inputs.useMultiSign && (inputs.multiSignAddresses === 'No Multi-Sign address configured for account' || inputs.multiSignSeeds === '')) {
//                errors.push('At least one signer address is required for multi-signing');
//           }

//           const regAddrErr = isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address');
//           if (regAddrErr && inputs.regularKeyAddress !== 'No RegularKey configured for account') {
//                errors.push(regAddrErr);
//           }

//           const regSeedErr = isValidSecret(inputs.regularKeySeed, 'Regular Key Seed');
//           if (regSeedErr) errors.push(regSeedErr);

//           if (inputs.selectedAccount === undefined || inputs.selectedAccount === null) {
//                errors.push('Please select an account');
//           }

//           return errors;
//      }

//      private displayDataForAccount1() {
//           this.displayDataForAccount('account1');
//      }

//      private displayDataForAccount2() {
//           this.displayDataForAccount('account2');
//      }

//      private displayDataForAccount3() {
//           this.displayDataForAccount('issuer');
//      }

//      clearFields(clearAllFields: boolean) {
//           if (clearAllFields) {
//                this.amountField = '';
//                this.invoiceIdField = '';
//                this.destinationTagField = '';
//                this.sourceTagField = '';
//           }

//           this.ticketSequence = '';
//           this.isTicket = false;
//           this.memoField = '';
//           this.isMemoEnabled = false;
//           this.cdr.detectChanges();
//      }

//      private renderTransactionResult(response: any): void {
//           if (this.isSimulateEnabled) {
//                this.renderUiComponentsService.renderSimulatedTransactionsResults(response, this.resultField.nativeElement);
//           } else {
//                console.debug(`Response`, response);
//                this.renderUiComponentsService.renderTransactionsResults(response, this.resultField.nativeElement);
//           }
//      }

//      private updateSpinnerMessage(message: string) {
//           this.spinnerMessage = message;
//           this.cdr.detectChanges();
//           console.log('Spinner message updated:', message);
//      }

//      private async showSpinnerWithDelay(message: string, delayMs: number = 200) {
//           this.spinner = true;
//           this.updateSpinnerMessage(message);
//           await new Promise(resolve => setTimeout(resolve, delayMs));
//      }

//      private setErrorProperties() {
//           this.isSuccess = false;
//           this.isError = true;
//           this.spinner = false;
//      }

//      private setError(message: string, txToSign: any) {
//           this.setErrorProperties();
//           this.handleTransactionResult(
//                {
//                     result: `${message}`,
//                     isError: this.isError,
//                     isSuccess: this.isSuccess,
//                },
//                txToSign
//           );
//      }

//      private setSuccessProperties() {
//           this.isSuccess = true;
//           this.isError = false;
//           this.spinner = true;
//           this.result = '';
//      }

//      private setSuccess(message: string, txToSign: any) {
//           this.setSuccessProperties();
//           this.handleTransactionResult(
//                {
//                     result: `${message}`,
//                     isError: this.isError,
//                     isSuccess: this.isSuccess,
//                },
//                txToSign
//           );
//      }
// }
