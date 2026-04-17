import { Component, inject, OnDestroy, OnInit, ViewChild, ElementRef, signal, computed } from '@angular/core';
import { CommonModule, NgIf, NgFor, DatePipe, CurrencyPipe } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Subject, combineLatest, takeUntil } from 'rxjs';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { QRCodeComponent } from 'angularx-qrcode';

import {
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent, IonSpinner,
  IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
  IonButton, IonIcon, IonList, IonItem, IonLabel, IonAvatar, IonSelect, IonSelectOption,
  IonListHeader, IonNote
} from '@ionic/angular/standalone';

import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService, Mascota, Vacuna, Examen, Medicamento } from '../firebase/firestore';
import { Models } from '../models/models';
import { addIcons } from 'ionicons';
import { personOutline, documentTextOutline, shareOutline, pawOutline, medicalOutline, clipboardOutline, eyedropOutline, cashOutline } from 'ionicons/icons';

@Component({
  selector: 'app-mascota-qr',
  templateUrl: './mascota-qr.component.html',
  styleUrls: ['./mascota-qr.component.scss'],
  standalone: true,
  imports: [
    CommonModule, NgIf, NgFor, RouterLink, QRCodeComponent, CurrencyPipe, DatePipe,
    IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent, IonSpinner,
    IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
    IonButton, IonIcon, IonList, IonItem, IonLabel, IonAvatar, IonSelect, IonSelectOption,
    IonListHeader, IonNote
  ]
})
export class MascotaQrComponent implements OnInit, OnDestroy {
  @ViewChild('qrContainer') qrContainer!: ElementRef;

  private destroy$ = new Subject<void>();
  private route = inject(ActivatedRoute);

  authenticationService = inject(AuthenticationService);
  firestoreService = inject(FirestoreService);

  // Estado
  cargando = signal(true);
  descargandoPDF = false; 
  compartiendo = false;
  canShare = false; 

  // Datos
  userProfile: Models.Auth.UserProfile | null = null;
  misMascotas = signal<Mascota[]>([]);
  mascotaSeleccionada = signal<Mascota | null>(null);
  
  // Variable temporal para guardar el ID que viene de la URL
  private targetMascotaId: string | null = null;

  // Datos de gastos
  vacunas = signal<Vacuna[]>([]);
  examenes = signal<Examen[]>([]);
  medicamentos = signal<Medicamento[]>([]);

  qrData = ''; 

  // --- COMPUTED SIGNALS PARA GASTOS ---
  private sumCostos(items: { costo?: number }[]): number {
    return items.reduce((total, item) => total + (item.costo || 0), 0);
  }
  totalGastosVacunas = computed(() => this.sumCostos(this.vacunas() as any[]));
  totalGastosExamenes = computed(() => this.sumCostos(this.examenes()));
  totalGastosMedicamentos = computed(() => this.sumCostos(this.medicamentos()));
  totalGastosGeneral = computed(() => 
    this.totalGastosVacunas() + 
    this.totalGastosExamenes() + 
    this.totalGastosMedicamentos()
  );

  flujoDeCaja = computed(() => {
    const gastosVacunas = (this.vacunas() as any[])
      .filter(v => v.costo > 0)
      .map(v => ({
        fecha: v.fechaAplicacion,
        tipo: 'Vacuna',
        descripcion: v.tipo,
        monto: v.costo
      }));
    const gastosExamenes = this.examenes()
      .filter(e => e.realizado && (e.costo ?? 0) > 0)
      .map(e => ({
        fecha: e.fechaRealizado,
        tipo: 'Examen',
        descripcion: e.tipo,
        monto: e.costo
      }));
    const gastosMedicamentos = this.medicamentos()
      .filter(m => (m.costo ?? 0) > 0)
      .map(m => ({
        fecha: m.fechaInicio,
        tipo: 'Medicamento',
        descripcion: m.nombre,
        monto: m.costo
      }));
    const todosLosGastos = [...gastosVacunas, ...gastosExamenes, ...gastosMedicamentos];
    return todosLosGastos.sort((a, b) => 
      new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );
  });

