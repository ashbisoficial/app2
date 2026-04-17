import { Component, inject, signal, OnDestroy, ViewChild, computed } from '@angular/core';
import { NgIf, NgFor, DatePipe, CurrencyPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonContent, IonGrid, IonRow, IonCol, IonList, IonItem, IonLabel,
  IonButton, IonAvatar, IonInput, IonSelect, IonSelectOption,
  IonNote, IonModal, IonDatetime, IonDatetimeButton, IonToast, IonIcon,
  IonCard, IonCardContent, IonTextarea, IonSegment, IonSegmentButton, IonBadge
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { FirestoreService, Mascota, Cita, Vacuna, Examen, Medicamento } from '../firebase/firestore';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Auth } from '@angular/fire/auth';
import { LOCALE_ID } from '@angular/core';
import { deleteField } from 'firebase/firestore';

type Section =
  | 'info'
  | 'calendario'
  | 'vacunas'
  | 'historial'
  | 'medicamentos'
  | 'examenes';

@Component({
  selector: 'app-mascota-editar',
  standalone: true,
  imports: [
    // Angular
    NgIf, NgFor, DatePipe, ReactiveFormsModule,
    // Ionic
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonContent, IonGrid, IonRow, IonCol, IonList, IonItem, IonLabel,
    IonButton, IonAvatar, IonInput, IonSelect, IonSelectOption,
    IonNote, IonModal, IonDatetime, IonDatetimeButton, IonToast, IonIcon,
    IonCard, IonCardContent, IonTextarea, IonSegment, IonSegmentButton, IonBadge, CurrencyPipe
  ],
  templateUrl: './mascota-editar.component.html',
  styleUrls: ['./mascota-editar.component.scss'],
  providers: [DatePipe,
    { provide: LOCALE_ID, useValue: 'es-CL' }
  ]
})
export class MascotaEditarComponent implements OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fs = inject(FirestoreService);
  private fb = inject(FormBuilder);
  private auth = inject(Auth);

  loading = signal(true);
  saving = signal(false);
  uploading = signal(false);

  toastMsg = signal<string | null>(null);
  toastOpen = signal(false);

  mascota = signal<Mascota | null>(null);
  section = signal<Section>('info');
  fechaMax = new Date().toISOString();

  // Calendario / Citas
  citas = signal<Cita[]>([]);
  fechaSeleccionada = signal<string>(new Date().toISOString());

  // Modal de cita
  citaModalOpen = signal(false);
  editandoCitaId = signal<string | null>(null);
  citaForm!: FormGroup;

  // Form principal
  form!: FormGroup;

  // Subscripciones
  sub?: Subscription;
  subCitas?: Subscription;

  //Para ver citas por mes
  viewMode = signal<'dia'|'mes'>('dia');                     // Día o Mes
  mesSeleccionado = signal<string>(new Date().toISOString()); // cualquier fecha dentro del mes elegido

  setViewMode(m: 'dia'|'mes') { this.viewMode.set(m); }    

  vacunas = signal<Vacuna[]>([]);
  vacunaModalOpen = signal(false);
  editandoVacunaId = signal<string | null>(null);
  vacunaForm!: FormGroup;

  subVacunas?: Subscription;

  // --- Exámenes ---
  examenes = signal<Examen[]>([]);
  examenModalOpen = signal(false);
  editandoExamenId = signal<string | null>(null);
  examenForm!: FormGroup;

  subExamenes?: Subscription;

  // Upload flags por examen
  subiendoOrden = signal(false);
  subiendoResultado = signal(false);  


  //Medicamentos
  medicamentos = signal<Medicamento[]>([]);
  medicamentoModalOpen = signal(false);
  editandoMedicamentoId = signal<string | null>(null);
  medicamentoForm!: FormGroup;

  subMedicamentos?: Subscription;  

  @ViewChild('tituloInput', { read: IonInput }) tituloInput?: IonInput;

  
  constructor() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.sub = this.fs.getPetById(id).subscribe(doc => {
      if (doc) {
        this.mascota.set(doc);
        this.buildForm(doc);

        // Suscribir citas de la mascota
        this.subCitas?.unsubscribe();
        this.subCitas = this.fs.getCitasByMascota(doc.id).subscribe(arr => {
          const ordenadas = [...arr].sort((a, b) =>
            new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime()
          );
          this.citas.set(ordenadas);
        });

        //Subscripción de vacunas
        this.subVacunas?.unsubscribe();
        this.subVacunas = this.fs.getVacunasByMascota(doc.id).subscribe(arr => {
          // Orden ya viene por query desc; si quisieras asegurar:
          const ordenadas = [...arr].sort((a, b) =>
            new Date(b.fechaAplicacion).getTime() - new Date(a.fechaAplicacion).getTime()
          );
          this.vacunas.set(ordenadas);
        });

        //Subscripción de exámenes
        this.subExamenes?.unsubscribe();
        this.subExamenes = this.fs.getExamenesByMascota(doc.id).subscribe(arr => {
          // Activos primero (no realizados o con fechaProgramada futura), luego realizados
          const orden = [...arr].sort((a, b) => {
            const aKey = a.realizado ? 1 : 0;
            const bKey = b.realizado ? 1 : 0;
            if (aKey !== bKey) return aKey - bKey;
            // Dentro del grupo, por fechaProgramada asc (vacíos al final)
            const at = a.fechaProgramada ? new Date(a.fechaProgramada).getTime() : Number.MAX_SAFE_INTEGER;
            const bt = b.fechaProgramada ? new Date(b.fechaProgramada).getTime() : Number.MAX_SAFE_INTEGER;
            return at - bt;
          });
          this.examenes.set(orden);
        });   
        
        this.subMedicamentos?.unsubscribe();
        this.subMedicamentos = this.fs.getMedicamentosByMascota(doc.id).subscribe(arr => {
          // orden ya viene por fechaInicio desc; lo mantenemos igual por si acaso
          const ordenadas = [...arr].sort((a,b)=>
            new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime()
          );
          this.medicamentos.set(ordenadas);
        });        
      }
      this.loading.set(false);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.subCitas?.unsubscribe();
    this.subVacunas?.unsubscribe();
    this.subExamenes?.unsubscribe();
    this.subMedicamentos?.unsubscribe();  
  }

  // En MascotaEditarComponent
  setSection(s: Section) {
    const prev = this.section();
    // Si salgo del calendario, cierro modales y libero formularios
    if (prev === 'calendario') {
      this.citaModalOpen.set(false);
      this.citaForm = undefined as any;
    }
    // Si entro al calendario, uso un pequeño deferral para montar limpio
    this.section.set(s);
    if (s === 'calendario') {
      queueMicrotask(() => {
        // Si necesitas preparar algo, hazlo aquí
      });
    }
  }


  // --------- FORM PRINCIPAL ----------
  private buildForm(m: Mascota) {
    this.form = this.fb.group({
      nombre: [m.nombre ?? '', [Validators.required, Validators.maxLength(60)]],
      numeroChip: [m.numeroChip ?? '', [Validators.pattern(/^[0-9]*$/)]],
      edad: [m.edad ?? null, [Validators.min(0)]],
      sexo: [m.sexo ?? ''],
      especie: [m.especie ?? ''],
      raza: [m.raza ?? ''],
      color: [m.color ?? ''],
      castrado: [m.castrado ?? ''],
      fechaNacimiento: [m.fechaNacimiento ?? '']
    });
  }

  get avatar(): string {
    return this.mascota()?.fotoUrl || 'assets/img/logo_ashbis.jpeg';
  }

  async guardarInfo() {
    if (!this.mascota()?.id) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return this.showToast('Revisa los campos resaltados.');
    }

    this.saving.set(true);
    try {
      const payload = { ...this.form.value } as Partial<Mascota>;
      await this.fs.updatePet(this.mascota()!.id, payload);
      this.showToast('Información actualizada.');
    } catch (e) {
      console.error(e);
      this.showToast('Error al guardar. Intenta nuevamente.');
    } finally {
      this.saving.set(false);
    }
  }

  onIonDateChange(ev: CustomEvent) {
    const val = (ev as any).detail?.value as string | null;
    if (!val) return;
    this.form.patchValue({ fechaNacimiento: val });
  }

  showToast(msg: string) {
    this.toastMsg.set(msg);
    this.toastOpen.set(true);
  }

  // ---------- GALERÍA ----------
  async onAddPhotos(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length || !this.mascota() || !this.auth.currentUser) return;

    this.uploading.set(true);
    try {
      const uid = this.auth.currentUser.uid;
      const petId = this.mascota()!.id;
      const urls = await this.fs.uploadPetPhotos(uid, petId, files);
      await this.fs.appendPhotos(petId, urls);
      this.showToast(`${urls.length} foto(s) añadidas`);
      input.value = '';
    } catch (e) {
      console.error(e);
      this.showToast('No se pudo subir la(s) foto(s).');
    } finally {
      this.uploading.set(false);
    }
  }

  async onRemovePhoto(url: string) {
    if (!this.mascota()) return;
    const petId = this.mascota()!.id;
    try {
      await this.fs.removePhoto(petId, url);
      await this.fs.deletePhotoFromStorage(url);
      this.showToast('Foto eliminada');
    } catch (e) {
      console.error(e);
      this.showToast('No se pudo eliminar la foto.');
    }
  }

  async setAsPrincipal(url: string) {
    if (!this.mascota()?.id) return;
    try {
      await this.fs.updatePet(this.mascota()!.id, { fotoUrl: url });
      this.showToast('Foto principal actualizada');
    } catch (e) {
      console.error(e);
      this.showToast('No se pudo actualizar la foto principal.');
    }
  }

  // ---------- CALENDARIO / AGENDA ----------
  onCalendarioChange(ev: CustomEvent) {
    const val = (ev as any).detail?.value as string | null;
    if (!val) return;
    this.fechaSeleccionada.set(val);
  }

  // get citasDelDia(): Cita[] {
  //   const sel = this.fechaSeleccionada();
  //   if (!sel) return [];
  //   return this.citas().filter(c => this.esMismoDia(c.fechaInicio, sel));
  // }

  private esMismoDia(aISO: string, bISO: string): boolean {
    const a = new Date(aISO);
    const b = new Date(bISO);
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  onViewModeChange(ev: Event) {
    const val = (ev as CustomEvent).detail?.value as 'dia' | 'mes';
    if (val === 'dia' || val === 'mes') this.viewMode.set(val);
  }
  onMesChange(ev: CustomEvent) {
    const val = (ev as any).detail?.value as string | null;
    if (!val) return;
    this.mesSeleccionado.set(val);
  }

  // // Utilidades de rango de mes (inicio fin en ISO)
  // private monthBounds(iso: string) {
  //   const d = new Date(iso);
  //   const start = new Date(d.getFullYear(), d.getMonth(), 1);
  //   const end = new Date(d.getFullYear(), d.getMonth() + 1, 1); // exclusivo
  //   return { start, end };
  // }

  // // Citas del MES (filtra por fechaInicio ∈ [start, end))
  // get citasDelMes(): Cita[] {
  //   const { start, end } = this.monthBounds(this.mesSeleccionado());
  //   return this.citas().filter(c => {
  //     const t = new Date(c.fechaInicio).getTime();
  //     return t >= start.getTime() && t < end.getTime();
  //   }).sort((a,b)=> new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime());
  // }

  // // (Opcional) Agrupar por día para mostrar bonito
  // get citasMesAgrupadas(): { diaISO: string; items: Cita[] }[] {
  //   const map = new Map<string, Cita[]>();
  //   for (const c of this.citasDelMes) {
  //     const d = new Date(c.fechaInicio);
  //     const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
  //     if (!map.has(key)) map.set(key, []);
  //     map.get(key)!.push(c);
  //   }
  //   // ordenar por día
  //   return Array.from(map.entries())
  //     .sort((a,b)=> new Date(a[0]).getTime() - new Date(b[0]).getTime())
  //     .map(([diaISO, items]) => ({ diaISO, items }));
  // }  

  // ---------- MODAL: crear / editar / borrar citas ----------
  abrirNuevaCita() {
    this.editandoCitaId.set(null);
    this.citaForm = this.fb.group({
      titulo: ['', [Validators.required, Validators.maxLength(80)]],
      fecha: [this.fechaSeleccionada(), Validators.required], // ISO (solo fecha)
      horaInicio: ['10:00', Validators.required],             // HH:mm
      horaFin: ['11:00'],
      lugar: [''],
      notas: ['']
    });
    this.citaModalOpen.set(true);
  }

  abrirEditarCita(c: Cita) {
    const fi = new Date(c.fechaInicio);
    const ff = c.fechaFin ? new Date(c.fechaFin) : null;

    const isoFecha = new Date(fi.getFullYear(), fi.getMonth(), fi.getDate()).toISOString();
    const horaInicio = fi.toISOString().substring(11, 16); // HH:mm
    const horaFin = ff ? ff.toISOString().substring(11, 16) : '';

    this.editandoCitaId.set(c.id || null);
    this.citaForm = this.fb.group({
      titulo: [c.titulo, [Validators.required, Validators.maxLength(80)]],
      fecha: [isoFecha, Validators.required],
      horaInicio: [horaInicio, Validators.required],
      horaFin: [horaFin],
      lugar: [c.lugar || ''],
      notas: [c.notas || '']
    });
    this.citaModalOpen.set(true);
  }

  async guardarCita() {
    if (this.citaForm.invalid || !this.mascota()?.id || !this.auth.currentUser) {
      this.citaForm.markAllAsTouched();
      return this.showToast('Revisa los campos de la cita.');
    }

    const petId = this.mascota()!.id;
    const { titulo, fecha, horaInicio, horaFin, lugar, notas } = this.citaForm.value;

    // Validación simple: horaFin >= horaInicio (si existe)
    if (horaFin) {
      const iniNum = parseInt(horaInicio.replace(':', ''), 10);
      const finNum = parseInt(horaFin.replace(':', ''), 10);
      if (finNum < iniNum) {
        return this.showToast('La hora fin no puede ser menor que la hora inicio.');
      }
    }

    const isoInicio = this.combineFechaHora(fecha, horaInicio);
    const isoFin = horaFin ? this.combineFechaHora(fecha, horaFin) : undefined;

    const payload: Cita = {
      titulo,
      fechaInicio: isoInicio,
      fechaFin: isoFin,
      lugar,
      notas,
      creadoPor: this.auth.currentUser.uid
    };

    try {
      const editId = this.editandoCitaId();
      if (editId) {
        await this.fs.updateCita(petId, editId, payload);
        this.showToast('Cita actualizada.');
      } else {
        await this.fs.addCita(petId, payload);
        this.showToast('Cita creada.');
      }
      this.citaModalOpen.set(false);
    } catch (e) {
      console.error(e);
      this.showToast('No se pudo guardar la cita.');
    }
  }

  async borrarCita(c: Cita) {
    if (!this.mascota()?.id || !c.id) return;
    try {
      await this.fs.deleteCita(this.mascota()!.id, c.id);
      this.showToast('Cita eliminada.');
    } catch (e) {
      console.error(e);
      this.showToast('No se pudo eliminar la cita.');
    }
  }

  // Combina fecha (ISO) + hora (HH:mm) a ISO en zona local
  private combineFechaHora(fechaISO: string, hhmm: string): string {
    const f = new Date(fechaISO);
    const [h, m] = hhmm.split(':').map((n: string) => parseInt(n, 10));
    f.setHours(h, m, 0, 0);
    return f.toISOString();
  }

  abrirNuevaVacuna() {
    this.editandoVacunaId.set(null);
    this.vacunaForm = this.fb.group({
      tipo: ['', [Validators.required, Validators.maxLength(60)]],
      fechaAplicacion: [new Date().toISOString(), Validators.required], // ISO
      proximaFecha: [''],                                               // opcional
      notas: ['']
    });
    this.vacunaModalOpen.set(true);
  }

  abrirEditarVacuna(v: Vacuna) {
    this.editandoVacunaId.set(v.id || null);
    this.vacunaForm = this.fb.group({
      tipo: [v.tipo, [Validators.required, Validators.maxLength(60)]],
      fechaAplicacion: [v.fechaAplicacion, Validators.required],
      proximaFecha: [v.proximaFecha || ''],
      notas: [v.notas || '']
    });
    this.vacunaModalOpen.set(true);
  }

  async guardarVacuna() {
    if (this.vacunaForm.invalid || !this.mascota()?.id || !this.auth.currentUser) {
      this.vacunaForm?.markAllAsTouched();
      return this.showToast('Revisa los campos de la vacuna.');
    }

    const petId = this.mascota()!.id;
    const { tipo, fechaAplicacion, proximaFecha, notas } = this.vacunaForm.value;
    const payload: Vacuna = {
      tipo,
      fechaAplicacion,
      proximaFecha: proximaFecha || undefined,
      notas,
      creadoPor: this.auth.currentUser.uid
    };

    try {
      const editId = this.editandoVacunaId();
      if (editId) {
        await this.fs.updateVacuna(petId, editId, payload);
        this.showToast('Vacuna actualizada.');
      } else {
        await this.fs.addVacuna(petId, payload);
        this.showToast('Vacuna registrada.');
      }
      this.vacunaModalOpen.set(false);
    } catch (e) {
      console.error(e);
      this.showToast('No se pudo guardar la vacuna.');
    }
  }

  async borrarVacuna(v: Vacuna) {
    if (!this.mascota()?.id || !v.id) return;
    try {
      await this.fs.deleteVacuna(this.mascota()!.id, v.id);
      this.showToast('Vacuna eliminada.');
    } catch (e) {
      console.error(e);
      this.showToast('No se pudo eliminar la vacuna.');
    }
  } 

  abrirNuevoExamen() {
    this.editandoExamenId.set(null);
    this.examenForm = this.fb.group({
      tipo: ['', [Validators.required, Validators.maxLength(80)]],
      fechaProgramada: [new Date().toISOString()],   // opcional
      realizado: [false],
      fechaRealizado: [''],                           // si realizado
      lugar: [''],
      costo: [null],
      notas: ['']
    });
    this.examenModalOpen.set(true);
  }

  abrirEditarExamen(e: Examen) {
    this.editandoExamenId.set(e.id || null);
    this.examenForm = this.fb.group({
      tipo: [e.tipo, [Validators.required, Validators.maxLength(80)]],
      fechaProgramada: [e.fechaProgramada || ''],
      realizado: [!!e.realizado],
      fechaRealizado: [e.fechaRealizado || ''],
      lugar: [e.lugar || ''],
      costo: [e.costo ?? null],
      notas: [e.notas || '']
    });
    this.examenModalOpen.set(true);
  }

async guardarExamen() {
  if (this.examenForm.invalid || !this.mascota()?.id || !this.auth.currentUser) {
    this.examenForm?.markAllAsTouched();
    return this.showToast('Revisa los campos del examen.');
  }

  const petId = this.mascota()!.id;
  const uid = this.auth.currentUser.uid;
  const v = this.examenForm.value as any;

  const payload: any = {
    tipo: v.tipo,
    realizado: !!v.realizado,
    creadoPor: uid,
  };

  // Solo agrega si vienen con valor (evita undefined)
  if (v.fechaProgramada) payload.fechaProgramada = v.fechaProgramada;
  if (v.lugar) payload.lugar = v.lugar;
  if (v.notas) payload.notas = v.notas;
  if (v.costo != null) payload.costo = Number(v.costo);

  if (payload.realizado) {
    payload.fechaRealizado = v.fechaRealizado || new Date().toISOString();
  }
  // si NO está realizado, NO incluyas fechaRealizado en el payload

  try {
    const editId = this.editandoExamenId();
    if (editId) {
      await this.fs.updateExamen(petId, editId, payload);
      this.showToast('Examen actualizado.');
    } else {
      await this.fs.addExamen(petId, payload);
      this.showToast('Examen registrado.');
    }
    this.examenModalOpen.set(false);
  } catch (e) {
    console.error(e);
    this.showToast('No se pudo guardar el examen.');
  }
}


  async borrarExamen(e: Examen) {
    if (!this.mascota()?.id || !e.id) return;
    try {
      await this.fs.deleteExamen(this.mascota()!.id, e.id);
      this.showToast('Examen eliminado.');
    } catch (err) {
      console.error(err);
      this.showToast('No se pudo eliminar el examen.');
    }
  }

async toggleRealizado(e: Examen) {
  if (!this.mascota()?.id || !e.id) return;
  const nuevo = !e.realizado;

  const patch: any = { realizado: nuevo };
  if (nuevo) {
    patch.fechaRealizado = e.fechaRealizado || new Date().toISOString();
  } else {
    // marca eliminación del campo
    patch.fechaRealizado = deleteField();
  }

  try {
    await this.fs.updateExamen(this.mascota()!.id, e.id, patch);
  } catch (err) {
    console.error(err);
    this.showToast('No se pudo actualizar el estado.');
  }
}

  async onUploadOrden(ev: Event, e: Examen) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.mascota() || !this.auth.currentUser || !e.id) return;

    this.subiendoOrden.set(true);
    try {
      const url = await this.fs.uploadExamenFile(this.auth.currentUser.uid, this.mascota()!.id, e.id, file, 'orden');
      await this.fs.updateExamen(this.mascota()!.id, e.id, { ordenUrl: url });
      this.showToast('Orden cargada.');
      input.value = '';
    } catch (err) {
      console.error(err);
      this.showToast('No se pudo subir la orden.');
    } finally {
      this.subiendoOrden.set(false);
    }
  }

