import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef, NgZone } from '@angular/core';
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
import { BatchService } from '../../services/batch/batch-service.service';
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';
import { AppWalletDynamicInputComponent } from '../app-wallet-dynamic-input/app-wallet-dynamic-input.component';

interface ValidationInputs {
     selectedAccount?: string;
     senderAddress?: string;
     seed?: string;
     account_info?: any;
     nft_info?: any;
     nftIdField?: string;
     uri?: string;
     batchMode?: string;
     amount?: string;
     nftIndexField?: string;
     nftCountField?: string;
     issuerAddressField?: string;
     isRegularKeyAddress?: boolean;
     regularKeyAddress?: string;
     regularKeySeed?: string;
     useMultiSign?: boolean;
     multiSignSeeds?: string;
     multiSignAddresses?: string;
     isTicket?: boolean;
     ticketSequence?: string;
     selectedSingleTicket?: string;
     selectedTicket?: string;
     signerQuorum?: number;
     signers?: { account: string; weight: number }[];
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
     asfAllowTrustLineLocking: boolean;
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
     imports: [CommonModule, FormsModule, AppWalletDynamicInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './create-nft.component.html',
     styleUrl: './create-nft.component.css',
})
export class CreateNftComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     @ViewChild('accountForm') accountForm!: NgForm;
     private lastResult: string = '';
     transactionInput: string = '';
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = false;
     ownerCount: string = '';
     totalXrpReserves: string = '';
     executionTime: string = '';
     useMultiSign: boolean = false;
     multiSignAddress: string = '';
     multiSignSeeds: string = '';
     isUpdateMetaData: boolean = false;
     isUpdateNFTMetaData: boolean = false;
     isBatchModeEnabled: boolean = false;
     isNftFlagModeEnabled: boolean = false;
     isSubmitSignedTransactionEnabled: boolean = false;
     isDestinationEnabled: boolean = false;
     signedTransactionField: string = '';
     isAuthorizedNFTokenMinter: boolean = false;
     isNFTokenMinterEnabled: boolean = false;
     nfTokenMinterAddress: string = '';
     tickSize: string = '';
     transferFeeField: string = '0';
     isMessageKey: boolean = false;
     destinationFields: string = '';
     newDestination: string = '';
     tokenBalance: string = '0';
     gatewayBalance: string = '0';
     destinations: string[] = [];
     currencyFieldDropDownValue: string = 'XRP';
     // private knownTrustLinesIssuers: { [key: string]: string } = { XRP: '' };
     private knownTrustLinesIssuers: { [key: string]: string[] } = { XRP: [] };
     currencies: string[] = [];
     selectedIssuer: string = '';
     currencyIssuers: string[] = [];
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
     ticketArray: string[] = [];
     selectedTickets: string[] = []; // For multiple selection
     selectedSingleTicket: string = ''; // For single selection
     multiSelectMode: boolean = false; // Toggle between modes
     selectedTicket: string = ''; // The currently selected ticket
     signerQuorum: number = 0;
     multiSigningEnabled: boolean = false;
     regularKeySigningEnabled: boolean = false;
     taxonField: string = '0';
     burnableNft: { checked: any } | undefined;
     onlyXrpNft: { checked: any } | undefined;
     transferableNft: { checked: any } | undefined;
     mutableNft: { checked: any } | undefined;
     batchMode: 'allOrNothing' | 'onlyOne' | 'untilFailure' | 'independent' = 'allOrNothing';
     amountField: string = '';
     minterAddressField: string = '';
     issuerAddressField: string = '';
     expirationField: string = '';
     // uriField: string = 'https://ipfs.io/ipfs/bafybeigjro2d2tc43bgv7e4sxqg7f5jga7kjizbk7nnmmyhmq35dtz6deq';
     uriField: string = 'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExMjhubGpubms0bXl5ZzM0cWE4azE5aTlyOHRyNmVhd2prcDc1am43ciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/NxwglXLqMeOuRF3FHv/giphy.gif';
     nftIdField: string = '';
     nftIndexField: string = '';
     nftCountField: string = '';
     spinnerMessage: string = '';
     isSimulateEnabled: boolean = false;
     masterKeyDisabled: boolean = false;
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
          asfAllowTrustLineLocking: false,
     };
     spinner = false;
     signers: { account: string; seed: string; weight: number }[] = [{ account: '', seed: '', weight: 1 }];
     private burnCheckboxHandlerBound!: (e: Event) => void;
     // Dynamic wallets
     wallets: any[] = [];
     selectedWalletIndex: number = 0;
     currentWallet = { name: '', address: '', seed: '', balance: '' };

     constructor(private readonly ngZone: NgZone, private readonly xrplService: XrplService, private readonly utilsService: UtilsService, private readonly cdr: ChangeDetectorRef, private readonly storageService: StorageService, private readonly batchService: BatchService, private readonly renderUiComponentsService: RenderUiComponentsService, private readonly xrplTransactions: XrplTransactionService) {
          this.burnCheckboxHandlerBound = (e: Event) => this.burnCheckboxHandler(e);
     }

     async ngOnInit(): Promise<void> {
          const storedIssuers = this.storageService.getKnownIssuers('knownIssuers');
          if (storedIssuers) {
               this.knownTrustLinesIssuers = storedIssuers;
          }
          this.updateCurrencies();
          this.currencyFieldDropDownValue = 'XRP'; // Set default to XRP
     }

     ngAfterViewInit() {}

     ngOnDestroy(): void {
          document.removeEventListener('change', this.burnCheckboxHandlerBound);
     }

     ngAfterViewChecked() {
          if (this.result !== this.lastResult && this.resultField?.nativeElement) {
               this.renderUiComponentsService.attachSearchListener(this.resultField.nativeElement);
               this.lastResult = this.result;
               this.cdr.detectChanges();
          }
     }

     onWalletListChange(event: any[]) {
          this.wallets = event;
          if (this.wallets.length > 0 && this.selectedWalletIndex >= this.wallets.length) {
               this.selectedWalletIndex = 0;
          }
          this.updateDestinations();
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
          if (this.wallets.length === 0) return;

          this.currentWallet = {
               ...this.wallets[this.selectedWalletIndex],
               balance: this.currentWallet.balance || '0',
          };

          this.updateDestinations();

          if (this.currentWallet.address && xrpl.isValidAddress(this.currentWallet.address)) {
               this.getNFT();
          } else if (this.currentWallet.address) {
               this.setError('Invalid XRP address');
          }
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

     toggleTicketSequence() {
          this.cdr.detectChanges();
     }

     onTicketToggle(event: any, ticket: string) {
          if (event.target.checked) {
               this.selectedTickets = [...this.selectedTickets, ticket];
          } else {
               this.selectedTickets = this.selectedTickets.filter(t => t !== ticket);
          }
     }

     onAuthorizedNFTokenMinter() {
          this.cdr.detectChanges();
     }

     toggleFlags() {}

     async getNFT() {
          console.log('Entering getNFT');
          const startTime = Date.now();
          this.setSuccessProperties();

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }
               this.updateSpinnerMessage('Getting NFT Details...');

               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const [accountNfts, accountInfo, accountObjects] = await Promise.all([this.xrplService.getAccountNFTs(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);

               // Optional: Avoid heavy stringify — log only if needed
               console.debug(`account info:`, accountInfo.result);
               console.debug(`account objects:`, accountObjects.result);
               console.debug(`Account NFTs:`, accountNfts.result);

               const inputs: ValidationInputs = {
                    seed: this.currentWallet.seed,
                    account_info: accountInfo,
               };

               const errors = this.validateInputs(inputs, 'getNFTs');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               // Prepare data structure
               const data = {
                    sections: [{}],
               };

               const nfts = accountNfts.result.account_nfts || [];

               if (nfts.length <= 0) {
                    data.sections.push({
                         title: 'NFTs',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No NFTs found for <code>${wallet.classicAddress}</code>` }],
                    });
               } else {
                    // Define flags (you can move this to a constant outside the function if reused elsewhere)
                    const TF_BURNABLE = 0x00000001;

                    // Filter burnable NFTs
                    // const burnableNftIds = nfts.filter((nft: any) => (nft.Flags & TF_BURNABLE) !== 0).map((nft: any) => nft.NFTokenID);
                    const idsSet = (this.nftIdField || '')
                         .split(',')
                         .map(s => s.trim())
                         .filter(Boolean);

                    // if (burnableNftIds.length > 0) {
                    //      data.sections.push({
                    //           title: `Burnable NFTs`,
                    //           openByDefault: true,
                    //           subItems: [
                    //                {
                    //                     key: `NFT ID's`,
                    //                     openByDefault: false,
                    //                     content: burnableNftIds.map((id: any) => ({
                    //                          key: 'NFToken ID',
                    //                          // value: `<code>${id}</code>`,
                    //                          value: `<code>${id}</code><label class="burn-checkbox"><input type="checkbox" class="burn-check" data-id="${id}"/>Burn</label>`,
                    //                     })),
                    //                },
                    //           ],
                    //      });
                    // } else {
                    //      data.sections.push({
                    //           title: `Burnable NFT IDs`,
                    //           openByDefault: true,
                    //           content: [{ key: 'Status', value: 'No burnable NFTs found' }],
                    //      });
                    // }

                    // Add all NFTs section
                    data.sections.push({
                         title: `NFTs (${nfts.length})`,
                         openByDefault: true,
                         subItems: nfts.map((nft: any, index: number) => {
                              const { NFTokenID, NFTokenTaxon, Issuer, URI, Flags, TransferFee } = nft;
                              const isBurnable = (nft.Flags & TF_BURNABLE) !== 0;
                              const checkedAttr = idsSet.includes(nft.NFTokenID) ? 'checked' : '';
                              // const burnLabel = isBurnable ? 'Burn' : 'Not Burnable';
                              const burnLabel = isBurnable ? 'Burn' : 'Burn';
                              // const disabledAttr = isBurnable ? '' : 'disabled';
                              const disabledAttr = isBurnable ? '' : '';

                              return {
                                   // key: `NFT ${index + 1} (ID: ${NFTokenID.slice(8, -1)}...) Flags: ${String(this.decodeNftFlags(Flags))}`,
                                   key: `NFT ${index + 1} (ID: ...${NFTokenID.slice(-16)})`,
                                   openByDefault: false,
                                   content: [
                                        {
                                             key: 'NFToken ID',
                                             // value: `<code>${nft.NFTokenID}</code><label class="burn-checkbox"><input type="checkbox" class="burn-check" data-id="${nft.NFTokenID}" ${disabledAttr}/>${burnLabel}</label>`,
                                             value: `<code>${nft.NFTokenID}</code><label class="burn-checkbox"><input type="checkbox" class="burn-check" data-id="${nft.NFTokenID}" ${disabledAttr}/>${burnLabel}</label>`,
                                        },
                                        { key: 'Taxon', value: String(NFTokenTaxon) },
                                        ...(Issuer ? [{ key: 'Issuer', value: `<code>${Issuer}</code>` }] : []),
                                        ...(URI ? [{ key: 'URI', value: `<code>${this.utilsService.decodeHex(URI)}</code>` }] : []),
                                        ...(URI ? [{ key: 'Image', value: `<img id="nftImage" src="${this.utilsService.decodeHex(URI)}" width="150" height="150">` }] : []),
                                        { key: 'Flags', value: String(this.decodeNftFlags(Flags)) },
                                        ...(TransferFee ? [{ key: 'Transfer Fee', value: `${TransferFee / 1000}%` }] : []),
                                   ],
                              };
                         }),
                    });
               }

               // CRITICAL: Render immediately
               this.renderUiComponentsService.renderDetails(data);
               this.setSuccess(this.result);

               setTimeout(() => {
                    // Select all burn checkboxes
                    const burnChecks = document.querySelectorAll<HTMLInputElement>('input.burn-check');

                    burnChecks.forEach(checkbox => {
                         checkbox.addEventListener('change', (e: Event) => {
                              const target = e.target as HTMLInputElement;
                              const nftId = target.getAttribute('data-id');
                              const isChecked = target.checked;

                              // Find all checkboxes with the same NFT ID and sync them
                              document.querySelectorAll<HTMLInputElement>(`input.burn-check[data-id="${nftId}"]`).forEach(cb => {
                                   if (cb !== target) {
                                        cb.checked = isChecked;
                                   }
                              });

                              // Optional: keep your textarea in sync too
                              if (nftId) {
                                   this.updateNftTextField(nftId, isChecked);
                              }
                         });
                    });
               }, 0);

               // DEFER: Non-critical UI updates — let main render complete first
               setTimeout(async () => {
                    try {
                         // Use pre-fetched data — no redundant API calls!
                         this.refreshUIData(wallet, accountInfo, accountObjects);
                         this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
                         this.clearFields(false);
                         this.updateTickets(accountObjects);
                         await this.updateXrpBalance(client, accountInfo, wallet);
                    } catch (err) {
                         console.error('Error in deferred UI updates for NFTs:', err);
                         // Don't break main render — NFTs are already shown
                    }
               }, 0);
          } catch (error: any) {
               console.error('Error in getNFT:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
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

          let inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
               selectedTicket: this.selectedTicket,
               selectedSingleTicket: this.selectedSingleTicket,
               // issuerAddressField: this.issuerAddressField,
          };

          if (this.flags.asfNoFreeze && this.flags.asfGlobalFreeze) {
               return this.setError('ERROR: Cannot enable both NoFreeze and GlobalFreeze');
          }

          let nftFlags = 0;
          if (this.isNftFlagModeEnabled) {
               nftFlags = this.setNftFlags();
          }

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Mint NFT (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, fee, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client)]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);

               inputs = { ...inputs, account_info: accountInfo };

               const errors = this.validateInputs(inputs, 'mintNFT');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               const nFTokenMintTx: NFTokenMint = {
                    TransactionType: 'NFTokenMint',
                    Account: wallet.classicAddress,
                    Flags: nftFlags,
                    NFTokenTaxon: parseInt(this.taxonField, 10),
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               await this.setTxOptionalFields(client, nFTokenMintTx, wallet, accountInfo, 'mint');

               if (await this.utilsService.isInsufficientXrpBalance(client, accountInfo, '0', wallet.classicAddress, nFTokenMintTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating NFT Mint (no changes will be made)...' : 'Submitting to Ledger...');

               let response: any;

               if (this.isSimulateEnabled) {
                    response = await this.xrplTransactions.simulateTransaction(client, nFTokenMintTx);
               } else {
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    const signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, nFTokenMintTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

                    response = await this.xrplTransactions.submitTransaction(client, signedTx);
               }

               const isSuccess = this.utilsService.isTxSuccessful(response);
               if (!isSuccess) {
                    const resultMsg = this.utilsService.getTransactionResultMessage(response);
                    const userMessage = 'Transaction failed.\n' + this.utilsService.processErrorMessageFromLedger(resultMsg);

                    console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                    response.result.errorMessage = userMessage;
               }

               this.renderTransactionResult(response);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               if (!this.isSimulateEnabled) {
                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              await this.updateXrpBalance(client, updatedAccountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
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

          let inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
               nftCountField: this.nftCountField,
               batchMode: this.batchMode ? this.batchMode : '',
               uri: this.uriField,
          };

          if (!this.isBatchModeEnabled) {
               return this.setError('Batch Mode slider is not enabled.');
          }

          let nftFlags = 0;
          if (this.isNftFlagModeEnabled) {
               nftFlags = this.setNftFlags();
          }
          const batchFlags = this.setBatchFlags();

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Mint Batch NFT (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, fee, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client)]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);

               inputs = { ...inputs, account_info: accountInfo };

               const errors = this.validateInputs(inputs, 'batchNFT');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               let { regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               const transactions: NFTokenMint[] = [];
               for (let i = 0; i < parseInt(this.nftCountField); i++) {
                    transactions.push({
                         TransactionType: 'NFTokenMint',
                         Account: wallet.classicAddress,
                         URI: xrpl.convertStringToHex(this.uriField),
                         Flags: nftFlags | AppConstants.TF_INNER_BATCH_TXN.BATCH_TXN, // Combine existing flags with tfInnerBatchTxn
                         NFTokenTaxon: 0,
                         Fee: '0', // Fee must be "0" for inner transactions
                    });
               }

               let tx;

               if (transactions.length === 1) {
                    // Normal NFTokenMint (no batch needed)
                    const singleTx: NFTokenMint = {
                         ...transactions[0],
                         Flags: nftFlags, // remove tfInnerBatchTxn when it's standalone
                         Fee: fee,
                    };

                    const prepared = await client.autofill(singleTx);
                    tx = await client.submitAndWait(prepared, { wallet });
               } else {
                    // Batch submit if > 1
                    if (this.useMultiSign) {
                         tx = await this.batchService.submitBatchTransaction(client, wallet, transactions, batchFlags, {
                              isMultiSign: true,
                              signerAddresses: this.multiSignAddress,
                              signerSeeds: this.multiSignSeeds,
                              fee: '12', // optional override
                         });
                    } else {
                         tx = await this.batchService.submitBatchTransaction(client, wallet, transactions, batchFlags, { useRegularKeyWalletSignTx: regularKeyWalletSignTx });
                    }
               }

               console.log('Mint NFT tx', tx);

               if (tx.result.meta && typeof tx.result.meta !== 'string' && (tx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.renderUiComponentsService.renderTransactionsResults(tx, this.resultField.nativeElement);
                    return;
               }

               // Render all successful transactions
               this.renderUiComponentsService.renderTransactionsResults(tx, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               // PARALLELIZE
               const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
               this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

               await this.updateXrpBalance(client, accountInfo, wallet);
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

          let inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
               nftIdField: this.nftIdField,
               selectedTicket: this.selectedTicket,
               selectedSingleTicket: this.selectedSingleTicket,
          };

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Burn NFT (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, fee, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client)]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);

               inputs = { ...inputs, account_info: accountInfo };

               const errors = this.validateInputs(inputs, 'burnNFT');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               const validNFTs = this.utilsService.parseAndValidateNFTokenIDs(this.nftIdField);
               if (!validNFTs) {
                    return this.setError(`ERROR: Invalid NFT Id`);
               }

               if (validNFTs.length > 1) {
                    return this.setError(`ERROR: Use Batch Mode to burn multiple NFT's at once.`);
               }

               const nFTokenBurnTx: NFTokenBurn = {
                    TransactionType: 'NFTokenBurn',
                    Account: wallet.classicAddress,
                    NFTokenID: this.nftIdField,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               await this.setTxOptionalFields(client, nFTokenBurnTx, wallet, accountInfo, 'burn');

               if (await this.utilsService.isInsufficientXrpBalance(client, accountInfo, '0', wallet.classicAddress, nFTokenBurnTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating NFT Burn (no changes will be made)...' : 'Submitting to Ledger...');

               let response: any;

               if (this.isSimulateEnabled) {
                    response = await this.xrplTransactions.simulateTransaction(client, nFTokenBurnTx);
               } else {
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    const signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, nFTokenBurnTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

                    response = await this.xrplTransactions.submitTransaction(client, signedTx);
               }

               const isSuccess = this.utilsService.isTxSuccessful(response);
               if (!isSuccess) {
                    const resultMsg = this.utilsService.getTransactionResultMessage(response);
                    const userMessage = 'Transaction failed.\n' + this.utilsService.processErrorMessageFromLedger(resultMsg);

                    console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                    response.result.errorMessage = userMessage;
               }

               this.renderTransactionResult(response);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               if (!this.isSimulateEnabled) {
                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              await this.updateXrpBalance(client, accountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving burnNFT in ${this.executionTime}ms`);
          }
     }

     async burnBatchNFT() {
          console.log('Entering burnBatchNFT');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
               nftIdField: this.nftIdField,
               batchMode: this.batchMode ? this.batchMode : '',
               uri: this.uriField,
          };

          const validNFTs = this.utilsService.parseAndValidateNFTokenIDs(this.nftIdField);
          if (!validNFTs) {
               return this.setError(`ERROR: Invalid NFT Id`);
          }

          const nftIds = this.utilsService.getNftIds(this.nftIdField);
          const batchFlags = this.setBatchFlags();

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Burn Batch NFT (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, fee, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client)]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);

               inputs = { ...inputs, account_info: accountInfo };

               const errors = this.validateInputs(inputs, 'batchBurnNFT');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               let { regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               const transactions: any[] = nftIds.map((nftId: any) => ({
                    TransactionType: 'NFTokenBurn',
                    Account: wallet.classicAddress,
                    NFTokenID: nftId,
                    Flags: AppConstants.TF_INNER_BATCH_TXN.BATCH_TXN, // 1073741824
                    Fee: '0',
               }));

               let tx;

               if (transactions.length === 1) {
                    // Normal NFTokenBurn (no batch needed)
                    const singleTx: NFTokenBurn = {
                         ...transactions[0],
                         Fee: undefined, // let autofill set correct fee
                         Flags: fee,
                    };

                    const prepared = await client.autofill(singleTx);
                    console.log(`Single-sign batch:`, prepared);
                    tx = await client.submitAndWait(prepared, { wallet });
                    console.log(`tx:`, tx);
               } else {
                    // Batch submit if > 1
                    if (this.useMultiSign) {
                         tx = await this.batchService.submitBatchTransaction(client, wallet, transactions, batchFlags, {
                              isMultiSign: true,
                              signerAddresses: this.multiSignAddress,
                              signerSeeds: this.multiSignSeeds,
                              fee: '12', // optional override
                         });
                    } else {
                         tx = await this.batchService.submitBatchTransaction(client, wallet, transactions, batchFlags, { useRegularKeyWalletSignTx: regularKeyWalletSignTx });
                    }
               }

               console.log('Burn NFT tx', tx);

               if (tx.result.meta && typeof tx.result.meta !== 'string' && (tx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.renderUiComponentsService.renderTransactionsResults(tx, this.resultField.nativeElement);
                    return;
               }

               // Render all successful transactions
               this.renderUiComponentsService.renderTransactionsResults(tx, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               // PARALLELIZE
               const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
               this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

               await this.updateXrpBalance(client, accountInfo, wallet);
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving burnBatchNFT in ${this.executionTime}ms`);
          }
     }

     async getNFTOffers() {
          console.log('Entering getNFTOffers');
          const startTime = Date.now();
          this.setSuccessProperties();

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const { accountInfo, accountObjects, nftInfo, sellOffersResponse, buyOffersResponse } = await this.getNftOfferDetails(client, wallet);
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`accountObjects for ${wallet.classicAddress}:`, accountObjects.result);
               console.debug(`nftInfo for ${wallet.classicAddress}:`, nftInfo.result);
               console.debug(`sellOffersResponse for ${wallet.classicAddress}:`, sellOffersResponse);
               console.debug(`buyOffersResponse for ${wallet.classicAddress}:`, buyOffersResponse);

               const inputs: ValidationInputs = {
                    seed: this.currentWallet.seed,
                    account_info: accountInfo,
               };

               const errors = this.validateInputs(inputs, 'getNFTOffers');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               // Prepare data structure
               const data: { sections: any[] } = { sections: [] };

               const nfts = nftInfo.result.account_nfts || [];
               const nft = nfts.find((n: any) => n.NFTokenID === this.nftIdField);

               if (sellOffersResponse.result !== undefined) {
                    if (nft) {
                         data.sections.push({
                              title: 'NFT Details',
                              openByDefault: true,
                              content: [{ key: 'NFToken ID', value: `<code>${nft.NFTokenID}</code>` }, { key: 'Issuer', value: `<code>${nft.Issuer || wallet.classicAddress}</code>` }, { key: 'Taxon', value: String(nft.NFTokenTaxon) }, ...(nft.URI ? [{ key: 'URI', value: `<code>${nft.URI}</code>` }] : []), { key: 'Serial', value: String(nft.nft_serial || 'N/A') }],
                         });
                    } else {
                         data.sections.push({
                              title: 'NFT Details',
                              openByDefault: true,
                              content: [
                                   {
                                        key: 'Status',
                                        value: `No NFT found for TokenID <code>${this.nftIdField}</code> in account <code>${wallet.classicAddress}</code>`,
                                   },
                              ],
                         });
                    }

                    const sellOffers = sellOffersResponse.result?.offers || [];
                    if (sellOffers.length === 0) {
                         data.sections.push({
                              title: 'Sell Offers',
                              openByDefault: true,
                              content: [{ key: 'Status', value: 'No sell offers available' }],
                         });
                    } else {
                         data.sections.push({
                              title: `Sell Offers (${sellOffers.length})`,
                              openByDefault: true,
                              subItems: sellOffers.map((offer: any, index: number) => ({
                                   key: `Sell Offer ${index + 1} (Index: ${offer.nft_offer_index.slice(0, 8)}...)`,
                                   openByDefault: false,
                                   content: [{ key: 'Offer Index', value: `<code>${offer.nft_offer_index}</code>` }, { key: 'Amount', value: offer.amount ? `${this.utilsService.formatIOUXrpAmountUI(offer.amount)}` : 'Unknown' }, { key: 'Owner', value: `<code>${offer.owner}</code>` }, ...(offer.expiration ? [{ key: 'Expiration', value: new Date(offer.expiration * 1000).toISOString() }] : []), ...(offer.destination ? [{ key: 'Destination', value: `<code>${offer.destination}</code>` }] : [])],
                              })),
                         });
                    }

                    const buyOffers = buyOffersResponse.result?.offers || [];
                    if (buyOffers.length === 0) {
                         data.sections.push({
                              title: 'Buy Offers',
                              openByDefault: true,
                              content: [{ key: 'Status', value: 'No buy offers available' }],
                         });
                    } else {
                         data.sections.push({
                              title: `Buy Offers (${buyOffers.length})`,
                              openByDefault: true,
                              subItems: buyOffers.map((offer: any, index: number) => ({
                                   key: `Buy Offer ${index + 1} (Index: ${offer.nft_offer_index.slice(0, 8)}...)`,
                                   openByDefault: false,
                                   content: [{ key: 'Offer Index', value: `<code>${offer.nft_offer_index}</code>` }, { key: 'Amount', value: offer.amount ? `${this.utilsService.formatIOUXrpAmountUI(offer.amount)}` : 'Unknown' }, { key: 'Owner', value: `<code>${offer.owner}</code>` }, ...(offer.expiration ? [{ key: 'Expiration', value: new Date(offer.expiration * 1000).toISOString() }] : []), ...(offer.destination ? [{ key: 'Destination', value: `<code>${offer.destination}</code>` }] : [])],
                              })),
                         });
                    }
               } else {
                    const allSellOffers = sellOffersResponse.flatMap((entry: any) =>
                         entry.offers.map((offer: any) => ({
                              ...offer,
                              nftId: entry.nftId,
                         }))
                    );

                    if (allSellOffers.length === 0) {
                         data.sections.push({
                              title: 'Sell Offers',
                              openByDefault: true,
                              content: [{ key: 'Status', value: 'No sell offers available' }],
                         });
                    } else {
                         data.sections.push({
                              title: `Sell Offers (${allSellOffers.length})`,
                              openByDefault: true,
                              subItems: allSellOffers.map((offer: any, index: number) => ({
                                   key: `Sell Offer ${index + 1} (NFT ID: ${offer.nftId})`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'NFT ID', value: `${offer.nftId}` },
                                        { key: 'Offer Index', value: `<code>${offer.nft_offer_index ? offer.nft_offer_index : offer.nftOfferIndex}</code>` },
                                        { key: 'Amount', value: offer.amount ? `${this.utilsService.formatIOUXrpAmountUI(offer.amount)}` : 'Unknown' },
                                        { key: 'Owner', value: `<code>${offer.owner ? offer.owner : 'N/A'}</code>` },
                                        ...(offer.expiration ? [{ key: 'Expiration', value: new Date(offer.expiration * 1000).toISOString() }] : []),
                                        ...(offer.destination ? [{ key: 'Destination', value: `<code>${offer.destination ? offer.destination : 'N/A'}</code>` }] : []),
                                   ],
                              })),
                         });
                    }

                    const allBuyOffers = buyOffersResponse.flatMap((entry: any) =>
                         entry.offers.map((offer: any) => ({
                              ...offer,
                              nft_id: entry.nft_id,
                         }))
                    );

                    if (allBuyOffers.length === 0) {
                         data.sections.push({
                              title: 'Buy Offers',
                              openByDefault: true,
                              content: [{ key: 'Status', value: 'No buy offers available' }],
                         });
                    } else {
                         data.sections.push({
                              title: `Buy Offers (${allBuyOffers.length})`,
                              openByDefault: true,
                              subItems: allBuyOffers.map((offer: any, index: number) => ({
                                   key: `Buy Offer ${index + 1} (NFT Offer Index: ${offer.nft_offer_index ? offer.nft_offer_index : offer.nftOfferIndex})`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Offer Index', value: `<code>${offer.nft_offer_index ? offer.nft_offer_index : offer.nftOfferIndex}</code>` },
                                        { key: 'Amount', value: offer.amount ? `${this.utilsService.formatIOUXrpAmountUI(offer.amount)}` : 'Unknown' },
                                        { key: 'Owner', value: `<code>${offer.owner}</code>` },
                                        ...(offer.expiration ? [{ key: 'Expiration', value: new Date(offer.expiration * 1000).toISOString() }] : []),
                                        ...(offer.destination ? [{ key: 'Destination', value: `<code>${offer.destination}</code>` }] : []),
                                   ],
                              })),
                         });
                    }
               }

               // CRITICAL: Render immediately
               this.renderUiComponentsService.renderDetails(data);
               this.setSuccess(this.result);

               // DEFER: Non-critical UI updates
               setTimeout(async () => {
                    try {
                         this.refreshUIData(wallet, accountInfo, accountObjects);
                         this.clearFields(false);
                         await this.updateXrpBalance(client, accountInfo, wallet);
                    } catch (err) {
                         console.error('Error in deferred UI updates for NFT offers:', err);
                    }
               }, 0);
          } catch (error: any) {
               console.error('Error in getNFTOffers:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
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
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
               nftIdField: this.nftIdField,
               selectedTicket: this.selectedTicket,
               selectedSingleTicket: this.selectedSingleTicket,
          };

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Buy NFT (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               const [accountInfo, sellOffersResponse, fee, currentLedger, serverInfo] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getNFTSellOffers(client, this.nftIdField), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), this.xrplService.getXrplServerInfo(client, 'current', '')]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`sellOffersResponse for ${wallet.classicAddress}:`, sellOffersResponse.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);
               console.debug(`serverInfo :`, serverInfo);

               inputs.account_info = accountInfo;

               const errors = this.validateInputs(inputs, 'buyNFT');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               const sellOffer = sellOffersResponse.result?.offers || [];
               if (!Array.isArray(sellOffer) || sellOffer.length === 0) {
                    this.setError(`ERROR: No sell offers found for this NFT ${this.nftIdField}`);
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
                    return;
               }

               // Sort by lowest price
               validOffers.sort((a, b) => parseInt(a.amount) - parseInt(b.amount));

               const matchingOffers = sellOffer.filter(o => o.amount && o.flags === 1); // 1 = tfSellNFToken
               console.log('Matching Offers:', matchingOffers);

               const selectedOffer = validOffers[0];
               console.log('First sell offer:', validOffers[0]);

               if (selectedOffer && selectedOffer.Destination) {
                    this.setError(`ERROR: This NFT is only purchasable by: ${selectedOffer.Destination}`);
                    return;
               }

               if (selectedOffer && selectedOffer.owner === wallet.classicAddress) {
                    this.setError('ERROR: You already own this NFT.');
                    return;
               }

               const nFTokenAcceptOfferTx: NFTokenAcceptOffer = {
                    TransactionType: 'NFTokenAcceptOffer',
                    Account: wallet.classicAddress,
                    NFTokenSellOffer: selectedOffer.nft_offer_index,
                    // Flags: 0, // buy flag
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               await this.setTxOptionalFields(client, nFTokenAcceptOfferTx, wallet, accountInfo, 'buy');

               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, nFTokenAcceptOfferTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating NFT Buy Offer (no changes will be made)...' : 'Submitting to Ledger...');

               let response: any;

               if (this.isSimulateEnabled) {
                    response = await this.xrplTransactions.simulateTransaction(client, nFTokenAcceptOfferTx);
               } else {
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    const signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, nFTokenAcceptOfferTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

                    response = await this.xrplTransactions.submitTransaction(client, signedTx);
               }

               const isSuccess = this.utilsService.isTxSuccessful(response);
               if (!isSuccess) {
                    const resultMsg = this.utilsService.getTransactionResultMessage(response);
                    const userMessage = 'Transaction failed.\n' + this.utilsService.processErrorMessageFromLedger(resultMsg);

                    console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                    (response.result as any).errorMessage = userMessage;
               }

               this.renderTransactionResult(response);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               if (!this.isSimulateEnabled) {
                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              await this.updateXrpBalance(client, accountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
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
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
               nftIdField: this.nftIdField,
               amount: this.amountField,
               selectedTicket: this.selectedTicket,
               selectedSingleTicket: this.selectedSingleTicket,
          };

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Sell NFT (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, fee, currentLedger, serverInfo] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), this.xrplService.getXrplServerInfo(client, 'current', '')]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);
               console.debug(`serverInfo :`, serverInfo);

               inputs.account_info = accountInfo;

               const errors = this.validateInputs(inputs, 'sellNFT');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               const nFTokenCreateOfferTx: NFTokenCreateOffer = {
                    TransactionType: 'NFTokenCreateOffer',
                    Account: wallet.classicAddress,
                    NFTokenID: this.nftIdField,
                    Amount: xrpl.xrpToDrops(this.amountField),
                    Flags: 1, // Sell offer,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               await this.setTxOptionalFields(client, nFTokenCreateOfferTx, wallet, accountInfo, 'sell');

               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, nFTokenCreateOfferTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating NFT Sell Offer (no changes will be made)...' : 'Submitting to Ledger...');

               let response: any;

               if (this.isSimulateEnabled) {
                    response = await this.xrplTransactions.simulateTransaction(client, nFTokenCreateOfferTx);
               } else {
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    const signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, nFTokenCreateOfferTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

                    response = await this.xrplTransactions.submitTransaction(client, signedTx);
               }

               const isSuccess = this.utilsService.isTxSuccessful(response);
               if (!isSuccess) {
                    const resultMsg = this.utilsService.getTransactionResultMessage(response);
                    const userMessage = 'Transaction failed.\n' + this.utilsService.processErrorMessageFromLedger(resultMsg);

                    console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                    (response.result as any).errorMessage = userMessage;
               }

               this.renderTransactionResult(response);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               if (!this.isSimulateEnabled) {
                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              await this.updateXrpBalance(client, accountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving sellNFT in ${this.executionTime}ms`);
          }
     }

     async createBuyOffer() {
          console.log('Entering createBuyOffer');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
               nftIdField: this.nftIdField,
               amount: this.amountField,
               selectedTicket: this.selectedTicket,
               selectedSingleTicket: this.selectedSingleTicket,
          };

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Sell NFT (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, fee, currentLedger, serverInfo] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), this.xrplService.getXrplServerInfo(client, 'current', '')]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);
               console.debug(`serverInfo :`, serverInfo);

               inputs.account_info = accountInfo;

               const errors = this.validateInputs(inputs, 'sellNFT');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               const nFTokenCreateOfferTx: NFTokenCreateOffer = {
                    TransactionType: 'NFTokenCreateOffer',
                    Account: wallet.classicAddress,
                    NFTokenID: this.nftIdField,
                    Amount: xrpl.xrpToDrops(this.amountField),
                    Flags: 1, // Sell offer,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               await this.setTxOptionalFields(client, nFTokenCreateOfferTx, wallet, accountInfo, 'buyOffer');

               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, nFTokenCreateOfferTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating NFT Sell Offer (no changes will be made)...' : 'Submitting to Ledger...');

               let response: any;

               if (this.isSimulateEnabled) {
                    response = await this.xrplTransactions.simulateTransaction(client, nFTokenCreateOfferTx);
               } else {
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    const signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, nFTokenCreateOfferTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

                    response = await this.xrplTransactions.submitTransaction(client, signedTx);
               }

               const isSuccess = this.utilsService.isTxSuccessful(response);
               if (!isSuccess) {
                    const resultMsg = this.utilsService.getTransactionResultMessage(response);
                    const userMessage = 'Transaction failed.\n' + this.utilsService.processErrorMessageFromLedger(resultMsg);

                    console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                    response.result.errorMessage = userMessage;
               }

               this.renderTransactionResult(response);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               if (!this.isSimulateEnabled) {
                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              await this.updateXrpBalance(client, accountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving createBuyOffer in ${this.executionTime}ms`);
          }
     }

     async createSellOffer() {
          console.log('Entering sellNFT');
          const startTime = Date.now();
          this.setSuccessProperties();

          const inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
               nftIdField: this.nftIdField,
               amount: this.amountField,
               selectedTicket: this.selectedTicket,
               selectedSingleTicket: this.selectedSingleTicket,
          };

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Sell NFT (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, fee, currentLedger, serverInfo] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), this.xrplService.getXrplServerInfo(client, 'current', '')]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);
               console.debug(`serverInfo :`, serverInfo);

               inputs.account_info = accountInfo;

               const errors = this.validateInputs(inputs, 'sellNFT');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               const nFTokenCreateOfferTx: NFTokenCreateOffer = {
                    TransactionType: 'NFTokenCreateOffer',
                    Account: wallet.classicAddress,
                    NFTokenID: this.nftIdField,
                    Amount: xrpl.xrpToDrops(this.amountField),
                    Flags: 1, // Sell offer,
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               await this.setTxOptionalFields(client, nFTokenCreateOfferTx, wallet, accountInfo, 'sellOffer');

               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, nFTokenCreateOfferTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating NFT Sell Offer (no changes will be made)...' : 'Submitting to Ledger...');

               let response: any;

               if (this.isSimulateEnabled) {
                    response = await this.xrplTransactions.simulateTransaction(client, nFTokenCreateOfferTx);
               } else {
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    const signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, nFTokenCreateOfferTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

                    response = await this.xrplTransactions.submitTransaction(client, signedTx);
               }

               const isSuccess = this.utilsService.isTxSuccessful(response);
               if (!isSuccess) {
                    const resultMsg = this.utilsService.getTransactionResultMessage(response);
                    const userMessage = 'Transaction failed.\n' + this.utilsService.processErrorMessageFromLedger(resultMsg);

                    console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                    (response.result as any).errorMessage = userMessage;
               }

               this.renderTransactionResult(response);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               if (!this.isSimulateEnabled) {
                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              await this.updateXrpBalance(client, accountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
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

          let inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
               nftIndexField: this.nftIndexField,
               selectedTicket: this.selectedTicket,
               selectedSingleTicket: this.selectedSingleTicket,
          };

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Cancel Buy NFT Offer (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, fee, currentLedger, serverInfo] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), this.xrplService.getXrplServerInfo(client, 'current', '')]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);
               console.debug(`serverInfo :`, serverInfo);

               inputs = { ...inputs, account_info: accountInfo };

               const errors = this.validateInputs(inputs, 'cancelBuy');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               const nFTokenCancelOfferTx: NFTokenCancelOffer = {
                    TransactionType: 'NFTokenCancelOffer',
                    Account: wallet.classicAddress,
                    NFTokenOffers: [this.nftIndexField],
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               await this.setTxOptionalFields(client, nFTokenCancelOfferTx, wallet, accountInfo, 'cancelBuyOffer');

               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, nFTokenCancelOfferTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating NFT Cancel Buy Offer (no changes will be made)...' : 'Submitting to Ledger...');

               let response: any;

               if (this.isSimulateEnabled) {
                    response = await this.xrplTransactions.simulateTransaction(client, nFTokenCancelOfferTx);
               } else {
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    const signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, nFTokenCancelOfferTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

                    response = await this.xrplTransactions.submitTransaction(client, signedTx);
               }

               const isSuccess = this.utilsService.isTxSuccessful(response);
               if (!isSuccess) {
                    const resultMsg = this.utilsService.getTransactionResultMessage(response);
                    const userMessage = 'Transaction failed.\n' + this.utilsService.processErrorMessageFromLedger(resultMsg);

                    console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                    response.result.errorMessage = userMessage;
               }

               this.renderTransactionResult(response);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               if (!this.isSimulateEnabled) {
                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              await this.updateXrpBalance(client, accountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
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

          let inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
               nftIndexField: this.nftIndexField,
               selectedTicket: this.selectedTicket,
               selectedSingleTicket: this.selectedSingleTicket,
          };

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Cancel Sell NFT Offer (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, fee, currentLedger, serverInfo] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), this.xrplService.getXrplServerInfo(client, 'current', '')]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);
               console.debug(`serverInfo :`, serverInfo);

               inputs = { ...inputs, account_info: accountInfo };

               const errors = this.validateInputs(inputs, 'cancelSell');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               const nFTokenCancelOfferTx: NFTokenCancelOffer = {
                    TransactionType: 'NFTokenCancelOffer',
                    Account: wallet.classicAddress,
                    NFTokenOffers: [this.nftIndexField],
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               await this.setTxOptionalFields(client, nFTokenCancelOfferTx, wallet, accountInfo, 'cancelSellOffer');

               if (this.utilsService.isInsufficientXrpBalance1(serverInfo, accountInfo, '0', wallet.classicAddress, nFTokenCancelOfferTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating NFT Cancel Sell Offer (no changes will be made)...' : 'Submitting to Ledger...');

               let response: any;

               if (this.isSimulateEnabled) {
                    response = await this.xrplTransactions.simulateTransaction(client, nFTokenCancelOfferTx);
               } else {
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    const signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, nFTokenCancelOfferTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

                    response = await this.xrplTransactions.submitTransaction(client, signedTx);
               }

               const isSuccess = this.utilsService.isTxSuccessful(response);
               if (!isSuccess) {
                    const resultMsg = this.utilsService.getTransactionResultMessage(response);
                    const userMessage = 'Transaction failed.\n' + this.utilsService.processErrorMessageFromLedger(resultMsg);

                    console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                    response.result.errorMessage = userMessage;
               }

               this.renderTransactionResult(response);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               if (!this.isSimulateEnabled) {
                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              await this.updateXrpBalance(client, accountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
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

          let inputs: ValidationInputs = {
               selectedAccount: this.currentWallet.address,
               seed: this.currentWallet.seed,
               nftIdField: this.nftIdField,
               uri: this.uriField,
               selectedTicket: this.selectedTicket,
               selectedSingleTicket: this.selectedSingleTicket,
          };

          try {
               if (this.resultField?.nativeElement) {
                    this.resultField.nativeElement.innerHTML = '';
               }
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Update NFT Meta Data (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // PHASE 1: PARALLELIZE — fetch account info + fee + ledger index
               const [accountInfo, fee, currentLedger, nftInfo] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), this.xrplService.getAccountNFTs(client, wallet.classicAddress, 'validated', '').catch(() => ({ result: { account_nfts: [] } }))]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);

               inputs = { ...inputs, account_info: accountInfo, nft_info: nftInfo };

               const errors = this.validateInputs(inputs, 'updateMetadata');
               if (errors.length > 0) {
                    return this.setError(errors.length === 1 ? `Error:\n${errors.join('\n')}` : `Multiple Error's:\n${errors.join('\n')}`);
               }

               const nFTokenModifyTx: NFTokenModify = {
                    TransactionType: 'NFTokenModify',
                    Account: wallet.classicAddress,
                    NFTokenID: this.nftIdField,
                    URI: xrpl.convertStringToHex(this.uriField),
                    Fee: fee,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               };

               await this.setTxOptionalFields(client, nFTokenModifyTx, wallet, accountInfo, 'updateMetaData');

               if (await this.utilsService.isInsufficientXrpBalance(client, accountInfo, '0', wallet.classicAddress, nFTokenModifyTx, fee)) {
                    return this.setError('ERROR: Insufficient XRP to complete transaction');
               }

               this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating NFT Meta Update (no changes will be made)...' : 'Submitting to Ledger...');

               let response: any;

               if (this.isSimulateEnabled) {
                    response = await this.xrplTransactions.simulateTransaction(client, nFTokenModifyTx);
               } else {
                    const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                    const signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, nFTokenModifyTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                    if (!signedTx) {
                         return this.setError('ERROR: Failed to sign Payment transaction.');
                    }

                    response = await this.xrplTransactions.submitTransaction(client, signedTx);
               }

               const isSuccess = this.utilsService.isTxSuccessful(response);
               if (!isSuccess) {
                    const resultMsg = this.utilsService.getTransactionResultMessage(response);
                    const userMessage = 'Transaction failed.\n' + this.utilsService.processErrorMessageFromLedger(resultMsg);

                    console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                    response.result.errorMessage = userMessage;
               }

               this.renderTransactionResult(response);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               if (!this.isSimulateEnabled) {
                    const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
                    this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

                    setTimeout(async () => {
                         try {
                              this.clearFields(false);
                              this.updateTickets(updatedAccountObjects);
                              await this.updateXrpBalance(client, accountInfo, wallet);
                         } catch (err) {
                              console.error('Error in post-tx cleanup:', err);
                         }
                    }, 0);
               }
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving updateNFTMetadata in ${this.executionTime}ms`);
          }
     }

     decodeNftFlags(value: number): string {
          const active: string[] = [];
          for (const [name, bit] of Object.entries(AppConstants.NFT_FLAGS)) {
               if ((value & bit) !== 0) {
                    active.push(name);
               }
          }
          return active.join(', ');
     }

     private async getNftOfferDetails(client: any, wallet: any) {
          if (this.nftIdField) {
               // Single NFT mode - returns { result: { offers: [...] } }
               const [accountInfo, accountObjects, nftInfo, sellOffersResponse, buyOffersResponse, nftAccountOffers] = await Promise.all([
                    this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''),
                    this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''),
                    this.xrplService.getAccountNFTs(client, wallet.classicAddress, 'validated', '').catch(() => ({ result: { account_nfts: [] } })),
                    this.xrplService.getNFTSellOffers(client, this.nftIdField).catch(() => ({ result: { offers: [] } })),
                    this.xrplService.getNFTBuyOffers(client, this.nftIdField).catch(() => ({ result: { offers: [] } })),
                    this.xrplService.getAccountNFTOffers(client, wallet.classicAddress, 'validated', 'nft_offer').catch(() => ({ result: { account_nfts: [] } })),
               ]);

               // Filter only sell offers (Flags = 1) and buy offers (Flags = 0)
               const s = this.filterSellOffers(nftAccountOffers, wallet);
               const b = this.filterBuyOffers(nftAccountOffers, wallet);

               return { accountInfo, accountObjects, nftInfo, sellOffersResponse, buyOffersResponse, s, b };
          } else {
               const [accountInfo, accountObjects, nftInfo, nftAccountOffers] = await Promise.all([
                    this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''),
                    this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''),
                    this.xrplService.getAccountNFTs(client, wallet.classicAddress, 'validated', '').catch(() => ({ result: { account_nfts: [] } })),
                    this.xrplService.getAccountNFTOffers(client, wallet.classicAddress, 'validated', 'nft_offer').catch(() => ({ result: { account_nfts: [] } })),
               ]);

               const nfts = nftInfo.result.account_nfts;
               if (nfts.length === 0) {
                    return { accountInfo, accountObjects, nftInfo, sellOffersResponse: [], buyOffersResponse: [] };
               }

               // CREATE ALL PROMISES FIRST
               const buyOfferPromises = this.createBuyOfferPromises(nfts, client);
               const sellOfferPromises = this.createSellOfferPromises(nfts, client);

               // AWAIT ALL PROMISES IN PARALLEL
               const [buyOffersResponses, sellOffersResponses] = await Promise.all([Promise.all(buyOfferPromises), Promise.all(sellOfferPromises)]);

               const buyOffersResponse = this.createBuyOffersResponse(nfts, buyOffersResponses);
               const sellOffersResponse = this.createSellOffersResponse(nfts, sellOffersResponses);
               console.debug(`buyOffersResponse for ${wallet.classicAddress}:`, buyOffersResponse);
               console.debug(`sellOffersResponse for ${wallet.classicAddress}:`, sellOffersResponse);

               // Filter only sell offers (Flags = 1) and buy offers (Flags = 0)
               const s = this.filterSellOffers(nftAccountOffers, wallet);
               const b = this.filterBuyOffers(nftAccountOffers, wallet);
               console.debug(`s:`, s);
               console.debug(`b:`, b);

               const mergedBuyOffersResponse = this.mergeOffers(buyOffersResponse, b);
               const mergedSellOffersResponse = this.mergeOffers(sellOffersResponse, s);
               console.log(`mergedBuyOffersResponse: `, mergedBuyOffersResponse);
               console.log(`mergedSellOffersResponse: `, mergedSellOffersResponse);

               // return { accountInfo, accountObjects, nftInfo, sellOffersResponse, buyOffersResponse };
               return { accountInfo, accountObjects, nftInfo, sellOffersResponse: mergedSellOffersResponse, buyOffersResponse: mergedBuyOffersResponse };
          }
     }

     private createSellOffersResponse(nfts: any, sellOffersResponses: any[]) {
          return nfts.map((nft: any, index: any) => ({
               nftId: nft.NFTokenID,
               offers: sellOffersResponses[index]?.result?.offers || [],
          }));
     }

     private createBuyOffersResponse(nfts: any, buyOffersResponses: any[]) {
          return nfts.map((nft: any, index: any) => ({
               nftId: nft.NFTokenID,
               offers: buyOffersResponses[index]?.result?.offers || [],
          }));
     }

     private createSellOfferPromises(nfts: any, client: any) {
          return nfts.map((nft: any) =>
               this.xrplService.getNFTSellOffers(client, nft.NFTokenID).catch(err => {
                    console.warn(`Sell offers error for ${nft.NFTokenID}:`, err.message);
                    return { result: { offers: [] } };
               })
          );
     }

     private createBuyOfferPromises(nfts: any, client: any) {
          return nfts.map((nft: any) =>
               this.xrplService.getNFTBuyOffers(client, nft.NFTokenID).catch(err => {
                    console.warn(`Buy offers error for ${nft.NFTokenID}:`, err.message);
                    return { result: { offers: [] } };
               })
          );
     }

     private filterBuyOffers(nftAccountOffers: any, wallet: any) {
          const sells = nftAccountOffers.result.account_objects.filter((obj: any) => {
               return obj.LedgerEntryType === 'NFTokenOffer' && obj.Flags === 0;
          });

          const b = sells.map((o: any) => ({
               nftOfferIndex: o.index,
               nftId: o.NFTokenID,
               amount: o.Amount,
               owner: o.Owner, // the NFT’s current owner (seller)
               buyer: wallet.classicAddress, // the account that submitted this offer
               expiration: o.Expiration ?? null,
          }));
          return b;
     }

     private filterSellOffers(nftAccountOffers: any, wallet: any) {
          const buys = nftAccountOffers.result.account_objects.filter((obj: any) => {
               return obj.LedgerEntryType === 'NFTokenOffer' && obj.Flags === 1;
          });

          const s = buys.map((o: any) => ({
               nftOfferIndex: o.index,
               nftId: o.NFTokenID,
               amount: o.Amount,
               seller: wallet.classicAddress, // the account that submitted this offer
               buyer: o.Destination ?? null, // optional target buyer
               expiration: o.Expiration ?? null,
          }));
          return s;
     }

     private mergeOffers(existingResponses: any[], newOffers: any[]) {
          // Flatten all existing offer indices
          const existingIndices = new Set(existingResponses.flatMap(r => r.offers.map((o: any) => o.nftOfferIndex || o.nft_offer_index)));

          // Filter new offers to only those not already in existingIndices
          const filteredNewOffers = newOffers.filter(o => !existingIndices.has(o.nftOfferIndex));

          if (filteredNewOffers.length > 0) {
               return [
                    ...existingResponses,
                    {
                         nftId: 'account_level', // marker bucket for account_objects
                         offers: filteredNewOffers,
                    },
               ];
          }
          return existingResponses;
     }

     setNftFlags() {
          let flags = 0;
          if (this.burnableNft) {
               flags |= xrpl.NFTokenMintFlags.tfBurnable;
          }

          if (this.onlyXrpNft) {
               flags |= xrpl.NFTokenMintFlags.tfOnlyXRP;
          }

          if (this.transferableNft) {
               flags |= xrpl.NFTokenMintFlags.tfTransferable;
          }

          if (this.mutableNft) {
               flags |= xrpl.NFTokenMintFlags.tfMutable;
          }

          console.log('NFt flags ' + flags);
          return flags;
     }

     setBatchFlags() {
          let flags = 0;
          if (this.batchMode === 'allOrNothing') {
               flags |= AppConstants.BATCH_FLAGS.ALL_OR_NOTHING;
          }

          if (this.batchMode === 'onlyOne') {
               flags |= AppConstants.BATCH_FLAGS.ONLY_ONE;
          }

          if (this.batchMode === 'untilFailure') {
               flags |= AppConstants.BATCH_FLAGS.UNTIL_FAILURE;
          }

          if (this.batchMode === 'independent') {
               flags |= AppConstants.BATCH_FLAGS.INDEPENDENT;
          }

          console.log('Batch flags ' + flags);
          return flags;
     }

     private updateCurrencies() {
          this.currencies = [...Object.keys(this.knownTrustLinesIssuers)];
          this.currencies.sort((a, b) => a.localeCompare(b));
     }

     private renderTransactionResult(response: any): void {
          if (this.isSimulateEnabled) {
               this.renderUiComponentsService.renderSimulatedTransactionsResults(response, this.resultField.nativeElement);
          } else {
               console.debug(`Response`, response);
               this.renderUiComponentsService.renderTransactionsResults(response, this.resultField.nativeElement);
          }
     }

     private async setTxOptionalFields(client: xrpl.Client, nftTx: any, wallet: xrpl.Wallet, accountInfo: any, txType: string): Promise<string | void> {
          const address = wallet.classicAddress;
          const sequence = accountInfo.result.account_data.Sequence;
          const hasMultipleTickets = this.multiSelectMode && this.selectedTickets.length > 0;

          // --- Helper: set ticket sequence ---
          const setTicket = async (ticket?: string | number): Promise<string | void> => {
               if (ticket) {
                    const exists = await this.xrplService.checkTicketExists(client, address, Number(ticket));
                    if (!exists) return `ERROR: Ticket Sequence ${ticket} not found for account ${address}`;
                    this.utilsService.setTicketSequence(nftTx, String(ticket), true);
               } else if (hasMultipleTickets) {
                    console.log('Setting multiple tickets:', this.selectedTickets);
                    this.utilsService.setTicketSequence(nftTx, String(sequence), false);
               } else {
                    this.utilsService.setTicketSequence(nftTx, String(sequence), false);
               }
          };

          // --- Helper: set expiration ---
          const setExpiration = (): boolean => {
               if (this.expirationField) {
                    const expireTime = this.utilsService.addTime(this.expirationField, 'hours');
                    this.utilsService.setExpiration(nftTx, expireTime);
                    return true;
               }
               return false;
          };

          // --- Helper: set memo ---
          const setMemo = (): void => {
               if (this.memoField) this.utilsService.setMemoField(nftTx, this.memoField);
          };

          // --- Common handling for multiple tx types ---
          if (['mint', 'burn', 'buy', 'updateMetaData', 'sell', 'buyOffer', 'sellOffer', 'cancelBuyOffer', 'cancelSellOffer'].includes(txType)) {
               const ticket = this.selectedSingleTicket || this.ticketSequence || undefined;
               const ticketError = await setTicket(ticket);
               if (ticketError) return this.setError(ticketError);

               setMemo();
          }

          // --- Type-specific logic ---
          if (txType === 'mint') {
               if (this.uriField) this.utilsService.setURI(nftTx, this.uriField);

               if (this.transferFeeField) {
                    if (!this.isNftFlagModeEnabled || !this.transferableNft) {
                         return this.setError('ERROR: Transferable NFT flag must be enabled with transfer fee.');
                    }
                    this.utilsService.setTransferFee(nftTx, this.transferFeeField);
               }

               if (this.isAuthorizedNFTokenMinter && this.nfTokenMinterAddress) {
                    if (!xrpl.isValidAddress(this.nfTokenMinterAddress)) {
                         return this.setError('ERROR: Invalid Account address');
                    }
                    this.utilsService.setIssuerAddress(nftTx, this.nfTokenMinterAddress);
               }

               let needsAmount = setExpiration();

               if (!this.nfTokenMinterAddress && this.isDestinationEnabled && this.destinationFields) {
                    this.utilsService.setDestination(nftTx, this.destinationFields);
                    needsAmount = true;
               }

               if (needsAmount && this.amountField) {
                    this.utilsService.setAmount(nftTx, this.amountField);
               }
          }

          if (['sell', 'buyOffer', 'sellOffer'].includes(txType)) {
               setExpiration();
          }

          return nftTx;
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
                                   const weight = entry.SignerEntry.SignerWeight ?? '';
                                   signerAccounts.push(`${entry.SignerEntry.Account}~${weight}`);
                                   this.signerQuorum = obj.SignerQuorum;
                              }
                         });
                    }
               });
          }
          return signerAccounts;
     }

     private getAccountTickets(accountObjects: xrpl.AccountObjectsResponse) {
          const getAccountTickets: string[] = [];
          if (accountObjects.result && Array.isArray(accountObjects.result.account_objects)) {
               accountObjects.result.account_objects.forEach(obj => {
                    if (obj.LedgerEntryType === 'Ticket') {
                         getAccountTickets.push(obj.TicketSequence.toString());
                    }
               });
          }
          return getAccountTickets;
     }

     private cleanUpSingleSelection() {
          // Check if selected ticket still exists in available tickets
          if (this.selectedSingleTicket && !this.ticketArray.includes(this.selectedSingleTicket)) {
               this.selectedSingleTicket = ''; // Reset to "Select a ticket"
          }
     }

     private cleanUpMultiSelection() {
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

     private refreshUiAccountObjects(accountObjects: xrpl.AccountObjectsResponse, accountInfo: xrpl.AccountInfoResponse, wallet: xrpl.Wallet) {
          this.ticketArray = this.getAccountTickets(accountObjects);
          if (this.ticketArray.length > 0) {
               this.selectedTicket = this.ticketArray[0];
          }

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

          // if (isMasterKeyDisabled && signerAccounts && signerAccounts.length > 0) {
          //      this.useMultiSign = true; // Force to true if master key is disabled
          // } else {
          //      this.useMultiSign = false;
          // }

          if (signerAccounts && signerAccounts.length > 0) {
               this.multiSigningEnabled = true;
          } else {
               this.multiSigningEnabled = false;
          }

          this.clearFields(false);
     }

     private refreshUiAccountInfo(accountInfo: xrpl.AccountInfoResponse) {
          const nftTokenMinter = accountInfo?.result?.account_data?.NFTokenMinter;
          if (nftTokenMinter) {
               this.isAuthorizedNFTokenMinter = false;
               this.isNFTokenMinterEnabled = true;
               this.nfTokenMinterAddress = nftTokenMinter;
          } else {
               this.isAuthorizedNFTokenMinter = false;
               this.isNFTokenMinterEnabled = false;
               this.nfTokenMinterAddress = '';
          }

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

          // if (isMasterKeyDisabled && xrpl.isValidAddress(this.regularKeyAddress)) {
          //      this.isRegularKeyAddress = true; // Force to true if master key is disabled
          // } else {
          //      this.isRegularKeyAddress = false;
          // }

          if (regularKey) {
               this.regularKeySigningEnabled = true;
          } else {
               this.regularKeySigningEnabled = false;
          }
     }

     private validateInputs(inputs: ValidationInputs, action: string): string[] {
          const errors: string[] = [];

          // --- Shared skip helper ---
          const shouldSkipNumericValidation = (value: string | undefined): boolean => {
               return value === undefined || value === null || value.trim() === '';
          };

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

          const isNotSelfPayment = (sender: string | undefined, receiver: string | undefined): string | null => {
               if (sender && receiver && sender === receiver) {
                    return `Sender and receiver cannot be the same`;
               }
               return null;
          };

          const isValidNumber = (value: string | undefined, fieldName: string, minValue?: number, allowEmpty: boolean = false): string | null => {
               // Skip number validation if value is empty — required() will handle it
               if (shouldSkipNumericValidation(value) || (allowEmpty && value === '')) return null;

               // ✅ Type-safe parse
               const num = parseFloat(value as string);

               if (isNaN(num) || !isFinite(num)) {
                    return `${fieldName} must be a valid number`;
               }
               if (minValue !== undefined && num <= minValue) {
                    return `${fieldName} must be greater than ${minValue}`;
               }
               return null;
          };

          const isBatchCountValid = (value: string | undefined, fieldName: string): string | null => {
               if (value === undefined) return null; // Not required, so skip
               const num = parseInt(value);
               if (num > 8) {
                    return `${fieldName} must be less than 8`;
               } else if (num <= 0) {
                    return `${fieldName} cannot be zero`;
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

          const nftExistOnAccountAndMutable = (nft_info: any | undefined, nftId: string | undefined): string | null => {
               if (nft_info && nft_info.result?.account_nfts?.length > 0) {
                    const nfts = nft_info.result.account_nfts;
                    if (nftId) {
                         const targetNFT = nfts.find((nft: any) => nft.NFTokenID === nftId);
                         if (targetNFT) {
                              if (this.decodeNftFlags(targetNFT.Flags).includes('Mutable')) {
                                   return null;
                              } else {
                                   return 'NFT is not mutable';
                              }
                         } else {
                              return 'NFT Id not found';
                         }
                    } else {
                         return 'No NFT for the NFT ID';
                    }
               } else {
                    return 'No NFT for the NFT ID';
               }
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
               const invalidSeed = seeds.find((seed: string) => !xrpl.isValidSecret(seed));
               if (invalidSeed) {
                    return 'One or more signer seeds are invalid';
               }
               return null;
          };

          // Action-specific config: required fields and custom rules
          const actionConfig: Record<string, { required: (keyof ValidationInputs)[]; customValidators?: (() => string | null)[] }> = {
               getNFTs: {
                    required: ['seed'],
                    customValidators: [() => isValidSeed(inputs.seed)],
               },
               mintNFT: {
                    required: ['seed'],
                    customValidators: [() => isValidSeed(inputs.seed), () => isValidXrpAddress(inputs.issuerAddressField, 'Issuer address')],
               },
               batchNFT: {
                    required: ['seed', 'nftCountField'],
                    customValidators: [() => isValidSeed(inputs.seed), () => isValidNumber(inputs.nftCountField, 'NFT count', 0), () => isRequired(inputs.uri, 'URI'), () => isBatchCountValid(inputs.nftCountField, 'NFT Count'), () => isRequired(inputs.batchMode, 'Batch Mode')],
               },
               batchBurnNFT: {
                    required: ['seed'],
                    customValidators: [() => isValidSeed(inputs.seed), () => isBatchCountValid(inputs.nftCountField, 'NFT Count')],
               },
               burnNFT: {
                    required: ['seed', 'nftIdField'],
                    customValidators: [() => isValidSeed(inputs.seed), () => isRequired(inputs.nftIdField, 'NFT ID')],
               },
               getNFTOffers: {
                    // required: [ 'seed', 'nftIdField'],
                    required: ['seed'],
                    // customValidators: [() => isValidSeed(inputs.seed), () => isRequired(inputs.nftIdField, 'NFT ID')],
                    customValidators: [() => isValidSeed(inputs.seed)],
               },
               buyNFT: {
                    required: ['seed', 'nftIdField'],
                    customValidators: [() => isValidSeed(inputs.seed), () => isRequired(inputs.nftIdField, 'NFT ID')],
               },
               sellNFT: {
                    required: ['seed', 'nftIdField', 'amount'],
                    customValidators: [() => isValidSeed(inputs.seed), () => isRequired(inputs.nftIdField, 'NFT ID'), () => isValidNumber(inputs.amount, 'Amount', 0)],
               },
               cancelBuyNFT: {
                    required: ['seed', 'nftIndexField'],
                    customValidators: [() => isValidSeed(inputs.seed), () => isRequired(inputs.nftIndexField, 'NFT Offer Index')],
               },
               cancelSellNFT: {
                    required: ['seed', 'nftIndexField'],
                    customValidators: [() => isValidSeed(inputs.seed), () => isRequired(inputs.nftIndexField, 'NFT Offer Index')],
               },
               updateMetadata: {
                    required: ['seed', 'nftIdField', 'uri'],
                    customValidators: [() => isValidSeed(inputs.seed), () => isRequired(inputs.nftIdField, 'NFT ID'), () => isRequired(inputs.uri, 'URI'), () => nftExistOnAccountAndMutable(inputs.nft_info, inputs.nftIdField)],
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

          if (errors.length == 0 && inputs.useMultiSign && (inputs.multiSignAddresses === 'No Multi-Sign address configured for account' || inputs.multiSignSeeds === '')) {
               errors.push('At least one signer address is required for multi-signing');
          }

          return errors;
     }

     setBatchMode(mode: 'allOrNothing' | 'onlyOne' | 'untilFailure' | 'independent') {
          this.batchMode = mode;
          this.toggleFlags(); // optional: update your XRPL batch flags
     }

     updateDestinations() {
          this.destinations = this.wallets.map(w => w.address);
          if (this.destinations.length > 0 && !this.destinationFields) {
               this.destinationFields = this.destinations[0];
          }
          this.cdr.detectChanges();
     }

     addDestination() {
          if (this.newDestination && !this.destinations.includes(this.newDestination)) {
               this.destinations.push(this.newDestination);
               localStorage.setItem('destinations', JSON.stringify(this.destinations));
               this.destinationFields = this.newDestination; // auto-select the new one
               this.newDestination = ''; // clear input
          }
     }

     onBurnToggle(checked: boolean, nftId: string) {
          // normalize current ids
          const ids = (this.nftIdField || '')
               .split(',')
               .map(s => s.trim())
               .filter(Boolean);

          if (checked) {
               if (!ids.includes(nftId)) ids.push(nftId);
          } else {
               // remove
               const idx = ids.indexOf(nftId);
               if (idx !== -1) ids.splice(idx, 1);
          }

          this.nftIdField = ids.join(', ');
     }

     private burnCheckboxHandler(event: Event) {
          const target = event.target as HTMLInputElement;
          if (!target) return;
          if (!target.classList.contains('burn-check')) return;

          const nftId = target.getAttribute('data-id');
          if (!nftId) return;

          // run inside Angular zone so template/ngModel updates
          this.ngZone.run(() => {
               this.onBurnToggle(target.checked, nftId);
          });
     }

     updateNftTextField(nftId: string, add: boolean) {
          let ids = (this.nftIdField || '')
               .split(',')
               .map(s => s.trim())
               .filter(Boolean);

          if (add && !ids.includes(nftId)) {
               ids.push(nftId);
          } else if (!add) {
               ids = ids.filter(id => id !== nftId);
          }

          this.nftIdField = ids.join(', ');
     }

     async toggleIssuerField() {
          console.log('Entering onCurrencyChange');
          const startTime = Date.now();
          this.setSuccessProperties();
          this.updateSpinnerMessage('Updating Currency...');

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();
               const accountObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '');

               // PHASE 1: PARALLELIZE — update balance + fetch gateway balances
               const [balanceUpdate, gatewayBalances] = await Promise.all([this.updateCurrencyBalance(wallet, accountObjects), this.xrplService.getTokenBalance(client, wallet.classicAddress, 'validated', '')]);

               // PHASE 2: Calculate total balance for selected currency
               let balanceTotal: number = 0;
               const relevantIssuers: string[] = []; // New array for issuers of this currency

               if (gatewayBalances.result.assets && Object.keys(gatewayBalances.result.assets).length > 0) {
                    for (const [issuer, currencies] of Object.entries(gatewayBalances.result.assets)) {
                         for (const { currency, value } of currencies) {
                              if (this.utilsService.formatCurrencyForDisplay(currency) === this.currencyFieldDropDownValue) {
                                   balanceTotal += Number(value);
                                   relevantIssuers.push(issuer); // Collect issuers for this currency
                              }
                         }
                    }
                    this.gatewayBalance = this.utilsService.formatTokenBalance(balanceTotal.toString(), 18);
               } else {
                    this.gatewayBalance = '0';
               }

               // PHASE 3: Update destination field
               if (this.currencyFieldDropDownValue === 'XRP') {
                    this.destinationFields = this.wallets[0]?.address || ''; // Default to first wallet address for XRP
               } else {
                    this.currencyIssuers = relevantIssuers; // Use filtered issuers from gatewayBalances
                    this.destinationFields = this.wallets[1]?.address || ''; // Default to first for tokens
               }
          } catch (error: any) {
               this.tokenBalance = '0';
               this.gatewayBalance = '0';
               console.error('Error in onCurrencyChange:', error);
               this.setError(`ERROR: Failed to fetch balance - ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving onCurrencyChange in ${this.executionTime}ms`);
          }
     }

     private async updateCurrencyBalance(wallet: xrpl.Wallet, accountObjects: any) {
          let balance: string;
          const currencyCode = this.utilsService.encodeIfNeeded(this.currencyFieldDropDownValue);
          if (wallet.classicAddress) {
               const balanceResult = await this.utilsService.getCurrencyBalance(currencyCode, accountObjects);
               balance = balanceResult !== null ? balanceResult.toString() : '0';
               this.tokenBalance = this.utilsService.formatTokenBalance(balance, 18);
          } else {
               this.tokenBalance = '0';
          }
     }

     private async getWallet() {
          const environment = this.xrplService.getNet().environment;
          const seed = this.currentWallet.seed;
          const wallet = await this.utilsService.getWallet(seed, environment);
          if (!wallet) {
               throw new Error('ERROR: Wallet could not be created or is undefined');
          }
          return wallet;
     }

     clearFields(clearAllFields: boolean) {
          if (clearAllFields) {
               this.isBatchModeEnabled = false;
               this.isNftFlagModeEnabled = false;
               this.isNftFlagModeEnabled = false;
               this.isSimulateEnabled = false;
          }

          this.amountField = '';
          this.minterAddressField = '';
          this.issuerAddressField = '';
          this.expirationField = '';
          this.nftIdField = '';
          this.nftIndexField = '';
          this.nftCountField = '';
          this.memoField = '';
          this.isMemoEnabled = false;
          this.isTicket = false;
          this.ticketSequence = '';
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
          this.cdr.detectChanges();
     }
}
