import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SendChecksComponent } from './send-checks.component';

describe('SendChecksComponent', () => {
  let component: SendChecksComponent;
  let fixture: ComponentFixture<SendChecksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SendChecksComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SendChecksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
