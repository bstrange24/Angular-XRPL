import { NgModule } from '@angular/core';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { WalletMultiInputComponent } from '../wallet-multi-input/wallet-multi-input.component';
import * as xrpl from 'xrpl';
import { StorageService } from '../../services/storage.service';
import { NavbarComponent } from '../navbar/navbar.component';
import { AppConstants } from '../../core/app.constants';

@Component({
     selector: 'app-account-changes',
     standalone: true,
     imports: [CommonModule, FormsModule, WalletMultiInputComponent, NavbarComponent, MatTableModule, MatSortModule, MatPaginatorModule, MatInputModule, MatFormFieldModule, ScrollingModule, MatProgressSpinnerModule],
     templateUrl: './account-changes.component.html',
     styleUrl: './account-changes.component.css',
})
export class AccountChangesComponent {
     @ViewChild(CdkVirtualScrollViewport) viewport!: CdkVirtualScrollViewport;
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     @ViewChild('accountForm') accountForm!: NgForm;
     @ViewChild(MatSort) sort!: MatSort;
     @ViewChild(MatPaginator) paginator!: MatPaginator;
     selectedAccount: 'account1' | 'account2' | null = 'account1'; // Initialize to 'account1' for default selection
     configurationType: 'holder' | 'exchanger' | 'issuer' | null = null; // New property to track configuration type
     displayedColumns: string[] = ['date', 'hash', 'type', 'change', 'currency', 'balanceBefore', 'balanceAfter', 'counterparty'];
     balanceChanges: any[] = []; // Array of processed tx with balance changes
     balanceChangesDataSource = new MatTableDataSource<any>(this.balanceChanges);
     loadingMore: boolean = false;
     hasMoreData: boolean = true;
     marker: any = undefined; // For pagination
     currentBalance: number = 0; // Track running balance (start from current, subtract backwards since tx are newest-first)
     currencyBalances: Map<string, number> = new Map(); // Key: 'XRP' or 'currency+issuer'
     lastResult: string = '';
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = false;
     account1 = { name: '', address: '', seed: '', balance: '' };
     account2 = { name: '', address: '', seed: '', balance: '' };
     issuer = { name: '', address: '', seed: '', mnemonic: '', secretNumbers: '', balance: '0' };
     ownerCount: string = '';
     totalXrpReserves: string = '';
     executionTime: string = '';
     isMessageKey: boolean = false;
     spinnerMessage: string = '';
     spinner: boolean = false;
     url: string = '';
     filterValue: string = '';

     constructor(private xrplService: XrplService, private utilsService: UtilsService, private cdr: ChangeDetectorRef, private storageService: StorageService) {}

     ngAfterViewInit() {
          console.log('ngAfterViewInit: Viewport initialized:', this.viewport);
          console.log('Balance changes data:', this.balanceChangesDataSource.data);
          if (this.viewport) {
               this.viewport.checkViewportSize(); // Force viewport to recalculate
          }
          this.balanceChangesDataSource.sort = this.sort;
          this.balanceChangesDataSource.paginator = this.paginator;
          if (this.selectedAccount) {
               this.loadBalanceChanges(true); // Initial load
          }
          this.cdr.detectChanges();
     }

     applyFilter(filterValue: string) {
          this.filterValue = filterValue.trim().toLowerCase();
          this.balanceChangesDataSource.filter = this.filterValue;
          this.cdr.detectChanges();
     }

     // Custom filter predicate to search type, currency, and counterparty
     private setFilterPredicate() {
          this.balanceChangesDataSource.filterPredicate = (data: any, filter: string) => {
               const searchText = filter.toLowerCase();
               return data.type.toLowerCase().includes(searchText) || data.currency.toLowerCase().includes(searchText) || (data.counterparty || '').toLowerCase().includes(searchText);
          };
     }

