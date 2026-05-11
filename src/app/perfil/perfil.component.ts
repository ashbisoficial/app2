import { DatePipe, NgIf } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCol,
  IonContent,
  IonGrid,
  IonInput,
  IonItem,
  IonLabel,
  IonRow,
  IonSkeletonText
} from '@ionic/angular/standalone';
import { LoadingController, ToastController } from '@ionic/angular';
import { Subject, takeUntil } from 'rxjs';
import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService } from '../firebase/firestore';
import { Models } from '../models/models';
import { SecurityService } from '../services/security.service';

@Component({
  selector: 'app-perfil',
  standalone: true,
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.scss'],
  imports: [
    NgIf,
    ReactiveFormsModule,
    IonContent,
    IonCard,
    IonSkeletonText,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonGrid,
    IonRow,
    IonCol
  ],
  providers: [DatePipe]
})
export class PerfilComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly auth = inject(AuthenticationService);
  private readonly router = inject(Router);
  private readonly security = inject(SecurityService);

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

  profileForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    apellido: ['', [Validators.required, Validators.minLength(2)]],
    email: [{ value: '', disabled: true }, [Validators.required, Validators.email]],
    telefono: ['', [Validators.minLength(6)]],
    region: [''],
    direccion: ['']
  });

  constructor() {
    this.cargando = true;
    this.authenticationService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        if (res) {
          this.user = { uid: res.uid, email: res.email, name: res.displayName };
          this.getDatosProfile(res.uid);
        } else {
          this.user = null;
          this.cargando = false;
        }
      });
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getDatosProfile(uid: string): void {
    this.firestoreService
      .getDocumentChanges<Models.Auth.UserProfile>(`${Models.Auth.PathUsers}/${uid}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        if (res) {
          this.user_profile = res;
          this.profileForm.patchValue({
            nombre: res.nombre ?? '',
            apellido: res.apellido ?? '',
            email: res.email ?? this.user?.email ?? '',
            telefono: res.telefono ?? '',
            region: res.region ?? '',
            direccion: res.direccion ?? ''
          });
        }
        this.cargando = false;
      });
  }

  get fechaNacimiento(): Date | null {
    const ts: any = (this.user_profile as any)?.date;
    return ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : null;
  }

  habilitarEdicion(): void {
    this.editMode = true;
  }

  cancelarEdicion(): void {
    this.editMode = false;
    if (this.user_profile) {
      this.profileForm.patchValue({
        nombre: this.user_profile.nombre ?? '',
        apellido: this.user_profile.apellido ?? '',
        email: this.user_profile.email ?? this.user?.email ?? '',
        telefono: this.user_profile.telefono ?? '',
        region: this.user_profile.region ?? '',
        direccion: this.user_profile.direccion ?? ''
      });
    }
  }

  async guardar(): Promise<void> {
    if (!this.user?.uid) return;
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.showToast('Revisa los campos resaltados.', 'danger');
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Guardando...' });
    await loading.present();

    const payload = {
      nombre: this.security.sanitizeText(this.profileForm.get('nombre')!.value?.trim() ?? ''),
      apellido: this.security.sanitizeText(this.profileForm.get('apellido')!.value?.trim() ?? ''),
      telefono: this.security.sanitizeText(this.profileForm.get('telefono')!.value ?? ''),
      region: this.security.sanitizeText(this.profileForm.get('region')!.value ?? ''),
      direccion: this.security.sanitizeText(this.profileForm.get('direccion')!.value ?? '')
    };

    try {
      await this.firestoreService.updateDocument(`${Models.Auth.PathUsers}/${this.user.uid}`, payload);
      this.editMode = false;
      this.showToast('Perfil actualizado correctamente.', 'success');
    } catch (err) {
      console.error('Error al actualizar perfil', err);
      this.showToast('No se pudo actualizar el perfil.', 'danger');
    } finally {
      loading.dismiss();
    }
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'primary' = 'primary'): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 1800, color });
    t.present();
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}
