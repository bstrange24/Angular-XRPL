import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SignTransactionsComponent } from './sign-transactions.component';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { StorageService } from '../../services/storage.service';
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';
import { SignTransactionUtilService } from '../../services/sign-transactions-util/sign-transaction-util.service';

// Mock xrpl module
const xrplMock = {
     isValidAddress: jasmine.createSpy('isValidAddress').and.returnValue(true),
     convertStringToHex: jasmine.createSpy('convertStringToHex').and.callFake(str => Buffer.from(str).toString('hex').toUpperCase()),
     xrpToDrops: jasmine.createSpy('xrpToDrops').and.callFake(amount => (parseFloat(amount) * 1000000).toString()),
     encode: jasmine.createSpy('encode').and.returnValue('mockEncodedTx'),
     decode: jasmine.createSpy('decode').and.returnValue({ TransactionType: 'Payment' }),
     hashes: {
          hashTx: jasmine.createSpy('hashTx').and.returnValue('mockHash'),
     },
};

fdescribe('SignTransactionsComponent', () => {
     let component: SignTransactionsComponent;
     let fixture: ComponentFixture<SignTransactionsComponent>;
     let xrplServiceMock: any;
     let utilsServiceMock: any;
     let storageServiceMock: any;
     let xrplTransactionServiceMock: any;
     let renderUiComponentsServiceMock: any;
     let signTransactionUtilServiceMock: any;
     const validAddr = 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe';

     beforeEach(async () => {
          xrplServiceMock = {
               getClient: jasmine.createSpy('getClient').and.resolveTo({
                    getLedgerIndex: jasmine.createSpy('getLedgerIndex').and.resolveTo(1000),
                    submitAndWait: jasmine.createSpy('submitAndWait').and.resolveTo({ result: { meta: { TransactionResult: 'tesSUCCESS' } } }),
                    getXrpBalance: jasmine.createSpy('getXrpBalance').and.resolveTo(1000),
               }),
               getAccountInfo: jasmine.createSpy('getAccountInfo').and.resolveTo({ result: { account_data: { Account: validAddr, RegularKey: null }, account_flags: { disableMasterKey: false } } }),
               getAccountObjects: jasmine.createSpy('getAccountObjects').and.resolveTo({ result: { account_objects: [] } }),
               getNet: jasmine.createSpy('getNet').and.returnValue({ environment: 'testnet' }),
          };

          utilsServiceMock = {
               validateInput: jasmine.createSpy('validateInput').and.returnValue(true),
               isTxSuccessful: jasmine.createSpy('isTxSuccessful').and.returnValue(true),
               getTransactionResultMessage: jasmine.createSpy('getTransactionResultMessage').and.returnValue('tesSUCCESS'),
               processErrorMessageFromLedger: jasmine.createSpy('processErrorMessageFromLedger').and.returnValue('Success'),
               getWallet: jasmine.createSpy('getWallet').and.resolveTo({
                    classicAddress: validAddr,
                    sign: jasmine.createSpy('sign').and.returnValue({
                         tx_blob: '12000024000000016140000000000003E868400000000000000A732102F0A4B2C3D4E5F67890ABCDEF1234567890ABCDEF1234567890ABCDEF12345674473045022100ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF12345678902200FEDCBA9876543210FEDCBA9876543210FEDCBA9876543210FEDCBA987654321',
                         hash: 'mockHash',
                    }),
               }),
               clearSignerList: jasmine.createSpy('clearSignerList'),
               loadSignerList: jasmine.createSpy('loadSignerList'),
               detectXrpInputType: jasmine.createSpy('detectXrpInputType').and.returnValue({ value: 'seed' }),
               updateOwnerCountAndReserves: jasmine.createSpy('updateOwnerCountAndReserves').and.returnValue({ ownerCount: '0', totalXrpReserves: '10' }),
               getMultiSignAddress: jasmine.createSpy('getMultiSignAddress').and.returnValue(['rSigner1', 'rSigner2']),
               getMultiSignSeeds: jasmine.createSpy('getMultiSignSeeds').and.returnValue(['seed1', 'seed2']),
               isValidSecret: jasmine.createSpy('isValidSecret').and.returnValue(true),
          };

          storageServiceMock = {
               get: jasmine.createSpy('get').and.returnValue(null),
               removeValue: jasmine.createSpy('removeValue'),
          };

          xrplTransactionServiceMock = {
               simulateTransaction: jasmine.createSpy('simulateTransaction').and.resolveTo({ result: { meta: { TransactionResult: 'tesSUCCESS' } } }),
          };

          renderUiComponentsServiceMock = {
               renderTransactionsResults: jasmine.createSpy('renderTransactionsResults'),
               renderSimulatedTransactionsResults: jasmine.createSpy('renderSimulatedTransactionsResults'),
          };

          signTransactionUtilServiceMock = {
               createSendXrpRequestText: jasmine.createSpy('createSendXrpRequestText').and.resolveTo('{"TransactionType": "Payment"}'),
               modifyTrustlineRequestText: jasmine.createSpy('modifyTrustlineRequestText').and.resolveTo('{"TransactionType": "TrustSet"}'),
               modifyAccountFlagsRequestText: jasmine.createSpy('modifyAccountFlagsRequestText').and.resolveTo('{"TransactionType": "AccountSet"}'),
               createTimeEscrowRequestText: jasmine.createSpy('createTimeEscrowRequestText').and.resolveTo('{"TransactionType": "EscrowCreate"}'),
               finshEscrowRequestText: jasmine.createSpy('finshEscrowRequestText').and.resolveTo('{"TransactionType": "EscrowFinish"}'),
               createEscrowRequestText: jasmine.createSpy('createEscrowRequestText').and.resolveTo('{"TransactionType": "EscrowCreate"}'),
               createCheckRequestText: jasmine.createSpy('createCheckRequestText').and.resolveTo('{"TransactionType": "CheckCreate"}'),
               cashCheckRequestText: jasmine.createSpy('cashCheckRequestText').and.resolveTo('{"TransactionType": "CheckCash"}'),
               cancelCheckRequestText: jasmine.createSpy('cancelCheckRequestText').and.resolveTo('{"TransactionType": "CheckCancel"}'),
          };

          await TestBed.configureTestingModule({
               imports: [SignTransactionsComponent],
               providers: [
                    { provide: XrplService, useValue: xrplServiceMock },
                    { provide: UtilsService, useValue: utilsServiceMock },
                    { provide: StorageService, useValue: storageServiceMock },
                    { provide: XrplTransactionService, useValue: xrplTransactionServiceMock },
                    { provide: RenderUiComponentsService, useValue: renderUiComponentsServiceMock },
                    { provide: SignTransactionUtilService, useValue: signTransactionUtilServiceMock },
                    // Provide the mocked xrpl module
                    { provide: 'xrpl', useValue: xrplMock },
               ],
          })
               .overrideComponent(SignTransactionsComponent, {
                    set: { template: '' },
               })
               .compileComponents();

          fixture = TestBed.createComponent(SignTransactionsComponent);
          component = fixture.componentInstance;
          // Mock ViewChild elements
          component.resultField = { nativeElement: { textContent: '', innerText: '', classList: { add: jasmine.createSpy('add') } } } as any;
          component.resultFieldError = { nativeElement: { textContent: '' } } as any;
          component.hashField = { nativeElement: { innerText: '' } } as any;
          component.accountForm = { value: {} } as any;
          // Avoid detectChanges to skip ngOnInit
     });

     it('should create', () => {
          expect(component).toBeTruthy();
     });

     it('should initialize with sendXrp options in ngOnInit', () => {
          spyOn(component, 'enableTransaction').and.stub();
          component.ngOnInit();
          expect(component.showSendXrpOptions).toBeTrue();
          expect(component.selectedTransaction).toBe('sendXrp');
          expect(component.enableTransaction).toHaveBeenCalled();
     });

     it('should update wallets with the provided list', () => {
          spyOn(component as any, 'updateDestinations').and.stub();
          spyOn(component as any, 'onAccountChange').and.stub();
          const newWallets = [
               { name: 'Wallet A', address: validAddr, seed: 's1', balance: '100' },
               { name: 'Wallet B', address: 'rDEF', seed: 's2', balance: '200' },
          ];
          component.onWalletListChange(newWallets);
          expect(component.wallets).toEqual(newWallets);
     });

     it('should reset selectedWalletIndex to 0 if out of range', () => {
          spyOn(component as any, 'updateDestinations').and.stub();
          spyOn(component as any, 'onAccountChange').and.stub();
          component.selectedWalletIndex = 5;
          const newWallets = [{ name: 'Wallet A', address: validAddr, seed: 's1', balance: '100' }];
          component.onWalletListChange(newWallets);
          expect(component.selectedWalletIndex).toBe(0);
     });

     it('should not reset selectedWalletIndex if within range', () => {
          spyOn(component as any, 'updateDestinations').and.stub();
          spyOn(component as any, 'onAccountChange').and.stub();
          component.selectedWalletIndex = 1;
          const newWallets = [
               { name: 'Wallet A', address: validAddr, seed: 's1', balance: '100' },
               { name: 'Wallet B', address: 'rDEF', seed: 's2', balance: '200' },
          ];
          component.onWalletListChange(newWallets);
          expect(component.selectedWalletIndex).toBe(1);
     });

     it('should not reset selectedWalletIndex for empty wallet list', () => {
          spyOn(component as any, 'updateDestinations').and.stub();
          spyOn(component as any, 'onAccountChange').and.stub();
          component.selectedWalletIndex = 3;
          component.onWalletListChange([]);
          expect(component.selectedWalletIndex).toBe(3);
     });

     it('should call updateDestinations and onAccountChange on wallet list change', () => {
          const updateDestinationsSpy = spyOn(component as any, 'updateDestinations').and.stub();
          const onAccountChangeSpy = spyOn(component as any, 'onAccountChange').and.stub();
          const newWallets = [{ name: 'Wallet A', address: validAddr, seed: 's1', balance: '100' }];
          component.onWalletListChange(newWallets);
          expect(updateDestinationsSpy).toHaveBeenCalledTimes(1);
          expect(onAccountChangeSpy).toHaveBeenCalledTimes(1);
     });

     it('validateQuorum should clamp signerQuorum to total weight', () => {
          component.signers = [
               { account: 'a', seed: 's', weight: 2 },
               { account: 'b', seed: 't', weight: 3 },
          ];
          component.signerQuorum = 10;
          const markSpy = spyOn(component['cdr'] as any, 'markForCheck').and.stub();
          component.validateQuorum();
          expect(component.signerQuorum).toBe(5);
          expect(markSpy).toHaveBeenCalled();
     });

     it('toggleMultiSign should clear signers when disabling multi-sign', async () => {
          component.useMultiSign = false;
          const markSpy = spyOn(component['cdr'] as any, 'markForCheck').and.stub();
          await component.toggleMultiSign();
          expect(utilsServiceMock.clearSignerList).toHaveBeenCalledWith(component.signers);
          expect(markSpy).toHaveBeenCalled();
     });

     it('toggleMultiSign should load signers when enabling multi-sign', async () => {
          component.useMultiSign = true;
          spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
          const markSpy = spyOn(component['cdr'] as any, 'markForCheck').and.stub();
          await component.toggleMultiSign();
          expect(utilsServiceMock.loadSignerList).toHaveBeenCalledWith(validAddr, component.signers);
          expect(markSpy).toHaveBeenCalled();
     });

     it('toggleMultiSign should set error on wallet failure', async () => {
          component.useMultiSign = true;
          spyOn(component as any, 'getWallet').and.rejectWith(new Error('Wallet error'));
          const setErrorSpy = spyOn(component as any, 'setError').and.stub();
          const markSpy = spyOn(component['cdr'] as any, 'markForCheck').and.stub();
          await component.toggleMultiSign();
          expect(setErrorSpy).toHaveBeenCalledWith('ERROR getting wallet in toggleMultiSign', null);
          expect(markSpy).toHaveBeenCalled();
     });

     it('toggleUseMultiSign should clear seeds when no multi-sign address configured', async () => {
          component.multiSignAddress = 'No Multi-Sign address configured for account';
          component.multiSignSeeds = 'some-seeds';
          const markSpy = spyOn(component['cdr'] as any, 'markForCheck').and.stub();
          await component.toggleUseMultiSign();
          expect(component.multiSignSeeds).toBe('');
          expect(markSpy).toHaveBeenCalled();
     });

     it('toggleUseMultiSign should keep seeds when multi-sign address configured', async () => {
          component.multiSignAddress = validAddr;
          component.multiSignSeeds = 'some-seeds';
          const markSpy = spyOn(component['cdr'] as any, 'markForCheck').and.stub();
          await component.toggleUseMultiSign();
          expect(component.multiSignSeeds).toBe('some-seeds');
          expect(markSpy).toHaveBeenCalled();
     });

     it('toggleTicketSequence should call enableTransaction and mark for check', () => {
          component.isTicketEnabled = false;
          spyOn(component, 'enableTransaction').and.stub();
          const markSpy = spyOn(component['cdr'] as any, 'markForCheck').and.stub();
          component.toggleTicketSequence();
          expect(component.enableTransaction).toHaveBeenCalled();
          expect(markSpy).toHaveBeenCalled();
     });

     it('onTicketToggle should add and remove tickets', () => {
          component.selectedTickets = [];
          component.onTicketToggle({ target: { checked: true } } as any, '101');
          expect(component.selectedTickets).toEqual(['101']);
          component.onTicketToggle({ target: { checked: false } } as any, '101');
          expect(component.selectedTickets).toEqual([]);
     });

     it('handleTransactionResult should update state and mark for check', () => {
          const markSpy = spyOn(component['cdr'] as any, 'markForCheck').and.stub();
          component.isEditable = true;
          component.handleTransactionResult({ result: 'RESULT', isError: false, isSuccess: true }, null);
          expect(component.txJson).toBe('RESULT');
          expect(component.isError).toBeFalse();
          expect(component.isSuccess).toBeTrue();
          expect(component.isEditable).toBeFalse();
          expect(markSpy).toHaveBeenCalled();
     });

     it('handleTransactionResult should set error and keep txJson on error', () => {
          const markSpy = spyOn(component['cdr'] as any, 'markForCheck').and.stub();
          component.txJson = 'ORIGINAL_JSON';
          component.handleTransactionResult({ result: 'ERROR_MESSAGE', isError: true, isSuccess: false }, null);
          expect(component.errorMessage).toBe('ERROR_MESSAGE');
          expect(component.txJson).toBe('ORIGINAL_JSON');
          expect(component.isError).toBeTrue();
          expect(component.isSuccess).toBeFalse();
          expect(markSpy).toHaveBeenCalled();
     });

     it('onAccountChange should do nothing when wallets are empty', async () => {
          component.wallets = [];
          const getAccountDetailsSpy = spyOn(component, 'getAccountDetails').and.stub();
          await component.onAccountChange();
          expect(getAccountDetailsSpy).not.toHaveBeenCalled();
     });

     it('onAccountChange should call getAccountDetails for valid address', async () => {
          xrplMock.isValidAddress.and.returnValue(true);
          component.wallets = [{ name: 'W', address: validAddr, seed: 's', balance: '100' }];
          component.selectedWalletIndex = 0;

          const getAccountDetailsSpy = spyOn(component, 'getAccountDetails').and.callThrough();
          const updateDestinationsSpy = spyOn(component as any, 'updateDestinations').and.stub();

          xrplServiceMock.getAccountInfo.and.resolveTo({
               result: {
                    account_data: { Account: validAddr, RegularKey: null, Balance: '100000000' },
                    account_flags: { disableMasterKey: false },
               },
          });

          await component.onAccountChange(); // <-- await here
          await Promise.resolve(); // flush microtasks
          await new Promise(r => setTimeout(r, 10)); // flush the setTimeout(0)

          expect(component.currentWallet).toEqual({ name: 'W', address: validAddr, seed: 's', balance: '990' }); // -10 for the reserve
          expect(updateDestinationsSpy).toHaveBeenCalled();
          expect(getAccountDetailsSpy).toHaveBeenCalled();
     });

     it('onAccountChange should set error for invalid address', async () => {
          xrplMock.isValidAddress.and.returnValue(false);
          component.wallets = [{ name: 'W', address: 'invalid-address', seed: 's', balance: '100' }];
          component.selectedWalletIndex = 0;
          const setErrorSpy = spyOn(component as any, 'setError').and.stub();
          await component.onAccountChange();
          expect(setErrorSpy).toHaveBeenCalledWith('Invalid XRP address', null);
     });

     it('setTransaction should set transaction and reset fields when checked', () => {
          spyOn(component, 'enableTransaction').and.stub();
          const event = { target: { checked: true } } as any;
          component.setTransaction('sendXrp', event);
          expect(component.selectedTransaction).toBe('sendXrp');
          expect(component.showSendXrpOptions).toBeTrue();
          expect(component.txJson).toBe('');
          expect(component.outputField).toBe('');
          expect(component.isError).toBeFalse();
          expect(component.errorMessage).toBeNull();
          expect(component.enableTransaction).toHaveBeenCalled();
     });

     it('setTransaction should clear transaction when unchecked', () => {
          const event = { target: { checked: false } } as any;
          component.setTransaction('sendXrp', event);
          expect(component.selectedTransaction).toBeNull();
          expect(component.txJson).toBe('');
          expect(component.isError).toBeFalse();
          expect(component.errorMessage).toBeNull();
     });

     it('enableTransaction should set txJson for sendXrp', async () => {
          component.selectedTransaction = 'sendXrp';
          component.currentWallet = { address: validAddr, seed: 's1', balance: '100', name: '' };
          await component.enableTransaction();
          expect(signTransactionUtilServiceMock.createSendXrpRequestText).toHaveBeenCalled();
          expect(component.txJson).toBe('{"TransactionType": "Payment"}');
     });

     it('enableTransaction should log warning for unknown transaction type', async () => {
          spyOn(console, 'warn');
          component.selectedTransaction = 'unknown';
          component.currentWallet = { address: validAddr, seed: 's1', balance: '100', name: '' };
          await component.enableTransaction();
          expect(console.warn).toHaveBeenCalledWith('Unknown transaction type: unknown');
     });

     it('signedTransaction should sign transaction and update outputField', async () => {
          component.txJson = '{"TransactionType": "Payment", "Amount": "1000000"}';
          component.currentWallet = { address: validAddr, seed: 's1', balance: '100', name: '' };
          spyOn(component as any, 'setSuccessProperties').and.stub();
          spyOn(component as any, 'setError').and.stub();
          await component.signedTransaction();
          expect(xrplServiceMock.getClient).toHaveBeenCalled();
          expect(utilsServiceMock.getWallet).toHaveBeenCalled();
          expect(component.outputField).toBe('12000024000000016140000000000003E868400000000000000A732102F0A4B2C3D4E5F67890ABCDEF1234567890ABCDEF1234567890ABCDEF12345674473045022100ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF12345678902200FEDCBA9876543210FEDCBA9876543210FEDCBA9876543210FEDCBA987654321');
          expect((component as any).setSuccessProperties).toHaveBeenCalled();
     });

     it('signedTransaction should set error for empty txJson', async () => {
          component.txJson = '';
          const setErrorSpy = spyOn(component as any, 'setError').and.stub();
          await component.signedTransaction();
          expect(setErrorSpy).toHaveBeenCalledWith('Transaction cannot be empty', null);
     });

     it('submitTransaction should submit transaction and render result', async () => {
          jasmine.clock().install();
          component.outputField = '12000024000000016140000000000003E868400000000000000A732102F0A4B2C3D4E5F67890ABCDEF1234567890ABCDEF1234567890ABCDEF12345674473045022100ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF12345678902200FEDCBA9876543210FEDCBA9876543210FEDCBA9876543210FEDCBA987654321';
          component.txJson = '{"TransactionType": "Payment"}';
          component.currentWallet = { address: validAddr, seed: 's1', balance: '100', name: '' };
          spyOn(component as any, 'setSuccessProperties').and.stub();
          spyOn(component as any, 'renderTransactionResult').and.stub();
          spyOn(component as any, 'refreshUIData').and.stub();
          spyOn(component as any, 'updateXrpBalance').and.stub();
          await component.submitTransaction();
          expect(xrplServiceMock.getClient).toHaveBeenCalled();
          expect((await xrplServiceMock.getClient()).submitAndWait).toHaveBeenCalledWith(component.outputField);
          expect((component as any).renderTransactionResult).toHaveBeenCalled();
          expect((component as any).setSuccessProperties).toHaveBeenCalled();
          expect((component as any).refreshUIData).toHaveBeenCalled();
          jasmine.clock().tick(0);
          expect((component as any).updateXrpBalance).toHaveBeenCalled();
          jasmine.clock().uninstall();
     });

     it('submitTransaction should simulate when isSimulateEnabled', async () => {
          component.isSimulateEnabled = true;
          component.outputField = '12000024000000016140000000000003E868400000000000000A732102F0A4B2C3D4E5F67890ABCDEF1234567890ABCDEF1234567890ABCDEF12345674473045022100ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF12345678902200FEDCBA9876543210FEDCBA9876543210FEDCBA9876543210FEDCBA987654321';
          component.txJson = '{"TransactionType": "Payment"}';
          component.currentWallet = { address: validAddr, seed: 's1', balance: '100', name: '' };
          spyOn(component as any, 'renderTransactionResult').and.stub();
          await component.submitTransaction();
          expect(xrplTransactionServiceMock.simulateTransaction).toHaveBeenCalled();
          expect((component as any).renderTransactionResult).toHaveBeenCalled();
     });

     it('cleanTx should remove default fields and convert amount', () => {
          const inputJson = {
               TransactionType: 'Payment',
               DestinationTag: 0,
               SourceTag: 0,
               InvoiceID: '',
               Amount: '1.5',
               Memos: [{ Memo: { MemoData: '', MemoType: '' } }],
          };
          const result = component.cleanTx(inputJson);
          expect(result).toEqual({
               TransactionType: 'Payment',
               Amount: '1500000',
          });
     });

     it('cleanTx should encode memos correctly', () => {
          const inputJson = {
               TransactionType: 'Payment',
               Memos: [{ Memo: { MemoData: 'test', MemoType: 'type' } }],
          };
          const result = component.cleanTx(inputJson);
          expect(result.Memos[0].Memo.MemoData).toBe('74657374'); // 'test' in hex
          expect(result.Memos[0].Memo.MemoType).toBe('74797065'); // 'type' in hex
     });

     it('validateInputs should return no errors for valid sendXrp inputs', async () => {
          const inputs = {
               seed: 'seed1',
               amount: '10',
               destination: validAddr,
               senderAddress: 'rTest1',
               account_info: { result: { account_flags: { disableMasterKey: false } } },
          };
          const errors = await (component as any).validateInputs(inputs, 'sendXrp');
          expect(errors).toEqual([]);
     });

     it('validateInputs should return errors for invalid sendXrp inputs', async () => {
          xrplMock.isValidAddress.and.returnValue(false);
          const inputs = {
               seed: '',
               amount: '0',
               destination: 'invalid',
               senderAddress: 'rTest1',
               account_info: { result: { account_flags: { disableMasterKey: false } } },
          };
          const errors = await (component as any).validateInputs(inputs, 'sendXrp');
          // expect(errors).toContain('Account seed is invalid');
          expect(errors).toContain('XRP Amount must be greater than 0');
          expect(errors).toContain('Destination is invalid');
     });

     it('toggleGroup should toggle group and reset fields', () => {
          const event = { target: { checked: true } } as any;
          component.toggleGroup('showSendXrpOptions', event);
          expect(component.showSendXrpOptions).toBeTrue();
          expect(component.showTrustlineOptions).toBeFalse();
          expect(component.selectedTransaction).toBe('');
          expect(component.txJson).toBe('');
          expect(component.outputField).toBe('');
          expect(component.isError).toBeTrue();
     });

     it('highlightJson should format JSON correctly', () => {
          const json = '{"key": "value", "num": 123, "bool": true, "nullVal": null}';
          const highlighted = component.highlightJson(json);
          expect(highlighted).toContain('<span class="key">"key":</span>'); // Updated to include colon
          expect(highlighted).toContain('<span class="string">"value"</span>');
          expect(highlighted).toContain('<span class="key">"num":</span>'); // Updated to include colon
          expect(highlighted).toContain('<span class="number">123</span>');
          expect(highlighted).toContain('<span class="key">"bool":</span>'); // Updated to include colon
          expect(highlighted).toContain('<span class="boolean">true</span>');
          expect(highlighted).toContain('<span class="key">"nullVal":</span>'); // Updated to include colon
          expect(highlighted).toContain('<span class="null">null</span>');
     });

     it('renderTransactionResult should call simulated renderer when isSimulateEnabled', () => {
          component.isSimulateEnabled = true;
          component.resultField = { nativeElement: { textContent: '', innerText: '', classList: { add: jasmine.createSpy('add') } } } as any;
          (component as any).renderTransactionResult({});
          expect(renderUiComponentsServiceMock.renderSimulatedTransactionsResults).toHaveBeenCalled();
          expect(renderUiComponentsServiceMock.renderTransactionsResults).not.toHaveBeenCalled();
     });

     it('renderTransactionResult should call normal renderer when isSimulateEnabled is false', () => {
          component.isSimulateEnabled = false;
          component.resultField = { nativeElement: { textContent: '', innerText: '', classList: { add: jasmine.createSpy('add') } } } as any;
          (component as any).renderTransactionResult({ result: {} });
          expect(renderUiComponentsServiceMock.renderTransactionsResults).toHaveBeenCalled();
          expect(renderUiComponentsServiceMock.renderSimulatedTransactionsResults).not.toHaveBeenCalled();
     });

     it('checkForSignerAccounts should extract accounts and set quorum', () => {
          const accountObjects = {
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

     it('refreshUIData should call refreshUiAccountObjects and refreshUiAccountInfo', () => {
          const refreshObjectsSpy = spyOn(component as any, 'refreshUiAccountObjects').and.stub();
          const refreshInfoSpy = spyOn(component as any, 'refreshUiAccountInfo').and.stub();
          (component as any).refreshUIData({ classicAddress: validAddr }, { result: {} }, { result: { account_objects: [] } });
          expect(refreshObjectsSpy).toHaveBeenCalled();
          expect(refreshInfoSpy).toHaveBeenCalled();
     });
});
