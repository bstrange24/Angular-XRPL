import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateAmmComponent } from './create-amm.component';

describe('CreateAmmComponent', () => {
  let component: CreateAmmComponent;
  let fixture: ComponentFixture<CreateAmmComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateAmmComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateAmmComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
