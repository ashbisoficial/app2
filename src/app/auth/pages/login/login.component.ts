import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { FirestoreService } from 'src/app/firebase/firestore';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
  FormGroup,
  FormControl
} from '@angular/forms';
import { AuthenticationService } from 'src/app/firebase/authentication';
import { RouterLink, Router } from '@angular/router';
import {
  IonContent,
  IonInput,
  IonButton,
  IonItem,
  IonLabel,
  IonIcon,
  IonText,
  IonThumbnail,
  IonImg
} from '@ionic/angular/standalone';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  standalone: true,
  styleUrls: ['./login.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    IonContent,
    IonInput,
    IonButton,
    IonItem,
    IonLabel,
    IonIcon,
    IonText,
    IonThumbnail,
    IonImg,
    RouterLink
  ],
})
export class LoginComponent implements OnInit, OnDestroy {

  private fb = inject(FormBuilder);
  private authenticationService = inject(AuthenticationService);
  private router = inject(Router);
  private firestoreService = inject(FirestoreService);

  private destroy$ = new Subject<void>();

  datosForm!: FormGroup<{
    email: FormControl<string>;
    password: FormControl<string>;
  }>;

  cargando = false;
  showPass = false;
  loginError: string | null = null;

  ngOnInit() {

    this.datosForm = this.fb.group({
      email: this.fb.nonNullable.control('', [
        Validators.required,
        Validators.email
      ]),
      password: this.fb.nonNullable.control('', [
        Validators.required,
        Validators.minLength(6)
      ]),
    });

    //  Control limpio de sesión
    this.authenticationService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        if (user) {
          this.router.navigate(['tabs/home'], { replaceUrl: true });
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get email() {
    return this.datosForm.controls.email;
  }

  get password() {
    return this.datosForm.controls.password;
  }

  async login() {

    this.datosForm.markAllAsTouched();
    this.loginError = null;

    if (this.datosForm.invalid) return;

    const email = this.email.value;
    const password = this.password.value;

    this.cargando = true;

    try {
      await this.authenticationService.login(email, password);
      this.router.navigate(['tabs/home'], { replaceUrl: true });

    } catch (err: any) {

      if (err?.code === 'auth/invalid-email') {
        this.loginError = 'El email ingresado no es válido.';
      } else if (err?.code === 'auth/user-not-found') {
        this.loginError = 'El usuario no existe.';
      } else if (err?.code === 'auth/wrong-password') {
        this.loginError = 'La contraseña es incorrecta.';
      } else {
        this.loginError = 'Credenciales incorrectas.';
      }

    } finally {
      this.cargando = false;
    }
  }

  //  LOGIN CON GOOGLE (VERSIÓN FINAL)
  async loginGoogle() {

    this.loginError = null;
    this.cargando = true;

    try {
      const cred = await this.authenticationService.loginWithGoogle();
      const user = cred.user;

      if (!user) throw new Error('No se obtuvo usuario');

      //  Separar nombre y apellido
      const fullName = user.displayName || '';
      const parts = fullName.split(' ');

      const nombre = parts[0] || '';
      const apellido = parts.slice(1).join(' ') || '';

      const datosUser = {
        id: user.uid,
        nombre,
        apellido,
        email: user.email || '',
        telefono: user.phoneNumber || '',
        foto: user.photoURL || '',
        provider: 'google'
      };

      //  Verificar si existe
      const userExistente = await this.firestoreService.getDocument(
        `usuarios/${user.uid}`
      );

      if (!userExistente) {
        //  Crear usuario
        await this.firestoreService.createDocument(
          'usuarios',
          datosUser,
          user.uid
        );
      } else {
        //  Actualizar datos (IMPORTANTE)
        await this.firestoreService.updateDocument(
          `usuarios/${user.uid}`,
          datosUser
        );
      }

      this.router.navigate(['tabs/home'], { replaceUrl: true });

    } catch (error) {
      console.error(error);
      this.loginError = 'No se pudo iniciar sesión con Google.';
    } finally {
      this.cargando = false;
    }
  }

  irARegistro() {
    this.router.navigate(['/registro'], { replaceUrl: true });
  }

  irARecuperarPassword() {
    this.router.navigate(['/forgot-password']);
  }
}