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
import { Component, ElementRef, ViewChild, ChangeDetectorRef, OnDestroy, AfterViewInit, AfterViewChecked } from '@angular/core';
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

interface BalanceChange {
     date: Date;
     hash: string;
     type: string;
     change: number;
     fees: number;
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
export class AccountChangesComponent implements OnDestroy, AfterViewInit, AfterViewChecked {
     @ViewChild(CdkVirtualScrollViewport) viewport!: CdkVirtualScrollViewport;
     @ViewChild('resultField') resultField!: ElementRef<HTMLDivElement>;
     @ViewChild('accountForm') accountForm!: NgForm;
     @ViewChild(MatSort) sort!: MatSort;
     @ViewChild(MatPaginator) paginator!: MatPaginator;
     selectedAccount: 'account1' | 'account2' | null = 'account1';
     displayedColumns: string[] = ['date', 'hash', 'type', 'change', 'currency', 'fees', 'balanceBefore', 'balanceAfter', 'counterparty'];
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
     private readonly accountLinesCache = new Map<string, any>();
     private readonly accountLinesCacheTime = new Map<string, number>();
     private readonly transactionCache = new Map<string, any[]>();
     private readonly filterCache = new Map<string, BalanceChange[]>();
     private readonly CACHE_EXPIRY = 30000;
     private scrollDebounce: any = null;

     constructor(private readonly xrplService: XrplService, private readonly utilsService: UtilsService, private readonly cdr: ChangeDetectorRef, private readonly storageService: StorageService, private readonly renderUiComponentsService: RenderUiComponentsService, private readonly xrplTransactions: XrplTransactionService) {}

     ngOnDestroy() {
          if (this.scrollDebounce) {
               clearTimeout(this.scrollDebounce);
          }
     }

