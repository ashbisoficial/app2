import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import * as HomeModule from './home.component';
const HomeComponent = (HomeModule as any).HomeComponent ?? (HomeModule as any).default ?? Object.values(HomeModule)[0];

describe('HomeComponent', () => {
  let component: any;
  let fixture: ComponentFixture<any>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ HomeComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
