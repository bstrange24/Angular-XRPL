import { TestBed } from '@angular/core/testing';

import { RenderUiComponentsService } from './render-ui-components.service';

describe('RenderUiComponentsService', () => {
  let service: RenderUiComponentsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RenderUiComponentsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
