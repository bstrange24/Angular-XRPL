import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MptComponent } from './mpt.component';

describe('MptComponent', () => {
  let component: MptComponent;
  let fixture: ComponentFixture<MptComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MptComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MptComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
