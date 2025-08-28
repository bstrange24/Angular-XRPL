import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { WalletInputComponent } from '../wallet-input/wallet-input.component';
import * as xrpl from 'xrpl';
import { StorageService } from '../../services/storage.service';
import { AccountSet, NFTokenMint, TransactionMetadataBase, NFTokenBurn, NFTokenAcceptOffer, NFTokenCreateOffer, NFTokenCancelOffer, NFTokenModify } from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';

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
     imports: [CommonModule, FormsModule, WalletInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './create-nft.component.html',
     styleUrl: './create-nft.component.css',
})
export class CreateNftComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     @ViewChild('accountForm') accountForm!: NgForm;
     selectedAccount: 'account1' | 'account2' | null = 'account1';
     private lastResult: string = '';
     transactionInput: string = '';
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = false;
     account1 = { name: '', address: '', seed: '', balance: '' };
     account2 = { name: '', address: '', seed: '', balance: '' };
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
               this.loadSignerList(wallet.classicAddress);
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

     onWalletInputChange(event: { account1: any; account2: any }) {
          this.account1 = { ...event.account1, balance: '0' };
          this.account2 = { ...event.account2, balance: '0' };
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
          }
     }

     toggleFlags() {
          // Handled by *ngIf in template
     }

     toggleTicketSequence() {
          this.cdr.detectChanges();
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

     updateSpinnerMessage(message: string) {
          this.spinnerMessage = message;
          this.cdr.detectChanges();
          console.log('Spinner message updated:', message);
     }

     async showSpinnerWithDelay(message: string, delayMs: number = 200) {
          this.spinner = true;
          this.updateSpinnerMessage(message);
          await new Promise(resolve => setTimeout(resolve, delayMs));
     }

     async getNFT() {
          console.log('Entering getNFT');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const accountNfts = await this.xrplService.getAccountNFTs(client, wallet.classicAddress, 'validated', '');
               console.debug(`accountNfts ${accountNfts}`);

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
               this.loadSignerList(wallet.classicAddress);

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

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          if (this.flags.asfNoFreeze && this.flags.asfGlobalFreeze) {
               return this.setError('ERROR: Cannot enable both NoFreeze and GlobalFreeze');
          }

          const flags = this.setNftFlags();

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();

               let regularKeyWalletSignTx: any = '';
               let useRegularKeyWalletSignTx = false;
               if (this.isRegularKeyAddress && !this.isMultiSign) {
                    console.log('Using Regular Key Seed for transaction signing');
                    regularKeyWalletSignTx = await this.utilsService.getWallet(this.regularKeySeed, environment);
                    useRegularKeyWalletSignTx = true;
               }

               const wallet = await this.getWallet();
               // let seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
               // const wallet = await this.utilsService.getWallet(seed, environment);
               // if (!wallet) {
               //      return this.setError('ERROR: Wallet could not be created or is undefined');
               // }

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               const transaction: NFTokenMint = {
                    TransactionType: 'NFTokenMint',
                    Account: wallet.classicAddress,
                    Flags: flags,
                    NFTokenTaxon: 0,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               if (this.issuerAddressField) {
                    if (!xrpl.isValidAddress(this.issuerAddressField)) {
                         this.setError('ERROR: Invalid Account address');
                    }
                    transaction.Issuer = this.issuerAddressField;
               }

               if (this.uriField) {
                    transaction.URI = xrpl.convertStringToHex(this.uriField);
               }

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    transaction.TicketSequence = Number(this.ticketSequence);
                    transaction.Sequence = 0;
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    transaction.Sequence = getAccountInfo.result.account_data.Sequence;
               }

               if (this.memoField) {
                    transaction.Memos = [
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
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: transaction, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         transaction.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(transaction, null, 2));
                         console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         transaction.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    const preparedTx = await client.autofill(transaction);
                    if (useRegularKeyWalletSignTx) {
                         signedTx = regularKeyWalletSignTx.sign(preparedTx);
                    } else {
                         signedTx = wallet.sign(preparedTx);
                    }
               }

               console.info(`Parse Tx Flags: ${JSON.stringify(xrpl.parseTransactionFlags(transaction), null, '\t')}`);
               this.updateSpinnerMessage('Submitting transaction to the Ledger ...');

               if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, transaction, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }

               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Submit Response:', JSON.stringify(response, null, 2));

               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

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

          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }

          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;

          if (!this.utilsService.validateInput(seed)) {
               return this.setError('ERROR: Account seed cannot be empty');
          }

          const flags = this.setNftFlags();

          try {
               const { environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();

               let regularKeyWalletSignTx: any = '';
               let useRegularKeyWalletSignTx = false;
               if (this.isRegularKeyAddress && !this.isMultiSign) {
                    console.log('Using Regular Key Seed for transaction signing');
                    regularKeyWalletSignTx = await this.utilsService.getWallet(this.regularKeySeed, environment);
                    useRegularKeyWalletSignTx = true;
               }

               const wallet = await this.getWallet();
               // let seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
               // const wallet = await this.utilsService.getWallet(seed, environment);
               // if (!wallet) {
               //      return this.setError('ERROR: Wallet could not be created or is undefined');
               // }

               const transactionResults = [];

               // Build and submit each NFTokenMint
               for (let i = 0; i < parseInt(this.nftCountField); i++) {
                    const fee = await this.xrplService.calculateTransactionFee(client);
                    const currentLedger = await this.xrplService.getLastLedgerIndex(client);
                    const transaction: NFTokenMint = {
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
                         transaction.TicketSequence = Number(this.ticketSequence);
                         transaction.Sequence = 0;
                    } else {
                         const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                         transaction.Sequence = getAccountInfo.result.account_data.Sequence;
                    }

                    if (this.memoField) {
                         transaction.Memos = [
                              {
                                   Memo: {
                                        MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                                        MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                                   },
                              },
                         ];
                    }

                    try {
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
                                   const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: transaction, signerAddresses, signerSeeds, fee });
                                   signedTx = result.signedTx;
                                   transaction.Signers = result.signers;

                                   console.log('Payment with Signers:', JSON.stringify(transaction, null, 2));
                                   console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                                   if (!signedTx) {
                                        return this.setError('ERROR: No valid signature collected for multisign transaction');
                                   }

                                   const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                                   console.log(`multiSignFee: ${multiSignFee}`);
                                   transaction.Fee = multiSignFee;
                                   const finalTx = xrpl.decode(signedTx.tx_blob);
                                   console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));
                              } catch (err: any) {
                                   return this.setError(`ERROR: ${err.message}`);
                              }
                         } else {
                              const preparedTx = await client.autofill(transaction);
                              if (useRegularKeyWalletSignTx) {
                                   signedTx = regularKeyWalletSignTx.sign(preparedTx);
                              } else {
                                   signedTx = wallet.sign(preparedTx);
                              }
                         }

                         console.info(`Parse Tx Flags: ${JSON.stringify(xrpl.parseTransactionFlags(transaction), null, '\t')}`);
                         this.updateSpinnerMessage('Submitting transaction to the Ledger ...');

                         if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, transaction, fee)) {
                              return this.setError('ERROR: Insufficient XRP to complete transaction');
                         }

                         if (!signedTx) {
                              return this.setError('ERROR: Failed to sign transaction.');
                         }

                         const response = await client.submitAndWait(signedTx.tx_blob);
                         console.log('Submit Response:', JSON.stringify(response, null, 2));
                         // // Autofill handles Fee, Sequence, LastLedgerSequence
                         // const preparedTx = await client.autofill(transaction);
                         // const signedTx = wallet.sign(preparedTx);
                         // const singleTx = await client.submitAndWait(signedTx.tx_blob);

                         if (response.result.meta && typeof response.result.meta !== 'string' && response.result.meta.TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                              this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                              this.resultField.nativeElement.classList.add('error');
                              this.setErrorProperties();
                              return;
                         }

                         transactionResults.push(response);
                    } catch (singleError: any) {
                         console.error('Individual Transaction Error:', singleError);

                         // Retry if LastLedgerSequence expired
                         if (singleError.message.includes('LastLedgerSequence')) {
                              console.warn('Retrying transaction with updated LastLedgerSequence');
                              const preparedTx = await client.autofill(transaction);
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

          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }

          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
          if (!this.utilsService.validateInput(seed)) {
               return this.setError('ERROR: Account seed cannot be empty');
          }

          const flags = this.setNftFlags();

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();

               let regularKeyWalletSignTx: any = '';
               let useRegularKeyWalletSignTx = false;
               if (this.isRegularKeyAddress && !this.isMultiSign) {
                    console.log('Using Regular Key Seed for transaction signing');
                    regularKeyWalletSignTx = await this.utilsService.getWallet(this.regularKeySeed, environment);
                    useRegularKeyWalletSignTx = true;
               }

               const wallet = await this.getWallet();

               // let seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
               // const wallet = await this.utilsService.getWallet(seed, environment);
               // if (!wallet) {
               //      return this.setError('ERROR: Wallet could not be created or is undefined');
               // }

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
                                   const signedTx = wallet.sign(preparedTx);
                                   const singleTx = await client.submitAndWait(signedTx.tx_blob);
                                   if (singleTx.result.meta && typeof singleTx.result.meta !== 'string' && (singleTx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                                        this.utilsService.renderTransactionsResults(singleTx, this.resultField.nativeElement);
                                        this.resultField.nativeElement.classList.add('error');
                                        this.setErrorProperties();
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
                                        const signedTx = wallet.sign(preparedTx);
                                        const singleTx = await client.submitAndWait(signedTx.tx_blob);
                                        if (singleTx.result.meta && typeof singleTx.result.meta !== 'string' && (singleTx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                                             this.utilsService.renderTransactionsResults(singleTx, this.resultField.nativeElement);
                                             this.resultField.nativeElement.classList.add('error');
                                             this.setErrorProperties();
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
                              const signedTx = wallet.sign(preparedTx);
                              const singleTx = await client.submitAndWait(signedTx.tx_blob);
                              if (singleTx.result.meta && typeof singleTx.result.meta !== 'string' && (singleTx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                                   this.utilsService.renderTransactionsResults(singleTx, this.resultField.nativeElement);
                                   this.resultField.nativeElement.classList.add('error');
                                   this.setErrorProperties();
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
                                   const signedTx = wallet.sign(preparedTx);
                                   const singleTx = await client.submitAndWait(signedTx.tx_blob);
                                   if (singleTx.result.meta && typeof singleTx.result.meta !== 'string' && (singleTx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                                        this.utilsService.renderTransactionsResults(singleTx, this.resultField.nativeElement);
                                        this.resultField.nativeElement.classList.add('error');
                                        this.setErrorProperties();
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
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
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

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed,
               nftIdField: this.nftIdField,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();

               let regularKeyWalletSignTx: any = '';
               let useRegularKeyWalletSignTx = false;
               if (this.isRegularKeyAddress && !this.isMultiSign) {
                    console.log('Using Regular Key Seed for transaction signing');
                    regularKeyWalletSignTx = await this.utilsService.getWallet(this.regularKeySeed, environment);
                    useRegularKeyWalletSignTx = true;
               }

               const wallet = await this.getWallet();
               // let seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
               // const wallet = await this.utilsService.getWallet(seed, environment);
               // if (!wallet) {
               //      return this.setError('ERROR: Wallet could not be created or is undefined');
               // }

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               const transaction: NFTokenBurn = {
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
                    transaction.TicketSequence = Number(this.ticketSequence);
                    transaction.Sequence = 0;
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    transaction.Sequence = getAccountInfo.result.account_data.Sequence;
               }

               if (this.memoField) {
                    transaction.Memos = [
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
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: transaction, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         transaction.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(transaction, null, 2));
                         console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         transaction.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    const preparedTx = await client.autofill(transaction);
                    if (useRegularKeyWalletSignTx) {
                         signedTx = regularKeyWalletSignTx.sign(preparedTx);
                    } else {
                         signedTx = wallet.sign(preparedTx);
                    }
               }

               console.info(`Parse Tx Flags: ${JSON.stringify(xrpl.parseTransactionFlags(transaction), null, '\t')}`);
               this.updateSpinnerMessage('Submitting transaction to the Ledger ...');

               if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, transaction, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }

               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Submit Response:', JSON.stringify(response, null, 2));

               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

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

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed,
               nftIdField: this.nftIdField,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               // const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();
               // let seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
               // const wallet = await this.utilsService.getWallet(seed, environment);
               // if (!wallet) {
               //      return this.setError('ERROR: Wallet could not be created or is undefined');
               // }

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
                    const signerAccounts: string[] = this.checkForSignerAccounts(accountObjects);
                    if (signerAccounts && signerAccounts.length > 0) {
                         if (Array.isArray(signerAccounts) && signerAccounts.length > 0) {
                              const signerEntries: SignerEntry[] = this.storageService.get('signerEntries') || [];

                              this.multiSignAddress = signerAccounts.map(account => account.split('~')[0] + ',\n').join('');
                              this.multiSignSeeds = signerAccounts
                                   .map(account => {
                                        const address = account.split('~')[0];
                                        const entry = signerEntries.find((entry: SignerEntry) => entry.Account === address);
                                        return entry ? entry.SingnerSeed : null;
                                   })
                                   .filter(seed => seed !== null)
                                   .join(',\n');
                              this.isMultiSign = true;
                         }
                    } else {
                         this.multiSignAddress = 'No Multi-Sign address configured for account';
                         this.multiSignSeeds = ''; // Clear seeds if no signer accounts
                         this.isMultiSign = false;
                    }

                    const nftInfo = await this.xrplService.getAccountNFTs(client, wallet.classicAddress, 'validated', '');
                    console.debug(`accountNfts ${nftInfo}`);
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

               this.isMemoEnabled = false;
               this.memoField = '';

               const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
               if (accountInfo.result.account_data && accountInfo.result.account_data.RegularKey) {
                    this.isRegularKeyAddress = true;
                    this.regularKeyAddress = accountInfo.result.account_data.RegularKey;
                    this.regularKeySeed = this.storageService.get('regularKeySeed');
               } else {
                    this.isRegularKeyAddress = false;
                    this.regularKeyAddress = 'No RegularKey configured for account';
                    this.regularKeySeed = '';
               }

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

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed,
               nftIdField: this.nftIdField,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               let regularKeyWalletSignTx: any = '';
               let useRegularKeyWalletSignTx = false;
               if (this.isRegularKeyAddress && !this.isMultiSign) {
                    console.log('Using Regular Key Seed for transaction signing');
                    regularKeyWalletSignTx = await this.utilsService.getWallet(this.regularKeySeed, environment);
                    useRegularKeyWalletSignTx = true;
               }

               const wallet = await this.getWallet();
               // let seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
               // const wallet = await this.utilsService.getWallet(seed, environment);
               // if (!wallet) {
               //      return this.setError('ERROR: Wallet could not be created or is undefined');
               // }

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

               const transaction: NFTokenAcceptOffer = {
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
                    transaction.TicketSequence = Number(this.ticketSequence);
                    transaction.Sequence = 0;
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    transaction.Sequence = getAccountInfo.result.account_data.Sequence;
               }

               if (this.memoField) {
                    transaction.Memos = [
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
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: transaction, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         transaction.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(transaction, null, 2));
                         console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         transaction.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    const preparedTx = await client.autofill(transaction);
                    if (useRegularKeyWalletSignTx) {
                         signedTx = regularKeyWalletSignTx.sign(preparedTx);
                    } else {
                         signedTx = wallet.sign(preparedTx);
                    }
               }

               console.info(`Parse Tx Flags: ${JSON.stringify(xrpl.parseTransactionFlags(transaction), null, '\t')}`);
               this.updateSpinnerMessage('Submitting transaction to the Ledger ...');

               if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, transaction, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }

               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Submit Response:', JSON.stringify(response, null, 2));

               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

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

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed,
               nftIdField: this.nftIdField,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               let regularKeyWalletSignTx: any = '';
               let useRegularKeyWalletSignTx = false;
               if (this.isRegularKeyAddress && !this.isMultiSign) {
                    console.log('Using Regular Key Seed for transaction signing');
                    regularKeyWalletSignTx = await this.utilsService.getWallet(this.regularKeySeed, environment);
                    useRegularKeyWalletSignTx = true;
               }

               const wallet = await this.getWallet();
               // let seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
               // const wallet = await this.utilsService.getWallet(seed, environment);
               // if (!wallet) {
               //      return this.setError('ERROR: Wallet could not be created or is undefined');
               // }

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               const transaction: NFTokenCreateOffer = {
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
                    transaction.Expiration = Math.floor(expirationDate.getTime() / 1000);
               }

               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }
                    transaction.TicketSequence = Number(this.ticketSequence);
                    transaction.Sequence = 0;
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    transaction.Sequence = getAccountInfo.result.account_data.Sequence;
               }

               if (this.memoField) {
                    transaction.Memos = [
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
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: transaction, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         transaction.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(transaction, null, 2));
                         console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         transaction.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    const preparedTx = await client.autofill(transaction);
                    if (useRegularKeyWalletSignTx) {
                         signedTx = regularKeyWalletSignTx.sign(preparedTx);
                    } else {
                         signedTx = wallet.sign(preparedTx);
                    }
               }

               console.info(`Parse Tx Flags: ${JSON.stringify(xrpl.parseTransactionFlags(transaction), null, '\t')}`);
               this.updateSpinnerMessage('Submitting transaction to the Ledger ...');

               if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, transaction, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }

               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Submit Response:', JSON.stringify(response, null, 2));

               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

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

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed,
               nftIdField: this.nftIdField,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               let regularKeyWalletSignTx: any = '';
               let useRegularKeyWalletSignTx = false;
               if (this.isRegularKeyAddress && !this.isMultiSign) {
                    console.log('Using Regular Key Seed for transaction signing');
                    regularKeyWalletSignTx = await this.utilsService.getWallet(this.regularKeySeed, environment);
                    useRegularKeyWalletSignTx = true;
               }

               const wallet = await this.getWallet();
               // let seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
               // const wallet = await this.utilsService.getWallet(seed, environment);
               // if (!wallet) {
               //      return this.setError('ERROR: Wallet could not be created or is undefined');
               // }

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               const transaction: NFTokenCancelOffer = {
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
                    transaction.TicketSequence = Number(this.ticketSequence);
                    transaction.Sequence = 0;
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    transaction.Sequence = getAccountInfo.result.account_data.Sequence;
               }

               if (this.memoField) {
                    transaction.Memos = [
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
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: transaction, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         transaction.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(transaction, null, 2));
                         console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         transaction.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    const preparedTx = await client.autofill(transaction);
                    if (useRegularKeyWalletSignTx) {
                         signedTx = regularKeyWalletSignTx.sign(preparedTx);
                    } else {
                         signedTx = wallet.sign(preparedTx);
                    }
               }

               console.info(`Parse Tx Flags: ${JSON.stringify(xrpl.parseTransactionFlags(transaction), null, '\t')}`);
               this.updateSpinnerMessage('Submitting transaction to the Ledger ...');

               if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, transaction, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }

               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Submit Response:', JSON.stringify(response, null, 2));

               // const response = await client.submitAndWait(transaction, { wallet });
               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

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

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed,
               nftIdField: this.nftIdField,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               let regularKeyWalletSignTx: any = '';
               let useRegularKeyWalletSignTx = false;
               if (this.isRegularKeyAddress && !this.isMultiSign) {
                    console.log('Using Regular Key Seed for transaction signing');
                    regularKeyWalletSignTx = await this.utilsService.getWallet(this.regularKeySeed, environment);
                    useRegularKeyWalletSignTx = true;
               }

               const wallet = await this.getWallet();
               // let seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
               // const wallet = await this.utilsService.getWallet(seed, environment);
               // if (!wallet) {
               //      return this.setError('ERROR: Wallet could not be created or is undefined');
               // }

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               const transaction: NFTokenCancelOffer = {
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
                    transaction.TicketSequence = Number(this.ticketSequence);
                    transaction.Sequence = 0;
               } else {
                    const getAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                    transaction.Sequence = getAccountInfo.result.account_data.Sequence;
               }

               if (this.memoField) {
                    transaction.Memos = [
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
                         const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: transaction, signerAddresses, signerSeeds, fee });
                         signedTx = result.signedTx;
                         transaction.Signers = result.signers;

                         console.log('Payment with Signers:', JSON.stringify(transaction, null, 2));
                         console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                         if (!signedTx) {
                              return this.setError('ERROR: No valid signature collected for multisign transaction');
                         }

                         const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
                         console.log(`multiSignFee: ${multiSignFee}`);
                         transaction.Fee = multiSignFee;
                         const finalTx = xrpl.decode(signedTx.tx_blob);
                         console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));
                    } catch (err: any) {
                         return this.setError(`ERROR: ${err.message}`);
                    }
               } else {
                    const preparedTx = await client.autofill(transaction);
                    if (useRegularKeyWalletSignTx) {
                         signedTx = regularKeyWalletSignTx.sign(preparedTx);
                    } else {
                         signedTx = wallet.sign(preparedTx);
                    }
               }

               console.info(`Parse Tx Flags: ${JSON.stringify(xrpl.parseTransactionFlags(transaction), null, '\t')}`);
               this.updateSpinnerMessage('Submitting transaction to the Ledger ...');

               if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, transaction, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               if (!signedTx) {
                    return this.setError('ERROR: Failed to sign transaction.');
               }

               const response = await client.submitAndWait(signedTx.tx_blob);
               console.log('Submit Response:', JSON.stringify(response, null, 2));

               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

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

     // async setAuthorizedMinter() {
     //      console.log('Entering setAuthorizedMinter');
     //      const startTime = Date.now();
     //      this.setSuccessProperties();

     //      if (!this.selectedAccount) {
     //           return this.setError('Please select an account');
     //      }

     //      const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
     //      if (!this.utilsService.validateInput(seed)) {
     //           return this.setError('ERROR: Account seed cannot be empty');
     //      }

     //      if (!this.utilsService.validateInput(this.minterAddressField)) {
     //           return this.setError('ERROR: NFT ID cannot be empty');
     //      }

     //      try {
     //           const { net, environment } = this.xrplService.getNet();
     //           const client = await this.xrplService.getClient();
     //           let wallet;
     //           if (this.selectedAccount === 'account1') {
     //                wallet = await this.utilsService.getWallet(this.account1.seed, environment);
     //           } else if (this.selectedAccount === 'account2') {
     //                wallet = await this.utilsService.getWallet(this.account2.seed, environment);
     //           }

     //           if (!wallet) {
     //                return this.setError('ERROR: Wallet could not be created or is undefined');
     //           }

     //           const transaction: AccountSet = {
     //                TransactionType: 'AccountSet',
     //                Account: wallet.classicAddress,
     //                NFTokenMinter: this.minterAddressField,
     //           };

     //           const response = await client.submitAndWait(transaction, { wallet });
     //           if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
     //                this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
     //                this.resultField.nativeElement.classList.add('error');
     //                this.setErrorProperties();
     //                return;
     //           }

     //           this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
     //           this.resultField.nativeElement.classList.add('success');
     //           this.setSuccess(this.result);

     //           await this.updateXrpBalance(client, wallet);
     //      } catch (error: any) {
     //           console.error('Error:', error);
     //           return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
     //      } finally {
     //           this.spinner = false;
     //           this.executionTime = (Date.now() - startTime).toString();
     //           console.log(`Leaving cancelSellOffer in ${this.executionTime}ms`);
     //      }
     // }

     async updateNFTMetadata() {
          console.log('Entering updateNFTMetadata');
          const startTime = Date.now();
          this.setSuccessProperties();

          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }

          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
          if (!this.utilsService.validateInput(seed)) {
               return this.setError('ERROR: Account seed cannot be empty');
          }

          if (!this.utilsService.validateInput(this.uriField)) {
               return this.setError('ERROR: URI field cannot be empty');
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();
               // let wallet;
               // if (this.selectedAccount === 'account1') {
               //      wallet = await this.utilsService.getWallet(this.account1.seed, environment);
               // } else if (this.selectedAccount === 'account2') {
               //      wallet = await this.utilsService.getWallet(this.account2.seed, environment);
               // }

               // if (!wallet) {
               //      return this.setError('ERROR: Wallet could not be created or is undefined');
               // }

               const transaction: NFTokenModify = {
                    TransactionType: 'NFTokenModify',
                    Account: wallet.classicAddress,
                    NFTokenID: this.nftIdField,
                    URI: xrpl.convertStringToHex(this.uriField),
               };

               const response = await client.submitAndWait(transaction, { wallet });
               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

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

     private validateInputs(inputs: { seed?: string; amount?: string; destination?: string; checkId?: string; selectedAccount?: 'account1' | 'account2' | 'issuer' | null; nftIdField?: string }): string | null {
          if (inputs.selectedAccount !== undefined && !inputs.selectedAccount) {
               return 'Please select an account';
          }
          if (inputs.seed != undefined && !this.utilsService.validateInput(inputs.seed)) {
               return 'Account seed cannot be empty';
          }
          if (inputs.amount != undefined && !this.utilsService.validateInput(inputs.amount)) {
               return 'Amount cannot be empty';
          }
          if (inputs.amount != undefined) {
               if (isNaN(parseFloat(inputs.amount ?? '')) || !isFinite(parseFloat(inputs.amount ?? ''))) {
                    return 'Amount must be a valid number';
               }
          }
          if (inputs.amount != undefined && inputs.amount && parseFloat(inputs.amount) <= 0) {
               return 'Amount must be a positive number';
          }
          if (inputs.destination != undefined && !this.utilsService.validateInput(inputs.destination)) {
               return 'Destination cannot be empty';
          }
          if (inputs.checkId != undefined && !this.utilsService.validateInput(inputs.checkId)) {
               return 'Check ID cannot be empty';
          }
          if (inputs.nftIdField != undefined && !this.utilsService.validateInput(inputs.nftIdField)) {
               return 'NFT ID cannot be empty';
          }
          return null;
     }

     async getWallet() {
          const { net, environment } = this.xrplService.getNet();
          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
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

     clearFields() {
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

     refreshUiIAccountMetaData(accountInfo: any) {
          const tickSizeField = document.getElementById('tickSizeField') as HTMLInputElement;
          if (tickSizeField) {
               if (accountInfo.account_data.TickSize && accountInfo.account_data.TickSize != '') {
                    tickSizeField.value = accountInfo.account_data.TickSize;
               } else {
                    tickSizeField.value = '';
               }
          }

          const transferRateField = document.getElementById('transferRateField') as HTMLInputElement;
          if (transferRateField) {
               if (accountInfo.account_data.TransferRate && accountInfo.account_data.TransferRate != '') {
                    transferRateField.value = ((accountInfo.account_data.TransferRate / 1_000_000_000 - 1) * 100).toFixed(3);
               } else {
                    transferRateField.value = '';
               }
          }

          const domainField = document.getElementById('domainField') as HTMLInputElement;
          if (domainField) {
               if (accountInfo.account_data.Domain && accountInfo.account_data.Domain != '') {
                    domainField.value = this.utilsService.decodeHex(accountInfo.account_data.Domain);
               } else {
                    domainField.value = '';
               }
          }

          const isMessageKeyField = document.getElementById('isMessageKey') as HTMLInputElement;
          if (isMessageKeyField) {
               if (accountInfo.account_data.MessageKey && accountInfo.account_data.MessageKey != '') {
                    isMessageKeyField.checked = true;
               } else {
                    isMessageKeyField.checked = false;
               }
          }
     }

     clearUiIAccountMetaData() {
          const tickSizeField = document.getElementById('tickSizeField') as HTMLInputElement | null;
          if (tickSizeField) {
               tickSizeField.value = '';
          }

          const transferRateField = document.getElementById('transferRateField') as HTMLInputElement | null;
          if (transferRateField) {
               transferRateField.value = '';
          }

          const domainField = document.getElementById('domainField') as HTMLInputElement | null;
          if (domainField) {
               domainField.value = '';
          }

          const isMessageKeyField = document.getElementById('isMessageKey') as HTMLInputElement;
          if (isMessageKeyField) {
               isMessageKeyField.checked = false;
          }
     }

     async displayDataForAccount1() {
          const account1name = this.storageService.getInputValue('account1name');
          const account1address = this.storageService.getInputValue('account1address');
          const account2address = this.storageService.getInputValue('account2address');
          const account1seed = this.storageService.getInputValue('account1seed');
          const account1mnemonic = this.storageService.getInputValue('account1mnemonic');
          const account1secretNumbers = this.storageService.getInputValue('account1secretNumbers');

          const destinationField = document.getElementById('destinationField') as HTMLInputElement | null;
          const checkIdField = document.getElementById('checkIdField') as HTMLInputElement | null;
          const memoField = document.getElementById('memoField') as HTMLInputElement | null;

          this.account1.name = account1name || '';
          this.account1.address = account1address || '';
          if (account1seed === '') {
               if (account1mnemonic === '') {
                    this.account1.seed = account1secretNumbers || '';
               } else {
                    this.account1.seed = account1mnemonic || '';
               }
          } else {
               this.account1.seed = account1seed || '';
          }

          await this.getNFT();
     }

     async displayDataForAccount2() {
          const account2name = this.storageService.getInputValue('account2name');
          const account1address = this.storageService.getInputValue('account1address');
          const account2address = this.storageService.getInputValue('account2address');
          const account2seed = this.storageService.getInputValue('account2seed');
          const account2mnemonic = this.storageService.getInputValue('account2mnemonic');
          const account2secretNumbers = this.storageService.getInputValue('account2secretNumbers');

          const destinationField = document.getElementById('destinationField') as HTMLInputElement | null;
          const checkIdField = document.getElementById('checkIdField') as HTMLInputElement | null;
          const memoField = document.getElementById('memoField') as HTMLInputElement | null;

          this.account1.name = account2name || '';
          this.account1.address = account2address || '';
          if (account2seed === '') {
               if (account2mnemonic === '') {
                    this.account1.seed = account2secretNumbers || '';
               } else {
                    this.account1.seed = account2mnemonic || '';
               }
          } else {
               this.account1.seed = account2seed || '';
          }

          await this.getNFT();
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
