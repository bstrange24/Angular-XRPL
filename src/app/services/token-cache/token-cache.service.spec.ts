import { TestBed } from '@angular/core/testing';

import { TokenCacheService } from './token-cache.service';

describe('TokenCacheService', () => {
  let service: TokenCacheService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TokenCacheService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
