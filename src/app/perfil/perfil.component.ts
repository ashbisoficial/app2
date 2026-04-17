// src/app/perfil/perfil.component.ts
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, NgIf, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService } from '../firebase/firestore';
import { Models } from '../models/models';

import {
  IonContent, IonCard, IonSkeletonText, IonItem, IonLabel, IonInput,
  IonButton, IonGrid, IonRow, IonCol
} from '@ionic/angular/standalone';

import { ToastController, LoadingController } from '@ionic/angular';
import { Subject, takeUntil } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-perfil',
  standalone: true,
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.scss'],
  imports: [
    NgIf,
    ReactiveFormsModule,
    IonContent, IonCard, IonSkeletonText, IonItem, IonLabel, IonInput,
    IonButton, IonGrid, IonRow, IonCol
  ],
  providers: [DatePipe]
})
export class PerfilComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private auth = inject(AuthenticationService);
  private router = inject(Router);

  authenticationService: AuthenticationService = inject(AuthenticationService);
  firestoreService: FirestoreService = inject(FirestoreService);
  toastCtrl = inject(ToastController);
  loadingCtrl = inject(LoadingController);
  fb = inject(FormBuilder);

  user: { uid: string; email: string | null; name: string | null } | null = null;
  user_profile!: Models.Auth.UserProfile;

  cargando = false;
  editMode = false;

  defaultPhoto = 'assets/img/foto_avatar.jpg';

  // Reactive Form
  profileForm = this.fb.group({
    nombre: ['',[Validators.required, Validators.minLength(2)]],
    apellido: ['',[Validators.required, Validators.minLength(2)]],
    email: [{value: '', disabled: true}, [Validators.required, Validators.email]], // lo dejamos sólo lectura
    telefono: ['',[Validators.minLength(6)]],
    region: [''],
    direccion: [''],
  });

  constructor() {
    this.cargando = true;

    this.authenticationService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => {
        if (res) {
          this.user = { uid: res.uid, email: res.email, name: res.displayName };
          this.getDatosProfile(res.uid);
        } else {
          this.user = null;
          this.cargando = false;
        }
      });
  }

  ngOnInit() {}

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getDatosProfile(uid: string) {
    this.firestoreService
      .getDocumentChanges<Models.Auth.UserProfile>(`${Models.Auth.PathUsers}/${uid}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => {
        if (res) {
          this.user_profile = res;
          // Cargar datos al form
          this.profileForm.patchValue({
            nombre: res.nombre ?? '',
            apellido: res.apellido ?? '',
            email: res.email ?? this.user?.email ?? '',
            telefono: res.telefono ?? '',
            region: res.region ?? '',
            direccion: res.direccion ?? '',
          });
        }
        this.cargando = false;
      });
  }

  // Para Timestamp Firestore opcional:
  get fechaNacimiento(): Date | null {
    const ts: any = (this.user_profile as any)?.date;
    return ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
  }

  habilitarEdicion() {
    this.editMode = true;
  }

  cancelarEdicion() {
    this.editMode = false;
    // Restaurar valores originales desde user_profile
    if (this.user_profile) {
      this.profileForm.patchValue({
        nombre: this.user_profile.nombre ?? '',
        apellido: this.user_profile.apellido ?? '',
        email: this.user_profile.email ?? this.user?.email ?? '',
        telefono: this.user_profile.telefono ?? '',
        region: this.user_profile.region ?? '',
        direccion: this.user_profile.direccion ?? '',
      });
    }
  }

  async guardar() {
    if (!this.user?.uid) return;

    // Validaciones
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.showToast('Revisa los campos resaltados.', 'danger');
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Guardando...' });
    await loading.present();

    const payload = {
      nombre: this.profileForm.get('nombre')!.value?.trim() ?? '',
      apellido: this.profileForm.get('apellido')!.value?.trim() ?? '',
      // email no lo sobrescribimos aquí si está controlado por Auth
      telefono: this.profileForm.get('telefono')!.value ?? '',
      region: this.profileForm.get('region')!.value ?? '',
      direccion: this.profileForm.get('direccion')!.value ?? '',
    };

    try {
      await this.firestoreService.updateDocument(
        `${Models.Auth.PathUsers}/${this.user.uid}`,
        payload
      );
      this.editMode = false;
      this.showToast('Perfil actualizado correctamente.', 'success');
    } catch (err: any) {
      console.error('Error al actualizar perfil', err);
      this.showToast('No se pudo actualizar el perfil.', 'danger');
    } finally {
      loading.dismiss();
    }
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'primary' = 'primary') {
    const t = await this.toastCtrl.create({ message, duration: 1800, color });
    t.present();
  }
   async logout() {
        await this.auth.logout();
        this.router.navigate(['/login'], { replaceUrl: true });
    }
}
