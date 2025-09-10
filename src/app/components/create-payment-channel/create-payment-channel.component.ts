import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { WalletInputComponent } from '../wallet-input/wallet-input.component';
import { StorageService } from '../../services/storage.service';
import * as xrpl from 'xrpl';
import { TransactionMetadataBase, PaymentChannelCreate, PaymentChannelFund, PaymentChannelClaim } from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';
import { sign, verify } from 'ripple-keypairs';

interface PaymentChannelObject {
     Account: string;
     index: string;
     Expiration?: number;
     CancelAfter?: number;
     Destination: string;
     Amount: string;
     Balance: string;
     SettleDelay: number;
     PublicKey: string;
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
     selector: 'app-account',
     standalone: true,
     imports: [CommonModule, FormsModule, WalletInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './create-payment-channel.component.html',
     styleUrl: './create-payment-channel.component.css',
})
export class CreatePaymentChannelComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     @ViewChild('accountForm') accountForm!: NgForm;
     selectedAccount: 'account1' | 'account2' | null = 'account1';
     private lastResult: string = '';
     transactionInput: string = '';
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = false;
     account1 = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '0' };
     account2 = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '0' };
     paymentChannelCancelAfterTimeField: string = '';
     paymentChannelCancelAfterTimeUnit: string = 'seconds';
     channelIDField: string = '';
     settleDelayField: string = '';
     ownerCount: string = '';
     totalXrpReserves: string = '';
     executionTime: string = '';
     amountField: string = '';
     destinationField: string = '';
     destinationTagField: string = '';
     publicKeyField: string = '';
     channelClaimSignatureField: string = '';
     channelAction: string = 'create';
     renewChannel: boolean = false;
     memoField: string = '';
     isMemoEnabled: boolean = false;
     isMultiSignTransaction: boolean = false;
     ticketSequence: string = '';
     isTicket: boolean = false;
     isTicketEnabled: boolean = false;
     isMultiSign: boolean = false;
     multiSignAddress: string = '';
     multiSignSeeds: string = '';
     isRegularKeyAddress: boolean = false;
     regularKeySeed: string = '';
     regularKeyAddress: string = '';
     signerQuorum: number = 0;
     spinner: boolean = false;
     spinnerMessage: string = '';
     actions = [
          { value: 'create', label: 'Create' },
          { value: 'fund', label: 'Fund' },
          { value: 'claim', label: 'Claim' },
          { value: 'close', label: 'Close' },
     ];
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

          const accountHandlers: Record<'account1' | 'account2', () => void> = {
               account1: () => this.displayDataForAccount1(),
               account2: () => this.displayDataForAccount2(),
          };

          accountHandlers[this.selectedAccount]?.();
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

     selectAction(action: string) {
          this.channelAction = action;
          this.cdr.detectChanges();
     }

     getSelectionWidth(): string {
          return `${100 / this.actions.length}%`; // Each option takes equal width
     }

     getSelectionLeft(): string {
          const index = this.actions.findIndex(action => action.value === this.channelAction);
          return `${(index * 100) / this.actions.length}%`; // Position the highlight based on selected index
     }

     async getPaymentChannels() {
          console.log('Entering getPaymentChannels');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithOutIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2),
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          try {
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               this.showSpinnerWithDelay('Getting Payment Channels...', 200);

               const paymentChannelObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'payment_channel');
               console.debug(`Payment channel objects: ${JSON.stringify(paymentChannelObjects, null, '\t')}`);
               const channels = paymentChannelObjects.result.account_objects as PaymentChannelObject[];

               const data = {
                    sections: [{}],
               };

               if (!channels || channels.length === 0) {
                    data.sections.push({
                         title: 'Payment Channels',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No payment channels found for <code>${wallet.classicAddress}</code>` }],
                    });
               } else {
                    data.sections.push({
                         title: `Payment Channels (${channels.length})`,
                         openByDefault: true,
                         subItems: channels.map((channel, index) => {
                              const { index: channelId, Destination, Amount, Balance, SettleDelay, PublicKey, Expiration, CancelAfter } = channel;
                              const available = xrpl.dropsToXrp(BigInt(Amount) - BigInt(Balance));
                              return {
                                   key: `Channel ${index + 1} (ID: ${channelId.slice(0, 8)}...)`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Channel ID', value: `<code>${channelId}</code>` },
                                        { key: 'Destination', value: `<code>${Destination}</code>` },
                                        { key: 'Total Amount', value: `${xrpl.dropsToXrp(Amount)} XRP` },
                                        { key: 'Claimed Balance', value: `${xrpl.dropsToXrp(Balance)} XRP` },
                                        { key: 'Remaining', value: `${available} XRP` },
                                        { key: 'Settle Delay', value: `${SettleDelay}s` },
                                        { key: 'Cancel After', value: CancelAfter ? `${this.utilsService.convertXRPLTime(CancelAfter)}` : 'N/A' },
                                        { key: 'Expired', value: CancelAfter ? `${Date.now() / 1000 > CancelAfter}` : 'False' },
                                        { key: 'Public Key', value: `<code>${PublicKey}</code>` },
                                   ],
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
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving handlePaymentChannelAction in ${this.executionTime}ms`);
          }
     }

     async handlePaymentChannelAction() {
          console.log('Entering handlePaymentChannelAction');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithOutIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2),
               destination: this.destinationField,
               regularKeyAddress: this.regularKeyAddress ? this.regularKeyAddress : undefined,
               regularKeySeed: this.regularKeySeed ? this.regularKeySeed : undefined,
               multiSignAddresses: this.isMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.isMultiSign ? this.multiSignSeeds : undefined,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          const action = this.channelAction;
          if (action !== 'close') {
               const validationError = this.validateInputs({
                    amount: this.amountField,
               });
               if (validationError) {
                    return this.setError(`ERROR: ${validationError}`);
               }
          }

          try {
               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               let { useRegularKeyWalletSignTx, regularKeyWalletSignTx }: { useRegularKeyWalletSignTx: boolean; regularKeyWalletSignTx: any } = await this.utilsService.getRegularKeyWallet(environment, this.isMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

               this.updateSpinnerMessage('Payment Channels Transaction...');

               const fee = await this.xrplService.calculateTransactionFee(client);

               if (action === 'create') {
                    this.updateSpinnerMessage('Creating Payment Channel...');

                    const validationError = this.validateInputs({
                         amount: this.amountField,
                         destination: this.destinationField,
                         settleDelay: this.settleDelayField,
                    });
                    if (validationError) {
                         return this.setError(`ERROR: ${validationError}`);
                    }

                    let tx: PaymentChannelCreate = {
                         TransactionType: 'PaymentChannelCreate',
                         Account: wallet.classicAddress,
                         Amount: xrpl.xrpToDrops(this.amountField),
                         Destination: this.destinationField,
                         SettleDelay: parseInt(this.settleDelayField),
                         PublicKey: wallet.publicKey,
                         Fee: fee,
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

                    this.utilsService.setDestinationTag(tx, this.destinationTagField);

                    if (this.paymentChannelCancelAfterTimeField) {
                         const cancelAfterTime = this.utilsService.addTime(this.paymentChannelCancelAfterTimeField, this.paymentChannelCancelAfterTimeUnit as 'seconds' | 'minutes' | 'hours' | 'days');
                         console.log(`cancelTime: ${this.paymentChannelCancelAfterTimeField} cancelUnit: ${this.paymentChannelCancelAfterTimeUnit}`);
                         console.log(`cancelTime: ${this.utilsService.convertXRPLTime(cancelAfterTime)}`);
                         const currentLedgerTime = await this.xrplService.getLedgerCloseTime(client); // Implement this in xrplService
                         if (cancelAfterTime <= currentLedgerTime) {
                              return this.setError('ERROR: Cancel After time must be in the future');
                         }
                         tx.CancelAfter = cancelAfterTime;
                    }

                    if (this.publicKeyField) {
                         tx.PublicKey = this.publicKeyField;
                    }

                    const currentLedger = await this.xrplService.getLastLedgerIndex(client);
                    tx.LastLedgerSequence = currentLedger + AppConstants.LAST_LEDGER_ADD_TIME;

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

                              if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, tx, multiSignFee)) {
                                   return this.setError('ERROR: Insufficient XRP to complete transaction');
                              }
                         } catch (err: any) {
                              return this.setError(`ERROR: ${err.message}`);
                         }
                    } else {
                         const preparedTx = await client.autofill(tx);
                         console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                         signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                         if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, tx, fee)) {
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
                         this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                         // this.resultField.nativeElement.classList.add('error');
                         // this.setErrorProperties();
                         return;
                    }

                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('success');
               } else if (action === 'fund') {
                    this.updateSpinnerMessage('Funding Payment Channel...');

                    const validationError = this.validateInputs({
                         channelID: this.channelIDField,
                         destination: this.destinationField,
                    });
                    if (validationError) {
                         return this.setError(`ERROR: ${validationError}`);
                    }

                    let tx: PaymentChannelFund = {
                         TransactionType: 'PaymentChannelFund',
                         Account: wallet.classicAddress,
                         Channel: this.channelIDField,
                         Amount: xrpl.xrpToDrops(this.amountField),
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

                    if (this.renewChannel && this.paymentChannelCancelAfterTimeField) {
                         const newExpiration = this.utilsService.addTime(this.paymentChannelCancelAfterTimeField, this.paymentChannelCancelAfterTimeUnit as 'seconds' | 'minutes' | 'hours' | 'days');
                         const currentLedgerTime = await this.xrplService.getLedgerCloseTime(client);
                         if (newExpiration <= currentLedgerTime) {
                              return this.setError('ERROR: New expiration time must be in the future');
                         }
                         tx.Expiration = newExpiration;
                    }

                    const currentLedger = await this.xrplService.getLastLedgerIndex(client);
                    tx.LastLedgerSequence = currentLedger + AppConstants.LAST_LEDGER_ADD_TIME;

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

                              if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, tx, multiSignFee)) {
                                   return this.setError('ERROR: Insufficient XRP to complete transaction');
                              }
                         } catch (err: any) {
                              return this.setError(`ERROR: ${err.message}`);
                         }
                    } else {
                         const preparedTx = await client.autofill(tx);
                         console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                         signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                         if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, tx, fee)) {
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
                         this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                         // this.resultField.nativeElement.classList.add('error');
                         // this.setErrorProperties();
                         return;
                    }

                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('success');
               } else if (action === 'claim') {
                    this.updateSpinnerMessage('Claiming Payment Channel...');

                    const validationError = this.validateInputs({
                         channelID: this.channelIDField,
                    });
                    if (validationError) {
                         return this.setError(`ERROR: ${validationError}`);
                    }

                    // Get payment channel details to verify creator and receiver
                    const payChannelResponse = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'payment_channel');
                    const channels = payChannelResponse.result.account_objects as PaymentChannelObject[];
                    const channel = channels.find(c => c.index === this.channelIDField);
                    if (!channel) {
                         return this.setError(`ERROR: Payment channel ${this.channelIDField} not found`);
                    }

                    // Determine if the selected account is the creator or receiver
                    const isReceiver = channel.Destination === wallet.classicAddress;
                    let signature = this.channelClaimSignatureField;

                    if (isReceiver) {
                         // Receiver is claiming; signature must be provided by the creator
                         const validationError = this.validateInputs({
                              channelClaimSignatureField: this.channelClaimSignatureField,
                              publicKeyField: this.publicKeyField,
                         });
                         if (validationError) {
                              return this.setError(`ERROR: ${validationError}`);
                         }
                    } else {
                         // Creator is claiming; generate signature if not provided
                         if (!signature) {
                              signature = this.generateChannelSignature(this.channelIDField, this.amountField, wallet);
                         }
                    }

                    let tx: PaymentChannelClaim = {
                         TransactionType: 'PaymentChannelClaim',
                         Account: wallet.classicAddress,
                         Channel: this.channelIDField,
                         Balance: xrpl.xrpToDrops(this.amountField),
                         Signature: signature,
                         PublicKey: isReceiver ? this.publicKeyField : wallet.publicKey,
                         Fee: fee,
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

                    const currentLedger = await this.xrplService.getLastLedgerIndex(client);
                    tx.LastLedgerSequence = currentLedger + AppConstants.LAST_LEDGER_ADD_TIME;

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

                              if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, tx, multiSignFee)) {
                                   return this.setError('ERROR: Insufficient XRP to complete transaction');
                              }
                         } catch (err: any) {
                              return this.setError(`ERROR: ${err.message}`);
                         }
                    } else {
                         const preparedTx = await client.autofill(tx);
                         console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                         signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                         if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, tx, fee)) {
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
                         this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                         // this.resultField.nativeElement.classList.add('error');
                         // this.setErrorProperties();
                         return;
                    }

                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('success');
               } else if (action === 'close') {
                    this.updateSpinnerMessage('Closing Payment Channel...');

                    const validationError = this.validateInputs({
                         channelID: this.channelIDField,
                    });
                    if (validationError) {
                         return this.setError(`ERROR: ${validationError}`);
                    }

                    const paymentChannel = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'payment_channel');
                    const channels = paymentChannel.result.account_objects as PaymentChannelObject[];
                    const channel = channels.find(c => c.index === this.channelIDField);
                    if (!channel) {
                         return this.setError(`ERROR: Payment channel ${this.channelIDField} not found`);
                    }

                    let isOwnerCancelling = false;
                    if (wallet.classicAddress == channel.Account) {
                         isOwnerCancelling = true;
                    }

                    const currentLedgerTime = await this.xrplService.getLedgerCloseTime(client);
                    if (channel.Expiration && channel.Expiration > currentLedgerTime) {
                         return this.setError('ERROR: Cannot close channel before expiration');
                    }

                    let hasChannelExpired = this.checkChannelExpired(channel);

                    const ownerCancelling = !!isOwnerCancelling;
                    const expired = !!hasChannelExpired;

                    if (ownerCancelling || expired) {
                         // skip balance check — allowed to close (owner or expired)
                    } else {
                         const amount = BigInt(channel.Amount ?? '0');
                         const balance = BigInt(channel.Balance ?? '0');
                         const remaining = amount - balance;
                         if (remaining > 0n) {
                              return this.setError(`ERROR: Cannot close channel with non-zero balance. ${xrpl.dropsToXrp(remaining.toString())} XRP still available to claim.`);
                         }
                    }

                    this.updateSpinnerMessage('Closing Payment Channel...');

                    let tx: PaymentChannelClaim = {
                         TransactionType: 'PaymentChannelClaim',
                         Account: wallet.classicAddress,
                         Channel: this.channelIDField,
                         Flags: xrpl.PaymentChannelClaimFlags.tfClose,
                         Fee: fee,
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

                    const currentLedger = await this.xrplService.getLastLedgerIndex(client);
                    tx.LastLedgerSequence = currentLedger + AppConstants.LAST_LEDGER_ADD_TIME;

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

                              if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, tx, multiSignFee)) {
                                   return this.setError('ERROR: Insufficient XRP to complete transaction');
                              }
                         } catch (err: any) {
                              return this.setError(`ERROR: ${err.message}`);
                         }
                    } else {
                         const preparedTx = await client.autofill(tx);
                         console.log(`preparedTx: ${JSON.stringify(preparedTx, null, '\t')}`);
                         signedTx = useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);

                         if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, tx, fee)) {
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
                         this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                         // this.resultField.nativeElement.classList.add('error');
                         // this.setErrorProperties();
                         return;
                    }

                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('success');
               }

               this.setSuccess(this.result);

               this.isMemoEnabled = false;
               this.memoField = '';

               await this.updateXrpBalance(client, wallet);
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               this.cdr.detectChanges();
               console.log(`Leaving handlePaymentChannelAction in ${this.executionTime}ms`);
          }
     }

     async generateCreatorClaimSignature() {
          console.log('Entering generateCreatorClaimSignature');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithOutIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2),
               destination: this.destinationField,
               amount: this.amountField,
               channelID: this.channelIDField,
               regularKeyAddress: this.regularKeyAddress ? this.regularKeyAddress : undefined,
               regularKeySeed: this.regularKeySeed ? this.regularKeySeed : undefined,
               multiSignAddresses: this.isMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.isMultiSign ? this.multiSignSeeds : undefined,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          const wallet = await this.getWallet();

          try {
               this.publicKeyField = wallet.publicKey;
               this.channelClaimSignatureField = this.generateChannelSignature(this.channelIDField, this.amountField, wallet);
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving generateCreatorClaimSignature in ${this.executionTime}ms`);
          }
     }

     generateChannelSignature(channelID: string, amountXRP: BigNumber.Value, wallet: xrpl.Wallet) {
          try {
               if (!/^[0-9A-Fa-f]{64}$/.test(channelID)) {
                    throw new Error('Invalid channelID: must be a 64-character hexadecimal string');
               }

               if (!amountXRP || amountXRP.toString().trim() === '') {
                    throw new Error('Invalid amountXRP: must be a valid number or string');
               }
               const amountDrops = xrpl.xrpToDrops(amountXRP);
               if (isNaN(parseFloat(this.amountField)) || parseFloat(this.amountField) <= 0) {
                    throw new Error('Invalid amountXRP: must be a valid number or string');
               }

               // Convert the amount to 8-byte big-endian buffer
               const amountBuffer = Buffer.alloc(8);
               amountBuffer.writeBigUInt64BE(BigInt(amountDrops), 0);

               // Create the message buffer: 'CLM\0' + ChannelID (hex) + Amount (8 bytes)
               const message = Buffer.concat([
                    Buffer.from('CLM\0'), // Prefix for channel claims
                    Buffer.from(channelID, 'hex'), // 32-byte channel ID
                    amountBuffer, // 8-byte drop amount
               ]);

               // Sign the message using ripple-keypairs
               const messageHex = message.toString('hex');
               const signature = sign(messageHex, wallet.privateKey);

               // Verify the signature
               const isValid = verify(messageHex, signature, wallet.publicKey);
               if (!isValid) {
                    throw new Error('Generated signature is invalid');
               }

               return signature.toUpperCase();
          } catch (error: any) {
               throw new Error(`Failed to generate channel signature: ${error.message}`);
          }
     }

     checkChannelExpired(channel: any) {
          if (channel.CancelAfter) {
               const unixExpiration = channel.CancelAfter + 946684800;
               console.log('Expiration (UTC):', new Date(unixExpiration * 1000).toISOString());
               let isExpired = Date.now() / 1000 > unixExpiration;
               console.log('Expired?', isExpired);
               if (isExpired) {
                    return true;
               }
               return false;
          } else {
               console.log('This channel has no expiration set.');
               return false;
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

     private validateInputs(inputs: { seed?: string; amount?: string; destination?: string; sequence?: string; selectedAccount?: 'account1' | 'account2' | 'issuer' | null; multiSignAddresses?: string; multiSignSeeds?: string; regularKeyAddress?: string; regularKeySeed?: string; settleDelay?: string; channelID?: string; channelClaimSignatureField?: string; publicKeyField?: string }): string | null {
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

          if (inputs.channelID != undefined && !this.utilsService.validateInput(inputs.channelID)) {
               return 'Channel ID cannot be empty';
          }
          if (inputs.channelClaimSignatureField != undefined && !this.utilsService.validateInput(inputs.channelClaimSignatureField)) {
               return 'Channel Claim Signature cannot be empty';
          }
          if (inputs.publicKeyField != undefined && !this.utilsService.validateInput(inputs.publicKeyField)) {
               return 'PublicKey cannot be empty';
          }

          return null;
     }

     async getWallet() {
          const environment = this.xrplService.getNet().environment;
          const seed = this.utilsService.getSelectedSeedWithOutIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2);
          const wallet = await this.utilsService.getWallet(seed, environment);
          if (!wallet) {
               throw new Error('ERROR: Wallet could not be created or is undefined');
          }
          return wallet;
     }

     private displayDataForAccount(accountKey: 'account1' | 'account2') {
          const isAccount1 = accountKey === 'account1';
          const prefix = accountKey;
          const otherPrefix = isAccount1 ? 'account2' : 'account1';

          // Fetch stored values
          const data = {
               name: this.storageService.getInputValue(`${prefix}name`) || '',
               address: this.storageService.getInputValue(`${prefix}address`) || '',
               seed: this.storageService.getInputValue(`${prefix}seed`) || '',
               mnemonic: this.storageService.getInputValue(`${prefix}mnemonic`) || '',
               secretNumbers: this.storageService.getInputValue(`${prefix}secretNumbers`) || '',
               otherAddress: this.storageService.getInputValue(`${otherPrefix}address`) || '',
          };

          // DOM element mapping (only for account1 since UI fields seem fixed)
          const domMap: Record<string, string> = {
               name: 'accountName1Field',
               address: 'accountAddress1Field',
               seed: 'accountSeed1Field',
          };

          // Select account reference
          const account = isAccount1 ? this.account1 : this.account2;

          // Assign values
          account.name = data.name;
          account.address = data.address;
          account.seed = data.seed || data.mnemonic || data.secretNumbers;
          this.destinationField = data.otherAddress;

          // Update DOM fields (if they exist)
          (Object.keys(domMap) as (keyof typeof domMap)[]).forEach(key => {
               const field = document.getElementById(domMap[key]) as HTMLInputElement | null;
               if (field) {
                    field.value = account[key as keyof typeof account] ?? '';
               }
          });

          this.cdr.detectChanges();

          // Address validation
          if (account.address) {
               if (xrpl.isValidAddress(account.address)) {
                    this.getPaymentChannels();
               } else {
                    this.setError('Invalid XRP address');
               }
          }
     }

     async displayDataForAccount1() {
          this.displayDataForAccount('account1');
     }

     async displayDataForAccount2() {
          this.displayDataForAccount('account2');
     }

     clearFields() {
          this.amountField = '';
          this.destinationTagField = '';
          this.channelIDField = '';
          this.publicKeyField = '';
          this.channelClaimSignatureField = '';
          this.settleDelayField = '';
          this.paymentChannelCancelAfterTimeField = '';
          this.memoField = '';
          this.ticketSequence = '';
          this.isTicket = false;
          this.renewChannel = false;
          this.cdr.detectChanges();
     }

     updateSpinnerMessage(message: string) {
          this.spinnerMessage = message;
          this.cdr.detectChanges();
          console.log('Spinner message updated:', message); // For debugging
     }

     async showSpinnerWithDelay(message: string, delayMs: number = 200) {
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
