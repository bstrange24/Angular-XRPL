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
import { Component, ElementRef, ViewChild, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import * as xrpl from 'xrpl';
import { StorageService } from '../../services/storage.service';
import { NavbarComponent } from '../navbar/navbar.component';
import { AppConstants } from '../../core/app.constants';
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';
import { AppWalletDynamicInputComponent } from '../app-wallet-dynamic-input/app-wallet-dynamic-input.component';

// ✅ Define the balance change interface
interface BalanceChange {
     date: Date;
     hash: string;
     type: string;
     change: number;
     currency: string;
     balanceBefore: number;
     balanceAfter: number;
     counterparty: string;
}

@Component({
     selector: 'app-account-changes',
     standalone: true,
     imports: [CommonModule, FormsModule, AppWalletDynamicInputComponent, NavbarComponent, MatTableModule, MatSortModule, MatPaginatorModule, MatInputModule, MatFormFieldModule, ScrollingModule, MatProgressSpinnerModule, MatIconModule, MatTooltipModule, MatButtonModule],
     templateUrl: './account-changes.component.html',
     styleUrl: './account-changes.component.css',
})
export class AccountChangesComponent implements OnDestroy {
     @ViewChild(CdkVirtualScrollViewport) viewport!: CdkVirtualScrollViewport;
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     @ViewChild('accountForm') accountForm!: NgForm;
     @ViewChild(MatSort) sort!: MatSort;
     @ViewChild(MatPaginator) paginator!: MatPaginator;

     selectedAccount: 'account1' | 'account2' | null = 'account1';
     configurationType: 'holder' | 'exchanger' | 'issuer' | null = null;
     displayedColumns: string[] = ['date', 'hash', 'type', 'change', 'currency', 'balanceBefore', 'balanceAfter', 'counterparty'];
     balanceChanges: BalanceChange[] = [];
     balanceChangesDataSource = new MatTableDataSource<BalanceChange>(this.balanceChanges);
     loadingMore: boolean = false;
     hasMoreData: boolean = true;
     marker: any = undefined;
     currentBalance: number = 0;
     currencyBalances: Map<string, number> = new Map();
     lastResult: string = '';
     result: string = '';
     isError: boolean = false;
     isSuccess: boolean = false;
     isEditable: boolean = false;
     ownerCount: string = '';
     totalXrpReserves: string = '';
     executionTime: string = '';
     isMessageKey: boolean = false;
     spinnerMessage: string = '';
     spinner: boolean = false;
     url: string = '';
     filterValue: string = '';
     isExpanded: boolean = false;
     wallets: any[] = [];
     selectedWalletIndex: number = 0;
     currentWallet = { name: '', address: '', seed: '', balance: '' };

     // ✅ Add caching
     private accountLinesCache = new Map<string, any>();
     private accountLinesCacheTime = new Map<string, number>();
     private transactionCache = new Map<string, any[]>();
     private filterCache = new Map<string, BalanceChange[]>();
     private readonly CACHE_EXPIRY = 30000; // 30 seconds

     // ✅ Prevent duplicate scroll events
     private scrollDebounce: any = null;

     constructor(private readonly xrplService: XrplService, private readonly utilsService: UtilsService, private readonly cdr: ChangeDetectorRef, private readonly storageService: StorageService, private readonly renderUiComponentsService: RenderUiComponentsService, private readonly xrplTransactions: XrplTransactionService) {}

     ngOnDestroy() {
          // ✅ Clean up debounce timer
          if (this.scrollDebounce) {
               clearTimeout(this.scrollDebounce);
          }
     }

     ngAfterViewInit() {
          console.log('ngAfterViewInit: Viewport initialized:', this.viewport);
          this.balanceChangesDataSource.sort = this.sort;
          this.balanceChangesDataSource.paginator = this.paginator;

          // ✅ Set the trackBy function
          (this.balanceChangesDataSource as any).trackByFunction = this.trackByFunction;

          if (this.selectedAccount) {
               this.loadBalanceChanges(true);
          }
     }

     toggleExpanded() {
          this.isExpanded = !this.isExpanded;
     }

     applyFilter(filterValue: string) {
          this.filterValue = filterValue.trim().toLowerCase();
          this.balanceChangesDataSource.filter = this.filterValue;
     }

     private trackByFunction = (index: number, item: BalanceChange) => {
          return item.hash; // Use the hash as unique identifier
     };

     private setFilterPredicate() {
          this.balanceChangesDataSource.filterPredicate = (data: BalanceChange, filter: string) => {
               const searchText = filter.toLowerCase();
               return data.type.toLowerCase().includes(searchText) || data.currency.toLowerCase().includes(searchText) || (data.counterparty || '').toLowerCase().includes(searchText);
          };
     }

     onPageChange(event: any) {
          const shouldLoadMore = event.pageIndex * event.pageSize >= this.balanceChanges.length;
          if (this.hasMoreData && !this.loadingMore && shouldLoadMore) {
               console.log('Loading more data for page:', event.pageIndex);
               this.loadBalanceChanges(false);
          }
     }

     ngAfterViewChecked() {
          if (this.result !== this.lastResult && this.resultField?.nativeElement) {
               this.renderUiComponentsService.attachSearchListener(this.resultField.nativeElement);
               this.lastResult = this.result;
          }
     }

     onWalletListChange(event: any[]) {
          this.wallets = event;
          if (this.wallets.length > 0 && this.selectedWalletIndex >= this.wallets.length) {
               this.selectedWalletIndex = 0;
          }
          this.onAccountChange();
     }

     handleTransactionResult(event: { result: string; isError: boolean; isSuccess: boolean }) {
          this.result = event.result;
          this.isError = event.isError;
          this.isSuccess = event.isSuccess;
          this.isEditable = !this.isSuccess;
     }

     onAccountChange() {
          if (this.wallets.length === 0) return;
          this.currentWallet = {
               ...this.wallets[this.selectedWalletIndex],
               balance: this.currentWallet.balance || '0',
          };

          if (this.currentWallet.address && xrpl.isValidAddress(this.currentWallet.address)) {
               this.loadBalanceChanges(true);
          } else if (this.currentWallet.address) {
               this.setError('Invalid XRP address');
          }
     }

     // ✅ Optimized loadBalanceChanges with caching
     // Add this method to update balances after loading transactions
     async loadBalanceChanges(reset = true) {
          console.log('Entering loadBalanceChanges');
          const startTime = Date.now();

          try {
               const address = this.currentWallet.address;
               if (!address) return;

               const client = await this.xrplService.getClient();

               if (reset) {
                    this.balanceChanges = [];
                    this.balanceChangesDataSource.data = [];
                    this.marker = undefined;
                    this.hasMoreData = true;

                    // Set environment URL
                    type EnvKey = keyof typeof AppConstants.XRPL_WIN_URL;
                    const env = this.xrplService.getNet().environment.toUpperCase() as EnvKey;
                    this.url = AppConstants.XRPL_WIN_URL[env] || AppConstants.XRPL_WIN_URL.DEVNET;

                    // ✅ PARALLELIZE + CACHE account info + lines
                    const [accountInfo, accountLines] = await Promise.all([this.xrplService.getAccountInfo(client, address, 'validated', ''), this.getCachedAccountLines(client, address)]);

                    this.currentBalance = xrpl.dropsToXrp(accountInfo.result.account_data.Balance);
                    this.currencyBalances.set('XRP', this.currentBalance);

                    accountLines.result.lines.forEach((line: any) => {
                         const key = `${line.currency}+${line.account}`;
                         this.currencyBalances.set(key, parseFloat(line.balance));
                    });

                    // ✅ Update owner count and reserves here
                    const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, accountInfo, address);
                    this.ownerCount = ownerCount;
                    this.totalXrpReserves = totalXrpReserves;

                    // ✅ Update wallet balance
                    const balance = (await client.getXrpBalance(address)) - parseFloat(totalXrpReserves || '0');
                    this.currentWallet.balance = balance.toString();

                    this.setFilterPredicate();
               }

               if (!this.hasMoreData || this.loadingMore) return;

               this.loadingMore = true;

               // ✅ Fetch transactions
               const txResponse = await this.xrplService.getAccountTransactions(client, address, 20, this.marker);

               if (txResponse.result.transactions.length === 0) {
                    this.hasMoreData = false;
                    return;
               }

               // ✅ PROCESS TRANSACTIONS — offload heavy work
               const processedTx = this.processTransactionsForBalanceChanges(txResponse.result.transactions, address);

               // ✅ Update UI
               this.balanceChanges.push(...processedTx);
               this.balanceChangesDataSource.data = [...this.balanceChanges]; // Force new array reference

               this.marker = txResponse.result.marker;
               if (!this.marker) this.hasMoreData = false;
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

     // ✅ Add caching helper
     private async getCachedAccountLines(client: any, address: string): Promise<any> {
          const cacheKey = `${address}-${this.xrplService.getNet().environment}`;
          const now = Date.now();

          const cached = this.accountLinesCache.get(cacheKey);
          const cachedTime = this.accountLinesCacheTime.get(cacheKey);

          if (cached && cachedTime && now - cachedTime < this.CACHE_EXPIRY) {
               return cached;
          }

          const accountLines = await client.request({ command: 'account_lines', account: address });
          this.accountLinesCache.set(cacheKey, accountLines);
          this.accountLinesCacheTime.set(cacheKey, now);
          return accountLines;
     }

     processTransactionsForBalanceChanges(transactions: any[], address: string): BalanceChange[] {
          console.log('Entering processTransactionsForBalanceChanges');

          const processed: BalanceChange[] = [];

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

          // ✅ Debounce scroll events
          if (this.scrollDebounce) {
               clearTimeout(this.scrollDebounce);
          }

          this.scrollDebounce = setTimeout(() => {
               const total = this.balanceChangesDataSource.data.length;
               const viewportHeight = this.viewport.elementRef.nativeElement.clientHeight;
               const itemHeight = 48; // Matches itemSize
               const visibleItems = Math.ceil(viewportHeight / itemHeight);

               // console.log(`onScroll: index=${index}, total=${total}, visibleItems=${visibleItems}, hasMoreData=${this.hasMoreData}, loadingMore=${this.loadingMore}`);

               if (index + visibleItems >= total && this.hasMoreData && !this.loadingMore) {
                    console.log('onScroll: Triggering loadBalanceChanges');
                    this.loadBalanceChanges(false);
               }
          }, 100); // 100ms debounce
     }

     trackByHash(index: number, item: BalanceChange): string {
          return item.hash; // Unique identifier for rows
     }

     copyToClipboard(text: string): void {
          navigator.clipboard
               .writeText(text)
               .then(() => {
                    console.log('Copied to clipboard:', text);
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
          this.currentWallet.balance = balance.toString();
     }

     async getWallet() {
          const environment = this.xrplService.getNet().environment;
          const seed = this.currentWallet.seed;
          const wallet = await this.utilsService.getWallet(seed, environment);
          if (!wallet) {
               throw new Error('ERROR: Wallet could not be created or is undefined');
          }
          return wallet;
     }

     shortCurrencyDisplay(hex: string): string {
          return hex.length > 5 ? `${hex.slice(0, 10)}...` : hex;
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
