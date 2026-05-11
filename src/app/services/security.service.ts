import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SecurityService {
  private readonly loginWindowMs = 15 * 60 * 1000;
  private readonly maxLoginAttempts = 5;

  sanitizeText(input: unknown): string {
    if (typeof input !== 'string') return '';
    return input
      .replace(/<[^>]*>/g, '')
      .replace(/[<>]/g, '')
      .trim();
  }

  sanitizeFirestoreObject<T extends Record<string, any>>(value: T): T {
    const output: Record<string, any> = {};
    Object.entries(value ?? {}).forEach(([key, val]) => {
      if (typeof val === 'string') {
        output[key] = this.sanitizeText(val);
      } else if (Array.isArray(val)) {
        output[key] = val.map((item) => (typeof item === 'string' ? this.sanitizeText(item) : item));
      } else {
        output[key] = val;
      }
    });
    return output as T;
  }

  canAttemptLogin(identifier: string): boolean {
    const key = this.loginStorageKey(identifier);
    const attempts = this.readAttempts(key);
    const now = Date.now();
    const valid = attempts.filter((ts) => now - ts < this.loginWindowMs);
    if (valid.length >= this.maxLoginAttempts) return false;
    valid.push(now);
    localStorage.setItem(key, JSON.stringify(valid));
    return true;
  }

  resetLoginAttempts(identifier: string): void {
    localStorage.removeItem(this.loginStorageKey(identifier));
  }

  private loginStorageKey(identifier: string): string {
    return `login_attempts_${identifier.toLowerCase()}`;
  }

  private readAttempts(key: string): number[] {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((n) => Number.isFinite(n)) : [];
    } catch {
      return [];
    }
  }
}
