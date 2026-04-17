import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';


import {
  IonIcon,
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonLabel
} from '@ionic/angular/standalone';


import { addIcons } from 'ionicons';
import {
  homeOutline,
  listOutline,
  addCircleOutline,
  qrCodeOutline,
  personOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.component.html',
  styleUrls: ['./tabs.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonIcon,
    IonTabBar,
    IonTabButton,
    IonTabs,
    IonLabel
  ]
})
export class TabsComponent implements OnInit {

  constructor() {
    // 4. Añadir todos los iconos que usa el HTML
    addIcons({
      homeOutline,
      listOutline,
      addCircleOutline,
      qrCodeOutline, // <-- El nuevo icono
      personOutline
    });
  }

  ngOnInit() {}
}