     onPageChange(event: any) {
          if (this.hasMoreData && !this.loadingMore && event.pageIndex * event.pageSize >= this.balanceChanges.length) {
               console.log('Loading more data for page:', event.pageIndex);
               this.loadBalanceChanges(false);
          }
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

     async loadBalanceChanges(reset = true) {
          console.log('Entering loadBalanceChanges');
          const startTime = Date.now();
          try {
               if (!this.selectedAccount) {
                    return;
               }

               const address = this.selectedAccount === 'account1' ? this.account1.address : this.selectedAccount === 'account2' ? this.account2.address : this.issuer.address;

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

               if (reset) {
                    this.balanceChanges = [];
                    this.balanceChangesDataSource.data = [];
                    this.marker = undefined;
                    this.hasMoreData = true;

                    type EnvKey = keyof typeof AppConstants.XRPL_WIN_URL; // "MAINNET" | "TESTNET" | "DEVNET"
                    const env = this.xrplService.getNet().environment.toUpperCase() as EnvKey;
                    this.url = AppConstants.XRPL_WIN_URL[env] || AppConstants.XRPL_WIN_URL.DEVNET;

                    const client = await this.xrplService.getClient();
                    const accountInfo = await this.xrplService.getAccountInfo(client, address, 'validated', '');
                    this.currentBalance = xrpl.dropsToXrp(accountInfo.result.account_data.Balance); // XRP
                    this.currencyBalances.set('XRP', this.currentBalance);

                    // Fetch trust lines for token balances
                    const accountLines = await client.request({ command: 'account_lines', account: address });
                    accountLines.result.lines.forEach((line: any) => {
                         const key = `${line.currency}+${line.account}`;
                         this.currencyBalances.set(key, parseFloat(line.balance));
                    });

                    // Set filter predicate after data source initialization
                    this.setFilterPredicate();
               }

               if (!this.hasMoreData || this.loadingMore) return;

               this.loadingMore = true;

               const txResponse = await this.xrplService.getAccountTransactions(client, address, 20, this.marker);

               if (txResponse.result.transactions.length === 0) {
                    this.hasMoreData = false;
                    return;
               }

               const processedTx = this.processTransactionsForBalanceChanges(txResponse.result.transactions, address);
               this.balanceChanges.push(...processedTx); // Reverse to append oldest last (since newest-first fetch)
               this.balanceChangesDataSource.data = this.balanceChanges;

               this.marker = txResponse.result.marker;
               if (!this.marker) this.hasMoreData = false;

               await this.updateXrpBalance(client, wallet);
          } catch (error) {
               console.error('Error loading tx:', error);
               this.setError('Failed to load balance changes');
          } finally {
               this.loadingMore = false;
               this.cdr.detectChanges();
               this.executionTime = (Date.now() - startTime).toString();
               console.log(`Leaving loadBalanceChanges in ${this.executionTime}ms`);
          }
     }

     processTransactionsForBalanceChanges(transactions: any[], address: string): any[] {
          console.log('Entering processTransactionsForBalanceChanges');

          const processed: any[] = [];

          transactions.forEach(txWrapper => {
               const tx = txWrapper.tx_json || txWrapper.transaction;
               const meta = txWrapper.meta;

               if (typeof meta !== 'object' || !meta.AffectedNodes) {
                    return; // Skip invalid
               }

               let type = tx.TransactionType;
               let counterparty = tx.Destination || tx.Account || 'N/A';

               // Classify payments by direction
               if (tx.TransactionType === 'Payment') {
                    if (tx.Destination === address) {
                         type = 'Payment Received';
                    } else if (tx.Account === address) {
                         type = 'Payment Sent';
                    }
               }

               const changes: { change: number; currency: string; balanceBefore: number; balanceAfter: number }[] = [];

               let prevBalanceField = { value: '0' }; // Default previous balance field
               // Loop over affected nodes for balance changes
               meta.AffectedNodes.forEach((node: any) => {
                    const modified = node.ModifiedNode || node.CreatedNode || node.DeletedNode;
                    if (!modified) return;

                    // ----- XRP balance (AccountRoot) -----
                    if (modified.LedgerEntryType === 'AccountRoot' && modified.FinalFields?.Account === address) {
                         const prevBalanceDrops = modified.PreviousFields?.Balance ?? modified.FinalFields.Balance;
                         const finalBalanceDrops = modified.FinalFields.Balance;

                         const prevXrp = xrpl.dropsToXrp(prevBalanceDrops);
                         const finalXrp = xrpl.dropsToXrp(finalBalanceDrops);

                         // delta = net change
                         let delta = this.utilsService.roundToEightDecimals(finalXrp - prevXrp);

                         // subtract fee if this account was sender
                         // if (tx.Account === address && tx.Fee) {
                         //      const feeXrp = this.utilsService.roundToEightDecimals(xrpl.dropsToXrp(tx.Fee));
                         //      delta = this.utilsService.roundToEightDecimals(delta - feeXrp);
                         // }

                         changes.push({
                              change: delta,
                              currency: 'XRP',
                              balanceBefore: this.utilsService.roundToEightDecimals(prevXrp),
                              balanceAfter: this.utilsService.roundToEightDecimals(finalXrp),
                         });
                    }

                    // ----- Token balances (RippleState) -----
                    else if (modified.LedgerEntryType === 'RippleState') {
                         let tokenChange = 0;
                         let tokenCurrency = '';
                         let tokenBalanceAfter = 0;
                         counterparty = modified.FinalFields?.HighLimit?.issuer || modified.FinalFields?.LowLimit?.issuer || counterparty;

                         if (modified.FinalFields?.Balance) {
                              const balanceField = modified.FinalFields.Balance;
                              prevBalanceField = modified.PreviousFields?.Balance || {
                                   value: '0',
                              };
                              tokenChange = this.utilsService.roundToEightDecimals(parseFloat(balanceField.value) - parseFloat(prevBalanceField.value));
                              tokenBalanceAfter = this.utilsService.roundToEightDecimals(parseFloat(balanceField.value));
                              const curr = balanceField.currency.length > 3 ? this.utilsService.decodeCurrencyCode(balanceField.currency) : balanceField.currency ?? '';
                              tokenCurrency = `${curr}`;
                         } else if (modified.NewFields?.Balance) {
                              prevBalanceField = modified.PreviousFields?.Balance || {
                                   value: '0',
                              };
                              const balanceField = modified.NewFields.Balance;
                              tokenChange = this.utilsService.roundToEightDecimals(parseFloat(balanceField.value));
                              tokenBalanceAfter = tokenChange;
                              const curr = balanceField.currency.length > 3 ? this.utilsService.decodeCurrencyCode(balanceField.currency) : balanceField.currency ?? '';
                              tokenCurrency = `${curr}`;
                         } else if (node.DeletedNode) {
                              prevBalanceField = modified.PreviousFields?.Balance || {
                                   value: '0',
                              };
                              const balanceField = modified.FinalFields.Balance;
                              tokenChange = this.utilsService.roundToEightDecimals(-parseFloat(balanceField.value));
                              tokenBalanceAfter = 0;
                              const curr = balanceField.currency.length > 3 ? this.utilsService.decodeCurrencyCode(balanceField.currency) : balanceField.currency ?? '';
                              tokenCurrency = `${curr}`;
                         }

                         // if (tokenCurrency) {
                         if (tokenCurrency && tokenChange !== 0) {
                              changes.push({
                                   change: tokenChange,
                                   currency: tokenCurrency,
                                   balanceBefore: this.utilsService.roundToEightDecimals(prevBalanceField.value ? parseFloat(prevBalanceField.value) : 0),
                                   balanceAfter: tokenBalanceAfter,
                              });
                         }
                    }
               });

               // Push processed changes
               changes.forEach(changeItem => {
                    processed.push({
                         date: new Date((tx.date + 946684800) * 1000),
                         hash: txWrapper.hash,
                         type,
                         change: changeItem.change,
                         currency: changeItem.currency,
                         balanceBefore: changeItem.balanceBefore,
                         balanceAfter: changeItem.balanceAfter,
                         counterparty,
                    });
               });
          });

          console.log('Leaving processTransactionsForBalanceChanges');
          return processed;
     }

     processTransactionsForBalanceChanges1(transactions: any[], address: string): any[] {
          console.log('Entering processTransactionsForBalanceChanges');

          const processed: any[] = [];
          transactions.forEach(txWrapper => {
               const tx = txWrapper.tx_json || txWrapper.transaction;
               const meta = txWrapper.meta;

               if (typeof meta !== 'object' || !meta.AffectedNodes) {
                    return; // Skip invalid
               }

               const changes: { change: number; currency: string; balanceAfter: number }[] = [];
               let counterparty = tx.Destination || tx.Account || 'N/A';
               let type = tx.TransactionType;

               if (tx.TransactionType === 'Payment') {
                    if (tx.Destination === address) {
                         type = 'Payment Received';
                    } else if (tx.Account === address) {
                         type = 'Payment Sent';
                    }
               }

               let xrpChange = 0;

               meta.AffectedNodes.forEach((node: any) => {
                    const modified = node.ModifiedNode || node.CreatedNode || node.DeletedNode;
                    if (!modified) return;

                    if (modified.LedgerEntryType === 'AccountRoot' && modified.FinalFields?.Account === address) {
                         const prevBalance = modified.PreviousFields?.Balance || modified.FinalFields.Balance;
                         const finalBalance = modified.FinalFields.Balance;
                         xrpChange = this.utilsService.roundToEightDecimals(xrpl.dropsToXrp(finalBalance) - xrpl.dropsToXrp(prevBalance));
                         if (!modified.PreviousFields?.Balance) {
                              xrpChange = this.utilsService.roundToEightDecimals(-xrpl.dropsToXrp(tx.Fee || '0'));
                         }
                         changes.push({
                              change: xrpChange,
                              currency: 'XRP',
                              balanceAfter: this.utilsService.roundToEightDecimals(xrpl.dropsToXrp(finalBalance)),
                         });
                    } else if (modified.LedgerEntryType === 'RippleState') {
                         let tokenChange = 0;
                         let tokenCurrency = '';
                         let tokenBalanceAfter = 0;
                         counterparty = modified.FinalFields?.HighLimit?.issuer || modified.FinalFields?.LowLimit?.issuer || counterparty;

                         if (modified.FinalFields?.Balance) {
                              const balanceField = modified.FinalFields.Balance;
                              const prevBalanceField = modified.PreviousFields?.Balance || { value: '0' };
                              tokenChange = this.utilsService.roundToEightDecimals(parseFloat(balanceField.value) - parseFloat(prevBalanceField.value));
                              tokenBalanceAfter = this.utilsService.roundToEightDecimals(parseFloat(balanceField.value));
                              const curr = balanceField.currency.length > 3 ? this.utilsService.decodeCurrencyCode(balanceField.currency) : balanceField.currency ?? '';
                              tokenCurrency = `${curr}`;
                         } else if (modified.NewFields?.Balance) {
                              const balanceField = modified.NewFields.Balance;
                              tokenChange = this.utilsService.roundToEightDecimals(parseFloat(balanceField.value));
                              tokenBalanceAfter = tokenChange;
                              const curr = balanceField.currency.length > 3 ? this.utilsService.decodeCurrencyCode(balanceField.currency) : balanceField.currency ?? '';
                              tokenCurrency = `${curr}`;
                         } else if (node.DeletedNode) {
                              const balanceField = modified.FinalFields.Balance;
                              tokenChange = this.utilsService.roundToEightDecimals(-parseFloat(balanceField.value));
                              tokenBalanceAfter = 0;
                              const curr = balanceField.currency.length > 3 ? this.utilsService.decodeCurrencyCode(balanceField.currency) : balanceField.currency ?? '';
                              tokenCurrency = `${curr}`;
                         }

                         if (tokenCurrency) {
                              changes.push({
                                   change: tokenChange,
                                   currency: tokenCurrency,
                                   balanceAfter: tokenBalanceAfter,
                              });
                         }
                    }
               });

               if (!changes.some(c => c.currency === 'XRP')) {
                    changes.push({
                         change: this.utilsService.roundToEightDecimals(-xrpl.dropsToXrp(tx.Fee || '0')),
                         currency: 'XRP',
                         balanceAfter: this.utilsService.roundToEightDecimals(this.currentBalance),
                    });
               }

               changes.forEach(changeItem => {
                    let balanceAfter = changeItem.balanceAfter;
                    if (changeItem.currency === 'XRP') {
                         this.currentBalance -= changeItem.change;
                         balanceAfter = this.utilsService.roundToEightDecimals(this.currentBalance + changeItem.change);
                    } else {
                         const currBalance = this.currencyBalances.get(changeItem.currency) || 0;
                         this.currencyBalances.set(changeItem.currency, currBalance - changeItem.change);
                         balanceAfter = this.utilsService.roundToEightDecimals(currBalance);
                    }

                    processed.push({
                         date: new Date((tx.date + 946684800) * 1000),
                         hash: txWrapper.hash,
                         type,
                         change: changeItem.change,
                         currency: changeItem.currency,
                         balanceAfter,
                         counterparty,
                    });
               });
          });

          console.log('Leaving processTransactionsForBalanceChanges');
          return processed;
     }

     // Infinite scroll handler
     onScroll(index: number) {
          if (!this.viewport) {
               console.warn('onScroll: Viewport not initialized');
               return;
          }
          const total = this.balanceChangesDataSource.data.length;
          const viewportHeight = this.viewport.elementRef.nativeElement.clientHeight;
          const itemHeight = 48; // Matches itemSize
          const visibleItems = Math.ceil(viewportHeight / itemHeight);
          console.log(`onScroll: index=${index}, total=${total}, visibleItems=${visibleItems}, hasMoreData=${this.hasMoreData}, loadingMore=${this.loadingMore}`);
          if (index + visibleItems >= total && this.hasMoreData && !this.loadingMore) {
               console.log('onScroll: Triggering loadBalanceChanges');
               this.loadBalanceChanges(false);
          }
     }

     trackByHash(index: number, item: any): string {
          return item.hash; // Unique identifier for rows
     }

     clearFields() {
          this.cdr.detectChanges();
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
                    await this.loadBalanceChanges();
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
