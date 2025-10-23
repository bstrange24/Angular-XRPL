import { TestBed } from '@angular/core/testing';

import { ClickToCopyService } from './click-to-copy.service';

describe('ClickToCopyService', () => {
  let service: ClickToCopyService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ClickToCopyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
