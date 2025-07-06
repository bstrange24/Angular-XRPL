import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountConfiguratorComponent } from './account-configurator.component';

describe('AccountConfiguratorComponent', () => {
  let component: AccountConfiguratorComponent;
  let fixture: ComponentFixture<AccountConfiguratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountConfiguratorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccountConfiguratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
