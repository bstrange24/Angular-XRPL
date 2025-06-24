import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { WalletInputComponent } from '../wallet-input/wallet-input.component';
import { StorageService } from '../../services/storage.service';
import * as xrpl from 'xrpl';
import { AccountSet, TransactionMetadataBase, AccountObject } from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';
import { sign } from 'ripple-keypairs';
import { WithImplicitCoercion } from 'buffer';

interface EscrowObject {
     index: string;
     Expiration?: number;
     Destination: string;
     Condition: string;
     CancelAfter: string;
     Amount: string;
     DestinationTag: string;
     Balance: string;
     SourceTag: number;
     PreviousTxnID: string;
     Sequence: number | null | undefined;
}

@Component({
     selector: 'app-create-time-escrow',
     standalone: true,
     imports: [CommonModule, FormsModule, WalletInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './create-time-escrow.component.html',
     styleUrl: './create-time-escrow.component.css',
})
export class CreateTimeEscrowComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     selectedAccount: 'account1' | 'account2' | null = null;
     private lastResult: string = '';
     private intervalId: any;
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
     escrowFinishTimeField = '';
     escrowFinishTimeUnit: string = 'seconds';
     escrowCancelTimeUnit: string = 'seconds';
     escrowCancelTimeField = '';
     escrowOwnerField = '';
     escrowSequenceNumberField = '';
     // currentTimeField = '';
     memoField = '';
     isMultiSignTransaction = false;
     multiSignAddress = '';
     spinner = false;

     constructor(private xrplService: XrplService, private utilsService: UtilsService, private cdr: ChangeDetectorRef, private storageService: StorageService) {}

     ngOnInit(): void {
          console.log('DOM fully loaded at', new Date().toISOString());

          // this.updateTimeField(); // Set initial time

          // // Update every 5 seconds
          // this.intervalId = setInterval(() => {
          //      this.updateTimeField();
          // }, 5000);
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

     // updateTimeField(): void {
     //      this.currentTimeField = this.utilsService.convertToEstTime(new Date().toISOString());
     // }

     ngOnDestroy(): void {
          if (this.intervalId) {
               clearInterval(this.intervalId);
          }
     }

     async getEscrows() {
          console.log('Entering getEscrows');
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
               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nGetting Escrows\n\n`;

               const tx = await client.request({
                    command: 'account_objects',
                    account: wallet.classicAddress,
                    type: 'escrow',
                    ledger_index: 'validated',
               });

               console.log('Escrow objects:', tx);

               const data = {
                    sections: [{}],
               };

               if (tx.result.account_objects.length <= 0) {
                    data.sections.push({
                         title: 'Escrows',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No escrows found for <code>${wallet.classicAddress}</code>` }],
                    });
               } else {
                    const previousTxnIDs = tx.result.account_objects.map(obj => obj.PreviousTxnID);
                    console.log('PreviousTxnIDs:', previousTxnIDs);

                    // Fetch Sequence for each PreviousTxnID
                    const escrows = tx.result.account_objects.map(escrow => ({ ...escrow, Sequence: null as number | null }));
                    for (const [index, previousTxnID] of previousTxnIDs.entries()) {
                         const sequenceTx = await client.request({
                              command: 'tx',
                              transaction: previousTxnID,
                         });
                         const offerSequence = sequenceTx.result.tx_json.Sequence;
                         console.log(`Escrow OfferSequence: ${offerSequence} Hash: ${sequenceTx.result.hash}`);
                         escrows[index].Sequence = offerSequence !== undefined ? offerSequence : null;
                    }

                    data.sections.push({
                         title: `Escrows (${escrows.length})`,
                         openByDefault: true,
                         subItems: escrows.map((escrow, index) => {
                              const Amount = (escrow as any).Amount;
                              const Destination = (escrow as any).Destination;
                              const Condition = (escrow as any).Condition;
                              const CancelAfter = (escrow as any).CancelAfter;
                              const FinishAfter = (escrow as any).FinishAfter;
                              const DestinationTag = (escrow as any).DestinationTag;
                              const PreviousTxnID = (escrow as any).PreviousTxnID;
                              const Sequence = (escrow as any).Sequence;
                              return {
                                   key: `Escrow ${index + 1} (ID: ${PreviousTxnID ? PreviousTxnID.slice(0, 8) : 'N/A'}...)`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Previous Txn ID', value: `<code>${PreviousTxnID || 'N/A'}</code>` },
                                        { key: 'Sequence', value: Sequence !== null && Sequence !== undefined ? String(Sequence) : 'N/A' },
                                        { key: 'Amount', value: Amount ? `${xrpl.dropsToXrp(Amount)} XRP` : 'N/A' },
                                        { key: 'Destination', value: Destination ? `<code>${Destination}</code>` : 'N/A' },
                                        ...(Condition ? [{ key: 'Condition', value: `<code>${Condition}</code>` }] : []),
                                        ...(CancelAfter ? [{ key: 'Cancel After', value: new Date(CancelAfter * 1000).toLocaleString() }] : []),
                                        ...(FinishAfter ? [{ key: 'Finish After', value: new Date(FinishAfter * 1000).toLocaleString() }] : []),
                                        ...(DestinationTag ? [{ key: 'Destination Tag', value: String(DestinationTag) }] : []),
                                        ...(escrow && (escrow as any).SourceTag ? [{ key: 'Source Tag', value: String((escrow as any).SourceTag) }] : []),
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

               // if (this.currentTimeField) {
               //      this.currentTimeField = this.utilsService.convertToEstTime(new Date().toISOString());
               // }

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
               console.log(`Leaving getEscrows in ${this.executionTime}ms`);
          }
     }

     async createTimeBasedEscrow() {
          console.log('Entering createTimeBasedEscrow');
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

               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nCreate Time Based Escrow\n\n`;

               const finishAfterTime = this.utilsService.addTime(this.escrowFinishTimeField, this.escrowFinishTimeUnit as 'seconds' | 'minutes' | 'hours' | 'days');
               const cancelAfterTime = this.utilsService.addTime(this.escrowCancelTimeField, this.escrowCancelTimeUnit as 'seconds' | 'minutes' | 'hours' | 'days');
               console.log(`finishUnit: ${this.escrowFinishTimeUnit} cancelUnit: ${this.escrowCancelTimeUnit}`);
               console.log(`finishTime: ${this.utilsService.convertXRPLTime(finishAfterTime)} cancelTime: ${this.utilsService.convertXRPLTime(cancelAfterTime)}`);

               const escrowTx: any = await client.autofill({
                    TransactionType: 'EscrowCreate',
                    Account: wallet.address,
                    Amount: xrpl.xrpToDrops(this.amountField),
                    Destination: this.destinationField,
                    FinishAfter: finishAfterTime,
                    CancelAfter: cancelAfterTime,
               });

               if (this.memoField) {
                    escrowTx.Memos = [
                         {
                              Memo: {
                                   MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                                   MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                              },
                         },
                    ];
               }

               const destinationTagText = this.destinationTagField;
               if (destinationTagText) {
                    if (parseInt(destinationTagText) <= 0) {
                         return this.setError('ERROR: Destination Tag must be a valid number and greater than zero');
                    }
                    escrowTx.DestinationTag = parseInt(destinationTagText, 10);
               }

               const signed = wallet.sign(escrowTx);
               const tx = await client.submitAndWait(signed.tx_blob);

               console.log('Create Escrow tx', tx);

               if (tx.result.meta && typeof tx.result.meta !== 'string' && (tx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    return;
               }

               this.resultField.nativeElement.innerHTML += `Escrow created successfully.\n\n`;

               this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');

               // if (this.currentTimeField) {
               //      this.currentTimeField = this.utilsService.convertToEstTime(new Date().toISOString());
               // }

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
               console.log(`Leaving createTimeBasedEscrow in ${this.executionTime}ms`);
          }
     }

     async finishTimeBasedEscrow() {
          console.log('Entering finishTimeBasedEscrow');
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
               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nFinishing Escrow\n\n`;

               const prepared = await client.autofill({
                    TransactionType: 'EscrowFinish',
                    Account: wallet.classicAddress,
                    Owner: this.escrowOwnerField,
                    OfferSequence: parseInt(this.escrowSequenceNumberField),
               });

               const signed = wallet.sign(prepared);
               const tx = await client.submitAndWait(signed.tx_blob);

               console.log('Finish Escrow tx', tx);

               if (tx.result.meta && typeof tx.result.meta !== 'string' && (tx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    return;
               }

               this.resultField.nativeElement.innerHTML += `Escrow finsihed successfully.\n\n`;

               this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');

               // if (this.currentTimeField) {
               //      this.currentTimeField = this.utilsService.convertToEstTime(new Date().toISOString());
               // }

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
               console.log(`Leaving finishTimeBasedEscrow in ${this.executionTime}ms`);
          }
     }

     async cancelEscrow() {
          console.log('Entering cancelEscrow');
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
               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nCancelling Escrow\n\n`;

               const prepared = await client.autofill({
                    TransactionType: 'EscrowCancel',
                    Account: wallet.address,
                    Owner: this.escrowOwnerField,
                    OfferSequence: parseInt(this.escrowSequenceNumberField),
               });

               const signed = wallet.sign(prepared);
               const tx = await client.submitAndWait(signed.tx_blob);

               console.log('Cancel Escrow tx', tx);

               if (tx.result.meta && typeof tx.result.meta !== 'string' && (tx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    return;
               }

               this.resultField.nativeElement.innerHTML += `Escrow cancelled successfully.\n\n`;

               this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');

               // if (this.currentTimeField) {
               //      this.currentTimeField = this.utilsService.convertToEstTime(new Date().toISOString());
               // }

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
               console.log(`Leaving cancelEscrow in ${this.executionTime}ms`);
          }
     }

     async displayDataForAccount1() {
          console.log('Entering displayDataForAccount1');
          const startTime = Date.now();
          const account1name = this.storageService.getInputValue('account1name');
          const account1address = this.storageService.getInputValue('account1address');
          const account2address = this.storageService.getInputValue('account2address');
          const account1seed = this.storageService.getInputValue('account1seed');
          const account1mnemonic = this.storageService.getInputValue('account1mnemonic');
          const account1secretNumbers = this.storageService.getInputValue('account1secretNumbers');

          const accountName1Field = document.getElementById('accountName1Field') as HTMLInputElement | null;
          const accountAddress1Field = document.getElementById('accountAddress1Field') as HTMLInputElement | null;
          const accountSeed1Field = document.getElementById('accountSeed1Field') as HTMLInputElement | null;
          const destinationField = document.getElementById('destinationField') as HTMLInputElement | null;
          const escrowOwnerField = document.getElementById('escrowOwnerField') as HTMLInputElement | null;

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

          if (destinationField) {
               this.destinationField = account2address;
          }

          if (escrowOwnerField) {
               this.escrowOwnerField = account1address;
          }

          try {
               const { environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               const { accountInfo, accountObjects } = await this.utilsService.getAccountInfo(account1seed, environment);
               this.utilsService.renderAccountDetails(accountInfo, accountObjects);
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

          this.getEscrows();
     }

     async displayDataForAccount2() {
          console.log('Entering displayDataForAccount2');
          const startTime = Date.now();
          const account2name = this.storageService.getInputValue('account2name');
          const account1address = this.storageService.getInputValue('account1address');
          const account2address = this.storageService.getInputValue('account2address');
          const account2seed = this.storageService.getInputValue('account2seed');
          const account2mnemonic = this.storageService.getInputValue('account2mnemonic');
          const account2secretNumbers = this.storageService.getInputValue('account2secretNumbers');

          const accountName1Field = document.getElementById('accountName1Field') as HTMLInputElement | null;
          const accountAddress1Field = document.getElementById('accountAddress1Field') as HTMLInputElement | null;
          const accountSeed1Field = document.getElementById('accountSeed1Field') as HTMLInputElement | null;
          const destinationField = document.getElementById('destinationField') as HTMLInputElement | null;
          const escrowOwnerField = document.getElementById('escrowOwnerField') as HTMLInputElement | null;

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

          if (destinationField) {
               this.destinationField = account1address;
          }

          if (escrowOwnerField) {
               this.escrowOwnerField = account2address;
          }

          try {
               const { environment } = this.xrplService.getNet();
               const client = await this.xrplService.getClient();
               const { accountInfo, accountObjects } = await this.utilsService.getAccountInfo(account2seed, environment);
               this.utilsService.renderAccountDetails(accountInfo, accountObjects);
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

          this.getEscrows();
     }

     private setError(message: string) {
          this.isError = true;
          this.isSuccess = false;
          this.result = `${message}`;
          this.spinner = false;
     }

     public setSuccess(message: string) {
          this.result = `${message}`;
          this.isError = false;
          this.isSuccess = true;
     }
}
