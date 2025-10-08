import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SignTransactionsComponent } from './sign-transactions.component';

describe('SignTransactionsComponent', () => {
  let component: SignTransactionsComponent;
  let fixture: ComponentFixture<SignTransactionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignTransactionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SignTransactionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
