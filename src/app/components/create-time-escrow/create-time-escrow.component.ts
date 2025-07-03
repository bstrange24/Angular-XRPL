import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { WalletInputComponent } from '../wallet-input/wallet-input.component';
import { StorageService } from '../../services/storage.service';
import * as xrpl from 'xrpl';
import { TransactionMetadataBase, EscrowCreate, EscrowFinish, EscrowCancel } from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { AppConstants } from '../../core/app.constants';

interface EscrowObject {
     Account: string;
     index: string;
     Expiration?: number;
     Destination: string;
     Condition: string;
     CancelAfter: string;
     FinshAfter: string;
     Amount: string;
     DestinationTag: string;
     Balance: string;
     SourceTag: number;
     PreviousTxnID: string;
     Memo: string | null | undefined;
     Sequence: number | null | undefined;
     TicketSequence: number | null | undefined;
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
     accountAddress1Field: string = '';
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

     async getEscrowOwnerAddress() {
          if (this.account1.address) {
               if (!xrpl.isValidAddress(this.account1.address)) {
                    console.error('Invalid adress');
               }

               const client = await this.xrplService.getClient();
               const escrowsTx = await this.xrplService.getAccountObjects(client, this.account1.address, 'validated', 'escrow');
               const previousTxnIDs = escrowsTx.result.account_objects.map(obj => obj.PreviousTxnID);
               console.log('PreviousTxnIDs:', previousTxnIDs);
               const escrows = escrowsTx.result.account_objects.map(escrow => ({ ...escrow, Sequence: null as number | null }));
               for (const [index, previousTxnID] of previousTxnIDs.entries()) {
                    if (typeof previousTxnID === 'string') {
                         const sequenceTx = await this.xrplService.getTxData(client, previousTxnID);
                         console.debug('sequenceTx:', sequenceTx);
                         const offerSequence = sequenceTx.result.tx_json.Sequence;
                         if (offerSequence === Number(this.escrowSequenceNumberField)) {
                              if ('Account' in escrows[index]) {
                                   this.escrowOwnerField = (escrows[index] as any).Account;
                                   break;
                              }
                         }
                    }
               }
          }
     }

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
               const wallet = await this.utilsService.getWallet(seed, environment);

               this.showSpinnerWithDelay('Getting Escrows ...', 250);

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
                    const escrows = tx.result.account_objects.map(escrow => ({ ...escrow, Sequence: null as number | null, TicketSequence: undefined as number | string | undefined }));
                    for (const [index, previousTxnID] of previousTxnIDs.entries()) {
                         if (typeof previousTxnID === 'string') {
                              const sequenceTx = await this.xrplService.getTxData(client, previousTxnID);
                              console.debug('sequenceTx:', sequenceTx);
                              const offerSequence = sequenceTx.result.tx_json.Sequence;
                              const TicketSequence = sequenceTx.result.tx_json.TicketSequence;
                              const memoData = sequenceTx.result.tx_json.Memos ? sequenceTx.result.tx_json.Memos[0].Memo.MemoData : 'N/A';
                              console.log(`Escrow OfferSequence: ${offerSequence} Hash: ${sequenceTx.result.hash} Memo: ${memoData}`);
                              escrows[index].Sequence = offerSequence !== undefined ? offerSequence : null;
                              escrows[index].TicketSequence = TicketSequence !== undefined ? TicketSequence : 'N/A';
                              (escrows[index] as any).Memo = memoData !== undefined ? memoData : null;
                         } else {
                              escrows[index].Sequence = null;
                         }
                    }

