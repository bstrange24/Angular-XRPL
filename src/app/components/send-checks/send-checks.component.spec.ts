import { ComponentFixture, TestBed } from '@angular/core/testing';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { StorageService } from '../../services/storage.service';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';
import { XrplTransactionService } from '../../services/xrpl-transactions/xrpl-transaction.service';
import * as xrpl from 'xrpl';
import { SendChecksComponent } from './send-checks.component';

describe('SendChecksComponent', () => {
     let component: SendChecksComponent;
     let fixture: ComponentFixture<SendChecksComponent>;
     let xrplServiceMock: any;
     let utilsServiceMock: any;
     let storageServiceMock: any;
     let renderUiComponentsServiceMock: any;
     let xrplTransactionServiceMock: any;

     const validAddr = 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe';
     const validSeed = 'ssgapRpEdpZA9VUmbghGEvUqLkJYg';

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
               addTime: jasmine.createSpy('addTime').and.callFake((v: string, unit: string) => 0),
               convertXRPLTime: jasmine.createSpy('convertXRPLTime').and.callFake((t: number) => `t${t}`),
               convertDateTimeToRippleTime: jasmine.createSpy('convertDateTimeToRippleTime').and.returnValue(0),
               encodeCurrencyCode: jasmine.createSpy('encodeCurrencyCode').and.callFake((c: string) => c),
               decodeIfNeeded: jasmine.createSpy('decodeIfNeeded').and.callFake((c: string) => c),
               formatCurrencyForDisplay: jasmine.createSpy('formatCurrencyForDisplay').and.callFake((c: string) => c),
               formatTokenBalance: jasmine.createSpy('formatTokenBalance').and.callFake((v: string) => v),
               isEscrow: jasmine.createSpy('isEscrow').and.callFake((o: any) => o?.LedgerEntryType === 'Escrow'),
               isRippleState: jasmine.createSpy('isRippleState').and.callFake((o: any) => o?.LedgerEntryType === 'RippleState'),
               isMPT: jasmine.createSpy('isMPT').and.callFake((o: any) => o?.LedgerEntryType === 'MPToken'),
               getMptFlagsReadable: jasmine.createSpy('getMptFlagsReadable').and.returnValue(''),
               updateOwnerCountAndReserves: jasmine.createSpy('updateOwnerCountAndReserves').and.resolveTo({ ownerCount: '0', totalXrpReserves: '0' }),
               checkTimeBasedEscrowStatus: jasmine.createSpy('checkTimeBasedEscrowStatus').and.returnValue({ canFinish: true, canCancel: true }),
               encodeIfNeeded: jasmine.createSpy('encodeIfNeeded').and.callFake((s: string) => s),
               detectXrpInputType: jasmine.createSpy('detectXrpInputType').and.returnValue({ value: 'seed', type: 'seed' }),
               getMultiSignAddress: jasmine.createSpy('getMultiSignAddress').and.returnValue(['addr1']),
               getMultiSignSeeds: jasmine.createSpy('getMultiSignSeeds').and.returnValue(['seed1']),
               validateInput: jasmine.createSpy('validateInput').and.callFake((v: string) => v != null && v !== ''),
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
               imports: [SendChecksComponent],
               providers: [
                    { provide: XrplService, useValue: xrplServiceMock },
                    { provide: UtilsService, useValue: utilsServiceMock },
                    { provide: StorageService, useValue: storageServiceMock },
                    { provide: RenderUiComponentsService, useValue: renderUiComponentsServiceMock },
                    { provide: XrplTransactionService, useValue: xrplTransactionServiceMock },
               ],
          })
               .overrideComponent(SendChecksComponent, { set: { template: '' } })
               .compileComponents();

          fixture = TestBed.createComponent(SendChecksComponent);
          component = fixture.componentInstance;
     });

     it('should create', () => {
          expect(component).toBeTruthy();
     });

     describe('onWalletListChange', () => {
          it('updates wallets and calls updateDestinations and onAccountChange', () => {
               const updateDestinationsSpy = spyOn(component as any, 'updateDestinations').and.stub();
               const onAccountChangeSpy = spyOn(component, 'onAccountChange').and.stub();

               const wallets = [{ name: 'W', address: validAddr, seed: 's', balance: '0' }];
               component.onWalletListChange(wallets as any[]);

               expect(component.wallets).toEqual(wallets as any[]);
               expect(updateDestinationsSpy).toHaveBeenCalled();
               expect(onAccountChangeSpy).toHaveBeenCalled();
          });
     });

     // helper to provide minimal typed client and server info when needed elsewhere
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