     ngAfterViewInit() {
          console.log('ngAfterViewInit: Viewport initialized:', this.viewport);
          this.balanceChangesDataSource.sort = this.sort;
          this.balanceChangesDataSource.paginator = this.paginator;
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

     private readonly trackByFunction = (index: number, item: BalanceChange) => {
          return item.hash;
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
          if (this.selectedWalletIndex < 0 || this.selectedWalletIndex >= this.wallets.length) {
               throw new Error('Selected wallet index out of range');
          }
          this.currentWallet = {
               ...this.wallets[this.selectedWalletIndex],
               balance: this.currentWallet.balance || '0',
          };

          console.log('isValidAddress result:', xrpl.isValidAddress(this.currentWallet.address));
          if (this.currentWallet.address && xrpl.isValidAddress(this.currentWallet.address)) {
               this.loadBalanceChanges(true);
          } else if (this.currentWallet.address) {
               this.setError('Invalid XRP address');
          }
     }

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

                    type EnvKey = keyof typeof AppConstants.XRPL_WIN_URL;
                    const env = this.xrplService.getNet().environment.toUpperCase() as EnvKey;
                    this.url = AppConstants.XRPL_WIN_URL[env] || AppConstants.XRPL_WIN_URL.DEVNET;

                    const [accountInfo, accountLines] = await Promise.all([this.xrplService.getAccountInfo(client, address, 'validated', ''), this.getCachedAccountLines(client, address)]);

                    this.currentBalance = xrpl.dropsToXrp(accountInfo.result.account_data.Balance);
                    this.currencyBalances.set('XRP', this.currentBalance);

                    for (const line of accountLines.result.lines) {
                         const key = `${line.currency}+${line.account}`;
                         this.currencyBalances.set(key, Number.parseFloat(line.balance));
                    }

                    const { ownerCount, totalXrpReserves } = await this.utilsService.updateOwnerCountAndReserves(client, accountInfo, address);
                    this.ownerCount = ownerCount.toString();
                    this.totalXrpReserves = totalXrpReserves;

                    const balance = (await client.getXrpBalance(address)) - Number.parseFloat(totalXrpReserves || '0');
                    this.currentWallet.balance = balance.toString();

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

               this.balanceChanges.push(...processedTx);
               this.balanceChangesDataSource.data = [...this.balanceChanges];

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
               console.debug(`txWrapper`, txWrapper);
               const tx = txWrapper.tx_json || txWrapper.transaction;
               console.log(`tx`, tx);
               const fee = xrpl.dropsToXrp(tx.Fee).toString();
               const meta = txWrapper.meta;
               const fees = tx.Fee;
               console.log(`Fee 2`, xrpl.dropsToXrp(fees));

               if (typeof meta !== 'object' || !meta.AffectedNodes) {
                    continue;
               }

               let type = tx.TransactionType;
               let counterparty = tx.Destination || tx.Account || 'N/A';

               if (tx.TransactionType === 'Payment') {
                    if (tx.Destination === address) {
                         type = 'Payment Received';
                    } else if (tx.Account === address) {
                         type = 'Payment Sent';
                    }
               }

               const changes: { fees: number; change: number; currency: string; balanceBefore: number; balanceAfter: number }[] = [];
               const date = new Date((tx.date + 946684800) * 1000);
               const hash = txWrapper.hash;

               for (const node of meta.AffectedNodes) {
                    const modified = node.ModifiedNode || node.CreatedNode || node.DeletedNode;
                    if (!modified) continue;

                    if (modified.LedgerEntryType === 'AccountRoot' && modified.FinalFields?.Account === address) {
                         const prevBalanceDrops = modified.PreviousFields?.Balance ?? modified.FinalFields.Balance;
                         const finalBalanceDrops = modified.FinalFields.Balance;

                         const prevXrp = xrpl.dropsToXrp(prevBalanceDrops);
                         const finalXrp = xrpl.dropsToXrp(finalBalanceDrops);
                         const delta = this.utilsService.roundToEightDecimals(finalXrp - prevXrp);

                         changes.push({
                              fees: xrpl.dropsToXrp(fees),
                              change: delta,
                              currency: 'XRP',
                              balanceBefore: this.utilsService.roundToEightDecimals(prevXrp),
                              balanceAfter: this.utilsService.roundToEightDecimals(finalXrp),
                         });
                    } else if (modified.LedgerEntryType === 'RippleState') {
                         let tokenChange = 0;
                         let tokenCurrency = '';
                         let tokenBalanceBefore = 0;
                         let tokenBalanceAfter = 0;
                         counterparty = modified.FinalFields?.HighLimit?.issuer || modified.FinalFields?.LowLimit?.issuer || counterparty;

                         if (node.DeletedNode) {
                              const balanceField = modified.FinalFields?.Balance;
                              if (balanceField) {
                                   tokenChange = this.utilsService.roundToEightDecimals(-Number.parseFloat(balanceField.value));
                                   tokenBalanceBefore = this.utilsService.roundToEightDecimals(Number.parseFloat(balanceField.value));
                                   tokenBalanceAfter = 0;
                                   const curr = balanceField.currency.length > 3 ? this.shortCurrencyDisplay(balanceField.currency) : balanceField.currency || '';
                                   tokenCurrency = curr;
                              }
                         } else if (modified.FinalFields?.Balance) {
                              const balanceField = modified.FinalFields.Balance;
                              const prevBalanceField = modified.PreviousFields?.Balance || { value: '0' };
                              tokenChange = this.utilsService.roundToEightDecimals(Number.parseFloat(balanceField.value) - Number.parseFloat(prevBalanceField.value));
                              tokenBalanceBefore = this.utilsService.roundToEightDecimals(Number.parseFloat(prevBalanceField.value));
                              tokenBalanceAfter = this.utilsService.roundToEightDecimals(Number.parseFloat(balanceField.value));
                              const curr = balanceField.currency.length > 3 ? this.shortCurrencyDisplay(balanceField.currency) : balanceField.currency || '';
                              tokenCurrency = curr;
                         } else if (modified.NewFields?.Balance) {
                              const balanceField = modified.NewFields.Balance;
                              tokenChange = this.utilsService.roundToEightDecimals(Number.parseFloat(balanceField.value));
                              tokenBalanceBefore = 0;
                              tokenBalanceAfter = this.utilsService.roundToEightDecimals(Number.parseFloat(balanceField.value));
                              const curr = balanceField.currency.length > 3 ? this.shortCurrencyDisplay(balanceField.currency) : balanceField.currency || '';
                              tokenCurrency = curr;
                         }

                         if (tokenCurrency && tokenChange !== 0) {
                              changes.push({
                                   fees: xrpl.dropsToXrp(fees),
                                   change: tokenChange,
                                   currency: tokenCurrency,
                                   balanceBefore: tokenBalanceBefore,
                                   balanceAfter: tokenBalanceAfter,
                              });
                         }
                    }
               }

               for (const changeItem of changes) {
                    processed.push({
                         date,
                         hash,
                         type,
                         fees: xrpl.dropsToXrp(fees),
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

          if (this.loadingMore) return;

          const viewportHeight = this.viewport.elementRef.nativeElement.clientHeight;
          const nearEnd = index >= this.balanceChangesDataSource.data.length - 5 || (this.balanceChangesDataSource.data.length === 0 && this.hasMoreData);

          if (nearEnd && this.hasMoreData) {
               console.log('Triggering load more on scroll');
               if (this.scrollDebounce) {
                    clearTimeout(this.scrollDebounce);
               }
               this.scrollDebounce = setTimeout(() => {
                    this.loadBalanceChanges(false);
               }, 100);
          }
     }

     shortCurrencyDisplay(code: string): string {
          return code.length > 3 ? `SHORT(${code.slice(0, 3)})` : code;
     }

     getTypeColor(type: string): string {
          switch (type) {
               case 'Payment Sent':
               case 'Payment Received':
                    return '#8BE684';

               case 'PermissionedDomainSet':
               case 'CredentialCreate':
               case 'CredentialAccept':
               case 'DepositPreauth':
               case 'EscrowFinish':
               case 'EscrowCreate':
               case 'EscrowCancel':
               case 'MPTokenIssuanceCreate':
                    return '#f0874bff';

               case 'TicketCreate':
               case 'Batch':
               case 'NFTokenCreateOffer':
               case 'TrustSet':
               case 'MPTokenAuthorize':
                    return '#79BDD8';

               case 'SignerListSet':
               case 'DIDSet':
               case 'AccountSet':
               case 'AccountDelete':
               case 'SetRegularKey':
               case 'MPTokenIssuanceDestroy':
                    return '#BAD47B';
               case 'NFTokenMint':
                    return '#ac7bd4ff';
               case 'CheckCancel':
               case 'CheckCash':
               case 'CheckCreate':
                    return '#9bc5a2ff';
               default:
                    return 'white'; // fallback color
          }
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
