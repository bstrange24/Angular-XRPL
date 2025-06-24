import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { WalletInputComponent } from '../wallet-input/wallet-input.component';
import * as xrpl from 'xrpl';
import { AccountSet, TransactionMetadataBase } from 'xrpl';
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
     asfAllowTrustLineClawback: boolean;
     asfDisallowIncomingNFTokenOffer: boolean;
     asfDisallowIncomingCheck: boolean;
     asfDisallowIncomingPayChan: boolean;
     asfDisallowIncomingTrustline: boolean;
}

@Component({
     selector: 'app-account',
     standalone: true,
     imports: [CommonModule, FormsModule, WalletInputComponent, NavbarComponent, SanitizeHtmlPipe],
     templateUrl: './account.component.html',
     styleUrls: ['./account.component.css'],
})
export class AccountComponent implements AfterViewChecked {
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     selectedAccount: 'account1' | 'account2' | null = null;
     private lastResult: string = '';
     transactionInput = '';
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = true;
     account1 = { name: '', address: '', seed: '', balance: '' };
     account2 = { name: '', address: '', seed: '', balance: '' };
     ownerCount = '';
     totalXrpReserves = '';
     executionTime = '';
     isMultiSign = false;
     multiSignAddress = '';
     isUpdateMetaData = false;
     tickSize = '';
     transferRate = '';
     isMessageKey = false;
     domain = '';
     memo = '';
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
     };
     spinner = false;

     constructor(private xrplService: XrplService, private utilsService: UtilsService, private cdr: ChangeDetectorRef) {}

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

     toggleMultiSign() {
          // Handled by *ngIf in template
     }

     async toggleMetaData() {
          const { net, environment } = this.xrplService.getNet();
          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
          if (!this.utilsService.validatInput(seed)) {
               return this.utilsService.returnErrorMessage('ERROR: Account seed cannot be empty');
          }
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
          const client = await this.xrplService.getClient();
          const accountInfo = await client.request({
               command: 'account_info',
               account: wallet.classicAddress,
               ledger_index: 'validated',
          });

          console.log('accountInfo', accountInfo);
          this.refreshUiIAccountMetaData(accountInfo.result);
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

     onAccountChange() {
          if (this.selectedAccount === 'account1') {
               this.displayDataForAccount1();
          } else if (this.selectedAccount === 'account2') {
               this.displayDataForAccount2();
          }
     }

     async getAccountInfo() {
          console.log('Entering getAccountInfo');
          const startTime = Date.now();
          this.spinner = true;
          this.isError = false;
          this.isSuccess = false;
          this.result = '';

          if (!this.selectedAccount) {
               return this.utilsService.returnErrorMessage('Please select an account');
          }

          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
          if (!this.utilsService.validatInput(seed)) {
               return this.utilsService.returnErrorMessage('ERROR: Account seed cannot be empty');
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

               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nGetting Account Data.\n\n`;

               const { accountInfo, accountObjects } = await this.utilsService.getAccountInfo(seed, environment);

               if (accountInfo.result.account_data.length <= 0) {
                    this.result += `No account data found for ${wallet.classicAddress}`;
               }

               console.log('accountInfo', accountInfo);

               if (accountObjects.result.account_objects.length <= 0) {
                    this.result += `No account objects found for ${wallet.classicAddress}`;
               }

               console.log('accountObjects', accountObjects);

               // Set flags from account info
               AppConstants.FLAGS.forEach(flag => {
                    const input = document.getElementById(flag.name) as HTMLInputElement;
                    const flagKey = AppConstants.FLAGMAP[flag.name as keyof typeof AppConstants.FLAGMAP];
                    if (input && flagKey) {
                         input.checked = !!accountInfo.result.account_flags?.[flagKey as keyof typeof accountInfo.result.account_flags];
                    }
               });

               // Handle currency balance (if currencyField exists)
               const currencyField = document.getElementById('currencyField') as HTMLInputElement;
               if (currencyField && currencyField.value) {
                    const currencyBalanceField = document.getElementById('currencyBalanceField') as HTMLInputElement;
                    if (currencyBalanceField) {
                         currencyBalanceField.value = await this.utilsService.getOnlyTokenBalance(client, wallet.classicAddress, currencyField.value);
                    }
               }

               // Handle current time (if currentTimeField exists)
               const currentTimeField = document.getElementById('currentTimeField') as HTMLInputElement;
               if (currentTimeField) {
                    currentTimeField.value = this.utilsService.convertToEstTime(new Date().toISOString());
               }

               this.utilsService.renderAccountDetails(accountInfo, accountObjects);

               this.refreshUiIAccountMetaData(accountInfo.result);

               this.setSuccess(this.result);

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
               this.utilsService.returnErrorMessage(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving getAccountInfo in ${this.executionTime}ms`);
          }
     }

     async updateFlags() {
          console.log('Entering updateFlags');
          const startTime = Date.now();
          this.spinner = true;
          this.isError = false;
          this.isSuccess = false;
          this.result = '';

          if (!this.selectedAccount) {
               return this.utilsService.returnErrorMessage('Please select an account');
          }

          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
          if (!this.utilsService.validatInput(seed)) {
               return this.utilsService.returnErrorMessage('ERROR: Account seed cannot be empty');
          }

          if (this.flags.asfNoFreeze && this.flags.asfGlobalFreeze) {
               return this.utilsService.returnErrorMessage('ERROR: Cannot enable both NoFreeze and GlobalFreeze');
          }

          this.clearUiIAccountMetaData();

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

               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nUpdating Account Flags\n\n`;

               const accountInfo = await client.request({
                    command: 'account_info',
                    account: wallet.classicAddress,
                    ledger_index: 'validated',
               });

               const { setFlags, clearFlags } = this.utilsService.getFlagUpdates(accountInfo.result.account_flags);

               if (setFlags.length === 0 && clearFlags.length === 0) {
                    this.resultField.nativeElement.innerHTML += 'Set Flags and Clear Flags length is 0. No flags selected for update';
               }

               const transactions = [];
               let hasError = false;

               for (const flagValue of setFlags) {
                    const response = await this.submitFlagTransaction(client, wallet, { SetFlag: parseInt(flagValue) }, this.memo);
                    transactions.push({
                         type: 'SetFlag',
                         flag: this.utilsService.getFlagName(flagValue),
                         result: typeof response.message === 'object' && 'result' in response.message ? response.message.result : response.message,
                    });
                    if (!response.success) {
                         hasError = true;
                    }
               }

               for (const flagValue of clearFlags) {
                    const response = await this.submitFlagTransaction(client, wallet, { ClearFlag: parseInt(flagValue) }, this.memo);
                    transactions.push({
                         type: 'ClearFlag',
                         flag: this.utilsService.getFlagName(flagValue),
                         result: typeof response.message === 'object' && 'result' in response.message ? response.message.result : response.message,
                    });
                    if (!response.success) {
                         hasError = true;
                    }
               }

               if (hasError) {
                    this.resultField.nativeElement.classList.add('error');
                    this.setError();
               } else {
                    this.resultField.nativeElement.classList.add('success');
               }

               // Render all successful transactions
               this.utilsService.renderTransactionsResults(transactions, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');

               // Fetch account objects
               const accountObjects = await client.request({
                    command: 'account_objects',
                    account: wallet.classicAddress,
                    ledger_index: 'validated',
               });

               console.debug('accountObjects', accountObjects);

               const updatedAccountInfo = await client.request({
                    command: 'account_info',
                    account: wallet.classicAddress,
                    ledger_index: 'validated',
               });

               console.debug('updatedAccountInfo', updatedAccountInfo);

               this.setSuccess(this.result);

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
               this.utilsService.returnErrorMessage(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving updateFlags in ${this.executionTime}ms`);
          }
     }

     async updateMetaData() {
          console.log('Entering updateMetaData');
          const startTime = Date.now();
          this.spinner = true;
          this.isError = false;
          this.isSuccess = false;
          this.result = '';

          if (!this.selectedAccount) {
               return this.utilsService.returnErrorMessage('Please select an account');
          }

          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
          if (!this.utilsService.validatInput(seed)) {
               return this.utilsService.returnErrorMessage('ERROR: Account seed cannot be empty');
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

               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nUpdating Meta Data\n\n`;

               const tx: AccountSet = await client.autofill({
                    TransactionType: 'AccountSet',
                    Account: wallet.classicAddress,
               });

               let updatedData = false;

               if (this.memo) {
                    updatedData = true;
                    tx.Memos = [
                         {
                              Memo: {
                                   MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                                   MemoData: Buffer.from(this.memo, 'utf8').toString('hex'),
                              },
                         },
                    ];
               }

               if (this.tickSize) {
                    const tickSize = this.utilsService.convertUserInputToInt(this.tickSize);
                    if (tickSize < 3 || tickSize > 15) {
                         return this.utilsService.returnErrorMessage('ERROR: Tick size must be between 3 and 15.');
                    }
                    updatedData = true;
                    tx.TickSize = tickSize;
               }

               if (this.transferRate) {
                    const transferRate = this.utilsService.convertUserInputToFloat(this.transferRate);
                    if (transferRate > 100) {
                         return this.utilsService.returnErrorMessage('ERROR: Transfer rate cannot be greater than 100%.');
                    }
                    updatedData = true;
                    tx.TransferRate = this.utilsService.getTransferRate(transferRate);
               }

               if (this.isMessageKey) {
                    updatedData = true;
                    tx.MessageKey = wallet.publicKey;
               }

               if (this.domain) {
                    updatedData = true;
                    tx.Domain = Buffer.from(this.domain, 'utf8').toString('hex');
               }

               if (updatedData) {
                    const response = await client.submitAndWait(tx, { wallet });
                    if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                         this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                         this.resultField.nativeElement.classList.add('error');

                         this.setError();
                         return;
                    }

                    this.resultField.nativeElement.innerHTML += `Account fields successfully updated.\n`;
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('success');
               } else {
                    this.resultField.nativeElement.innerHTML += `\nNo fields have data to update.\n\n`;
                    return;
               }

               this.isUpdateMetaData = true;
               this.setSuccess(this.result);

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
               this.utilsService.returnErrorMessage(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving updateMetaData in ${this.executionTime}ms`);
          }
     }

     async setDepositAuthAccounts(authorizeFlag: 'Y' | 'N') {
          console.log('Entering setDepositAuthAccounts');
          const startTime = Date.now();
          this.spinner = true;
          this.isError = false;
          this.isSuccess = false;
          this.result = '';

          if (!this.selectedAccount) {
               return this.utilsService.returnErrorMessage('Please select an account');
          }

          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
          const authorizedAddress = this.selectedAccount === 'account1' ? this.account2.address : this.account1.address;

          if (!this.utilsService.validatInput(seed)) {
               return this.utilsService.returnErrorMessage('ERROR: Account seed cannot be empty');
          }
          if (!this.utilsService.validatInput(authorizedAddress)) {
               return this.utilsService.returnErrorMessage('ERROR: Authorized account address cannot be empty');
          }
          if (!xrpl.isValidAddress(authorizedAddress)) {
               return this.utilsService.returnErrorMessage('ERROR: Authorized account address is invalid');
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

               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nSetting Deposit Authorization\n\n`;

               try {
                    await client.request({
                         command: 'account_info',
                         account: authorizedAddress,
                         ledger_index: 'validated',
                    });
               } catch (error: any) {
                    if (error.data?.error === 'actNotFound') {
                         return this.utilsService.returnErrorMessage('ERROR: Authorized account does not exist (tecNO_TARGET)');
                    }
                    throw error;
               }

               const accountInfo = await client.request({
                    command: 'account_info',
                    account: wallet.classicAddress,
                    ledger_index: 'validated',
               });

               if (!accountInfo.result.account_flags?.depositAuth) {
                    return this.utilsService.returnErrorMessage('ERROR: Account must have asfDepositAuth flag enabled');
               }

               const accountObjects = await client.request({
                    command: 'account_objects',
                    account: wallet.classicAddress,
                    type: 'deposit_preauth',
                    ledger_index: 'validated',
               });

               const alreadyAuthorized = accountObjects.result.account_objects.some((obj: any) => obj.Authorize === authorizedAddress);
               if (authorizeFlag === 'Y' && alreadyAuthorized) {
                    return this.utilsService.returnErrorMessage('ERROR: Preauthorization already exists (tecDUPLICATE). Use Unauthorize to remove');
               }

               const feeResponse = await client.request({ command: 'fee' });

               const tx = await client.autofill({
                    TransactionType: 'DepositPreauth',
                    Account: wallet.classicAddress,
                    [authorizeFlag === 'Y' ? 'Authorize' : 'Unauthorize']: authorizedAddress,
                    Fee: feeResponse.result.drops.open_ledger_fee,
               });

               const response = await client.submitAndWait(tx, { wallet });

               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');

                    this.setError();
                    return;
               }

               this.resultField.nativeElement.innerHTML += `Deposit Auth finished successfully\n`;
               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');

               this.setSuccess(this.result);

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
               this.utilsService.returnErrorMessage(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving setDepositAuthAccounts in ${this.executionTime}ms`);
          }
     }

     async setMultiSign(enableMultiSignFlag: 'Y' | 'N') {
          console.log('Entering setMultiSign');
          const startTime = Date.now();
          this.spinner = true;
          this.isError = false;
          this.isSuccess = false;
          this.result = '';

          if (!this.selectedAccount) {
               return this.utilsService.returnErrorMessage('Please select an account');
          }

          const seed = this.selectedAccount === 'account1' ? this.account1.seed : this.account2.seed;
          if (!this.utilsService.validatInput(seed)) {
               return this.utilsService.returnErrorMessage('ERROR: Account seed cannot be empty');
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

               this.resultField.nativeElement.innerHTML = `Connected to ${environment} ${net}\nSetting MultiSign\n\n`;

               let signerListTx;
               if (enableMultiSignFlag === 'Y') {
                    const addressesArray = this.multiSignAddress
                         .split(',')
                         .map(address => address.trim())
                         .filter(address => address);
                    if (!addressesArray.length) {
                         return this.utilsService.returnErrorMessage('ERROR: Multi-sign address list is empty');
                    }

                    const SignerEntries = addressesArray.map(address => ({
                         SignerEntry: {
                              Account: address,
                              SignerWeight: 1,
                         },
                    }));

                    const SignerQuorum = Math.ceil(SignerEntries.length / 2);
                    if (SignerQuorum > SignerEntries.length) {
                         return this.utilsService.returnErrorMessage(`ERROR: Quorum (${SignerQuorum}) > total signers (${SignerEntries.length})`);
                    }

                    signerListTx = await client.autofill({
                         TransactionType: 'SignerListSet',
                         Account: wallet.classicAddress,
                         SignerQuorum,
                         SignerEntries,
                    });
               } else {
                    signerListTx = await client.autofill({
                         TransactionType: 'SignerListSet',
                         Account: wallet.classicAddress,
                         SignerQuorum: 0,
                    });
               }

               const response = await client.submitAndWait(signerListTx, { wallet });
               if (response.result.meta && typeof response.result.meta !== 'string' && (response.result.meta as TransactionMetadataBase).TransactionResult !== AppConstants.TRANSACTION.TES_SUCCESS) {
                    this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
                    this.resultField.nativeElement.classList.add('error');

                    this.setError();
                    return;
               }

               this.resultField.nativeElement.innerHTML += `SignerListSet transaction successful\n`;
               this.utilsService.renderTransactionsResults(response, this.resultField.nativeElement);
               this.resultField.nativeElement.classList.add('success');

               this.setSuccess(this.result);

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
               this.utilsService.returnErrorMessage(`ERROR: ${error.message || 'Unknown error'}`);
          } finally {
               this.spinner = false;
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving setMultiSign in ${this.executionTime}ms`);
          }
     }

     private async submitFlagTransaction(client: xrpl.Client, wallet: xrpl.Wallet, flagPayload: any, memo: any) {
          console.log('Entering submitFlagTransaction');
          const startTime = Date.now();

          const tx = {
               TransactionType: 'AccountSet',
               Account: wallet.classicAddress,
               ...flagPayload,
          };

          if (this.memo) {
               tx.Memos = [
                    {
                         Memo: {
                              MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                              MemoData: Buffer.from(this.memo, 'utf8').toString('hex'),
                         },
                    },
               ];
          }

          try {
               const response = await client.submitAndWait(tx, { wallet });
               return {
                    success: true,
                    message: response,
               };
          } catch (error: any) {
               return { success: false, message: `ERROR submitting flag: ${error.message}` };
          } finally {
               console.log(`Leaving submitFlagTransaction in ${Date.now() - startTime}ms`);
          }
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

     async displayDataForAccount1() {
          this.account1.name = this.account1.name || '';
          this.account1.address = this.account1.address || '';
          this.account1.seed = this.account1.seed || '';
          await this.getAccountInfo();
     }

     async displayDataForAccount2() {
          this.account2.name = this.account2.name || '';
          this.account2.address = this.account2.address || '';
          this.account2.seed = this.account2.seed || '';
          await this.getAccountInfo();
     }

     public setError() {
          this.isSuccess = false;
          this.isError = true;
          this.handleTransactionResult({
               result: this.result,
               isError: this.isError,
               isSuccess: this.isSuccess,
          });
     }

     public setSuccess(message: string) {
          this.isSuccess = true;
          this.isError = false;
          this.handleTransactionResult({
               result: `${message}`,
               isError: this.isError,
               isSuccess: this.isSuccess,
          });
     }
}
