import { TestBed } from '@angular/core/testing';

import { XrplTransactionService } from './xrpl-transaction.service';

describe('XrplTransactionService', () => {
  let service: XrplTransactionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(XrplTransactionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
