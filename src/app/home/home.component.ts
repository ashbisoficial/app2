import { Component, inject, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonCard, IonButton, IonIcon, IonCardContent, IonContent, IonSpinner
} from '@ionic/angular/standalone';
import { ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { AuthenticationService } from 'src/app/firebase/authentication';
import { addIcons } from 'ionicons';
import { hourglassOutline, locateOutline, star, bagOutline, pawOutline, chatbubblesOutline, heartOutline } from 'ionicons/icons';
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

addIcons({ hourglassOutline, locateOutline, bagOutline, pawOutline, star, chatbubblesOutline, heartOutline });

@Component({
  selector: 'app-home',
  templateUrl: 'home.component.html',
  styleUrls: ['home.component.scss'],
  standalone: true,
  imports: [CommonModule, IonCard, IonButton, IonIcon, IonCardContent, IonContent, IonSpinner],
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
  currentSearchType: 'veterinary_care' | 'pet_store' | null = null;

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
      addIcons({chatbubblesOutline,locateOutline,bagOutline});}

  ngOnInit() {
    this.cargarLeaflet().then(() => this.initMap());
  }

  ngOnDestroy() {
  if (this.map) {
    this.map.remove();
    this.map = null;
  }

  // 🔥 SOLUCIÓN
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

  // Carga Leaflet dinámicamente desde CDN
  private cargarLeaflet(): Promise<void> {
    return new Promise((resolve) => {
      if ((window as any).L) { resolve(); return; }

      // CSS de Leaflet
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      // JS de Leaflet
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

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(this.map);

      this.markersLayer = L.layerGroup().addTo(this.map);
    }, 300);
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color,
    });
    await toast.present();
  }

  findPlacesAction(tipo: 'veterinary_care' | 'pet_store') {
    this.currentSearchType = tipo;
    this.marcadoresEnMapa = [];
    this.marcadorSeleccionado = undefined;
    this.markersLayer?.clearLayers();

    if (this.userPositionMarker) {
      this.searchNearbyPlaces(this.userPositionMarker);
    } else {
      this.getCurrentLocation();
    }
  }

  getCurrentLocation() {
    if (!navigator.geolocation) {
      this.presentToast('Geolocalización no disponible en este navegador.', 'danger');
      return;
    }
    this.estaCargando = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        this.userPositionMarker = coords;
        this.map.setView([coords.lat, coords.lng], 14);

        // Marcador azul usuario
        if (this.userMarker) this.userMarker.remove();
        this.userMarker = L.circleMarker([coords.lat, coords.lng], {
          radius: 10,
          fillColor: '#2563eb',
          color: '#fff',
          weight: 2,
          fillOpacity: 0.9,
        }).addTo(this.map).bindPopup('📍 Tu ubicación').openPopup();

        if (this.currentSearchType) {
          this.searchNearbyPlaces(coords);
        } else {
          this.estaCargando = false;
        }
      },
      (err) => {
        this.estaCargando = false;
        this.presentToast('No se pudo obtener tu ubicación. Activa el GPS.', 'danger');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }

  // Búsqueda con Overpass API (OpenStreetMap) — 100% gratis
  searchNearbyPlaces(coords: { lat: number; lng: number }) {
    this.estaCargando = true;
    this.markersLayer?.clearLayers();

    // Tag de OSM según tipo
    const tag = this.currentSearchType === 'veterinary_care'
      ? 'amenity=veterinary'
      : 'shop=pet';

    const radio = 5000; // 5 km
    const query = `
      [out:json][timeout:25];
      (
        node[${tag}](around:${radio},${coords.lat},${coords.lng});
        way[${tag}](around:${radio},${coords.lat},${coords.lng});
      );
      out center;
    `;

    fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
    })
      .then(r => r.json())
      .then(data => {
        this.estaCargando = false;
        const elementos = data.elements as any[];

        if (!elementos || elementos.length === 0) {
          this.presentToast('No se encontraron lugares en 5 km.', 'warning');
          return;
        }

        const color = this.currentSearchType === 'veterinary_care' ? '#dc2626' : '#16a34a';
        const emoji = this.currentSearchType === 'veterinary_care' ? '🏥' : '🐾';

        this.marcadoresEnMapa = elementos.map(el => ({
          lat: el.lat ?? el.center?.lat,
          lng: el.lon ?? el.center?.lon,
          title: el.tags?.name || (this.currentSearchType === 'veterinary_care' ? 'Veterinaria' : 'Tienda de mascotas'),
          address: el.tags?.['addr:street']
            ? `${el.tags['addr:street']} ${el.tags['addr:housenumber'] || ''}`.trim()
            : 'Dirección no disponible',
          placeId: String(el.id),
          tipo: this.currentSearchType!,
        }));

        // Agregar marcadores al mapa
        this.marcadoresEnMapa.forEach(m => {
          const marker = L.circleMarker([m.lat, m.lng], {
            radius: 9,
            fillColor: color,
            color: '#fff',
            weight: 2,
            fillOpacity: 0.85,
          }).addTo(this.markersLayer);

          marker.bindPopup(`
            <div style="min-width:180px">
              <strong>${emoji} ${m.title}</strong><br/>
              <span style="font-size:12px;color:#555">${m.address}</span><br/>
              <button onclick="window.ashbisSeleccionarMarcador('${m.placeId}')"
                style="margin-top:6px;background:#dc2626;color:#fff;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;">
                ❤️ Guardar favorita
              </button>
            </div>
          `);

          marker.on('click', () => {
            this.marcadorSeleccionado = m;
          });
        });

        // Exponer función global para el botón del popup
        (window as any).ashbisSeleccionarMarcador = (placeId: string) => {
          this.marcadorSeleccionado = this.marcadoresEnMapa.find(m => m.placeId === placeId);
          this.guardarVeterinariaFavorita();
        };

        this.presentToast(`Se encontraron ${elementos.length} lugares cercanos.`, 'success');
      })
      .catch(err => {
        this.estaCargando = false;
        console.error(err);
        this.presentToast('Error al buscar lugares. Intenta de nuevo.', 'danger');
      });
  }

  async guardarVeterinariaFavorita() {
    if (!this.marcadorSeleccionado) return;

    if (this.currentSearchType !== 'veterinary_care') {
      this.presentToast('Solo puedes guardar veterinarias.', 'warning');
      return;
    }

    const user = await firstValueFrom(this.auth.authState$) as User | null;
    if (!user) {
      this.presentToast('Debes iniciar sesión para guardar favoritos.', 'warning');
      return;
    }

    const m = this.marcadorSeleccionado;
    const vet: VeterinariaFavoritaInput = {
      placeId: m.placeId || '',
      nombre: m.title,
      direccion: m.address,
      lat: m.lat,
      lng: m.lng,
      rating: m.rating,
      tipos: [],
    };

    if (user) {
  await this.firestoreService.addVeterinariaFavorita(user.uid, vet);
}
    this.presentToast('Veterinaria añadida a favoritos 🐾', 'success');
  }

  irAlChatIA() {
    this.router.navigate(['/chat-ia']);
  }
}