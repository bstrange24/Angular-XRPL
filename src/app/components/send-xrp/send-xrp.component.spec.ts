import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SendXrpComponent } from './send-xrp.component';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { StorageService } from '../../services/storage.service';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';

describe('SendXrpComponent (isolated)', () => {
     let component: SendXrpComponent;
     let fixture: ComponentFixture<SendXrpComponent>;
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
               calculateTransactionFee: jasmine.createSpy('calculateTransactionFee'),
               getLastLedgerIndex: jasmine.createSpy('getLastLedgerIndex'),
               getXrplServerInfo: jasmine.createSpy('getXrplServerInfo'),
          };

          utilsServiceMock = {
               clearSignerList: jasmine.createSpy('clearSignerList'),
               loadSignerList: jasmine.createSpy('loadSignerList'),
               setTicketSequence: jasmine.createSpy('setTicketSequence'),
               setDestinationTag: jasmine.createSpy('setDestinationTag'),
               setSourceTagField: jasmine.createSpy('setSourceTagField'),
               setInvoiceIdField: jasmine.createSpy('setInvoiceIdField'),
               setMemoField: jasmine.createSpy('setMemoField'),
               getWallet: jasmine.createSpy('getWallet').and.resolveTo({ classicAddress: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe', seed: 's' }),
               sortByLedgerEntryType: jasmine.createSpy('sortByLedgerEntryType').and.returnValue([]),
               getRegularKeyWallet: jasmine.createSpy('getRegularKeyWallet').and.resolveTo({ useRegularKeyWalletSignTx: false, regularKeyWalletSignTx: undefined }),
               isInsufficientXrpBalance1: jasmine.createSpy('isInsufficientXrpBalance1').and.returnValue(false),
               isTxSuccessful: jasmine.createSpy('isTxSuccessful').and.returnValue(true),
               getTransactionResultMessage: jasmine.createSpy('getTransactionResultMessage').and.returnValue('tesSUCCESS'),
               processErrorMessageFromLedger: jasmine.createSpy('processErrorMessageFromLedger').and.returnValue('Processed error'),
          };

          storageServiceMock = {};

          renderUiComponentsServiceMock = {
               renderAccountDetails: jasmine.createSpy('renderAccountDetails'),
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
               imports: [SendXrpComponent],
               providers: [
                    { provide: XrplService, useValue: xrplServiceMock },
                    { provide: UtilsService, useValue: utilsServiceMock },
                    { provide: StorageService, useValue: storageServiceMock },
                    { provide: RenderUiComponentsService, useValue: renderUiComponentsServiceMock },
                    { provide: XrplTransactionService, useValue: xrplTransactionServiceMock },
               ],
          })
               .overrideComponent(SendXrpComponent, { set: { template: '' } })
               .compileComponents();

          fixture = TestBed.createComponent(SendXrpComponent);
          component = fixture.componentInstance;
          // Do not call detectChanges to avoid template init
     });

     it('should create', () => {
          expect(component).toBeTruthy();
     });

     describe('onWalletListChange', () => {
          it('updates wallets and calls updateDestinations and onAccountChange', () => {
               const updateDestinationsSpy = spyOn(component as any, 'updateDestinations').and.stub();
               const onAccountChangeSpy = spyOn(component, 'onAccountChange').and.stub();

               const newWallets = [{ name: 'Wallet A', address: validAddr, seed: 's1', balance: '0' }];

               component.onWalletListChange(newWallets as any[]);

               expect(component.wallets).toEqual(newWallets as any[]);
               expect(updateDestinationsSpy).toHaveBeenCalledTimes(1);
               expect(onAccountChangeSpy).toHaveBeenCalledTimes(1);
          });

          it('resets selectedWalletIndex to 0 if out of range', () => {
               spyOn(component as any, 'updateDestinations').and.stub();
               spyOn(component, 'onAccountChange').and.stub();

               component.selectedWalletIndex = 10;
               const newWallets = [{ name: 'Wallet A', address: validAddr, seed: 's1', balance: '0' }];

               component.onWalletListChange(newWallets as any[]);

               expect(component.selectedWalletIndex).toBe(0);
          });
     });

     describe('validateQuorum', () => {
          it('clamps signerQuorum to total weight', () => {
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
          it('clears signers when disabling multi-sign', async () => {
               component.useMultiSign = false;
               const markSpy = spyOn((component as any).cdr, 'markForCheck').and.stub();

               await component.toggleMultiSign();

               expect(utilsServiceMock.clearSignerList).toHaveBeenCalledWith(component.signers);
               expect(markSpy).toHaveBeenCalled();
          });

          it('loads signers when enabling multi-sign', async () => {
               component.useMultiSign = true;
               spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
               const markSpy = spyOn((component as any).cdr, 'markForCheck').and.stub();

               await component.toggleMultiSign();

               expect(utilsServiceMock.loadSignerList).toHaveBeenCalledWith(validAddr, component.signers);
               expect(markSpy).toHaveBeenCalled();
          });

          it('sets error on wallet retrieval failure', async () => {
               component.useMultiSign = true;
               spyOn(component as any, 'getWallet').and.throwError('fail');
               const setErrorSpy = spyOn(component as any, 'setError').and.stub();

               await component.toggleMultiSign();

               expect(setErrorSpy).toHaveBeenCalledWith('ERROR getting wallet in toggleMultiSign');
          });
     });

     describe('toggleUseMultiSign', () => {
          it('clears seeds when no address configured', async () => {
               component.multiSignAddress = 'No Multi-Sign address configured for account';
               component.multiSignSeeds = 'abc';
               const markSpy = spyOn((component as any).cdr, 'markForCheck').and.stub();

               await component.toggleUseMultiSign();

               expect(component.multiSignSeeds).toBe('');
               expect(markSpy).toHaveBeenCalled();
          });

          it('does not clear seeds when address configured', async () => {
               component.multiSignAddress = 'rAddress';
               component.multiSignSeeds = 'abc';
               const markSpy = spyOn((component as any).cdr, 'markForCheck').and.stub();

               await component.toggleUseMultiSign();

               expect(component.multiSignSeeds).toBe('abc');
               expect(markSpy).toHaveBeenCalled();
          });
     });

     describe('toggleTicketSequence', () => {
          it('marks for check', () => {
               const markSpy = spyOn((component as any).cdr, 'markForCheck').and.stub();
               component.toggleTicketSequence();
               expect(markSpy).toHaveBeenCalled();
          });
     });

     describe('onTicketToggle', () => {
          it('adds and removes tickets correctly', () => {
               component.selectedTickets = [];
               component.onTicketToggle({ target: { checked: true } }, '101');
               expect(component.selectedTickets).toEqual(['101']);
               component.onTicketToggle({ target: { checked: false } }, '101');
               expect(component.selectedTickets).toEqual([]);
          });
     });

     describe('handleTransactionResult', () => {
          it('updates state and marks for check', () => {
               const markSpy = spyOn((component as any).cdr, 'markForCheck').and.stub();

               component.handleTransactionResult({ result: 'OK', isError: false, isSuccess: true });

               expect(component.result).toBe('OK');
               expect(component.isError).toBeFalse();
               expect(component.isSuccess).toBeTrue();
               expect(component.isEditable).toBeFalse();
               expect(markSpy).toHaveBeenCalled();
          });
     });

     describe('ngAfterViewChecked', () => {
          it('attaches search listener when result changed', () => {
               (component as any).resultField = { nativeElement: document.createElement('div') };
               (component as any)['lastResult'] = '';
               component['result'] = 'NEW';

               const markSpy = spyOn((component as any).cdr, 'markForCheck').and.stub();
               component.ngAfterViewChecked();

               expect(renderUiComponentsServiceMock.attachSearchListener).toHaveBeenCalled();
               expect((component as any)['lastResult']).toBe('NEW');
               expect(markSpy).toHaveBeenCalled();
          });

          it('does nothing when result not changed', () => {
               (component as any).resultField = { nativeElement: document.createElement('div') };
               (component as any)['lastResult'] = 'SAME';
               component['result'] = 'SAME';

               component.ngAfterViewChecked();
               expect(renderUiComponentsServiceMock.attachSearchListener).not.toHaveBeenCalled();
          });
     });

     describe('renderTransactionResult', () => {
          it('uses simulated renderer when simulating', () => {
               component.isSimulateEnabled = true;
               (component as any).resultField = { nativeElement: document.createElement('div') };
               (component as any).renderTransactionResult({ result: {} });
               expect(renderUiComponentsServiceMock.renderSimulatedTransactionsResults).toHaveBeenCalled();
          });

          it('uses normal renderer when not simulating', () => {
               component.isSimulateEnabled = false;
               (component as any).resultField = { nativeElement: document.createElement('div') };
               (component as any).renderTransactionResult({ result: {} });
               expect(renderUiComponentsServiceMock.renderTransactionsResults).toHaveBeenCalled();
          });
     });

     describe('getAccountDetails', () => {
          it('sets error on validation failure', async () => {
               (component as any).resultField = { nativeElement: { innerHTML: '' } };
               spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
               spyOn(component as any, 'validateInputs').and.resolveTo(['e1']);
               const setErrorSpy = spyOn(component as any, 'setError').and.stub();

               await component.getAccountDetails();

               expect(setErrorSpy).toHaveBeenCalled();
               expect(renderUiComponentsServiceMock.renderAccountDetails).not.toHaveBeenCalled();
          });

          it('renders account details on success', async () => {
               (component as any).resultField = { nativeElement: { innerHTML: '' } };
               spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
               spyOn(component as any, 'validateInputs').and.resolveTo([]);
               xrplServiceMock.getClient.and.resolveTo({ getXrpBalance: jasmine.createSpy('getXrpBalance').and.resolveTo('100') });
               xrplServiceMock.getAccountInfo.and.resolveTo({ result: { account_data: { Sequence: 1 } } });
               xrplServiceMock.getAccountObjects.and.resolveTo({ result: { account_objects: [] } });
               utilsServiceMock.loadSignerList.and.stub();
               spyOn(component as any, 'refreshUiAccountObjects').and.stub();
               spyOn(component as any, 'updateXrpBalance').and.stub();

               await component.getAccountDetails();

               expect(renderUiComponentsServiceMock.renderAccountDetails).toHaveBeenCalled();
          });
     });

     describe('sendXrp', () => {
          beforeEach(() => {
               (component as any).resultField = { nativeElement: { innerHTML: '', classList: { add: jasmine.createSpy('add') } } };
               spyOn(component as any, 'refreshUiAccountObjects').and.stub();
               spyOn(component as any, 'updateXrpBalance').and.stub();
               spyOn(component as any, 'setTxOptionalFields').and.callFake((client: any, tx: any) => tx);

               component.amountField = '5';
               component.destinationFields = validAddr;
               component.currentWallet = { name: 'W', address: validAddr, seed: 's', balance: '100' } as any;

               xrplServiceMock.getClient.and.resolveTo({});
               xrplServiceMock.getAccountInfo.and.resolveTo({ result: { account_data: { Sequence: 1 }, account_flags: {} } });
               xrplServiceMock.calculateTransactionFee.and.resolveTo('10');
               xrplServiceMock.getLastLedgerIndex.and.resolveTo(123);
               xrplServiceMock.getXrplServerInfo.and.resolveTo({});
          });

          it('sets error on validation failure', async () => {
               spyOn(component as any, 'validateInputs').and.resolveTo(['e']);
               const setErrorSpy = spyOn(component as any, 'setError').and.stub();

               await component.sendXrp();

               expect(setErrorSpy).toHaveBeenCalled();
          });

          it('sets error on insufficient XRP balance', async () => {
               spyOn(component as any, 'validateInputs').and.resolveTo([]);
               utilsServiceMock.isInsufficientXrpBalance1.and.returnValue(true);
               const setErrorSpy = spyOn(component as any, 'setError').and.stub();

               await component.sendXrp();

               expect(setErrorSpy).toHaveBeenCalledWith('ERROR: Insufficient XRP to complete transaction');
          });

          it('simulates when isSimulateEnabled', async () => {
               component.isSimulateEnabled = true;
               spyOn(component as any, 'validateInputs').and.resolveTo([]);
               const renderSpy = spyOn<any>(component, 'renderTransactionResult').and.stub();

               await component.sendXrp();

               expect(xrplTransactionServiceMock.simulateTransaction).toHaveBeenCalled();
               expect(renderSpy).toHaveBeenCalled();
          });

          it('handles sign failure', async () => {
               component.isSimulateEnabled = false;
               spyOn(component as any, 'validateInputs').and.resolveTo([]);
               utilsServiceMock.getRegularKeyWallet.and.resolveTo({ useRegularKeyWalletSignTx: false, regularKeyWalletSignTx: null });
               xrplTransactionServiceMock.signTransaction.and.resolveTo(null);
               const setErrorSpy = spyOn(component as any, 'setError').and.stub();

               await component.sendXrp();

               expect(setErrorSpy).toHaveBeenCalledWith('ERROR: Failed to sign Payment transaction.');
          });

          it('submits transaction and handles success', async () => {
               component.isSimulateEnabled = false;
               spyOn(component as any, 'validateInputs').and.resolveTo([]);
               utilsServiceMock.getRegularKeyWallet.and.resolveTo({ useRegularKeyWalletSignTx: false, regularKeyWalletSignTx: null });
               xrplTransactionServiceMock.signTransaction.and.resolveTo({ tx_blob: 'signed' });
               xrplTransactionServiceMock.submitTransaction.and.resolveTo({ result: { code: 'tesSUCCESS', meta: {} } });
               utilsServiceMock.isTxSuccessful.and.returnValue(true);

               await component.sendXrp();

               expect(xrplTransactionServiceMock.submitTransaction).toHaveBeenCalled();
          });

          it('handles ledger failure (non-success)', async () => {
               component.isSimulateEnabled = false;
               spyOn(component as any, 'validateInputs').and.resolveTo([]);
               utilsServiceMock.getRegularKeyWallet.and.resolveTo({ useRegularKeyWalletSignTx: false, regularKeyWalletSignTx: null });
               xrplTransactionServiceMock.signTransaction.and.resolveTo({ tx_blob: 'signed' });
               xrplTransactionServiceMock.submitTransaction.and.resolveTo({ result: { code: 'tecFAILURE', meta: {} } });
               utilsServiceMock.isTxSuccessful.and.returnValue(false);

               await component.sendXrp();

               expect(utilsServiceMock.getTransactionResultMessage).toHaveBeenCalled();
               expect(utilsServiceMock.processErrorMessageFromLedger).toHaveBeenCalled();
          });
     });

     describe('clearFields', () => {
          it('clears all fields when clearAllFields is true', () => {
               component.amountField = '5';
               component.isSimulateEnabled = true;
               component.useMultiSign = true;
               component.isRegularKeyAddress = true;
               component.selectedTicket = '1';
               component.isTicket = true;
               component.memoField = 'm';
               component.isMemoEnabled = true;

               (component as any).clearFields(true);

               expect(component.amountField).toBe('');
               expect(component.isSimulateEnabled).toBeFalse();
               expect(component.useMultiSign).toBeFalse();
               expect(component.isRegularKeyAddress).toBeFalse();
               expect(component.selectedTicket).toBe('');
               expect(component.isTicket).toBeFalse();
               expect(component.memoField).toBe('');
               expect(component.isMemoEnabled).toBeFalse();
          });

          it('clears partial fields when clearAllFields is false', () => {
               component.selectedTicket = '1';
               component.isTicket = true;

               (component as any).clearFields(false);

               expect(component.selectedTicket).toBe('');
               expect(component.isTicket).toBeFalse();
          });
     });

     describe('updateDestinations', () => {
          it('updates destinations and sets default, ensuring not default selected', () => {
               component.wallets = [
                    { name: 'A', address: 'r1' },
                    { name: 'B', address: 'r2' },
               ] as any;
               const ensureSpy = spyOn(component as any, 'ensureDefaultNotSelected').and.stub();

               (component as any).updateDestinations();

               expect(component.destinations).toEqual([
                    { name: 'A', address: 'r1' },
                    { name: 'B', address: 'r2' },
               ]);
               expect(component.destinationFields).toBe('r1');
               expect(ensureSpy).toHaveBeenCalled();
          });
     });
});
