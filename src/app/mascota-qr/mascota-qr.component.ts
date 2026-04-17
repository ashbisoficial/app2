import { Component, inject, OnDestroy, OnInit, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Subject, combineLatest, takeUntil } from 'rxjs';
import { FormsModule } from '@angular/forms'; // 🔥 IMPORTANTE

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { QRCodeComponent } from 'angularx-qrcode';

import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonContent,
  IonSpinner,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonAvatar,
  IonSelect,
  IonSelectOption,
  IonNote,

  // 🔥 ESTOS SON LOS QUE TE FALTABAN
  IonSegment,
  IonSegmentButton

} from '@ionic/angular/standalone';

import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService, Mascota } from '../firebase/firestore';
import { Models } from '../models/models';

@Component({
  selector: 'app-mascota-qr',
  templateUrl: './mascota-qr.component.html',
  styleUrls: ['./mascota-qr.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule, // 🔥 NECESARIO PARA ngModel
    RouterLink,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonSpinner,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonButton,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonAvatar,
    IonSelect,
    IonSelectOption,
    IonNote,

    // 🔥 IMPORTS CLAVE
    IonSegment,
    IonSegmentButton,

    QRCodeComponent
  ]
})
export class MascotaQrComponent implements OnInit, OnDestroy {

  @ViewChild('qrContainer') qrContainer!: ElementRef;

  private destroy$ = new Subject<void>();
  private route = inject(ActivatedRoute);

  authenticationService = inject(AuthenticationService);
  firestoreService = inject(FirestoreService);

  /* ===========================
     ESTADO
  =========================== */
  cargando = signal(true);
  descargandoPDF = false;

  /* ===========================
     DATOS
  =========================== */
  userProfile: Models.Auth.UserProfile | null = null;

  misMascotas = signal<Mascota[]>([]);
  mascotaSeleccionada = signal<Mascota | null>(null);

  private targetMascotaId: string | null = null;

  /* ===========================
     🧠 TIPOS DE QR
  =========================== */
  tipoQR: 'medico' | 'emergencia' = 'medico';

  qrFichaMedica = '';
  qrEmergencia = '';

  get qrActivo() {
    return this.tipoQR === 'medico'
      ? this.qrFichaMedica
      : this.qrEmergencia;
  }

  /* ===========================
     INIT
  =========================== */
  ngOnInit() {

    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        if (params['mascotaId']) {
          this.targetMascotaId = params['mascotaId'];
          this.intentarSeleccionarMascota();
        }
      });

    this.cargarDatos();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ===========================
     CARGAR DATOS
  =========================== */
  cargarDatos() {
    this.cargando.set(true);

    this.authenticationService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {

        if (!user) {
          this.cargando.set(false);
          return;
        }

        const perfil$ = this.firestoreService.getDocumentChanges<Models.Auth.UserProfile>(
          `${Models.Auth.PathUsers}/${user.uid}`
        );

        const mascotas$ = this.firestoreService.getUserPets(user.uid);

        combineLatest([perfil$, mascotas$])
          .pipe(takeUntil(this.destroy$))
          .subscribe(([perfil, mascotas]) => {

            this.userProfile = perfil || null;
            this.misMascotas.set(mascotas || []);

            this.intentarSeleccionarMascota();

            this.cargando.set(false);
          });
      });
  }

  /* ===========================
     SELECCIÓN
  =========================== */
  intentarSeleccionarMascota() {
    const mascotas = this.misMascotas();
    if (!mascotas.length) return;

    if (this.targetMascotaId) {
      const encontrada = mascotas.find(m => m.id === this.targetMascotaId);
      if (encontrada) {
        if (this.mascotaSeleccionada()?.id !== encontrada.id) {
          this.seleccionarMascota(encontrada);
        }
        return;
      }
    }

    if (!this.mascotaSeleccionada()) {
      this.seleccionarMascota(mascotas[0]);
    }
  }

  seleccionarMascota(m: Mascota) {
    this.mascotaSeleccionada.set(m);
    this.generarQRs(m);
  }

  onMascotaChange(event: any) {
    const id = event.detail.value;
    const m = this.misMascotas().find(p => p.id === id);

    if (m) {
      this.targetMascotaId = id;
      this.seleccionarMascota(m);
    }
  }

  /* ===========================
     🔥 GENERAR QRs
  =========================== */
  generarQRs(mascota: Mascota) {

    if (!this.userProfile) return;

    const user = this.userProfile;
    const m: any = mascota;

    const telefono = user.telefono || '';

    if (!telefono) {
      this.qrFichaMedica = '';
      this.qrEmergencia = '';
      return;
    }

    const nombreDueno = `${user.nombre || ''} ${user.apellido || ''}`.trim();

    /* 🏥 QR MÉDICO */
    this.qrFichaMedica = `https://ashbis.app/carnet/${mascota.id}`;

    /* 🚨 QR EMERGENCIA */
    this.qrEmergencia = `
🚨 MASCOTA PERDIDA

🐾 ${m.nombre}
📞 ${telefono}
🔢 Chip: ${m.numeroChip || 'No registrado'}

⚠️ ${(m.indicadores || []).join(', ') || 'Sin información'}

👤 ${nombreDueno}
`.trim();
  }

  /* ===========================
     PDF
  =========================== */
  async descargarPDF() {

    this.descargandoPDF = true;

    try {
      const element = document.getElementById('qrCardElement');
      if (!element) throw new Error('QR no encontrado');

      const canvas = await html2canvas(element, { scale: 3 });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'mm', 'a4');

      const width = pdf.internal.pageSize.getWidth();
      const imgWidth = 120;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.text(`QR de ${this.mascotaSeleccionada()?.nombre}`, width / 2, 20, { align: 'center' });
      pdf.addImage(imgData, 'PNG', (width - imgWidth) / 2, 30, imgWidth, imgHeight);

      pdf.save(`QR-${this.mascotaSeleccionada()?.nombre}.pdf`);

    } catch (error) {
      console.error(error);
    }

    this.descargandoPDF = false;
  }
}