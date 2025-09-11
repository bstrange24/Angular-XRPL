import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import * as xrpl from 'xrpl';
import { StorageService } from '../../services/storage.service';
import { NFTokenMint, TransactionMetadataBase, NFTokenBurn, NFTokenAcceptOffer, NFTokenCreateOffer, NFTokenCancelOffer, NFTokenModify } from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';
import { WalletMultiInputComponent } from '../wallet-multi-input/wallet-multi-input.component';

interface ValidationInputs {
     selectedAccount?: 'account1' | 'account2' | 'issuer' | null;
     senderAddress?: string;
     seed?: string;
     nftIdField?: string;
     uri?: string;
     amount?: string;
     nftIndexField?: string;
     nftCountField?: string;
     issuerAddressField?: string;
     multiSignAddresses?: string;
     multiSignSeeds?: string;
     regularKeyAddress?: string;
     regularKeySeed?: string;
}

interface AccountFlags {
     asfRequireDest: boolean;
     asfRequireAuth: boolean;
     asfDisallowXRP: boolean;
     asfDisableMaster: boolean;
     asfNoFreeze: boolean;
     asfGlobalFreeze: boolean;
     asfDefaultRipple: boolean;
     asfDepositAuth: boolean;
     asfAllowTrustLineClawback: boolean;
     asfDisallowIncomingNFTokenOffer: boolean;
     asfDisallowIncomingCheck: boolean;
     asfDisallowIncomingPayChan: boolean;
     asfDisallowIncomingTrustline: boolean;
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
     selector: 'app-create-nft',
     standalone: true,
     imports: [CommonModule, FormsModule, WalletMultiInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './create-nft.component.html',
     styleUrl: './create-nft.component.css',
})
export class CreateNftComponent implements AfterViewChecked {
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
     isMultiSign: boolean = false;
     multiSignAddress: string = '';
     multiSignSeeds: string = '';
     isUpdateMetaData: boolean = false;
     isUpdateNFTMetaData: boolean = false;
     tickSize: string = '';
     transferRate: string = '';
     isMessageKey: boolean = false;
     domain: string = '';
     memo: string = '';
     memoField: string = '';
     isMemoEnabled: boolean = false;
     isRegularKeyAddress: boolean = false;
     regularKeySeed: string = '';
     regularKeyAddress: string = '';
     isTicket: boolean = false;
     isTicketEnabled: boolean = false;
     ticketSequence: string = '';
     signerQuorum: number = 0;
     burnableNft: { checked: any } | undefined;
     onlyXrpNft: { checked: any } | undefined;
     transferableNft: { checked: any } | undefined;
     mutableNft: { checked: any } | undefined;
     amountField: string = '';
     minterAddressField: string = '';
     issuerAddressField: string = '';
     expirationField: string = '';
     uriField: string = 'ipfs://bafybeidf5geku675serlvutcibc5n5fjnzqacv43mjfcrh4ur6hcn4xkw4.metadata.json';
     nftIdField: string = '';
     nftIndexField: string = '';
     nftCountField: string = '';
     spinnerMessage: string = '';
     flags: AccountFlags = {
          asfRequireDest: false,
          asfRequireAuth: false,
          asfDisallowXRP: false,
          asfDisableMaster: false,
          asfNoFreeze: false,
          asfGlobalFreeze: false,
          asfDefaultRipple: false,
          asfDepositAuth: false,
          asfAllowTrustLineClawback: false,
          asfDisallowIncomingNFTokenOffer: false,
          asfDisallowIncomingCheck: false,
          asfDisallowIncomingPayChan: false,
          asfDisallowIncomingTrustline: false,
     };
     spinner = false;
     signers: { account: string; seed: string; weight: number }[] = [{ account: '', seed: '', weight: 1 }];

     constructor(private xrplService: XrplService, private utilsService: UtilsService, private cdr: ChangeDetectorRef, private storageService: StorageService) {}

     ngOnInit() {}

