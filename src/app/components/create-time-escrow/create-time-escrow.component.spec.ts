import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateTimeEscrowComponent } from './create-time-escrow.component';

describe('CreateTimeEscrowComponent', () => {
  let component: CreateTimeEscrowComponent;
  let fixture: ComponentFixture<CreateTimeEscrowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateTimeEscrowComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateTimeEscrowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
