import { fakeAsync, tick } from '@angular/core/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatTableDataSource } from '@angular/material/table';
import { AccountChangesComponent } from './account-changes.component';
import { XrplService } from '../../services/xrpl.service';
import * as xrpl from 'xrpl';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';
import { StorageService } from '../../services/storage.service';
import { UtilsService } from '../../services/utils.service';
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';
import { AppConstants } from '../../core/app.constants';

class FakeClient {
     async getXrpBalance(_address: string): Promise<number> {
          return 10;
     }
}

class FakeXrplService {
     public getClientCalls = 0;
     public getAccountInfoCalls = 0;
     public getAccountTransactionsCalls = 0;
     public getNetCalls = 0;

     environment = 'devnet' as 'devnet' | 'testnet' | 'mainnet';

     async getClient(): Promise<any> {
          this.getClientCalls++;
          return new FakeClient();
     }

     getNet(): any {
          this.getNetCalls++;
          return { environment: this.environment };
     }

     async getAccountInfo(_client: any, _address: string, _li: string, _arg: string): Promise<any> {
          this.getAccountInfoCalls++;
          return { result: { account_data: { Balance: '1000000' } } };
     }

     async getAccountTransactions(_client: any, _address: string, _limit: number, _marker?: any): Promise<any> {
          this.getAccountTransactionsCalls++;
          return { result: { transactions: [{ hash: 'tx1' }], marker: 'marker123' } };
     }
}

class FakeUtilsService {
     async updateOwnerCountAndReserves(_client: any, _accountInfo: any, _address: string): Promise<{ ownerCount: number; totalXrpReserves: string }> {
          return { ownerCount: 2, totalXrpReserves: '0.5' };
     }
}

class FakeChangeDetectorRef {
     public called = 0;
     detectChanges(): void {
          this.called++;
     }
}

