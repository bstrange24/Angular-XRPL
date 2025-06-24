import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SendCurrencyComponent } from './send-currency.component';

describe('SendCurrencyComponent', () => {
  let component: SendCurrencyComponent;
  let fixture: ComponentFixture<SendCurrencyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SendCurrencyComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SendCurrencyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
