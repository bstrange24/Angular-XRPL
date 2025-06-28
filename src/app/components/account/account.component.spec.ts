import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccountComponent } from './account.component';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';
import { of } from 'rxjs';

describe('AccountComponent', () => {
     let component: AccountComponent;
     let fixture: ComponentFixture<AccountComponent>;

     let mockXrplService: jasmine.SpyObj<XrplService>;
     let mockUtilsService: jasmine.SpyObj<UtilsService>;

     beforeEach(async () => {
          mockXrplService = jasmine.createSpyObj('XrplService', ['getClient', 'getNet']);
          mockUtilsService = jasmine.createSpyObj('UtilsService', ['validatInput', 'renderTransactionsResults']);

          await TestBed.configureTestingModule({
               imports: [AccountComponent],
               providers: [
                    { provide: XrplService, useValue: mockXrplService },
                    { provide: UtilsService, useValue: mockUtilsService },
               ],
          }).compileComponents();

          fixture = TestBed.createComponent(AccountComponent);
          component = fixture.componentInstance;

          // Mock DOM element
          component.resultField = {
               nativeElement: document.createElement('div'),
          } as any;

          fixture.detectChanges();
     });

     it('should create', () => {
          expect(component).toBeTruthy();
     });

     it('should return error if no account is selected', async () => {
          component.selectedAccount = null;
          const setErrorSpy = spyOn(component as any, 'setError');

          await component.setMultiSign('Y');

          expect(setErrorSpy).toHaveBeenCalledWith('Please select an account');
     });

     it('should return error for invalid seed', async () => {
          component.selectedAccount = 'account1';
          component.account1 = { seed: '' } as any;
          mockUtilsService.validatInput.and.returnValue(false);
          const setErrorSpy = spyOn(component as any, 'setError');

          await component.setMultiSign('Y');

          expect(setErrorSpy).toHaveBeenCalledWith('ERROR: Account seed cannot be empty');
     });

     it('should return error for empty multi-sign list', async () => {
          component.selectedAccount = 'account1';
          component.account1 = { seed: 'sEd...' } as any;
          mockUtilsService.validatInput.and.returnValue(true);
          mockXrplService.getNet.and.returnValue({ net: 'Testnet', environment: 'testnet' });
          mockXrplService.getClient.and.resolveTo({} as any);

          component.multiSignAddress = '';
          const setErrorSpy = spyOn(component as any, 'setError');

          await component.setMultiSign('Y');

          expect(setErrorSpy).toHaveBeenCalledWith('ERROR: Multi-sign address list is empty');
     });

     it('should return error for duplicate addresses', async () => {
          component.selectedAccount = 'account1';
          component.account1 = { seed: 'sEd...' } as any;
          mockUtilsService.validatInput.and.returnValue(true);
          mockXrplService.getNet.and.returnValue({ net: 'Testnet', environment: 'testnet' });

          component.multiSignAddress = 'rAddress1, rAddress1';
          const setErrorSpy = spyOn(component as any, 'setError');
          const mockClient = {
               autofill: jasmine.createSpy(),
               submitAndWait: jasmine.createSpy(),
          };
          mockXrplService.getClient.and.resolveTo(mockClient as any);
          spyOn<any>(window, 'xrpl').and.returnValue({
               isValidClassicAddress: () => true,
               Wallet: {
                    fromSeed: () => ({ classicAddress: 'rAddress1' }),
               },
          });

          await component.setMultiSign('Y');

          expect(setErrorSpy).toHaveBeenCalledWith(jasmine.stringMatching(/Duplicate addresses/));
     });

     it('should handle successful signer list set', async () => {
          component.selectedAccount = 'account1';
          component.account1 = { seed: 'sEd...' } as any;
          mockUtilsService.validatInput.and.returnValue(true);
          mockXrplService.getNet.and.returnValue({ net: 'Testnet', environment: 'testnet' });

          component.multiSignAddress = 'rSigner1,rSigner2';
          spyOn<any>(window, 'xrpl').and.returnValue({
               isValidClassicAddress: () => true,
               Wallet: {
                    fromSeed: () => ({ classicAddress: 'rMasterAddress' }),
               },
          });

          const mockClient = {
               autofill: jasmine.createSpy().and.callFake(async tx => tx),
               submitAndWait: jasmine.createSpy().and.resolveTo({
                    result: {
                         meta: { TransactionResult: 'tesSUCCESS' },
                    },
               }),
          };
          mockXrplService.getClient.and.resolveTo(mockClient as any);

          const setSuccessSpy = spyOn(component as any, 'setSuccess');

          await component.setMultiSign('Y');

          expect(mockClient.submitAndWait).toHaveBeenCalled();
          expect(setSuccessSpy).toHaveBeenCalled();
          expect(mockUtilsService.renderTransactionsResults).toHaveBeenCalled();
     });
});
