import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { 
  FormBuilder, FormsModule, ReactiveFormsModule, Validators, 
  AbstractControl, ValidationErrors, ValidatorFn 
} from '@angular/forms';
import { AuthenticationService } from 'src/app/firebase/authentication';
import { 
  IonContent, IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonCardTitle,
  IonCardContent, IonList, IonItem, IonLabel, IonInput, IonSelect, IonSelectOption,
  IonButton, IonIcon, IonImg, IonNote, IonSpinner, IonThumbnail
} from '@ionic/angular/standalone';
import { Models } from 'src/app/models/models';
import { FirestoreService } from 'src/app/firebase/firestore';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { eyeOffOutline, eyeOutline } from 'ionicons/icons';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    IonContent, IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonCardTitle,
    IonCardContent, IonList, IonItem, IonLabel, IonInput, IonSelect, IonSelectOption,
    IonButton, IonIcon, IonImg, IonNote, IonSpinner, IonThumbnail
  ],
  templateUrl: './registro.component.html',
  styleUrls: ['./registro.component.scss'],
})
export class RegistroComponent implements OnInit {

  private fb: FormBuilder = inject(FormBuilder);
  authenticationService: AuthenticationService = inject(AuthenticationService);
  firestoreService: FirestoreService = inject(FirestoreService);
  private router = inject(Router);

  mostrarPass = false;
  mostrarPass2 = false;
  cargando = false;

  // Regex
  nombreRegex = /^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]+$/;
  telefonoRegex = /^\+569\d{8}$/;
  gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
  passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

  // Barra de seguridad
  pwStrength: { percent: number; label: string } | null = null;

  datosForm = this.fb.group(
    {
      nombre: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.pattern(this.nombreRegex)
      ]],
      apellido: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.pattern(this.nombreRegex)
      ]],
      telefono: ['', [
        Validators.required,
        Validators.pattern(this.telefonoRegex)
      ]],
      direccion: ['', [
        Validators.required,
        Validators.minLength(10)
      ]],
      region: ['', Validators.required],
      email: ['', [
        Validators.required,
        Validators.pattern(this.gmailRegex)
      ]],
      password: ['', [
        Validators.required,
        Validators.pattern(this.passwordRegex)
      ]],
      confirmPassword: ['', Validators.required]
    },
    { validators: this.passwordsIgualesValidator() }
  );

  constructor() {
    addIcons({ eyeOutline, eyeOffOutline });
  }

  ngOnInit() {}

  // Acceso rápido a controles
  get f() {
    return this.datosForm.controls;
  }

  // Validar confirmar contraseña
  passwordsIgualesValidator(): ValidatorFn {
    return (form: AbstractControl): ValidationErrors | null => {
      const pass = form.get('password')?.value;
      const confirm = form.get('confirmPassword')?.value;
      return pass === confirm ? null : { passwordMismatch: true };
    };
  }

  // Nivel de seguridad visual
  onPasswordInput() {
    const pass = this.datosForm.get('password')?.value || "";

    let strength = 0;

    if (pass.length >= 8) strength++;
    if (/[A-Z]/.test(pass)) strength++;
    if (/[a-z]/.test(pass)) strength++;
    if (/\d/.test(pass)) strength++;
    if (/[\W_]/.test(pass)) strength++;

    const percent = (strength / 5) * 100;

    const labels = [
      "Muy débil",
      "Débil",
      "Regular",
      "Fuerte",
      "Muy fuerte"
    ];

    this.pwStrength = {
      percent,
      label: labels[strength - 1] || ''
    };
  }

  async registrarse() {
    this.cargando = true;

    if (this.datosForm.valid) {
      try {
        const data = this.datosForm.value;

        const respuesta = await this.authenticationService.createUser(
          data.email!,
          data.password!
        );

        const datosUser: Models.Auth.UserProfile = {
          uid: respuesta.user.uid,
          nombre: data.nombre!,
          apellido: data.apellido!,
          telefono: data.telefono!,
          direccion: data.direccion!,
          region: data.region!,
          email: data.email!,
        };

        await this.firestoreService.createDocument(
          Models.Auth.PathUsers,
          datosUser,
          respuesta.user.uid
        );

        this.router.navigate(['/login']);
      } catch (error) {
        console.log("Error registrando → ", error);
      }
    }

    this.cargando = false;
  }

  irALogin() {
    this.router.navigate(['/login']);
  }
}
