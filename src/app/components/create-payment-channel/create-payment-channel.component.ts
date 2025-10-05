import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { WalletInputComponent } from '../wallet-input/wallet-input.component';
import { StorageService } from '../../services/storage.service';
import * as xrpl from 'xrpl';
import { PaymentChannelCreate, PaymentChannelFund, PaymentChannelClaim } from 'xrpl';
import { NavbarComponent } from '../navbar/navbar.component';
import { SanitizeHtmlPipe } from '../../pipes/sanitize-html.pipe';
import { sign, verify } from 'ripple-keypairs';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';

interface ValidationInputs {
     selectedAccount?: 'account1' | 'account2' | null;
     senderAddress?: string;
     account_info?: any;
     seed?: string;
     amount?: string;
     destination?: string;
     settleDelay?: string;
     channelID?: string;
     channelClaimSignatureField?: string;
     publicKeyField?: string;
     destinationTag?: string;
     isRegularKeyAddress?: boolean;
     regularKeyAddress?: string;
     regularKeySeed?: string;
     useMultiSign?: boolean;
     multiSignSeeds?: string;
     multiSignAddresses?: string;
     isTicket?: boolean;
     selectedSingleTicket?: string;
     selectedTicket?: string;
     signerQuorum?: number;
     signers?: { account: string; weight: number }[];
}

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
     // @ViewChild('accountForm') accountForm!: NgForm;
     selectedAccount: 'account1' | 'account2' | null = 'account1';
     private lastResult: string = '';
     transactionInput: string = '';
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = false;
     ticketArray: string[] = [];
     selectedTickets: string[] = []; // For multiple selection
     selectedSingleTicket: string = ''; // For single selection
     multiSelectMode: boolean = false; // Toggle between modes
     selectedTicket: string = ''; // The currently selected ticket
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
     useMultiSign: boolean = false;
     multiSignAddress: string = '';
     multiSignSeeds: string = '';
     isRegularKeyAddress: boolean = false;
     regularKeySeed: string = '';
     regularKeyAddress: string = '';
     signerQuorum: number = 0;
     multiSigningEnabled: boolean = false;
     regularKeySigningEnabled: boolean = false;
     spinner: boolean = false;
     spinnerMessage: string = '';
     masterKeyDisabled: boolean = false;
     isSimulateEnabled: boolean = false;
     actions = [
          { value: 'create', label: 'Create' },
          { value: 'fund', label: 'Fund' },
          { value: 'renew', label: 'Renew' },
          { value: 'claim', label: 'Claim' },
          { value: 'close', label: 'Close' },
     ];
     signers: { account: string; seed: string; weight: number }[] = [{ account: '', seed: '', weight: 1 }];

     constructor(private readonly xrplService: XrplService, private readonly utilsService: UtilsService, private readonly cdr: ChangeDetectorRef, private readonly storageService: StorageService, private readonly renderUiComponentsService: RenderUiComponentsService, private readonly xrplTransactions: XrplTransactionService) {}

     ngOnInit() {}

     ngAfterViewInit() {
          (async () => {
               try {
                    const wallet = await this.getWallet();
                    this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
               } catch (error: any) {
                    console.error(`No wallet could be created or is undefined ${error.message}`);
                    this.setError('ERROR: Wallet could not be created or is undefined');
               } finally {
                    this.cdr.detectChanges();
               }
          })();
     }

     ngAfterViewChecked() {
          if (this.result !== this.lastResult && this.resultField?.nativeElement) {
               this.renderUiComponentsService.attachSearchListener(this.resultField.nativeElement);
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

     onTicketToggle(event: any, ticket: string) {
          if (event.target.checked) {
               // Add to selection
               this.selectedTickets = [...this.selectedTickets, ticket];
          } else {
               // Remove from selection
               this.selectedTickets = this.selectedTickets.filter(t => t !== ticket);
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

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithOutIssuer(this.selectedAccount || '', this.account1, this.account2),
          };

          try {
               this.showSpinnerWithDelay('Getting Payment Channels...', 200);

               // Phase 1: Get client + wallet
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               // Phase 2: PARALLELIZE — fetch account info + payment channels + other account objects
               const [accountInfo, paymentChannelObjects, allAccountObjects] = await Promise.all([
                    this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''),
                    this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'payment_channel'),
                    this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), // for refreshUiAccountObjects
               ]);

               // Optional: Avoid heavy stringify — log only if needed
               console.debug(`account info:`, accountInfo.result);
               console.debug(`account objects:`, allAccountObjects.result);
               console.debug(`Payment channel objects:`, paymentChannelObjects.result);

               inputs = { ...inputs, account_info: accountInfo };

               const errors = await this.validateInputs(inputs, 'getPaymentChannels');
               if (errors.length > 0) {
                    if (errors.length === 1) {
                         return this.setError(`Error:\n${errors.join('\n')}`);
                    } else {
                         return this.setError(`Multiple Error's:\n${errors.join('\n')}`);
                    }
               }

               type PaymentChannelObject = any; // Replace with actual type if available
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

                              // Handle BigInt safely
                              const totalAmount = typeof Amount === 'string' ? BigInt(Amount) : BigInt(0);
                              const claimedBalance = typeof Balance === 'string' ? BigInt(Balance) : BigInt(0);
                              const availableDrops = totalAmount - claimedBalance;
                              const availableXRP = xrpl.dropsToXrp(availableDrops);

                              const now = Math.floor(Date.now() / 1000); // current time in seconds

                              return {
                                   key: `Channel ${index + 1} (ID: ${channelId?.slice(0, 8) || 'N/A'}...)`,
                                   openByDefault: false,
                                   content: [
                                        { key: 'Channel ID', value: `<code>${channelId || 'N/A'}</code>` },
                                        { key: 'Destination', value: `<code>${Destination || 'N/A'}</code>` },
                                        { key: 'Total Amount', value: `${xrpl.dropsToXrp(totalAmount)} XRP` },
                                        { key: 'Claimed Balance', value: `${xrpl.dropsToXrp(claimedBalance)} XRP` },
                                        { key: 'Remaining', value: `${availableXRP} XRP` },
                                        { key: 'Settle Delay', value: `${SettleDelay || 0}s` },
                                        { key: 'Expiration', value: Expiration ? this.utilsService.convertXRPLTime(Expiration) : 'N/A' },
                                        { key: 'Expired', value: Expiration ? (now > Expiration ? 'True' : 'False') : 'False' },
                                        { key: 'Cancel After', value: CancelAfter ? this.utilsService.convertXRPLTime(CancelAfter) : 'N/A' },
                                        // Optional: Uncomment if you want to show CancelAfter expired status
                                        // { key: 'Cancel Expired', value: CancelAfter ? (now > CancelAfter ? 'True' : 'False') : 'False' },
                                   ],
                              };
                         }),
                    });
               }

               // CRITICAL: Render immediately
               this.renderUiComponentsService.renderDetails(data);
               this.setSuccess(this.result);

               // DEFER: Non-critical UI updates — let main render complete first
               setTimeout(async () => {
                    try {
                         // Use pre-fetched allAccountObjects and accountInfo
                         this.refreshUiAccountObjects(allAccountObjects, accountInfo, wallet);
                         this.refreshUiAccountInfo(accountInfo); // already have it — no need to refetch!
                         this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
                         this.clearFields(false);
                         this.updateTickets(allAccountObjects);
                         await this.updateXrpBalance(client, accountInfo, wallet);
                    } catch (err) {
                         console.error('Error in deferred UI updates for payment channels:', err);
                         // Don't break main render — payment channels are already shown
                    }
               }, 0);
          } catch (error: any) {
               console.error('Error in getPaymentChannels:', error);
               this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getPaymentChannels in ${this.executionTime}ms`);
          }
     }

     async handlePaymentChannelAction() {
          console.log('Entering handlePaymentChannelAction');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithOutIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2),
               senderAddress: this.utilsService.getSelectedAddressWithOutIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2),
               destination: this.destinationField,
               amount: this.amountField,
               settleDelay: this.settleDelayField,
               channelID: this.channelIDField,
               channelClaimSignatureField: this.channelClaimSignatureField,
               destinationTag: this.destinationTagField,
               publicKeyField: this.publicKeyField,
               isRegularKeyAddress: this.isRegularKeyAddress,
               regularKeyAddress: this.isRegularKeyAddress ? this.regularKeyAddress : undefined,
               regularKeySeed: this.isRegularKeyAddress ? this.regularKeySeed : undefined,
               useMultiSign: this.useMultiSign,
               multiSignAddresses: this.useMultiSign ? this.multiSignAddress : undefined,
               multiSignSeeds: this.useMultiSign ? this.multiSignSeeds : undefined,
               isTicket: this.isTicket,
               selectedTicket: this.selectedTicket,
               selectedSingleTicket: this.selectedSingleTicket,
          };

          try {
               this.resultField.nativeElement.innerHTML = '';
               const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
               this.updateSpinnerMessage(`Preparing Payment Channels (${mode})...`);

               const environment = this.xrplService.getNet().environment;
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();
               const [accountInfo, fee, currentLedger, accountObject, payChannelResponse] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.calculateTransactionFee(client), this.xrplService.getLastLedgerIndex(client), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'payment_channel')]);

               // Optional: Avoid heavy stringify in logs
               console.debug(`accountInfo for ${wallet.classicAddress}:`, accountInfo.result);
               console.debug(`accountObjects for ${wallet.classicAddress}:`, accountObject.result);
               console.debug(`fee :`, fee);
               console.debug(`currentLedger :`, currentLedger);
               console.debug(`payChannelResponse for ${wallet.classicAddress}:`, payChannelResponse.result);

               inputs = { ...inputs, account_info: accountInfo };

               const errors = await this.validateInputs(inputs, this.channelAction);
               if (errors.length > 0) {
                    if (errors.length === 1) {
                         return this.setError(`Error:\n${errors.join('\n')}`);
                    } else {
                         return this.setError(`Multiple Error's:\n${errors.join('\n')}`);
                    }
               }

               const action = this.channelAction;

               if (action === 'create') {
                    this.resultField.nativeElement.innerHTML = '';
                    const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
                    this.updateSpinnerMessage(`Preparing Create Payment Channel ${action} (${mode})...`);

                    let paymentChannelCreateTx: PaymentChannelCreate = {
                         TransactionType: 'PaymentChannelCreate',
                         Account: wallet.classicAddress,
                         Amount: xrpl.xrpToDrops(this.amountField),
                         Destination: this.destinationField,
                         SettleDelay: parseInt(this.settleDelayField),
                         PublicKey: wallet.publicKey,
                         Fee: fee,
                    };

                    // Optional fields
                    await this.setTxOptionalFields(client, paymentChannelCreateTx, wallet, accountInfo);

                    this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Create Payment Channel (no changes will be made)...' : 'Submitting to Ledger...');

                    if (this.isSimulateEnabled) {
                         const simulation = await this.xrplTransactions.simulateTransaction(client, paymentChannelCreateTx);

                         const isSuccess = this.utilsService.isTxSuccessful(simulation);
                         if (!isSuccess) {
                              const resultMsg = this.utilsService.getTransactionResultMessage(simulation);
                              let userMessage = 'Transaction failed.\n';
                              userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                              (simulation['result'] as any).errorMessage = userMessage;
                              console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, simulation);
                         }

                         // Render result
                         this.renderTransactionResult(simulation);

                         this.resultField.nativeElement.classList.add('success');
                         this.setSuccess(this.result);
                    } else {
                         const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                         // Sign transaction
                         let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, paymentChannelCreateTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                         if (!signedTx) {
                              return this.setError('ERROR: Failed to sign Payment transaction.');
                         }

                         const response = await this.xrplTransactions.submitTransaction(client, signedTx);

                         const isSuccess = this.utilsService.isTxSuccessful(response);
                         if (!isSuccess) {
                              const resultMsg = this.utilsService.getTransactionResultMessage(response);
                              let userMessage = 'Transaction failed.\n';
                              userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                              (response.result as any).errorMessage = userMessage;
                              console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                         }

                         // Render result
                         this.renderTransactionResult(response);

                         this.resultField.nativeElement.classList.add('success');
                         this.setSuccess(this.result);
                    }
               } else if (action === 'fund' || action === 'renew') {
                    this.resultField.nativeElement.innerHTML = '';
                    const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
                    this.updateSpinnerMessage(`Preparing Fund/Renew Payment Channel ${action} (${mode})...`);

                    let paymentChannelFundTx: PaymentChannelFund = {
                         TransactionType: 'PaymentChannelFund',
                         Account: wallet.classicAddress,
                         Channel: this.channelIDField,
                         Amount: xrpl.xrpToDrops(this.amountField),
                    };

                    // Optional fields
                    await this.setTxOptionalFields(client, paymentChannelFundTx, wallet, accountInfo);

                    this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Funding/Renewing Payment Channel (no changes will be made)...' : 'Submitting to Ledger...');

                    if (this.isSimulateEnabled) {
                         const simulation = await this.xrplTransactions.simulateTransaction(client, paymentChannelFundTx);

                         const isSuccess = this.utilsService.isTxSuccessful(simulation);
                         if (!isSuccess) {
                              const resultMsg = this.utilsService.getTransactionResultMessage(simulation);
                              let userMessage = 'Transaction failed.\n';
                              userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                              (simulation['result'] as any).errorMessage = userMessage;
                              console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, simulation);
                         }

                         // Render result
                         this.renderTransactionResult(simulation);

                         this.resultField.nativeElement.classList.add('success');
                         this.setSuccess(this.result);
                    } else {
                         // PHASE 5: Get regular key wallet
                         const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                         // Sign transaction
                         let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, paymentChannelFundTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                         if (!signedTx) {
                              return this.setError('ERROR: Failed to sign Payment transaction.');
                         }

                         const response = await this.xrplTransactions.submitTransaction(client, signedTx);

                         const isSuccess = this.utilsService.isTxSuccessful(response);
                         if (!isSuccess) {
                              const resultMsg = this.utilsService.getTransactionResultMessage(response);
                              let userMessage = 'Transaction failed.\n';
                              userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                              (response.result as any).errorMessage = userMessage;
                              console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                         }

                         // Render result
                         this.renderTransactionResult(response);

                         this.resultField.nativeElement.classList.add('success');
                         this.setSuccess(this.result);
                    }
               } else if (action === 'claim') {
                    this.resultField.nativeElement.innerHTML = '';
                    const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
                    this.updateSpinnerMessage(`Preparing Claim Payment Channel ${action} (${mode})...`);

                    let authorizedWallet = await this.getPaymentChannelAuthorizedWallet(environment);
                    const [signatureVerified, isChannelAuthorized] = await Promise.all([this.xrplService.getChannelVerifiy(client, this.channelIDField, this.amountField, this.publicKeyField, this.channelClaimSignatureField), this.xrplService.getPaymentChannelAuthorized(client, this.channelIDField, this.amountField, authorizedWallet)]);

                    // Get payment channel details to verify creator and receiver
                    const channels = payChannelResponse.result.account_objects as PaymentChannelObject[];
                    const channel = channels.find(c => c.index === this.channelIDField);
                    if (!channel) {
                         return this.setError(`ERROR: Payment channel ${this.channelIDField} not found`);
                    }

                    // Determine if the selected account is the creator or receiver
                    const isReceiver = channel.Destination === wallet.classicAddress;
                    let signature = this.channelClaimSignatureField;
                    if (!signatureVerified.result.signature_verified) {
                         return this.setError('ERROR: Invalid signature');
                    }

                    if (isChannelAuthorized.result.signature !== signature) {
                         return this.setError('Wallet is invalide for payment channel.');
                    }

                    let paymentChannelClaimTx: PaymentChannelClaim = {
                         TransactionType: 'PaymentChannelClaim',
                         Account: wallet.classicAddress,
                         Channel: this.channelIDField,
                         Balance: xrpl.xrpToDrops(this.amountField),
                         Signature: signature,
                         PublicKey: isReceiver ? this.publicKeyField : wallet.publicKey,
                         Fee: fee,
                    };

                    // Optional fields
                    await this.setTxOptionalFields(client, paymentChannelClaimTx, wallet, accountInfo);

                    this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Claiming Payment Channel (no changes will be made)...' : 'Submitting to Ledger...');

                    if (this.isSimulateEnabled) {
                         const simulation = await this.xrplTransactions.simulateTransaction(client, paymentChannelClaimTx);

                         const isSuccess = this.utilsService.isTxSuccessful(simulation);
                         if (!isSuccess) {
                              const resultMsg = this.utilsService.getTransactionResultMessage(simulation);
                              let userMessage = 'Transaction failed.\n';
                              userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                              (simulation['result'] as any).errorMessage = userMessage;
                              console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, simulation);
                         }

                         // Render result
                         this.renderTransactionResult(simulation);

                         this.resultField.nativeElement.classList.add('success');
                         this.setSuccess(this.result);
                    } else {
                         // PHASE 5: Get regular key wallet
                         const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                         // Sign transaction
                         let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, paymentChannelClaimTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                         if (!signedTx) {
                              return this.setError('ERROR: Failed to sign Payment transaction.');
                         }

                         const response = await this.xrplTransactions.submitTransaction(client, signedTx);

                         const isSuccess = this.utilsService.isTxSuccessful(response);
                         if (!isSuccess) {
                              const resultMsg = this.utilsService.getTransactionResultMessage(response);
                              let userMessage = 'Transaction failed.\n';
                              userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                              (response.result as any).errorMessage = userMessage;
                              console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                         }

                         // Render result
                         this.renderTransactionResult(response);

                         this.resultField.nativeElement.classList.add('success');
                         this.setSuccess(this.result);
                    }
               } else if (action === 'close') {
                    this.resultField.nativeElement.innerHTML = '';
                    const mode = this.isSimulateEnabled ? 'simulating' : 'setting';
                    this.updateSpinnerMessage(`Preparing Close Payment Channel ${action} (${mode})...`);

                    // const paymentChannel = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', 'payment_channel');
                    const channels = payChannelResponse.result.account_objects as PaymentChannelObject[];
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

                    let paymentChannelClaimTx: PaymentChannelClaim = {
                         TransactionType: 'PaymentChannelClaim',
                         Account: wallet.classicAddress,
                         Channel: this.channelIDField,
                         Flags: xrpl.PaymentChannelClaimFlags.tfClose,
                         Fee: fee,
                    };

                    // Optional fields
                    await this.setTxOptionalFields(client, paymentChannelClaimTx, wallet, accountInfo);

                    this.updateSpinnerMessage(this.isSimulateEnabled ? 'Simulating Closing Payment Channel (no changes will be made)...' : 'Submitting to Ledger...');

                    if (this.isSimulateEnabled) {
                         const simulation = await this.xrplTransactions.simulateTransaction(client, paymentChannelClaimTx);

                         const isSuccess = this.utilsService.isTxSuccessful(simulation);
                         if (!isSuccess) {
                              const resultMsg = this.utilsService.getTransactionResultMessage(simulation);
                              let userMessage = 'Transaction failed.\n';
                              userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                              (simulation['result'] as any).errorMessage = userMessage;
                              console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, simulation);
                         }

                         // Render result
                         this.renderTransactionResult(simulation);

                         this.resultField.nativeElement.classList.add('success');
                         this.setSuccess(this.result);
                    } else {
                         // PHASE 5: Get regular key wallet
                         const { useRegularKeyWalletSignTx, regularKeyWalletSignTx } = await this.utilsService.getRegularKeyWallet(environment, this.useMultiSign, this.isRegularKeyAddress, this.regularKeySeed);

                         // Sign transaction
                         let signedTx = await this.xrplTransactions.signTransaction(client, wallet, environment, paymentChannelClaimTx, useRegularKeyWalletSignTx, regularKeyWalletSignTx, fee, this.useMultiSign, this.multiSignAddress, this.multiSignSeeds);

                         if (!signedTx) {
                              return this.setError('ERROR: Failed to sign Payment transaction.');
                         }

                         const response = await this.xrplTransactions.submitTransaction(client, signedTx);

                         const isSuccess = this.utilsService.isTxSuccessful(response);
                         if (!isSuccess) {
                              const resultMsg = this.utilsService.getTransactionResultMessage(response);
                              let userMessage = 'Transaction failed.\n';
                              userMessage += this.utilsService.processErrorMessageFromLedger(resultMsg);

                              (response.result as any).errorMessage = userMessage;
                              console.error(`Transaction ${this.isSimulateEnabled ? 'simulation' : 'submission'} failed: ${resultMsg}`, response);
                         }

                         // Render result
                         this.renderTransactionResult(response);

                         this.resultField.nativeElement.classList.add('success');
                         this.setSuccess(this.result);
                    }
               }

               // PARALLELIZE
               const [updatedAccountInfo, updatedAccountObjects] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '')]);
               this.refreshUIData(wallet, updatedAccountInfo, updatedAccountObjects);

               // DEFER: Non-critical UI updates — let main render complete first
               setTimeout(async () => {
                    try {
                         this.clearFields(false);
                         this.utilsService.loadSignerList(wallet.classicAddress, this.signers);
                         this.updateTickets(updatedAccountObjects);
                         await this.updateXrpBalance(client, updatedAccountInfo, wallet);
                    } catch (err) {
                         console.error('Error in deferred UI updates for payment channels:', err);
                         // Don't break main render — payment channels are already shown
                    }
               }, 0);
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

     private async getPaymentChannelAuthorizedWallet(environment: string) {
          let authorzedWalletSeed = '';
          let authorizedWallet;
          if (this.selectedAccount === 'account2') {
               authorzedWalletSeed = this.utilsService.getSelectedSeedWithOutIssuer('account1', this.account1, this.account2);
               authorizedWallet = await this.utilsService.getWallet(authorzedWalletSeed, environment);
               if (!authorizedWallet) {
                    throw new Error('ERROR: Wallet could not be created or is undefined');
               }
          } else {
               authorzedWalletSeed = this.utilsService.getSelectedSeedWithOutIssuer('account2', this.account1, this.account2);
               authorizedWallet = await this.utilsService.getWallet(authorzedWalletSeed, environment);
               if (!authorizedWallet) {
                    throw new Error('ERROR: Wallet could not be created or is undefined');
               }
          }
          return authorizedWallet;
     }

     async generateCreatorClaimSignature() {
          console.log('Entering generateCreatorClaimSignature');
          const startTime = Date.now();
          this.setSuccessProperties();

          let inputs: ValidationInputs = {
               selectedAccount: this.selectedAccount,
               seed: this.utilsService.getSelectedSeedWithOutIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2),
               destination: this.destinationField,
               amount: this.amountField,
               channelID: this.channelIDField,
          };

          try {
               this.updateSpinnerMessage('Generate Creator Claim Signature...');

               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();
               const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');

               inputs = {
                    ...inputs,
                    account_info: accountInfo,
               };

               const errors = await this.validateInputs(inputs, 'generateCreatorClaimSignature');
               if (errors.length > 0) {
                    if (errors.length === 1) {
                         return this.setError(`Error:\n${errors.join('\n')}`);
                    } else {
                         return this.setError(`Multiple Error's:\n${errors.join('\n')}`);
                    }
               }

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

     private renderTransactionResult(response: any): void {
          if (this.isSimulateEnabled) {
               this.renderUiComponentsService.renderSimulatedTransactionsResults(response, this.resultField.nativeElement);
          } else {
               console.debug(`Response`, response);
               this.renderUiComponentsService.renderTransactionsResults(response, this.resultField.nativeElement);
          }
     }

     private async setTxOptionalFields(client: xrpl.Client, paymentChannelTx: any, wallet: xrpl.Wallet, accountInfo: any) {
          if (this.selectedSingleTicket) {
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(this.selectedSingleTicket));
               if (!ticketExists) {
                    return this.setError(`ERROR: Ticket Sequence ${this.selectedSingleTicket} not found for account ${wallet.classicAddress}`);
               }
               this.utilsService.setTicketSequence(paymentChannelTx, this.selectedSingleTicket, true);
          } else {
               if (this.multiSelectMode && this.selectedTickets.length > 0) {
                    console.log('Setting multiple tickets:', this.selectedTickets);
                    this.utilsService.setTicketSequence(paymentChannelTx, accountInfo.result.account_data.Sequence, false);
               }
          }

          if (this.destinationTagField && parseInt(this.destinationTagField) > 0) {
               this.utilsService.setDestinationTag(paymentChannelTx, this.destinationTagField);
          }
          if (this.memoField) {
               this.utilsService.setMemoField(paymentChannelTx, this.memoField);
          }
          if (this.publicKeyField) {
               this.utilsService.setPublicKey(paymentChannelTx, this.publicKeyField);
          }

          if (this.paymentChannelCancelAfterTimeField) {
               const cancelAfterTime = this.utilsService.addTime(this.paymentChannelCancelAfterTimeField, this.paymentChannelCancelAfterTimeUnit as 'seconds' | 'minutes' | 'hours' | 'days');
               console.log(`cancelTime: ${this.paymentChannelCancelAfterTimeField} cancelUnit: ${this.paymentChannelCancelAfterTimeUnit}`);
               console.log(`cancelTime: ${this.utilsService.convertXRPLTime(cancelAfterTime)}`);
               const currentLedgerTime = await this.xrplService.getLedgerCloseTime(client); // Implement this in xrplService
               if (cancelAfterTime <= currentLedgerTime) {
                    return this.setError('ERROR: Cancel After time must be in the future');
               }
               this.utilsService.setCancelAfter(paymentChannelTx, cancelAfterTime);
          }

          if (this.paymentChannelCancelAfterTimeField && (this.channelAction === 'fund' || this.channelAction === 'renew')) {
               const newExpiration = this.utilsService.addTime(this.paymentChannelCancelAfterTimeField, this.paymentChannelCancelAfterTimeUnit as 'seconds' | 'minutes' | 'hours' | 'days');
               const currentLedgerTime = await this.xrplService.getLedgerCloseTime(client);
               if (newExpiration <= currentLedgerTime) {
                    return this.setError('ERROR: New expiration time must be in the future');
               }
               this.utilsService.setExpiration(paymentChannelTx, newExpiration);
          }
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
          this.account1.balance = balance.toString();
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

     private async validateInputs(inputs: ValidationInputs, action: string): Promise<string[]> {
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

          const isValidSeed = (value: string | undefined): string | null => {
               if (value) {
                    const { value: detectedValue } = this.utilsService.detectXrpInputType(value);
                    if (detectedValue === 'unknown') {
                         return 'Account seed is invalid';
                    }
               }
               return null;
          };

          const isValidChannelId = (value: string | undefined): string | null => {
               if (value && !/^[0-9A-Fa-f]{64}$/.test(value)) {
                    return 'Channel ID must be a 64-character hexadecimal string';
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
          const checkDestinationTagRequirement = async (): Promise<string | null> => {
               if (!inputs.destination) return null; // Skip if no destination provided
               try {
                    const client = await this.xrplService.getClient();
                    const accountInfo = await this.xrplService.getAccountInfo(client, inputs.destination, 'validated', '');
                    if (accountInfo.result.account_flags.requireDestinationTag && (!inputs.destinationTag || inputs.destinationTag.trim() === '')) {
                         return `ERROR: Receiver requires a Destination Tag for payment`;
                    }
               } catch (err) {
                    console.error('Failed to check destination tag requirement:', err);
                    return `Could not validate destination account`;
               }
               return null;
          };

          // --- Action-specific config ---
          const actionConfig: Record<
               string,
               {
                    required: (keyof ValidationInputs)[];
                    customValidators?: (() => string | null)[];
                    asyncValidators?: (() => Promise<string | null>)[];
               }
          > = {
               getPaymentChannels: {
                    required: ['selectedAccount', 'seed'],
                    customValidators: [() => isValidSeed(inputs.seed), () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null)],
               },
               create: {
                    required: ['selectedAccount', 'seed', 'amount', 'destination', 'settleDelay'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.amount, 'Amount', 0),
                         () => isValidNumber(inputs.settleDelay, 'Settle Delay', 0),
                         () => isValidXrpAddress(inputs.destination, 'Destination'),
                         () => isValidNumber(inputs.destinationTag, 'Destination Tag', 0, true), // Allow empty
                         () => isNotSelfPayment(inputs.senderAddress, inputs.destination),
                         () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                         () => (inputs.account_info.result.account_flags.disableMasterKey && !inputs.useMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                         () => (inputs.isTicket ? isRequired(inputs.selectedSingleTicket, 'Ticket Sequence') : null),
                         () => (inputs.isTicket ? isValidNumber(inputs.selectedSingleTicket, 'Ticket Sequence', 0) : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                    ],
               },
               fund: {
                    required: ['selectedAccount', 'seed', 'amount', 'channelID', 'destination'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.amount, 'Amount', 0),
                         () => isValidChannelId(inputs.channelID),
                         () => isValidXrpAddress(inputs.destination, 'Destination'),
                         () => isNotSelfPayment(inputs.senderAddress, inputs.destination),
                         () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                         () => (inputs.account_info.result.account_flags.disableMasterKey && !inputs.useMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                         () => (inputs.isTicket ? isRequired(inputs.selectedSingleTicket, 'Ticket Sequence') : null),
                         () => (inputs.isTicket ? isValidNumber(inputs.selectedSingleTicket, 'Ticket Sequence', 0) : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                    ],
                    asyncValidators: [checkDestinationTagRequirement],
               },
               renew: {
                    required: ['selectedAccount', 'seed', 'amount', 'channelID', 'destination'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.amount, 'Amount', 0),
                         () => isValidChannelId(inputs.channelID),
                         () => isValidXrpAddress(inputs.destination, 'Destination'),
                         () => isNotSelfPayment(inputs.senderAddress, inputs.destination),
                         () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                         () => (inputs.account_info.result.account_flags.disableMasterKey && !inputs.useMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                         () => (inputs.isTicket ? isRequired(inputs.selectedSingleTicket, 'Ticket Sequence') : null),
                         () => (inputs.isTicket ? isValidNumber(inputs.selectedSingleTicket, 'Ticket Sequence', 0) : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                    ],
                    asyncValidators: [checkDestinationTagRequirement],
               },
               claim: {
                    required: ['selectedAccount', 'seed', 'amount', 'channelID', 'channelClaimSignatureField', 'publicKeyField'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.amount, 'Amount', 0),
                         () => isValidChannelId(inputs.channelID),
                         () => isRequired(inputs.channelClaimSignatureField, 'Channel Claim Signature'),
                         () => isRequired(inputs.publicKeyField, 'Public Key'),
                         () => isNotSelfPayment(inputs.senderAddress, inputs.destination),
                         () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                         () => (inputs.account_info.result.account_flags.disableMasterKey && !inputs.useMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                    ],
                    asyncValidators: [checkDestinationTagRequirement],
               },
               close: {
                    required: ['selectedAccount', 'seed', 'channelID'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidChannelId(inputs.channelID),
                         () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                         () => (inputs.account_info.result.account_flags.disableMasterKey && !inputs.useMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                    ],
               },
               generateCreatorClaimSignature: {
                    required: ['selectedAccount', 'seed', 'amount', 'channelID', 'destination'],
                    customValidators: [
                         () => isValidSeed(inputs.seed),
                         () => isValidNumber(inputs.amount, 'Amount', 0),
                         () => isValidChannelId(inputs.channelID),
                         () => isValidXrpAddress(inputs.destination, 'Destination'),
                         () => (inputs.account_info === undefined || inputs.account_info === null ? `No account data found` : null),
                         () => (inputs.account_info.result.account_flags.disableMasterKey && !inputs.useMultiSign && !inputs.isRegularKeyAddress ? 'Master key is disabled. Must sign with Regular Key or Multi-sign.' : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isRequired(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidXrpAddress(inputs.regularKeyAddress, 'Regular Key Address') : null),
                         () => (inputs.isRegularKeyAddress && !inputs.useMultiSign ? isValidSecret(inputs.regularKeySeed, 'Regular Key Seed') : null),
                         () => validateMultiSign(inputs.multiSignAddresses, inputs.multiSignSeeds),
                    ],
               },
               default: { required: [], customValidators: [], asyncValidators: [] },
          };

          const config = actionConfig[action] || actionConfig['default'];

          // --- Run required checks ---
          config.required.forEach((field: keyof ValidationInputs) => {
               const err = isRequired(inputs[field], field.charAt(0).toUpperCase() + field.slice(1));
               if (err) errors.push(err);
          });

          // Run custom validators
          config.customValidators?.forEach((validator: () => string | null) => {
               const err = validator();
               if (err) errors.push(err);
          });

          // --- Run async validators ---
          if (config.asyncValidators) {
               for (const validator of config.asyncValidators) {
                    const err = await validator();
                    if (err) errors.push(err);
               }
          }

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

          // Selected account check (common to most)
          if (inputs.selectedAccount === undefined || inputs.selectedAccount === null) {
               errors.push('Please select an account');
          }

          return errors;
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

     private displayDataForAccount1() {
          this.displayDataForAccount('account1');
     }

     private displayDataForAccount2() {
          this.displayDataForAccount('account2');
     }

     clearFields(clearAllFields: boolean) {
          if (clearAllFields) {
               this.amountField = '';
               this.destinationTagField = '';
               this.channelIDField = '';
               this.publicKeyField = '';
               this.channelClaimSignatureField = '';
               this.settleDelayField = '';
               this.paymentChannelCancelAfterTimeField = '';
          }
          this.isMemoEnabled = false;
          this.memoField = '';
          this.ticketSequence = '';
          this.isTicket = false;
          this.renewChannel = false;
          this.cdr.detectChanges();
     }

     private updateSpinnerMessage(message: string) {
          this.spinnerMessage = message;
          this.cdr.detectChanges();
     }

     private async showSpinnerWithDelay(message: string, delayMs: number = 200) {
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
