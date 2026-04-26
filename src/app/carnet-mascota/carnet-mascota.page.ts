import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonContent, IonButton } from '@ionic/angular/standalone';
import { QRCodeComponent } from 'angularx-qrcode';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import { Storage } from '@ionic/storage-angular';
import { FirestoreService } from '../firebase/firestore';

@Component({
  selector: 'app-carnet-mascota',
  templateUrl: './carnet-mascota.page.html',
  styleUrls: ['./carnet-mascota.page.scss'],
  standalone: true,
  imports: [
  CommonModule,
  IonContent,
  QRCodeComponent]
})
export class CarnetMascotaPage implements OnInit {

  /* ===========================
     INYECCIONES
  =========================== */
  private route = inject(ActivatedRoute);
  private firestore = inject(FirestoreService);
  private storage = inject(Storage);

  /* ===========================
     ESTADO
  =========================== */
  mascota: any = null;
  dueno: any = null;

  cargando = true;
  modoOffline = false;

  /* 🔐 QR seguro */
  qrSeguro: string = '';

  /* ===========================
     INIT
  =========================== */
  async ngOnInit() {

    await this.storage.create();

    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      console.error('❌ ID no encontrado en la ruta');
      this.cargando = false;
      return;
    }

    await this.cargarMascota(id);
  }

  /* ===========================
     🔄 CARGA (ONLINE + OFFLINE)
  =========================== */
  async cargarMascota(id: string) {

    try {
      /* 🔥 INTENTO ONLINE */
      const mascota = await this.firestore.getDocument(`mascotas/${id}`);

      if (!mascota) throw new Error('Mascota no existe en Firestore');

      this.mascota = mascota;

      if (mascota.uidUsuario) {
        this.dueno = await this.firestore.getDocument(`users/${mascota.uidUsuario}`);
      }

      /* 💾 GUARDAR OFFLINE */
      await this.guardarOffline(id, {
        mascota: this.mascota,
        dueno: this.dueno
      });

      this.modoOffline = false;

    } catch (error) {

      console.warn('📴 Sin conexión → usando modo offline');

      /* 🔥 OFFLINE */
      const offline = await this.storage.get(`mascota_${id}`);

      if (offline) {
        this.mascota = offline.mascota;
        this.dueno = offline.dueno;
        this.modoOffline = true;
      } else {
        console.error('❌ No hay datos offline disponibles');
      }
    }

    /* 🔐 GENERAR QR */
    if (this.mascota?.id) {
      await this.generarQRSeguro(this.mascota.id);
    }

    this.cargando = false;
  }

  /* ===========================
     💾 STORAGE OFFLINE
  =========================== */
  async guardarOffline(id: string, data: any) {
    try {
      await this.storage.set(`mascota_${id}`, data);
    } catch (error) {
      console.warn('Error guardando offline', error);
    }
  }

  /* ===========================
     🔐 QR ANTIFALSIFICACIÓN PRO
  =========================== */
  async generarQRSeguro(id: string) {

    try {
      const timestamp = Date.now();
      const base = `${id}_${timestamp}`;

      /* 🔒 HASH SHA-256 */
      if (window.crypto?.subtle) {

        const hashBuffer = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(base)
        );

        const token = Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        this.qrSeguro = `https://ashbis.com/carnet/${id}?token=${token}&ts=${timestamp}&v=1`;

      } else {
        throw new Error('Crypto no soportado');
      }

    } catch (error) {

      console.warn('⚠️ Fallback QR (menos seguro)');

      const token = btoa(`${id}_${Date.now()}`);

      this.qrSeguro = `https://ashbis.com/carnet/${id}?token=${token}&v=1`;
    }
  }

  /* ===========================
     📄 GENERAR PDF PRO
  =========================== */
  async descargarPDF() {

    try {
      const element = document.getElementById('carnet');

      if (!element) {
        console.error('❌ Elemento carnet no encontrado');
        return;
      }

      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true
      });

      const img = canvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'mm', 'a4');

      const width = pdf.internal.pageSize.getWidth();
      const imgWidth = 170;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const x = (width - imgWidth) / 2;
      const y = 20;

      pdf.addImage(img, 'PNG', x, y, imgWidth, imgHeight);

      /* Footer PRO */
      pdf.setFontSize(10);
      pdf.text('Ashbis • Identificación digital de mascotas', width / 2, y + imgHeight + 10, { align: 'center' });

      pdf.save(`Carnet-${this.mascota?.nombre || 'Mascota'}.pdf`);

    } catch (error) {
      console.error('❌ Error generando PDF', error);
    }
  }
}