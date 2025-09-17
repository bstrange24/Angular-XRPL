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

interface ValidationInputs {
     selectedAccount?: 'account1' | 'account2' | 'issuer' | null;
     seed?: string;
     account_info?: any;
     destination?: string;
     credentialID?: string;
     credentialType?: string;
     date?: string;
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
     useMultiSign: boolean = false;
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
     masterKeyDisabled: boolean = false;
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

     constructor(private readonly xrplService: XrplService, private readonly utilsService: UtilsService, private readonly cdr: ChangeDetectorRef, private readonly storageService: StorageService) {}

     ngOnInit() {
          console.log(`Create Credentials OnInit called`);
          const storedDestinations = this.storageService.getKnownIssuers('destinations');
          if (storedDestinations) {
               this.knownDestinations = storedDestinations;
          }
     }

     async ngAfterViewInit() {
          try {
               const wallet = await this.getWallet();
               this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
               this.utilsService.populateKnownDestinations(this.knownDestinations, this.account1.address, this.account2.address, this.issuer.address);
               this.updateDestinations();
               this.credential.subject.destinationAddress = this.issuer.address;
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
               account1: () => {
                    void this.displayDataForAccount1();
               },
               account2: () => {
                    void this.displayDataForAccount2();
               },
               issuer: () => {
                    void this.displayDataForAccount3();
               },
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
               console.log(`ERROR getting wallet in toggleMultiSign' ${error.message}`);
               return this.setError('ERROR: Wallet could not be created or is undefined');
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
          this.cdr.detectChanges();
     }

     async getCredentialsForAccount() {
          console.log('Entering getCredentialsForAccount');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ?? '', this.account1, this.account2, this.issuer),
          };

          try {
               this.showSpinnerWithDelay('Getting Credentials...', 200);

               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();
               const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');

               inputs = {
                    ...inputs,
                    account_info: accountInfo,
               };

               const errors = this.validateInputs(inputs, 'getCredentialsForAccount');
               if (errors.length > 0) {
                    return this.setError(`ERROR: ${errors.join('; ')}`);
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
                              { key: 'Issuer', value: credential.Issuer || 'N/A' },
                              { key: 'Index', value: credential.index || 'N/A' },
                              { key: 'Expiration', value: credential.Expiration ? this.utilsService.fromRippleTime(credential.Expiration).est : 'N/A' },
                              { key: 'Credential Flags', value: this.utilsService.getCredentialStatus(credential.Flags) },
                              { key: 'Account Flags', value: flagNames(accountInfo.result.account_data.LedgerEntryType, accountInfo.result.account_data.Flags) },
                              { key: 'URI', value: credential.URI ? Buffer.from(credential.URI, 'hex').toString('utf8') : 'N/A' },
                              { key: 'PreviousTxnLgrSeq', value: credential.PreviousTxnLgrSeq?.toString() || 'N/A' },
                              { key: 'PreviousTxnID', value: credential.PreviousTxnID || 'N/A' },
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
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), accountInfo, wallet);
               this.refreshUiAccountInfo(accountInfo);
               this.utilsService.loadSignerList(wallet.classicAddress, this.signers);

