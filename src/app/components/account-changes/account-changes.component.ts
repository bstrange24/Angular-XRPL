import { NgModule } from '@angular/core';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
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
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';

@Component({
     selector: 'app-account-changes',
     standalone: true,
     imports: [CommonModule, FormsModule, WalletMultiInputComponent, NavbarComponent, MatTableModule, MatSortModule, MatPaginatorModule, MatInputModule, MatFormFieldModule, ScrollingModule, MatProgressSpinnerModule, MatIconModule, MatTooltipModule, MatButtonModule],
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
     isExpanded: boolean = false;

     constructor(private readonly xrplService: XrplService, private readonly utilsService: UtilsService, private readonly cdr: ChangeDetectorRef, private readonly storageService: StorageService, private readonly renderUiComponentsService: RenderUiComponentsService, private readonly xrplTransactions: XrplTransactionService) {}

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

     toggleExpanded() {
          this.isExpanded = !this.isExpanded;
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
          const accountHandlers: Record<string, () => void> = {
               account1: () => this.displayDataForAccount1(),
               account2: () => this.displayDataForAccount2(),
               issuer: () => this.displayDataForAccount3(),
          };
          (accountHandlers[this.selectedAccount ?? 'issuer'] || accountHandlers['issuer'])();
          this.configurationType = null;
     }

     async loadBalanceChanges(reset = true) {
          console.log('Entering loadBalanceChanges');
          const startTime = Date.now();
          try {
               if (!this.selectedAccount) {
                    return;
               }

               const address = this.utilsService.getSelectedAddressWithIssuer(this.selectedAccount, this.account1, this.account2, this.issuer);
               const client = await this.xrplService.getClient();
               const wallet = await this.getWallet();

               if (reset) {
                    // ➤ Reset UI state
                    this.balanceChanges = [];
                    this.balanceChangesDataSource.data = [];
                    this.marker = undefined;
                    this.hasMoreData = true;

                    // ➤ Set environment URL
                    type EnvKey = keyof typeof AppConstants.XRPL_WIN_URL;
                    const env = this.xrplService.getNet().environment.toUpperCase() as EnvKey;
                    this.url = AppConstants.XRPL_WIN_URL[env] || AppConstants.XRPL_WIN_URL.DEVNET;

                    // ➤ PARALLELIZE: Fetch account info + trust lines
                    const [accountInfo, accountLines] = await Promise.all([this.xrplService.getAccountInfo(client, address, 'validated', ''), client.request({ command: 'account_lines', account: address })]);

                    // ➤ Update XRP balance
                    this.currentBalance = xrpl.dropsToXrp(accountInfo.result.account_data.Balance);
                    this.currencyBalances.set('XRP', this.currentBalance);

                    // ➤ Update token balances
                    accountLines.result.lines.forEach((line: any) => {
                         const key = `${line.currency}+${line.account}`;
                         this.currencyBalances.set(key, parseFloat(line.balance));
                    });

                    // ➤ Set filter predicate
                    this.setFilterPredicate();
               }

               if (!this.hasMoreData || this.loadingMore) return;

               this.loadingMore = true;

               // ➤ Fetch transactions
               const txResponse = await this.xrplService.getAccountTransactions(client, address, 20, this.marker);

               if (txResponse.result.transactions.length === 0) {
                    this.hasMoreData = false;
                    return;
               }

               // ➤ PROCESS TRANSACTIONS — offload heavy work
               const processedTx = this.processTransactionsForBalanceChanges(txResponse.result.transactions, address);

               // ➤ Update UI
               this.balanceChanges.push(...processedTx);
               this.balanceChangesDataSource.data = [...this.balanceChanges]; // Force new array reference

               this.marker = txResponse.result.marker;
               if (!this.marker) this.hasMoreData = false;

               // ➤ DEFER: Non-critical balance update
               setTimeout(async () => {
                    try {
                         const freshAccountInfo = await this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', '');
                         await this.updateXrpBalance(client, freshAccountInfo, wallet);
                    } catch (err) {
                         console.error('Deferred balance update failed:', err);
                    }
               }, 0);
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

          // Use array constructor with known length for better performance
          const processed: any[] = [];

          for (const txWrapper of transactions) {
               const tx = txWrapper.tx_json || txWrapper.transaction;
               const meta = txWrapper.meta;

               if (typeof meta !== 'object' || !meta.AffectedNodes) {
                    continue; // Skip invalid
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
               const date = new Date((tx.date + 946684800) * 1000);
               const hash = txWrapper.hash;

               // Process affected nodes
               for (const node of meta.AffectedNodes) {
                    const modified = node.ModifiedNode || node.CreatedNode || node.DeletedNode;
                    if (!modified) continue;

                    // ----- XRP balance (AccountRoot) -----
                    if (modified.LedgerEntryType === 'AccountRoot' && modified.FinalFields?.Account === address) {
                         const prevBalanceDrops = modified.PreviousFields?.Balance ?? modified.FinalFields.Balance;
                         const finalBalanceDrops = modified.FinalFields.Balance;

                         const prevXrp = xrpl.dropsToXrp(prevBalanceDrops);
                         const finalXrp = xrpl.dropsToXrp(finalBalanceDrops);
                         const delta = this.utilsService.roundToEightDecimals(finalXrp - prevXrp);

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
                              const prevBalanceField = modified.PreviousFields?.Balance || { value: '0' };
                              tokenChange = this.utilsService.roundToEightDecimals(parseFloat(balanceField.value) - parseFloat(prevBalanceField.value));
                              tokenBalanceAfter = this.utilsService.roundToEightDecimals(parseFloat(balanceField.value));
                              const curr = balanceField.currency.length > 3 ? this.shortCurrencyDisplay(balanceField.currency) : balanceField.currency || '';
                              tokenCurrency = curr;
                         } else if (modified.NewFields?.Balance) {
                              const balanceField = modified.NewFields.Balance;
                              const prevBalanceField = modified.PreviousFields?.Balance || { value: '0' };
                              tokenChange = this.utilsService.roundToEightDecimals(parseFloat(balanceField.value));
                              tokenBalanceAfter = tokenChange;
                              const curr = balanceField.currency.length > 3 ? this.shortCurrencyDisplay(balanceField.currency) : balanceField.currency || '';
                              tokenCurrency = curr;
                         } else if (node.DeletedNode) {
                              const balanceField = modified.FinalFields?.Balance;
                              if (balanceField) {
                                   tokenChange = this.utilsService.roundToEightDecimals(-parseFloat(balanceField.value));
                                   tokenBalanceAfter = 0;
                                   const curr = balanceField.currency.length > 3 ? this.shortCurrencyDisplay(balanceField.currency) : balanceField.currency || '';
                                   tokenCurrency = curr;
                              }
                         }

                         if (tokenCurrency && tokenChange !== 0) {
                              changes.push({
                                   change: tokenChange,
                                   currency: tokenCurrency,
                                   balanceBefore: this.utilsService.roundToEightDecimals(parseFloat(modified.PreviousFields?.Balance?.value || '0')),
                                   balanceAfter: tokenBalanceAfter,
                              });
                         }
                    }
               }

               // Push processed changes
               for (const changeItem of changes) {
                    processed.push({
                         date,
                         hash,
                         type,
                         change: changeItem.change,
                         currency: changeItem.currency,
                         balanceBefore: changeItem.balanceBefore,
                         balanceAfter: changeItem.balanceAfter,
                         counterparty,
                    });
               }
          }

          console.log('Leaving processTransactionsForBalanceChanges');
          return processed;
     }

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

     copyToClipboard(text: string): void {
          navigator.clipboard
               .writeText(text)
               .then(() => {
                    // Optional: Show snackbar/toast notification
                    console.log('Copied to clipboard:', text);

                    // Optional: You can add a snackbar here for user feedback
                    // this.snackBar.open('Copied to clipboard!', 'Close', { duration: 2000 });
               })
               .catch(err => {
                    console.error('Failed to copy: ', err);
               });
     }

     private async updateXrpBalance(client: xrpl.Client, accountInfo: xrpl.AccountInfoResponse, wallet: xrpl.Wallet) {
          const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, accountInfo, wallet.classicAddress);

          this.ownerCount = ownerCount;
          this.totalXrpReserves = totalXrpReserves;

          const balance = (await client.getXrpBalance(wallet.classicAddress)) - parseFloat(this.totalXrpReserves || '0');
          this.account1.balance = balance.toString();
     }

     private async displayDataForAccount(accountKey: 'account1' | 'account2' | 'issuer') {
          const isIssuer = accountKey === 'issuer';
          const prefix = isIssuer ? 'issuer' : accountKey;

          // Define casing differences in keys
          const formatKey = (key: string) => (isIssuer ? `${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}` : `${prefix}${key}`);

          // Fetch stored values
          const name = this.storageService.getInputValue(formatKey('name')) || AppConstants.EMPTY_STRING;
          const address = this.storageService.getInputValue(formatKey('address')) || AppConstants.EMPTY_STRING;
          const seed = this.storageService.getInputValue(formatKey('seed')) || this.storageService.getInputValue(formatKey('mnemonic')) || this.storageService.getInputValue(formatKey('secretNumbers')) || AppConstants.EMPTY_STRING;

          // Update account object
          const accountMap = {
               account1: this.account1,
               account2: this.account2,
               issuer: this.issuer,
          };
          const account = accountMap[accountKey];
          account.name = name;
          account.address = address;
          account.seed = seed;

          // DOM manipulation (map field IDs instead of repeating)
          const fieldMap: Record<'name' | 'address' | 'seed', string> = {
               name: 'accountName1Field',
               address: 'accountAddress1Field',
               seed: 'accountSeed1Field',
          };

          (Object.entries(fieldMap) as [keyof typeof fieldMap, string][]).forEach(([key, id]) => {
               const el = document.getElementById(id) as HTMLInputElement | null;
               if (el) el.value = account[key];
          });

          this.cdr.detectChanges(); // sync with ngModel

          // Fetch account details
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

     async getWallet() {
          const environment = this.xrplService.getNet().environment;
          const seed = this.utilsService.getSelectedSeedWithIssuer(this.selectedAccount ? this.selectedAccount : '', this.account1, this.account2, this.issuer);
          const wallet = await this.utilsService.getWallet(seed, environment);
          if (!wallet) {
               throw new Error('ERROR: Wallet could not be created or is undefined');
          }
          return wallet;
     }

     shortCurrencyDisplay(hex: string): string {
          return hex.length > 5 ? `${hex.slice(0, 10)}...` : hex;
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