describe('AccountChangesComponent', () => {
     let component: AccountChangesComponent;
     let fixture: ComponentFixture<AccountChangesComponent>;
     let xrplServiceMock: any;
     let utilsServiceMock: any;
     let storageServiceMock: any;
     let renderUiComponentsServiceMock: any;
     let xrplTransactionServiceMock: any;
     let mockXrpl: any;
     const validAddr = 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe';

     beforeEach(async () => {
          xrplServiceMock = {
               checkTicketExists: jasmine.createSpy('checkTicketExists'),
               getClient: jasmine.createSpy('getClient').and.resolveTo({}),
               getNet: jasmine.createSpy('getNet').and.returnValue({ environment: 'test' }),
               getAccountInfo: jasmine.createSpy('getAccountInfo').and.resolveTo({ result: { account_data: { Flags: 0, Sequence: 1 }, account_flags: {} } }),
               getAccountObjects: jasmine.createSpy('getAccountObjects').and.resolveTo({ result: { account_objects: [] } }),
               getAccountCurrencies: jasmine.createSpy('getAccountCurrencies').and.resolveTo({ result: { receive_currencies: [], send_currencies: [] } }),
               getAccountLines: jasmine.createSpy('getAccountLines').and.resolveTo({ result: { lines: [] } }),
               getXrplServerInfo: jasmine.createSpy('getXrplServerInfo').and.resolveTo({}),
               calculateTransactionFee: jasmine.createSpy('calculateTransactionFee').and.resolveTo('10'),
               getLastLedgerIndex: jasmine.createSpy('getLastLedgerIndex').and.resolveTo(123),
               getTokenBalance: jasmine.createSpy('getTokenBalance').and.resolveTo({ result: { assets: {}, obligations: {} } }),
          };
          utilsServiceMock = {
               clearSignerList: jasmine.createSpy('clearSignerList'),
               loadSignerList: jasmine.createSpy('loadSignerList'),
               setTicketSequence: jasmine.createSpy('setTicketSequence'),
               setDestinationTag: jasmine.createSpy('setDestinationTag'),
               setMemoField: jasmine.createSpy('setMemoField'),
               encodeIfNeeded: jasmine.createSpy('encodeIfNeeded').and.callFake((s: any) => s),
               decodeIfNeeded: jasmine.createSpy('decodeIfNeeded').and.callFake((s: any) => s),
               formatTokenBalance: jasmine.createSpy('formatTokenBalance').and.callFake((s: any) => s),
               formatCurrencyForDisplay: jasmine.createSpy('formatCurrencyForDisplay').and.callFake((s: any) => s),
               isInsufficientXrpBalance1: jasmine.createSpy('isInsufficientXrpBalance1').and.returnValue(false),
               isInsufficientIouTrustlineBalance: jasmine.createSpy('isInsufficientIouTrustlineBalance').and.returnValue(false),
               getRegularKeyWallet: jasmine.createSpy('getRegularKeyWallet').and.resolveTo({ useRegularKeyWalletSignTx: false, regularKeyWalletSignTx: undefined }),
               isTxSuccessful: jasmine.createSpy('isTxSuccessful').and.returnValue(true),
               getTransactionResultMessage: jasmine.createSpy('getTransactionResultMessage').and.returnValue('tesSUCCESS'),
               processErrorMessageFromLedger: jasmine.createSpy('processErrorMessageFromLedger').and.returnValue('Processed error'),
               roundToEightDecimals: jasmine.createSpy('roundToEightDecimals').and.callFake((n: number) => Math.round(n * 1e8) / 1e8),
          };
          storageServiceMock = { getKnownIssuers: jasmine.createSpy('getKnownIssuers').and.returnValue(null), removeValue: jasmine.createSpy('removeValue') };
          renderUiComponentsServiceMock = {
               renderSimulatedTransactionsResults: jasmine.createSpy('renderSimulatedTransactionsResults'),
               renderTransactionsResults: jasmine.createSpy('renderTransactionsResults'),
               attachSearchListener: jasmine.createSpy('attachSearchListener'),
               renderDetails: jasmine.createSpy('renderDetails'),
          };

          xrplTransactionServiceMock = {
               simulateTransaction: jasmine.createSpy('simulateTransaction').and.resolveTo({ result: {} }),
          };

          mockXrpl = {
               dropsToXrp: jasmine.createSpy('dropsToXrp').and.callFake((drops: any) => Number(drops) / 1_000_000),
               isValidAddress: jasmine.createSpy('isValidAddress').and.returnValue(true),
          };

          await TestBed.configureTestingModule({
               imports: [AccountChangesComponent],
               providers: [
                    { provide: XrplService, useValue: xrplServiceMock },
                    { provide: UtilsService, useValue: utilsServiceMock },
                    { provide: StorageService, useValue: storageServiceMock },
                    { provide: RenderUiComponentsService, useValue: renderUiComponentsServiceMock },
                    { provide: XrplTransactionService, useValue: xrplTransactionServiceMock },
                    { provide: 'xrpl', useValue: mockXrpl },
               ],
          })
               .overrideComponent(AccountChangesComponent, {
                    set: { template: '' },
               })
               .compileComponents();

          fixture = TestBed.createComponent(AccountChangesComponent);
          component = fixture.componentInstance;
     });

     it('should create', () => {
          expect(component).toBeTruthy();
     });

     it('should test timers', fakeAsync(() => {
          const callback = jasmine.createSpy('callback');
          setTimeout(callback, 1000);

          tick(1000); // simulate 1 second
          expect(callback).toHaveBeenCalled();
     }));

     describe('AccountChangesComponent loadBalanceChanges', () => {
          function createHarness() {
               const component: any = Object.create(AccountChangesComponent.prototype);
               component.xrplService = new FakeXrplService();
               component.utilsService = new FakeUtilsService();
               component.cdr = new FakeChangeDetectorRef();
               component.currentWallet = { address: 'rTEST', balance: '0' };
               component.balanceChanges = [];
               component.balanceChangesDataSource = new MatTableDataSource<any>([]);
               component.currencyBalances = new Map<string, any>();
               component.marker = undefined;
               component.hasMoreData = true;
               component.loadingMore = false;
               component.setFilterPredicateCalled = 0;
               component.setFilterPredicate = () => {
                    component.setFilterPredicateCalled++;
               };
               component.getCachedAccountLines = async (_client: any, _address: string) => ({
                    result: {
                         lines: [{ currency: 'USD', account: 'rISSUER', balance: '42.5' }],
                    },
               });
               component.processTransactionsForBalanceChanges = (txs: any[], _address: string) => txs.map((_t, i) => ({ processed: `p${i + 1}` }));
               component.setErrorMessage = '';
               component.setError = (msg: string) => {
                    component.setErrorMessage = msg;
               };
               return component;
          }

          it('shouldLoadInitialBalanceChangesAndUpdateState', async () => {
               const c = createHarness();
               (c.xrplService as FakeXrplService).environment = 'testnet';
               const expectedXrp = xrpl.dropsToXrp('1000000');

               await c.loadBalanceChanges(true);

               expect(c.url).toBe(AppConstants.XRPL_WIN_URL.TESTNET);
               expect(c.currentBalance).toBe(expectedXrp);
               expect(c.currencyBalances.get('XRP')).toBe(expectedXrp);
               expect(c.currencyBalances.get('USD+rISSUER')).toBe(42.5);
               expect(c.ownerCount).toBe('2');
               expect(c.totalXrpReserves).toBe('0.5');
               expect(c.currentWallet.balance).toBe((10 - 0.5).toString());
               expect(c.setFilterPredicateCalled).toBe(1);

               expect(Array.isArray(c.balanceChanges)).toBeTrue();
               expect(c.balanceChanges.length).toBe(1);
               expect(c.balanceChangesDataSource.data).toEqual(c.balanceChanges);

               expect(c.marker).toBe('marker123');
               expect(c.hasMoreData).toBeTrue();

               expect(c.loadingMore).toBeFalse();
               expect(c.cdr.called).toBeGreaterThan(0);
               expect(typeof c.executionTime).toBe('string');
          });

          it('shouldPaginateAndStopWhenNoMarker', async () => {
               const c = createHarness();
               c.balanceChanges = [{ processed: 'existing' }];
               c.balanceChangesDataSource = new MatTableDataSource<any>([...c.balanceChanges]);
               c.marker = 'prevMarker';
               c.hasMoreData = true;
               c.loadingMore = false;

               c.processTransactionsForBalanceChanges = (txs: any[]) => txs.map(() => ({ processed: 'next' }));
               (c.xrplService as FakeXrplService).getAccountTransactions = async () => ({
                    result: {
                         transactions: [{ hash: 'tx2' }],
                         marker: undefined,
                    },
               });

               await c.loadBalanceChanges(false);

               expect(c.balanceChanges.length).toBe(2);
               expect(c.balanceChanges[0]).toEqual({ processed: 'existing' });
               expect(c.balanceChanges[1]).toEqual({ processed: 'next' });
               expect(c.balanceChangesDataSource.data).toEqual(c.balanceChanges);
               expect(c.marker).toBeUndefined();
               expect(c.hasMoreData).toBeFalse();
               expect(c.loadingMore).toBeFalse();
          });

          it('shouldPopulateCurrencyBalancesFromAccountData', async () => {
               const c = createHarness();
               c.getCachedAccountLines = async () => ({
                    result: {
                         lines: [
                              { currency: 'USD', account: 'rISS1', balance: '12.34' },
                              { currency: 'EUR', account: 'rISS2', balance: '-7.89' },
                         ],
                    },
               });

               await c.loadBalanceChanges(true);

               const expectedXrp = xrpl.dropsToXrp('1000000');
               expect(c.currentBalance).toBe(expectedXrp);
               expect(c.currencyBalances.get('XRP')).toBe(expectedXrp);
               expect(c.currencyBalances.get('USD+rISS1')).toBe(12.34);
               expect(c.currencyBalances.get('EUR+rISS2')).toBe(-7.89);
          });

          it('shouldHandleErrorAndSetErrorState', async () => {
               const c = createHarness();
               c.hasMoreData = true;
               c.loadingMore = false;

               (c.xrplService as FakeXrplService).getAccountTransactions = async () => {
                    throw new Error('Network failure');
               };

               await c.loadBalanceChanges(false);

               expect(c.setErrorMessage).toBe('Failed to load balance changes');
               expect(c.loadingMore).toBeFalse();
               expect(c.cdr.called).toBeGreaterThan(0);
          });

          it('shouldReturnEarlyWhenAddressMissing', async () => {
               const c = createHarness();
               c.currentWallet = { address: '', balance: '0' };
               const svc = c.xrplService as FakeXrplService;

               c.balanceChanges = [{ processed: 'keep' }];
               c.balanceChangesDataSource = new MatTableDataSource<any>([...c.balanceChanges]);
               c.hasMoreData = false;
               c.marker = 'keepMarker';

               await c.loadBalanceChanges(true);

               expect(svc.getClientCalls).toBe(0);
               expect(svc.getAccountInfoCalls).toBe(0);
               expect(svc.getAccountTransactionsCalls).toBe(0);

               expect(c.balanceChanges).toEqual([{ processed: 'keep' }]);
               expect(c.balanceChangesDataSource.data).toEqual([{ processed: 'keep' }]);
               expect(c.hasMoreData).toBeFalse();
               expect(c.marker).toBe('keepMarker');
          });

          it('shouldStopPaginationOnEmptyTransactions', async () => {
               const c = createHarness();
               c.balanceChanges = [{ processed: 'existing' }];
               c.balanceChangesDataSource = new MatTableDataSource<any>([...c.balanceChanges]);
               c.marker = 'prevMarker';
               c.hasMoreData = true;
               c.loadingMore = false;

               (c.xrplService as FakeXrplService).getAccountTransactions = async () => ({
                    result: { transactions: [], marker: undefined },
               });

               await c.loadBalanceChanges(false);

               expect(c.hasMoreData).toBeFalse();
               expect(c.loadingMore).toBeFalse();
               expect(c.balanceChanges).toEqual([{ processed: 'existing' }]);
               expect(c.balanceChangesDataSource.data).toEqual([{ processed: 'existing' }]);
          });

          it('shouldReturnEarlyWhenAlreadyLoading', async () => {
               const c = createHarness();
               c.balanceChanges = [{ processed: 'existing' }];
               c.balanceChangesDataSource = new MatTableDataSource<any>([...c.balanceChanges]);
               c.marker = 'prevMarker';
               c.hasMoreData = true;
               c.loadingMore = true;

               const svc = c.xrplService as FakeXrplService;

               await c.loadBalanceChanges(false);

               expect(svc.getAccountInfoCalls).toBe(0);
               expect(svc.getAccountTransactionsCalls).toBe(0);
               expect(svc.getNetCalls).toBe(0);

               expect(c.balanceChanges).toEqual([{ processed: 'existing' }]);
               expect(c.balanceChangesDataSource.data).toEqual([{ processed: 'existing' }]);
               expect(c.marker).toBe('prevMarker');
               expect(c.hasMoreData).toBeTrue();

               expect(c.loadingMore).toBeFalse();
               expect(c.cdr.called).toBeGreaterThan(0);
               expect(typeof c.executionTime).toBe('string');
               expect(c.setFilterPredicateCalled).toBe(0);
               expect(c.setErrorMessage).toBe('');
          });

          it('shouldComputeNetBalanceAndOwnerMetricsOnReset', async () => {
               const component: any = Object.create(AccountChangesComponent.prototype);
               component.xrplService = {
                    environment: 'devnet' as 'devnet' | 'testnet' | 'mainnet',
                    async getClient(): Promise<any> {
                         return {
                              async getXrpBalance(_address: string): Promise<number> {
                                   return 100;
                              },
                         };
                    },
                    getNet(): any {
                         return { environment: this.environment };
                    },
                    async getAccountInfo(_client: any, _address: string, _li: string, _arg: string): Promise<any> {
                         return { result: { account_data: { Balance: '25000000' } } };
                    },
                    async getAccountTransactions(_client: any, _address: string, _limit: number, _marker?: any): Promise<any> {
                         return { result: { transactions: [], marker: undefined } };
                    },
               };
               component.utilsService = {
                    async updateOwnerCountAndReserves(_client: any, _accountInfo: any, _address: string): Promise<{ ownerCount: number; totalXrpReserves: string }> {
                         return { ownerCount: 7, totalXrpReserves: '2.5' };
                    },
                    roundToEightDecimals: (n: number) => Math.round(n * 1e8) / 1e8,
               };
               component.cdr = {
                    detectChanges(): void {},
               };
               component.currentWallet = { address: 'rTEST', balance: '0' };
               component.balanceChanges = [];
               component.balanceChangesDataSource = new MatTableDataSource<any>([]);
               component.currencyBalances = new Map<string, any>();
               component.marker = undefined;
               component.hasMoreData = true;
               component.loadingMore = false;
               component.setFilterPredicate = () => {};
               component.getCachedAccountLines = async (_client: any, _address: string) => ({
                    result: { lines: [] },
               });
               component.processTransactionsForBalanceChanges = (_txs: any[], _address: string) => [];
               component.setError = (_msg: string) => {};

               await component.loadBalanceChanges(true);

               expect(component.ownerCount).toBe('7');
               expect(component.totalXrpReserves).toBe('2.5');
               expect(component.currentWallet.balance).toBe('97.5');
          });
     });

     describe('AccountChangesComponent getCachedAccountLines', () => {
          const address = 'rTESTADDRESS';

          function createHarness(env: 'devnet' | 'testnet' | 'mainnet' = 'testnet') {
               const c: any = Object.create(AccountChangesComponent.prototype);
               c.xrplService = {
                    getNet: jasmine.createSpy('getNet').and.returnValue({ environment: env }),
               };
               c.accountLinesCache = new Map<string, any>();
               c.accountLinesCacheTime = new Map<string, number>();
               c.CACHE_EXPIRY = 1000;
               return c;
          }

          it('shouldReturnCachedAccountLinesWhenUnexpired', async () => {
               const c = createHarness('testnet');
               const now = 100000;
               spyOn(Date, 'now').and.returnValue(now);

               const client = { request: jasmine.createSpy('request') };
               const cacheKey = `${address}-testnet`;
               const cachedValue = { result: { lines: ['cached'] } };

               c.accountLinesCache.set(cacheKey, cachedValue);
               c.accountLinesCacheTime.set(cacheKey, now - (c.CACHE_EXPIRY - 10));

               const result = await (c as any).getCachedAccountLines(client, address);

               expect(result).toEqual(cachedValue);
               expect(client.request).not.toHaveBeenCalled();
          });

          it('shouldFetchAndCacheAccountLinesOnMiss', async () => {
               const c = createHarness('devnet');
               const now = 5000;
               spyOn(Date, 'now').and.returnValue(now);

               const fetched = { result: { lines: ['remote'] } };
               const client = { request: jasmine.createSpy('request').and.resolveTo(fetched) };

               const result = await (c as any).getCachedAccountLines(client, address);

               const cacheKey = `${address}-devnet`;
               expect(client.request).toHaveBeenCalledWith({ command: 'account_lines', account: address });
               expect(c.accountLinesCache.get(cacheKey)).toEqual(fetched);
               expect(c.accountLinesCacheTime.get(cacheKey)).toBe(now);
               expect(result).toEqual(fetched);
          });

          it('shouldIsolateCacheByEnvironmentInKey', async () => {
               const c = createHarness('testnet');
               const now = 1000;
               spyOn(Date, 'now').and.returnValue(now);

               const client = { request: jasmine.createSpy('request').and.resolveTo({ result: { lines: ['fetchedMainnet'] } }) };

               const tnKey = `${address}-testnet`;
               const tnCached = { result: { lines: ['cachedTestnet'] } };
               c.accountLinesCache.set(tnKey, tnCached);
               c.accountLinesCacheTime.set(tnKey, now);

               const r1 = await (c as any).getCachedAccountLines(client, address);
               expect(r1).toEqual(tnCached);
               expect(client.request).not.toHaveBeenCalled();

               (c.xrplService.getNet as jasmine.Spy).and.returnValue({ environment: 'mainnet' });
               const r2 = await (c as any).getCachedAccountLines(client, address);

               const mnKey = `${address}-mainnet`;
               expect(client.request).toHaveBeenCalledTimes(1);
               expect(c.accountLinesCache.has(tnKey)).toBeTrue();
               expect(c.accountLinesCache.has(mnKey)).toBeTrue();
               expect((c.accountLinesCache.get(mnKey) as any).result.lines).toEqual(['fetchedMainnet']);
               expect(r2.result.lines).toEqual(['fetchedMainnet']);
          });

          it('shouldRefetchWhenCacheExpired', async () => {
               const c = createHarness('testnet');
               const now = 1000;
               spyOn(Date, 'now').and.returnValue(now);

               const client = { request: jasmine.createSpy('request').and.resolveTo({ result: { lines: ['new'] } }) };

               const key = `${address}-testnet`;
               c.accountLinesCache.set(key, { result: { lines: ['old'] } });
               c.accountLinesCacheTime.set(key, now - c.CACHE_EXPIRY - 1);

               const result = await (c as any).getCachedAccountLines(client, address);

               expect(client.request).toHaveBeenCalledWith({ command: 'account_lines', account: address });
               expect(result.result.lines).toEqual(['new']);
               expect(c.accountLinesCache.get(key).result.lines).toEqual(['new']);
               expect(c.accountLinesCacheTime.get(key)).toBe(now);
          });

          it('shouldNotCacheOnRequestFailure', async () => {
               const c = createHarness('testnet');
               const now = 2000;
               spyOn(Date, 'now').and.returnValue(now);

               const error = new Error('Network error');
               const client = { request: jasmine.createSpy('request').and.callFake(() => Promise.reject(error)) };

               const key = `${address}-testnet`;
               await expectAsync((c as any).getCachedAccountLines(client, address)).toBeRejectedWithError('Network error');

               expect(c.accountLinesCache.has(key)).toBeFalse();
               expect(c.accountLinesCacheTime.has(key)).toBeFalse();
          });

          it('shouldFetchWhenCacheMetadataIncomplete', async () => {
               const c = createHarness('testnet');
               const now = 3000;
               spyOn(Date, 'now').and.returnValue(now);

               const client = { request: jasmine.createSpy('request').and.resolveTo({ result: { lines: ['fresh'] } }) };

               const key = `${address}-testnet`;
               c.accountLinesCache.set(key, { result: { lines: ['incomplete'] } });

               const result = await (c as any).getCachedAccountLines(client, address);

               expect(client.request).toHaveBeenCalledWith({ command: 'account_lines', account: address });
               expect(result.result.lines).toEqual(['fresh']);
               expect(c.accountLinesCache.get(key).result.lines).toEqual(['fresh']);
               expect(c.accountLinesCacheTime.get(key)).toBe(now);
          });
     });

     describe('AccountChangesComponent onAccountChange', () => {
          function createHarness() {
               const c: any = Object.create(AccountChangesComponent.prototype);
               c.wallets = [];
               c.selectedWalletIndex = 0;
               c.currentWallet = { balance: '' };
               c.setError = jasmine.createSpy('setError');
               c.loadBalanceChanges = jasmine.createSpy('loadBalanceChanges');
               return c;
          }

          // it('testOnAccountChangeLoadsBalanceForValidAddress', () => {
          //      const c = createHarness();
          //      c.wallets = [{ address: 'rVALIDADDRESS', balance: '100' }];
          //      c.selectedWalletIndex = 0;
          //      c.currentWallet = { balance: '50' };

          //      c.onAccountChange();

          //      expect(c.loadBalanceChanges).toHaveBeenCalledWith(true);
          //      expect(c.setError).not.toHaveBeenCalled();
          // });

          // it('testOnAccountChangePreservesExistingBalance', () => {
          //      const c = createHarness();
          //      c.wallets = [{ address: 'rVALID', balance: '999' }];
          //      c.selectedWalletIndex = 0;
          //      c.currentWallet = { balance: '55' };

          //      c.onAccountChange();

          //      expect(c.currentWallet.balance).toBe('55');
          //      expect(c.loadBalanceChanges).toHaveBeenCalledWith(true);
          // });

          // it('testOnAccountChangeDefaultsBalanceToZero', () => {
          //      const c = createHarness();
          //      c.wallets = [{ address: 'rVALID', balance: '200' }];
          //      c.selectedWalletIndex = 0;
          //      c.currentWallet = { balance: '' };

          //      c.onAccountChange();

          //      expect(c.currentWallet.balance).toBe('0');
          //      expect(c.loadBalanceChanges).toHaveBeenCalledWith(true);
          // });

          it('testOnAccountChangeReturnsEarlyWhenNoWallets', () => {
               const c = createHarness();
               c.wallets = [];
               c.currentWallet = { balance: '123', address: 'rANY' };

               c.onAccountChange();

               expect(c.currentWallet).toEqual({ balance: '123', address: 'rANY' });
               expect(c.loadBalanceChanges).not.toHaveBeenCalled();
               expect(c.setError).not.toHaveBeenCalled();
          });

          it('testOnAccountChangeSetsErrorForInvalidAddress', () => {
               const c = createHarness();
               c.wallets = [{ address: 'rINVALID', balance: '0' }];
               c.selectedWalletIndex = 0;
               c.currentWallet = { balance: '5' };

               mockXrpl.isValidAddress.and.returnValue(false);

               c.onAccountChange();

               expect(c.setError).toHaveBeenCalledWith('Invalid XRP address');
               expect(c.loadBalanceChanges).not.toHaveBeenCalled();
          });

          it('testOnAccountChangeThrowsWhenSelectedIndexOutOfRange', () => {
               const c = createHarness();
               c.wallets = [{ address: 'rONLY', balance: '10' }];
               c.selectedWalletIndex = 5;
               c.currentWallet = { balance: '1' };

               expect(() => c.onAccountChange()).toThrowError('Selected wallet index out of range');
          });
     });

     describe('AccountChangesComponent onScroll', () => {
          function createHarness() {
               const c: any = Object.create(AccountChangesComponent.prototype);
               c.viewport = {
                    elementRef: {
                         nativeElement: {
                              clientHeight: 240,
                         },
                    },
               };
               c.balanceChangesDataSource = { data: new Array(10).fill({}) };
               c.hasMoreData = true;
               c.loadingMore = false;
               c.scrollDebounce = undefined;
               c.loadBalanceChanges = jasmine.createSpy('loadBalanceChanges');
               return c;
          }

          beforeEach(() => {
               spyOn(console, 'warn');
               spyOn(console, 'debug');
               spyOn(console, 'log');
               spyOn(window, 'setTimeout').and.callThrough();
               spyOn(window, 'clearTimeout').and.callThrough();
          });

          afterEach(() => {});

          // it('shouldTriggerLoadOnEndWithMoreData', fakeAsync(() => {
          //      const c = createHarness();
          //      c.onScroll(5);

          //      expect(window.setTimeout).toHaveBeenCalled();
          //      expect(c.loadBalanceChanges).not.toHaveBeenCalled();

          //      tick(100);

          //      expect(c.loadBalanceChanges).toHaveBeenCalledWith(false);
          //      expect(console.log).toHaveBeenCalled();
          // }));

          // it('shouldDebounceRapidScrollEventsAndInvokeOnce', fakeAsync(() => {
          //      // Spy on the actual setTimeout/clearTimeout that will be used
          //      const setTimeoutSpy = spyOn(window, 'setTimeout').and.callThrough();
          //      const clearTimeoutSpy = spyOn(window, 'clearTimeout').and.callThrough();

          //      const c = createHarness();

          //      c.onScroll(2);
          //      tick(50);
          //      c.onScroll(3);
          //      tick(30);
          //      c.onScroll(5);

          //      expect(setTimeoutSpy).toHaveBeenCalledTimes(3);
          //      expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
          //      expect(c.loadBalanceChanges).not.toHaveBeenCalled();

          //      tick(100);

          //      expect(c.loadBalanceChanges).toHaveBeenCalledTimes(1);
          //      expect(c.loadBalanceChanges).toHaveBeenCalledWith(false);
          // }));

          it('shouldNotTriggerLoadWhenNotNearEnd', fakeAsync(() => {
               const c = createHarness();
               c.balanceChangesDataSource = { data: new Array(100).fill({}) };
               c.onScroll(20);

               tick(100);

               expect(c.loadBalanceChanges).not.toHaveBeenCalled();
          }));

          // it('shouldWarnAndReturnWhenViewportMissing', () => {
          //      const c = createHarness();
          //      c.viewport = undefined;

          //      c.onScroll(0);

          //      expect(console.warn).toHaveBeenCalledWith('onScroll: Viewport not initialized');
          //      expect(window.setTimeout).not.toHaveBeenCalled();
          //      expect(window.clearTimeout).not.toHaveBeenCalled();
          //      expect(c.loadBalanceChanges).not.toHaveBeenCalled();
          // });

          // it('shouldNotTriggerWhileAlreadyLoadingMore', fakeAsync(() => {
          //      const c = createHarness();
          //      c.loadingMore = true;

          //      c.onScroll(7);

          //      tick(100);

          //      expect(window.setTimeout).toHaveBeenCalledTimes(1);
          //      expect(c.loadBalanceChanges).not.toHaveBeenCalled();
          // }));

          it('shouldTriggerLoadWhenDataSourceEmptyAndMoreData', fakeAsync(() => {
               const c = createHarness();
               c.balanceChangesDataSource = { data: [] };
               c.viewport.elementRef.nativeElement.clientHeight = 48;

               c.onScroll(0);

               tick(100);

               expect(c.loadBalanceChanges).toHaveBeenCalledWith(false);
          }));
     });

     describe('AccountChangesComponent processTransactionsForBalanceChanges', () => {
          const address = 'rTESTADDRESS';

          function createHarness() {
               const c: any = Object.create(AccountChangesComponent.prototype);
               c.utilsService = {
                    roundToEightDecimals: jasmine.createSpy('roundToEightDecimals').and.callFake((n: number) => Math.round(n * 1e8) / 1e8),
               };
               c.shortCurrencyDisplay = jasmine.createSpy('shortCurrencyDisplay').and.callFake((code: string) => `SHORT(${code.slice(0, 3)})`);
               return c;
          }

          beforeEach(() => {
               spyOn(console, 'log');
          });

          it('shouldComputeXrpDeltaAndClassifyPaymentDirection', () => {
               const c = createHarness();

               const txs = [
                    {
                         tx_json: {
                              TransactionType: 'Payment',
                              Account: 'rSENDER1',
                              Destination: address,
                              date: 1,
                         },
                         meta: {
                              AffectedNodes: [
                                   {
                                        ModifiedNode: {
                                             LedgerEntryType: 'AccountRoot',
                                             FinalFields: { Account: address, Balance: '1500000' },
                                             PreviousFields: { Balance: '1000000' },
                                        },
                                   },
                              ],
                         },
                         hash: 'h1',
                    },
                    {
                         tx_json: {
                              TransactionType: 'Payment',
                              Account: address,
                              Destination: 'rRECEIVER2',
                              date: 2,
                         },
                         meta: {
                              AffectedNodes: [
                                   {
                                        ModifiedNode: {
                                             LedgerEntryType: 'AccountRoot',
                                             FinalFields: { Account: address, Balance: '1800000' },
                                             PreviousFields: { Balance: '2000000' },
                                        },
                                   },
                              ],
                         },
                         hash: 'h2',
                    },
               ];

               const result = (c as any).processTransactionsForBalanceChanges(txs, address);

               expect(result.length).toBe(2);

               const expectedDate1 = new Date((1 + 946684800) * 1000);
               const expectedDate2 = new Date((2 + 946684800) * 1000);

               expect(result[0].type).toBe('Payment Received');
               expect(result[0].currency).toBe('XRP');
               expect(result[0].change).toBeCloseTo(0.5, 8);
               expect(result[0].balanceBefore).toBeCloseTo(1, 8);
               expect(result[0].balanceAfter).toBeCloseTo(1.5, 8);
               expect(result[0].hash).toBe('h1');
               expect(result[0].date.getTime()).toBe(expectedDate1.getTime());

               expect(result[1].type).toBe('Payment Sent');
               expect(result[1].currency).toBe('XRP');
               expect(result[1].change).toBeCloseTo(-0.2, 8);
               expect(result[1].balanceBefore).toBeCloseTo(2, 8);
               expect(result[1].balanceAfter).toBeCloseTo(1.8, 8);
               expect(result[1].hash).toBe('h2');
               expect(result[1].date.getTime()).toBe(expectedDate2.getTime());
          });

          it('shouldComputeTokenDeltaWithIssuerCounterpartyAndShortCurrency', () => {
               const c = createHarness();
               (c.shortCurrencyDisplay as jasmine.Spy).and.returnValue('TOKEN');

               const txs = [
                    {
                         tx_json: {
                              TransactionType: 'TrustSet',
                              Account: 'rANY',
                              Destination: 'rANY2',
                              date: 10,
                         },
                         meta: {
                              AffectedNodes: [
                                   {
                                        ModifiedNode: {
                                             LedgerEntryType: 'RippleState',
                                             FinalFields: {
                                                  Balance: { value: '10', currency: '0123456789ABCDEF' },
                                                  HighLimit: { issuer: 'rISSUER' },
                                             },
                                             PreviousFields: {
                                                  Balance: { value: '7' },
                                             },
                                        },
                                   },
                              ],
                         },
                         hash: 'hTOK',
                    },
               ];

               const result = (c as any).processTransactionsForBalanceChanges(txs, address);

               expect(result.length).toBe(1);
               const bc = result[0];

               expect(bc.type).toBe('TrustSet');
               expect(bc.currency).toBe('TOKEN');
               expect(bc.change).toBeCloseTo(3, 8);
               expect(bc.balanceBefore).toBeCloseTo(7, 8);
               expect(bc.balanceAfter).toBeCloseTo(10, 8);
               expect(bc.counterparty).toBe('rISSUER');

               const expectedDate = new Date((10 + 946684800) * 1000);
               expect(bc.date.getTime()).toBe(expectedDate.getTime());
               expect(bc.hash).toBe('hTOK');
          });

          it('shouldAggregateMultipleBalanceChangesFromSingleTransaction', () => {
               const c = createHarness();

               const tx = {
                    tx_json: {
                         TransactionType: 'Payment',
                         Account: 'rSENDER',
                         Destination: address,
                         date: 3,
                    },
                    meta: {
                         AffectedNodes: [
                              {
                                   ModifiedNode: {
                                        LedgerEntryType: 'AccountRoot',
                                        FinalFields: { Account: address, Balance: '1100000' },
                                        PreviousFields: { Balance: '1000000' },
                                   },
                              },
                              {
                                   ModifiedNode: {
                                        LedgerEntryType: 'RippleState',
                                        FinalFields: {
                                             Balance: { value: '50', currency: 'USD' },
                                             HighLimit: { issuer: 'rISS1' },
                                        },
                                        PreviousFields: {
                                             Balance: { value: '49' },
                                        },
                                   },
                              },
                              {
                                   CreatedNode: {
                                        LedgerEntryType: 'RippleState',
                                        NewFields: {
                                             Balance: { value: '5', currency: 'EUR' },
                                             HighLimit: { issuer: 'rISS2' },
                                        },
                                   },
                              },
                         ],
                    },
                    hash: 'hMULTI',
               };

               const result = (c as any).processTransactionsForBalanceChanges([tx], address);

               expect(result.length).toBe(3);

               const expectedDate = new Date((3 + 946684800) * 1000);
               for (const r of result) {
                    expect(r.hash).toBe('hMULTI');
                    expect(r.date.getTime()).toBe(expectedDate.getTime());
                    expect(r.type).toBe('Payment Received');
               }

               const xrp = result.find((r: { currency: string }) => r.currency === 'XRP')!;
               expect(xrp.change).toBeCloseTo(0.1, 8);
               expect(xrp.balanceBefore).toBeCloseTo(1, 8);
               expect(xrp.balanceAfter).toBeCloseTo(1.1, 8);

               const usd = result.find((r: { currency: string }) => r.currency === 'USD')!;
               expect(usd.change).toBeCloseTo(1, 8);
               expect(usd.balanceBefore).toBeCloseTo(49, 8);
               expect(usd.balanceAfter).toBeCloseTo(50, 8);

               const eur = result.find((r: { currency: string }) => r.currency === 'EUR')!;
               expect(eur.change).toBeCloseTo(5, 8);
               expect(eur.balanceBefore).toBeCloseTo(0, 8);
               expect(eur.balanceAfter).toBeCloseTo(5, 8);
          });

          it('shouldSkipTransactionsWithMissingOrInvalidMeta', () => {
               const c = createHarness();

               const txs = [
                    { tx_json: { TransactionType: 'Payment', Account: 'rA', Destination: 'rB', date: 1 }, meta: undefined, hash: 'hA' },
                    { tx_json: { TransactionType: 'Payment', Account: 'rA', Destination: 'rB', date: 1 }, meta: 'not-an-object' as any, hash: 'hB' },
                    { tx_json: { TransactionType: 'Payment', Account: 'rA', Destination: 'rB', date: 1 }, meta: {}, hash: 'hC' },
               ];

               const result = (c as any).processTransactionsForBalanceChanges(txs, address);
               expect(result.length).toBe(0);
          });

          it('shouldHandleDeletedTrustlineAsNegativeTokenChange', () => {
               const c = createHarness();
               (c.shortCurrencyDisplay as jasmine.Spy).and.returnValue('TOK');

               const txs = [
                    {
                         tx_json: { TransactionType: 'TrustSet', Account: 'rA', date: 4 },
                         meta: {
                              AffectedNodes: [
                                   {
                                        DeletedNode: {
                                             LedgerEntryType: 'RippleState',
                                             FinalFields: {
                                                  Balance: { value: '5', currency: '012345' },
                                                  HighLimit: { issuer: 'rISSUER' },
                                             },
                                        },
                                   },
                              ],
                         },
                         hash: 'hDEL',
                    },
               ];

               const result = (c as any).processTransactionsForBalanceChanges(txs, address);

               expect(result.length).toBe(1);
               const bc = result[0];

               expect(bc.type).toBe('TrustSet');
               expect(bc.currency).toBe('TOK');
               expect(bc.change).toBeCloseTo(-5, 8);
               expect(bc.balanceBefore).toBeCloseTo(5, 8);
               expect(bc.balanceAfter).toBeCloseTo(0, 8);
               expect(bc.counterparty).toBe('rISSUER');

               const expectedDate = new Date((4 + 946684800) * 1000);
               expect(bc.date.getTime()).toBe(expectedDate.getTime());
               expect(bc.hash).toBe('hDEL');
          });

          it('shouldReflectRippleStateIssuerAsCounterpartyForAllEmittedChanges', () => {
               const c = createHarness();
               (c.shortCurrencyDisplay as jasmine.Spy).and.returnValue('IOU');

               const txs = [
                    {
                         tx_json: { TransactionType: 'Payment', Account: 'rS', Destination: address, date: 5 },
                         meta: {
                              AffectedNodes: [
                                   {
                                        ModifiedNode: {
                                             LedgerEntryType: 'AccountRoot',
                                             FinalFields: { Account: address, Balance: '1200000' },
                                             PreviousFields: { Balance: '1000000' },
                                        },
                                   },
                                   {
                                        ModifiedNode: {
                                             LedgerEntryType: 'RippleState',
                                             FinalFields: {
                                                  Balance: { value: '2', currency: 'LONG' },
                                                  HighLimit: { issuer: 'rISS' },
                                             },
                                             PreviousFields: {
                                                  Balance: { value: '1' },
                                             },
                                        },
                                   },
                              ],
                         },
                         hash: 'hCP',
                    },
               ];

               const result = (c as any).processTransactionsForBalanceChanges(txs, address);

               expect(result.length).toBe(2);
               for (const r of result) {
                    expect(r.counterparty).toBe('rISS');
               }

               const xrp = result.find((r: { currency: string }) => r.currency === 'XRP')!;
               expect(xrp.change).toBeCloseTo(0.2, 8);

               const iou = result.find((r: { currency: string }) => r.currency === 'IOU')!;
               expect(iou.change).toBeCloseTo(1, 8);
          });
     });
});
