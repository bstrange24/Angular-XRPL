import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { StorageService } from '../../services/storage.service';
import * as xrpl from 'xrpl';
import { DIDSet, DIDDelete } from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';
import { WalletMultiInputComponent } from '../wallet-multi-input/wallet-multi-input.component';
import didSchema from './did-schema.json'; // save schema as file
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';

interface ValidationInputs {
     selectedAccount?: 'account1' | 'account2' | 'issuer' | null;
     seed?: string;
     account_info?: any;
     destination?: string;
     didDocument?: string;
     didUri?: string;
     didData?: string;
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
     selector: 'app-create-did',
     standalone: true,
     imports: [CommonModule, FormsModule, WalletMultiInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './create-did.component.html',
     styleUrl: './create-did.component.css',
})
export class CreateDidComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     selectedAccount: 'account1' | 'account2' | 'issuer' | null = 'account1';
     private lastResult: string = '';
     transactionInput: string = '';
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = true;
     destinationField: string = '';
     amountField: string = '';
     ticketSequence: string = '';
     isTicket: boolean = false;
     isTicketEnabled: boolean = false;
     account1 = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '0' };
     account2 = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '0' };
     issuer = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '0' };
     ownerCount: string = '';
     totalXrpReserves: string = '';
     executionTime: string = '';
     useMultiSign: boolean = false;
     multiSignAddress: string = '';
     isRegularKeyAddress: boolean = false;
     regularKeyAddress: string = '';
     regularKeySeed: string = '';
     isUpdateMetaData: boolean = false;
     multiSignSeeds: string = '';
     signerQuorum: number = 0;
     memoField: string = '';
     multiSigningEnabled: boolean = false;
     regularKeySigningEnabled: boolean = false;
     isMemoEnabled: boolean = false;
     spinner: boolean = false;
     spinnerMessage: string = '';
     masterKeyDisabled: boolean = false;
     isSimulateEnabled: boolean = false;
     didDetails = {
          id: '',
          verificationMethod: {
               id: '',
               type: '',
               controller: '',
               publicKeyBase58: '',
          },
          authentication: {
               auth: '',
          },
          service: {
               serviceId: '',
               serviceType: '',
               serviceEndpoint: '',
          },
          hash: '',
          uri: '',
          document: '',
          data: '',
     };
     signers: { account: string; seed: string; weight: number }[] = [{ account: '', seed: '', weight: 1 }];

     constructor(private readonly xrplService: XrplService, private readonly utilsService: UtilsService, private readonly cdr: ChangeDetectorRef, private readonly storageService: StorageService, private readonly renderUiComponentsService: RenderUiComponentsService, private readonly xrplTransactions: XrplTransactionService) {}

     ngOnInit() {
          console.log(`Create DID OnInit called`);
     }

     async ngAfterViewInit() {
          try {
               const wallet = await this.getWallet();
               this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
          } catch (error: any) {
               console.log(`ERROR: Wallet could not be created or is undefined ${error.message}`);
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

     toggleTicketSequence() {
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
               console.log(`ERROR getting wallet in toggleMultiSign' ${error.message}`);
               return this.setError('ERROR getting wallet in toggleMultiSign');
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

     async getDidForAccount() {
          console.log('Entering getDidForAccount');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ?? '', this.account1, this.account2, this.issuer),
          };

          try {
               this.resultField.nativeElement.innerHTML = '';
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Getting DID (${mode})...`);

               // Get client + wallet
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // Fetch account info + credential objects in PARALLEL
               const [accountInfo, accountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);

               // Optional: Avoid heavy stringify — log only if needed
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`DID objects for ${wallet.classicAddress}:`, accountObjects.result);

               inputs = {
                    ...inputs,
                    account_info: accountInfo,
               };

               const errors = this.validateInputs(inputs, 'getDidForAccount');
               if (errors.length > 0) {
                    return this.setError(`ERROR: ${errors.join('; ')}`);
               }

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

               // Add Did section
               const didObjects = accountObjects.result.account_objects.filter((obj: any) => obj.LedgerEntryType === 'DID');
               if (!didObjects || didObjects.length <= 0) {
                    data.sections.push({
                         title: 'DID',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No DID found for <code>${wallet.classicAddress}</code>` }],
                    });
               } else {
                    const didItems = didObjects.map((did: any, index: number) => ({
                         key: `DID (${did.Account || 'Unknown Type'})`,
                         openByDefault: index === 0, // Open the first credential by default
                         content: [
                              { key: 'DID Document', value: did.DIDDocument ? Buffer.from(did.DIDDocument, 'hex').toString('utf8') : 'N/A' },
                              { key: 'DID URI', value: did.URI ? Buffer.from(did.URI, 'hex').toString('utf8') : 'N/A' },
                              { key: 'DID Data', value: did.Data ? Buffer.from(did.Data, 'hex').toString('utf8') : 'N/A' },
                              // { key: 'Flags', value: flagNames(did.LedgerEntryType, did.Flags) || '0' },
                              { key: 'Flags', value: did.Flags?.toString() || '0' },
                              { key: 'Index', value: did.index || 'N/A' },
                              { key: 'PreviousTxnLgrSeq', value: did.PreviousTxnLgrSeq?.toString() || 'N/A' },
                              { key: 'PreviousTxnID', value: did.PreviousTxnID || 'N/A' },
                         ],
                    }));

                    data.sections.push({
                         title: `DID (${didObjects.length})`,
                         openByDefault: true,
                         subItems: didItems,
                    });
               }

               // CRITICAL: Render immediately
               this.utilsService.renderDetails(data);
               this.setSuccess(this.result);

               this.refreshUiAccountObjects(accountObjects, accountInfo, wallet);
               this.refreshUiAccountInfo(accountInfo);

               // DEFER: Non-critical UI updates — let main render complete first
               setTimeout(async () => {
                    try {
                         this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
                         this.clearFields(false);
                         await this.updateXrpBalance(client, accountInfo, wallet);
                    } catch (err) {
                         console.error('Error in deferred UI updates for credentials:', err);
                         // Don't break main render — credentials are already shown
                    }
               }, 0);
          } catch (error: any) {
               console.error('Error in getDidForAccount:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getDidForAccount in ${this.executionTime}ms`);
          }
     }

     async setDid() {
          console.log('Entering setDid');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ?? '', this.account1, this.account2, this.issuer),
               regularKeyAddress: this.isRegularKeyAddress ? this.regularKeyAddress : undefined,
               regularKeySeed: this.isRegularKeyAddress ? this.regularKeySeed : undefined,
               useMultiSign: this.useMultiSign,
               multiSignAddresses: this.useMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.useMultiSign ? this.multiSignSeeds : undefined,
               isTicket: this.isTicket,
               ticketSequence: this.isTicket ? this.ticketSequence : undefined,
               didDocument: this.didDetails.document || undefined,
               didUri: this.didDetails.uri || undefined,
               didData: this.didDetails.data || undefined,
          };

          try {
               this.resultField.nativeElement.innerHTML = '';
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Set DID (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               //  PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, fee, currentLedger, serverInfo] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), this.xrplService.getXrplServerInfo(client, 'current', '')]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);
               console.debug(`serverInfo :`, serverInfo);

               inputs = { ...inputs, account_info: accountInfo };

               const errors = this.validateInputs(inputs, 'setDid');
               if (errors.length > 0) {
                    return this.setError(`ERROR: ${errors.join('; ')}`);
               }

               let didSetTx: DIDSet = {
                    TransactionType: 'DIDSet',
                    Account: wallet.classicAddress,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               // Handle Ticket Sequence
               if (this.ticketSequence) {
                    const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence));
                    if (!ticketExists) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(didSetTx, this.ticketSequence, true);
               } else {
                    // Use pre-fetched sequence — no redundant call!
                    this.utilsService.setTicketSequence(didSetTx, accountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(didSetTx, this.memoField);
               }

               if (this.didDetails.document) {
                    const didDocument = { didData: this.didDetails.document };
                    console.debug('DID Document:', JSON.stringify(didDocument, null, 2));
                    const didDocumentHex = this.utilsService.jsonToHex(didDocument);
                    console.log(didDocumentHex);
                    didSetTx.DIDDocument = didDocumentHex;
               }

               if (this.didDetails.uri) {
                    const didURI = { uri: this.didDetails.uri };
                    console.debug('DID URI:', JSON.stringify(didURI, null, 2));
                    const didURIHex = this.utilsService.jsonToHex(didURI);
                    console.log(didURIHex);
                    didSetTx.URI = didURIHex;
               }

               if (this.didDetails.data) {
                    const result = this.utilsService.validateAndConvertDidJson(this.didDetails.data, didSchema);

                    if (!result.success) {
                         this.setError(result.errors ?? 'Unknown error');
                    } else {
                         didSetTx.Data = result.hexData!;
                    }
               }

               // Submit or Simulate
               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Setting DID (no changes will be made)...' : 'Submitting to Ledger...');

               // Validate balance
               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, didSetTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               if (this.isSimulateEnabled) {
                    const simulation = await this.xrplTransactions.simulateTransaction(client, didSetTx);

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

                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.result);
               } else {
                    // Get regular key wallet
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    // Sign transaction
                    let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, didSetTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

                    const response = await this.xrplTransactions.submitTransaction(client, signedTx);

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

                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.result);

                    // PARALLELIZE
                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    //DEFER: Non-critical UI updates (skip for simulation)
                    if (!this.isSimulateEnabled) {
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
               }
          } catch (error: any) {
               console.error('Error in setDid:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving setDid in ${this.executionTime}ms`);
          }
     }

     async removeDid() {
          console.log('Entering removeDid');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ?? '', this.account1, this.account2, this.issuer),
               regularKeyAddress: this.isRegularKeyAddress ? this.regularKeyAddress : undefined,
               regularKeySeed: this.isRegularKeyAddress ? this.regularKeySeed : undefined,
               multiSignAddresses: this.useMultiSign ? this.multiSignAddress : undefined,
               useMultiSign: this.useMultiSign,
               multiSignSeeds: this.useMultiSign ? this.multiSignSeeds : undefined,
               ticketSequence: this.isTicket ? this.ticketSequence : undefined,
          };

          try {
               this.resultField.nativeElement.innerHTML = '';
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Remove DID (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               //  PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, accountObjects, fee, currentLedger, serverInfo] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'did'), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), this.xrplService.getXrplServerInfo(client, 'current', '')]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`accountObjects for ${wallet.classicAddress}:`, accountObjects.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);
               console.debug(`serverInfo :`, serverInfo);

               inputs = { ...inputs, account_info: accountInfo };

               const errors = this.validateInputs(inputs, 'removeDid');
               if (errors.length > 0) {
                    return this.setError(`ERROR: ${errors.join('; ')}`);
               }

               // Find the specific trustline to the issuer (destinationField)
               const didFound = accountObjects.result.account_objects.find((line: any) => {
                    return line.LedgerEntryType === 'DID';
               });

               // If not found, exit early
               if (!didFound) {
                    this.resultField.nativeElement.innerHTML = `No DID found for ${wallet.classicAddress}`;
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               const didDeleteTx: DIDDelete = {
                    TransactionType: 'DIDDelete',
                    Account: wallet.classicAddress,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               // Handle Ticket Sequence
               if (this.ticketSequence) {
                    const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence));
                    if (!ticketExists) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(didDeleteTx, this.ticketSequence, true);
               } else {
                    // Use pre-fetched sequence — no redundant call!
                    this.utilsService.setTicketSequence(didDeleteTx, accountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(didDeleteTx, this.memoField);
               }

               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, didDeleteTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Remove DID (no changes will be made)...' : 'Submitting to Ledger...');

               if (this.isSimulateEnabled) {
                    const simulation = await this.xrplTransactions.simulateTransaction(client, didDeleteTx);

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

                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.result);
               } else {
                    // Get regular key wallet
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    // Sign transaction
                    let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, didDeleteTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

                    const response = await this.xrplTransactions.submitTransaction(client, signedTx);

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

                    this.resultField.nativeElement.classList.add('success');
                    this.setSuccess(this.result);

                    // PARALLELIZE
                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    //DEFER: Non-critical UI updates (skip for simulation)
                    if (!this.isSimulateEnabled) {
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
               }
          } catch (error: any) {
               console.error('Error in removeDid:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving removeDid in ${this.executionTime}ms`);
          }
     }

     private renderTransactionResult(response: any): void {
          if (this.isSimulateEnabled) {
               this.renderUiComponentsService.renderSimulatedTransactionsResults(response, this.resultField.nativeElement);
          } else {
               console.debug(`Response`, response);
               this.renderUiComponentsService.renderTransactionsResults(response, this.resultField.nativeElement);
          }
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
                              if (entry.SignerEntry?.Account) {
                                   signerAccounts.push(entry.SignerEntry.Account + '~' + entry.SignerEntry.SignerWeight);
                                   this.signerQuorum = obj.SignerQuorum;
                              }
                         });
                    }
               });
          }
          return signerAccounts;
     }

     private async updateXrpBalance(client: xrpl.Client, accountInfo: any, wallet: xrpl.Wallet) {
          const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, accountInfo, wallet.classicAddress);

          this.ownerCount = ownerCount;
          this.totalXrpReserves = totalXrpReserves;

          const balance = (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0');
          this.account1.balance = balance.toString();
     }

     private refreshUiAccountObjects(accountObjects: any, accountInfo: any, wallet: xrpl.Wallet) {
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

          this.clearFields(false);
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

     private validateInputs(inputs: ValidationInputs, action: string): string[] {
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

          const isValidSeed = (value: string | undefined): string | null => {
               if (value) {
                    const { type, value: detectedValue } = this.utilsService.detectXrpInputType(value);
                    if (detectedValue === 'unknown') {
                         return 'Account seed is invalid';
                    }
               }
               return null;
          };

          const isValidNumber = (value: string | undefined, fieldName: string, minValue?: number): string | null => {
               if (value === undefined) return null; // Not required
               const num = parseFloat(value);
               if (isNaN(num) || !isFinite(num)) {
                    return `${fieldName} must be a valid number`;
               }
               if (minValue !== undefined && num <= minValue) {
                    return `${fieldName} must be greater than ${minValue}`;
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
               const invalidSeed = seeds.find((seed: string) => !xrpl.isValidSecret(seed));
               if (invalidSeed) {
                    return 'One or more signer seeds are invalid';
               }
               return null;
          };

          // const validateDidData = (data: string | undefined): string | null => {
          //      if (!data) return null; // Not required
          // const result = this.utilsService.validateAndConvertDidJson(data, didSchema);
          //      if (!result.success) {
          //           return `DID Data is invalid: ${result.errors || 'Unknown error'}`;
          //      }
          //      return null;
          // };

          // Action-specific config: required fields and custom rules
          const actionConfig: Record<string, { required: (keyof ValidationInputs)[]; customValidators?: (() => string | null)[] }> = {
               getDidForAccount: {
                    required: ['selectedAccount', 'seed'],
                    customValidators: [() => isValidSeed(inputs.seed), () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null)],
               },
               setDid: {
                    required: ['selectedAccount', 'seed'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                         () => (inputs.account_info.result.account_flags.disableMasterKey && !inputs.useMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                         () => (inputs.isTicket ? isRequired(inputs.ticketSequence, 'Ticket Sequence') : null),
                         () => (inputs.isTicket ? isValidNumber(inputs.ticketSequence, 'Ticket Sequence', 0) : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                         // () => validateDidData(inputs.didDocument),
                         // () => validateDidData(inputs.didUri),
                         // () => validateDidData(inputs.didData),
                    ],
               },
               removeDid: {
                    required: ['selectedAccount', 'seed'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => (inputs.account_info.result.account_flags.disableMasterKey && !inputs.useMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                         () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                         () => (inputs.isTicket ? isRequired(inputs.ticketSequence, 'Ticket Sequence') : null),
                         () => (inputs.isTicket ? isValidNumber(inputs.ticketSequence, 'Ticket Sequence', 0) : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                    ],
               },
               default: { required: [], customValidators: [] },
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

          // Always validate optional fields if provided
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
                    await this.getDidForAccount();
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

     clearFields(clearAllFields: boolean) {
          if (clearAllFields) {
               this.didDetails.document = '';
               this.didDetails.uri = '';
               this.didDetails.data = '';
               this.ticketSequence = '';
               this.isTicket = false;
               this.useMultiSign = false;
               this.isRegularKeyAddress = false;
          }
          this.memoField = '';
          this.isMemoEnabled = false;
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
