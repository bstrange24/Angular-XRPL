import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PermissionedDomainComponent } from './permissioned-domain.component';

describe('PermissionedDomainComponent', () => {
  let component: PermissionedDomainComponent;
  let fixture: ComponentFixture<PermissionedDomainComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PermissionedDomainComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PermissionedDomainComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
