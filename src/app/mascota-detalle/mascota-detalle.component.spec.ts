import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { MascotaDetalleComponent } from './mascota-detalle.component';

describe('MascotaDetalleComponent', () => {
  let component: MascotaDetalleComponent;
  let fixture: ComponentFixture<MascotaDetalleComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [MascotaDetalleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MascotaDetalleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
