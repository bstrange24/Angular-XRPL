import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { StorageService } from '../../services/storage.service';
import * as xrpl from 'xrpl';
import { CredentialCreate, CredentialDelete, CredentialAccept, rippleTimeToISOTime } from 'xrpl';
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
          credential_type: 'KYCCredential',
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
          uri: 'ipfs://bafybeiexamplehash',
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
     }

     async ngAfterViewInit() {
          try {
               const wallet = await this.getWallet();
               this.utilsService.loadSignerList(wallet.classicAddress, this.signers);

               if (Object.keys(this.knownDestinations).length === 0) {
                    this.utilsService.populateKnownDestinations(this.knownDestinations, this.account1.address, this.account2.address, this.issuer.address);
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
                                   value: credential.Expiration ? this.utilsService.toFormattedExpiration(credential.Expiration) : 'N/A',
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
               this.setSuccess(this.result);
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), wallet);
               this.refreshUiAccountInfo(accountInfo);
               this.utilsService.loadSignerList(wallet.classicAddress, this.signers);

               this.isMemoEnabled = false;
               this.memoField = '';

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
               destination: this.destinationFields,
               credentialType: this.credential.credential_type,
               regularKeyAddress: this.regularKeyAddress ? this.regularKeyAddress : undefined,
               regularKeySeed: this.regularKeySeed ? this.regularKeySeed : undefined,
               multiSignAddresses: this.isMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.isMultiSign ? this.multiSignSeeds : undefined,
               date: this.credential.subject.expirationDate,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.isMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               this.updateSpinnerMessage('Setting Credentials...');

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               console.debug('expirationDate:', this.credential.subject.expirationDate);
               const expirationRipple = this.utilsService.toRippleTime(this.credential.subject.expirationDate || '');
               console.debug('expirationRipple:', expirationRipple);

               const credentialCreateTx: CredentialCreate = {
                    TransactionType: 'CredentialCreate',
                    Account: wallet.classicAddress,
                    CredentialType: Buffer.from(this.credential.credential_type || 'defaultCredentialType', 'utf8').toString('hex'),
                    Subject: this.credential.subject.destinationAddress,
                    Expiration: expirationRipple,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(credentialCreateTx, this.ticketSequence, true);
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    this.utilsService.setTicketSequence(credentialCreateTx, getAccountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(credentialCreateTx, this.memoField);
               }

               if (this.credential.uri) {
                    this.utilsService.setURI(credentialCreateTx, this.credential.uri);
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

                         if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, credentialCreateTx, multiSignFee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
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

                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, credentialCreateTx, fee)) {
                         return this.setError('ERROR: Insufficient XRP to complete transaction');
                    }
               }

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }

               this.updateSpinnerMessage('Submitting transaction to the Ledger...');
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
               const wallet = await this.getWallet();

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.isMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

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
                    CredentialType: (credentialFound as any)?.CredentialType,
                    Subject: (credentialFound as any)?.Subject,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(credentialDeleteTx, this.ticketSequence, true);
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    this.utilsService.setTicketSequence(credentialDeleteTx, getAccountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(credentialDeleteTx, this.memoField);
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

                         if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, credentialDeleteTx, multiSignFee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
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

                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, credentialDeleteTx, fee)) {
                         return this.setError('ERROR: Insufficient XRP to complete transaction');
                    }
               }

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }

               this.updateSpinnerMessage('Submitting transaction to the Ledger...');
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

     async acceptCredentials() {
          console.log('Entering acceptCredentials');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
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
               const wallet = await this.getWallet();

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.isMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               this.updateSpinnerMessage('Removing Credentials...');

               const accountObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'credential');
               console.debug(`accountObjects for ${wallet.classicAddress} ${JSON.stringify(accountObjects.result, null, '\t')}`);

               const credentialFound = accountObjects.result.account_objects.find((line: any) => {
                    return line.LedgerEntryType === 'Credential' && line.Subject === wallet.classicAddress; // && line.index === this.credentialID;
               });

               // If not found, exit early
               if (!credentialFound) {
                    this.resultField.nativeElement.innerHTML = `${wallet.classicAddress} has no Credentials to accept`;
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }
               console.debug(`credentialFound for ${wallet.classicAddress} ${JSON.stringify(credentialFound, null, '\t')}`);

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               const credentialAcceptTx: CredentialAccept = {
                    TransactionType: 'CredentialAccept',
                    Account: wallet.classicAddress,
                    Issuer: (credentialFound as any)?.Issuer,
                    CredentialType: (credentialFound as any)?.CredentialType,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(credentialAcceptTx, this.ticketSequence, true);
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    this.utilsService.setTicketSequence(credentialAcceptTx, getAccountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(credentialAcceptTx, this.memoField);
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
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: credentialAcceptTx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         credentialAcceptTx.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(credentialAcceptTx, null, 2));
                         console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         credentialAcceptTx.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));

                         if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, credentialAcceptTx, multiSignFee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    console.log('credentialAcceptTx before autofill:', JSON.stringify(credentialAcceptTx, null, 2));
                    const preparedTx = await client.autofill(credentialAcceptTx);
                    if (useRegularKeyWalletSignTx) {
                         signedTx = regularKeyWalletSignTx.sign(preparedTx);
                    } else {
                         signedTx = wallet.sign(preparedTx);
                    }

                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, credentialAcceptTx, fee)) {
                         return this.setError('ERROR: Insufficient XRP to complete transaction');
                    }
               }

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }

               this.updateSpinnerMessage('Submitting transaction to the Ledger...');
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
               console.log(`Leaving acceptCredentials in ${this.executionTime}ms`);
          }
     }

     async verifyCredential(binary: boolean): Promise<boolean | void> {
          console.log('Entering verifyCredential');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               destination: this.destinationFields,
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
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

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

               // Encode credentialType as uppercase hex, if needed
               let credentialTypeHex = '';
               if (binary) {
                    credentialTypeHex = this.credential.credential_type.toUpperCase();
               } else {
                    credentialTypeHex = xrpl.convertStringToHex(this.credential.credential_type).toUpperCase();
                    console.info(`Encoded credential_type as hex: ${credentialTypeHex}`);
               }

               if (credentialTypeHex.length % 2 !== 0 || !AppConstants.CREDENTIAL_REGEX.test(credentialTypeHex)) {
                    // Hexadecimal is always 2 chars per byte, so an odd length is invalid.
                    data.sections.push({
                         title: 'Credentials',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `Credential type must be 128 characters as hexadecimal.` }],
                    });
                    this.utilsService.renderPaymentChannelDetails(data);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               // Perform XRPL lookup of Credential ledger entry
               const ledgerEntryRequest = {
                    command: 'ledger_entry',
                    credential: {
                         subject: this.credential.subject.destinationAddress,
                         issuer: wallet.classicAddress,
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
                         data.sections.push({
                              title: 'Credentials',
                              openByDefault: true,
                              content: [{ key: 'Status', value: `Credential not found.` }],
                         });
                         this.utilsService.renderPaymentChannelDetails(data);
                         this.resultField.nativeElement.classList.add('error');
                         this.setErrorProperties();
                         return;
                    } else {
                         data.sections.push({
                              title: 'Credentials',
                              openByDefault: true,
                              content: [{ key: 'Status', value: `Failed to check credential: ${error.message || 'Unknown error'}` }],
                         });
                         this.utilsService.renderPaymentChannelDetails(data);
                         this.resultField.nativeElement.classList.add('error');
                         this.setErrorProperties();
                         return;
                    }
               }

               const credential = (xrplResponse.result as any).node;
               console.info('Found credential:');
               console.info(JSON.stringify(credential, null, 2));

               // Check if the credential has been accepted
               if (!(credential.Flags & AppConstants.LSF_ACCEPTED)) {
                    data.sections.push({
                         title: 'Credentials',
                         openByDefault: true,
                         content: [{ key: 'Status', value: 'Credential is not accepted' }],
                    });
                    console.info('Credential is not accepted.');
                    this.resultField.nativeElement.classList.add('error');
                    this.utilsService.renderPaymentChannelDetails(data);
                    this.setErrorProperties();
                    return;
               }

               // Confirm that the credential is not expired
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
                         data.sections.push({
                              title: 'Credentials',
                              openByDefault: true,
                              content: [{ key: 'Status', value: `Failed to check credential: ${error.message || 'Unknown error'}` }],
                         });
                         this.utilsService.renderPaymentChannelDetails(data);
                         this.resultField.nativeElement.classList.add('error');
                         this.setErrorProperties();
                         return;
                    }

                    const closeTime = rippleTimeToISOTime(ledgerResponse.result.ledger.close_time);
                    console.info(`Most recent validated ledger is: ${closeTime}`);

                    if (new Date(closeTime) > new Date(expirationTime)) {
                         console.info('Credential is expired.');
                         data.sections.push({
                              title: 'Credentials',
                              openByDefault: true,
                              content: [{ key: 'Status', value: `Credential is expired.` }],
                         });
                         this.utilsService.renderPaymentChannelDetails(data);
                         this.resultField.nativeElement.classList.add('error');
                         this.setErrorProperties();
                         return;
                    }
               }

               data.sections.push({
                    title: 'Credentials',
                    openByDefault: true,
                    content: [
                         { key: 'Status', value: 'Credential is verified' },
                         { key: 'Credential Type', value: ledgerEntryRequest.credential.credential_type || 'Credential' },
                         { key: 'Issuer', value: ledgerEntryRequest.credential.issuer || 'N/A' },
                         { key: 'Subject', value: ledgerEntryRequest.credential.subject || 'N/A' },
                         { key: 'Expiration', value: credential.Expiration || 'Credential' },
                         { key: 'Flags', value: credential.Flags || 'N/A' },
                         { key: 'IssuerNode', value: credential.IssuerNode || 'N/A' },
                         { key: 'PreviousTxnID', value: credential.PreviousTxnID || 'N/A' },
                         { key: 'PreviousTxnLgrSeq', value: credential.PreviousTxnLgrSeq || 'N/A' },
                         { key: 'Subject Node', value: credential.SubjectNode || 'N/A' },
                         { key: 'URI', value: credential.URI || 'N/A' },
                         { key: 'Index', value: credential.index || 'N/A' },
                    ],
               });

               // Credential has passed all checks
               console.info('Credential is valid.');
               this.utilsService.renderPaymentChannelDetails(data);
               return true;
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving verifyCredential in ${this.executionTime}ms`);
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

     private validateInputs(inputs: { seed?: string; credentialID?: string; credentialType?: string; amount?: string; destination?: string; sequence?: string; selectedAccount?: 'account1' | 'account2' | 'issuer' | null; multiSignAddresses?: string; multiSignSeeds?: string; regularKeyAddress?: string; regularKeySeed?: string; date?: string }): string | null {
          const { seed, credentialID, credentialType, amount, destination, selectedAccount, regularKeyAddress, regularKeySeed, multiSignAddresses, multiSignSeeds, date } = inputs;

          // 1. Account selection
          if (selectedAccount === null || selectedAccount === undefined) {
               return 'Please select an account';
          }

          // 2. Seed
          if (!seed || !this.utilsService.validateInput(seed)) {
               return 'Account seed cannot be empty';
          }
          if (!xrpl.isValidSecret(seed)) {
               return 'Account seed is invalid';
          }

          // 3. Amount
          if (amount) {
               if (amount !== null && amount !== undefined && !this.utilsService.validateInput(amount)) {
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

          // 4. Credential ID
          if (credentialID !== null && credentialID !== undefined && !this.utilsService.validateInput(credentialID)) {
               return 'Credential ID cannot be empty';
          }

          // 5. Credential Type
          if (credentialType !== null && credentialType !== undefined && !this.utilsService.validateInput(credentialType)) {
               return 'Credential Type cannot be empty';
          }

          // 6. Destination
          if (destination !== null && destination !== undefined && !this.utilsService.validateInput(destination)) {
               return 'Destination cannot be empty';
          }

          // 7. Regular key
          if (regularKeyAddress && regularKeyAddress !== 'No RegularKey configured for account') {
               if (!xrpl.isValidAddress(regularKeyAddress)) {
                    return 'Regular Key Address is invalid or empty';
               }
          }

          if (regularKeySeed !== null && regularKeySeed !== undefined && !xrpl.isValidSecret(regularKeySeed)) {
               return 'ERROR: Regular Key Seed is invalid or empty';
          }

          // 8. Multi-sign
          if (multiSignAddresses && multiSignSeeds) {
               const addresses = multiSignAddresses
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
               const seeds = multiSignSeeds
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);

               if (addresses.length === 0) {
                    return 'At least one signer address is required for multi-signing';
               }
               if (addresses.length !== seeds.length) {
                    return 'Number of signer addresses must match number of signer seeds';
               }

               const invalidAddr = addresses.find(addr => !xrpl.isValidAddress(addr));
               if (invalidAddr) {
                    return `Invalid signer address: ${invalidAddr}`;
               }

               if (seeds.some(s => !xrpl.isValidSecret(s))) {
                    return 'One or more signer seeds are invalid';
               }
          }

          // 9. Credential Type
          if (date) {
               if (!this.utilsService.validateInput(date) || !this.utilsService.isValidDate(this.credential.subject.expirationDate) || date === '') {
                    return 'Date cannot be empty';
               }
          }

          return null;
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
