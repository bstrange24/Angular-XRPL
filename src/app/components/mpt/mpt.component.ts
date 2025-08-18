import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
// import { WalletInputComponent } from '../wallet-input/wallet-input.component';
import { WalletMultiInputComponent } from '../wallet-multi-input/wallet-multi-input.component';
import * as xrpl from 'xrpl';
import { StorageService } from '../../services/storage.service';
import { AccountSet, TransactionMetadataBase, DepositPreauth, SignerListSet, MPTokenIssuanceCreate } from 'xrpl';
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
     // asfAuthorizedNFTokenMinter: boolean;
     asfAllowTrustLineClawback: boolean;
     asfDisallowIncomingNFTokenOffer: boolean;
     asfDisallowIncomingCheck: boolean;
     asfDisallowIncomingPayChan: boolean;
     asfDisallowIncomingTrustline: boolean;
     isClawback: boolean;
     isLock: boolean;
     isRequireAuth: boolean;
     isTransferable: boolean;
     isTradable: boolean;
     isEscrow: boolean;
}

@Component({
     selector: 'app-mpt',
     standalone: true,
     imports: [CommonModule, FormsModule, WalletMultiInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './mpt.component.html',
     styleUrl: './mpt.component.css',
})
export class MptComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     @ViewChild('accountForm') accountForm!: NgForm;
     selectedAccount: 'account1' | 'account2' | null = 'account1'; // Initialize to 'account1' for default selection
     configurationType: 'holder' | 'exchanger' | 'issuer' | null = null; // New property to track configuration type
     private lastResult: string = '';
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = false;
     account1 = { name: '', address: '', seed: '', balance: '' };
     account2 = { name: '', address: '', seed: '', balance: '' };
     issuer = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '0' };
     ownerCount = '';
     totalXrpReserves = '';
     executionTime = '';
     ticketSequence: string = '';
     isTicket = false;
     isTicketEnabled = false;
     isMultiSign = false;
     multiSignAddress = '';
     signer1Account = '';
     signer2Account = '';
     signer3Account = '';
     signer1Weight = '';
     signer2Weight = '';
     signer3Weight = '';
     signerQuorum = '';
     metaDataField: string = '';
     mptIssuanceIdField: string = '';
     tokenCountField: string = '';
     assetScaleField: string = '';
     isUpdateMetaData = false;
     isHolderConfiguration = false;
     isExchangerConfiguration = false;
     isIssuerConfiguration = false;
     isdepositAuthAddress = false;
     isAuthorizedNFTokenMinter: boolean = false;
     depositAuthAddress = '';
     tickSize = '';
     transferRate = '';
     isMessageKey = false;
     transferFeeField = '';
     memoField = '';
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
          // asfAuthorizedNFTokenMinter: false,
          asfAllowTrustLineClawback: false,
          asfDisallowIncomingNFTokenOffer: false,
          asfDisallowIncomingCheck: false,
          asfDisallowIncomingPayChan: false,
          asfDisallowIncomingTrustline: false,
          isClawback: false,
          isLock: false,
          isRequireAuth: false,
          isTransferable: false,
          isTradable: false,
          isEscrow: false,
     };
     spinner = false;

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

     onWalletInputChange(event: { account1: any; account2: any; issuer: any }) {
          this.account1 = { ...event.account1, balance: '0' };
          this.account2 = { ...event.account2, balance: '0' };
          this.issuer = { ...event.issuer, balance: '0' };
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
          } else {
               this.displayDataForAccount3();
          }
          this.configurationType = null;
     }

     validateQuorum() {
          this.cdr.detectChanges();
     }

     onConfigurationChange() {
          // Reset all flags to ensure a clean state
          this.resetFlags();

          console.log('Configuration changed to:', this.configurationType);
          this.cdr.detectChanges();
     }

     // Optional: Add a method to reset flags to avoid conflicts
     private resetFlags() {
          this.flags = {
               asfRequireDest: false,
               asfRequireAuth: false,
               asfDisallowXRP: false,
               asfDisableMaster: false,
               asfNoFreeze: false,
               asfGlobalFreeze: false,
               asfDefaultRipple: false,
               asfDepositAuth: false,
               // asfAuthorizedNFTokenMinter: false,
               asfAllowTrustLineClawback: false,
               asfDisallowIncomingNFTokenOffer: false,
               asfDisallowIncomingCheck: false,
               asfDisallowIncomingPayChan: false,
               asfDisallowIncomingTrustline: false,
               isClawback: false,
               isLock: false,
               isRequireAuth: false,
               isTransferable: false,
               isTradable: false,
               isEscrow: false,
          };

          // Reset metadata fields
          this.transferFeeField = '';
          this.transferRate = '';
          this.tickSize = '';

          // Update UI elements
          const domainFieldElem = document.getElementById('domainField') as HTMLInputElement | null;
          if (domainFieldElem) domainFieldElem.value = '';
          const transferRateFieldElem = document.getElementById('transferRateField') as HTMLInputElement | null;
          if (transferRateFieldElem) transferRateFieldElem.value = '';
          const tickSizeFieldElem = document.getElementById('tickSizeField') as HTMLInputElement | null;
          if (tickSizeFieldElem) tickSizeFieldElem.value = '';

          this.cdr.detectChanges();
     }

     toggleConfigurationTemplate() {
          this.cdr.detectChanges();
     }

     toggleMultiSign() {
          this.cdr.detectChanges();
     }

     toggleTicketSequence() {
          this.cdr.detectChanges();
     }

     onAuthorizedNFTokenMinter() {
          this.cdr.detectChanges();
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

     onNoFreezeChange() {
          if (this.flags.asfNoFreeze) {
               alert('Prevent Freezing Trust Lines (No Freeze) cannot be unset!');
          }
     }

     onClawbackChange() {
          if (this.flags.asfAllowTrustLineClawback) {
               alert('Trust Line Clawback cannot be unset!');
          }
     }

     async getMptDetails() {
          console.log('Entering getMptDetails');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed,
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
               } else {
                    wallet = await this.utilsService.getWallet(this.issuer.seed, environment);
               }

               if (!wallet) {
                    return this.setError('ERROR: Wallet could not be created or is undefined');
               }

               this.showSpinnerWithDelay('Getting Account Details...', 200);

               const accountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
               const accountObjects = await this.xrplService.getAccountObjects(client, wallet.classicAddress, 'validated', '');
               console.debug(`accountObjects ${JSON.stringify(accountObjects, null, 2)} accountInfo ${JSON.stringify(accountInfo, null, 2)}`);

               if (accountInfo.result.account_data.length <= 0) {
                    this.resultField.nativeElement.innerHTML = `No account data found for ${wallet.classicAddress}`;
                    return;
               }

               // Set flags from account info
               AppConstants.FLAGS.forEach(flag => {
                    const input = document.getElementById(flag.name) as HTMLInputElement;
                    const flagKey = AppConstants.FLAGMAP[flag.name as keyof typeof AppConstants.FLAGMAP];
                    if (input && flagKey) {
                         input.checked = !!accountInfo.result.account_flags?.[flagKey as keyof typeof accountInfo.result.account_flags];
                    }
               });

               this.utilsService.renderAccountDetails(accountInfo, accountObjects);
               this.refreshUiIAccountMetaData(accountInfo.result);
               this.setSuccess(this.result);

               const signerAccounts: string[] = this.checkForSignerAccounts(accountObjects);
               if (signerAccounts && signerAccounts.length > 0) {
                    if (Array.isArray(signerAccounts) && signerAccounts.length > 0) {
                         this.signer1Account = signerAccounts[0]?.split('~')[0] || '';
                         this.signer1Weight = signerAccounts[0]?.split('~')[1] || '';
                         this.signer2Account = signerAccounts[1]?.split('~')[0] || '';
                         this.signer2Weight = signerAccounts[1]?.split('~')[1] || '';
                         this.signer3Account = signerAccounts[2]?.split('~')[0] || '';
                         this.signer3Weight = signerAccounts[2]?.split('~')[1] || '';
                         this.isMultiSign = true;
                    }
               } else {
                    this.multiSignAddress = '';
                    this.isMultiSign = false;
               }

               const preAuthAccounts: string[] = this.findDepositPreauthObjects(accountObjects);
               if (preAuthAccounts && preAuthAccounts.length > 0) {
                    this.depositAuthAddress = preAuthAccounts.map(account => account + ',\n').join('');
                    this.isdepositAuthAddress = true;
               } else {
                    this.depositAuthAddress = '';
                    this.isdepositAuthAddress = false;
               }

               await this.updateXrpBalance(client, wallet);
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getMptDetails in ${this.executionTime}ms`);
          }
     }

     async getnerateMpt() {
          console.log('Entering getnerateMpt');
          const startTime = Date.now();
          this.setSuccessProperties();

          const validationError = this.validateInputs({
               selectedAccount: this.selectedAccount,
               seed: this.selectedAccount === 'account1' ? this.account1.seed : this.selectedAccount === 'account2' ? this.account2.seed : this.issuer.seed,
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
               } else {
                    wallet = await this.utilsService.getWallet(this.issuer.seed, environment);
               }

               if (!wallet) {
                    return this.setError('ERROR: Wallet could not be created or is undefined');
               }

               this.updateSpinnerMessage('Updating Meta Data...');

               let v_flags = this.getFlagsValue(this.flags);

               const fee = await this.xrplService.calculateTransactionFee(client);
               const currentLedger = await this.xrplService.getLastLedgerIndex(client);

               const accountSetTx: MPTokenIssuanceCreate = await client.autofill({
                    TransactionType: 'MPTokenIssuanceCreate',
                    Account: wallet.classicAddress,
                    Fee: fee,
                    Flags: v_flags,
                    LastLedgerSequence: currentLedger + AppConstants.LAST_LEDGER_ADD_TIME,
               });

               let updatedData = false;

               if (this.memoField) {
                    updatedData = true;
                    accountSetTx.Memos = [
                         {
                              Memo: {
                                   MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                                   MemoData: Buffer.from(this.memoField, 'utf8').toString('hex'),
                              },
                         },
                    ];
               }

               if (this.assetScaleField) {
                    const assetScale = parseInt(this.assetScaleField);
                    if (assetScale < 0 || assetScale > 15) {
                         return this.setError('ERROR: Tick size must be between 3 and 15.');
                    }
                    updatedData = true;
                    accountSetTx.AssetScale = assetScale;
               }

               if (this.transferFeeField) {
                    const transferRate = parseInt(this.transferFeeField);
                    // if (transferRate > 100) {
                    // return this.setError('ERROR: Transfer rate cannot be greater than 100%.');
                    // }
                    updatedData = true;
                    accountSetTx.TransferFee = transferRate;
                    // accountSetTx.TransferFee = this.utilsService.getTransferRate(transferRate);
               }

               if (this.tokenCountField) {
                    updatedData = true;
                    accountSetTx.MaximumAmount = this.tokenCountField;
               }

               if (this.metaDataField) {
                    updatedData = true;
                    accountSetTx.MPTokenMetadata = xrpl.convertStringToHex(this.metaDataField);
               }

               // if (await this.utilsService.isInsufficientXrpBalance(client, '0', wallet.classicAddress, accountSetTx, fee)) {
               //      return this.setError('ERROR: Insufficent XRP to complete transaction');
               // }

               // if (true) {
               // return this.setError('ERROR: Crap');
               // }

               if (updatedData) {
                    this.updateSpinnerMessage('Submitting transaction to the Ledger...');
                    const response = await client.submitAndWait(accountSetTx, { wallet });
                    if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                         console.error(`response ${JSON.stringify(response, null, 2)}`);
                         this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                         this.resultField.nativeElement.classList.add('error');
                         this.setErrorProperties();
                         return;
                    }

                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('success');
               } else {
                    this.resultField.nativeElement.innerHTML = `No fields have data to update.\n`;
                    return;
               }

               this.isUpdateMetaData = true;
               this.setSuccess(this.result);

               await this.updateXrpBalance(client, wallet);
          } catch (error: any) {
               console.error('Error:', error);
               return this.setError(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getnerateMpt in ${this.executionTime}ms`);
          }
     }

     getFlagsValue(flags: AccountFlags): number {
          let v_flags = 0;
          if (this.flags.isClawback) {
               v_flags += 64;
          }
          if (this.flags.isLock) {
               v_flags += 2;
          }
          if (this.flags.isRequireAuth) {
               v_flags += 4;
          }
          if (this.flags.isTransferable) {
               v_flags += 32;
          }
          if (this.flags.isTradable) {
               v_flags += 16;
          }
          if (this.flags.isEscrow) {
               v_flags += 8;
          }
          return v_flags;
     }

     private checkForSignerAccounts(accountObjects: xrpl.AccountObjectsResponse) {
          const signerAccounts: string[] = [];
          if (accountObjects.result && Array.isArray(accountObjects.result.account_objects)) {
               accountObjects.result.account_objects.forEach(obj => {
                    if (obj.LedgerEntryType === 'SignerList' && Array.isArray(obj.SignerEntries)) {
                         obj.SignerEntries.forEach((entry: any) => {
                              if (entry.SignerEntry && entry.SignerEntry.Account) {
                                   signerAccounts.push(entry.SignerEntry.Account + '~' + entry.SignerEntry.SignerWeight);
                                   this.signerQuorum = obj.SignerQuorum.toString();
                              }
                         });
                    }
               });
          }
          return signerAccounts;
     }

     private findDepositPreauthObjects(accountObjects: xrpl.AccountObjectsResponse) {
          const depositPreauthAccounts: string[] = [];
          if (accountObjects.result && Array.isArray(accountObjects.result.account_objects)) {
               accountObjects.result.account_objects.forEach(obj => {
                    if (obj.LedgerEntryType === 'DepositPreauth' && obj.Authorize) {
                         depositPreauthAccounts.push(obj.Authorize);
                    }
               });
          }
          return depositPreauthAccounts;
     }

     private async updateXrpBalance(client: xrpl.Client, wallet: xrpl.Wallet) {
          const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, wallet.classicAddress);
          this.ownerCount = ownerCount;
          this.totalXrpReserves = totalXrpReserves;
          const balance = (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0');
          if (this.selectedAccount === 'account1') {
               this.account1.balance = balance.toString();
          } else if (this.selectedAccount === 'account2') {
               this.account1.balance = balance.toString();
          } else {
               this.account1.balance = balance.toString();
          }
     }

     private validateInputs(inputs: { seed?: string; amount?: string; destination?: string; sequence?: string; selectedAccount?: 'account1' | 'account2' | null }): string | null {
          if (inputs.selectedAccount !== undefined && !inputs.selectedAccount) {
               return 'Please select an account';
          }
          if (inputs.seed != undefined) {
               if (!this.utilsService.validateInput(inputs.seed)) {
                    return 'Account seed cannot be empty';
               }
               if (!xrpl.isValidSecret(inputs.seed)) {
                    return 'Account seed is invalid';
               }
          } else {
               return 'Account seed is invalid';
          }
          if (inputs.amount != undefined) {
               if (!this.utilsService.validateInput(inputs.amount)) {
                    return 'XRP Amount cannot be empty';
               }
               if (isNaN(parseFloat(inputs.amount ?? '')) || !isFinite(parseFloat(inputs.amount ?? ''))) {
                    return 'XRP Amount must be a valid number';
               }
               if (inputs.amount && parseFloat(inputs.amount) <= 0) {
                    return 'XRP Amount must be a positive number';
               }
          }
          if (inputs.destination != undefined && !this.utilsService.validateInput(inputs.destination)) {
               return 'Destination cannot be empty';
          }
          return null;
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

     clearFields() {
          this.memoField = '';
          this.metaDataField = '';
          this.assetScaleField = '';
          this.transferFeeField = '';
          this.mptIssuanceIdField = '';
          this.isTicket = false;
          this.isMultiSign = false;
          this.multiSignAddress = '';
          this.isUpdateMetaData = false;
          this.cdr.detectChanges();
     }

     private async displayDataForAccount(accountKey: 'account1' | 'account2' | 'issuer') {
          const prefix = accountKey === 'issuer' ? 'issuer' : accountKey;

          let name;
          let address;
          let seed;

          // Fetch stored values
          if (prefix === 'issuer') {
               name = this.storageService.getInputValue(`${prefix}Name`) || AppConstants.EMPTY_STRING;
               address = this.storageService.getInputValue(`${prefix}Address`) || AppConstants.EMPTY_STRING;
               seed = this.storageService.getInputValue(`${prefix}Seed`) || this.storageService.getInputValue(`${prefix}Mnemonic`) || this.storageService.getInputValue(`${prefix}SecretNumbers`) || AppConstants.EMPTY_STRING;
          } else {
               name = this.storageService.getInputValue(`${prefix}name`) || AppConstants.EMPTY_STRING;
               address = this.storageService.getInputValue(`${prefix}address`) || AppConstants.EMPTY_STRING;
               seed = this.storageService.getInputValue(`${prefix}seed`) || this.storageService.getInputValue(`${prefix}mnemonic`) || this.storageService.getInputValue(`${prefix}secretNumbers`) || AppConstants.EMPTY_STRING;
          }

          // Update account data
          const account = accountKey === 'account1' ? this.account1 : accountKey === 'account2' ? this.account2 : this.issuer;
          account.name = name;
          account.address = address;
          account.seed = seed;

          // DOM manipulation
          const accountName1Field = document.getElementById('accountName1Field') as HTMLInputElement | null;
          const accountAddress1Field = document.getElementById('accountAddress1Field') as HTMLInputElement | null;
          const accountSeed1Field = document.getElementById('accountSeed1Field') as HTMLInputElement | null;

          if (accountName1Field) accountName1Field.value = name;
          if (accountAddress1Field) accountAddress1Field.value = address;
          if (accountSeed1Field) accountSeed1Field.value = seed;

          // Trigger change detection to sync with ngModel
          this.cdr.detectChanges();

          // Update destination field (set to other account's address)
          const otherPrefix = accountKey === 'account1' ? 'account2' : accountKey === 'account2' ? 'account1' : 'account1';
          // this.destinationField = this.storageService.getInputValue(`${otherPrefix}address`) || AppConstants.EMPTY_STRING;

          // Fetch account details and trustlines
          try {
               if (address && xrpl.isValidAddress(address)) {
                    await this.getMptDetails();
               } else if (address) {
                    this.setError('Invalid XRP address');
               }
          } catch (error: any) {
               this.setError(`Error fetching account details: ${error.message}`);
          }
     }

     async displayDataForAccount1() {
          await this.displayDataForAccount('account1');
     }

     async displayDataForAccount2() {
          await this.displayDataForAccount('account2');
     }

     private async displayDataForAccount3() {
          await this.displayDataForAccount('issuer');
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
