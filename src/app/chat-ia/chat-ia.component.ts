import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from 'src/environments/environment';

import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButton, IonList, IonItem, IonLabel,
  IonInput, IonSpinner, IonButtons, IonBackButton, IonIcon
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { sendOutline } from 'ionicons/icons';

@Component({
  selector: 'app-chat-ia',
  templateUrl: './chat-ia.component.html',
  styleUrls: ['./chat-ia.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButton,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonSpinner,
    IonButtons,
    IonBackButton,
    IonIcon
  ]
})
export class ChatIaComponent {

  pasoActual: number = 1;
  categoriaSeleccionada: string = '';
  mascotaSeleccionada: string = '';
  mensaje: string = '';

  mensajes: {
    autor: string;
    texto: string;
    hora: string;
  }[] = [];

  cargando: boolean = false;

  constructor() {
    addIcons({ sendOutline });
  }

  // ⏰ Obtener hora
  private obtenerHora(): string {
    const now = new Date();
    return now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // 💬 Agregar mensaje (helper limpio)
  private agregarMensaje(autor: string, texto: string) {
    this.mensajes.push({
      autor,
      texto,
      hora: this.obtenerHora()
    });
  }

  // 🤖 IA
  async enviarMensajeIA(prompt: string) {
    this.cargando = true;

    try {
      const promptFormateado = `
Eres Ashbis IA, un asistente veterinario para perros y gatos.

Reglas de respuesta:
- Responde en español.
- Usa texto plano.
- Máximo 8–10 líneas.
- Frases cortas.

Pregunta:
${prompt}
      `.trim();

      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=' + environment.geminiApiKey,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptFormateado }] }],
          }),
        }
      );

      const data = await response.json();

      if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        this.agregarMensaje('Ashbis IA', data.candidates[0].content.parts[0].text);
      } else if (data?.error) {
        this.agregarMensaje('Ashbis IA', '⚠️ ' + data.error.message);
      } else {
        this.agregarMensaje('Ashbis IA', 'No entendí la respuesta 😅');
      }

    } catch (error) {
      console.error(error);
      this.agregarMensaje('Ashbis IA', '🚨 Error al procesar tu mensaje.');
    } finally {
      this.cargando = false;
    }
  }

  // 🧩 PASOS

  seleccionarCategoria(categoria: string) {
    this.categoriaSeleccionada = categoria;
    this.agregarMensaje('Ashbis IA', 'Perfecto 🐾 ¿Qué tipo de mascota tienes?');
    this.pasoActual = 2;
  }

  seleccionarMascota(tipo: string) {
    this.mascotaSeleccionada = tipo;
    this.agregarMensaje(
      'Ashbis IA',
      `Excelente 🐶🐱 Ahora escribe tu pregunta sobre ${this.categoriaSeleccionada} de tu ${this.mascotaSeleccionada}.`
    );
    this.pasoActual = 3;
  }

  async enviarPregunta() {
    if (!this.mensaje.trim()) return;

    const textoUsuario = this.mensaje;

    this.agregarMensaje('Tú', textoUsuario);
    this.mensaje = '';

    const preguntaFinal =
      `Tema: ${this.categoriaSeleccionada}, Mascota: ${this.mascotaSeleccionada}. Pregunta: ${textoUsuario}`;

    await this.enviarMensajeIA(preguntaFinal);
  }

  // 🔄 Reset
  reiniciarChat() {
    this.pasoActual = 1;
    this.categoriaSeleccionada = '';
    this.mascotaSeleccionada = '';
    this.mensaje = '';
    this.mensajes = [];

    this.ngOnInit();
  }

  // 👋 Init
  ngOnInit() {
    this.agregarMensaje(
      'Ashbis IA',
      '👋 Hola, soy Ashbis IA. ¿Sobre qué quieres aprender hoy?'
    );
  }
}