import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WalletMultiInputComponent } from './wallet-multi-input.component';

describe('WalletMultiInputComponent', () => {
  let component: WalletMultiInputComponent;
  let fixture: ComponentFixture<WalletMultiInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WalletMultiInputComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WalletMultiInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
