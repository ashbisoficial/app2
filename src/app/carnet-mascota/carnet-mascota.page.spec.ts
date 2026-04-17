import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CarnetMascotaPage } from './carnet-mascota.page';

describe('CarnetMascotaPage', () => {
  let component: CarnetMascotaPage;
  let fixture: ComponentFixture<CarnetMascotaPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CarnetMascotaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
