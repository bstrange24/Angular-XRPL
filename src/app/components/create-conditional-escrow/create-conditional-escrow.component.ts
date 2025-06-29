import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { WalletInputComponent } from '../wallet-input/wallet-input.component';
import { StorageService } from '../../services/storage.service';
import * as xrpl from 'xrpl';
import { TransactionMetadataBase, EscrowCancel, EscrowCreate, EscrowFinish } from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';
import { sign } from 'ripple-keypairs';
import { WithImplicitCoercion } from 'buffer';
import * as crypto from 'crypto';
import * as cc from 'five-bells-condition';
import { Subscription } from 'rxjs';

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
     selector: 'app-create-conditional-escrow',
     standalone: true,
     imports: [CommonModule, FormsModule, WalletInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './create-conditional-escrow.component.html',
     styleUrl: './create-conditional-escrow.component.css',
})
export class CreateConditionalEscrowComponent implements AfterViewChecked {
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
     escrowFinishTimeField = '';
     escrowFinishTimeUnit: string = 'seconds';
     escrowCancelTimeUnit: string = 'seconds';
     escrowConditionField = '';
     escrowFulfillmentField = '';
     escrowCancelTimeField = '';
     escrowOwnerField = '';
     escrowSequenceNumberField = '';
     memoField = '';
     ticketSequence: string = '';
     isTicket = false;
     isTicketEnabled = false;
     isMultiSignTransaction = false;
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

