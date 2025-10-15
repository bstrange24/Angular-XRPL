import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreateConditionalEscrowComponent } from './create-conditional-escrow.component';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { StorageService } from '../../services/storage.service';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';
import * as xrpl from 'xrpl';

describe('CreateConditionalEscrowComponent (isolated)', () => {
     let component: CreateConditionalEscrowComponent;
     let fixture: ComponentFixture<CreateConditionalEscrowComponent>;
     let xrplServiceMock: any;
     let utilsServiceMock: any;
     let storageServiceMock: any;
     let renderUiComponentsServiceMock: any;
     let xrplTransactionServiceMock: any;

     const validAddr = 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe';

     beforeEach(async () => {
          xrplServiceMock = {
               getNet: jasmine.createSpy('getNet').and.returnValue({ environment: 'test' }),
               getClient: jasmine.createSpy('getClient'),
               getAccountInfo: jasmine.createSpy('getAccountInfo'),
               getAccountObjects: jasmine.createSpy('getAccountObjects'),
               getAccountLines: jasmine.createSpy('getAccountLines'),
               calculateTransactionFee: jasmine.createSpy('calculateTransactionFee'),
               getLastLedgerIndex: jasmine.createSpy('getLastLedgerIndex'),
               getXrplServerInfo: jasmine.createSpy('getXrplServerInfo'),
               getTokenBalance: jasmine.createSpy('getTokenBalance'),
               getTxData: jasmine.createSpy('getTxData'),
               getEscrowBySequence: jasmine.createSpy('getEscrowBySequence'),
               getCurrentRippleTime: jasmine.createSpy('getCurrentRippleTime'),
               checkTicketExists: jasmine.createSpy('checkTicketExists'),
          };

          utilsServiceMock = {
               clearSignerList: jasmine.createSpy('clearSignerList'),
               loadSignerList: jasmine.createSpy('loadSignerList'),
               setTicketSequence: jasmine.createSpy('setTicketSequence'),
               setDestinationTag: jasmine.createSpy('setDestinationTag'),
               setMemoField: jasmine.createSpy('setMemoField'),
               addTime: jasmine.createSpy('addTime').and.callFake((_v: string, _unit: string) => 0),
               convertXRPLTime: jasmine.createSpy('convertXRPLTime').and.callFake((t: number) => `t${t}`),
               convertDateTimeToRippleTime: jasmine.createSpy('convertDateTimeToRippleTime').and.returnValue(0),
               encodeCurrencyCode: jasmine.createSpy('encodeCurrencyCode').and.callFake((c: string) => c),
               encodeIfNeeded: jasmine.createSpy('encodeIfNeeded').and.callFake((s: string) => s),
               decodeIfNeeded: jasmine.createSpy('decodeIfNeeded').and.callFake((s: string) => s),
               decodeHex: jasmine.createSpy('decodeHex').and.callFake((s: string) => s),
               formatCurrencyForDisplay: jasmine.createSpy('formatCurrencyForDisplay').and.callFake((c: string) => c),
               formatTokenBalance: jasmine.createSpy('formatTokenBalance').and.callFake((v: string) => v),
               isEscrow: jasmine.createSpy('isEscrow').and.callFake((o: any) => o?.LedgerEntryType === 'Escrow'),
               isRippleState: jasmine.createSpy('isRippleState').and.callFake((o: any) => o?.LedgerEntryType === 'RippleState'),
               isMPT: jasmine.createSpy('isMPT').and.callFake((o: any) => o?.LedgerEntryType === 'MPToken'),
               getMptFlagsReadable: jasmine.createSpy('getMptFlagsReadable').and.returnValue(''),
               updateOwnerCountAndReserves: jasmine.createSpy('updateOwnerCountAndReserves').and.resolveTo({ ownerCount: '0', totalXrpReserves: '0' }),
               checkEscrowStatus: jasmine.createSpy('checkEscrowStatus').and.returnValue({ canFinish: true, canCancel: true }),
               detectXrpInputType: jasmine.createSpy('detectXrpInputType').and.returnValue({ value: 'seed', type: 'seed' }),
               getMultiSignAddress: jasmine.createSpy('getMultiSignAddress').and.returnValue(['addr1']),
               getMultiSignSeeds: jasmine.createSpy('getMultiSignSeeds').and.returnValue(['seed1']),
               validateInput: jasmine.createSpy('validateInput').and.callFake((v: string) => v != null && v !== ''),
               validateCondition: jasmine.createSpy('validateCondition').and.returnValue(true),
               validateFulfillment: jasmine.createSpy('validateFulfillment').and.returnValue(true),
               getRegularKeyWallet: jasmine.createSpy('getRegularKeyWallet').and.resolveTo({ useRegularKeyWalletSignTx: false, regularKeyWalletSignTx: undefined }),
               isInsufficientXrpBalance1: jasmine.createSpy('isInsufficientXrpBalance1').and.returnValue(false),
               isInsufficientIouTrustlineBalance: jasmine.createSpy('isInsufficientIouTrustlineBalance').and.returnValue(false),
               isTxSuccessful: jasmine.createSpy('isTxSuccessful').and.returnValue(true),
               getTransactionResultMessage: jasmine.createSpy('getTransactionResultMessage').and.returnValue('tesSUCCESS'),
               processErrorMessageFromLedger: jasmine.createSpy('processErrorMessageFromLedger').and.returnValue('Processed error'),
          };

          storageServiceMock = {
               getKnownIssuers: jasmine.createSpy('getKnownIssuers').and.returnValue(null),
               get: jasmine.createSpy('get'),
               removeValue: jasmine.createSpy('removeValue'),
          };

          renderUiComponentsServiceMock = {
               renderDetails: jasmine.createSpy('renderDetails'),
               renderSimulatedTransactionsResults: jasmine.createSpy('renderSimulatedTransactionsResults'),
               renderTransactionsResults: jasmine.createSpy('renderTransactionsResults'),
               attachSearchListener: jasmine.createSpy('attachSearchListener'),
          };

          xrplTransactionServiceMock = {
               simulateTransaction: jasmine.createSpy('simulateTransaction').and.resolveTo({ result: {} }),
               signTransaction: jasmine.createSpy('signTransaction'),
               submitTransaction: jasmine.createSpy('submitTransaction'),
          };

          await TestBed.configureTestingModule({
               imports: [CreateConditionalEscrowComponent],
               providers: [
                    { provide: XrplService, useValue: xrplServiceMock },
                    { provide: UtilsService, useValue: utilsServiceMock },
                    { provide: StorageService, useValue: storageServiceMock },
                    { provide: RenderUiComponentsService, useValue: renderUiComponentsServiceMock },
                    { provide: XrplTransactionService, useValue: xrplTransactionServiceMock },
               ],
          })
               .overrideComponent(CreateConditionalEscrowComponent, { set: { template: '' } })
               .compileComponents();

          fixture = TestBed.createComponent(CreateConditionalEscrowComponent);
          component = fixture.componentInstance;
          // Do not call detectChanges to avoid template lifecycle effects
     });

     function typedClient() {
          xrplServiceMock.getClient.and.returnValue(
               Promise.resolve({
                    connection: {} as any,
                    feeCushion: 1,
                    maxFeeXRP: '2',
                    networkID: 0,
                    getXrpBalance: jasmine.createSpy('getXrpBalance'),
                    request: jasmine.createSpy('request'),
                    autofill: jasmine.createSpy('autofill').and.callFake(async (tx: any) => tx),
                    sign: jasmine.createSpy('sign'),
                    submitAndWait: jasmine.createSpy('submitAndWait'),
                    disconnect: jasmine.createSpy('disconnect'),
                    connect: jasmine.createSpy('connect'),
                    isConnected: jasmine.createSpy('isConnected').and.returnValue(true),
               } as unknown as xrpl.Client)
          );

          xrplServiceMock.getXrplServerInfo.and.returnValue(Promise.resolve({ result: {} as any, id: '1', type: 'response' } as unknown as xrpl.ServerInfoResponse));
          xrplServiceMock.getAccountInfo.and.resolveTo({ result: { account_data: { Sequence: 1 }, account_flags: {} } });
          xrplServiceMock.getAccountObjects.and.resolveTo({ result: { account_objects: [] } });
          xrplServiceMock.calculateTransactionFee.and.resolveTo('10');
          xrplServiceMock.getLastLedgerIndex.and.resolveTo(123);
     }

     it('should create', () => {
          expect(component).toBeTruthy();
     });

     describe('onWalletListChange', () => {
          it('updates wallets, calls updateDestinations and onAccountChange', () => {
               const updateDestinationsSpy = spyOn(component as any, 'updateDestinations').and.stub();
               const onAccountChangeSpy = spyOn(component, 'onAccountChange').and.stub();

               const wallets = [{ name: 'W', address: validAddr, seed: 's', balance: '0' }];
               component.onWalletListChange(wallets as any[]);

               expect(component.wallets).toEqual(wallets as any[]);
               expect(updateDestinationsSpy).toHaveBeenCalled();
               expect(onAccountChangeSpy).toHaveBeenCalled();
          });

          it('resets selected index when out of bounds', () => {
               component.selectedWalletIndex = 2;
               spyOn(component, 'onAccountChange').and.stub();
               component.onWalletListChange([{ name: 'W', address: validAddr } as any]);
               expect(component.selectedWalletIndex).toBe(0);
          });
     });

     describe('validateQuorum', () => {
          it('clamps signerQuorum and marks for check', () => {
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
     });

     describe('toggleMultiSign', () => {
          it('clears signers when disabling', async () => {
               component.useMultiSign = false;
               const markSpy = spyOn((component as any).cdr, 'markForCheck').and.stub();

               await component.toggleMultiSign();

               expect(utilsServiceMock.clearSignerList).toHaveBeenCalledWith(component.signers);
               expect(markSpy).toHaveBeenCalled();
          });

          it('loads signers when enabling', async () => {
               component.useMultiSign = true;
               spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
               const markSpy = spyOn((component as any).cdr, 'markForCheck').and.stub();

               await component.toggleMultiSign();

               expect(utilsServiceMock.loadSignerList).toHaveBeenCalledWith(validAddr, component.signers);
               expect(markSpy).toHaveBeenCalled();
          });

          it('sets error on getWallet failure', async () => {
               component.useMultiSign = true;
               spyOn(component as any, 'getWallet').and.throwError('fail');
               const setErrorSpy = spyOn(component as any, 'setError').and.stub();

               await component.toggleMultiSign();

               expect(setErrorSpy).toHaveBeenCalledWith('ERROR getting wallet in toggleMultiSign');
          });
     });

     describe('toggleUseMultiSign', () => {
          it('clears seeds when no multi-sign address configured', async () => {
               component.multiSignAddress = 'No Multi-Sign address configured for account';
               component.multiSignSeeds = 'abc';
               const markSpy = spyOn((component as any).cdr, 'markForCheck').and.stub();

               await component.toggleUseMultiSign();

               expect(component.multiSignSeeds).toBe('');
               expect(markSpy).toHaveBeenCalled();
          });

          it('keeps seeds when address configured', async () => {
               component.multiSignAddress = 'rAddress';
               component.multiSignSeeds = 'abc';
               const markSpy = spyOn((component as any).cdr, 'markForCheck').and.stub();

               await component.toggleUseMultiSign();

               expect(component.multiSignSeeds).toBe('abc');
               expect(markSpy).toHaveBeenCalled();
          });

          // it('loads signers when enabling', async () => {
          //      component.useMultiSign = true;
          //      spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
          //      const markSpy = spyOn((component as any).cdr, 'markForCheck').and.stub();

          //      await component.toggleMultiSign();

          //      expect(utilsServiceMock.loadSignerList).toHaveBeenCalledWith(validAddr, component.signers);
          //      expect(markSpy).toHaveBeenCalled();
          // });

          // it('sets error on getWallet failure', async () => {
          //      component.useMultiSign = true;
          //      spyOn(component as any, 'getWallet').and.throwError('fail');
          //      const setErrorSpy = spyOn(component as any, 'setError').and.stub();

          //      await component.toggleMultiSign();

          //      expect(setErrorSpy).toHaveBeenCalledWith('ERROR getting wallet in toggleMultiSign');
          // });
     });

     describe('toggleTicketSequence', () => {
          it('marks for check', () => {
               const markSpy = spyOn((component as any).cdr, 'markForCheck').and.stub();
               component.toggleTicketSequence();
               expect(markSpy).toHaveBeenCalled();
          });
     });

     describe('onTicketToggle', () => {
          it('adds and removes tickets', () => {
               component.selectedTickets = [];
               component.onTicketToggle({ target: { checked: true } }, '101');
               expect(component.selectedTickets).toEqual(['101']);
               component.onTicketToggle({ target: { checked: false } }, '101');
               expect(component.selectedTickets).toEqual([]);
          });
     });

     describe('ngAfterViewChecked', () => {
          it('attaches search listener on result change', () => {
               (component as any).resultField = { nativeElement: document.createElement('div') };
               (component as any)['lastResult'] = '';
               component['result'] = 'NEW';
               const markSpy = spyOn((component as any).cdr, 'markForCheck').and.stub();

               component.ngAfterViewChecked();

               expect(renderUiComponentsServiceMock.attachSearchListener).toHaveBeenCalled();
               expect((component as any)['lastResult']).toBe('NEW');
               expect(markSpy).toHaveBeenCalled();
          });

          it('does nothing when unchanged', () => {
               (component as any).resultField = { nativeElement: document.createElement('div') };
               (component as any)['lastResult'] = 'SAME';
               component['result'] = 'SAME';

               component.ngAfterViewChecked();
               expect(renderUiComponentsServiceMock.attachSearchListener).not.toHaveBeenCalled();
          });
     });

     describe('renderTransactionResult', () => {
          it('renders simulated when isSimulateEnabled', () => {
               component.isSimulateEnabled = true;
               (component as any).resultField = { nativeElement: document.createElement('div') };
               (component as any)['renderTransactionResult']({ result: {} });
               expect(renderUiComponentsServiceMock.renderSimulatedTransactionsResults).toHaveBeenCalled();
          });

          it('renders normal when not simulating', () => {
               component.isSimulateEnabled = false;
               (component as any).resultField = { nativeElement: document.createElement('div') };
               (component as any)['renderTransactionResult']({ result: {} });
               expect(renderUiComponentsServiceMock.renderTransactionsResults).toHaveBeenCalled();
          });
     });

     describe('getEscrows', () => {
          it('sets error on validation failure', async () => {
               (component as any).resultField = { nativeElement: { innerHTML: '' } };
               spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
               spyOn(component as any, 'validateInputs').and.resolveTo(['e']);
               const setErrorSpy = spyOn(component as any, 'setError').and.stub();

               // minimal typed client
               // xrplServiceMock.getClient.and.resolveTo({
               //      connection: {} as any,
               //      getXrpBalance: jasmine.createSpy('getXrpBalance'),
               // } as unknown as xrpl.Client);
               // xrplServiceMock.getAccountInfo.and.resolveTo({ result: { account_data: { Sequence: 1 }, account_flags: {} } });
               // xrplServiceMock.getAccountObjects.and.callFake((_c: any, _a: any, _s: any, type?: string) => ({ result: { account_objects: [] } }));

               typedClient();
               await component.getEscrows();

               expect(setErrorSpy).toHaveBeenCalled();
               expect(renderUiComponentsServiceMock.renderDetails).not.toHaveBeenCalled();
          });

          it('renders no escrows without throwing', async () => {
               (component as any).resultField = { nativeElement: { innerHTML: '' } };
               spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
               spyOn(component as any, 'validateInputs').and.resolveTo([]);

               xrplBasicClient();
               xrplServiceMock.getAccountInfo.and.resolveTo({ result: { account_data: { Sequence: 1 }, account_flags: {} } });
               xrplServiceMock.getAccountObjects.and.callFake((_c: any, _a: any, _s: any, type?: string) => ({ result: { account_objects: [] } }));

               await component.getEscrows();
               expect(renderUiComponentsServiceMock.renderDetails).toHaveBeenCalled();
          });
     });

     describe('createConditionalEscrow', () => {
          beforeEach(() => {
               (component as any).resultField = { nativeElement: { innerHTML: '', classList: { add: jasmine.createSpy('add') } } };
               component.currentWallet = { name: 'W', address: validAddr, seed: 's', balance: '0' } as any;
               component.amountField = '5';
               component.destinationFields = validAddr;
               component.escrowConditionField = 'A1';
               component.escrowCancelTimeField = '10';
          });

          it('sets error on validation failure', async () => {
               spyOn(component as any, 'validateInputs').and.resolveTo(['e']);
               xrplBasicClient();
               spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr, address: validAddr });
               const setErrorSpy = spyOn(component as any, 'setError').and.stub();

               await component.createConditionalEscrow();
               expect(setErrorSpy).toHaveBeenCalled();
          });

          it('simulates when isSimulateEnabled', async () => {
               spyOn(component as any, 'validateInputs').and.resolveTo([]);
               component.isSimulateEnabled = true;
               xrplBasicClient();
               spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr, address: validAddr });
               const renderSpy = spyOn<any>(component, 'renderTransactionResult').and.stub();

               await component.createConditionalEscrow();

               expect(xrplTransactionServiceMock.simulateTransaction).toHaveBeenCalled();
               expect(renderSpy).toHaveBeenCalled();
          });

          it('sets error on sign failure', async () => {
               spyOn(component as any, 'validateInputs').and.resolveTo([]);
               component.isSimulateEnabled = false;
               xrplBasicClient();
               spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr, address: validAddr });
               xrplTransactionServiceMock.signTransaction.and.resolveTo(null);
               const setErrorSpy = spyOn(component as any, 'setError').and.stub();

               await component.createConditionalEscrow();

               expect(setErrorSpy).toHaveBeenCalledWith('ERROR: Failed to sign Payment transaction.');
          });
     });

     describe('finishConditionalEscrow', () => {
          beforeEach(() => {
               (component as any).resultField = { nativeElement: { innerHTML: '', classList: { add: jasmine.createSpy('add') } } };
               component.currentWallet = { name: 'W', address: validAddr, seed: 's', balance: '0' } as any;
               component.escrowSequenceNumberField = '1';
               component.escrowConditionField = 'A1';
               component.escrowFulfillmentField = 'F1';

               xrplServiceMock.getClient.and.resolveTo({} as xrpl.Client);
               xrplServiceMock.getAccountInfo.and.resolveTo({ result: { account_data: { Sequence: 1 }, account_flags: {} } });
               xrplServiceMock.getAccountObjects.and.resolveTo({ result: { account_objects: [] } });
               xrplServiceMock.getEscrowBySequence.and.resolveTo({ Account: validAddr });
               xrplServiceMock.getAccountLines.and.resolveTo({ result: { lines: [] } });
               xrplServiceMock.calculateTransactionFee.and.resolveTo('10');
               xrplServiceMock.getLastLedgerIndex.and.resolveTo(123);
               xrplServiceMock.getXrplServerInfo.and.resolveTo({ result: {} as any, id: '1', type: 'response' } as xrpl.ServerInfoResponse);
               utilsServiceMock.checkEscrowStatus.and.returnValue({ canFinish: true, canCancel: true });
          });

          it('errors if fulfillment missing when condition provided', async () => {
               component.escrowConditionField = 'A1';
               component.escrowFulfillmentField = '';
               const setErrorSpy = spyOn(component as any, 'setError').and.stub();

               await component.finishConditionalEscrow();
               expect(setErrorSpy).toHaveBeenCalledWith('ERROR: Fulfillment is required when a condition is provided');
          });

          it('sets error on validation failure', async () => {
               spyOn(component as any, 'validateInputs').and.resolveTo(['e']);
               spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
               const setErrorSpy = spyOn(component as any, 'setError').and.stub();

               await component.finishConditionalEscrow();
               expect(setErrorSpy).toHaveBeenCalled();
          });

          it('simulates when isSimulateEnabled', async () => {
               component.isSimulateEnabled = true;
               spyOn(component as any, 'validateInputs').and.resolveTo([]);
               spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
               const renderSpy = spyOn<any>(component, 'renderTransactionResult').and.stub();

               await component.finishConditionalEscrow();
               expect(xrplTransactionServiceMock.simulateTransaction).toHaveBeenCalled();
               expect(renderSpy).toHaveBeenCalled();
          });
     });

     describe('cancelEscrow', () => {
          beforeEach(() => {
               (component as any).resultField = { nativeElement: { innerHTML: '', classList: { add: jasmine.createSpy('add') } } };
               component.currentWallet = { name: 'W', address: validAddr, seed: 's', balance: '0' } as any;
               component.escrowSequenceNumberField = '1';

               xrplServiceMock.getClient.and.resolveTo({} as xrpl.Client);
               xrplServiceMock.getAccountInfo.and.resolveTo({ result: { account_data: { Sequence: 1 }, account_flags: {} } });
               xrplServiceMock.calculateTransactionFee.and.resolveTo('10');
               xrplServiceMock.getLastLedgerIndex.and.resolveTo(123);
               xrplServiceMock.getXrplServerInfo.and.resolveTo({ result: {} as any, id: '1', type: 'response' } as xrpl.ServerInfoResponse);
          });

          it('sets error on validation failure', async () => {
               spyOn(component as any, 'validateInputs').and.resolveTo(['e']);
               spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
               const setErrorSpy = spyOn(component as any, 'setError').and.stub();

               await component.cancelEscrow();
               expect(setErrorSpy).toHaveBeenCalled();
          });

          it('simulates when isSimulateEnabled', async () => {
               component.isSimulateEnabled = true;
               spyOn(component as any, 'validateInputs').and.resolveTo([]);
               spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
               const renderSpy = spyOn<any>(component, 'renderTransactionResult').and.stub();

               // Ensure escrow with matching sequence exists
               xrplServiceMock.getAccountObjects.and.callFake((_c: any, _a: any, _s: any, type?: string) => {
                    if (type === 'escrow') {
                         return Promise.resolve({ result: { account_objects: [{ LedgerEntryType: 'Escrow', Account: validAddr, PreviousTxnID: 'ABC' }] } });
                    }
                    return Promise.resolve({ result: { account_objects: [] } });
               });
               xrplServiceMock.getTxData.and.resolveTo({ result: { tx_json: { Sequence: Number(component.escrowSequenceNumberField) } } });

               await component.cancelEscrow();
               expect(xrplTransactionServiceMock.simulateTransaction).toHaveBeenCalled();
               expect(renderSpy).toHaveBeenCalled();
          });
     });

     function xrplBasicClient() {
          xrplServiceMock.getClient.and.returnValue(
               Promise.resolve({
                    connection: {} as any,
                    feeCushion: 1,
                    maxFeeXRP: '2',
                    networkID: 0,
                    getXrpBalance: jasmine.createSpy('getXrpBalance'),
                    request: jasmine.createSpy('request'),
                    autofill: jasmine.createSpy('autofill'),
                    sign: jasmine.createSpy('sign'),
                    submitAndWait: jasmine.createSpy('submitAndWait'),
                    disconnect: jasmine.createSpy('disconnect'),
                    connect: jasmine.createSpy('connect'),
                    isConnected: jasmine.createSpy('isConnected').and.returnValue(true),
               } as unknown as xrpl.Client)
          );

          xrplServiceMock.getXrplServerInfo.and.returnValue(Promise.resolve({ result: {} as any, id: '1', type: 'response' } as unknown as xrpl.ServerInfoResponse));
          xrplServiceMock.getAccountInfo.and.resolveTo({ result: { account_data: { Sequence: 1 }, account_flags: {} } });
          xrplServiceMock.getAccountLines.and.resolveTo({ result: { lines: [] } });
          xrplServiceMock.calculateTransactionFee.and.resolveTo('10');
          xrplServiceMock.getLastLedgerIndex.and.resolveTo(123);
     }
});
