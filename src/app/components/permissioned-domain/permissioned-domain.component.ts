import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { StorageService } from '../../services/storage.service';
import * as xrpl from 'xrpl';
import { PermissionedDomainSet, PermissionedDomainDelete } from 'xrpl';
import { flagNames } from 'flagnames';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';
import { WalletMultiInputComponent } from '../wallet-multi-input/wallet-multi-input.component';

interface ValidationInputs {
     selectedAccount?: 'account1' | 'account2' | 'issuer' | null;
     seed?: string;
     destination?: string;
     domainId?: string;
     credentialType?: string;
     regularKeyAddress?: string;
     regularKeySeed?: string;
     multiSignAddresses?: string;
     multiSignSeeds?: string;
     ticketSequence?: string;
     date?: string;
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

interface PermissionedDomainInfo {
     AcceptedCredentials: {
          Credential: {
               CredentialType: string; // hex string for type, e.g. "4B5943..."
               Issuer: string; // XRPL account address
          };
     }[];
     Flags: number;
     LedgerEntryType: 'PermissionedDomain';
     Owner: string; // XRPL account address
     OwnerNode: string;
     PreviousTxnID: string; // Hash of previous transaction
     PreviousTxnLgrSeq: number; // Ledger sequence of that transaction
     Sequence: number; // Sequence of this object
     index: string; // Ledger object index (hash)
}

@Component({
     selector: 'app-permissioned-domain',
     standalone: true,
     imports: [CommonModule, FormsModule, WalletMultiInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './permissioned-domain.component.html',
     styleUrl: './permissioned-domain.component.css',
})
export class PermissionedDomainComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     selectedAccount: 'account1' | 'account2' | 'issuer' | null = 'account1'; // Initialize to 'account1' for default selection
     private lastResult: string = '';
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = true;
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
     domainId: string = '';
     credentialType: string = '';
     credentialData: string = '';
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
               this.utilsService.populateKnownDestinations(this.knownDestinations, this.account1.address, this.account2.address, this.issuer.address);
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

     async getPermissionedDomainForAccount() {
          console.log('Entering getPermissionedDomainForAccount');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ?? '', this.account1, this.account2, this.issuer),
          };
          const errors = this.validateInputs(inputs, 'getPermissionedDomainForAccount');
          if (errors.length > 0) {
               return this.setError(`ERROR: ${errors.join('; ')}`);
          }

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               this.showSpinnerWithDelay('Getting Credentials...', 200);

               const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
               if (accountInfo.result.account_data.length <= 0) {
                    this.resultField.nativeElement.innerHTML = `No account data found for ${wallet.classicAddress}`;
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }
               console.debug(`accountInfo for ${wallet.classicAddress} ${JSON.stringify(accountInfo.result, null, '\t')}`);

