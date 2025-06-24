import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { WalletInputComponent } from '../wallet-input/wallet-input.component';
import { StorageService } from '../../services/storage.service';
import * as xrpl from 'xrpl';
import { TransactionMetadataBase } from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';
import { sign } from 'ripple-keypairs';

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
     multiSignAddress = '';
     spinner = false;

     constructor(private xrplService: XrplService, private utilsService: UtilsService, private cdr: ChangeDetectorRef, private storageService: StorageService) {}

     ngAfterViewInit() {
          // this.account1 = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '' };
          // this.account2 = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '' };
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

     async getPaymentChannels() {
          console.log('Entering getPaymentChannels');
          const startTime = Date.now();
          this.spinner = true;
          this.isError = false;
          this.isSuccess = false;
          this.result = '';
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

               const response = await client.request({
                    command: 'account_objects',
                    account: wallet.classicAddress,
                    type: 'payment_channel',
                    ledger_index: 'validated',
               });

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

               this.isSuccess = true;
               this.handleTransactionResult({
                    result: this.result,
                    isError: this.isError,
                    isSuccess: this.isSuccess,
               });

               const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, wallet.classicAddress);
               this.ownerCount = ownerCount;
               this.totalXrpReserves = totalXrpReserves;
               const balance = (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0');

               if (this.selectedAccount === 'account1') {
                    this.account1.balance = balance.toString();
               } else {
                    this.account2.balance = balance.toString();
               }
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
          this.spinner = true;
          this.isError = false;
          this.isSuccess = false;
          this.result = '';
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
          if (parseFloat(this.amountField) <= 0) {
               return this.setError('ERROR: XRP Amount must be a positive number');
          }
          if (!this.utilsService.validatInput(this.destinationField)) {
               return this.setError('ERROR: Destination cannot be empty');
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

               const amount = parseFloat(this.amountField);
               const totalReserves = parseFloat(this.totalXrpReserves || '0');
               const balance1 = await client.getXrpBalance(wallet.classicAddress);
               if (amount > balance1 - totalReserves) {
                    return this.setError('ERROR: Insufficent XRP to complete transaction');
               }

               if (action === 'create') {
                    this.resultField.nativeElement.innerHTML += `\nCreating Payment Channel\n`;

                    const tx = await client.autofill({
                         TransactionType: 'PaymentChannelCreate',
                         Account: wallet.classicAddress,
                         Amount: xrpl.xrpToDrops(this.amountField),
                         Destination: this.destinationField,
                         SettleDelay: parseInt(this.settleDelayField),
                         PublicKey: wallet.publicKey,
                    });

                    const response = await client.submitAndWait(tx, { wallet });
                    if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                         this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                         this.resultField.nativeElement.classList.add('error');

                         this.setFieldsOnError();
                         this.handleTransactionResult({
                              result: this.result,
                              isError: this.isError,
                              isSuccess: this.isSuccess,
                         });
                         return;
                    }

                    const channelID = response.result.hash;
                    this.resultField.nativeElement.innerHTML += `\nPayment channel created successfully.\n\n`;
                    this.resultField.nativeElement.innerHTML += `Channel created with ID: ${channelID}\n`;

                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('success');
               } else if (action === 'fund') {
                    if (!this.utilsService.validatInput(this.channelIDField)) {
                         return this.setError('Channel ID cannot be empty');
                    }
                    if (isNaN(parseFloat(this.amountField)) || parseFloat(this.amountField) <= 0) {
                         return this.setError('Amount must be a valid number and greater than 0');
                    }

                    const amountFieldNum = parseFloat(this.amountField);
                    const totalXrpReservesNum = parseFloat(this.totalXrpReserves || '0');
                    const walletBalance = await client.getXrpBalance(wallet.classicAddress);
                    if (amountFieldNum > walletBalance - totalXrpReservesNum) {
                         return this.setError('ERROR: Insufficent XRP to complete transaction');
                    }

                    this.resultField.nativeElement.innerHTML += `Funding Payment Channel\n\n`;
                    const tx = await client.autofill({
                         TransactionType: 'PaymentChannelFund',
                         Account: wallet.classicAddress,
                         Channel: this.channelIDField,
                         Amount: xrpl.xrpToDrops(this.amountField),
                    });

                    const response = await client.submitAndWait(tx, { wallet });
                    if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                         this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                         this.resultField.nativeElement.classList.add('error');

                         this.setFieldsOnError();
                         this.handleTransactionResult({
                              result: this.result,
                              isError: this.isError,
                              isSuccess: this.isSuccess,
                         });
                         return;
                    }

                    this.resultField.nativeElement.innerHTML += `Payment channel ${this.channelIDField} funded successfully.\n\n`;

                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('success');
               } else if (action === 'claim') {
                    if (!this.utilsService.validatInput(this.channelIDField)) {
                         return this.setError('Channel ID cannot be empty');
                    }
                    if (isNaN(parseFloat(this.amountField)) || parseFloat(this.amountField) <= 0) {
                         return this.setError('Amount must be a valid number and greater than 0');
                    }
                    this.resultField.nativeElement.innerHTML += `Claiming Payment Channel\n\n`;
                    const balanceDrops = xrpl.xrpToDrops(this.amountField);

                    // let signature;
                    // if (validatInput(channelClaimSignature.value)) {
                    // signature = channelClaimSignature.value;
                    // } else {
                    const signature = this.generateChannelSignature(this.channelIDField, this.amountField, wallet);
                    // }

                    const tx = await client.autofill({
                         TransactionType: 'PaymentChannelClaim',
                         Account: wallet.classicAddress,
                         Channel: this.channelIDField,
                         Balance: balanceDrops,
                         Signature: signature,
                         PublicKey: wallet.publicKey,
                    });
                    console.log(`tx: ${JSON.stringify(tx, null, 2)}`);

                    const response = await client.submitAndWait(tx, { wallet });
                    if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                         this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                         this.resultField.nativeElement.classList.add('error');

                         this.setFieldsOnError();
                         this.handleTransactionResult({
                              result: this.result,
                              isError: this.isError,
                              isSuccess: this.isSuccess,
                         });
                         return;
                    }

                    this.resultField.nativeElement.innerHTML += `Payment channel claimed successfully.\n\n`;

                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('success');
               } else if (action === 'close') {
                    if (!this.utilsService.validatInput(this.channelIDField)) {
                         return this.setError('Channel ID cannot be empty');
                    }
                    this.resultField.nativeElement.innerHTML += `Closing Payment Channel\n\n`;
                    const tx = await client.autofill({
                         TransactionType: 'PaymentChannelClaim',
                         Account: wallet.classicAddress,
                         Channel: this.channelIDField,
                         Flags: xrpl.PaymentChannelClaimFlags.tfClose,
                    });

                    const response = await client.submitAndWait(tx, { wallet });
                    if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                         this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                         this.resultField.nativeElement.classList.add('error');

                         this.setFieldsOnError();
                         this.handleTransactionResult({
                              result: this.result,
                              isError: this.isError,
                              isSuccess: this.isSuccess,
                         });
                         return;
                    }

                    this.resultField.nativeElement.innerHTML += `Payment channel closed successfully.\n\n`;

                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('success');
               }

               this.isSuccess = true;
               this.handleTransactionResult({
                    result: this.result,
                    isError: this.isError,
                    isSuccess: this.isSuccess,
               });

               const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, wallet.classicAddress);
               this.ownerCount = ownerCount;
               this.totalXrpReserves = totalXrpReserves;
               const balance = (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0');

               if (this.selectedAccount === 'account1') {
                    this.account1.balance = balance.toString();
               } else {
                    this.account2.balance = balance.toString();
               }
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

     async displayDataForAccount1() {
          console.log('Entering displayDataForAccount1');
          const startTime = Date.now();
          const account1name = this.storageService.getInputValue('account1name');
          const account1address = this.storageService.getInputValue('account1address');
          const account1seed = this.storageService.getInputValue('account1seed');
          const account1mnemonic = this.storageService.getInputValue('account1mnemonic');
          const account1secretNumbers = this.storageService.getInputValue('account1secretNumbers');

          const accountName1Field = document.getElementById('accountName1Field') as HTMLInputElement | null;
          const accountAddress1Field = document.getElementById('accountAddress1Field') as HTMLInputElement | null;
          const accountSeed1Field = document.getElementById('accountSeed1Field') as HTMLInputElement | null;

          if (accountName1Field) accountName1Field.value = account1name || '';
          if (accountAddress1Field) accountAddress1Field.value = account1address || '';
          if (accountSeed1Field) {
               if (account1seed === '') {
                    if (account1mnemonic === '') {
                         accountSeed1Field.value = account1secretNumbers || '';
                    } else {
                         accountSeed1Field.value = account1mnemonic || '';
                    }
               } else {
                    accountSeed1Field.value = account1seed || '';
               }
          }

          try {
               const client = await this.xrplService.getClient();
               const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, account1address);
               this.ownerCount = ownerCount;
               this.totalXrpReserves = totalXrpReserves;
               this.account1.balance = ((await client.getXrpBalance(account1address)) - parseFloat(this.totalXrpReserves || '0')).toString();
               console.log('this.account1.balance', this.account1.balance);
          } catch (error: any) {
               this.setError(error.message);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving handlePaymentChannelAction in ${this.executionTime}ms`);
          }

          this.getPaymentChannels();
     }

     async displayDataForAccount2() {
          console.log('Entering displayDataForAccount2');
          const startTime = Date.now();
          const account2name = this.storageService.getInputValue('account2name');
          const account2address = this.storageService.getInputValue('account2address');
          const account2seed = this.storageService.getInputValue('account2seed');
          const account2mnemonic = this.storageService.getInputValue('account2mnemonic');
          const account2secretNumbers = this.storageService.getInputValue('account2secretNumbers');

          const accountName1Field = document.getElementById('accountName1Field') as HTMLInputElement | null;
          const accountAddress1Field = document.getElementById('accountAddress1Field') as HTMLInputElement | null;
          const accountSeed1Field = document.getElementById('accountSeed1Field') as HTMLInputElement | null;

          if (accountName1Field) accountName1Field.value = account2name || '';
          if (accountAddress1Field) accountAddress1Field.value = account2address || '';
          if (accountSeed1Field) {
               if (account2seed === '') {
                    if (account2mnemonic === '') {
                         accountSeed1Field.value = account2secretNumbers || '';
                    } else {
                         accountSeed1Field.value = account2mnemonic || '';
                    }
               } else {
                    accountSeed1Field.value = account2seed || '';
               }
          }

          try {
               const client = await this.xrplService.getClient();
               const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, account2address);
               this.ownerCount = ownerCount;
               this.totalXrpReserves = totalXrpReserves;
               this.account1.balance = ((await client.getXrpBalance(account2address)) - parseFloat(this.totalXrpReserves || '0')).toString();
               console.log('this.account2.balance', this.account1.balance);
          } catch (error: any) {
               this.setError(error.message);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving handlePaymentChannelAction in ${this.executionTime}ms`);
          }

          this.getPaymentChannels();
     }

     private setError(message: string) {
          this.setFieldsOnError();
          this.result = `${message}`;
     }

     private setFieldsOnError() {
          this.isError = true;
          this.isSuccess = false;
          this.spinner = false;
     }

     public setSuccess(message: string) {
          this.result = `${message}`;
          this.isError = false;
          this.isSuccess = true;
     }
}