     async ngAfterViewInit() {
          try {
               const wallet = await this.getWallet();
               this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
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

     toggleFlags() {}

     async getNFT() {
          console.log('Entering getNFT');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
          };
          const errors = this.validateInputs(inputs, 'get');
          if (errors.length > 0) {
               return this.setError(`ERROR: ${errors.join('; ')}`);
          }

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               this.showSpinnerWithDelay('Getting NFT Details ...', 100);

               const accountNfts = await this.xrplService.getAccountNFTs(client, wallet.classicAddress, 'validated', '');
               console.debug(`Account Nft objects: ${JSON.stringify(accountNfts, null, '\t')}`);

               // Prepare data for renderAccountDetails
               const data = {
                    sections: [{}],
               };

               if (accountNfts.result.account_nfts.length <= 0) {
                    data.sections.push({
                         title: 'NFTs',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No NFTs found for <code>${wallet.classicAddress}</code>` }],
                    });
               } else {
                    interface NFT {
                         NFTokenID: string;
                         NFTokenTaxon: number;
                         Issuer?: string;
                         URI?: string;
                         Flags: number;
                         TransferFee?: number;
                         nft_serial?: number;
                    }

                    interface NFTSectionContent {
                         key: string;
                         value: string;
                    }

                    interface NFTSectionSubItem {
                         key: string;
                         openByDefault: boolean;
                         content: NFTSectionContent[];
                    }

                    interface NFTSection {
                         title: string;
                         openByDefault: boolean;
                         subItems: NFTSectionSubItem[];
                    }

                    data.sections.push({
                         title: `NFTs (${accountNfts.result.account_nfts.length})`,
                         openByDefault: true,
                         subItems: (accountNfts.result.account_nfts as NFT[]).map((nft: NFT, index: number): NFTSectionSubItem => {
                              const { NFTokenID, NFTokenTaxon, Issuer, URI, Flags, TransferFee } = nft;
                              return {
                                   key: `NFT ${index + 1} (ID: ${NFTokenID.slice(0, 8)}...)`,
                                   openByDefault: false,
                                   content: [{ key: 'NFToken ID', value: `<code>${NFTokenID}</code>` }, { key: 'Taxon', value: String(NFTokenTaxon) }, ...(Issuer ? [{ key: 'Issuer', value: `<code>${Issuer}</code>` }] : []), ...(URI ? [{ key: 'URI', value: `<code>${this.utilsService.decodeHex(URI)}</code>` }] : []), { key: 'Flags', value: String(this.decodeNftFlags(Flags)) }, ...(TransferFee ? [{ key: 'Transfer Fee', value: `${TransferFee / 1000}%` }] : [])],
                              };
                         }),
                    });
               }

               this.utilsService.renderPaymentChannelDetails(data);
               this.setSuccess(this.result);
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), wallet);
               this.refreshUiAccountInfo(await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''));
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
               console.log(`Leaving getNFT in ${this.executionTime}ms`);
          }
     }

     async mintNFT() {
          console.log('Entering mintNFT');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               // issuerAddressField: this.issuerAddressField,
          };
          const errors = this.validateInputs(inputs, 'mint');
          if (errors.length > 0) {
               return this.setError(`ERROR: ${errors.join('; ')}`);
          }

          if (this.flags.asfNoFreeze && this.flags.asfGlobalFreeze) {
               return this.setError('ERROR: Cannot enable both NoFreeze and GlobalFreeze');
          }

          const flags = this.setNftFlags();

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.isMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               this.updateSpinnerMessage('Minting NFT ...');

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               const tx: NFTokenMint = {
                    TransactionType: 'NFTokenMint',
                    Account: wallet.classicAddress,
                    Flags: flags,
                    NFTokenTaxon: 0,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(tx, this.ticketSequence, true);
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    this.utilsService.setTicketSequence(tx, getAccountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(tx, this.memoField);
               }

               if (this.uriField) {
                    this.utilsService.setURI(tx, this.uriField);
               }

               if (this.issuerAddressField) {
                    if (!xrpl.isValidAddress(this.issuerAddressField)) {
                         this.setError('ERROR: Invalid Account address');
                    }
                    this.utilsService.setIssuerAddress(tx, this.issuerAddressField);
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
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: tx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         tx.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(tx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         tx.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));

                         if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, multiSignFee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    const preparedTx = await client.autofill(tx);
                    console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                    signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, fee)) {
                         return this.setError('ERROR: Insufficient XRP to complete transaction');
                    }
               }

               console.info(`Parse Tx Flags: ${JSON.stringify(xrpl.parseTransactionFlags(tx), null, '\t')}`);

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }
               console.log(`signedTx: ${JSON.stringify(signedTx, null, '\t')}`);

               this.updateSpinnerMessage('Submitting transaction to the Ledger ...');
               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Submit Response:', JSON.stringify(response, null, 2));

               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    console.error(`Transaction failed: ${JSON.stringify(response, null, 2)}`);
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
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
               console.log(`Leaving mintNFT in ${this.executionTime}ms`);
          }
     }

     async mintBatchNFT() {
          console.log('Entering mintBatchNFT');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               nftCountField: this.nftCountField,
               uri: this.uriField,
          };
          const errors = this.validateInputs(inputs, 'mintBatch');
          if (errors.length > 0) {
               return this.setError(`ERROR: ${errors.join('; ')}`);
          }

          const flags = this.setNftFlags();

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.isMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               this.updateSpinnerMessage('Minting Batch NFT ...');

               const transactionResults = [];

               // Build and submit each NFTokenMint
               for (let i = 0; i < parseInt(this.nftCountField); i++) {
                    const fee = await this.xrplService.calculateTransactionFee(client);
                    const currentLedger = await this.xrplService.getLastLedgerIndex(client);
                    const tx: NFTokenMint = {
                         TransactionType: 'NFTokenMint',
                         Account: wallet.classicAddress,
                         URI: xrpl.convertStringToHex(this.uriField),
                         Flags: flags,
                         NFTokenTaxon: 0,
                         LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                    };

                    if (this.ticketSequence) {
                         if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                              return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                         }
                         this.utilsService.setTicketSequence(tx, this.ticketSequence, true);
                    } else {
                         const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                         this.utilsService.setTicketSequence(tx, getAccountInfo.result.account_data.Sequence, false);
                    }

                    if (this.memoField) {
                         this.utilsService.setMemoField(tx, this.memoField);
                    }

                    try {
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
                                   const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: tx, signerAddresses, signerSeeds, fee });
                                   signedTx = result.signedTx;
                                   tx.Signers = result.signers;

                                   console.log('Payment with Signers:', JSON.stringify(tx, null, 2));

                                   if (!signedTx) {
                                        return this.setError('ERROR: No valid signature collected for multisign transaction');
                                   }

                                   const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                                   console.log(`multiSignFee: ${multiSignFee}`);
                                   tx.Fee = multiSignFee;
                                   const finalTx = xrpl.decode(signedTx.tx_blob);
                                   console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));

                                   if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, multiSignFee)) {
                                        return this.setError('ERROR: Insufficient XRP to complete transaction');
                                   }
                              } catch (err: any) {
                                   return this.setError(`ERROR: ${err.message}`);
                              }
                         } else {
                              const preparedTx = await client.autofill(tx);
                              console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                              signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                              if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, fee)) {
                                   return this.setError('ERROR: Insufficient XRP to complete transaction');
                              }
                         }

                         console.info(`Parse Tx Flags: ${JSON.stringify(xrpl.parseTransactionFlags(tx), null, '\t')}`);

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
                              return;
                         }

                         transactionResults.push(response);
                    } catch (singleError: any) {
                         console.error('Individual Transaction Error:', singleError);

                         // Retry if LastLedgerSequence expired
                         if (singleError.message.includes('LastLedgerSequence')) {
                              console.warn('Retrying transaction with updated LastLedgerSequence');
                              const preparedTx = await client.autofill(tx);
                              console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                              const signedTx = wallet.sign(preparedTx);
                              const singleTx = await client.submitAndWait(signedTx.tx_blob);
                              transactionResults.push(singleTx);
                         } else {
                              throw singleError; // Rethrow other errors
                         }
                    }
               }

               console.log('All NFT Mint Results:', transactionResults);

               // Render the last result (you could also render all if you prefer)
               const lastTx = transactionResults[transactionResults.length - 1];
               this.utilsService.renderTransactionsResults(lastTx, this.resultField.nativeElement);
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
               console.log(`Leaving mintBatchNFT in ${this.executionTime}ms`);
          }
     }

     async mintBatchNFT1() {
          console.log('Entering mintBatchNFT');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               nftCountField: this.nftCountField,
               uri: this.uriField,
          };
          const errors = this.validateInputs(inputs, 'mintBatch');
          if (errors.length > 0) {
               return this.setError(`ERROR: ${errors.join('; ')}`);
          }

          const flags = this.setNftFlags();

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.isMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               this.updateSpinnerMessage('Minting Batch NFT1 ...');

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               // Define tfInnerBatchTxn flag (try different values if 0x00010000 fails)
               const TF_INNER_BATCH_TXN = 1073741824; // 262144 in decimal

               const transactions: NFTokenMint[] = [];
               for (let i = 0; i < parseInt(this.nftCountField); i++) {
                    transactions.push({
                         TransactionType: 'NFTokenMint',
                         Account: wallet.classicAddress,
                         URI: xrpl.convertStringToHex(this.uriField),
                         Flags: flags | TF_INNER_BATCH_TXN, // Combine existing flags with tfInnerBatchTxn
                         NFTokenTaxon: 0,
                         Fee: '0', // Fee must be "0" for inner transactions
                    });
               }

               let tx;
               if (transactions.length > 1) {
                    const batchTx: any = {
                         TransactionType: 'Batch',
                         Account: wallet.classicAddress,
                         RawTransactions: transactions.map(trx => ({
                              RawTransaction: {
                                   TransactionType: trx.TransactionType,
                                   Account: trx.Account,
                                   URI: trx.URI,
                                   Flags: (Number(trx.Flags) || 0) | TF_INNER_BATCH_TXN, // Ensure tfInnerBatchTxn
                                   NFTokenTaxon: trx.NFTokenTaxon,
                                   Fee: '0', // Explicitly set Fee to "0"
                              }, // Exclude Sequence, LastLedgerSequence, SigningPubKey
                         })),
                    };
                    console.log('Submitting Batch Transaction:', JSON.stringify(batchTx, null, 2));
                    try {
                         // Autofill only the outer Batch transaction
                         const preparedBatchTx = await client.autofill(batchTx);
                         console.log('Prepared Batch Transaction:', JSON.stringify(preparedBatchTx, null, 2));
                         tx = await client.submitAndWait(preparedBatchTx, { wallet });
                    } catch (error) {
                         console.error('Batch Transaction Error:', error);
                         console.warn('Falling back to individual transactions due to Batch error');
                         const transactionResults = [];
                         for (const transaction of transactions) {
                              try {
                                   const preparedTx = await client.autofill({
                                        ...transaction,
                                        Flags: flags, // Remove tfInnerBatchTxn for individual transactions
                                        LastLedgerSequence: undefined, // Let autofill set a fresh LastLedgerSequence
                                   } as NFTokenMint);
                                   console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                                   const signedTx = wallet.sign(preparedTx);
                                   const singleTx = await client.submitAndWait(signedTx.tx_blob);
                                   if (singleTx.result.meta && typeof singleTx.result.meta !== 'string' && (singleTx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                                        this.utilsService.renderTransactionsResults(singleTx, this.resultField.nativeElement);
                                        return;
                                   }
                                   transactionResults.push(singleTx);
                              } catch (singleError: any) {
                                   console.error('Individual Transaction Error:', singleError);
                                   if (singleError.message.includes('LastLedgerSequence')) {
                                        console.warn('Retrying transaction with updated LastLedgerSequence');
                                        const preparedTx = await client.autofill({
                                             ...transaction,
                                             Flags: flags,
                                             LastLedgerSequence: undefined, // Retry with fresh LastLedgerSequence
                                        } as NFTokenMint);
                                        console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                                        const signedTx = wallet.sign(preparedTx);
                                        const singleTx = await client.submitAndWait(signedTx.tx_blob);
                                        if (singleTx.result.meta && typeof singleTx.result.meta !== 'string' && (singleTx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                                             this.utilsService.renderTransactionsResults(singleTx, this.resultField.nativeElement);
                                             return;
                                        }
                                        transactionResults.push(singleTx);
                                   } else {
                                        throw singleError; // Rethrow non-recoverable errors
                                   }
                              }
                         }
                         console.log('transactionResults', transactionResults);
                         tx = transactionResults[transactionResults.length - 1];
                    }
               } else {
                    const transactionResults = [];
                    for (const transaction of transactions) {
                         try {
                              const preparedTx = await client.autofill({
                                   ...transaction,
                                   Flags: flags, // Remove tfInnerBatchTxn for individual transactions
                                   LastLedgerSequence: undefined, // Let autofill set a fresh LastLedgerSequence
                              } as NFTokenMint);
                              console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                              const signedTx = wallet.sign(preparedTx);
                              const singleTx = await client.submitAndWait(signedTx.tx_blob);
                              if (singleTx.result.meta && typeof singleTx.result.meta !== 'string' && (singleTx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                                   this.utilsService.renderTransactionsResults(singleTx, this.resultField.nativeElement);
                                   return;
                              }
                              transactionResults.push(singleTx);
                         } catch (singleError: any) {
                              console.error('Individual Transaction Error:', singleError);
                              if (singleError.message.includes('LastLedgerSequence')) {
                                   console.warn('Retrying transaction with updated LastLedgerSequence');
                                   const preparedTx = await client.autofill({
                                        ...transaction,
                                        Flags: flags,
                                        LastLedgerSequence: undefined, // Retry with fresh LastLedgerSequence
                                   } as NFTokenMint);
                                   console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                                   const signedTx = wallet.sign(preparedTx);
                                   const singleTx = await client.submitAndWait(signedTx.tx_blob);
                                   if (singleTx.result.meta && typeof singleTx.result.meta !== 'string' && (singleTx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                                        this.utilsService.renderTransactionsResults(singleTx, this.resultField.nativeElement);
                                        return;
                                   }
                                   transactionResults.push(singleTx);
                              } else {
                                   throw singleError; // Rethrow non-recoverable errors
                              }
                         }
                    }
                    console.log('transactionResults', transactionResults);
                    tx = transactionResults[transactionResults.length - 1];
               }

               console.log('Mint NFT tx', tx);

               if (tx.result.meta && typeof tx.result.meta !== 'string' && (tx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
                    return;
               }

               // Render all successful transactions
               this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               await this.updateXrpBalance(client, wallet);
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving mintBatchNFT in ${this.executionTime}ms`);
          }
     }

     async burnNFT() {
          console.log('Entering burnNFT');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               nftIdField: this.nftIdField,
          };
          const errors = this.validateInputs(inputs, 'burn');
          if (errors.length > 0) {
               return this.setError(`ERROR: ${errors.join('; ')}`);
          }

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.isMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               this.updateSpinnerMessage('Burning NFT ...');

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               const tx: NFTokenBurn = {
                    TransactionType: 'NFTokenBurn',
                    Account: wallet.classicAddress,
                    NFTokenID: this.nftIdField,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(tx, this.ticketSequence, true);
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    this.utilsService.setTicketSequence(tx, getAccountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(tx, this.memoField);
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
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: tx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         tx.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(tx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         tx.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));

                         if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, multiSignFee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    const preparedTx = await client.autofill(tx);
                    console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                    signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, fee)) {
                         return this.setError('ERROR: Insufficient XRP to complete transaction');
                    }
               }

