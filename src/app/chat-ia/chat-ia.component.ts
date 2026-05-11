import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonSpinner,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { sendOutline } from 'ionicons/icons';
import { AiProxyService } from 'src/app/services/ai-proxy.service';

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
    IonInput,
    IonSpinner,
    IonButtons,
    IonBackButton,
    IonIcon
  ]
})
export class ChatIaComponent {
  private readonly aiProxy = inject(AiProxyService);

  pasoActual = 1;
  categoriaSeleccionada = '';
  mascotaSeleccionada = '';
  mensaje = '';
  cargando = false;

  mensajes: { autor: string; texto: string; hora: string }[] = [];

  constructor() {
    addIcons({ sendOutline });
  }

  private obtenerHora(): string {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private agregarMensaje(autor: string, texto: string): void {
    this.mensajes.push({ autor, texto, hora: this.obtenerHora() });
  }

  async enviarMensajeIA(prompt: string): Promise<void> {
    this.cargando = true;
    try {
      const promptFormateado = `
Eres Ashbis IA, un asistente veterinario para perros y gatos.
Reglas de respuesta:
- Responde en espanol.
- Usa texto plano.
- Maximo 8 a 10 lineas.
- Frases cortas.
Pregunta:
${prompt}`.trim();

      const resp = await this.aiProxy.sendMessage(
        promptFormateado,
        this.categoriaSeleccionada,
        this.mascotaSeleccionada
      );
      this.agregarMensaje('Ashbis IA', resp?.text || 'No se obtuvo respuesta.');
    } catch (error) {
      console.error(error);
      this.agregarMensaje('Ashbis IA', 'Error al procesar tu mensaje.');
    } finally {
      this.cargando = false;
    }
  }

  seleccionarCategoria(categoria: string): void {
    this.categoriaSeleccionada = categoria;
    this.agregarMensaje('Ashbis IA', 'Perfecto. Que tipo de mascota tienes?');
    this.pasoActual = 2;
  }

  seleccionarMascota(tipo: string): void {
    this.mascotaSeleccionada = tipo;
    this.agregarMensaje(
      'Ashbis IA',
      `Excelente. Escribe tu pregunta sobre ${this.categoriaSeleccionada} de tu ${this.mascotaSeleccionada}.`
    );
    this.pasoActual = 3;
  }

  async enviarPregunta(): Promise<void> {
    if (!this.mensaje.trim()) return;
    const textoUsuario = this.mensaje.trim();
    this.agregarMensaje('Tu', textoUsuario);
    this.mensaje = '';
    const preguntaFinal = `Tema: ${this.categoriaSeleccionada}, Mascota: ${this.mascotaSeleccionada}. Pregunta: ${textoUsuario}`;
    await this.enviarMensajeIA(preguntaFinal);
  }

  reiniciarChat(): void {
    this.pasoActual = 1;
    this.categoriaSeleccionada = '';
    this.mascotaSeleccionada = '';
    this.mensaje = '';
    this.mensajes = [];
    this.ngOnInit();
  }

  ngOnInit(): void {
    this.agregarMensaje('Ashbis IA', 'Hola, soy Ashbis IA. Sobre que quieres aprender hoy?');
  }
}
