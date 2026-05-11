import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface AiProxyRequest {
  prompt: string;
  categoria: string;
  mascota: string;
}

export interface AiProxyResponse {
  text: string;
}

@Injectable({ providedIn: 'root' })
export class AiProxyService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = environment.aiProxyUrl;

  async sendMessage(prompt: string, categoria: string, mascota: string): Promise<AiProxyResponse> {
    const body: AiProxyRequest = { prompt, categoria, mascota };
    const req$ = this.http.post<AiProxyResponse>(this.endpoint, body).pipe(timeout(15000));
    return firstValueFrom(req$);
  }
}