     async getEscrows() {
          console.log('Entering getEscrows');
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
               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nGetting Escrows\n\n`;

               const tx = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'escrow');
               console.debug('Escrow objects:', tx);

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

               this.setSuccess(this.result);

               await this.updateXrpBalance(client, wallet.classicAddress);
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getEscrows in ${this.executionTime}ms`);
          }
     }

     async createConditionalEscrow() {
          console.log('Entering createConditionalEscrow');
          const startTime = Date.now();
          this.setSuccessProperties();

          if (!this.selectedAccount) {
               return this.setError('Please select an account');
          }

          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
          if (!this.utilsService.validatInput(seed)) {
               return this.setError('ERROR: Account seed cannot be empty');
          }

          if (!this.utilsService.validatInput(this.destinationField)) {
               return this.setError('ERROR: Destination cannot be empty');
          }

          if (!this.utilsService.validatInput(this.amountField)) {
               return this.setError('ERROR: XRP Amount cannot be empty');
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

               if (await this.utilsService.isSufficentXrpBalance(client, this.amountField, this.totalXrpReserves, wallet.classicAddress)) {
                    return this.setError('ERROR: Insufficent XRP to complete transaction');
               }

               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nCreate Time Based Escrow\n\n`;

               const finishAfterTime = this.utilsService.addTime(this.escrowFinishTimeField, this.escrowFinishTimeUnit as 'seconds' | 'minutes' | 'hours' | 'days');
               const cancelAfterTime = this.utilsService.addTime(this.escrowCancelTimeField, this.escrowCancelTimeUnit as 'seconds' | 'minutes' | 'hours' | 'days');
               console.log(`finishUnit: ${this.escrowFinishTimeUnit} cancelUnit: ${this.escrowCancelTimeUnit}`);
               console.log(`finishTime: ${this.utilsService.convertXRPLTime(finishAfterTime)} cancelTime: ${this.utilsService.convertXRPLTime(cancelAfterTime)}`);

               const feeResponse = await client.request({ command: 'fee' });
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               let escrowTx: EscrowCreate;
               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }

                    escrowTx = await client.autofill({
                         TransactionType: 'EscrowCreate',
                         Account: wallet.address,
                         Amount: xrpl.xrpToDrops(this.amountField),
                         Destination: this.destinationField,
                         FinishAfter: finishAfterTime,
                         CancelAfter: cancelAfterTime,
                         Sequence: 0,
                         Fee: feeResponse.result.drops.open_ledger_fee || AppConstants.MAX_FEE,
                         LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                    });
               } else {
                    escrowTx = await client.autofill({
                         TransactionType: 'EscrowCreate',
                         Account: wallet.address,
                         Amount: xrpl.xrpToDrops(this.amountField),
                         Destination: this.destinationField,
                         FinishAfter: finishAfterTime,
                         CancelAfter: cancelAfterTime,
                         Fee: feeResponse.result.drops.open_ledger_fee || AppConstants.MAX_FEE,
                         LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                    });
               }

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

               console.log(`escrowTx: ${JSON.stringify(escrowTx, null, 2)}`);
               const signed = wallet.sign(escrowTx);
               console.log(`signed: ${JSON.stringify(signed, null, 2)}`);
               const tx = await client.submitAndWait(signed.tx_blob);
               console.log('Create Escrow tx', JSON.stringify(tx, null, 2));

               if (tx.result.meta && typeof tx.result.meta !== 'string' && (tx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.resultField.nativeElement.innerHTML += `Escrow created successfully.\n\n`;
               this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               await this.updateXrpBalance(client, wallet.classicAddress);
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving createConditionalEscrow in ${this.executionTime}ms`);
          }
     }

     async finishConditionalEscrow() {
          console.log('Entering finishConditionalEscrow');
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

               if (await this.utilsService.isSufficentXrpBalance(client, this.amountField, this.totalXrpReserves, wallet.classicAddress)) {
                    return this.setError('ERROR: Insufficent XRP to complete transaction');
               }

               const feeResponse = await client.request({ command: 'fee' });
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               let escrowTx: EscrowFinish;
               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }

                    escrowTx = {
                         TransactionType: 'EscrowFinish',
                         Account: wallet.classicAddress,
                         Owner: this.escrowOwnerField,
                         OfferSequence: parseInt(this.escrowSequenceNumberField),
                         Sequence: 0,
                         Fee: feeResponse.result.drops.open_ledger_fee || AppConstants.MAX_FEE,
                         LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                    };
               } else {
                    escrowTx = {
                         TransactionType: 'EscrowFinish',
                         Account: wallet.classicAddress,
                         Owner: this.escrowOwnerField,
                         OfferSequence: parseInt(this.escrowSequenceNumberField),
                         Fee: feeResponse.result.drops.open_ledger_fee || AppConstants.MAX_FEE,
                         LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                    };
               }

               if (this.memoField) {
                    escrowTx.Memos = [
                         {
                              Memo: {
                                   MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                                   MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                              },
                         },
                    ];
               }

               console.log(`escrowTx: ${JSON.stringify(escrowTx, null, 2)}`);
               let preparedTx = await client.autofill(escrowTx);
               const signed = wallet.sign(preparedTx);
               console.log(`signed: ${JSON.stringify(signed, null, 2)}`);
               const tx = await client.submitAndWait(signed.tx_blob);
               console.log('Create Escrow tx', JSON.stringify(tx, null, 2));

               if (tx.result.meta && typeof tx.result.meta !== 'string' && (tx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.resultField.nativeElement.innerHTML += `Escrow finsihed successfully.\n\n`;
               this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               await this.updateXrpBalance(client, wallet.classicAddress);
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving finishConditionalEscrow in ${this.executionTime}ms`);
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

               if (await this.utilsService.isSufficentXrpBalance(client, this.amountField, this.totalXrpReserves, wallet.classicAddress)) {
                    return this.setError('ERROR: Insufficent XRP to complete transaction');
               }

               const feeResponse = await client.request({ command: 'fee' });
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               let escrowTx: EscrowCancel;
               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }

                    escrowTx = {
                         TransactionType: 'EscrowCancel',
                         Account: wallet.address,
                         Owner: this.escrowOwnerField,
                         OfferSequence: parseInt(this.escrowSequenceNumberField),
                         Sequence: 0,
                         Fee: feeResponse.result.drops.open_ledger_fee || AppConstants.MAX_FEE,
                         LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                    };
               } else {
                    escrowTx = {
                         TransactionType: 'EscrowCancel',
                         Account: wallet.classicAddress,
                         Owner: this.escrowOwnerField,
                         OfferSequence: parseInt(this.escrowSequenceNumberField),
                         Fee: feeResponse.result.drops.open_ledger_fee || AppConstants.MAX_FEE,
                         LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                    };
               }

               if (this.memoField) {
                    escrowTx.Memos = [
                         {
                              Memo: {
                                   MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                                   MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                              },
                         },
                    ];
               }

               console.log(`escrowTx: ${JSON.stringify(escrowTx, null, 2)}`);
               let preparedTx = await client.autofill(escrowTx);
               const signed = wallet.sign(preparedTx);
               console.log(`signed: ${JSON.stringify(signed, null, 2)}`);
               const tx = await client.submitAndWait(signed.tx_blob);
               console.log('Create Escrow tx', JSON.stringify(tx, null, 2));

               if (tx.result.meta && typeof tx.result.meta !== 'string' && (tx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

               this.resultField.nativeElement.innerHTML += `Escrow cancelled successfully.\n\n`;
               this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');
               this.setSuccess(this.result);

               await this.updateXrpBalance(client, wallet.classicAddress);
          } catch (error: any) {
               console.error('Error:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving cancelEscrow in ${this.executionTime}ms`);
          }
     }

     getCondition() {
          const { condition, fulfillment } = this.generateCondition();
          this.escrowConditionField = condition;
          this.escrowFulfillmentField = fulfillment;
     }

     generateCondition(): { condition: string; fulfillment: string } {
          console.log('Generating a cryptographic condition and fulfillment for XRPL escrow');

          // Use Web Crypto API to generate 32 random bytes
          const preimage = new Uint8Array(32);
          globalThis.crypto.getRandomValues(preimage); // Browser-compatible random bytes

          // Create a PREIMAGE-SHA-256 condition
          const fulfillment = new cc.PreimageSha256();
          fulfillment.setPreimage(Buffer.from(preimage)); // Convert Uint8Array to Buffer

          // Get the condition (hash of the preimage) in hexadecimal
          const condition = fulfillment.getConditionBinary().toString('hex').toUpperCase();

          // Get the fulfillment (preimage) in hexadecimal, to be kept secret
          const fulfillment_hex = fulfillment.serializeBinary().toString('hex').toUpperCase();

          console.log('Condition:', condition);
          console.log('Fulfillment (keep secret until ready to finish escrow):', fulfillment_hex);

          return { condition, fulfillment: fulfillment_hex };
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
               this.getEscrows();
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
