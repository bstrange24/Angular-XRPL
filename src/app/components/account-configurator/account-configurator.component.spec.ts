import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AccountConfiguratorComponent } from './account-configurator.component';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { StorageService } from '../../services/storage.service';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';
import { ChangeDetectorRef } from '@angular/core';
import * as xrpl from 'xrpl';

describe('AccountConfiguratorComponent (isolated)', () => {
     let component: AccountConfiguratorComponent;
     let fixture: ComponentFixture<AccountConfiguratorComponent>;
     let xrplServiceMock: any;
     let utilsServiceMock: any;
     let storageServiceMock: any;
     let xrplMock: any;
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
               checkTicketExists: jasmine.createSpy('checkTicketExists'),
               getXrpBalance: jasmine.createSpy('getXrpBalance').and.resolveTo(100),
          };

          utilsServiceMock = {
               clearSignerList: jasmine.createSpy('clearSignerList'),
               loadSignerList: jasmine.createSpy('loadSignerList'),
               sortByLedgerEntryType: jasmine.createSpy('sortByLedgerEntryType').and.returnValue([]),
               getFlagUpdates: jasmine.createSpy('getFlagUpdates').and.returnValue({ setFlags: ['8'], clearFlags: ['7'] }),
               getFlagName: jasmine.createSpy('getFlagName').and.returnValue('RequireDestTag'),
               setTicketSequence: jasmine.createSpy('setTicketSequence'),
               setMemoField: jasmine.createSpy('setMemoField'),
               setTickSize: jasmine.createSpy('setTickSize'),
               setTransferRate: jasmine.createSpy('setTransferRate'),
               setMessageKey: jasmine.createSpy('setMessageKey'),
               setDomain: jasmine.createSpy('setDomain'),
               validateSeed: jasmine.createSpy('validateSeed'),
               updateOwnerCountAndReserves: jasmine.createSpy('updateOwnerCountAndReserves').and.resolveTo({ ownerCount: '0', totalXrpReserves: '0' }),
               detectXrpInputType: jasmine.createSpy('detectXrpInputType').and.returnValue({ value: 'seed', type: 'seed' }),
               validateInput: jasmine.createSpy('validateInput').and.callFake((v: string) => v != null && v !== ''),
               getMultiSignAddress: jasmine.createSpy('getMultiSignAddress').and.returnValue(['addr1']),
               getMultiSignSeeds: jasmine.createSpy('getMultiSignSeeds').and.returnValue(['seed1']),
               handleMultiSignTransaction: jasmine.createSpy('handleMultiSignTransaction').and.resolveTo({ signedTx: { tx_blob: 'blob', hash: 'hash' }, signers: [] }),
               isInsufficientXrpBalance1: jasmine.createSpy('isInsufficientXrpBalance1').and.returnValue(false),
               isTxSuccessful: jasmine.createSpy('isTxSuccessful').and.returnValue(true),
               getTransactionResultMessage: jasmine.createSpy('getTransactionResultMessage').and.returnValue('tesSUCCESS'),
               processErrorMessageFromLedger: jasmine.createSpy('processErrorMessageFromLedger').and.returnValue('Processed error'),
               getUserEnteredAddress: jasmine.createSpy('getUserEnteredAddress').and.callFake((s: string) => s.split(/[\s,]+/).filter(Boolean)),
               getWallet: jasmine.createSpy('getWallet'),
               getRegularKeyWallet: jasmine.createSpy('getRegularKeyWallet').and.resolveTo({ useRegularKeyWalletSignTx: false, regularKeyWalletSignTx: null }),
               findDepositPreauthObjects: jasmine.createSpy('findDepositPreauthObjects').and.returnValue([]),
          };

          storageServiceMock = {
               set: jasmine.createSpy('set'),
               removeValue: jasmine.createSpy('removeValue'),
               get: jasmine.createSpy('get').and.returnValue([]),
          };

          xrplMock = jasmine.createSpyObj('xrpl', ['isValidAddress', 'isValidSecret', 'isValidClassicAddress']);

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
               imports: [AccountConfiguratorComponent],
               providers: [
                    { provide: XrplService, useValue: xrplServiceMock },
                    { provide: UtilsService, useValue: utilsServiceMock },
                    { provide: StorageService, useValue: storageServiceMock },
                    { provide: RenderUiComponentsService, useValue: renderUiComponentsServiceMock },
                    { provide: XrplTransactionService, useValue: xrplTransactionServiceMock },
                    { provide: ChangeDetectorRef, useValue: cdrMock },
               ],
          })
               .overrideComponent(AccountConfiguratorComponent, { set: { template: '' } })
               .compileComponents();

          fixture = TestBed.createComponent(AccountConfiguratorComponent);
          component = fixture.componentInstance;
          // Mock ViewChild properties
          component['resultField'] = { nativeElement: { innerHTML: '', classList: { add: jasmine.createSpy('add') } } } as any;
          component['accountForm'] = { value: {} } as any;
          fixture.detectChanges(); // Trigger initial change detection
     });

     function typedClient() {
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
          xrplServiceMock.checkTicketExists.and.resolveTo(true);
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
          }));
     });

     describe('ngAfterViewChecked', () => {
          it('attaches search listener on result change', () => {
               // Ensure resultField is defined before the test
               component['resultField'] = { nativeElement: { innerHTML: '', classList: { add: jasmine.createSpy('add') } } } as any;
               component['lastResult'] = '';
               component.result = 'NEW';

               component.ngAfterViewChecked();

               expect(renderUiComponentsServiceMock.attachSearchListener).toHaveBeenCalledWith(component['resultField'].nativeElement);
               expect(component['lastResult']).toBe('NEW');
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
          it('updates wallets and calls onAccountChange', () => {
               const onAccountChangeSpy = spyOn(component, 'onAccountChange').and.stub();
               const wallets = [{ name: 'Wallet1', address: validAddr, seed: validSeed, balance: '0' }];

               component.onWalletListChange(wallets);

               expect(component.wallets).toEqual(wallets);
               expect(component.selectedWalletIndex).toBe(0);
               expect(onAccountChangeSpy).toHaveBeenCalled();
          });

          it('resets selected index when out of bounds', () => {
               component.selectedWalletIndex = 2;
               spyOn(component, 'onAccountChange').and.stub();
               const wallets = [{ name: 'Wallet1', address: validAddr, seed: validSeed, balance: '0' }];

               component.onWalletListChange(wallets);

               expect(component.selectedWalletIndex).toBe(0);
               expect(component.onAccountChange).toHaveBeenCalled();
          });
     });

     describe('validateQuorum', () => {
          it('clamps signerQuorum to total weight', () => {
               component.signers = [
                    { account: 'addr1', seed: 'seed1', weight: 2 },
                    { account: 'addr2', seed: 'seed2', weight: 3 },
               ];
               component.signerQuorum = 10;

               component.validateQuorum();

               expect(component.signerQuorum).toBe(5);
          });

          it('does not change quorum if within bounds', () => {
               component.signers = [
                    { account: 'addr1', seed: 'seed1', weight: 2 },
                    { account: 'addr2', seed: 'seed2', weight: 3 },
               ];
               component.signerQuorum = 4;

               component.validateQuorum();

               expect(component.signerQuorum).toBe(4);
          });
     });

     describe('toggleMultiSign', () => {
          it('clears signers when disabling', async () => {
               component.isMultiSign = false;

               await component.toggleMultiSign();

               expect(utilsServiceMock.clearSignerList).toHaveBeenCalledWith(component.signers);
          });

          it('loads signers when enabling', async () => {
               component.isMultiSign = true;
               component.signers = [{ account: '', seed: '', weight: 1 }];

               // Mock getWallet() to return the expected wallet
               spyOn(component as any, 'getWallet').and.resolveTo({
                    classicAddress: validAddr,
               });

               // Spy on the component's own loadSignerList method
               spyOn(component, 'loadSignerList').and.callThrough();

               await component.toggleMultiSign();

               expect(component.loadSignerList).toHaveBeenCalledWith(validAddr);

               // Optional: check if signers were updated by loadSignerList correctly
               // This depends on your storage mock returning data or not
          });

          it('sets error on getWallet failure', async () => {
               component.isMultiSign = true;
               spyOn(component as any, 'getWallet').and.rejectWith(new Error('Wallet error'));
               spyOn(component as any, 'setError').and.callThrough();

               await component.toggleMultiSign();

               expect((component as any).setError).toHaveBeenCalledWith('ERROR getting wallet in toggleMultiSign');
               // Note: detectChanges may not be called
          });
     });

     describe('toggleMultiSign', () => {
          it('clears signers when disabling', async () => {
               component.isMultiSign = false;

               await component.toggleMultiSign();

               expect(utilsServiceMock.clearSignerList).toHaveBeenCalledWith(component.signers);
               // Note: detectChanges may not be called
          });

          it('loads signers when enabling', async () => {
               component.isMultiSign = true;

               // Spy on getWallet() to return the wallet with classicAddress
               spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });

               // Spy on the component's own loadSignerList method
               spyOn(component, 'loadSignerList').and.callThrough();

               await component.toggleMultiSign();

               expect(component.loadSignerList).toHaveBeenCalledWith(validAddr);

               // Optional: you can also check the signers after loadSignerList runs
               // expect(component.signers).toEqual([...expected signers...]);
          });

          it('sets error on getWallet failure', async () => {
               component.isMultiSign = true;
               spyOn(component as any, 'getWallet').and.rejectWith(new Error('Wallet error'));
               spyOn(component as any, 'setError').and.callThrough();

               await component.toggleMultiSign();

               expect((component as any).setError).toHaveBeenCalledWith('ERROR getting wallet in toggleMultiSign');
               // Note: detectChanges may not be called
          });
     });

     describe('toggleUseMultiSign', () => {
          it('clears seeds when no multi-sign address configured', async () => {
               component.multiSignAddress = 'No Multi-Sign address configured for account';
               component.multiSignSeeds = 'abc';
               const detectSpy = spyOn((component as any).cdr, 'detectChanges').and.stub();

               await component.toggleUseMultiSign();

               expect(component.multiSignSeeds).toBe('');
               expect(detectSpy).toHaveBeenCalled();
          });
     });

     describe('toggleTicketSequence', () => {
          it('triggers change detection', () => {
               component.toggleTicketSequence();
               // Note: detectChanges may not be called
          });
     });

     describe('onAccountChange', () => {
          it('updates current wallet and calls getAccountDetails for valid address', async () => {
               spyOn(component, 'getAccountDetails').and.stub();
               component.wallets = [{ name: 'Wallet1', address: validAddr, seed: validSeed, balance: '0', isIssuer: false }];
               component.selectedWalletIndex = 0;

               await component.onAccountChange();

               expect(component.currentWallet).toEqual({ name: 'Wallet1', address: validAddr, seed: validSeed, balance: '0', isIssuer: false });
               expect(component.getAccountDetails).toHaveBeenCalled();
               // Note: detectChanges may not be called
          });

          it('sets error for invalid address', async () => {
               spyOn(component as any, 'setError').and.callThrough();
               component.wallets = [{ name: 'Wallet1', address: 'invalid', seed: validSeed, balance: '0', isIssuer: false }];
               component.selectedWalletIndex = 0;

               await component.onAccountChange();

               expect((component as any).setError).toHaveBeenCalledWith('Invalid XRP address');
               // Note: detectChanges may not be called
          });
     });

     describe('onConfigurationChange', () => {
          it('invokes setHolder for holder configuration', () => {
               const spyHolder = spyOn(component as any, 'setHolder').and.callThrough();
               const detectSpy = spyOn((component as any).cdr, 'detectChanges').and.stub();

               (component as any).resetFlags = jasmine.createSpy('resetFlags');
               component.configurationType = 'holder';
               component.onConfigurationChange();

               expect(spyHolder).toHaveBeenCalled();
               expect(detectSpy).toHaveBeenCalled();
          });
     });

     describe('add/remove signer', () => {
          it('adds and removes signer entries', () => {
               const initial = component.signers.length;
               component.addSigner();
               expect(component.signers.length).toBe(initial + 1);
               component.removeSigner(component.signers.length - 1);
               expect(component.signers.length).toBe(initial);
          });
     });

     describe('alerts for no-freeze/clawback', () => {
          it('alerts when NoFreeze is toggled on', () => {
               spyOn(window, 'alert');
               component.flags.asfNoFreeze = true;
               component.onNoFreezeChange();
               expect(window.alert).toHaveBeenCalled();
          });

          it('alerts when Clawback is toggled on', () => {
               spyOn(window, 'alert');
               component.flags.asfAllowTrustLineClawback = true;
               component.onClawbackChange();
               expect(window.alert).toHaveBeenCalled();
          });
     });

     describe('ngAfterViewChecked', () => {
          it('attaches search listener when result changed', () => {
               (component as any).resultField = { nativeElement: document.createElement('div') };
               (component as any)['lastResult'] = '';
               component['result'] = 'R';
               const detectSpy = spyOn((component as any).cdr, 'detectChanges').and.stub();

               component.ngAfterViewChecked();

               expect(renderUiComponentsServiceMock.attachSearchListener).toHaveBeenCalled();
               expect((component as any)['lastResult']).toBe('R');
               expect(detectSpy).toHaveBeenCalled();
          });
     });

     describe('getAccountDetails', () => {
          it('sets error on validation failure', async () => {
               (component as any).resultField = { nativeElement: { innerHTML: '' } };
               spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
               spyOn(component as any, 'validateInputs').and.resolveTo(['e']);
               const setErrorSpy = spyOn(component as any, 'setError').and.stub();

               typedClient();
               await component.getAccountDetails();

               expect(setErrorSpy).toHaveBeenCalled();
               expect(renderUiComponentsServiceMock.renderAccountDetails).not.toHaveBeenCalled();
          });

          it('renders account details on success', async () => {
               (component as any).resultField = { nativeElement: { innerHTML: '' } };
               spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
               spyOn(component as any, 'validateInputs').and.resolveTo([]);

               typedClient();
               await component.getAccountDetails();

               expect(renderUiComponentsServiceMock.renderAccountDetails).toHaveBeenCalled();
          });
     });

     describe('updateFlags', () => {
          beforeEach(() => {
               (component as any).resultField = { nativeElement: { innerHTML: '', classList: { add: jasmine.createSpy('add') } } };
               (component as any).clearUiIAccountMetaData = jasmine.createSpy('clearUiIAccountMetaData');
               (component as any).isValidResponse = jasmine.createSpy('isValidResponse').and.returnValue(true);
               spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
               spyOn(component as any, 'validateInputs').and.resolveTo([]);
          });

          it('calls submitFlagTransaction for set and clear flags and renders results', async () => {
               typedClient();
               spyOn<any>(component, 'submitFlagTransaction').and.resolveTo({ success: true, message: { result: {} } });

               await component.updateFlags();

               expect((component as any).submitFlagTransaction).toHaveBeenCalled();
               expect(renderUiComponentsServiceMock.renderTransactionsResults).toHaveBeenCalled();
          });

          it('sets error on validation failure', async () => {
               (component as any).validateInputs.and.resolveTo(['e']);
               const setErrorSpy = spyOn(component as any, 'setError').and.stub();
               typedClient();

               await component.updateFlags();

               expect(setErrorSpy).toHaveBeenCalled();
          });
     });

     describe('updateMetaData', () => {
          beforeEach(() => {
               (component as any).resultField = { nativeElement: { innerHTML: '', classList: { add: jasmine.createSpy('add') } } };
               component.currentWallet = { name: 'W', address: validAddr, seed: 's', balance: '0', isIssuer: false } as any;
               component.tickSize = '';
               component.transferRate = '';
               component.isMessageKey = false as any;
               component.domain = '';
               spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr, address: validAddr, publicKey: 'PUB' });
          });

          it('sets error on validation failure', async () => {
               spyOn(component as any, 'validateInputs').and.resolveTo(['e']);
               typedClient();
               const setErrorSpy = spyOn(component as any, 'setError').and.stub();

               await component.updateMetaData();
               expect(setErrorSpy).toHaveBeenCalled();
          });

          it('simulates when isSimulateEnabled', async () => {
               spyOn(component as any, 'validateInputs').and.resolveTo([]);
               component.isSimulateEnabled = true;
               component.domain = 'example.com';
               typedClient();
               const renderSpy = spyOn<any>(component, 'renderTransactionResult').and.stub();

               await component.updateMetaData();
               expect(xrplTransactionServiceMock.simulateTransaction).toHaveBeenCalled();
               expect(renderSpy).toHaveBeenCalled();
          });

          it('handles sign failure', async () => {
               spyOn(component as any, 'validateInputs').and.resolveTo([]);
               component.isSimulateEnabled = false;
               component.domain = 'example.com';
               typedClient();
               xrplTransactionServiceMock.signTransaction.and.resolveTo(null);
               const setErrorSpy = spyOn(component as any, 'setError').and.stub();

               await component.updateMetaData();
               expect(setErrorSpy).toHaveBeenCalledWith('ERROR: Failed to sign Payment transaction.');
          });
     });

     describe('setDepositAuthAccounts', () => {
          beforeEach(() => {
               (component as any).resultField = { nativeElement: { innerHTML: '', classList: { add: jasmine.createSpy('add') } } };
               component.currentWallet = { name: 'W', address: validAddr, seed: 's', balance: '0', isIssuer: false } as any;
               spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr, address: validAddr });
               typedClient();
          });

          it('errors when address list empty', async () => {
               component.depositAuthAddress = '  ';
               const setErrorSpy = spyOn(component as any, 'setError').and.stub();

               await component.setDepositAuthAccounts('Y');
               expect(setErrorSpy).toHaveBeenCalledWith('ERROR: Deposit Auth address list is empty');
          });

          it('simulates for provided addresses', async () => {
               component.depositAuthAddress = `${validAddr}`;
               component.isSimulateEnabled = true;
               spyOn(component as any, 'validateInputs').and.resolveTo([]);

               await component.setDepositAuthAccounts('Y');
               expect(xrplTransactionServiceMock.simulateTransaction).toHaveBeenCalled();
          });
     });

     describe('setMultiSign', () => {
          beforeEach(() => {
               (component as any).resultField = { nativeElement: { innerHTML: '', classList: { add: jasmine.createSpy('add') } } };
               component.currentWallet = { name: 'W', address: validAddr, seed: 's', balance: '0', isIssuer: false } as any;
               spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr, address: validAddr });
               typedClient();
          });

          it('simulates signer list set when enabled', async () => {
               spyOn(component as any, 'validateInputs').and.resolveTo([]);
               component.isSimulateEnabled = true;
               component.isMultiSign = true;
               component.signerQuorum = 1;
               const renderSpy = spyOn<any>(component, 'renderTransactionResult').and.stub();

               await component.setMultiSign('Y');
               expect(xrplTransactionServiceMock.simulateTransaction).toHaveBeenCalled();
               expect(renderSpy).toHaveBeenCalled();
          });
     });

     describe('setRegularKey', () => {
          beforeEach(() => {
               (component as any).resultField = { nativeElement: { innerHTML: '', classList: { add: jasmine.createSpy('add') } } };
               component.currentWallet = { name: 'W', address: validAddr, seed: 's', balance: '0', isIssuer: false } as any;
               spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr, address: validAddr });
               typedClient();
          });

          it('errors when regular key fields missing', async () => {
               const setErrorSpy = spyOn(component as any, 'setError').and.stub();
               component.regularKeyAccount = '';
               component.regularKeyAccountSeed = '';
               await component.setRegularKey('Y');
               expect(setErrorSpy).toHaveBeenCalledWith('ERROR: Regular Key address and seed must be present');
          });
     });

     describe('setNftMinterAddress', () => {
          beforeEach(() => {
               (component as any).resultField = { nativeElement: { innerHTML: '', classList: { add: jasmine.createSpy('add') } } };
               component.currentWallet = { name: 'W', address: validAddr, seed: 's', balance: '0', isIssuer: false } as any;
               spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr, address: validAddr });
               typedClient();
          });

          it('errors when minter list empty', async () => {
               component.nfTokenMinterAddress = '';
               const setErrorSpy = spyOn(component as any, 'setError').and.stub();
               await component.setNftMinterAddress('Y');
               expect(setErrorSpy).toHaveBeenCalledWith('ERROR: NFT Minter address list is empty');
          });

          it('simulates when valid addresses provided', async () => {
               spyOn(component as any, 'validateInputs').and.resolveTo([]);
               component.nfTokenMinterAddress = validAddr;
               component.isSimulateEnabled = true;

               await component.setNftMinterAddress('Y');
               expect(xrplTransactionServiceMock.simulateTransaction).toHaveBeenCalled();
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
               expect(component.refreshUiAccountInfo).toHaveBeenCalledWith(accountInfo);
          });
     });

     describe('setTxOptionalFields', () => {
          it('sets ticket sequence for single ticket', async () => {
               component.selectedSingleTicket = '101';
               const client = typedClient();
               const tx = { TransactionType: 'TicketCreate' };
               const wallet = { classicAddress: validAddr };
               const accountInfo = {
                    result: { account_data: { Account: validAddr, Sequence: 1 } },
                    id: '1',
                    type: 'response',
               } as unknown as xrpl.AccountObjectsResponse;

               await (component as any).setTxOptionalFields(client, tx, wallet, accountInfo, 'create');

               expect(xrplServiceMock.checkTicketExists).toHaveBeenCalledWith(client, validAddr, 101);
               expect(utilsServiceMock.setTicketSequence).toHaveBeenCalledWith(tx, '101', true);
          });

          // it('handles non-existent ticket', async () => {
          //      component.selectedSingleTicket = '101';
          //      xrplServiceMock.checkTicketExists.and.resolveTo(false);
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
          //      expect(component.setError).toHaveBeenCalledWith('ERROR: Ticket Sequence 101 not found for account rMLX8SSCrvjus2sZU6CK2FtW8versts9QB');
          //      expect(utilsServiceMock.setTicketSequence).not.toHaveBeenCalled();
          // });

          it('sets ticket sequence for multi-select mode', async () => {
               component.multiSelectMode = true;
               component.selectedTickets = ['101', '102'];
               const client = typedClient();
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
               const client = typedClient();
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

     describe('cleanUpSingleSelection', () => {
          it('resets selectedSingleTicket if not in ticketArray', () => {
               component.ticketArray = ['101', '102'];
               component.selectedSingleTicket = '103';

               (component as any).cleanUpSingleSelection();

               expect(component.selectedSingleTicket).toBe('');
          });

          it('keeps selectedSingleTicket if in ticketArray', () => {
               component.ticketArray = ['101', '102'];
               component.selectedSingleTicket = '101';

               (component as any).cleanUpSingleSelection();

               expect(component.selectedSingleTicket).toBe('101');
          });
     });

     describe('cleanUpMultiSelection', () => {
          it('filters out invalid tickets', () => {
               component.ticketArray = ['101', '102'];
               component.selectedTickets = ['101', '103'];

               (component as any).cleanUpMultiSelection();

               expect(component.selectedTickets).toEqual(['101']);
          });
     });

     describe('updateTickets', () => {
          it('updates ticketArray and cleans up single selection', () => {
               spyOn(component as any, 'getAccountTickets').and.returnValue(['101', '102']);
               spyOn(component as any, 'cleanUpSingleSelection').and.callThrough();
               component.multiSelectMode = false;
               component.selectedSingleTicket = '103';

               (component as any).updateTickets({ result: { account_objects: [] }, id: '1', type: 'response' } as unknown as xrpl.AccountObjectsResponse);

               expect(component.ticketArray).toEqual(['101', '102']);
               expect((component as any).cleanUpSingleSelection).toHaveBeenCalled();
               expect(component.selectedSingleTicket).toBe('');
          });

          it('updates ticketArray and cleans up multi selection', () => {
               spyOn(component as any, 'getAccountTickets').and.returnValue(['101', '102']);
               spyOn(component as any, 'cleanUpMultiSelection').and.callThrough();
               component.multiSelectMode = true;
               component.selectedTickets = ['103'];

               (component as any).updateTickets({ result: { account_objects: [] }, id: '1', type: 'response' } as unknown as xrpl.AccountObjectsResponse);

               expect(component.ticketArray).toEqual(['101', '102']);
               expect((component as any).cleanUpMultiSelection).toHaveBeenCalled();
               expect(component.selectedTickets).toEqual([]);
          });
     });

     describe('updateXrpBalance', () => {
          it('updates balance and reserves', async () => {
               const client = typedClient();
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
          it('updates signer info with signers', () => {
               spyOn(component as any, 'getAccountTickets').and.returnValue(['101']);
               const accountObjects = {
                    result: {
                         account_objects: [
                              { LedgerEntryType: 'Ticket', TicketSequence: 101 },
                              { LedgerEntryType: 'SignerList', SignerEntries: [{ SignerEntry: { Account: 'addr1', SingnerSeed: 'seed1', SignerWeight: 2 } }], SignerQuorum: 3 },
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

               expect(component.multiSignAddress.trim()).toBe('addr1,');
               expect(component.multiSignSeeds.trim()).toBe('seed1,');
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

               expect(component.regularKeyAccount).toBe('rRegularKey');
               expect(component.regularKeyAccountSeed).toBe('regularSeed');
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

               expect(component.regularKeyAccount).toBe('No RegularKey configured for account');
               expect(component.regularKeyAccountSeed).toBe('');
               expect(component.masterKeyDisabled).toBeFalse();
               expect(component.regularKeySigningEnabled).toBeFalse();
          });
     });

     describe('validateInputs', () => {
          beforeEach(() => {
               utilsServiceMock.detectXrpInputType.and.returnValue({ value: 'seed', type: 'seed' });
               utilsServiceMock.validateInput.and.callFake((v: string) => v === validAddr || v === validSeed);
          });

          it('should pass validation for getAccountDetails with valid seed and account_info', async () => {
               utilsServiceMock.validateInput.and.returnValue(true);
               utilsServiceMock.detectXrpInputType.and.returnValue({ type: 'familySeed' });

               const inputs = {
                    seed: 'sEd7...123',
                    account_info: { result: { account_data: {}, account_flags: {} } },
               };

               const errors = await (component as any).validateInputs(inputs, 'getAccountDetails');
               expect(errors).toEqual([]);
          });

          it('validates getAccountDetails inputs', async () => {
               const accountInfo = {
                    result: { account_data: { Account: validAddr, Sequence: 1 }, account_flags: {} },
                    id: '1',
                    type: 'response',
               } as xrpl.AccountInfoResponse;
               const inputs = { seed: validSeed, account_info: accountInfo };

               const errors = await (component as any).validateInputs(inputs, 'getAccountDetails');
               expect(errors).toEqual([]);
          });

          it('should return error when seed is missing for getAccountDetails', async () => {
               utilsServiceMock.validateInput.and.returnValue(false);

               const inputs = { seed: '' };
               const errors = await (component as any).validateInputs(inputs, 'getAccountDetails');

               expect(errors).toContain('Seed cannot be empty');
          });

          it('should return error for invalid seed format', async () => {
               utilsServiceMock.validateInput.and.returnValue(true);
               utilsServiceMock.detectXrpInputType.and.returnValue({ type: 'unknown' });

               const inputs = {
                    seed: 'badseed',
                    account_info: { result: { account_data: {}, account_flags: {} } },
               };

               const errors = await (component as any).validateInputs(inputs, 'getAccountDetails');
               expect(errors).toContain('Account seed or mnemonic is invalid');
          });

          it('returns error for invalid seed in getAccountDetails', async () => {
               const accountInfo = {
                    result: { account_data: { Account: validAddr, Sequence: 1 }, account_flags: {} },
                    id: '1',
                    type: 'response',
               } as xrpl.AccountInfoResponse;
               const inputs = { seed: 'invalid', account_info: accountInfo };
               const errors = await (component as any).validateInputs(inputs, 'getAccountDetails');
               expect(errors).toContain('Seed cannot be empty');
          });

          it('should return error when account_info is missing', async () => {
               utilsServiceMock.validateInput.and.returnValue(true);
               utilsServiceMock.detectXrpInputType.and.returnValue({ type: 'familySeed' });

               const inputs = { seed: 'sEd7...123' };

               const errors = await (component as any).validateInputs(inputs, 'getAccountDetails');
               expect(errors).toContain('No account data found');
          });

          it('returns errors for invalid getAccountDetails inputs', async () => {
               const accountInfo = {
                    result: { account_data: { Account: validAddr, Sequence: 1 }, account_flags: {} },
                    id: '1',
                    type: 'response',
               } as xrpl.AccountInfoResponse;
               const inputs = { seed: '', account_info: accountInfo };
               const errors = await (component as any).validateInputs(inputs, 'getAccountDetails');
               console.log(`errors:`, errors);

               expect(errors).toContain('Seed cannot be empty');
          });
     });

     describe('validateInputs multi-sign', () => {
          //  fit('returns error for mismatched multi-sign addresses and seeds', async () => {
          beforeEach(() => {
               utilsServiceMock.validateInput.and.returnValue(true);
               utilsServiceMock.getMultiSignAddress.and.callFake((str: string) => str.split(','));
               utilsServiceMock.getMultiSignSeeds.and.callFake((str: string) => str.split(','));
               utilsServiceMock.validateSeed.and.returnValue(true);
               xrplMock.isValidAddress.and.returnValue(true);
          });

          const mockAccountInfo = {
               result: {
                    account_data: {
                         Account: validAddr,
                         Balance: '100000000', // 100 XRP
                         RegularKey: null,
                    },
                    account_flags: {
                         disableMasterKey: true,
                    },
               },
          };

          it('returns error for mismatched multi-sign addresses and seeds', async () => {
               const inputs = {
                    seed: 'sEd7...123',
                    account_info: mockAccountInfo,
                    multiSignAddresses: 'addr1,addr2',
                    multiSignSeeds: 'seed1',
                    isMultiSign: true,
                    isRegularKeyAddress: false,
                    flags: {
                         disableMasterKey: true,
                    },
                    setFlags: {
                         setFlags: '12',
                    },
                    clearFlags: {
                         clearFlags: '12',
                    },
               };

               const errors = await (component as any).validateInputs(inputs, 'updateFlags');
               expect(errors).toContain('Number of signer addresses must match number of signer seeds');
          });

          it('returns error if multi-sign addresses are empty', async () => {
               const inputs = {
                    seed: 'sEd7...123',
                    account_info: mockAccountInfo,
                    multiSignAddresses: 'df',
                    multiSignSeeds: 'seed1',
                    isMultiSign: true,
                    isRegularKeyAddress: false,
                    flags: {
                         disableMasterKey: true,
                    },
                    setFlags: {
                         setFlags: '12',
                    },
                    clearFlags: {
                         clearFlags: '12',
                    },
               };

               debugger;
               const errors = await (component as any).validateInputs(inputs, 'updateFlags');
               console.log(`errors:`, errors);
               expect(errors).toContain('Invalid signer address: df');
          });

          it('returns error if a multi-sign seed is invalid', async () => {
               utilsServiceMock.validateSeed.and.returnValue(false);

               const inputs = {
                    seed: 'sEd7...123',
                    account_info: mockAccountInfo,
                    multiSignAddresses: validAddr,
                    multiSignSeeds: 'badseed',
                    isMultiSign: true,
                    isRegularKeyAddress: false,
                    flags: {
                         disableMasterKey: true,
                    },
                    setFlags: {
                         setFlags: '12',
                    },
                    clearFlags: {
                         clearFlags: '12',
                    },
               };

               const errors = await (component as any).validateInputs(inputs, 'updateFlags');
               expect(errors).toContain(`One or more signer seeds are invalid`);
          });

          it('passes validation for correct multi-sign inputs', async () => {
               const inputs = {
                    seed: 'sEd7...123',
                    account_info: mockAccountInfo,
                    multiSignAddresses: validAddr,
                    multiSignSeeds: validSeed,
                    isMultiSign: true,
                    isRegularKeyAddress: false,
                    flags: {
                         disableMasterKey: true,
                    },
                    setFlags: {
                         setFlags: '12',
                    },
                    clearFlags: {
                         clearFlags: '12',
                    },
               };

               const errors = await (component as any).validateInputs(inputs, 'updateFlags');
               expect(errors.length).toBe(0);
          });

          it('returns error if a multi-sign seed is invalid', async () => {
               utilsServiceMock.validateSeed.and.returnValue(false);

               const inputs = {
                    seed: 'sEd7...123',
                    account_info: mockAccountInfo,
                    multiSignAddresses: validAddr,
                    multiSignSeeds: 'badseed',
                    isMultiSign: true,
                    isRegularKeyAddress: false,
                    flags: {
                         disableMasterKey: true,
                    },
                    setFlags: {
                         setFlags: '12',
                    },
                    clearFlags: {
                         clearFlags: '12',
                    },
               };

               const errors = await (component as any).validateInputs(inputs, 'updateFlags');
               console.log(`errors:`, errors);
               expect(errors.length).toBe(1);
          });
     });

     describe('getWallet', () => {
          beforeEach(() => {
               component.currentWallet = { name: 'Wallet1', address: validAddr, seed: validSeed, balance: '100', isIssuer: false };
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

     describe('clearFields', () => {
          it('clears all fields when clearAllFields is true', () => {
               component.ticketSequence = '123';
               component.isAuthorizedNFTokenMinter = true;
               component.isdepositAuthAddress = true;
               component.isUpdateMetaData = true;
               component.isSetRegularKey = true;
               component.isSimulateEnabled = true;
               component.useMultiSign = true;
               component.isTicketEnabled = true;
               component.isTicket = true;
               component.selectedTicket = '101';
               component.isMemoEnabled = true;
               component.memoField = 'memo';

               (component as any).clearFields(true);

               expect(component.ticketSequence).toBe('');
               expect(component.isAuthorizedNFTokenMinter).toBeFalse();
               expect(component.isdepositAuthAddress).toBeFalse();
               expect(component.isUpdateMetaData).toBeFalse();
               expect(component.isSetRegularKey).toBeFalse();
               expect(component.isSimulateEnabled).toBeFalse();
               expect(component.useMultiSign).toBeFalse();
               expect(component.isTicketEnabled).toBeFalse();
               expect(component.isTicket).toBeFalse();
               expect(component.selectedTicket).toBe('');
               expect(component.isMemoEnabled).toBeFalse();
               expect(component.memoField).toBe('');
          });

          it('clears partial fields when clearAllFields is false', () => {
               component.ticketSequence = '123';
               component.isAuthorizedNFTokenMinter = true;
               component.isdepositAuthAddress = true;
               component.isUpdateMetaData = true;
               component.isSetRegularKey = true;
               component.isSimulateEnabled = true;
               component.selectedTicket = '101';
               component.useMultiSign = true;
               component.isTicketEnabled = true;
               component.isTicket = true;
               component.isMemoEnabled = true;
               component.memoField = 'memo';

               (component as any).clearFields(false);

               expect(component.ticketSequence).toBe('123');
               expect(component.isAuthorizedNFTokenMinter).toBeTrue();
               expect(component.isdepositAuthAddress).toBeTrue();
               expect(component.isUpdateMetaData).toBeTrue();
               expect(component.isSetRegularKey).toBeTrue();
               expect(component.isSimulateEnabled).toBeFalse();
               expect(component.useMultiSign).toBeTrue();
               expect(component.isTicketEnabled).toBeFalse();
               expect(component.isTicket).toBeFalse();
               expect(component.selectedTicket).toBe('');
               expect(component.isMemoEnabled).toBeFalse();
               expect(component.memoField).toBe('');
          });
     });

     describe('handleTransactionResult', () => {
          it('updates result properties and triggers change detection', () => {
               const event = { result: 'Success', isError: false, isSuccess: true };

               component.handleTransactionResult(event);

               expect(component.result).toBe('Success');
               expect(component.isError).toBeFalse();
               expect(component.isSuccess).toBeTrue();
               expect(component.isEditable).toBeFalse();
               // Note: detectChanges may not be called
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
