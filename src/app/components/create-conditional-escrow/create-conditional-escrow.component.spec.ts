import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateConditionalEscrowComponent } from './create-conditional-escrow.component';

describe('CreateConditionalEscrowComponent', () => {
  let component: CreateConditionalEscrowComponent;
  let fixture: ComponentFixture<CreateConditionalEscrowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateConditionalEscrowComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateConditionalEscrowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
