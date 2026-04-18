import { Component, inject, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonCard, IonButton, IonIcon, IonCardContent, IonContent, IonSpinner,
  IonInput, IonItem, IonLabel, IonTextarea
} from '@ionic/angular/standalone';
import { ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { AuthenticationService } from 'src/app/firebase/authentication';
import { addIcons } from 'ionicons';
import {
  hourglassOutline, locateOutline, star, bagOutline, pawOutline,
  chatbubblesOutline, heartOutline, closeOutline, createOutline,
  callOutline, globeOutline, timeOutline, starOutline
} from 'ionicons/icons';
import { register } from 'swiper/element/bundle';
import { FirestoreService } from '../firebase/firestore';
import { firstValueFrom } from 'rxjs';
import { User } from '@angular/fire/auth';
register();

declare const L: any;

interface Marcador {
  lat: number;
  lng: number;
  title: string;
  address: string;
  rating?: number;
  placeId?: string;
  tipo: 'veterinary_care' | 'pet_store';
  phone?: string;
  website?: string;
  openingHours?: string;
  isOpen?: boolean | null;
  userInfo?: LugarUserInfo;
}

interface LugarUserInfo {
  phone?: string;
  website?: string;
  openingHours?: string;
  descripcion?: string;
  rating?: number;
}

type VeterinariaFavoritaInput = {
  placeId: string;
  nombre: string;
  direccion: string;
  lat: number;
  lng: number;
  rating?: number;
  tipos?: string[];
};

addIcons({
  hourglassOutline, locateOutline, bagOutline, pawOutline, star, chatbubblesOutline,
  heartOutline, closeOutline, createOutline, callOutline, globeOutline, timeOutline, starOutline
});

@Component({
  selector: 'app-home',
  templateUrl: 'home.component.html',
  styleUrls: ['home.component.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonCard, IonButton, IonIcon, IonCardContent, IonContent, IonSpinner,
    IonInput, IonItem, IonLabel, IonTextarea
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class HomePage implements OnInit, OnDestroy {
  private auth = inject(AuthenticationService);
  private router = inject(Router);
  private toastController = inject(ToastController);
  private firestoreService = inject(FirestoreService);

  userEmail$ = this.auth.authState$.pipe(map(u => u?.email ?? ''));

  estaCargando = false;
  marcadoresEnMapa: Marcador[] = [];
  marcadorSeleccionado: Marcador | undefined;
  mostrarPanel = false;
  modoEdicion = false;
  currentSearchType: 'veterinary_care' | 'pet_store' | null = null;
  editForm: LugarUserInfo = {};

  private map: any;
  private markersLayer: any;
  private userMarker: any;
  userPositionMarker: { lat: number; lng: number } | undefined;

  imagenesCarrusel = [
    { src: 'assets/img/carrusel1.jpg', titulo: 'Cuidado y amor para tus mascotas' },
    { src: 'assets/img/carrusel2.jpg', titulo: 'Productos y accesorios' },
    { src: 'assets/img/carrusel3.jpg', titulo: 'Adopta y cambia una vida' },
  ];

  imagenesCarruselInferior = [
    { src: 'assets/img/9.jpg', titulo: 'Evento 1' },
    { src: 'assets/img/12.jpg', titulo: 'Evento 2' },
    { src: 'assets/img/11.jpg', titulo: 'Evento 3' },
    { src: 'assets/img/10.jpg', titulo: 'Evento 4' },
  ];

  constructor() {
    addIcons({
      chatbubblesOutline, locateOutline, bagOutline, closeOutline,
      callOutline, globeOutline, timeOutline, pawOutline, createOutline, heartOutline
    });
  }

  ngOnInit() {
    this.cargarLeaflet().then(() => this.initMap());
  }

  ngOnDestroy() {
    if (this.map) { this.map.remove(); this.map = null; }
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    delete (window as any).ashbisSeleccionarMarcador;
  }

  // ── LEAFLET ──────────────────────────────────────────────

  private cargarLeaflet(): Promise<void> {
    return new Promise((resolve) => {
      if ((window as any).L) { resolve(); return; }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
  }

  private initMap() {
    setTimeout(() => {
      if (this.map) return;
      this.map = L.map('leaflet-map', {
        center: [-33.4378, -70.6504],
        zoom: 13,
        zoomControl: true,
      });

      // Tile oscuro — CartoDB Dark Matter
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(this.map);

      this.markersLayer = L.layerGroup().addTo(this.map);
    }, 300);
  }

  // ── BÚSQUEDA ─────────────────────────────────────────────

  findPlacesAction(tipo: 'veterinary_care' | 'pet_store') {
    this.currentSearchType = tipo;
    this.marcadoresEnMapa = [];
    this.marcadorSeleccionado = undefined;
    this.mostrarPanel = false;
    this.markersLayer?.clearLayers();
    if (this.userPositionMarker) {
      this.searchNearbyPlaces(this.userPositionMarker);
    } else {
      this.getCurrentLocation();
    }
  }

  getCurrentLocation() {
    if (!navigator.geolocation) {
      this.presentToast('Geolocalización no disponible.', 'danger');
      return;
    }
    this.estaCargando = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        this.userPositionMarker = coords;
        this.map.setView([coords.lat, coords.lng], 14);
        if (this.userMarker) this.userMarker.remove();
        this.userMarker = L.circleMarker([coords.lat, coords.lng], {
          radius: 10, fillColor: '#2563eb', color: '#fff', weight: 2, fillOpacity: 0.9,
        }).addTo(this.map).bindPopup('📍 Tu ubicación').openPopup();
        if (this.currentSearchType) {
          this.searchNearbyPlaces(coords);
        } else {
          this.estaCargando = false;
        }
      },
      () => {
        this.estaCargando = false;
        this.presentToast('No se pudo obtener tu ubicación. Activa el GPS.', 'danger');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }

  searchNearbyPlaces(coords: { lat: number; lng: number }) {
    this.estaCargando = true;
    this.markersLayer?.clearLayers();

    const tag = this.currentSearchType === 'veterinary_care' ? 'amenity=veterinary' : 'shop=pet';
    const radio = 5000;
    const query = `
      [out:json][timeout:25];
      (
        node[${tag}](around:${radio},${coords.lat},${coords.lng});
        way[${tag}](around:${radio},${coords.lat},${coords.lng});
      );
      out center tags;
    `;

    const servidores = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    ];

    this.intentarOverpass(servidores, 0, query);
  }

  private intentarOverpass(servidores: string[], index: number, query: string) {
    if (index >= servidores.length) {
      this.estaCargando = false;
      this.presentToast('No se pudo conectar al servidor. Intenta en unos minutos.', 'danger');
      return;
    }

    fetch(servidores[index], { method: 'POST', body: query })
      .then(r => {
        const contentType = r.headers.get('content-type') || '';
        if (!r.ok || contentType.includes('xml') || contentType.includes('text/html')) {
          throw new Error(`Error ${r.status}`);
        }
        return r.json();
      })
      .then(async data => {
        this.estaCargando = false;
        if (!data.elements || data.elements.length === 0) {
          this.presentToast('No se encontraron lugares en 5 km.', 'warning');
          return;
        }
        await this.procesarResultados(data.elements);
      })
      .catch(err => {
        console.warn(`Falló servidor ${index + 1}/${servidores.length}:`, err.message);
        setTimeout(() => this.intentarOverpass(servidores, index + 1, query), 500);
      });
  }

  private async procesarResultados(elementos: any[]) {
    const infoExtra = await this.cargarInfoExtraFirestore(elementos.map(e => String(e.id)));

    this.marcadoresEnMapa = elementos
      .filter(el => (el.lat ?? el.center?.lat) && (el.lon ?? el.center?.lon))
      .map(el => {
        const oh = el.tags?.opening_hours;
        const isOpen = this.evaluarHorario(oh);
        return {
          lat: el.lat ?? el.center?.lat,
          lng: el.lon ?? el.center?.lon,
          title: el.tags?.name || (this.currentSearchType === 'veterinary_care' ? 'Veterinaria' : 'Tienda de mascotas'),
          address: el.tags?.['addr:street']
            ? `${el.tags['addr:street']} ${el.tags['addr:housenumber'] || ''}`.trim()
            : 'Dirección no disponible',
          placeId: String(el.id),
          tipo: this.currentSearchType!,
          phone: el.tags?.phone || el.tags?.['contact:phone'],
          website: el.tags?.website || el.tags?.['contact:website'],
          openingHours: oh,
          isOpen,
          userInfo: infoExtra[String(el.id)],
        };
      });

    this.marcadoresEnMapa.forEach(m => {
      const emoji = m.tipo === 'veterinary_care' ? '🏥' : '🐾';
      const borderColor = m.isOpen === true ? '#22c55e' : m.isOpen === false ? '#6b7280' : '#facc15';
      const opacity = m.isOpen === false ? '0.5' : '1';

      const iconHtml = `
        <div style="
          display:flex; align-items:center; justify-content:center;
          width:36px; height:36px;
          background:#1a1a2e;
          border:2.5px solid ${borderColor};
          border-radius:50%;
          font-size:18px;
          box-shadow:0 0 8px ${borderColor}88;
          opacity:${opacity};
          cursor:pointer;
        ">${emoji}</div>
      `;

      const icon = L.divIcon({
        html: iconHtml,
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -20],
      });

      const marker = L.marker([m.lat, m.lng], { icon }).addTo(this.markersLayer);
      marker.on('click', () => this.seleccionarMarcador(m));
    });

    const abiertos = this.marcadoresEnMapa.filter(m => m.isOpen === true).length;
    const sinInfo = this.marcadoresEnMapa.filter(m => m.isOpen === null).length;
    this.presentToast(
      `${this.marcadoresEnMapa.length} lugares · ${abiertos} abiertos · ${sinInfo} sin horario`,
      'success'
    );
  }

  // ── HORARIO ──────────────────────────────────────────────

  private evaluarHorario(openingHours: string | undefined): boolean | null {
    if (!openingHours) return null;
    const oh = openingHours.trim().toLowerCase();
    if (oh === '24/7') return true;

    const now = new Date();
    const dayIndex = now.getDay();
    const hora = now.getHours() * 60 + now.getMinutes();

    const diasMap: Record<string, number[]> = {
      mo: [1], tu: [2], we: [3], th: [4], fr: [5], sa: [6], su: [0],
      'mo-fr': [1,2,3,4,5], 'mo-sa': [1,2,3,4,5,6],
      'mo-su': [0,1,2,3,4,5,6], 'sa-su': [0,6],
    };

    const partes = oh.split(';').map(p => p.trim());
    for (const parte of partes) {
      const match = parte.match(/^([a-z\-]+)\s+(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
      if (!match) continue;
      const [, dia, h1, m1, h2, m2] = match;
      const diasValidos = diasMap[dia];
      if (!diasValidos || !diasValidos.includes(dayIndex)) continue;
      const inicio = parseInt(h1) * 60 + parseInt(m1);
      const fin = parseInt(h2) * 60 + parseInt(m2);
      if (hora >= inicio && hora <= fin) return true;
      return false;
    }
    return null;
  }

  // ── FIRESTORE ────────────────────────────────────────────

  private async cargarInfoExtraFirestore(placeIds: string[]): Promise<Record<string, LugarUserInfo>> {
    try {
      const result: Record<string, LugarUserInfo> = {};
      for (const id of placeIds) {
        const info = await this.firestoreService.getLugarInfo?.(id);
        if (info) result[id] = info;
      }
      return result;
    } catch {
      return {};
    }
  }

  async guardarInfoUsuario() {
    if (!this.marcadorSeleccionado?.placeId) return;
    const user = await firstValueFrom(this.auth.authState$) as User | null;
    if (!user) { this.presentToast('Debes iniciar sesión para editar.', 'warning'); return; }
    try {
      await this.firestoreService.saveLugarInfo?.(
        this.marcadorSeleccionado.placeId,
        { ...this.editForm, actualizadoPor: user.uid }
      );
      this.marcadorSeleccionado.userInfo = { ...this.editForm };
      this.modoEdicion = false;
      this.presentToast('Información guardada correctamente.', 'success');
    } catch {
      this.presentToast('Error al guardar. Intenta de nuevo.', 'danger');
    }
  }

  async guardarVeterinariaFavorita() {
    if (!this.marcadorSeleccionado) return;
    if (this.currentSearchType !== 'veterinary_care') {
      this.presentToast('Solo puedes guardar veterinarias como favoritas.', 'warning'); return;
    }
    const user = await firstValueFrom(this.auth.authState$) as User | null;
    if (!user) { this.presentToast('Debes iniciar sesión para guardar favoritos.', 'warning'); return; }
    const m = this.marcadorSeleccionado;
    await this.firestoreService.addVeterinariaFavorita(user.uid, {
      placeId: m.placeId || '',
      nombre: m.title,
      direccion: m.address,
      lat: m.lat,
      lng: m.lng,
      rating: m.rating,
      tipos: [],
    });
    this.presentToast('Veterinaria añadida a favoritos 🐾', 'success');
  }

  // ── PANEL ────────────────────────────────────────────────

  seleccionarMarcador(m: Marcador) {
    this.marcadorSeleccionado = m;
    this.modoEdicion = false;
    this.editForm = { ...m.userInfo };
    this.mostrarPanel = true;
    setTimeout(() => {
      document.getElementById('panel-info')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  cerrarPanel() {
    this.mostrarPanel = false;
    this.marcadorSeleccionado = undefined;
    this.modoEdicion = false;
  }

  activarEdicion() {
    this.modoEdicion = true;
    if (this.marcadorSeleccionado) {
      this.editForm = {
        phone: this.marcadorSeleccionado.phone,
        website: this.marcadorSeleccionado.website,
        openingHours: this.marcadorSeleccionado.openingHours,
        ...this.marcadorSeleccionado.userInfo,
      };
    }
  }

  // ── UTILS ────────────────────────────────────────────────

  irAlChatIA() { this.router.navigate(['/chat-ia']); }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastController.create({
      message, duration: 3000, position: 'bottom', color,
    });
    await toast.present();
  }

  getEstadoLabel(m: Marcador): string {
    if (m.isOpen === true) return 'Abierto ahora';
    if (m.isOpen === false) return 'Cerrado ahora';
    return 'Horario desconocido';
  }

  getEstadoColor(m: Marcador): string {
    if (m.isOpen === true) return 'success';
    if (m.isOpen === false) return 'danger';
    return 'medium';
  }
}