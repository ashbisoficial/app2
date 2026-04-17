import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';
import { AuthenticationService } from 'src/app/firebase/authentication';
import { Router } from '@angular/router';
import {
  IonContent, IonInput, IonButton, IonSpinner,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonItem, IonLabel, IonText, IonIcon, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  standalone: true,
  styleUrls: ['./forgot-password.component.scss'],
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    IonContent, IonInput, IonButton, IonSpinner,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonItem, IonLabel, IonText, IonIcon, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle
  ],
})
export class ForgotPasswordComponent implements OnInit {

  private fb = inject(FormBuilder);
  private authenticationService = inject(AuthenticationService);
  private router = inject(Router);

  emailForm!: FormGroup;
  cargando = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  ngOnInit() {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  get email() {
    return this.emailForm.get('email');
  }

  async enviarRecuperacion() {
    this.emailForm.markAllAsTouched();
    this.errorMessage = null;
    this.successMessage = null;

    if (this.emailForm.invalid) return;

    const { email } = this.emailForm.value;
    this.cargando = true;

    try {
      await this.authenticationService.resetPassword(email);
      this.successMessage = '✅ Se ha enviado un correo de recuperación.  Revisa tu bandeja de entrada.';
      this.emailForm.reset();
      
      // Opcional: volver al login después de 3 segundos
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 3000);

    } catch (err: any) {
      console.error(err);
      
      if (err?.code === 'auth/user-not-found') {
        this.errorMessage = 'No existe una cuenta con este email.';
      } else if (err?.code === 'auth/invalid-email') {
        this.errorMessage = 'El email ingresado no es válido.';
      } else {
        this.errorMessage = 'Error al enviar el correo.  Intenta nuevamente.';
      }

    } finally {
      this.cargando = false;
    }
  }

  volverAlLogin() {
    this.router.navigate(['/login']);
  }
}