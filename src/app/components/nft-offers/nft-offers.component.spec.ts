import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NftOffersComponent } from './nft-offers.component';

describe('NftOffersComponent', () => {
  let component: NftOffersComponent;
  let fixture: ComponentFixture<NftOffersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NftOffersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NftOffersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