               const accountObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'permissioned_domain');
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
                         title: 'Permissioned Domain',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No permissioned domains found for <code>${wallet.classicAddress}</code>` }],
                    });
               } else {
                    const permissionedDomainItems = accountObjects.result.account_objects.map((pd: any, index: number) => {
                         const domain = pd as PermissionedDomainInfo;
                         return {
                              key: `Permissioned Domain ${index + 1}`,
                              openByDefault: index === 0, // Open the first one by default
                              content: [
                                   ...domain.AcceptedCredentials.flatMap((cred, cIndex) => [
                                        {
                                             key: `Credential Type`,
                                             value: Buffer.from(cred.Credential.CredentialType, 'hex').toString('utf8') || 'N/A',
                                        },
                                        {
                                             key: `Credential Issuer`,
                                             value: cred.Credential.Issuer || 'N/A',
                                        },
                                   ]),
                                   { key: 'Owner', value: domain.Owner || 'N/A' },
                                   // { key: 'LedgerEntryType', value: domain.LedgerEntryType || 'N/A' },
                                   { key: 'Index', value: domain.index || 'N/A' },
                                   { key: 'Flags', value: domain.LedgerEntryType === 'PermissionedDomain' ? 'None' : flagNames(domain.LedgerEntryType, domain.Flags ?? 0) },
                                   { key: 'Sequence', value: domain.Sequence?.toString() || 'N/A' },
                                   { key: 'PreviousTxnID', value: domain.PreviousTxnID || 'N/A' },
                                   { key: 'PreviousTxnLgrSeq', value: domain.PreviousTxnLgrSeq?.toString() || 'N/A' },
                              ],
                         };
                    });

                    data.sections.push({
                         title: `Permissioned Domain (${accountObjects.result.account_objects.length})`,
                         openByDefault: true,
                         subItems: permissionedDomainItems,
                    });
               }

               this.utilsService.renderPaymentChannelDetails(data);
               this.setSuccess(this.result);
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), wallet);
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
               console.log(`Leaving getPermissionedDomainForAccount in ${this.executionTime}ms`);
          }
     }

     async setPermissionedDomain() {
          console.log('Entering setPermissionedDomain');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ?? '', this.account1, this.account2, this.issuer),
               destination: this.credential.subject.destinationAddress,
               credentialType: this.credential.credential_type,
               regularKeyAddress: this.isRegularKeyAddress ? this.regularKeyAddress : undefined,
               regularKeySeed: this.isRegularKeyAddress ? this.regularKeySeed : undefined,
               multiSignAddresses: this.isMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.isMultiSign ? this.multiSignSeeds : undefined,
               ticketSequence: this.isTicket ? this.ticketSequence : undefined,
          };
          const errors = this.validateInputs(inputs, 'setPermissionedDomain');
          if (errors.length > 0) {
               return this.setError(`ERROR: ${errors.join('; ')}`);
          }

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.isMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               this.updateSpinnerMessage('Setting Permissioned Domain...');

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               const permissionedDomainTx: PermissionedDomainSet = {
                    TransactionType: 'PermissionedDomainSet',
                    Account: wallet.classicAddress,
                    AcceptedCredentials: [
                         {
                              Credential: {
                                   Issuer: this.credential.subject.destinationAddress,
                                   CredentialType: Buffer.from(this.credential.credential_type || 'defaultCredentialType', 'utf8').toString('hex'),
                              },
                         },
                    ],
                    // Flags: 0,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(permissionedDomainTx, this.ticketSequence, true);
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    this.utilsService.setTicketSequence(permissionedDomainTx, getAccountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(permissionedDomainTx, this.memoField);
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
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: permissionedDomainTx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         permissionedDomainTx.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(permissionedDomainTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         permissionedDomainTx.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));

                         if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, permissionedDomainTx, multiSignFee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    console.log('CredentialCreate Tx:', JSON.stringify(permissionedDomainTx, null, 2));
                    const preparedTx = await client.autofill(permissionedDomainTx);
                    signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, permissionedDomainTx, fee)) {
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
               console.log(`Leaving setPermissionedDomain in ${this.executionTime}ms`);
          }
     }

     async deletePermissionedDomain() {
          console.log('Entering deletePermissionedDomain');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ?? '', this.account1, this.account2, this.issuer),
               domainId: this.domainId,
               regularKeyAddress: this.isRegularKeyAddress ? this.regularKeyAddress : undefined,
               regularKeySeed: this.isRegularKeyAddress ? this.regularKeySeed : undefined,
               multiSignAddresses: this.isMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.isMultiSign ? this.multiSignSeeds : undefined,
               ticketSequence: this.isTicket ? this.ticketSequence : undefined,
          };
          const errors = this.validateInputs(inputs, 'deletePermissionedDomain');
          if (errors.length > 0) {
               return this.setError(`ERROR: ${errors.join('; ')}`);
          }

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.isMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               this.updateSpinnerMessage('Deleting Permissioned Domain...');

               const accountObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'permissioned_domain');
               console.debug(`accountObjects for ${wallet.classicAddress} ${JSON.stringify(accountObjects.result, null, '\t')}`);

               const permissionDomainFound = accountObjects.result.account_objects.find((line: any) => {
                    return line.LedgerEntryType === 'PermissionedDomain' && line.index === this.domainId;
               });

               // If not found, exit early
               if (!permissionDomainFound) {
                    this.resultField.nativeElement.innerHTML = `No Permission Domain found for ${wallet.classicAddress} with ID ${this.domainId}`;
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               const permissionedDomainDeleteTx: PermissionedDomainDelete = {
                    TransactionType: 'PermissionedDomainDelete',
                    Account: wallet.classicAddress,
                    DomainID: this.domainId,
                    Fee: fee,
                    // Flags: 0,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(permissionedDomainDeleteTx, this.ticketSequence, true);
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    this.utilsService.setTicketSequence(permissionedDomainDeleteTx, getAccountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(permissionedDomainDeleteTx, this.memoField);
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
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: permissionedDomainDeleteTx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         permissionedDomainDeleteTx.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(permissionedDomainDeleteTx, null, 2));
                         console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         permissionedDomainDeleteTx.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));

                         if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, permissionedDomainDeleteTx, multiSignFee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    console.log('permissionedDomainDeleteTx before autofill:', JSON.stringify(permissionedDomainDeleteTx, null, 2));
                    const preparedTx = await client.autofill(permissionedDomainDeleteTx);
                    signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, permissionedDomainDeleteTx, fee)) {
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
               console.log(`Leaving deletePermissionedDomain in ${this.executionTime}ms`);
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

          // Action-specific config: required fields and custom rules
          const actionConfig: Record<string, { required: (keyof ValidationInputs)[]; customValidators?: (() => string | null)[] }> = {
               getPermissionedDomainForAccount: {
                    required: ['selectedAccount', 'seed'],
                    customValidators: [() => isValidSeed(inputs.seed)],
               },
               setPermissionedDomain: {
                    required: ['selectedAccount', 'seed', 'destination', 'credentialType'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidXrpAddress(inputs.destination, 'Destination address'),
                         () => (this.isTicket ? isRequired(inputs.ticketSequence, 'Ticket Sequence') : null),
                         () => (this.isTicket ? isValidNumber(inputs.ticketSequence, 'Ticket Sequence', 0) : null),
                         () => (this.isRegularKeyAddress && !this.isMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (this.isRegularKeyAddress && !this.isMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => (this.isRegularKeyAddress && !this.isMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (this.isRegularKeyAddress && !this.isMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                    ],
               },
               deletePermissionedDomain: {
                    required: ['selectedAccount', 'seed', 'domainId'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => (this.isTicket ? isRequired(inputs.ticketSequence, 'Ticket Sequence') : null),
                         () => (this.isTicket ? isValidNumber(inputs.ticketSequence, 'Ticket Sequence', 0) : null),
                         () => (this.isRegularKeyAddress && !this.isMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (this.isRegularKeyAddress && !this.isMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => (this.isRegularKeyAddress && !this.isMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (this.isRegularKeyAddress && !this.isMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
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
                    await this.getPermissionedDomainForAccount();
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
               this.credential.subject.destinationAddress = '';
               this.credential.uri = '';
               this.ticketSequence = '';
               this.isTicket = false;
               this.isMultiSign = false;
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