               this.clearFields(false);

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

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ?? '', this.account1, this.account2, this.issuer),
               destination: this.credential.subject.destinationAddress,
               credentialType: this.credential.credential_type,
               isRegularKeyAddress: this.isRegularKeyAddress,
               regularKeyAddress: this.isRegularKeyAddress ? this.regularKeyAddress : undefined,
               regularKeySeed: this.isRegularKeyAddress ? this.regularKeySeed : undefined,
               useMultiSign: this.useMultiSign,
               multiSignAddresses: this.useMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.useMultiSign ? this.multiSignSeeds : undefined,
               isTicket: this.isTicket,
               ticketSequence: this.isTicket ? this.ticketSequence : undefined,
               date: this.credential.subject.expirationDate,
          };

          try {
               this.updateSpinnerMessage('Setting Credentials...');

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();
               const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');

               inputs = {
                    ...inputs,
                    account_info: accountInfo,
               };

               const errors = this.validateInputs(inputs, 'setCredentials');
               if (errors.length > 0) {
                    return this.setError(`ERROR: ${errors.join('; ')}`);
               }

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

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

               if (this.useMultiSign) {
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
                    signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, credentialCreateTx, fee)) {
                         return this.setError('ERROR: Insufficient XRP to complete transaction');
                    }
               }

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }
               console.log(`signedTx: ${JSON.stringify(signedTx, null, '\t')}`);

               this.updateSpinnerMessage('Submitting transaction to the Ledger...');
               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Submit Response:', JSON.stringify(response, null, 2));

               if (response.result.meta && typeof response.result.meta !== 'string' && response.result.meta.TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    console.error(`Transaction failed: ${JSON.stringify(response, null, 2)}`);
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), accountInfo, wallet);
               this.refreshUiAccountInfo(accountInfo);
               this.utilsService.loadSignerList(wallet.classicAddress, this.signers);

               this.clearFields(false);

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

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ?? '', this.account1, this.account2, this.issuer),
               credentialID: this.credentialID,
               credentialType: this.credential.credential_type,
               isRegularKeyAddress: this.isRegularKeyAddress,
               useMultiSign: this.useMultiSign,
               regularKeyAddress: this.isRegularKeyAddress ? this.regularKeyAddress : undefined,
               regularKeySeed: this.isRegularKeyAddress ? this.regularKeySeed : undefined,
               multiSignAddresses: this.useMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.useMultiSign ? this.multiSignSeeds : undefined,
               isTicket: this.isTicket,
               ticketSequence: this.isTicket ? this.ticketSequence : undefined,
          };

          try {
               this.updateSpinnerMessage('Removing Credentials...');

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();
               const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');

               inputs = {
                    ...inputs,
                    account_info: accountInfo,
               };
               const errors = this.validateInputs(inputs, 'removeCredentials');
               if (errors.length > 0) {
                    return this.setError(`ERROR: ${errors.join('; ')}`);
               }

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

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

               if (this.useMultiSign) {
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
                    signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, credentialDeleteTx, fee)) {
                         return this.setError('ERROR: Insufficient XRP to complete transaction');
                    }
               }

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }
               console.log(`signedTx: ${JSON.stringify(signedTx, null, '\t')}`);

               this.updateSpinnerMessage('Submitting transaction to the Ledger...');
               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Submit Response:', JSON.stringify(response, null, 2));

               if (response.result.meta && typeof response.result.meta !== 'string' && response.result.meta.TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    console.error(`Transaction failed: ${JSON.stringify(response, null, 2)}`);
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               this.clearFields(false);

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

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ?? '', this.account1, this.account2, this.issuer),
               credentialType: this.credential.credential_type,
               isRegularKeyAddress: this.isRegularKeyAddress,
               regularKeyAddress: this.isRegularKeyAddress ? this.regularKeyAddress : undefined,
               regularKeySeed: this.isRegularKeyAddress ? this.regularKeySeed : undefined,
               useMultiSign: this.useMultiSign,
               multiSignAddresses: this.useMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.useMultiSign ? this.multiSignSeeds : undefined,
               isTicket: this.isTicket,
               ticketSequence: this.isTicket ? this.ticketSequence : undefined,
          };

          try {
               this.updateSpinnerMessage('Accepting Credentials...');

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();
               const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');

               inputs = {
                    ...inputs,
                    account_info: accountInfo,
               };

               const errors = this.validateInputs(inputs, 'acceptCredentials');
               if (errors.length > 0) {
                    return this.setError(`ERROR: ${errors.join('; ')}`);
               }

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

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

               if (this.useMultiSign) {
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
                    signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, credentialAcceptTx, fee)) {
                         return this.setError('ERROR: Insufficient XRP to complete transaction');
                    }
               }

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }
               console.log(`signedTx: ${JSON.stringify(signedTx, null, '\t')}`);

               this.updateSpinnerMessage('Submitting transaction to the Ledger...');
               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Submit Response:', JSON.stringify(response, null, 2));

               if (response.result.meta && typeof response.result.meta !== 'string' && response.result.meta.TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    console.error(`Transaction failed: ${JSON.stringify(response, null, 2)}`);
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), accountInfo, wallet);
               this.refreshUiAccountInfo(accountInfo);
               this.utilsService.loadSignerList(wallet.classicAddress, this.signers);

               this.clearFields(false);

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

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ?? '', this.account1, this.account2, this.issuer),
               destination: this.credential.subject.destinationAddress,
               credentialID: this.credentialID,
               credentialType: this.credential.credential_type,
               isRegularKeyAddress: this.isRegularKeyAddress,
               useMultiSign: this.useMultiSign,
               regularKeyAddress: this.isRegularKeyAddress ? this.regularKeyAddress : undefined,
               regularKeySeed: this.isRegularKeyAddress ? this.regularKeySeed : undefined,
               multiSignAddresses: this.useMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.useMultiSign ? this.multiSignSeeds : undefined,
               isTicket: this.isTicket,
               ticketSequence: this.isTicket ? this.ticketSequence : undefined,
          };

          try {
               this.updateSpinnerMessage('Verify Credentials...');

               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();
               const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');

               inputs = {
                    ...inputs,
                    account_info: accountInfo,
               };

               const errors = this.validateInputs(inputs, 'verifyCredential');
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
                         { key: 'Expiration', value: this.utilsService.fromRippleTime(credential.Expiration).est || 'Credential' },
                         { key: 'Flags', value: this.utilsService.getCredentialStatus(credential.Flags) },
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

     private async updateXrpBalance(client: xrpl.Client, wallet: xrpl.Wallet) {
          const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, wallet.classicAddress);

          this.ownerCount = ownerCount;
          this.totalXrpReserves = totalXrpReserves;

          const balance = (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0');
          this.account1.balance = balance.toString();
     }

     private refreshUiAccountObjects(accountObjects: any, accountInfo: any, wallet: any) {
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

          const isValidDate = (value: string | undefined): string | null => {
               if (value && (!this.utilsService.validateInput(value) || !this.utilsService.isValidDate(value))) {
                    return 'Expiration Date is invalid';
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

          // Action-specific config: required fields and custom rules
          const actionConfig: Record<string, { required: (keyof ValidationInputs)[]; customValidators?: (() => string | null)[] }> = {
               getCredentialsForAccount: {
                    required: ['selectedAccount', 'seed'],
                    customValidators: [() => isValidSeed(inputs.seed), () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null)],
               },
               setCredentials: {
                    required: ['selectedAccount', 'seed', 'destination', 'credentialType', 'date'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidXrpAddress(inputs.destination, 'Destination address'),
                         () => isValidDate(inputs.date),
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
               },
               removeCredentials: {
                    required: ['selectedAccount', 'seed', 'credentialID', 'credentialType'],
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
                    ],
               },
               acceptCredentials: {
                    required: ['selectedAccount', 'seed', 'credentialType'],
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
                    ],
               },
               verifyCredential: {
                    required: ['selectedAccount', 'seed', 'destination', 'credentialID', 'credentialType'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidXrpAddress(inputs.destination, 'Destination address'),
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

     private updateDestinations() {
          // this.destinations = [...Object.values(this.knownDestinations)];
          this.destinations = Object.values(this.knownDestinations).filter((d): d is string => typeof d === 'string' && d.trim() !== '');
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

     populateDefaultDateTime() {
          if (!this.credential.subject.expirationDate) {
               const now = new Date();

               const year = now.getFullYear();
               const month = String(now.getMonth() + 1).padStart(2, '0');
               const day = String(now.getDate()).padStart(2, '0');
               const hours = String(now.getHours()).padStart(2, '0');
               const minutes = String(now.getMinutes()).padStart(2, '0');
               const seconds = String(now.getSeconds()).padStart(2, '0');

               this.credential.subject.expirationDate = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
          }
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

     clearFields(clearAllFields: boolean) {
          if (clearAllFields) {
               this.credential.credential_type = '';
               this.credentialID = '';
               this.credential.subject.destinationAddress = '';
               this.credential.uri = '';
               this.ticketSequence = '';
               this.isTicket = false;
               this.useMultiSign = false;
               this.isRegularKeyAddress = false;
          }
          this.memoField = '';
          this.isMemoEnabled = false;
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
