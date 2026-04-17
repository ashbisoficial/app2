import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

// 🔥 Firebase imports
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';

// ✅ Configuración de Firebase (tu proyecto)
const firebaseConfig = {
  apiKey: 'AIzaSyAhVl-d7fikWwNB4gNPLV6ZcO6mg-CSoEg',
  authDomain: 'ashbis-ae5b2.firebaseapp.com',
  projectId: 'ashbis-ae5b2',
  storageBucket: 'ashbis-ae5b2.firebasestorage.app',
  messagingSenderId: '691736988474',
  appId: '1:691736988474:web:8fb6e043aa8e0b0c779e03',
  measurementId: 'G-8P1SNJ4TL3'
};

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),

    // ✅ 🔥 INICIALIZAR FIREBASE
    provideFirebaseApp(() => initializeApp(firebaseConfig)),

    // ✅ AUTH (LOGIN)
    provideAuth(() => getAuth()),

    // ✅ FIRESTORE (BASE DE DATOS)
    provideFirestore(() => getFirestore())
  ],
});