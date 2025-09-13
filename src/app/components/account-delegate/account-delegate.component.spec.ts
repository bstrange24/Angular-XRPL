import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountDelegateComponent } from './account-delegate.component';

describe('AccountDelegateComponent', () => {
  let component: AccountDelegateComponent;
  let fixture: ComponentFixture<AccountDelegateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountDelegateComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccountDelegateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
