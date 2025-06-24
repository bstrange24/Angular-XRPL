import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WalletInputComponent } from './wallet-input.component';

describe('WalletInputComponent', () => {
  let component: WalletInputComponent;
  let fixture: ComponentFixture<WalletInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WalletInputComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WalletInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
