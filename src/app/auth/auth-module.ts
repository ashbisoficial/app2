import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AuthRoutingModule } from './auth-routing-module';
import { LoginComponent } from './pages/login/login.component';
import { RegistroComponent } from './pages/registro/registro.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';


// @NgModule({
//   declarations: [
//     LoginComponent,
//     RegistroComponent
//   ],
//   imports: [
//     CommonModule,
//     AuthRoutingModule,
//     IonicModule,
//     FormsModule,
//     ReactiveFormsModule
//   ]
// })
export class AuthModule { }