async onUploadResultado(ev: Event, e: Examen) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !this.mascota() || !this.auth.currentUser || !e.id) return;

  this.subiendoResultado.set(true);
  try {
    const url = await this.fs.uploadExamenFile(this.auth.currentUser.uid, this.mascota()!.id, e.id, file, 'resultado');
    await this.fs.updateExamen(this.mascota()!.id, e.id, {
      resultadoUrl: url,
      realizado: true,
      fechaRealizado: new Date().toISOString()
    });
    this.showToast('Resultado cargado.');
    input.value = '';
  } catch (err) {
    console.error(err);
    this.showToast('No se pudo subir el resultado.');
  } finally {
    this.subiendoResultado.set(false);
  }
}


  async quitarArchivo(e: Examen, kind: 'orden' | 'resultado') {
    if (!e.id) return;
    const url = kind === 'orden' ? e.ordenUrl : e.resultadoUrl;
    if (!url) return;
    try {
      await this.fs.removeExamenFileByUrl(url);
      const patch: any = {};
      patch[kind === 'orden' ? 'ordenUrl' : 'resultadoUrl'] = null;
      await this.fs.updateExamen(this.mascota()!.id, e.id, patch);
      this.showToast('Archivo eliminado.');
    } catch (err) {
      console.error(err);
      this.showToast('No se pudo eliminar el archivo.');
    }
  }

  openUrl(url: string) {
    if (!url) return;
    window.open(url, '_blank');
  }
  
  abrirNuevoMedicamento() {
    this.editandoMedicamentoId.set(null);
    this.medicamentoForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(80)]],
      mg: [null, [Validators.required, Validators.min(0.1)]],
      fechaInicio: [new Date().toISOString(), Validators.required],
      fechaFin: [''],     // opcional
      costo: [null],      // opcional
      notas: ['']         // opcional
    });
    this.medicamentoModalOpen.set(true);
  }

  abrirEditarMedicamento(m: Medicamento) {
    this.editandoMedicamentoId.set(m.id || null);
    this.medicamentoForm = this.fb.group({
      nombre: [m.nombre, [Validators.required, Validators.maxLength(80)]],
      mg: [m.mg, [Validators.required, Validators.min(0.1)]],
      fechaInicio: [m.fechaInicio, Validators.required],
      fechaFin: [m.fechaFin || ''],
      costo: [m.costo ?? null],
      notas: [m.notas || '']
    });
    this.medicamentoModalOpen.set(true);
  }

  async guardarMedicamento() {
    if (this.medicamentoForm.invalid || !this.mascota()?.id || !this.auth.currentUser) {
      this.medicamentoForm?.markAllAsTouched();
      return this.showToast('Revisa los campos del medicamento.');
    }

    const petId = this.mascota()!.id;
    const uid = this.auth.currentUser.uid;
    const v = this.medicamentoForm.value as any;

    // Validación: fechaFin >= fechaInicio (si hay fechaFin)
    if (v.fechaFin) {
      const ini = new Date(v.fechaInicio).getTime();
      const fin = new Date(v.fechaFin).getTime();
      if (isFinite(ini) && isFinite(fin) && fin < ini) {
        return this.showToast('La fecha de fin no puede ser menor que la de inicio.');
      }
    }

    const payload: any = {
      nombre: v.nombre,
      mg: Number(v.mg),
      fechaInicio: v.fechaInicio,
      creadoPor: uid,
    };

    if (v.fechaFin) payload.fechaFin = v.fechaFin;
    if (v.costo != null) payload.costo = Number(v.costo);
    if (v.notas) payload.notas = v.notas;

    try {
      const editId = this.editandoMedicamentoId();
      if (editId) {
        await this.fs.updateMedicamento(petId, editId, payload);
        this.showToast('Medicamento actualizado.');
      } else {
        await this.fs.addMedicamento(petId, payload);
        this.showToast('Medicamento registrado.');
      }
      this.medicamentoModalOpen.set(false);
    } catch (e) {
      console.error(e);
      this.showToast('No se pudo guardar el medicamento.');
    }
  }

  async borrarMedicamento(m: Medicamento) {
    if (!this.mascota()?.id || !m.id) return;
    try {
      await this.fs.deleteMedicamento(this.mascota()!.id, m.id);
      this.showToast('Medicamento eliminado.');
    } catch (e) {
      console.error(e);
      this.showToast('No se pudo eliminar el medicamento.');
    }
  }

  // Devuelve color para el <ion-badge>
  medColor(m: { fechaInicio: string; fechaFin?: string }): 'success' | 'warning' | 'medium' {
    const now = Date.now();
    const ini = Date.parse(m.fechaInicio);
    const fin = m.fechaFin ? Date.parse(m.fechaFin) : NaN;

    // Finalizado: tiene fechaFin y ya pasó
    if (!Number.isNaN(fin) && fin < now) return 'medium';

    // Programado: inicio en el futuro
    if (!Number.isNaN(ini) && ini > now) return 'warning';

    // En curso
    return 'success';
  }

  // Devuelve texto de estado
  medEstado(m: { fechaInicio: string; fechaFin?: string }): 'Finalizado' | 'Programado' | 'En curso' {
    const now = Date.now();
    const ini = Date.parse(m.fechaInicio);
    const fin = m.fechaFin ? Date.parse(m.fechaFin) : NaN;

    if (!Number.isNaN(fin) && fin < now) return 'Finalizado';
    if (!Number.isNaN(ini) && ini > now) return 'Programado';
    return 'En curso';
  }




  //Prueba para producción
  // 🔹 Derivados con memoización
  private monthBounds = (iso: string) => {
    const d = new Date(iso);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1); // exclusivo
    return { start, end };
  };

  // Día seleccionado (derivado del signal ya existente)
  private _citasDelDia = computed<Cita[]>(() => {
    const sel = this.fechaSeleccionada();
    if (!sel) return [];
    const selDate = new Date(sel);
    return this.citas()
      .filter(c => {
        const d = new Date(c.fechaInicio);
        return d.getFullYear() === selDate.getFullYear()
          && d.getMonth() === selDate.getMonth()
          && d.getDate() === selDate.getDate();
      })
      .sort((a,b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime());
  });

  // Mes seleccionado
  private _citasDelMes = computed<Cita[]>(() => {
    const { start, end } = this.monthBounds(this.mesSeleccionado());
    const s = start.getTime();
    const e = end.getTime();
    // ⚠️ no mutar: usa spread antes de sort
    return [...this.citas()
      .filter(c => {
        const t = new Date(c.fechaInicio).getTime();
        return t >= s && t < e;
      })].sort((a,b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime());
  });

  // Clave de día local segura (sin zonas)
  private dayKey(d: Date): string {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2,'0');
    const dd = d.getDate().toString().padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }

  // Agrupado por día (memoizado)
  private _citasMesAgrupadas = computed<{ diaKey: string; items: Cita[] }[]>(() => {
    const map = new Map<string, Cita[]>();
    for (const c of this._citasDelMes()) {
      const d = new Date(c.fechaInicio);
      const key = this.dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries())
      .sort((a,b)=> a[0] < b[0] ? -1 : 1)
      .map(([diaKey, items]) => ({ diaKey, items }));
  });

  // 🔹 Getters “fachada” para NO tocar el HTML
  get citasDelDia(): Cita[] { return this._citasDelDia(); }
  get citasDelMes(): Cita[] { return this._citasDelMes(); }
  get citasMesAgrupadas(): { diaKey: string; items: Cita[] }[] { return this._citasMesAgrupadas(); }

  // 🔹 trackBy para listas
  trackByDia = (_: number, g: { diaKey: string }) => g.diaKey;
  trackByCita = (_: number, c: Cita) => c.id ?? c.fechaInicio; // fallback

}
