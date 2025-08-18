import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountChangesComponent } from './account-changes.component';

describe('AccountChangesComponent', () => {
  let component: AccountChangesComponent;
  let fixture: ComponentFixture<AccountChangesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountChangesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccountChangesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