                    data.sections.push({
                         title: `Escrows (${escrows.length})`,
                         openByDefault: true,
                         subItems: escrows.map((escrow, index) => {
                              const Owner = (escrow as any).Account;
                              const Amount = (escrow as any).Amount;
                              const Destination = (escrow as any).Destination;
                              const Condition = (escrow as any).Condition;
                              const CancelAfter = (escrow as any).CancelAfter;
                              const FinishAfter = (escrow as any).FinishAfter;
                              const DestinationTag = (escrow as any).DestinationTag;
                              const PreviousTxnID = (escrow as any).PreviousTxnID;
                              const Sequence = (escrow as any).Sequence;
                              const TicketSequence = (escrow as any).TicketSequence;
                              const Memo = (escrow as any).Memo;
                              return {
                                   key: `Escrow ${index + 1} (ID: ${PreviousTxnID ? PreviousTxnID.slice(0, 8) : 'N/A'}...)`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Owner', value: `<code>${Owner || 'N/A'}</code>` },
                                        { key: 'Previous Txn ID', value: `<code>${PreviousTxnID || 'N/A'}</code>` },
                                        { key: 'Sequence', value: Sequence !== null && Sequence !== undefined ? String(Sequence) : 'N/A' },
                                        { key: 'Ticket Sequence', value: TicketSequence !== null && TicketSequence !== undefined ? String(TicketSequence) : 'N/A' },
                                        { key: 'Amount', value: Amount ? `${xrpl.dropsToXrp(Amount)} XRP` : 'N/A' },
                                        { key: 'Destination', value: Destination ? `<code>${Destination}</code>` : 'N/A' },
                                        ...(Condition ? [{ key: 'Condition', value: `<code>${Condition}</code>` }] : []),
                                        ...(CancelAfter ? [{ key: 'Cancel After', value: this.utilsService.convertXRPLTime(CancelAfter) }] : []),
                                        ...(FinishAfter ? [{ key: 'Finish After', value: this.utilsService.convertXRPLTime(FinishAfter) }] : []),
                                        ...(DestinationTag ? [{ key: 'Destination Tag', value: String(DestinationTag) }] : []),
                                        ...(Memo ? [{ key: 'Memo', value: this.utilsService.decodeHex(Memo) }] : []),
                                        ...(escrow && (escrow as any).SourceTag ? [{ key: 'Source Tag', value: String((escrow as any).SourceTag) }] : []),
                                   ],
                              };
                         }),
                    });
               }

               this.utilsService.renderPaymentChannelDetails(data);

               this.setSuccess(this.result);

               this.getEscrowOwnerAddress();

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

     async createTimeBasedEscrow() {
          console.log('Entering createTimeBasedEscrow');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed,
               amount: this.amountField,
               destination: this.destinationField,
               finishTime: this.escrowFinishTimeField,
               cancelTime: this.escrowCancelTimeField,
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
               } else {
                    wallet = await this.utilsService.getWallet(this.account2.seed, environment);
               }

               if (!wallet) {
                    this.setError('ERROR: Wallet could not be created or is undefined');
                    return;
               }

               if (await this.utilsService.isInsufficientXrpBalance(client, this.amountField, this.totalXrpReserves, wallet.classicAddress)) {
                    return this.setError('ERROR: Insufficent XRP to complete transaction');
               }

               this.showSpinnerWithDelay('Create Time Based Escrow ...', 250);

               const finishAfterTime = this.utilsService.addTime(this.escrowFinishTimeField, this.escrowFinishTimeUnit as 'seconds' | 'minutes' | 'hours' | 'days');
               const cancelAfterTime = this.utilsService.addTime(this.escrowCancelTimeField, this.escrowCancelTimeUnit as 'seconds' | 'minutes' | 'hours' | 'days');
               console.log(`finishUnit: ${this.escrowFinishTimeUnit} cancelUnit: ${this.escrowCancelTimeUnit}`);
               console.log(`finishTime: ${this.utilsService.convertXRPLTime(finishAfterTime)} cancelTime: ${this.utilsService.convertXRPLTime(cancelAfterTime)}`);

               const fee = await this.xrplService.calculateTransactionFee(client);
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
                         TicketSequence: Number(this.ticketSequence),
                         Sequence: 0,
                         Fee: fee,
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
                         Fee: fee,
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
               console.log(`Leaving createTimeBasedEscrow in ${this.executionTime}ms`);
          }
     }

     async finishTimeBasedEscrow() {
          console.log('Entering finishTimeBasedEscrow');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed,
               sequence: this.escrowSequenceNumberField,
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
               } else {
                    wallet = await this.utilsService.getWallet(this.account2.seed, environment);
               }

               if (!wallet) {
                    this.setError('ERROR: Wallet could not be created or is undefined');
                    return;
               }

               this.showSpinnerWithDelay('Finishing Escrow ...', 250);

               // Fetch escrow objects for the account
               const escrowObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'escrow');
               if (escrowObjects.result.account_objects.length <= 0) {
                    return this.setError(`No escrows found for account ${wallet.classicAddress}`);
               }

               // Find the escrow with the specified sequence number
               const escrow = await this.xrplService.getEscrowBySequence(client, wallet.classicAddress, Number(this.escrowSequenceNumberField));
               if (!escrow) {
                    return this.setError(`No escrow found for sequence ${this.escrowSequenceNumberField}`);
               }
               const escrowOwner = escrow.Account;

               // Check if the escrow can be canceled based on the CancelAfter time
               const currentRippleTime = await this.xrplService.getCurrentRippleTime(client);
               const escrowStatus = this.utilsService.checkTimeBasedEscrowStatus({ FinishAfter: escrow.FinishAfter, CancelAfter: escrow.CancelAfter, owner: escrowOwner }, currentRippleTime, wallet.classicAddress, 'finishEscrow');

               if (!escrowStatus.canFinish && !escrowStatus.canCancel) {
                    return this.setError(`ERROR:\n${escrowStatus.reasonCancel}\n${escrowStatus.reasonFinish}`);
               }

               if (!escrowStatus.canFinish) {
                    return this.setError(`ERROR: ${escrowStatus.reasonFinish}`);
               }

               if (!escrowStatus.canCancel) {
                    return this.setError(`ERROR: ${escrowStatus.reasonCancel}`);
               }

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               let escrowTx: EscrowFinish;
               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }

                    escrowTx = await client.autofill({
                         TransactionType: 'EscrowFinish',
                         Account: wallet.classicAddress,
                         Owner: this.escrowOwnerField,
                         OfferSequence: parseInt(this.escrowSequenceNumberField),
                         TicketSequence: Number(this.ticketSequence),
                         Sequence: 0,
                         Fee: fee,
                         LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                    });
               } else {
                    escrowTx = await client.autofill({
                         TransactionType: 'EscrowFinish',
                         Account: wallet.classicAddress,
                         Owner: this.escrowOwnerField,
                         OfferSequence: parseInt(this.escrowSequenceNumberField),
                         Fee: fee,
                         LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                    });
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
               console.log(`Leaving finishTimeBasedEscrow in ${this.executionTime}ms`);
          }
     }

     async cancelEscrow() {
          console.log('Entering cancelEscrow');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed,
               sequence: this.escrowSequenceNumberField,
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
               } else {
                    wallet = await this.utilsService.getWallet(this.account2.seed, environment);
               }

               if (!wallet) {
                    this.setError('ERROR: Wallet could not be created or is undefined');
                    return;
               }

               this.showSpinnerWithDelay('Cancelling Escrow ...', 250);

               // Fetch escrow objects for the account
               const escrowObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'escrow');
               if (escrowObjects.result.account_objects.length <= 0) {
                    return this.setError(`No escrows found for account ${wallet.classicAddress}`);
               }

               let foundSequenceNumber = false;
               let escrowOwner = this.account1.address;
               let escrow: EscrowObject | undefined = undefined;
               for (const [index, obj] of escrowObjects.result.account_objects.entries()) {
                    if (obj.PreviousTxnID) {
                         const sequenceTx = await this.xrplService.getTxData(client, obj.PreviousTxnID);
                         if (sequenceTx.result.tx_json.Sequence === Number(this.escrowSequenceNumberField)) {
                              foundSequenceNumber = true;
                              escrow = obj as unknown as EscrowObject;
                              escrowOwner = escrow.Account;
                              break;
                         } else if (sequenceTx.result.tx_json.TicketSequence != undefined && sequenceTx.result.tx_json.TicketSequence === Number(this.escrowSequenceNumberField)) {
                              foundSequenceNumber = true;
                              escrow = obj as unknown as EscrowObject;
                              escrowOwner = escrow.Account;
                              break;
                         }
                    }
               }

               if (!escrow) {
                    return this.setError(`No escrow found for sequence ${this.escrowSequenceNumberField}`);
               }

               // Check if the escrow can be canceled based on the CancelAfter time
               const currentRippleTime = await this.xrplService.getCurrentRippleTime(client);
               // Ensure FinishAfter and CancelAfter are numbers
               const finishAfterNum = escrow.FinshAfter !== undefined ? Number(escrow.FinshAfter) : undefined;
               const cancelAfterNum = escrow.CancelAfter !== undefined ? Number(escrow.CancelAfter) : undefined;
               const escrowStatus = this.utilsService.checkTimeBasedEscrowStatus({ FinishAfter: finishAfterNum, CancelAfter: cancelAfterNum, owner: escrowOwner }, currentRippleTime, wallet.classicAddress, 'cancelEscrow');

               if (!escrowStatus.canCancel) {
                    return this.setError(`ERROR: ${escrowStatus.reasonCancel}`);
               }

               // Prepare the EscrowCancel transaction
               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               let escrowTx: EscrowCancel;
               if (this.ticketSequence) {
                    if (!(await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.ticketSequence)))) {
                         return this.setError(`ERROR: Ticket Sequence ${this.ticketSequence} not found for account ${wallet.classicAddress}`);
                    }

                    escrowTx = await client.autofill({
                         TransactionType: 'EscrowCancel',
                         Account: wallet.classicAddress,
                         Owner: escrowOwner,
                         OfferSequence: parseInt(this.escrowSequenceNumberField),
                         TicketSequence: Number(this.ticketSequence),
                         Sequence: 0,
                         Fee: fee,
                         LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                    });
               } else {
                    escrowTx = await client.autofill({
                         TransactionType: 'EscrowCancel',
                         Account: wallet.classicAddress,
                         Owner: escrowOwner,
                         OfferSequence: parseInt(this.escrowSequenceNumberField),
                         Fee: fee,
                         LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
                    });
               }

               console.log(`escrowTx: ${JSON.stringify(escrowTx, null, 2)}`);
               const signed = wallet.sign(escrowTx);
               console.log(`signed: ${JSON.stringify(signed, null, 2)}`);
               const tx = await client.submitAndWait(signed.tx_blob);
               console.log('Cancel Escrow tx', JSON.stringify(tx, null, 2));

               if (tx.result.meta && typeof tx.result.meta !== 'string' && (tx.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(tx, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');
                    this.setErrorProperties();
                    return;
               }

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

     private async showSpinnerWithDelay(message: string, delayMs: number = 200) {
          this.spinner = true;
          this.updateSpinnerMessage(message);
          await new Promise(resolve => setTimeout(resolve, delayMs)); // Minimum display time for initial spinner
     }

     private updateSpinnerMessage(message: string) {
          this.spinnerMessage = message;
          this.cdr.detectChanges();
          console.log('Spinner message updated:', message); // For debugging
     }

     private async updateXrpBalance(client: xrpl.Client, address: string) {
          const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, address);
          this.ownerCount = ownerCount;
          this.totalXrpReserves = totalXrpReserves;
          const balance = (await client.getXrpBalance(address)) - parseFloat(this.totalXrpReserves || '0');
          this.account1.balance = balance.toString();
     }

     private validateInputs(inputs: { seed?: string; amount?: string; destination?: string; sequence?: string; selectedAccount?: 'account1' | 'account2' | null; finishTime?: string; cancelTime?: string }): string | null {
          if (inputs.selectedAccount !== undefined && !inputs.selectedAccount) {
               return 'Please select an account';
          }
          if (inputs.seed != undefined && !this.utilsService.validatInput(inputs.seed)) {
               return 'Account seed cannot be empty';
          }
          if (inputs.amount != undefined && !this.utilsService.validatInput(inputs.amount)) {
               return 'XRP Amount cannot be empty';
          }
          if (inputs.amount != undefined) {
               if (isNaN(parseFloat(inputs.amount ?? '')) || !isFinite(parseFloat(inputs.amount ?? ''))) {
                    return 'XRP Amount must be a valid number';
               }
          }
          if (inputs.amount != undefined && inputs.amount && parseFloat(inputs.amount) <= 0) {
               return 'XRP Amount must be a positive number';
          }
          if (inputs.destination != undefined && !this.utilsService.validatInput(inputs.destination)) {
               return 'Destination cannot be empty';
          }
          if (inputs.finishTime != undefined && !this.utilsService.validatInput(inputs.finishTime)) {
               return 'Escrow finish time cannot be empty';
          }
          if (inputs.finishTime != undefined) {
               if (isNaN(parseFloat(inputs.finishTime ?? '')) || !isFinite(parseFloat(inputs.finishTime ?? ''))) {
                    return 'Escrow finish time must be a valid number';
               }
          }
          if (inputs.finishTime != undefined && parseFloat(inputs.finishTime ?? '') <= 0) {
               return 'Escrow finish time must be a positive number';
          }
          if (inputs.cancelTime != undefined && !this.utilsService.validatInput(inputs.cancelTime)) {
               return 'Escrow cancel time cannot be empty';
          }
          if (inputs.cancelTime != undefined) {
               if (isNaN(parseFloat(inputs.cancelTime ?? '')) || !isFinite(parseFloat(inputs.cancelTime ?? ''))) {
                    return 'Escrow cancel time must be a valid number';
               }
          }
          if (inputs.cancelTime != undefined && parseFloat(inputs.cancelTime ?? '') <= 0) {
               return 'Escrow cancel time must be a positive number';
          }
          if (inputs.sequence != undefined && inputs.sequence && !this.utilsService.validatInput(inputs.sequence)) {
               return 'Escrow sequence number cannot be empty';
          }
          return null;
     }

     clearFields() {
          this.amountField = '';
          this.destinationField = '';
          this.escrowFinishTimeField = '';
          this.escrowCancelTimeField = '';
          this.escrowSequenceNumberField = '';
          this.memoField = '';
          this.ticketSequence = '';
          this.isTicket = false;
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
          const escrowOwnerField = document.getElementById('escrowOwnerField') as HTMLInputElement | null;

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

          if (escrowOwnerField) {
               this.escrowOwnerField = account.address;
          }

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
          console.log('setError called:', message, 'isError:', this.isError, 'selectedAccount:', this.selectedAccount);
          this.setErrorProperties();
          this.handleTransactionResult({
               result: `${message}`,
               isError: this.isError,
               isSuccess: this.isSuccess,
          });
          this.cdr.detectChanges();
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
