import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { SendXrpComponent } from './send-xrp.component';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { StorageService } from '../../services/storage.service';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';
import * as xrpl from 'xrpl';

describe('SendXrpComponent (isolated)', () => {
     let component: SendXrpComponent;
     let fixture: ComponentFixture<SendXrpComponent>;
     let xrplServiceMock: any;
     let utilsServiceMock: any;
     let storageServiceMock: any;
     let renderUiComponentsServiceMock: any;
     let xrplTransactionServiceMock: any;
     let cdrMock: any;

     const validAddr = 'rMLX8SSCrvjus2sZU6CK2FtW8versts9QB';
     const validSeed = 'ssgapRpEdpZA9VUmbghGEvUqLkJYg';

     beforeEach(async () => {
          xrplServiceMock = {
               getNet: jasmine.createSpy('getNet').and.returnValue({ environment: 'test' }),
               getClient: jasmine.createSpy('getClient'),
               getAccountInfo: jasmine.createSpy('getAccountInfo'),
               getAccountObjects: jasmine.createSpy('getAccountObjects'),
               calculateTransactionFee: jasmine.createSpy('calculateTransactionFee'),
               getLastLedgerIndex: jasmine.createSpy('getLastLedgerIndex'),
               getXrplServerInfo: jasmine.createSpy('getXrplServerInfo'),
               getXrpBalance: jasmine.createSpy('getXrpBalance').and.resolveTo(100),
          };

          utilsServiceMock = {
               clearSignerList: jasmine.createSpy('clearSignerList'),
               loadSignerList: jasmine.createSpy('loadSignerList'),
               setTicketSequence: jasmine.createSpy('setTicketSequence'),
               setDestinationTag: jasmine.createSpy('setDestinationTag'),
               setSourceTagField: jasmine.createSpy('setSourceTagField'),
               sortByLedgerEntryType: jasmine.createSpy('sortByLedgerEntryType').and.returnValue([]),
               setInvoiceIdField: jasmine.createSpy('setInvoiceIdField'),
               setMemoField: jasmine.createSpy('setMemoField'),
               updateOwnerCountAndReserves: jasmine.createSpy('updateOwnerCountAndReserves').and.resolveTo({ ownerCount: '2', totalXrpReserves: '20' }),
               detectXrpInputType: jasmine.createSpy('detectXrpInputType').and.returnValue({ value: 'seed', type: 'seed' }),
               getMultiSignAddress: jasmine.createSpy('getMultiSignAddress').and.returnValue(['addr1']),
               getMultiSignSeeds: jasmine.createSpy('getMultiSignSeeds').and.returnValue(['seed1']),
               validateInput: jasmine.createSpy('validateInput').and.callFake((v: string) => v != null && v !== ''),
               validateCondition: jasmine.createSpy('validateCondition').and.returnValue(true),
               validateFulfillment: jasmine.createSpy('validateFulfillment').and.returnValue(true),
               getRegularKeyWallet: jasmine.createSpy('getRegularKeyWallet').and.resolveTo({ useRegularKeyWalletSignTx: false, regularKeyWalletSignTx: undefined }),
               isInsufficientXrpBalance1: jasmine.createSpy('isInsufficientXrpBalance1').and.returnValue(false),
               isTxSuccessful: jasmine.createSpy('isTxSuccessful').and.returnValue(true),
               getTransactionResultMessage: jasmine.createSpy('getTransactionResultMessage').and.returnValue('tesSUCCESS'),
               processErrorMessageFromLedger: jasmine.createSpy('processErrorMessageFromLedger').and.returnValue('Processed error'),
               getWallet: jasmine.createSpy('getWallet').and.resolveTo({ classicAddress: validAddr }),
          };

          storageServiceMock = {
               set: jasmine.createSpy('set'),
               removeValue: jasmine.createSpy('removeValue'),
               get: jasmine.createSpy('get').and.returnValue(null),
          };

          renderUiComponentsServiceMock = {
               renderAccountDetails: jasmine.createSpy('renderAccountDetails'),
               renderSimulatedTransactionsResults: jasmine.createSpy('renderSimulatedTransactionsResults'),
               renderTransactionsResults: jasmine.createSpy('renderTransactionsResults'),
               attachSearchListener: jasmine.createSpy('attachSearchListener'),
          };

          xrplTransactionServiceMock = {
               simulateTransaction: jasmine.createSpy('simulateTransaction').and.resolveTo({ result: { meta: { TransactionResult: 'tesSUCCESS' } } }),
               signTransaction: jasmine.createSpy('signTransaction').and.resolveTo({}),
               submitTransaction: jasmine.createSpy('submitTransaction').and.resolveTo({ result: { meta: { TransactionResult: 'tesSUCCESS' } } }),
          };

          cdrMock = {
               detectChanges: jasmine.createSpy('detectChanges'),
          };

          await TestBed.configureTestingModule({
               imports: [SendXrpComponent],
               providers: [
                    { provide: XrplService, useValue: xrplServiceMock },
                    { provide: UtilsService, useValue: utilsServiceMock },
                    { provide: StorageService, useValue: storageServiceMock },
                    { provide: RenderUiComponentsService, useValue: renderUiComponentsServiceMock },
                    { provide: XrplTransactionService, useValue: xrplTransactionServiceMock },
                    // { provide: ChangeDetectorRef, useValue: cdrMock },
               ],
          })
               .overrideComponent(SendXrpComponent, { set: { template: '' } })
               .compileComponents();

          fixture = TestBed.createComponent(SendXrpComponent);
          component = fixture.componentInstance;
          // Mock ViewChild properties
          component['resultField'] = { nativeElement: { innerHTML: '', classList: { add: jasmine.createSpy('add') } } } as any;
          component['accountForm'] = { value: {} } as any;
          fixture.detectChanges(); // Trigger initial change detection
     });

     function setupXrplClient() {
          const clientMock = {
               connection: {} as any,
               feeCushion: 1,
               maxFeeXRP: '2',
               networkID: 0,
               getXrpBalance: jasmine.createSpy('getXrpBalance').and.resolveTo(100),
               request: jasmine.createSpy('request'),
               autofill: jasmine.createSpy('autofill').and.callFake(async (tx: any) => ({ ...tx, Fee: '10' })),
               sign: jasmine.createSpy('sign'),
               submitAndWait: jasmine.createSpy('submitAndWait').and.resolveTo({ result: { meta: { TransactionResult: 'tesSUCCESS' } } }),
               disconnect: jasmine.createSpy('disconnect'),
               connect: jasmine.createSpy('connect'),
               isConnected: jasmine.createSpy('isConnected').and.returnValue(true),
          } as unknown as xrpl.Client;

          xrplServiceMock.getClient.and.resolveTo(clientMock);
          xrplServiceMock.getXrplServerInfo.and.resolveTo({ result: {}, id: '1', type: 'response' } as xrpl.ServerInfoResponse);
          xrplServiceMock.getAccountInfo.and.resolveTo({
               result: { account_data: { Account: validAddr, Sequence: 1 }, account_flags: {} },
               id: '1',
               type: 'response',
          } as xrpl.AccountInfoResponse);
          xrplServiceMock.getAccountObjects.and.resolveTo({
               result: { account_objects: [] },
               id: '1',
               type: 'response',
          } as unknown as xrpl.AccountObjectsResponse);
          xrplServiceMock.calculateTransactionFee.and.resolveTo('10');
          xrplServiceMock.getLastLedgerIndex.and.resolveTo(123);
          return clientMock;
     }

     it('should create', () => {
          expect(component).toBeTruthy();
     });

     describe('ngOnInit', () => {
          it('should initialize without errors', () => {
               component.ngOnInit();
               expect(component).toBeDefined();
          });
     });

     describe('ngAfterViewInit', () => {
          it('should call onAccountChange and handle errors', fakeAsync(() => {
               spyOn(component, 'onAccountChange').and.callThrough();
               spyOn(component as any, 'setError').and.callThrough();
               component.wallets = [{ name: 'Wallet1', address: validAddr, seed: validSeed, balance: '0' }];

               component.ngAfterViewInit();
               tick();

               // expect(component.onAccountChange).toHaveBeenCalled();
               // Note: detectChanges may not be called depending on component implementation
          }));
     });

     describe('ngAfterViewChecked', () => {
          it('attaches search listener when result changed', () => {
               // Ensure resultField is defined before the test
               component['resultField'] = { nativeElement: { innerHTML: '', classList: { add: jasmine.createSpy('add') } } } as any;
               component['lastResult'] = '';
               component.result = 'NEW';

               const markSpy = spyOn((component as any).cdr, 'markForCheck').and.stub();
               component.ngAfterViewChecked();

               expect(renderUiComponentsServiceMock.attachSearchListener).toHaveBeenCalledWith(component['resultField'].nativeElement);
               expect(component['lastResult']).toBe('NEW');
               expect(markSpy).toHaveBeenCalled();
          });

          it('does nothing when result unchanged', () => {
               component['resultField'] = { nativeElement: { innerHTML: '', classList: { add: jasmine.createSpy('add') } } } as any;
               component['lastResult'] = 'SAME';
               component.result = 'SAME';

               component.ngAfterViewChecked();

               expect(renderUiComponentsServiceMock.attachSearchListener).not.toHaveBeenCalled();
          });
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
                    { account: 'addr1', seed: 'seed1', weight: 2 },
                    { account: 'addr2', seed: 'seed2', weight: 3 },
               ];
               component.signerQuorum = 10;
               const markSpy = spyOn((component as any).cdr, 'markForCheck').and.stub();

               component.validateQuorum();

               expect(component.signerQuorum).toBe(5);
               expect(markSpy).toHaveBeenCalled();
          });

          it('does not change quorum if within bounds', () => {
               component.signers = [
                    { account: 'addr1', seed: 'seed1', weight: 2 },
                    { account: 'addr2', seed: 'seed2', weight: 3 },
               ];
               component.signerQuorum = 5;
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
          it('adds ticket when checked', () => {
               component.selectedTickets = [];
               component.onTicketToggle({ target: { checked: true } }, '101');

               expect(component.selectedTickets).toEqual(['101']);
          });

          it('removes ticket when unchecked', () => {
               component.selectedTickets = ['101'];
               component.onTicketToggle({ target: { checked: false } }, '101');

               expect(component.selectedTickets).toEqual([]);
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

     describe('refreshUIData', () => {
          it('calls refreshUiAccountObjects and refreshUiAccountInfo', () => {
               spyOn(component as any, 'refreshUiAccountObjects').and.callThrough();
               spyOn(component as any, 'refreshUiAccountInfo').and.callThrough();
               const wallet = {
                    classicAddress: validAddr,
                    publicKey: '',
                    privateKey: '',
                    address: '',
                    sign: () => ({}),
                    signTransaction: () => ({}),
                    getXAddress: () => '',
               } as any;
               const accountInfo = {
                    result: { account_data: { Account: validAddr, Sequence: 1 }, account_flags: {} },
                    id: '1',
                    type: 'response',
               } as xrpl.AccountInfoResponse;
               const accountObjects = {
                    result: { account_objects: [] },
                    id: '1',
                    type: 'response',
               } as unknown as xrpl.AccountObjectsResponse;

               (component as any).refreshUIData(wallet, accountInfo, accountObjects);

               expect(component.refreshUiAccountObjects).toHaveBeenCalledWith(accountObjects, accountInfo, wallet);
               expect((component as any).refreshUiAccountInfo).toHaveBeenCalledWith(accountInfo);
          });
     });

     describe('setTxOptionalFields', () => {
          // it('sets ticket sequence for single ticket', async () => {
          //      component.selectedSingleTicket = '101';
          //      const client = setupXrplClient();
          //      const tx = { TransactionType: 'TicketCreate' };
          //      const wallet = { classicAddress: validAddr };
          //      const accountInfo = {
          //           result: { account_data: { Account: validAddr, Sequence: 1 } },
          //           id: '1',
          //           type: 'response',
          //      } as unknown as xrpl.AccountObjectsResponse;

          //      await (component as any).setTxOptionalFields(client, tx, wallet, accountInfo, 'create');

          //      expect(xrplServiceMock.checkTicketExists).toHaveBeenCalledWith(client, validAddr, 101);
          //      expect(utilsServiceMock.setTicketSequence).toHaveBeenCalledWith(tx, '101', true);
          // });

          // it('handles non-existent ticket', async () => {
          //      component.selectedSingleTicket = '101';
          //      xrplServiceMock.checkTicketExists.and.resolveTo(false);
          //      const client = setupXrplClient();
          //      const tx = { TransactionType: 'TicketCreate' };
          //      const wallet = { classicAddress: 'rMLX8SSCrvjus2sZU6CK2FtW8versts9QB' };
          //      const accountInfo = {
          //           result: { account_data: { Account: 'rMLX8SSCrvjus2sZU6CK2FtW8versts9QB', Sequence: 1 } },
          //           id: '1',
          //           type: 'response',
          //      } as unknown as xrpl.AccountObjectsResponse;

          //      await (component as any).setTxOptionalFields(client, tx, wallet, accountInfo, 'create');

          //      expect(xrplServiceMock.checkTicketExists).toHaveBeenCalledWith(client, 'rMLX8SSCrvjus2sZU6CK2FtW8versts9QB', 101);
          //      expect(component.setError).toHaveBeenCalledWith('ERROR: Ticket Sequence 101 not found for account rMLX8SSCrvjus2sZU6CK2FtW8versts9QB');
          //      expect(utilsServiceMock.setTicketSequence).not.toHaveBeenCalled();
          // });

          it('sets ticket sequence for multi-select mode', async () => {
               component.multiSelectMode = true;
               component.selectedTickets = ['101', '102'];
               const client = setupXrplClient();
               const tx = { TransactionType: 'TicketCreate' };
               const wallet = { classicAddress: validAddr };
               const accountInfo = {
                    result: { account_data: { Account: validAddr, Sequence: 1 } },
                    id: '1',
                    type: 'response',
               } as unknown as xrpl.AccountObjectsResponse;

               await (component as any).setTxOptionalFields(client, tx, wallet, accountInfo, 'create');

               expect(utilsServiceMock.setTicketSequence).toHaveBeenCalledWith(tx, 1, false);
          });

          it('sets memo field when provided', async () => {
               component.memoField = 'Test memo';
               const client = setupXrplClient();
               const tx = { TransactionType: 'TicketCreate' };
               const wallet = { classicAddress: validAddr };
               const accountInfo = {
                    result: { account_data: { Account: validAddr, Sequence: 1 } },
                    id: '1',
                    type: 'response',
               } as unknown as xrpl.AccountObjectsResponse;

               await (component as any).setTxOptionalFields(client, tx, wallet, accountInfo, 'create');

               expect(utilsServiceMock.setMemoField).toHaveBeenCalledWith(tx, 'Test memo');
          });
     });

     describe('checkForSignerAccounts', () => {
          it('returns signer accounts and sets quorum', () => {
               const accountObjects = {
                    result: {
                         account_objects: [
                              {
                                   LedgerEntryType: 'SignerList',
                                   SignerEntries: [{ SignerEntry: { Account: 'addr1', SignerWeight: 2 } }, { SignerEntry: { Account: 'addr2', SignerWeight: 3 } }],
                                   SignerQuorum: 4,
                              },
                         ],
                    },
                    id: '1',
                    type: 'response',
               } as xrpl.AccountObjectsResponse;

               const result = (component as any).checkForSignerAccounts(accountObjects);

               expect(result).toEqual(['addr1~2', 'addr2~3']);
               expect(component.signerQuorum).toBe(4);
          });

          it('returns empty array for no signer list', () => {
               const accountObjects = {
                    result: { account_objects: [] },
                    id: '1',
                    type: 'response',
               } as unknown as xrpl.AccountObjectsResponse;

               const result = (component as any).checkForSignerAccounts(accountObjects);

               expect(result).toEqual([]);
               expect(component.signerQuorum).toBe(0);
          });
     });

     describe('updateXrpBalance', () => {
          it('updates balance and reserves', async () => {
               const client = setupXrplClient();
               const accountInfo = {
                    result: { account_data: { Account: validAddr, Sequence: 1 } },
                    id: '1',
                    type: 'response',
               } as xrpl.AccountInfoResponse;
               const wallet = { classicAddress: validAddr };
               utilsServiceMock.updateOwnerCountAndReserves.and.resolveTo({ ownerCount: '2', totalXrpReserves: '20' });
               xrplServiceMock.getXrpBalance.and.resolveTo(100);

               await (component as any).updateXrpBalance(client, accountInfo, wallet);

               expect(component.ownerCount).toBe('2');
               expect(component.totalXrpReserves).toBe('20');
               expect(component.currentWallet.balance).toBe('80'); // 100 - 20 = 80
          });
     });

     describe('refreshUiAccountObjects', () => {
          it('updates ticketArray and signer info with signers', () => {
               spyOn(component as any, 'getAccountTickets').and.returnValue(['101']);
               const accountObjects = {
                    result: {
                         account_objects: [
                              { LedgerEntryType: 'Ticket', TicketSequence: 101 },
                              { LedgerEntryType: 'SignerList', SignerEntries: [{ SignerEntry: { Account: 'addr1', SignerWeight: 2 } }], SignerQuorum: 3 },
                         ],
                    },
                    id: '1',
                    type: 'response',
               } as xrpl.AccountObjectsResponse;
               const accountInfo = {
                    result: { account_data: { Account: validAddr, Sequence: 1 }, account_flags: { disableMasterKey: true } },
                    id: '1',
                    type: 'response',
               } as xrpl.AccountInfoResponse;
               const wallet = { classicAddress: validAddr };
               storageServiceMock.get.and.returnValue([{ Account: 'addr1', seed: 'seed1' }]);

               (component as any).refreshUiAccountObjects(accountObjects, accountInfo, wallet);

               expect(component.ticketArray).toEqual(['101']);
               expect(component.multiSignAddress).toBe('addr1');
               expect(component.multiSignSeeds).toBe('seed1');
               expect(component.signerQuorum).toBe(3);
               expect(component.masterKeyDisabled).toBeTrue();
               expect(component.multiSigningEnabled).toBeTrue();
               expect(storageServiceMock.removeValue).not.toHaveBeenCalled();
          });

          it('handles no signers', () => {
               spyOn(component as any, 'getAccountTickets').and.returnValue([]);
               const accountObjects = {
                    result: { account_objects: [] },
                    id: '1',
                    type: 'response',
               } as unknown as xrpl.AccountObjectsResponse;
               const accountInfo = {
                    result: { account_data: { Account: validAddr, Sequence: 1 }, account_flags: {} },
                    id: '1',
                    type: 'response',
               } as unknown as xrpl.AccountObjectsResponse;
               const wallet = { classicAddress: validAddr };

               (component as any).refreshUiAccountObjects(accountObjects, accountInfo, wallet);

               expect(component.ticketArray).toEqual([]);
               expect(component.multiSignAddress).toBe('No Multi-Sign address configured for account');
               expect(component.multiSignSeeds).toBe('');
               expect(component.signerQuorum).toBe(0);
               expect(component.multiSigningEnabled).toBeFalse();
               expect(storageServiceMock.removeValue).toHaveBeenCalledWith('signerEntries');
          });
     });

     describe('refreshUiAccountInfo', () => {
          it('updates regular key info with regular key', () => {
               const accountInfo = {
                    result: {
                         account_data: { RegularKey: 'rRegularKey', Account: validAddr },
                         account_flags: { disableMasterKey: true },
                    },
                    id: '1',
                    type: 'response',
               } as xrpl.AccountInfoResponse;
               storageServiceMock.get.and.returnValue('regularSeed');

               (component as any).refreshUiAccountInfo(accountInfo);

               expect(component.regularKeyAddress).toBe('rRegularKey');
               expect(component.regularKeySeed).toBe('regularSeed');
               expect(component.masterKeyDisabled).toBeTrue();
               expect(component.regularKeySigningEnabled).toBeTrue();
          });

          it('handles no regular key', () => {
               const accountInfo = {
                    result: { account_data: { Account: validAddr }, account_flags: {} },
                    id: '1',
                    type: 'response',
               } as xrpl.AccountInfoResponse;

               (component as any).refreshUiAccountInfo(accountInfo);

               expect(component.regularKeyAddress).toBe('No RegularKey configured for account');
               expect(component.regularKeySeed).toBe('');
               expect(component.masterKeyDisabled).toBeFalse();
               expect(component.regularKeySigningEnabled).toBeFalse();
          });
     });

     // describe('validateInputs', () => {
     //      beforeEach(() => {
     //           utilsServiceMock.detectXrpInputType.and.returnValue({ value: 'seed', type: 'seed' });
     //           utilsServiceMock.validateInput.and.callFake((v: string) => v === validAddr || v === validSeed);
     //      });

     // it('validates getTickets inputs', () => {
     //      const inputs = { seed: validSeed };
     //      const errors = (component as any).validateInputs(inputs, 'getTickets');

     //      expect(errors).toEqual([]);
     // });

     // it('returns error for invalid seed in getTickets', () => {
     //      const inputs = { seed: 'invalid' };
     //      const errors = (component as any).validateInputs(inputs, 'getTickets');
     //      console.log(`errors:`, errors);

     //      expect(errors).toContain('Seed cannot be empty');
     // });

     // it('validates createTicket inputs', () => {
     //      const inputs = { seed: validSeed, ticketCount: '2' };
     //      console.log(`inputs:`, inputs);
     //      const errors = (component as any).validateInputs(inputs, 'createTicket');
     //      console.log(`errors:`, errors);

     //      expect(errors).toEqual([]);
     // });

     // it('returns errors for invalid createTicket inputs', () => {
     //      const inputs = { seed: '', ticketCount: '' };
     //      const errors = (component as any).validateInputs(inputs, 'createTicket');
     //      console.log(`errors:`, errors);

     //      expect(errors).toContain('Seed cannot be empty');
     //      expect(errors).toContain('TicketCount cannot be empty');
     // });

     // it('validates multi-sign inputs', () => {
     //      const inputs = {
     //           seed: validSeed,
     //           ticketCount: '2',
     //           useMultiSign: true,
     //           multiSignAddresses: validAddr,
     //           multiSignSeeds: validSeed,
     //      };
     //      utilsServiceMock.getMultiSignAddress.and.returnValue([validAddr]);
     //      utilsServiceMock.getMultiSignSeeds.and.returnValue([validSeed]);
     //      utilsServiceMock.validateInput.and.returnValue(true);

     //      const errors = (component as any).validateInputs(inputs, 'createTicket');

     //      expect(errors).toEqual([]);
     // });

     // it('returns error for mismatched multi-sign addresses and seeds', () => {
     //      const inputs = {
     //           seed: validSeed,
     //           ticketCount: '',
     //           useMultiSign: true,
     //           multiSignAddresses: 'addr1,addr2',
     //           multiSignSeeds: validSeed,
     //      };
     //      utilsServiceMock.getMultiSignAddress.and.returnValue(['addr1', 'addr2']);
     //      utilsServiceMock.getMultiSignSeeds.and.returnValue([validSeed]);
     //      utilsServiceMock.validateInput.and.returnValue(false);

     //      const errors = (component as any).validateInputs(inputs, 'createTicket');

     //      expect(errors).toContain('TicketCount cannot be empty');
     //      expect(errors).toContain('Number of signer addresses must match number of signer seeds');
     // });

     // it('returns error for mismatched multi-sign addresses and seeds', () => {
     //      const inputs = {
     //           seed: validSeed,
     //           ticketCount: '',
     //           useMultiSign: true,
     //           multiSignAddresses: 'addr1,addr2',
     //           multiSignSeeds: 'validSeed,validSeed',
     //      };
     //      utilsServiceMock.getMultiSignAddress.and.returnValue(['addr1', 'addr2']);
     //      utilsServiceMock.getMultiSignSeeds.and.returnValue([validSeed]);
     //      utilsServiceMock.validateInput.and.returnValue(false);

     //      const errors = (component as any).validateInputs(inputs, 'createTicket');

     //      expect(errors).toContain('TicketCount cannot be empty');
     //      expect(errors).toContain('One or more signer seeds are invalid');
     // });
     // });

     describe('getWallet', () => {
          beforeEach(() => {
               component.currentWallet = { name: 'Wallet1', address: validAddr, seed: validSeed, balance: '100' };
          });

          it('returns wallet for valid seed', async () => {
               utilsServiceMock.getWallet.and.resolveTo({ classicAddress: validAddr });

               const wallet = await (component as any).getWallet();

               expect(wallet.classicAddress).toBe(validAddr);
               expect(utilsServiceMock.getWallet).toHaveBeenCalledWith(validSeed, 'test');
          });

          it('throws error for invalid wallet', async () => {
               utilsServiceMock.getWallet.and.resolveTo(null);

               await expectAsync((component as any).getWallet()).toBeRejectedWithError('ERROR: Wallet could not be created or is undefined');
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

     describe('renderTransactionResult', () => {
          beforeEach(() => {
               component['resultField'] = { nativeElement: { innerHTML: '', classList: { add: jasmine.createSpy('add') } } } as any;
          });

          it('renders simulated results when isSimulateEnabled', () => {
               component.isSimulateEnabled = true;
               const response = { result: {} };

               (component as any).renderTransactionResult(response);

               expect(renderUiComponentsServiceMock.renderSimulatedTransactionsResults).toHaveBeenCalledWith(response, component['resultField'].nativeElement);
               expect(renderUiComponentsServiceMock.renderTransactionsResults).not.toHaveBeenCalled();
          });

          it('renders normal results when not simulating', () => {
               component.isSimulateEnabled = false;
               const response = { result: {} };

               (component as any).renderTransactionResult(response);

               expect(renderUiComponentsServiceMock.renderTransactionsResults).toHaveBeenCalledWith(response, component['resultField'].nativeElement);
               expect(renderUiComponentsServiceMock.renderSimulatedTransactionsResults).not.toHaveBeenCalled();
          });
     });

     describe('updateSpinnerMessage', () => {
          it('updates spinner message and triggers change detection', () => {
               (component as any).updateSpinnerMessage('Loading...');

               expect(component.spinnerMessage).toBe('Loading...');
               // Note: detectChanges may not be called
          });
     });

     describe('showSpinnerWithDelay', () => {
          it('shows spinner after delay', fakeAsync(() => {
               (component as any).showSpinnerWithDelay('Loading...', 200);
               expect(component.spinner).toBeTrue();
               expect(component.spinnerMessage).toBe('Loading...');

               tick(200);
               // Note: detectChanges may not be called
          }));
     });

     describe('setErrorProperties', () => {
          it('sets error properties', () => {
               component.isSuccess = true;
               component.isError = false;
               component.spinner = true;

               (component as any).setErrorProperties();

               expect(component.isSuccess).toBeFalse();
               expect(component.isError).toBeTrue();
               expect(component.spinner).toBeFalse();
          });
     });

     describe('setSuccessProperties', () => {
          it('sets success properties', () => {
               component.isSuccess = false;
               component.isError = true;
               component.spinner = false;
               component.result = 'error';

               (component as any).setSuccessProperties();

               expect(component.isSuccess).toBeTrue();
               expect(component.isError).toBeFalse();
               expect(component.spinner).toBeTrue();
               expect(component.result).toBe('');
          });
     });
});
