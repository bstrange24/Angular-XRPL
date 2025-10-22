import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MptSendComponent } from './mpt-send.component';

describe('MptSendComponent', () => {
  let component: MptSendComponent;
  let fixture: ComponentFixture<MptSendComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MptSendComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MptSendComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
