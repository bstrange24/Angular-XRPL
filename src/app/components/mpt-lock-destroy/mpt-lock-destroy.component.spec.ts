import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MptLockDestroyComponent } from './mpt-lock-destroy.component';

describe('MptLockDestroyComponent', () => {
  let component: MptLockDestroyComponent;
  let fixture: ComponentFixture<MptLockDestroyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MptLockDestroyComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MptLockDestroyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
