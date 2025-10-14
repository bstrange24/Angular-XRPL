import { TestBed } from '@angular/core/testing';

import { SignTransactionUtilService } from './sign-transaction-util.service';

describe('SignTransactionUtilService', () => {
  let service: SignTransactionUtilService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SignTransactionUtilService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
