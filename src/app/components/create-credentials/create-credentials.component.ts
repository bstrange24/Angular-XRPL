import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { StorageService } from '../../services/storage.service';
import * as xrpl from 'xrpl';
import { CredentialCreate, CredentialDelete, rippleTimeToISOTime } from 'xrpl';
import { flagNames } from 'flagnames';
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
     selector: 'app-create-credentials',
     standalone: true,
     imports: [CommonModule, FormsModule, WalletMultiInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './create-credentials.component.html',
     styleUrl: './create-credentials.component.css',
})
export class CreateCredentialsComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     selectedAccount: 'account1' | 'account2' | 'issuer' | null = 'account1'; // Initialize to 'account1' for default selection
     private lastResult: string = '';
     transactionInput: string = '';
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = true;
     currencyField: string = '';
     currencyBalanceField: string = '';
     // destinationField: string = '';
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
     isRegularKeyAddress: boolean = false;
     regularKeyAddress: string = '';
     regularKeySeed: string = '';
     isMultiSign: boolean = false;
     multiSignAddress: string = '';
     isUpdateMetaData: boolean = false;
     multiSignSeeds: string = '';
     signerQuorum: number = 0;
     memoField: string = '';
     isMemoEnabled: boolean = false;
     credentialType: string = '';
     credentialData: string = '';
     credentialID: string = '';
     subject: string = '';
     spinner: boolean = false;
     spinnerMessage: string = '';
     credential = {
          version: '1.0',
          credential_type: '',
          issuer: '',
          subject: {
               full_name: '',
               destinationAddress: '',
               dob: '',
               country: '',
               id_type: '',
               id_number: '',
               expirationDate: '',
          },
          verification: {
               method: '',
               verified_at: '',
               verifier: '',
          },
          hash: '',
          uri: '',
     };
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
          this.onAccountChange();
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
          // Example validation: quorum <= sum of weights
          const totalWeight = this.signers.reduce((sum, s) => sum + (s.weight || 0), 0);
          if (this.signerQuorum > totalWeight) {
               this.signerQuorum = totalWeight;
          }
          this.cdr.detectChanges();
     }

     async getCredentialsForAccount() {
          console.log('Entering getCredentialsForAccount');
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

               this.showSpinnerWithDelay('Getting Credentials...', 200);

               const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
               if (accountInfo.result.account_data.length <= 0) {
                    this.resultField.nativeElement.innerHTML = `No account data found for ${wallet.classicAddress}`;
                    return;
               }
               console.debug(`accountInfo for ${wallet.classicAddress} ${JSON.stringify(accountInfo.result, null, '\t')}`);

               const accountObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'credential');
               console.debug(`accountObjects for ${wallet.classicAddress} ${JSON.stringify(accountObjects.result, null, '\t')}`);

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

               // Account-level information
               const accountCredentials = [
                    { key: 'Classic Address', value: wallet.classicAddress },
                    { key: 'Public Key', value: wallet.publicKey },
                    { key: 'Account Sequence', value: accountInfo.result.account_data.Sequence.toString() },
               ];
               // const accountCredentials = [{ key: 'Classic Address', value: wallet.classicAddress }, { key: 'Public Key', value: wallet.publicKey }, { key: 'Account Sequence', value: accountInfo.result.account_data.Sequence.toString() }, { key: 'Regular Key', value: this.isRegularKeyAddress ? 'Enabled' : 'Disabled' }, { key: 'Multi-Sign', value: this.isMultiSign ? 'Enabled' : 'Disabled' }, ...(this.isMultiSign ? [{ key: 'Signer Accounts', value: this.multiSignAddress }] : [])];

               // Add account credentials section
               data.sections.push({
                    title: 'Account Information',
                    openByDefault: true,
                    content: accountCredentials,
               });

               // Add credentials section
               if (!accountObjects.result.account_objects || accountObjects.result.account_objects.length <= 0) {
                    data.sections.push({
                         title: 'Credentials',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No credentials found for <code>${wallet.classicAddress}</code>` }],
                    });
               } else {
                    const credentialItems = accountObjects.result.account_objects.map((credential: any, index: number) => ({
                         key: `Credential ${index + 1} (${credential.CredentialType || 'Unknown Type'})`,
                         openByDefault: index === 0, // Open the first credential by default
                         content: [
                              { key: 'Credential Type', value: Buffer.from(credential.CredentialType, 'hex').toString('utf8') || 'N/A' },
                              { key: 'Subject', value: credential.Subject || 'N/A' },
                              {
                                   key: 'Expiration',
                                   value: credential.Expiration ? this.utilsService.convertUnixToEST(credential.Expiration) : 'N/A',
                              },
                              { key: 'Issuer', value: credential.Issuer || 'N/A' },
                              { key: 'LedgerEntryType', value: credential.LedgerEntryType || 'N/A' },
                              { key: 'PreviousTxnID', value: credential.PreviousTxnID || 'N/A' },
                              { key: 'PreviousTxnLgrSeq', value: credential.PreviousTxnLgrSeq?.toString() || 'N/A' },
                              { key: 'Flags', value: flagNames(accountInfo.result.account_data.LedgerEntryType, accountInfo.result.account_data.Flags) },
                              { key: 'Index', value: credential.index || 'N/A' },
                              {
                                   key: 'URI',
                                   value: credential.URI ? Buffer.from(credential.URI, 'hex').toString('utf8') : 'N/A',
                              },
                         ],
                    }));

                    data.sections.push({
                         title: `Credentials (${accountObjects.result.account_objects.length})`,
                         openByDefault: true,
                         subItems: credentialItems,
                    });
               }

               this.utilsService.renderPaymentChannelDetails(data);
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), wallet);
               this.refreshUiAccountInfo(accountInfo);
               this.loadSignerList(wallet.classicAddress);
               this.setSuccess(this.result);

               await this.updateXrpBalance(client, wallet);
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getCredentialsForAccount in ${this.executionTime}ms`);
          }
     }

     async setCredentials() {
          console.log('Entering setCredentials');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               amount: this.amountField,
               destination: this.destinationFields,
               regularKeyAddress: this.regularKeyAddress ? this.regularKeyAddress : undefined,
               regularKeySeed: this.regularKeySeed ? this.regularKeySeed : undefined,
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

               this.updateSpinnerMessage('Setting Credentials...');

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               const credentialCreateTx: CredentialCreate = {
                    TransactionType: 'CredentialCreate',
                    Account: wallet.classicAddress,
                    CredentialType: Buffer.from(this.credential.credential_type, 'utf8').toString('hex') || Buffer.from('defaultCredentialType', 'utf8').toString('hex'), // Default type if not provided
                    Subject: this.credential.subject.destinationAddress || 'defaultSubject',
                    Expiration: this.credential.subject.expirationDate ? Math.floor(new Date(this.credential.subject.expirationDate).getTime() / 1000) : undefined, // Convert to seconds
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    credentialCreateTx.TicketSequence = Number(this.ticketSequence);
                    credentialCreateTx.Sequence = 0;
               } else {
                    const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    credentialCreateTx.Sequence = accountInfo.result.account_data.Sequence;
               }

               if (this.memoField) {
                    credentialCreateTx.Memos = [
                         {
                              Memo: {
                                   MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                                   MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                              },
                         },
                    ];
               }

               if (this.credential.uri) {
                    credentialCreateTx.URI = Buffer.from(this.credential.uri, 'utf8').toString('hex');
               }

               let signedTx: { tx_blob: string; hash: string } | null = null;

               if (this.isMultiSign) {
                    const signerAddresses = this.multiSignAddress
                         .split(',')
                         .map(s => s.trim())
                         .filter(s => s.length > 0);

                    if (signerAddresses.length === 0) {
                         return this.setError('ERROR: No signers provided for multi-signing');
                    }

                    const signerSeeds = this.multiSignSeeds.split(',').map(s => s.trim());

                    try {
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: credentialCreateTx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         credentialCreateTx.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(credentialCreateTx, null, 2));
                         console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         credentialCreateTx.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    console.log('CredentialCreate Tx:', JSON.stringify(credentialCreateTx, null, 2));
                    const preparedTx = await client.autofill(credentialCreateTx);
                    if (useRegularKeyWalletSignTx) {
                         signedTx = regularKeyWalletSignTx.sign(preparedTx);
                    } else {
                         signedTx = wallet.sign(preparedTx);
                    }
               }

               this.updateSpinnerMessage('Submitting transaction to the Ledger...');

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
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

               this.isMemoEnabled = false;
               this.memoField = '';

               await this.updateXrpBalance(client, wallet);
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving setCredentials in ${this.executionTime}ms`);
          }
     }

     async removeCredentials() {
          console.log('Entering removeCredentials');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               credentialID: this.credentialID,
               credentialType: this.credential.credential_type,
               regularKeyAddress: this.regularKeyAddress ? this.regularKeyAddress : undefined,
               regularKeySeed: this.regularKeySeed ? this.regularKeySeed : undefined,
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

               this.updateSpinnerMessage('Removing Credentials...');

               const accountObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'credential');
               console.debug(`accountObjects for ${wallet.classicAddress} ${JSON.stringify(accountObjects.result, null, '\t')}`);

               const credentialFound = accountObjects.result.account_objects.find((line: any) => {
                    return line.LedgerEntryType === 'Credential' && line.index === this.credentialID;
               });

               // If not found, exit early
               if (!credentialFound) {
                    this.resultField.nativeElement.innerHTML = `No credentials found for ${wallet.classicAddress} with ID ${this.credentialID}`;
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               const credentialDeleteTx: CredentialDelete = {
                    TransactionType: 'CredentialDelete',
                    Account: wallet.classicAddress,
                    CredentialType: (credentialFound as any)?.CredentialType || Buffer.from('defaultCredentialType', 'utf8').toString('hex'),
                    Subject: (credentialFound as any)?.Subject || '',
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    credentialDeleteTx.TicketSequence = Number(this.ticketSequence);
                    credentialDeleteTx.Sequence = 0;
               } else {
                    const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    credentialDeleteTx.Sequence = accountInfo.result.account_data.Sequence;
               }

               if (this.memoField) {
                    credentialDeleteTx.Memos = [
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
                         .filter(s => s.length > 0);

                    if (signerAddresses.length === 0) {
                         return this.setError('ERROR: No signers provided for multi-signing');
                    }

                    const signerSeeds = this.multiSignSeeds.split(',').map(s => s.trim());

                    try {
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: credentialDeleteTx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         credentialDeleteTx.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(credentialDeleteTx, null, 2));
                         console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         credentialDeleteTx.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    console.log('credentialDeleteTx before autofill:', JSON.stringify(credentialDeleteTx, null, 2));
                    const preparedTx = await client.autofill(credentialDeleteTx);
                    if (useRegularKeyWalletSignTx) {
                         signedTx = regularKeyWalletSignTx.sign(preparedTx);
                    } else {
                         signedTx = wallet.sign(preparedTx);
                    }
               }

               this.updateSpinnerMessage('Submitting transaction to the Ledger...');

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
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

               this.isMemoEnabled = false;
               this.memoField = '';

               await this.updateXrpBalance(client, wallet);
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving removeCredentials in ${this.executionTime}ms`);
          }
     }

     async verifyCredential(client: xrpl.Client, issuer: string, subject: string, credentialType: string, binary = false) {
          /**
           * Check whether an XRPL account holds a specified credential,
           * as of the most recently validated ledger.
           * Parameters:
           *  client - Client for interacting with rippled servers.
           *  issuer - Address of the credential issuer, in base58.
           *  subject - Address of the credential holder/subject, in base58.
           *  credentialType - Credential type to check for as a string,
           *                   which will be encoded as UTF-8 (1-128 characters long).
           *  binary - Specifies that the credential type is provided in hexadecimal format.
           * You must provide the credential_type as input.
           * Returns True if the account holds the specified, valid credential.
           * Returns False if the credential is missing, expired, or not accepted.
           */

          // Encode credentialType as uppercase hex, if needed
          let credentialTypeHex = '';
          if (binary) {
               credentialTypeHex = credentialType.toUpperCase();
          } else {
               credentialTypeHex = xrpl.convertStringToHex(credentialType).toUpperCase();
               console.info(`Encoded credential_type as hex: ${credentialTypeHex}`);
          }

          if (credentialTypeHex.length % 2 !== 0 || !AppConstants.CREDENTIAL_REGEX.test(credentialTypeHex)) {
               // Hexadecimal is always 2 chars per byte, so an odd length is invalid.
               throw new Error('Credential type must be 128 characters as hexadecimal.');
          }

          // Perform XRPL lookup of Credential ledger entry --------------------------
          const ledgerEntryRequest = {
               command: 'ledger_entry',
               credential: {
                    subject: subject,
                    issuer: issuer,
                    credential_type: credentialTypeHex,
               },
               ledger_index: 'validated',
          };
          console.info('Looking up credential...');
          console.info(JSON.stringify(ledgerEntryRequest, null, 2));

          let xrplResponse;
          try {
               xrplResponse = await client.request(ledgerEntryRequest as any);
          } catch (error: any) {
               if (error.data?.error === 'entryNotFound') {
                    console.info('Credential was not found');
                    return false;
               } else {
                    // Other errors, for example invalidly specified addresses.
                    throw new Error(`Failed to check credential: ${error.message || 'Unknown error'}`);
               }
          }

          const credential = (xrplResponse.result as any).node;
          console.info('Found credential:');
          console.info(JSON.stringify(credential, null, 2));

          // Check if the credential has been accepted ---------------------------
          if (!(credential.Flags & AppConstants.LSF_ACCEPTED)) {
               console.info('Credential is not accepted.');
               return false;
          }

          // Confirm that the credential is not expired ------------------------------
          if (credential.Expiration) {
               const expirationTime = rippleTimeToISOTime(credential.Expiration);
               console.info(`Credential has expiration: ${expirationTime}`);
               console.info('Looking up validated ledger to check for expiration.');

               let ledgerResponse;
               try {
                    ledgerResponse = await client.request({
                         command: 'ledger',
                         ledger_index: 'validated',
                    });
               } catch (error: any) {
                    throw new Error(`Failed to check credential: ${error.message || 'Unknown error'}`);
               }

               const closeTime = rippleTimeToISOTime(ledgerResponse.result.ledger.close_time);
               console.info(`Most recent validated ledger is: ${closeTime}`);

               if (new Date(closeTime) > new Date(expirationTime)) {
                    console.info('Credential is expired.');
                    return false;
               }
          }

          // Credential has passed all checks ---------------------------------------
          console.info('Credential is valid.');
          return true;
     }

     async lookUpCredentials(client: xrpl.Client, issuer: string, subject: string, accepted = 'both') {
          // const account = issuer || subject; // Use whichever is specified, issuer if both
          // if (!account) {
          //      throw new ValueError('Must specify issuer or subject');
          // }
          // accepted = accepted.toLowerCase();
          // if (!['yes', 'no', 'both'].includes(accepted)) {
          //      throw new ValueError("accepted must be 'yes', 'no', or 'both'");
          // }
          // const credentials = [];
          // let request = {
          //      command: 'account_objects',
          //      account,
          //      type: 'credential',
          //      ledger_index: 'validated',
          // };
          // // Fetch first page
          // let response = await client.request(request as any);
          // while (true) {
          //      for (const obj of response.result.account_objects) {
          //           if (issuer && obj.Issuer !== issuer) continue;
          //           if (subject && obj.Subject !== subject) continue;
          //           const credAccepted = Boolean(obj.Flags & AppConstants.LSF_ACCEPTED);
          //           if (accepted === 'yes' && !credAccepted) continue;
          //           if (accepted === 'no' && credAccepted) continue;
          //           credentials.push(obj);
          //      }
          //      if (!response.result.marker) break;
          //      /**
          //       * If there is a marker, request the next page using the convenience function "requestNextPage()".
          //       * See https://js.xrpl.org/classes/Client.html#requestnextpage to learn more.
          //       **/
          //      response = await client.requestNextPage(request, response.result);
          // }
          // return credentials;
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

     private validateInputs(inputs: { seed?: string; credentialID?: string; credentialType?: string; amount?: string; destination?: string; sequence?: string; selectedAccount?: 'account1' | 'account2' | 'issuer' | null; multiSignAddresses?: string; multiSignSeeds?: string; regularKeyAddress?: string; regularKeySeed?: string }): string | null {
          if (inputs.selectedAccount !== undefined && !inputs.selectedAccount) {
               return 'Please select an account';
          }
          if (inputs.seed != undefined && !this.utilsService.validateInput(inputs.seed)) {
               return 'Account seed cannot be empty';
          }
          if (inputs.credentialID != undefined && !this.utilsService.validateInput(inputs.credentialID)) {
               return 'Credential ID cannot be empty';
          }
          if (inputs.credentialType != undefined && !this.utilsService.validateInput(inputs.credentialType)) {
               return 'Credential Type cannot be empty';
          }
          if (inputs.regularKeyAddress != undefined && inputs.regularKeyAddress != 'No RegularKey configured for account' && !xrpl.isValidAddress(this.regularKeyAddress)) {
               return 'Regular Key Address is invalid or empty';
          }
          if (inputs.regularKeySeed != undefined && !xrpl.isValidSecret(this.regularKeySeed)) {
               return 'ERROR: Regular Key Seed is invalid or empty';
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
          this.credential.credential_type = '';
          this.credentialID = '';
          this.credential.subject.destinationAddress = '';
          this.credential.uri = '';
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

     private updateDestinations() {
          this.destinations = [...Object.values(this.knownDestinations)];
          this.storageService.setKnownIssuers('destinations', this.knownDestinations);
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
          // this.destinationField = this.storageService.getInputValue(`${otherPrefix}address`) || AppConstants.EMPTY_STRING;

          // Fetch account details and trustlines
          try {
               if (address && xrpl.isValidAddress(address)) {
                    await this.getCredentialsForAccount();
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
