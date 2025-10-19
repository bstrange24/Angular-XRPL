import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppWalletDynamicInputComponent } from './app-wallet-dynamic-input.component';

describe('AppWalletDynamicInputComponent', () => {
  let component: AppWalletDynamicInputComponent;
  let fixture: ComponentFixture<AppWalletDynamicInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppWalletDynamicInputComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AppWalletDynamicInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