  constructor() {
    addIcons({ 
      personOutline, documentTextOutline, shareOutline, pawOutline,
      medicalOutline, clipboardOutline, eyedropOutline, cashOutline
    });
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      this.canShare = true;
    }
  }

  ngOnInit() {
    // 1. Suscribirse a los parámetros de la URL (CORRECCIÓN CLAVE)
    // Esto detectará cambios incluso si la página ya estaba abierta
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        if (params['mascotaId']) {
          this.targetMascotaId = params['mascotaId'];
          // Si ya tenemos datos cargados, actualizamos la selección inmediatamente
          this.intentarSeleccionarMascota(); 
        }
      });

    // 2. Cargar los datos generales
    this.cargarDatos();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargarDatos() {
    this.cargando.set(true);
    
    this.authenticationService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        if (!user) {
          this.cargando.set(false);
          return;
        }

        // Cargar Perfil y Mascotas
        const perfil$ = this.firestoreService.getDocumentChanges<Models.Auth.UserProfile>(`${Models.Auth.PathUsers}/${user.uid}`);
        const mascotas$ = this.firestoreService.getUserPets(user.uid);

        combineLatest([perfil$, mascotas$])
          .pipe(takeUntil(this.destroy$))
          .subscribe(([perfil, mascotas]) => {
            this.userProfile = perfil || null;
            const safeMascotas = mascotas || [];
            this.misMascotas.set(safeMascotas);

            // Intentar seleccionar basada en la URL o por defecto
            this.intentarSeleccionarMascota();

            this.cargando.set(false);
          });
      });
  }

  // Nueva función centralizada para seleccionar la mascota correcta
  intentarSeleccionarMascota() {
    const mascotas = this.misMascotas();
    if (mascotas.length === 0) return; // Aún no hay datos

    // 1. Si hay un ID objetivo en la URL, búscalo
    if (this.targetMascotaId) {
      const encontrada = mascotas.find(m => m.id === this.targetMascotaId);
      if (encontrada) {
        // Solo actualizamos si es diferente para evitar recargas innecesarias
        if (this.mascotaSeleccionada()?.id !== encontrada.id) {
          this.seleccionarMascota(encontrada);
        }
        return;
      }
    }

    // 2. Si no hay ID en URL (o no existe), y no hay nada seleccionado, selecciona la primera
    if (!this.mascotaSeleccionada()) {
      this.seleccionarMascota(mascotas[0]);
    }
  }

  seleccionarMascota(m: Mascota) {
    this.mascotaSeleccionada.set(m);
    this.generarVCard(m);
    this.cargarSubcolecciones(m.id);
  }

  cargarSubcolecciones(mascotaId: string) {
    // Vacunas
    this.firestoreService.getVacunasByMascota(mascotaId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => this.vacunas.set(data));

    // Exámenes
    this.firestoreService.getExamenesByMascota(mascotaId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => this.examenes.set(data));

    // Medicamentos
    this.firestoreService.getMedicamentosByMascota(mascotaId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => this.medicamentos.set(data));
  }

  onMascotaChange(event: any) {
    const id = event.detail.value;
    const m = this.misMascotas().find(pet => pet.id === id);
    if (m) {
        // Actualizamos también la URL para mantener consistencia si el usuario refresca
        this.targetMascotaId = id;
        this.seleccionarMascota(m);
    }
  }

  generarVCard(mascota: Mascota) {
    if (!this.userProfile) return;

    const nombreUser = this.userProfile.nombre || '';
    const apellidoUser = this.userProfile.apellido || '';
    const telefono = this.userProfile.telefono || '';
    
    if (!telefono) {
        this.qrData = ''; 
        return;
    }

    const nombreDueno = `${nombreUser} ${apellidoUser}`.trim();
    const m = mascota as any;
    
    const nombre = m.nombre || 'Mascota';
    const edad = m.edad ? `${m.edad} años` : 'No especificada';
    const sexo = m.sexo || 'No especificado';
    const especie = m.especie || 'No especificada';
    const color = m.color || 'No especificado';
    const particulares = m.particulares || 'Ninguna';
    const notas = m.notas || 'Sin notas adicionales';
    const comportamiento = m.indicadoresComportamiento || m.comportamiento || 'Sin información';

    const notaDetallada = `
--- DATOS MASCOTA ---
Nombre: ${nombre}
Edad: ${edad}
Sexo: ${sexo}
Especie: ${especie}
Color: ${color}
Señas Particulares: ${particulares}
Indicadores de Comportamiento: ${comportamiento}
Notas: ${notas}

--- CONTACTO DUEÑO ---
Nombre: ${nombreDueno}
Teléfono: ${telefono}
`.trim();

    const vCard = `BEGIN:VCARD
VERSION:3.0
N:${apellidoUser};${nombreUser};;;
FN:${nombreDueno} (Dueño de ${nombre})
TEL;TYPE=CELL:${telefono}
NOTE:${notaDetallada.replace(/\n/g, '\\n')}
END:VCARD`;

    this.qrData = vCard;
  }

  async descargarPDF() {
    this.descargandoPDF = true;
    await new Promise(resolve => setTimeout(resolve, 100)); 

    try {
      const element = document.getElementById('qrCardElement');
      if (!element) throw new Error('Elemento QR no encontrado');
      
      const canvas = await html2canvas(element, { scale: 3, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgWidth = 120; 
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const x = (pdfWidth - imgWidth) / 2;
      const y = 40;

      pdf.setFontSize(22);
      pdf.text(`Ficha de ${this.mascotaSeleccionada()?.nombre}`, pdfWidth/2, 20, { align: 'center' });
      
      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
      
      pdf.setFontSize(10);
      const footerY = y + imgHeight + 10;
      pdf.text("Escanea este código para ver la ficha completa y guardar el contacto.", pdfWidth/2, footerY, { align: 'center' });
      
      pdf.setFontSize(12);
      pdf.text(`Dueño: ${this.userProfile?.nombre} ${this.userProfile?.apellido}`, pdfWidth/2, footerY + 10, { align: 'center' });
      pdf.text(`Teléfono: ${this.userProfile?.telefono}`, pdfWidth/2, footerY + 16, { align: 'center' });

      pdf.save(`Ficha-${this.mascotaSeleccionada()?.nombre || 'Mascota'}.pdf`);

    } catch (error) {
      console.error('Error al generar PDF:', error);
    } finally {
      this.descargandoPDF = false;
    }
  }

  async compartirQR() {
    if (!this.canShare) return;
    this.compartiendo = true;
    try {
      const canvas = document.querySelector('.qr-code-wrapper canvas') as HTMLCanvasElement;
      if (!canvas) throw new Error('Canvas no encontrado');

      const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Error creando blob');

      const file = new File([blob], `qr-${this.mascotaSeleccionada()?.nombre}.png`, { type: 'image/png' });
      
      const shareData = {
        title: `QR de ${this.mascotaSeleccionada()?.nombre}`,
        text: `Aquí tienes la ficha de contacto de ${this.mascotaSeleccionada()?.nombre}.`,
        files: [file],
      };

      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      }
    } catch (error) {
      console.error('Error compartiendo:', error);
    } finally {
      this.compartiendo = false;
    }
  }
}