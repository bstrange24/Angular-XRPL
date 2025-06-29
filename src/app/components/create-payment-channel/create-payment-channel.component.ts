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
import { sign } from 'ripple-keypairs';
import { Subscription } from 'rxjs';

interface PaymentChannelObject {
     index: string;
     Expiration?: number;
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
     isEditable: boolean = true;
     account1 = { name: '', address: '', seed: '', secretNumbers: '', mnemonic: '', balance: '' };
     account2 = { name: '', address: '', seed: '', secretNumbers: '', mnemonic: '', balance: '' };
     channelIDField = '';
     settleDelayField = '';
     ownerCount = '';
     totalXrpReserves = '';
     executionTime = '';
     amountField = '';
     destinationField = '';
     destinationTagField = '';
     memoField = '';
     isMultiSignTransaction = false;
     ticketSequence: string = '';
     isTicket = false;
     isTicketEnabled = false;
     multiSignAddress = '';
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
          this.account1 = event.account1;
          this.account2 = event.account2;
     }

     handleTransactionResult(event: { result: string; isError: boolean; isSuccess: boolean }) {
          this.result = event.result;
          this.isError = event.isError;
          this.isSuccess = event.isSuccess;
          if (this.isSuccess) {
               this.isEditable = false;
          }
     }

     onAccountChange() {
          if (this.selectedAccount === 'account1') {
               this.displayDataForAccount1();
          } else if (this.selectedAccount === 'account2') {
               this.displayDataForAccount2();
          }
     }

     toggleTicketSequence() {}

     async getPaymentChannels() {
          console.log('Entering getPaymentChannels');
          const startTime = Date.now();
          this.setSuccessProperties();

          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }

          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
          if (!this.utilsService.validatInput(seed)) {
               return this.setError('ERROR: Account seed cannot be empty');
          }

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               let wallet;
               if (seed.split(' ').length > 1) {
                    wallet = xrpl.Wallet.fromMnemonic(seed, {
                         algorithm: environment === AppConstants.NETWORKS.MAINNET.NAME ? AppConstants.ENCRYPTION.ED25519 : AppConstants.ENCRYPTION.SECP256K1,
                    });
               } else {
                    wallet = xrpl.Wallet.fromSeed(seed, {
                         algorithm: environment === AppConstants.NETWORKS.MAINNET.NAME ? AppConstants.ENCRYPTION.ED25519 : AppConstants.ENCRYPTION.SECP256K1,
                    });
               }

               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nGetting Payment Channels\n\n`;

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
                              const { index: channelId, Destination, Amount, Balance, SettleDelay, PublicKey, Expiration } = channel;
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
                                        ...(Expiration ? [{ key: 'Expiration', value: new Date(Expiration * 1000).toLocaleString() }] : []),
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

          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }

          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
          if (!this.utilsService.validatInput(seed)) {
               return this.setError('ERROR: Account seed cannot be empty');
          }

          if (!this.utilsService.validatInput(this.amountField)) {
               return this.setError('ERROR: XRP Amount cannot be empty');
          }

          if (!this.utilsService.validatInput(this.destinationField)) {
               return this.setError('ERROR: Destination cannot be empty');
          }

          if (parseFloat(this.amountField) <= 0) {
               return this.setError('ERROR: XRP Amount must be a positive number');
          }

          const actionElement = document.querySelector('input[name="channelAction"]:checked') as HTMLInputElement | null;
          const action = actionElement ? actionElement.value : '';

          try {
               const { net, environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();

               let wallet;
               if (seed.split(' ').length > 1) {
                    wallet = xrpl.Wallet.fromMnemonic(seed, {
                         algorithm: environment === AppConstants.NETWORKS.MAINNET.NAME ? AppConstants.ENCRYPTION.ED25519 : AppConstants.ENCRYPTION.SECP256K1,
                    });
               } else {
                    wallet = xrpl.Wallet.fromSeed(seed, {
                         algorithm: environment === AppConstants.NETWORKS.MAINNET.NAME ? AppConstants.ENCRYPTION.ED25519 : AppConstants.ENCRYPTION.SECP256K1,
                    });
               }

               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nModifying Payment Channels\n\n`;

               if (await this.utilsService.isSufficentXrpBalance(client, this.amountField, this.totalXrpReserves, wallet.classicAddress)) {
                    return this.setError('ERROR: Insufficent XRP to complete transaction');
               }

               const feeResponse = await client.request({ command: 'fee' });

               if (action === 'create') {
                    let tx: PaymentChannelCreate;
                    this.resultField.nativeElement.innerHTML += `\nCreating Payment Channel\n\n`;

                    const currentLedger = await this.xrplService.getLastLedgerIndex(client);

                    if (this.ticketSequence) {
                         if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                              return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                         }

                         tx = await client.autofill({
                              TransactionType: 'PaymentChannelCreate',
                              Account: wallet.classicAddress,
                              Amount: xrpl.xrpToDrops(this.amountField),
                              Destination: this.destinationField,
                              SettleDelay: parseInt(this.settleDelayField),
                              PublicKey: wallet.publicKey,
                              Sequence: 0,
                              TicketSequence: Number(this.ticketSequence),
                              Fee: feeResponse.result.drops.open_ledger_fee || AppConstants.MAX_FEE,
                              LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                         });
                    } else {
                         tx = await client.autofill({
                              TransactionType: 'PaymentChannelCreate',
                              Account: wallet.classicAddress,
                              Amount: xrpl.xrpToDrops(this.amountField),
                              Destination: this.destinationField,
                              SettleDelay: parseInt(this.settleDelayField),
                              PublicKey: wallet.publicKey,
                              Fee: feeResponse.result.drops.open_ledger_fee || AppConstants.MAX_FEE,
                              LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                         });
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

                    const response = await client.submitAndWait(tx, { wallet });
                    if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                         this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                         this.resultField.nativeElement.classList.add('error');
                         this.setErrorProperties();
                         return;
                    }

                    this.resultField.nativeElement.innerHTML += `\nPayment channel created successfully.\n\n`;
                    this.resultField.nativeElement.innerHTML += `Channel created with ID: ${response.result.hash}\n`;
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('success');
               } else if (action === 'fund') {
                    let tx: PaymentChannelFund;
                    if (!this.utilsService.validatInput(this.channelIDField)) {
                         return this.setError('Channel ID cannot be empty');
                    }

                    this.resultField.nativeElement.innerHTML += `Funding Payment Channel\n\n`;

                    const currentLedger = await this.xrplService.getLastLedgerIndex(client);

                    if (this.ticketSequence) {
                         if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                              return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                         }

                         tx = await client.autofill({
                              TransactionType: 'PaymentChannelFund',
                              Account: wallet.classicAddress,
                              Channel: this.channelIDField,
                              Amount: xrpl.xrpToDrops(this.amountField),
                              TicketSequence: Number(this.ticketSequence),
                              Sequence: 0,
                              Fee: feeResponse.result.drops.open_ledger_fee || AppConstants.MAX_FEE,
                              LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                         });
                    } else {
                         tx = await client.autofill({
                              TransactionType: 'PaymentChannelFund',
                              Account: wallet.classicAddress,
                              Channel: this.channelIDField,
                              Amount: xrpl.xrpToDrops(this.amountField),
                              Fee: feeResponse.result.drops.open_ledger_fee || AppConstants.MAX_FEE,
                              LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                         });
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

                    const response = await client.submitAndWait(tx, { wallet });
                    if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                         this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                         this.resultField.nativeElement.classList.add('error');
                         this.setErrorProperties();
                         return;
                    }

                    this.resultField.nativeElement.innerHTML += `\nPayment channel funded successfully.\n\n`;
                    this.resultField.nativeElement.innerHTML += `Channel funded with ID: ${response.result.hash}\n`;
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('success');
               } else if (action === 'claim') {
                    let tx: PaymentChannelClaim;
                    if (!this.utilsService.validatInput(this.channelIDField)) {
                         return this.setError('Channel ID cannot be empty');
                    }

                    this.resultField.nativeElement.innerHTML += `Claiming Payment Channel\n\n`;

                    const currentLedger = await this.xrplService.getLastLedgerIndex(client);

                    // let signature;
                    // if (validatInput(channelClaimSignature.value)) {
                    // signature = channelClaimSignature.value;
                    // } else {
                    const signature = this.generateChannelSignature(this.channelIDField, this.amountField, wallet);
                    // }

                    if (this.ticketSequence) {
                         if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                              return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                         }

                         tx = await client.autofill({
                              TransactionType: 'PaymentChannelClaim',
                              Account: wallet.classicAddress,
                              Channel: this.channelIDField,
                              Balance: xrpl.xrpToDrops(this.amountField),
                              Signature: signature,
                              PublicKey: wallet.publicKey,
                              TicketSequence: Number(this.ticketSequence),
                              Sequence: 0,
                              Fee: feeResponse.result.drops.open_ledger_fee || AppConstants.MAX_FEE,
                              LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                         });
                    } else {
                         tx = await client.autofill({
                              TransactionType: 'PaymentChannelClaim',
                              Account: wallet.classicAddress,
                              Channel: this.channelIDField,
                              Balance: xrpl.xrpToDrops(this.amountField),
                              Signature: signature,
                              PublicKey: wallet.publicKey,
                              Fee: feeResponse.result.drops.open_ledger_fee || AppConstants.MAX_FEE,
                              LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                         });
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
                    console.log(`tx: ${JSON.stringify(tx, null, 2)}`);

                    const response = await client.submitAndWait(tx, { wallet });
                    if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                         this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                         this.resultField.nativeElement.classList.add('error');
                         this.setErrorProperties();
                         return;
                    }

                    this.resultField.nativeElement.innerHTML += `Payment channel claimed successfully.\n\n`;
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('success');
               } else if (action === 'close') {
                    let tx: PaymentChannelClaim;
                    if (!this.utilsService.validatInput(this.channelIDField)) {
                         return this.setError('Channel ID cannot be empty');
                    }

                    this.resultField.nativeElement.innerHTML += `Closing Payment Channel\n\n`;

                    const currentLedger = await this.xrplService.getLastLedgerIndex(client);

                    if (this.ticketSequence) {
                         if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                              return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                         }

                         tx = await client.autofill({
                              TransactionType: 'PaymentChannelClaim',
                              Account: wallet.classicAddress,
                              Channel: this.channelIDField,
                              Flags: xrpl.PaymentChannelClaimFlags.tfClose,
                              TicketSequence: Number(this.ticketSequence),
                              Sequence: 0,
                              Fee: feeResponse.result.drops.open_ledger_fee || AppConstants.MAX_FEE,
                              LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                         });
                    } else {
                         tx = await client.autofill({
                              TransactionType: 'PaymentChannelClaim',
                              Account: wallet.classicAddress,
                              Channel: this.channelIDField,
                              Flags: xrpl.PaymentChannelClaimFlags.tfClose,
                              Fee: feeResponse.result.drops.open_ledger_fee || AppConstants.MAX_FEE,
                              LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                         });
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

                    const response = await client.submitAndWait(tx, { wallet });
                    if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                         this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                         this.resultField.nativeElement.classList.add('error');
                         this.setErrorProperties();
                         return;
                    }

                    this.resultField.nativeElement.innerHTML += `Payment channel closed successfully.\n\n`;
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
               console.log(`Leaving handlePaymentChannelAction in ${this.executionTime}ms`);
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

               return signature.toUpperCase();
          } catch (error: any) {
               throw new Error(`Failed to generate channel signature: ${error.message}`);
          }
     }

     private async updateXrpBalance(client: xrpl.Client, address: string) {
          const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, address);
          this.ownerCount = ownerCount;
          this.totalXrpReserves = totalXrpReserves;
          const balance = (await client.getXrpBalance(address)) - parseFloat(this.totalXrpReserves || '0');
          this.account1.balance = balance.toString();
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
          this.destinationField = otherAddress;

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
