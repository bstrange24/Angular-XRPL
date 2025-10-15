import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TrustlinesComponent } from './trustlines.component';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { StorageService } from '../../services/storage.service';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';

fdescribe('TrustlinesComponent', () => {
     let component: TrustlinesComponent;
     let fixture: ComponentFixture<TrustlinesComponent>;
     let xrplServiceMock: any;
     let utilsServiceMock: any;
     let storageServiceMock: any;
     let renderUiComponentsServiceMock: any;
     let xrplTransactionServiceMock: any;
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

          await TestBed.configureTestingModule({
               imports: [TrustlinesComponent],
               providers: [
                    { provide: XrplService, useValue: xrplServiceMock },
                    { provide: UtilsService, useValue: utilsServiceMock },
                    { provide: StorageService, useValue: storageServiceMock },
                    { provide: RenderUiComponentsService, useValue: renderUiComponentsServiceMock },
                    { provide: XrplTransactionService, useValue: xrplTransactionServiceMock },
               ],
          })
               .overrideComponent(TrustlinesComponent, {
                    set: { template: '' },
               })
               .compileComponents();

          fixture = TestBed.createComponent(TrustlinesComponent);
          component = fixture.componentInstance;
          // Avoid detectChanges to skip ngOnInit and template rendering
     });

     it('should create', () => {
          expect(component).toBeTruthy();
     });

     it('should update wallets with the provided list', () => {
          spyOn(component as any, 'updateDestinations').and.stub();
          spyOn(component as any, 'onAccountChange').and.stub();

          const newWallets = [
               { name: 'Wallet A', address: 'rABC', seed: 's1' },
               { name: 'Wallet B', address: 'rDEF', seed: 's2' },
          ];

          component.onWalletListChange(newWallets as any[]);

          expect(component.wallets).toEqual(newWallets as any[]);
     });

     it('should reset selectedWalletIndex to 0 if out of range for non-empty list', () => {
          spyOn(component as any, 'updateDestinations').and.stub();
          spyOn(component as any, 'onAccountChange').and.stub();

          component.selectedWalletIndex = 5; // out of range for the new list below
          const newWallets = [
               { name: 'Wallet A', address: 'rABC', seed: 's1' },
               { name: 'Wallet B', address: 'rDEF', seed: 's2' },
          ];

          component.onWalletListChange(newWallets as any[]);

          expect(component.selectedWalletIndex).toBe(0);
     });

     it('should not change selectedWalletIndex if it is within range for non-empty list', () => {
          spyOn(component as any, 'updateDestinations').and.stub();
          spyOn(component as any, 'onAccountChange').and.stub();

          component.selectedWalletIndex = 1; // valid for list of length 3
          const newWallets = [
               { name: 'Wallet A', address: 'rABC', seed: 's1' },
               { name: 'Wallet B', address: 'rDEF', seed: 's2' },
               { name: 'Wallet C', address: 'rGHI', seed: 's3' },
          ];

          component.onWalletListChange(newWallets as any[]);

          expect(component.selectedWalletIndex).toBe(1);
     });

     it('should not reset selectedWalletIndex when wallets array is empty', () => {
          spyOn(component as any, 'updateDestinations').and.stub();
          spyOn(component as any, 'onAccountChange').and.stub();

          component.selectedWalletIndex = 3; // remains unchanged for empty list

          component.onWalletListChange([]);

          expect(component.selectedWalletIndex).toBe(3);
     });

     it('should call updateDestinations and onAccountChange on wallet list change', () => {
          const updateDestinationsSpy = spyOn(component as any, 'updateDestinations').and.stub();
          const onAccountChangeSpy = spyOn(component as any, 'onAccountChange').and.stub();

          const newWallets = [{ name: 'Wallet A', address: 'rABC', seed: 's1' }];

          component.onWalletListChange(newWallets as any[]);

          expect(updateDestinationsSpy).toHaveBeenCalledTimes(1);
          expect(onAccountChangeSpy).toHaveBeenCalledTimes(1);
     });

     it('validateQuorum should clamp signerQuorum to total weight', () => {
          component.signers = [
               { account: 'a', seed: 's', weight: 2 },
               { account: 'b', seed: 't', weight: 3 },
          ];
          component.signerQuorum = 10;
          const markSpy = spyOn((component as any).cdr, 'markForCheck').and.stub();

          component.validateQuorum();

          expect(component.signerQuorum).toBe(5);
          expect(markSpy).toHaveBeenCalled();
     });

     it('toggleMultiSign should clear signers when disabling multi-sign', async () => {
          component.useMultiSign = false;
          const markSpy = spyOn((component as any).cdr, 'markForCheck').and.stub();

          await component.toggleMultiSign();

          expect(utilsServiceMock.clearSignerList).toHaveBeenCalledWith(component.signers);
          expect(markSpy).toHaveBeenCalled();
     });

     it('toggleMultiSign should load signers when enabling multi-sign', async () => {
          component.useMultiSign = true;
          spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
          const markSpy = spyOn((component as any).cdr, 'markForCheck').and.stub();

          await component.toggleMultiSign();

          expect(utilsServiceMock.loadSignerList).toHaveBeenCalledWith(validAddr, component.signers);
          expect(markSpy).toHaveBeenCalled();
     });

     it('toggleUseMultiSign should clear seeds when no multi-sign address configured and mark for check', async () => {
          component.multiSignAddress = 'No Multi-Sign address configured for account';
          component.multiSignSeeds = 'some-seeds';
          const markSpy = spyOn((component as any).cdr, 'markForCheck').and.stub();

          await component.toggleUseMultiSign();

          expect(component.multiSignSeeds).toBe('');
          expect(markSpy).toHaveBeenCalled();
     });

     it('toggleTicketSequence should mark for check', () => {
          const markSpy = spyOn((component as any).cdr, 'markForCheck').and.stub();

          component.toggleTicketSequence();

          expect(markSpy).toHaveBeenCalled();
     });

     it('onTicketToggle should add and remove tickets', () => {
          component.selectedTickets = [];

          component.onTicketToggle({ target: { checked: true } }, '101');
          expect(component.selectedTickets).toEqual(['101']);

          component.onTicketToggle({ target: { checked: false } }, '101');
          expect(component.selectedTickets).toEqual([]);
     });

     it('onFlagChange should unset conflicting flags (tfSetNoRipple vs tfClearNoRipple)', () => {
          component.trustlineFlags['tfSetNoRipple'] = true;
          component.trustlineFlags['tfClearNoRipple'] = true;

          component.onFlagChange('tfSetNoRipple');

          expect(component.trustlineFlags['tfSetNoRipple']).toBeTrue();
          expect(component.trustlineFlags['tfClearNoRipple']).toBeFalse();
     });

     it('handleTransactionResult should update state and mark for check', () => {
          const markSpy = spyOn((component as any).cdr, 'markForCheck').and.stub();
          component.isEditable = true;

          component.handleTransactionResult({ result: 'RESULT', isError: false, isSuccess: true });

          expect(component.result).toBe('RESULT');
          expect(component.isError).toBeFalse();
          expect(component.isSuccess).toBeTrue();
          expect(component.isEditable).toBeFalse();
          expect(markSpy).toHaveBeenCalled();
     });

     it('ngAfterViewChecked should attach search listener when result changes', () => {
          (component as any).resultField = { nativeElement: document.createElement('div') };
          component['result'] = 'A';
          (component as any)['lastResult'] = '';

          component.ngAfterViewChecked();

          expect(renderUiComponentsServiceMock.attachSearchListener).toHaveBeenCalled();
          expect((component as any)['lastResult']).toBe('A');
     });

     it('renderTransactionResult should call simulated renderer when isSimulateEnabled is true', () => {
          component.isSimulateEnabled = true;
          (component as any).resultField = { nativeElement: document.createElement('div') };

          (component as any).renderTransactionResult({});

          expect(renderUiComponentsServiceMock.renderSimulatedTransactionsResults).toHaveBeenCalled();
          expect(renderUiComponentsServiceMock.renderTransactionsResults).not.toHaveBeenCalled();
     });

     it('renderTransactionResult should call normal renderer when isSimulateEnabled is false', () => {
          component.isSimulateEnabled = false;
          (component as any).resultField = { nativeElement: document.createElement('div') };

          (component as any).renderTransactionResult({ result: {} });

          expect(renderUiComponentsServiceMock.renderTransactionsResults).toHaveBeenCalled();
     });

     it('setTxOptionalFields should set ticket sequence for selectedSingleTicket when ticket exists', async () => {
          const tx: any = {};
          const wallet: any = { classicAddress: validAddr };
          const accountInfo: any = { result: { account_data: { Sequence: 1 } } };
          component.selectedSingleTicket = '12345';
          xrplServiceMock.checkTicketExists.and.resolveTo(true);

          await (component as any).setTxOptionalFields({}, tx, wallet, accountInfo);

          expect(xrplServiceMock.checkTicketExists).toHaveBeenCalledWith(jasmine.any(Object), validAddr, 12345);
          expect(utilsServiceMock.setTicketSequence).toHaveBeenCalledWith(tx, '12345', true);
     });

     it('setTxOptionalFields should throw if selectedSingleTicket does not exist', async () => {
          const tx: any = {};
          const wallet: any = { classicAddress: validAddr };
          const accountInfo: any = { result: { account_data: { Sequence: 1 } } };
          component.selectedSingleTicket = '54321';
          xrplServiceMock.checkTicketExists.and.resolveTo(false);

          await expectAsync((component as any).setTxOptionalFields({}, tx, wallet, accountInfo)).toBeRejected();
     });

     it('setTxOptionalFields should set sequence when multiSelectMode is enabled and tickets selected', async () => {
          const tx: any = {};
          const wallet: any = { classicAddress: validAddr };
          const accountInfo: any = { result: { account_data: { Sequence: 100 } } };
          component.selectedSingleTicket = '';
          component.multiSelectMode = true;
          component.selectedTickets = ['11', '22'];

          await (component as any).setTxOptionalFields({}, tx, wallet, accountInfo);

          expect(utilsServiceMock.setTicketSequence).toHaveBeenCalledWith(tx, 100, false);
     });

     it('setTxOptionalFields should set destination tag and memo when provided', async () => {
          const tx: any = {};
          const wallet: any = { classicAddress: validAddr };
          const accountInfo: any = { result: { account_data: { Sequence: 1 } } };
          component.selectedSingleTicket = '';
          component.multiSelectMode = false;
          component.destinationTagField = '123';
          component.memoField = 'memo-text';

          await (component as any).setTxOptionalFields({}, tx, wallet, accountInfo);

          expect(utilsServiceMock.setDestinationTag).toHaveBeenCalledWith(tx, '123');
          expect(utilsServiceMock.setMemoField).toHaveBeenCalledWith(tx, 'memo-text');
     });

     it('refreshUIData should route to refreshUiAccountObjects and refreshUiAccountInfo', () => {
          const refreshObjectsSpy = spyOn(component as any, 'refreshUiAccountObjects').and.stub();
          const refreshInfoSpy = spyOn(component as any, 'refreshUiAccountInfo').and.stub();

          (component as any).refreshUIData({ classicAddress: validAddr }, { result: {} }, { result: { account_objects: [] } });

          expect(refreshObjectsSpy).toHaveBeenCalled();
          expect(refreshInfoSpy).toHaveBeenCalled();
     });

     it('checkForSignerAccounts should extract accounts and set quorum', () => {
          const accountObjects: any = {
               result: {
                    account_objects: [
                         {
                              LedgerEntryType: 'SignerList',
                              SignerQuorum: 3,
                              SignerEntries: [{ SignerEntry: { Account: 'rA', SignerWeight: 2 } }, { SignerEntry: { Account: 'rB', SignerWeight: 1 } }],
                         },
                    ],
               },
          };

          const res = (component as any).checkForSignerAccounts(accountObjects);

          expect(res).toEqual(['rA~2', 'rB~1']);
          expect(component.signerQuorum).toBe(3);
     });

     it('getAccountTickets should return ticket sequences', () => {
          const accountObjects: any = {
               result: {
                    account_objects: [{ LedgerEntryType: 'Ticket', TicketSequence: 10 }, { LedgerEntryType: 'NotTicket' }, { LedgerEntryType: 'Ticket', TicketSequence: 20 }],
               },
          };

          const res = (component as any).getAccountTickets(accountObjects);

          expect(res).toEqual(['10', '20']);
     });

     it('cleanUpSingleSelection should reset selectedSingleTicket if ticket no longer exists', () => {
          (component as any).ticketArray = ['5', '7'];
          component.selectedSingleTicket = '15';

          (component as any).cleanUpSingleSelection();

          expect(component.selectedSingleTicket).toBe('');
     });

     it('onAccountChange should do nothing when wallets are empty', async () => {
          component.wallets = [];
          const c1 = spyOn(component, 'onCurrencyChange');
          const c2 = spyOn(component, 'getTrustlinesForAccount');

          await component.onAccountChange();

          expect(c1).not.toHaveBeenCalled();
          expect(c2).not.toHaveBeenCalled();
     });

     it('onAccountChange should call currency/trustline updates for valid address', async () => {
          component.wallets = [{ name: 'W', address: validAddr, seed: 's', balance: '' }];
          component.selectedWalletIndex = 0;
          const c1 = spyOn(component, 'onCurrencyChange').and.resolveTo();
          const c2 = spyOn(component, 'getTrustlinesForAccount').and.resolveTo();

          await component.onAccountChange();

          expect(c1).toHaveBeenCalled();
          expect(c2).toHaveBeenCalled();
     });

     it('onAccountChange should set error for invalid address', async () => {
          component.wallets = [{ name: 'W', address: 'invalid-address', seed: 's', balance: '' }];
          component.selectedWalletIndex = 0;
          const setErrorSpy = spyOn(component as any, 'setError').and.stub();

          await component.onAccountChange();

          expect(setErrorSpy).toHaveBeenCalledWith('Invalid XRP address');
     });

     it('ngOnInit should load known issuers and call updateCurrencies', () => {
          storageServiceMock.getKnownIssuers.and.returnValue({ USD: validAddr });
          const updateCurrenciesSpy = spyOn(component as any, 'updateCurrencies').and.stub();

          component.ngOnInit();

          expect((component as any)['knownTrustLinesIssuers']).toEqual({ USD: validAddr });
          expect(updateCurrenciesSpy).toHaveBeenCalled();
     });

     it('ngAfterViewChecked should not attach listener when result does not change', () => {
          (component as any).resultField = { nativeElement: document.createElement('div') };
          (component as any)['lastResult'] = 'X';
          component['result'] = 'X';

          component.ngAfterViewChecked();

          expect(renderUiComponentsServiceMock.attachSearchListener).not.toHaveBeenCalled();
          expect((component as any)['lastResult']).toBe('X');
     });

     it('toggleMultiSign should call setError on wallet error and mark for check', async () => {
          component.useMultiSign = true;
          spyOn(component as any, 'getWallet').and.throwError('fail');
          const setErrorSpy = spyOn(component as any, 'setError').and.stub();
          const markSpy = spyOn((component as any).cdr, 'markForCheck').and.stub();

          await component.toggleMultiSign();

          expect(setErrorSpy).toHaveBeenCalledWith('ERROR getting wallet in toggleMultiSign');
          expect(utilsServiceMock.loadSignerList).not.toHaveBeenCalled();
          expect(markSpy).toHaveBeenCalled();
     });

     it('toggleUseMultiSign should keep seeds when multi-sign address configured', async () => {
          component.multiSignAddress = 'some-address';
          component.multiSignSeeds = 'abc';
          const markSpy = spyOn((component as any).cdr, 'markForCheck').and.stub();

          await component.toggleUseMultiSign();

          expect(component.multiSignSeeds).toBe('abc');
          expect(markSpy).toHaveBeenCalled();
     });

     it('setTxOptionalFields should not set sequence/tag/memo when not applicable', async () => {
          const tx: any = {};
          const wallet: any = { classicAddress: validAddr };
          const accountInfo: any = { result: { account_data: { Sequence: 100 } } };
          component.selectedSingleTicket = '';
          component.multiSelectMode = true;
          component.selectedTickets = [];
          component.destinationTagField = '0';
          component.memoField = '';

          await (component as any).setTxOptionalFields({}, tx, wallet, accountInfo);

          expect(utilsServiceMock.setTicketSequence).not.toHaveBeenCalled();
          expect(utilsServiceMock.setDestinationTag).not.toHaveBeenCalled();
          expect(utilsServiceMock.setMemoField).not.toHaveBeenCalled();
     });

     it('onAccountChange should call updateDestinations when wallets exist', async () => {
          component.wallets = [{ name: 'W', address: validAddr, seed: 's', balance: '' }];
          component.selectedWalletIndex = 0;
          const upd = spyOn(component as any, 'updateDestinations').and.stub();
          spyOn(component, 'onCurrencyChange').and.resolveTo();
          spyOn(component, 'getTrustlinesForAccount').and.resolveTo();

          await component.onAccountChange();

          expect(upd).toHaveBeenCalled();
     });

     it('onFlagChange should unset tfClearFreeze when tfSetFreeze enabled', () => {
          component.trustlineFlags['tfSetFreeze'] = true;
          component.trustlineFlags['tfClearFreeze'] = true;

          component.onFlagChange('tfSetFreeze');

          expect(component.trustlineFlags['tfSetFreeze']).toBeTrue();
          expect(component.trustlineFlags['tfClearFreeze']).toBeFalse();
     });

     it('onCurrencyChange should compute gatewayBalance and issuers, and call helpers', async () => {
          component.currencyField = 'USD';
          component.wallets = [{ name: 'Issuer', address: validAddr, isIssuer: true }];
          spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
          spyOn(component as any, 'ensureDefaultNotSelected').and.stub();
          spyOn(component as any, 'updateCurrencyBalance').and.resolveTo();

          xrplServiceMock.getTokenBalance.and.resolveTo({
               result: {
                    assets: {
                         [validAddr]: [
                              { currency: 'USD', value: '10' },
                              { currency: 'XXX', value: '1' },
                         ],
                         rOther: [{ currency: 'USD', value: '5' }],
                    },
                    obligations: { USD: '1000' },
               },
          });

          await component.onCurrencyChange();

          expect(component.gatewayBalance).toBe('15');
          expect(component.issuers.length).toBeGreaterThan(0);
          expect(component.issuerFields).toBe(validAddr);
          expect((component as any).ensureDefaultNotSelected).toHaveBeenCalled();
          expect((component as any).updateCurrencyBalance).toHaveBeenCalled();
     });

     it('onCurrencyChange should set error and zero balances on failure', async () => {
          const setErrorSpy = spyOn(component as any, 'setError').and.stub();
          xrplServiceMock.getClient.and.throwError('client error');

          await component.onCurrencyChange();

          expect(component.currencyBalanceField).toBe('0');
          expect(component.gatewayBalance).toBe('0');
          expect(setErrorSpy).toHaveBeenCalled();
     });

     it('getTrustlinesForAccount should setError on validation failure', async () => {
          (component as any).resultField = { nativeElement: document.createElement('div') };
          spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
          (component as any).currencyField = 'USD';
          spyOn(component as any, 'validateInputs').and.resolveTo(['e1']);
          const setErrorSpy = spyOn(component as any, 'setError').and.stub();

          await component.getTrustlinesForAccount();

          expect(setErrorSpy).toHaveBeenCalled();
          expect(renderUiComponentsServiceMock.renderDetails).not.toHaveBeenCalled();
     });

     it('getTrustlinesForAccount should render no active trustlines and clear gatewayBalance', async () => {
          (component as any).resultField = { nativeElement: document.createElement('div') };
          spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
          (component as any).currencyField = 'USD';
          spyOn(component as any, 'validateInputs').and.resolveTo([]);
          component.spinner = true;

          await component.getTrustlinesForAccount();

          expect(renderUiComponentsServiceMock.renderDetails).toHaveBeenCalled();
          expect(component.gatewayBalance).toBe('');
          expect(component.spinner).toBeFalse();
     });

     it('setTrustLine should setError on validation failure', async () => {
          (component as any).resultField = { nativeElement: document.createElement('div') };
          spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
          spyOn(component as any, 'validateInputs').and.resolveTo(['e']);
          const setErrorSpy = spyOn(component as any, 'setError').and.stub();

          await component.setTrustLine();

          expect(setErrorSpy).toHaveBeenCalled();
     });

     it('setTrustLine should setError on conflicting flags', async () => {
          (component as any).resultField = { nativeElement: document.createElement('div') };
          spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
          spyOn(component as any, 'validateInputs').and.resolveTo([]);
          component.trustlineFlags['tfSetNoRipple'] = true;
          component.trustlineFlags['tfClearNoRipple'] = true;
          const setErrorSpy = spyOn(component as any, 'setError').and.stub();

          await component.setTrustLine();

          expect(setErrorSpy).toHaveBeenCalledWith('ERROR: Cannot set both tfSetNoRipple and tfClearNoRipple');
     });

     it('setTrustLine should setError on invalid currency code', async () => {
          (component as any).resultField = { nativeElement: document.createElement('div') };
          spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
          spyOn(component as any, 'validateInputs').and.resolveTo([]);
          component.currencyField = '***';
          const setErrorSpy = spyOn(component as any, 'setError').and.stub();

          await component.setTrustLine();

          expect(setErrorSpy).toHaveBeenCalled();
     });

     it('setTrustLine should setError on insufficient XRP balance', async () => {
          (component as any).resultField = { nativeElement: document.createElement('div') };
          spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
          spyOn(component as any, 'validateInputs').and.resolveTo([]);
          utilsServiceMock.isInsufficientXrpBalance1.and.returnValue(true);
          const setErrorSpy = spyOn(component as any, 'setError').and.stub();

          await component.setTrustLine();

          expect(setErrorSpy).toHaveBeenCalledWith('ERROR: Insufficient XRP to complete transaction');
     });

     it('setTrustLine should simulate when isSimulateEnabled', async () => {
          component.isSimulateEnabled = true;
          spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
          spyOn(component as any, 'validateInputs').and.resolveTo([]);
          const renderSpy = spyOn<any>(component, 'renderTransactionResult').and.stub();

          await component.setTrustLine();

          expect(xrplTransactionServiceMock.simulateTransaction).toHaveBeenCalled();
          expect(renderSpy).toHaveBeenCalled();
     });

     it('removeTrustline should setError on validation failure', async () => {
          spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
          spyOn(component as any, 'validateInputs').and.resolveTo(['e']);
          const setErrorSpy = spyOn(component as any, 'setError').and.stub();

          await component.removeTrustline();

          expect(setErrorSpy).toHaveBeenCalled();
     });

     it('issueCurrency should simulate AccountSet when DefaultRipple disabled', async () => {
          (component as any).resultField = { nativeElement: { innerHTML: '', classList: { add: jasmine.createSpy('add') } } };
          component.isSimulateEnabled = true;
          spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
          spyOn(component as any, 'validateInputs').and.resolveTo([]);
          xrplServiceMock.getAccountInfo.and.resolveTo({ result: { account_data: { Flags: 0 } } });

          await component.issueCurrency();

          expect(xrplTransactionServiceMock.simulateTransaction).toHaveBeenCalled();
     });

     it('clawbackTokens should setError on validation failure', async () => {
          (component as any).resultField = { nativeElement: document.createElement('div') };
          spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
          spyOn(component as any, 'validateInputs').and.resolveTo(['e']);
          const setErrorSpy = spyOn(component as any, 'setError').and.stub();

          await component.clawbackTokens();

          expect(setErrorSpy).toHaveBeenCalled();
     });

     it('clawbackTokens should setError on invalid currency code', async () => {
          (component as any).resultField = { nativeElement: document.createElement('div') };
          spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
          spyOn(component as any, 'validateInputs').and.resolveTo([]);
          component.currencyField = '***';
          const setErrorSpy = spyOn(component as any, 'setError').and.stub();

          await component.clawbackTokens();

          expect(setErrorSpy).toHaveBeenCalled();
     });

     it('clawbackTokens should simulate when isSimulateEnabled', async () => {
          component.isSimulateEnabled = true;
          spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
          spyOn(component as any, 'validateInputs').and.resolveTo([]);
          const renderSpy = spyOn<any>(component, 'renderTransactionResult').and.stub();

          await component.clawbackTokens();

          expect(xrplTransactionServiceMock.simulateTransaction).toHaveBeenCalled();
          expect(renderSpy).toHaveBeenCalled();
     });

     it('cleanUpSingleSelection should keep selection if ticket still exists', () => {
          (component as any).ticketArray = ['5', '7'];
          component.selectedSingleTicket = '7';

          (component as any).cleanUpSingleSelection();

          expect(component.selectedSingleTicket).toBe('7');
     });
});