               console.info(`Parse Tx Flags: ${JSON.stringify(xrpl.parseTransactionFlags(tx), null, '\t')}`);

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }
               console.log(`signedTx: ${JSON.stringify(signedTx, null, '\t')}`);

               this.updateSpinnerMessage('Submitting transaction to the Ledger ...');
               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Submit Response:', JSON.stringify(response, null, 2));

               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    console.error(`Transaction failed: ${JSON.stringify(response, null, 2)}`);
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
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
               console.log(`Leaving burnNFT in ${this.executionTime}ms`);
          }
     }

     async getNFTOffers() {
          console.log('Entering getNFTOffers');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               nftIdField: this.nftIdField,
          };
          const errors = this.validateInputs(inputs, 'getOffers');
          if (errors.length > 0) {
               return this.setError(`ERROR: ${errors.join('; ')}`);
          }

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // Prepare data for rendering
               type SectionContent = { key: string; value: string };
               type SectionSubItem = { key: string; openByDefault: boolean; content: SectionContent[] };
               type Section = { title: string; openByDefault: boolean; content: SectionContent[] } | { title: string; openByDefault: boolean; subItems: SectionSubItem[] };
               const data: { sections: Section[] } = {
                    sections: [],
               };

               // Step 1: Verify NFT exists
               let nftExists = false;
               let nftDetails: { title: string; openByDefault: boolean; content: { key: string; value: string }[] } | undefined = undefined;

               interface NFT {
                    NFTokenID: string;
                    NFTokenTaxon: number;
                    Issuer?: string;
                    URI?: string;
                    Flags: number;
                    TransferFee?: number;
                    nft_serial?: number;
               }

               interface NFTSectionContent {
                    key: string;
                    value: string;
               }

               interface NFTSectionSubItem {
                    key: string;
                    openByDefault: boolean;
                    content: NFTSectionContent[];
               }

               interface NFTSection {
                    title: string;
                    openByDefault: boolean;
                    subItems: NFTSectionSubItem[];
               }

               try {
                    const accountObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '');
                    this.refreshUiAccountObjects(accountObjects, wallet);
                    // const signerAccounts: string[] = this.checkForSignerAccounts(accountObjects);
                    // if (signerAccounts && signerAccounts.length > 0) {
                    //      if (Array.isArray(signerAccounts) && signerAccounts.length > 0) {
                    //           const signerEntries: SignerEntry[] = this.storageService.get('signerEntries') || [];

                    //           this.multiSignAddress = signerAccounts.map(account => account.split('~')[0] + ',\n').join('');
                    //           this.multiSignSeeds = signerAccounts
                    //                .map(account => {
                    //                     const address = account.split('~')[0];
                    //                     const entry = signerEntries.find((entry: SignerEntry) => entry.Account === address);
                    //                     return entry ? entry.SingnerSeed : null;
                    //                })
                    //                .filter(seed => seed !== null)
                    //                .join(',\n');
                    //           this.isMultiSign = true;
                    //      }
                    // } else {
                    //      this.multiSignAddress = 'No Multi-Sign address configured for account';
                    //      this.multiSignSeeds = ''; // Clear seeds if no signer accounts
                    //      this.isMultiSign = false;
                    // }

                    const nftInfo = await this.xrplService.getAccountNFTs(client, wallet.classicAddress, 'validated', '');
                    console.debug(`Account Nft objects: ${JSON.stringify(nftInfo, null, '\t')}`);
                    const nfts = nftInfo.result.account_nfts || [];
                    interface AccountNFT {
                         NFTokenID: string;
                         NFTokenTaxon: number;
                         Issuer?: string;
                         URI?: string;
                         Flags: number;
                         TransferFee?: number;
                         nft_serial?: number;
                    }

                    nftExists = nfts.some((nft: AccountNFT) => nft.NFTokenID === this.nftIdField);
                    if (nftExists) {
                         const nft: NFT | undefined = nfts.find((nft: NFT) => nft.NFTokenID === this.nftIdField);
                         if (nft) {
                              nftDetails = {
                                   title: 'NFT Details',
                                   openByDefault: true,
                                   content: [{ key: 'NFToken ID', value: `<code>${nft.NFTokenID}</code>` }, { key: 'Issuer', value: `<code>${nft.Issuer || wallet.classicAddress}</code>` }, { key: 'Taxon', value: String(nft.NFTokenTaxon) }, ...(nft.URI ? [{ key: 'URI', value: `<code>${nft.URI}</code>` }] : []), { key: 'Serial', value: String(nft.nft_serial) }],
                              };
                              data.sections.push(nftDetails);
                         }
                    } else {
                         data.sections.push({
                              title: 'NFT Details',
                              openByDefault: true,
                              content: [{ key: 'Status', value: `No NFT found for TokenID <code>${this.nftIdField}</code> in account <code>${wallet.classicAddress}</code>` }],
                         });
                    }
               } catch (nftError: any) {
                    console.warn('Account NFTs Error:', nftError);
                    data.sections.push({
                         title: 'NFT Details',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `WARNING: Could not verify NFT existence: ${nftError.message}` }],
                    });
               }

               // Step 2: Fetch sell offers
               let sellOffers: any[] = [];
               try {
                    const sellOffersResponse = await this.xrplService.getNFTSellOffers(client, this.nftIdField);
                    sellOffers = sellOffersResponse.result.offers || [];
                    if (sellOffers.length === 0) {
                         data.sections.push({
                              title: 'Sell Offers',
                              openByDefault: true,
                              content: [
                                   {
                                        key: 'Status',
                                        value: 'No sell offers available',
                                   },
                              ],
                         });
                    } else {
                         interface SellOffer {
                              nft_offer_index: string;
                              amount?: string;
                              owner: string;
                              expiration?: number;
                              destination?: string;
                         }

                         interface SellSectionContent {
                              key: string;
                              value: string;
                         }

                         interface SellSectionSubItem {
                              key: string;
                              openByDefault: boolean;
                              content: SellSectionContent[];
                         }

                         interface SellSection {
                              title: string;
                              openByDefault: boolean;
                              subItems: SellSectionSubItem[];
                         }

                         const sellSection: SellSection = {
                              title: `Sell Offers (${sellOffers.length})`,
                              openByDefault: true,
                              subItems: sellOffers.length
                                   ? (sellOffers as SellOffer[]).map(
                                          (offer: SellOffer, index: number): SellSectionSubItem => ({
                                               key: `Sell Offer ${index + 1} (Index: ${offer.nft_offer_index.slice(0, 8)}...)`,
                                               openByDefault: false,
                                               content: [{ key: 'Offer Index', value: `<code>${offer.nft_offer_index}</code>` }, { key: 'Amount', value: offer.amount ? `${xrpl.dropsToXrp(offer.amount)} XRP` : 'Unknown' }, { key: 'Owner', value: `<code>${offer.owner}</code>` }, ...(offer.expiration ? [{ key: 'Expiration', value: new Date(offer.expiration * 1000).toISOString() }] : []), ...(offer.destination ? [{ key: 'Destination', value: `<code>${offer.destination}</code>` }] : [])],
                                          })
                                     )
                                   : [
                                          {
                                               key: 'No Sell Offers',
                                               openByDefault: false,
                                               content: [{ key: 'Status', value: 'No sell offers available' }],
                                          },
                                     ],
                         };
                         data.sections.push(sellSection);
                    }
               } catch (sellError: any) {
                    console.warn('Sell Offers Error:', sellError);
                    data.sections.push({
                         title: 'Sell Offers',
                         openByDefault: true,
                         content: [
                              {
                                   key: 'Status',
                                   value: sellError.message.includes('object was not found') || sellError.message.includes('act not found') ? 'No sell offers available' : `Error fetching sell offers: ${sellError.message}`,
                              },
                         ],
                    });
               }

               // Step 3: Fetch buy offers
               let buyOffers: any = [];
               try {
                    const buyOffersResponse = await this.xrplService.getNFTBuyOffers(client, this.nftIdField);
                    buyOffers = buyOffersResponse.result.offers || [];
                    if (buyOffers) {
                         data.sections.push({
                              title: 'Sell Offers',
                              openByDefault: true,
                              content: [
                                   {
                                        key: 'Status',
                                        value: 'No sell offers available',
                                   },
                              ],
                         });
                    } else {
                         interface BuyOffer {
                              nft_offer_index: string;
                              amount?: string;
                              owner: string;
                              expiration?: number;
                              destination?: string;
                         }

                         interface BuySectionContent {
                              key: string;
                              value: string;
                         }

                         interface BuySectionSubItem {
                              key: string;
                              openByDefault: boolean;
                              content: BuySectionContent[];
                         }

                         interface BuySection {
                              title: string;
                              openByDefault: boolean;
                              subItems: BuySectionSubItem[];
                         }

                         const buySection: BuySection = {
                              title: `Buy Offers (${buyOffers.length})`,
                              openByDefault: true,
                              subItems: buyOffers.length
                                   ? (buyOffers as BuyOffer[]).map(
                                          (offer: BuyOffer, index: number): BuySectionSubItem => ({
                                               key: `Buy Offer ${index + 1} (Index: ${offer.nft_offer_index.slice(0, 8)}...)`,
                                               openByDefault: false,
                                               content: [{ key: 'Offer Index', value: `<code>${offer.nft_offer_index}</code>` }, { key: 'Amount', value: offer.amount ? `${xrpl.dropsToXrp(offer.amount)} XRP` : 'Unknown' }, { key: 'Owner', value: `<code>${offer.owner}</code>` }, ...(offer.expiration ? [{ key: 'Expiration', value: new Date(offer.expiration * 1000).toISOString() }] : []), ...(offer.destination ? [{ key: 'Destination', value: `<code>${offer.destination}</code>` }] : [])],
                                          })
                                     )
                                   : [
                                          {
                                               key: 'No Buy Offers',
                                               openByDefault: false,
                                               content: [{ key: 'Status', value: 'No buy offers available' }],
                                          },
                                     ],
                         };
                         data.sections.push(buySection);
                    }
               } catch (buyError: any) {
                    console.warn('Buy Offers Error:', buyError);
                    data.sections.push({
                         title: 'Buy Offers',
                         openByDefault: true,
                         content: [
                              {
                                   key: 'Status',
                                   value: buyError.message.includes('object was not found') || buyError.message.includes('act not found') ? 'No buy offers available' : `Error fetching buy offers: ${buyError.message}`,
                              },
                         ],
                    });
               }

               this.utilsService.renderPaymentChannelDetails(data);
               this.setSuccess(this.result);
               this.refreshUiAccountObjects(await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), wallet);
               this.refreshUiAccountInfo(await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''));

               this.isMemoEnabled = false;
               this.memoField = '';

               await this.updateXrpBalance(client, wallet);
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getNFTOffers in ${this.executionTime}ms`);
          }
     }

     async buyNFT() {
          console.log('Entering buyNFT');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               nftIdField: this.nftIdField,
          };
          const errors = this.validateInputs(inputs, 'buy');
          if (errors.length > 0) {
               return this.setError(`ERROR: ${errors.join('; ')}`);
          }

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.isMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               this.updateSpinnerMessage('Buying NFT ...');

               let sellOffersResponse;
               try {
                    sellOffersResponse = await this.xrplService.getNFTSellOffers(client, this.nftIdField);
               } catch (error: any) {
                    console.error('Error:', error);
                    this.setError(`ERROR: ${error.message || 'Unknown error'}`);
               }

               if (!sellOffersResponse || !sellOffersResponse.result) {
                    this.setError('ERROR: No sell offers found for this NFT.');
                    return;
               }

               const sellOffer = sellOffersResponse.result.offers || [];
               if (!Array.isArray(sellOffer) || sellOffer.length === 0) {
                    this.setError('ERROR: No sell offers found for this NFT.');
                    return;
               }

               // Filter offers where:
               // - no Destination is specified (anyone can buy)
               // - OR destination matches our wallet
               // - And price is valid
               const validOffers = sellOffer.filter(offer => {
                    const isUnrestricted = !offer.Destination;
                    const isTargeted = offer.Destination === wallet.classicAddress;
                    return (isUnrestricted || isTargeted) && offer.amount;
               });

               if (validOffers.length === 0) {
                    this.setError('ERROR: No matching sell offers found for this wallet.');
               }

               // Sort by lowest price
               validOffers.sort((a, b) => parseInt(a.amount) - parseInt(b.amount));

               const matchingOffers = sellOffer.filter(o => o.amount && o.flags === 1); // 1 = tfSellNFToken
               console.log('Matching Offers:', matchingOffers);

               const selectedOffer = validOffers[0];
               console.log('First sell offer:', validOffers[0]);

               if (selectedOffer && selectedOffer.Destination) {
                    console.log(`This NFT is only purchasable by: ${selectedOffer.Destination}`);
               }

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               const tx: NFTokenAcceptOffer = {
                    TransactionType: 'NFTokenAcceptOffer',
                    Account: wallet.classicAddress,
                    NFTokenSellOffer: selectedOffer.nft_offer_index,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(tx, this.ticketSequence, true);
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    this.utilsService.setTicketSequence(tx, getAccountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(tx, this.memoField);
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
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: tx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         tx.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(tx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         tx.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));

                         if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, multiSignFee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    const preparedTx = await client.autofill(tx);
                    console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                    signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, fee)) {
                         return this.setError('ERROR: Insufficient XRP to complete transaction');
                    }
               }

               console.info(`Parse Tx Flags: ${JSON.stringify(xrpl.parseTransactionFlags(tx), null, '\t')}`);

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }
               console.log(`signedTx: ${JSON.stringify(signedTx, null, '\t')}`);

               this.updateSpinnerMessage('Submitting transaction to the Ledger ...');
               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Submit Response:', JSON.stringify(response, null, 2));

               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    console.error(`Transaction failed: ${JSON.stringify(response, null, 2)}`);
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
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
               console.log(`Leaving getNFTOffers in ${this.executionTime}ms`);
          }
     }

     async sellNFT() {
          console.log('Entering sellNFT');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               nftIdField: this.nftIdField,
               amount: this.amountField,
          };
          const errors = this.validateInputs(inputs, 'sell');
          if (errors.length > 0) {
               return this.setError(`ERROR: ${errors.join('; ')}`);
          }

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.isMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               this.updateSpinnerMessage('Selling NFT ...');

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               const tx: NFTokenCreateOffer = {
                    TransactionType: 'NFTokenCreateOffer',
                    Account: wallet.classicAddress,
                    NFTokenID: this.nftIdField,
                    Amount: xrpl.xrpToDrops(this.amountField),
                    Flags: 1, // Sell offer,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               // Add expiration if provided
               if (this.expirationField) {
                    const expirationDate = new Date();
                    expirationDate.setHours(expirationDate.getHours() + parseFloat(this.expirationField));
                    tx.Expiration = Math.floor(expirationDate.getTime() / 1000);
               }

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(tx, this.ticketSequence, true);
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    this.utilsService.setTicketSequence(tx, getAccountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(tx, this.memoField);
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
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: tx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         tx.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(tx, null, 2));
                         console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         tx.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));

                         if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, fee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    const preparedTx = await client.autofill(tx);
                    console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                    signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, fee)) {
                         return this.setError('ERROR: Insufficient XRP to complete transaction');
                    }
               }

               console.info(`Parse Tx Flags: ${JSON.stringify(xrpl.parseTransactionFlags(tx), null, '\t')}`);

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }
               console.log(`signedTx: ${JSON.stringify(signedTx, null, '\t')}`);

               this.updateSpinnerMessage('Submitting transaction to the Ledger ...');
               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Submit Response:', JSON.stringify(response, null, 2));

               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    console.error(`Transaction failed: ${JSON.stringify(response, null, 2)}`);
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
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
               console.log(`Leaving sellNFT in ${this.executionTime}ms`);
          }
     }

     async cancelBuyOffer() {
          console.log('Entering cancelBuyOffer');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               nftIndexField: this.nftIndexField,
          };
          const errors = this.validateInputs(inputs, 'cancelBuy');
          if (errors.length > 0) {
               return this.setError(`ERROR: ${errors.join('; ')}`);
          }

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.isMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               this.updateSpinnerMessage('Cancel NFT Buy Offer ...');

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               const tx: NFTokenCancelOffer = {
                    TransactionType: 'NFTokenCancelOffer',
                    Account: wallet.classicAddress,
                    NFTokenOffers: [this.nftIndexField],
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(tx, this.ticketSequence, true);
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    this.utilsService.setTicketSequence(tx, getAccountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(tx, this.memoField);
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
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: tx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         tx.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(tx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         tx.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));

                         if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, fee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    const preparedTx = await client.autofill(tx);
                    console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                    signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, fee)) {
                         return this.setError('ERROR: Insufficient XRP to complete transaction');
                    }
               }

               console.info(`Parse Tx Flags: ${JSON.stringify(xrpl.parseTransactionFlags(tx), null, '\t')}`);

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }
               console.log(`signedTx: ${JSON.stringify(signedTx, null, '\t')}`);

               this.updateSpinnerMessage('Submitting transaction to the Ledger ...');
               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Submit Response:', JSON.stringify(response, null, 2));

               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    console.error(`Transaction failed: ${JSON.stringify(response, null, 2)}`);
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
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
               console.log(`Leaving cancelBuyOffer in ${this.executionTime}ms`);
          }
     }

     async cancelSellOffer() {
          console.log('Entering cancelSellOffer');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               nftIndexField: this.nftIndexField,
          };
          const errors = this.validateInputs(inputs, 'cancelSell');
          if (errors.length > 0) {
               return this.setError(`ERROR: ${errors.join('; ')}`);
          }

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.isMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               this.updateSpinnerMessage('Cancel NFT Sell Offer ...');

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               const tx: NFTokenCancelOffer = {
                    TransactionType: 'NFTokenCancelOffer',
                    Account: wallet.classicAddress,
                    NFTokenOffers: [this.nftIndexField],
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    this.utilsService.setTicketSequence(tx, this.ticketSequence, true);
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    this.utilsService.setTicketSequence(tx, getAccountInfo.result.account_data.Sequence, false);
               }

               if (this.memoField) {
                    this.utilsService.setMemoField(tx, this.memoField);
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
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: tx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         tx.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(tx, null, 2));
                         console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         tx.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));

                         if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, fee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    const preparedTx = await client.autofill(tx);
                    console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                    signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, fee)) {
                         return this.setError('ERROR: Insufficient XRP to complete transaction');
                    }
               }

               console.info(`Parse Tx Flags: ${JSON.stringify(xrpl.parseTransactionFlags(tx), null, '\t')}`);

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }
               console.log(`signedTx: ${JSON.stringify(signedTx, null, '\t')}`);

               this.updateSpinnerMessage('Submitting transaction to the Ledger ...');
               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Submit Response:', JSON.stringify(response, null, 2));

               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    console.error(`Transaction failed: ${JSON.stringify(response, null, 2)}`);
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
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
               console.log(`Leaving cancelSellOffer in ${this.executionTime}ms`);
          }
     }

     async updateNFTMetadata() {
          console.log('Entering updateNFTMetadata');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer),
               nftIdField: this.nftIdField,
               uri: this.uriField,
          };
          const errors = this.validateInputs(inputs, 'updateMetadata');
          if (errors.length > 0) {
               return this.setError(`ERROR: ${errors.join('; ')}`);
          }

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.isMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               this.updateSpinnerMessage('Updating NFT Meta Data ...');

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               const tx: NFTokenModify = {
                    TransactionType: 'NFTokenModify',
                    Account: wallet.classicAddress,
                    NFTokenID: this.nftIdField,
                    URI: xrpl.convertStringToHex(this.uriField),
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

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
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: tx, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         tx.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(tx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         tx.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));

                         if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, multiSignFee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    const preparedTx = await client.autofill(tx);
                    console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                    signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, fee)) {
                         return this.setError('ERROR: Insufficient XRP to complete transaction');
                    }
               }

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }
               console.log(`signedTx: ${JSON.stringify(signedTx, null, '\t')}`);

               this.updateSpinnerMessage('Submitting transaction to the Ledger ...');
               const response = await client.submitAndWait(tx, { wallet });
               console.log('Submit Response:', JSON.stringify(response, null, 2));

               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    console.error(`Transaction failed: ${JSON.stringify(response, null, 2)}`);
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
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
               console.log(`Leaving updateNFTMetadata in ${this.executionTime}ms`);
          }
     }

     decodeNftFlags(value: number): string[] {
          const active: string[] = [];
          for (const [name, bit] of Object.entries(AppConstants.NFT_FLAGS)) {
               if ((value & bit) !== 0) {
                    active.push(name);
               }
          }
          return active;
     }

     setNftFlags() {
          let flags = 0;
          if (this.burnableNft) {
               flags = xrpl.NFTokenMintFlags.tfBurnable;
          }

          if (this.onlyXrpNft) {
               flags = xrpl.NFTokenMintFlags.tfOnlyXRP;
          }

          if (this.transferableNft) {
               flags |= xrpl.NFTokenMintFlags.tfTransferable;
          }

          if (this.mutableNft) {
               flags |= xrpl.NFTokenMintFlags.tfMutable;
          }

          console.log('flags ' + flags);
          return flags;
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

     private validateInputs(inputs: ValidationInputs, action: string): string[] {
          const errors: string[] = [];

          // Common validators as functions
          const isRequired = (value: string | null | undefined, fieldName: string): string | null => {
               if (value == null) {
                    return `${fieldName} cannot be empty`;
               }
               if (!this.utilsService.validateInput(value)) {
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

          const isNotSelfPayment = (sender: string | undefined, receiver: string | undefined): string | null => {
               if (sender && receiver && sender === receiver) {
                    return `Sender and receiver cannot be the same`;
               }
               return null;
          };

          const isValidNumber = (value: string | undefined, fieldName: string, minValue?: number): string | null => {
               if (value === undefined) return null; // Not required, so skip
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
                    const { type, value: detectedValue } = this.utilsService.detectXrpInputType(value);
                    if (detectedValue === 'unknown') {
                         return 'Account seed is invalid';
                    }
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
               return null;
          };

          // Action-specific config: required fields and custom rules
          const actionConfig: Record<string, { required: (keyof ValidationInputs)[]; customValidators?: (() => string | null)[] }> = {
               get: {
                    required: ['selectedAccount', 'seed'],
                    customValidators: [() => isValidSeed(inputs.seed)],
               },
               mint: {
                    required: ['selectedAccount', 'seed'],
                    customValidators: [() => isValidSeed(inputs.seed), () => isValidXrpAddress(inputs.issuerAddressField, 'Issuer address')],
               },
               mintBatch: {
                    required: ['selectedAccount', 'seed', 'nftCountField'],
                    customValidators: [() => isValidSeed(inputs.seed), () => isValidNumber(inputs.nftCountField, 'NFT count', 0), () => isRequired(inputs.uri, 'URI')],
               },
               burn: {
                    required: ['selectedAccount', 'seed', 'nftIdField'],
                    customValidators: [() => isValidSeed(inputs.seed), () => isRequired(inputs.nftIdField, 'NFT ID')],
               },
               getOffers: {
                    required: ['selectedAccount', 'seed', 'nftIdField'],
                    customValidators: [() => isValidSeed(inputs.seed), () => isRequired(inputs.nftIdField, 'NFT ID')],
               },
               buy: {
                    required: ['selectedAccount', 'seed', 'nftIdField'],
                    customValidators: [() => isValidSeed(inputs.seed), () => isRequired(inputs.nftIdField, 'NFT ID')],
               },
               sell: {
                    required: ['selectedAccount', 'seed', 'nftIdField', 'amount'],
                    customValidators: [() => isValidSeed(inputs.seed), () => isRequired(inputs.nftIdField, 'NFT ID'), () => isValidNumber(inputs.amount, 'Amount', 0)],
               },
               cancelBuy: {
                    required: ['selectedAccount', 'seed', 'nftIndexField'],
                    customValidators: [() => isValidSeed(inputs.seed), () => isRequired(inputs.nftIndexField, 'NFT Offer Index')],
               },
               cancelSell: {
                    required: ['selectedAccount', 'seed', 'nftIndexField'],
                    customValidators: [() => isValidSeed(inputs.seed), () => isRequired(inputs.nftIndexField, 'NFT Offer Index')],
               },
               updateMetadata: {
                    required: ['selectedAccount', 'seed', 'nftIdField', 'uri'],
                    customValidators: [() => isValidSeed(inputs.seed), () => isRequired(inputs.nftIdField, 'NFT ID'), () => isRequired(inputs.uri, 'URI')],
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

          // Always validate optional fields if provided (e.g., multi-sign, regular key)
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
                    await this.getNFT();
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

     clearFields(clearAllFields: boolean) {
          this.amountField = '';
          this.minterAddressField = '';
          this.issuerAddressField = '';
          this.expirationField = '';
          this.nftIdField = '';
          this.nftIndexField = '';
          this.nftCountField = '';
          this.memoField = '';
          this.isTicket = false;
          this.cdr.detectChanges();
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
