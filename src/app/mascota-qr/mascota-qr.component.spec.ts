import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { MascotaQrComponent } from './mascota-qr.component';

describe('MascotaQrComponent', () => {
  let component: MascotaQrComponent;
  let fixture: ComponentFixture<MascotaQrComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [MascotaQrComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MascotaQrComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
