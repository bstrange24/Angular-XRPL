import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SendXrpComponent } from './send-xrp.component';

describe('SendXrpComponent', () => {
  let component: SendXrpComponent;
  let fixture: ComponentFixture<SendXrpComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SendXrpComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SendXrpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
