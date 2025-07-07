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
     index: string;
     Expiration?: number;
     CancelAfter?: number;
     Destination: string;
     Amount: string;
     Balance: string;
     SettleDelay: number;
     PublicKey: string;
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
     selectedAccount: 'account1' | 'account2' | null = null;
     private lastResult: string = '';
     transactionInput = '';
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = false;
     account1 = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '0' };
     account2 = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '0' };
     paymentChannelCancelAfterTimeField: string = '';
     paymentChannelCancelAfterTimeUnit: string = 'seconds';
     channelIDField = '';
     settleDelayField = '';
     ownerCount = '';
     totalXrpReserves = '';
     executionTime = '';
     amountField = '';
     destinationField = '';
     destinationTagField = '';
     publicKeyField: string = '';
     channelClaimSignatureField: string = '';
     channelAction: string = 'create';
     renewChannel = false;
     memoField = '';
     isMultiSignTransaction = false;
     ticketSequence: string = '';
     isTicket = false;
     isTicketEnabled = false;
     isMultiSign = false;
     multiSignAddress = '';
     multiSignSeeds = '';
     spinner = false;
     spinnerMessage: string = '';

     constructor(private xrplService: XrplService, private utilsService: UtilsService, private cdr: ChangeDetectorRef, private storageService: StorageService) {}

     ngAfterViewInit() {
          this.cdr.detectChanges();
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

     toggleMultiSign() {
          this.cdr.detectChanges();
     }

     toggleTicketSequence() {
          this.cdr.detectChanges();
     }

     async getPaymentChannels() {
          console.log('Entering getPaymentChannels');
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
               let wallet;
               if (this.selectedAccount === 'account1') {
                    wallet = await this.utilsService.getWallet(this.account1.seed, environment);
               } else if (this.selectedAccount === 'account2') {
                    wallet = await this.utilsService.getWallet(this.account2.seed, environment);
               }

               if (!wallet) {
                    return this.setError('ERROR: Wallet could not be created or is undefined');
               }

               this.showSpinnerWithDelay('Getting Payment Channels...', 200);

               const response = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'payment_channel');
               console.debug('Payment channel:', response);
               const channels = response.result.account_objects as PaymentChannelObject[];

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
                                        { key: 'Cancel After', value: CancelAfter ? `${this.utilsService.convertXRPLTime(CancelAfter)}s` : 'N/A' },
                                        { key: 'Public Key', value: `<code>${PublicKey}</code>` },
                                   ],
                              };
                         }),
                    });
               }

               this.utilsService.renderPaymentChannelDetails(data);

               this.setSuccess(this.result);

               await this.updateXrpBalance(client, wallet.classicAddress);
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
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed,
               multiSignAddresses: this.isMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.isMultiSign ? this.multiSignSeeds : undefined,
          });
          if (validationError) {
               return this.setError(`ERROR: ${validationError}`);
          }

          const actionElement = document.querySelector('input[name="channelAction"]:checked') as HTMLInputElement | null;
          const action = actionElement ? actionElement.value : '';

          if (action !== 'close') {
               const validationError = this.validateInputs({
                    amount: this.amountField,
               });
               if (validationError) {
                    return this.setError(`ERROR: ${validationError}`);
               }
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               let wallet;
               if (this.selectedAccount === 'account1') {
                    wallet = await this.utilsService.getWallet(this.account1.seed, environment);
               } else if (this.selectedAccount === 'account2') {
                    wallet = await this.utilsService.getWallet(this.account2.seed, environment);
               }

               if (!wallet) {
                    return this.setError('ERROR: Wallet could not be created or is undefined');
               }

               const fee = await this.xrplService.calculateTransactionFee(client);

               if (action === 'create') {
                    if (!this.utilsService.validateInput(this.destinationField)) {
                         return this.setError('ERROR: Destination cannot be empty');
                    }

                    this.updateSpinnerMessage('Creating Payment Channel...');

                    let tx: PaymentChannelCreate = {
                         TransactionType: 'PaymentChannelCreate',
                         Account: wallet.classicAddress,
                         Amount: xrpl.xrpToDrops(this.amountField),
                         Destination: this.destinationField,
                         SettleDelay: parseInt(this.settleDelayField),
                         PublicKey: wallet.publicKey,
                    };

                    if (this.ticketSequence) {
                         if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                              return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                         }

                         tx.Sequence = 0;
                         tx.TicketSequence = Number(this.ticketSequence);
                    }

                    if (this.memoField) {
                         tx.Memos = [
                              {
                                   Memo: {
                                        MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                                        MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                                   },
                              },
                         ];
                    }

                    if (this.destinationTagField) {
                         if (parseInt(this.destinationTagField) <= 0) {
                              return this.setError('ERROR: Destination Tag must be a valid number and greater than zero');
                         }
                         tx.DestinationTag = parseInt(this.destinationTagField, 10);
                    }

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
                         const signerAddresses = this.multiSignAddress.split(',').map(s => s.trim());

                         if (signerAddresses.length === 0) {
                              return this.setError('ERROR: No signers provided for multi-signing');
                         }

                         const signerSeeds = this.multiSignSeeds.split(',').map(s => s.trim());

                         try {
                              const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: tx, signerAddresses, signerSeeds, fee });
                              signedTx = result.signedTx;
                              tx.Signers = result.signers;

                              console.log('Payment with Signers:', JSON.stringify(tx, null, 2));
                              console.log('SignedTx:', JSON.stringify(signedTx, null, 2));

                              if (!signedTx) {
                                   return this.setError('ERROR: No valid signature collected for multisign transaction');
                              }

                              const finalTx = xrpl.decode(signedTx.tx_blob);
                              console.log('Decoded Final Tx:', JSON.stringify(finalTx, null, 2));
                         } catch (err: any) {
                              return this.setError(`ERROR: ${err.message}`);
                         }
                    } else {
                         tx.Fee = fee;
                         const preparedTx = await client.autofill(tx);
                         signedTx = wallet.sign(preparedTx);
                    }

                    if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, tx, fee)) {
                         return this.setError('ERROR: Insufficent XRP to complete transaction');
                    }

                    // const preparedTx = await client.autofill(tx);
                    // console.log(`tx: ${JSON.stringify(preparedTx, null, 2)}`);
                    // const signed = wallet.sign(preparedTx);
                    // console.log(`signed: ${JSON.stringify(signed, null, 2)}`);

                    this.updateSpinnerMessage('Submitting transaction to the Ledger ...');

                    const response = await client.submitAndWait(signedTx.tx_blob);
                    console.log('response', JSON.stringify(response, null, 2));

                    if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                         this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                         this.resultField.nativeElement.classList.add('error');
                         this.setErrorProperties();
                         return;
                    }

                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('success');
               } else if (action === 'fund') {
                    if (!this.utilsService.validateInput(this.channelIDField)) {
                         return this.setError('Channel ID cannot be empty');
                    }

                    if (!this.utilsService.validateInput(this.destinationField)) {
                         return this.setError('ERROR: Destination cannot be empty');
                    }

                    this.updateSpinnerMessage('Funding Payment Channel...');

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

                         tx.Sequence = 0;
                         tx.TicketSequence = Number(this.ticketSequence);
                    }

                    if (this.memoField) {
                         tx.Memos = [
                              {
                                   Memo: {
                                        MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                                        MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                                   },
                              },
                         ];
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

                    if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, tx, fee)) {
                         return this.setError('ERROR: Insufficent XRP to complete transaction');
                    }

                    const preparedTx = await client.autofill(tx);
                    console.log(`tx: ${JSON.stringify(preparedTx, null, 2)}`);
                    const signed = wallet.sign(preparedTx);
                    console.log(`signed: ${JSON.stringify(signed, null, 2)}`);

                    this.updateSpinnerMessage('Submitting transaction to the Ledger ...');

                    const response = await client.submitAndWait(signed.tx_blob);
                    console.log('response', JSON.stringify(response, null, 2));

                    if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                         this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                         this.resultField.nativeElement.classList.add('error');
                         this.setErrorProperties();
                         return;
                    }

                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('success');
               } else if (action === 'claim') {
                    if (!this.utilsService.validateInput(this.channelIDField)) {
                         return this.setError('Channel ID cannot be empty');
                    }

                    this.updateSpinnerMessage('Claiming Payment Channel...');

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
                         if (!this.utilsService.validateInput(this.channelClaimSignatureField)) {
                              return this.setError('ERROR: Claim signature is required for receiver to claim');
                         }
                         if (!this.utilsService.validateInput(this.publicKeyField)) {
                              return this.setError('ERROR: Public key is required for receiver to claim');
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

                         tx.Sequence = 0;
                         tx.TicketSequence = Number(this.ticketSequence);
                    }

                    if (this.memoField) {
                         tx.Memos = [
                              {
                                   Memo: {
                                        MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                                        MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                                   },
                              },
                         ];
                    }

                    const currentLedger = await this.xrplService.getLastLedgerIndex(client);
                    tx.LastLedgerSequence = currentLedger + AppConstants.LAST_LEDGER_ADD_TIME;

                    if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, tx, fee)) {
                         return this.setError('ERROR: Insufficent XRP to complete transaction');
                    }

                    const preparedTx = await client.autofill(tx);
                    console.log(`tx: ${JSON.stringify(preparedTx, null, 2)}`);
                    const signed = wallet.sign(preparedTx);
                    console.log(`signed: ${JSON.stringify(signed, null, 2)}`);

                    this.updateSpinnerMessage('Submitting transaction to the Ledger ...');

                    const response = await client.submitAndWait(signed.tx_blob);
                    console.log('response', JSON.stringify(response, null, 2));

                    if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                         this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                         this.resultField.nativeElement.classList.add('error');
                         this.setErrorProperties();
                         return;
                    }

                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('success');
               } else if (action === 'close') {
                    if (!this.utilsService.validateInput(this.channelIDField)) {
                         return this.setError('Channel ID cannot be empty');
                    }

                    const paymentChannel = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'payment_channel');
                    const channels = paymentChannel.result.account_objects as PaymentChannelObject[];
                    const channel = channels.find(c => c.index === this.channelIDField);
                    if (!channel) {
                         return this.setError(`ERROR: Payment channel ${this.channelIDField} not found`);
                    }

                    const currentLedgerTime = await this.xrplService.getLedgerCloseTime(client);
                    if (channel.Expiration && channel.Expiration > currentLedgerTime) {
                         return this.setError('ERROR: Cannot close channel before expiration');
                    }

                    const remaining = BigInt(channel.Amount) - BigInt(channel.Balance);
                    if (remaining > 0n) {
                         return this.setError(`ERROR: Cannot close channel with non-zero balance. ${xrpl.dropsToXrp(remaining.toString())} XRP still available to claim.`);
                    }

                    // if (channel.Balance !== '0') {
                    //      return this.setError('ERROR: Cannot close channel with non-zero balance. Please claim the balance first.');
                    // }

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

                         tx.Sequence = 0;
                         tx.TicketSequence = Number(this.ticketSequence);
                    }

                    if (this.memoField) {
                         tx.Memos = [
                              {
                                   Memo: {
                                        MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                                        MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                                   },
                              },
                         ];
                    }

                    const currentLedger = await this.xrplService.getLastLedgerIndex(client);
                    tx.LastLedgerSequence = currentLedger + AppConstants.LAST_LEDGER_ADD_TIME;

                    if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, fee)) {
                         return this.setError('ERROR: Insufficent XRP to complete transaction');
                    }

                    const preparedTx = await client.autofill(tx);
                    console.log(`tx: ${JSON.stringify(preparedTx, null, 2)}`);
                    const signed = wallet.sign(preparedTx);
                    console.log(`signed: ${JSON.stringify(signed, null, 2)}`);

                    this.updateSpinnerMessage('Submitting transaction to the Ledger ...');

                    const response = await client.submitAndWait(signed.tx_blob);
                    console.log('response', JSON.stringify(response, null, 2));

                    if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                         this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                         this.resultField.nativeElement.classList.add('error');
                         this.setErrorProperties();
                         return;
                    }

                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('success');
               }

               this.setSuccess(this.result);

               await this.updateXrpBalance(client, wallet.classicAddress);
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

     // async handlePaymentChannelAction() {
     //      console.log('Entering handlePaymentChannelAction');
     //      const startTime = Date.now();
     //      this.setSuccessProperties();

     //      const validationError = this.validateInputs({
     //           selectedAccount: this.selectedAccount,
     //           seed: this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed,
     //           multiSignAddresses: this.isMultiSign ? this.multiSignAddress : undefined,
     //           multiSignSeeds: this.isMultiSign ? this.multiSignSeeds : undefined,
     //      });
     //      if (validationError) {
     //           return this.setError(`ERROR: ${validationError}`);
     //      }

     //      const actionElement = document.querySelector('input[name="channelAction"]:checked') as HTMLInputElement | null;
     //      const action = actionElement ? actionElement.value : '';

     //      if (action !== 'close') {
     //           const validationError = this.validateInputs({
     //                amount: this.amountField,
     //           });
     //           if (validationError) {
     //                return this.setError(`ERROR: ${validationError}`);
     //           }
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

     //           const fee = await this.xrplService.calculateTransactionFee(client);

     //           if (action === 'create') {
     //                if (!this.utilsService.validateInput(this.destinationField)) {
     //                     return this.setError('ERROR: Destination cannot be empty');
     //                }

     //                let tx: PaymentChannelCreate;

     //                this.updateSpinnerMessage('Creating Payment Channel...');

     //                const currentLedger = await this.xrplService.getLastLedgerIndex(client);

     //                if (this.ticketSequence) {
     //                     if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
     //                          return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
     //                     }

     //                     tx = await client.autofill({
     //                          TransactionType: 'PaymentChannelCreate',
     //                          Account: wallet.classicAddress,
     //                          Amount: xrpl.xrpToDrops(this.amountField),
     //                          Destination: this.destinationField,
     //                          SettleDelay: parseInt(this.settleDelayField),
     //                          PublicKey: wallet.publicKey,
     //                          Sequence: 0,
     //                          TicketSequence: Number(this.ticketSequence),
     //                          Fee: fee,
     //                          LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
     //                     });
     //                } else {
     //                     tx = await client.autofill({
     //                          TransactionType: 'PaymentChannelCreate',
     //                          Account: wallet.classicAddress,
     //                          Amount: xrpl.xrpToDrops(this.amountField),
     //                          Destination: this.destinationField,
     //                          SettleDelay: parseInt(this.settleDelayField),
     //                          PublicKey: wallet.publicKey,
     //                          Fee: fee,
     //                          LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
     //                     });
     //                }

     //                if (this.memoField) {
     //                     tx.Memos = [
     //                          {
     //                               Memo: {
     //                                    MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
     //                                    MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
     //                               },
     //                          },
     //                     ];
     //                }

     //                if (this.destinationTagField) {
     //                     if (parseInt(this.destinationTagField) <= 0) {
     //                          return this.setError('ERROR: Destination Tag must be a valid number and greater than zero');
     //                     }
     //                     tx.DestinationTag = parseInt(this.destinationTagField, 10);
     //                }

     //                if (this.paymentChannelCancelAfterTimeField) {
     //                     const cancelAfterTime = this.utilsService.addTime(this.paymentChannelCancelAfterTimeField, this.paymentChannelCancelAfterTimeUnit as 'seconds' | 'minutes' | 'hours' | 'days');
     //                     console.log(`cancelTime: ${this.paymentChannelCancelAfterTimeField} cancelUnit: ${this.paymentChannelCancelAfterTimeUnit}`);
     //                     console.log(`cancelTime: ${this.utilsService.convertXRPLTime(cancelAfterTime)}`);
     //                     const currentLedgerTime = await this.xrplService.getLedgerCloseTime(client); // Implement this in xrplService
     //                     if (cancelAfterTime <= currentLedgerTime) {
     //                          return this.setError('ERROR: Cancel After time must be in the future');
     //                     }
     //                     tx.CancelAfter = cancelAfterTime;
     //                }

     //                if (this.publicKeyField) {
     //                     tx.PublicKey = this.publicKeyField;
     //                }

     //                if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, tx, fee)) {
     //                     return this.setError('ERROR: Insufficent XRP to complete transaction');
     //                }

     //                console.log(`tx: ${JSON.stringify(tx, null, 2)}`);
     //                const signed = wallet.sign(tx);
     //                console.log(`signed: ${JSON.stringify(signed, null, 2)}`);

     //                this.updateSpinnerMessage('Submitting transaction to the Ledger ...');

     //                const response = await client.submitAndWait(signed.tx_blob);
     //                console.log('response', JSON.stringify(response, null, 2));

     //                if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
     //                     this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
     //                     this.resultField.nativeElement.classList.add('error');
     //                     this.setErrorProperties();
     //                     return;
     //                }

     //                this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
     //                this.resultField.nativeElement.classList.add('success');
     //           } else if (action === 'fund') {
     //                let tx: PaymentChannelFund;
     //                if (!this.utilsService.validateInput(this.channelIDField)) {
     //                     return this.setError('Channel ID cannot be empty');
     //                }

     //                if (!this.utilsService.validateInput(this.destinationField)) {
     //                     return this.setError('ERROR: Destination cannot be empty');
     //                }

     //                this.updateSpinnerMessage('Funding Payment Channel...');

     //                const currentLedger = await this.xrplService.getLastLedgerIndex(client);

     //                if (this.ticketSequence) {
     //                     if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
     //                          return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
     //                     }

     //                     tx = await client.autofill({
     //                          TransactionType: 'PaymentChannelFund',
     //                          Account: wallet.classicAddress,
     //                          Channel: this.channelIDField,
     //                          Amount: xrpl.xrpToDrops(this.amountField),
     //                          TicketSequence: Number(this.ticketSequence),
     //                          Sequence: 0,
     //                          Fee: fee,
     //                          LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
     //                     });
     //                } else {
     //                     tx = await client.autofill({
     //                          TransactionType: 'PaymentChannelFund',
     //                          Account: wallet.classicAddress,
     //                          Channel: this.channelIDField,
     //                          Amount: xrpl.xrpToDrops(this.amountField),
     //                          Fee: fee,
     //                          LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
     //                     });
     //                }

     //                if (this.memoField) {
     //                     tx.Memos = [
     //                          {
     //                               Memo: {
     //                                    MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
     //                                    MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
     //                               },
     //                          },
     //                     ];
     //                }

     //                if (this.renewChannel && this.paymentChannelCancelAfterTimeField) {
     //                     const newExpiration = this.utilsService.addTime(this.paymentChannelCancelAfterTimeField, this.paymentChannelCancelAfterTimeUnit as 'seconds' | 'minutes' | 'hours' | 'days');
     //                     const currentLedgerTime = await this.xrplService.getLedgerCloseTime(client);
     //                     if (newExpiration <= currentLedgerTime) {
     //                          return this.setError('ERROR: New expiration time must be in the future');
     //                     }
     //                     tx.Expiration = newExpiration;
     //                }

     //                if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, tx, fee)) {
     //                     return this.setError('ERROR: Insufficent XRP to complete transaction');
     //                }

     //                console.log(`tx: ${JSON.stringify(tx, null, 2)}`);
     //                const signed = wallet.sign(tx);
     //                console.log(`signed: ${JSON.stringify(signed, null, 2)}`);

     //                this.updateSpinnerMessage('Submitting transaction to the Ledger ...');

     //                const response = await client.submitAndWait(signed.tx_blob);
     //                console.log('response', JSON.stringify(response, null, 2));

     //                if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
     //                     this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
     //                     this.resultField.nativeElement.classList.add('error');
     //                     this.setErrorProperties();
     //                     return;
     //                }

     //                this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
     //                this.resultField.nativeElement.classList.add('success');
     //           } else if (action === 'claim') {
     //                let tx: PaymentChannelClaim;
     //                if (!this.utilsService.validateInput(this.channelIDField)) {
     //                     return this.setError('Channel ID cannot be empty');
     //                }

     //                this.updateSpinnerMessage('Claiming Payment Channel...');

     //                const currentLedger = await this.xrplService.getLastLedgerIndex(client);

     //                // Get payment channel details to verify creator and receiver
     //                const payChannelResponse = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'payment_channel');
     //                const channels = payChannelResponse.result.account_objects as PaymentChannelObject[];
     //                const channel = channels.find(c => c.index === this.channelIDField);
     //                if (!channel) {
     //                     return this.setError(`ERROR: Payment channel ${this.channelIDField} not found`);
     //                }

     //                // Determine if the selected account is the creator or receiver
     //                const isReceiver = channel.Destination === wallet.classicAddress;
     //                let signature = this.channelClaimSignatureField;

     //                if (isReceiver) {
     //                     // Receiver is claiming; signature must be provided by the creator
     //                     if (!this.utilsService.validateInput(this.channelClaimSignatureField)) {
     //                          return this.setError('ERROR: Claim signature is required for receiver to claim');
     //                     }
     //                     if (!this.utilsService.validateInput(this.publicKeyField)) {
     //                          return this.setError('ERROR: Public key is required for receiver to claim');
     //                     }
     //                } else {
     //                     // Creator is claiming; generate signature if not provided
     //                     if (!signature) {
     //                          signature = this.generateChannelSignature(this.channelIDField, this.amountField, wallet);
     //                     }
     //                }

     //                if (this.ticketSequence) {
     //                     if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
     //                          return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
     //                     }

     //                     tx = await client.autofill({
     //                          TransactionType: 'PaymentChannelClaim',
     //                          Account: wallet.classicAddress,
     //                          Channel: this.channelIDField,
     //                          Balance: xrpl.xrpToDrops(this.amountField),
     //                          Signature: signature,
     //                          PublicKey: isReceiver ? this.publicKeyField : wallet.publicKey,
     //                          TicketSequence: Number(this.ticketSequence),
     //                          Sequence: 0,
     //                          Fee: fee,
     //                          LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
     //                     });
     //                } else {
     //                     tx = await client.autofill({
     //                          TransactionType: 'PaymentChannelClaim',
     //                          Account: wallet.classicAddress,
     //                          Channel: this.channelIDField,
     //                          Balance: xrpl.xrpToDrops(this.amountField),
     //                          Signature: signature,
     //                          PublicKey: isReceiver ? this.publicKeyField : wallet.publicKey,
     //                          Fee: fee,
     //                          LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
     //                     });
     //                }

     //                if (this.memoField) {
     //                     tx.Memos = [
     //                          {
     //                               Memo: {
     //                                    MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
     //                                    MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
     //                               },
     //                          },
     //                     ];
     //                }

     //                if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, wallet.classicAddress, tx, fee)) {
     //                     return this.setError('ERROR: Insufficent XRP to complete transaction');
     //                }

     //                console.log(`tx: ${JSON.stringify(tx, null, 2)}`);
     //                const signed = wallet.sign(tx);
     //                console.log(`signed: ${JSON.stringify(signed, null, 2)}`);

     //                this.updateSpinnerMessage('Submitting transaction to the Ledger ...');

     //                const response = await client.submitAndWait(signed.tx_blob);
     //                console.log('response', JSON.stringify(response, null, 2));

     //                if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
     //                     this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
     //                     this.resultField.nativeElement.classList.add('error');
     //                     this.setErrorProperties();
     //                     return;
     //                }

     //                this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
     //                this.resultField.nativeElement.classList.add('success');
     //           } else if (action === 'close') {
     //                let tx: PaymentChannelClaim;
     //                if (!this.utilsService.validateInput(this.channelIDField)) {
     //                     return this.setError('Channel ID cannot be empty');
     //                }

     //                const paymentChannel = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'payment_channel');
     //                const channels = paymentChannel.result.account_objects as PaymentChannelObject[];
     //                const channel = channels.find(c => c.index === this.channelIDField);
     //                if (!channel) {
     //                     return this.setError(`ERROR: Payment channel ${this.channelIDField} not found`);
     //                }

     //                const currentLedgerTime = await this.xrplService.getLedgerCloseTime(client);
     //                if (channel.Expiration && channel.Expiration > currentLedgerTime) {
     //                     return this.setError('ERROR: Cannot close channel before expiration');
     //                }

     //                const remaining = BigInt(channel.Amount) - BigInt(channel.Balance);
     //                if (remaining > 0n) {
     //                     return this.setError(`ERROR: Cannot close channel with non-zero balance. ${xrpl.dropsToXrp(remaining.toString())} XRP still available to claim.`);
     //                }

     //                // if (channel.Balance !== '0') {
     //                // return this.setError('ERROR: Cannot close channel with non-zero balance. Please claim the balance first.');
     //                // }

     //                this.updateSpinnerMessage('Closing Payment Channel...');

     //                const currentLedger = await this.xrplService.getLastLedgerIndex(client);

     //                if (this.ticketSequence) {
     //                     if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
     //                          return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
     //                     }

     //                     tx = await client.autofill({
     //                          TransactionType: 'PaymentChannelClaim',
     //                          Account: wallet.classicAddress,
     //                          Channel: this.channelIDField,
     //                          Flags: xrpl.PaymentChannelClaimFlags.tfClose,
     //                          TicketSequence: Number(this.ticketSequence),
     //                          Sequence: 0,
     //                          Fee: fee,
     //                          LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
     //                     });
     //                } else {
     //                     tx = await client.autofill({
     //                          TransactionType: 'PaymentChannelClaim',
     //                          Account: wallet.classicAddress,
     //                          Channel: this.channelIDField,
     //                          Flags: xrpl.PaymentChannelClaimFlags.tfClose,
     //                          Fee: fee,
     //                          LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
     //                     });
     //                }

     //                if (this.memoField) {
     //                     tx.Memos = [
     //                          {
     //                               Memo: {
     //                                    MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
     //                                    MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
     //                               },
     //                          },
     //                     ];
     //                }

     //                if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, tx, fee)) {
     //                     return this.setError('ERROR: Insufficent XRP to complete transaction');
     //                }

     //                console.log(`tx: ${JSON.stringify(tx, null, 2)}`);
     //                const signed = wallet.sign(tx);
     //                console.log(`signed: ${JSON.stringify(signed, null, 2)}`);
     //                const response = await client.submitAndWait(signed.tx_blob);

     //                this.updateSpinnerMessage('Submitting transaction to the Ledger ...');

     //                console.log('response', JSON.stringify(response, null, 2));

     //                if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
     //                     this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
     //                     this.resultField.nativeElement.classList.add('error');
     //                     this.setErrorProperties();
     //                     return;
     //                }

     //                this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
     //                this.resultField.nativeElement.classList.add('success');
     //           }

     //           this.setSuccess(this.result);

     //           await this.updateXrpBalance(client, wallet.classicAddress);
     //      } catch (error: any) {
     //           console.error('Error:', error);
     //           this.setError(`ERROR: ${error.message || 'Unknown error'}`);
     //      } finally {
     //           this.spinner = false;
     //           this.executionTime = (Date.now() - startTime).toString();
     //           this.cdr.detectChanges();
     //           console.log(`Leaving handlePaymentChannelAction in ${this.executionTime}ms`);
     //      }
     // }

     async generateCreatorClaimSignature() {
          console.log('Entering generateCreatorClaimSignature');
          const startTime = Date.now();
          this.setSuccessProperties();

          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }

          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
          if (!this.utilsService.validateInput(seed)) {
               return this.setError('ERROR: Account seed cannot be empty');
          }

          if (!this.utilsService.validateInput(this.amountField)) {
               return this.setError('ERROR: XRP Amount cannot be empty');
          }

          if (!this.utilsService.validateInput(this.destinationField)) {
               return this.setError('ERROR: Destination cannot be empty');
          }

          if (parseFloat(this.amountField) <= 0) {
               return this.setError('ERROR: XRP Amount must be a positive number');
          }

          if (!this.utilsService.validateInput(this.channelIDField)) {
               return this.setError('Channel ID cannot be empty');
          }

          const { net, environment } = this.xrplService.getNet();
          let wallet;
          if (this.selectedAccount === 'account1') {
               wallet = await this.utilsService.getWallet(this.account1.seed, environment);
          } else if (this.selectedAccount === 'account2') {
               wallet = await this.utilsService.getWallet(this.account2.seed, environment);
          }

          if (!wallet) {
               return this.setError('ERROR: Wallet could not be created or is undefined');
          }

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

     private async updateXrpBalance(client: xrpl.Client, address: string) {
          const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, address);
          this.ownerCount = ownerCount;
          this.totalXrpReserves = totalXrpReserves;
          const balance = (await client.getXrpBalance(address)) - parseFloat(this.totalXrpReserves || '0');
          this.account1.balance = balance.toString();
     }

     private validateInputs(inputs: { seed?: string; amount?: string; destination?: string; sequence?: string; selectedAccount?: 'account1' | 'account2' | 'issuer' | null; multiSignAddresses?: string; multiSignSeeds?: string }): string | null {
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

     private displayDataForAccount(accountKey: 'account1' | 'account2') {
          const prefix = accountKey === 'account1' ? 'account1' : 'account2';
          const otherPrefix = accountKey === 'account1' ? 'account2' : 'account1';

          // Fetch stored values
          const name = this.storageService.getInputValue(`${prefix}name`) || '';
          const address = this.storageService.getInputValue(`${prefix}address`) || '';
          const seed = this.storageService.getInputValue(`${prefix}seed`) || '';
          const mnemonic = this.storageService.getInputValue(`${prefix}mnemonic`) || '';
          const secretNumbers = this.storageService.getInputValue(`${prefix}secretNumbers`) || '';
          const otherAddress = this.storageService.getInputValue(`${otherPrefix}address`) || '';

          const accountName1Field = document.getElementById('accountName1Field') as HTMLInputElement | null;
          const accountAddress1Field = document.getElementById('accountAddress1Field') as HTMLInputElement | null;
          const accountSeed1Field = document.getElementById('accountSeed1Field') as HTMLInputElement | null;

          // Update account data
          const account = accountKey === 'account1' ? this.account1 : this.account2;
          account.name = name;
          if (accountName1Field) {
               accountName1Field.value = account.name;
          }
          account.address = address;
          if (accountAddress1Field) {
               accountAddress1Field.value = account.address;
          }
          account.seed = seed || mnemonic || secretNumbers;
          if (accountSeed1Field) {
               accountSeed1Field.value = account.seed;
          }

          if (account.name === 'Account 1') {
               this.destinationField = otherAddress;
          } else {
               this.destinationField = '';
          }

          this.cdr.detectChanges();

          if (account.address && xrpl.isValidAddress(account.address)) {
               this.getPaymentChannels();
          } else if (account.address) {
               this.setError('Invalid XRP address');
          }
     }

     async displayDataForAccount1() {
          this.displayDataForAccount('account1');
     }

     async displayDataForAccount2() {
          this.displayDataForAccount('account2');
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
