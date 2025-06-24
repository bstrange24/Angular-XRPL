import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreatePaymentChannelComponent } from './create-payment-channel.component';

describe('CreatePaymentChannelComponent', () => {
  let component: CreatePaymentChannelComponent;
  let fixture: ComponentFixture<CreatePaymentChannelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreatePaymentChannelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreatePaymentChannelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
