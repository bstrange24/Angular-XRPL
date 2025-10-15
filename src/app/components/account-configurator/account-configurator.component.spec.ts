import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccountConfiguratorComponent } from './account-configurator.component';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { StorageService } from '../../services/storage.service';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';
import * as xrpl from 'xrpl';

describe('AccountConfiguratorComponent (isolated)', () => {
     let component: AccountConfiguratorComponent;
     let fixture: ComponentFixture<AccountConfiguratorComponent>;
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
               checkTicketExists: jasmine.createSpy('checkTicketExists'),
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
               imports: [AccountConfiguratorComponent],
               providers: [
                    { provide: XrplService, useValue: xrplServiceMock },
                    { provide: UtilsService, useValue: utilsServiceMock },
                    { provide: StorageService, useValue: storageServiceMock },
                    { provide: RenderUiComponentsService, useValue: renderUiComponentsServiceMock },
                    { provide: XrplTransactionService, useValue: xrplTransactionServiceMock },
               ],
          })
               .overrideComponent(AccountConfiguratorComponent, { set: { template: '' } })
               .compileComponents();

          fixture = TestBed.createComponent(AccountConfiguratorComponent);
          component = fixture.componentInstance;
          // Do not detect changes
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
          it('updates wallets and calls onAccountChange', () => {
               const spyAccountChange = spyOn(component, 'onAccountChange').and.stub();
               component.onWalletListChange([{ name: 'W', address: validAddr, seed: 's', balance: '0' }]);
               expect(component.wallets.length).toBe(1);
               expect(spyAccountChange).toHaveBeenCalled();
          });

          it('resets selected index when out of bounds', () => {
               component.selectedWalletIndex = 2;
               spyOn(component, 'onAccountChange').and.stub();
               component.onWalletListChange([{ name: 'W', address: validAddr } as any]);
               expect(component.selectedWalletIndex).toBe(0);
          });
     });

     describe('validateQuorum', () => {
          it('clamps to total weight and detects changes', () => {
               const detectSpy = spyOn((component as any).cdr, 'detectChanges').and.stub();
               component.signers = [
                    { account: 'a', seed: 's', weight: 2 },
                    { account: 'b', seed: 't', weight: 3 },
               ];
               component.signerQuorum = 10;

               component.validateQuorum();
               expect(component.signerQuorum).toBe(5);
               expect(detectSpy).toHaveBeenCalled();
          });
     });

     describe('toggleMultiSign', () => {
          it('clears signers when disabling', async () => {
               component.isMultiSign = false;
               const detectSpy = spyOn((component as any).cdr, 'detectChanges').and.stub();

               await component.toggleMultiSign();

               expect(utilsServiceMock.clearSignerList).toHaveBeenCalledWith(component.signers);
               expect(detectSpy).toHaveBeenCalled();
          });

          it('loads signers when enabling', async () => {
               component.isMultiSign = true;
               spyOn(component as any, 'getWallet').and.resolveTo({ classicAddress: validAddr });
               const detectSpy = spyOn((component as any).cdr, 'detectChanges').and.stub();

               await component.toggleMultiSign();

               expect(utilsServiceMock.loadSignerList).toHaveBeenCalledWith(validAddr, component.signers);
               expect(detectSpy).toHaveBeenCalled();
          });

          it('sets error on wallet retrieval failure', async () => {
               component.isMultiSign = true;
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
               const detectSpy = spyOn((component as any).cdr, 'detectChanges').and.stub();

               await component.toggleUseMultiSign();

               expect(component.multiSignSeeds).toBe('');
               expect(detectSpy).toHaveBeenCalled();
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

     describe('renderTransactionResult', () => {
          beforeEach(() => {
               (component as any).resultField = { nativeElement: document.createElement('div') };
          });

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
});
