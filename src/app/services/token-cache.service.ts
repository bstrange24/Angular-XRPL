import { Injectable } from '@angular/core';

@Injectable({
     providedIn: 'root',
})
export class TokenCacheService {
     private readonly STORAGE_KEY = 'tokenCreationDates';
     private cache: Map<string, string>;

     constructor() {
          const stored = localStorage.getItem(this.STORAGE_KEY);
          this.cache = stored ? new Map(JSON.parse(stored)) : new Map();
     }

     getDate(key: string): Date | null {
          const value = this.cache.get(key);
          return value ? new Date(value) : null;
     }

     setDate(key: string, date: Date): void {
          this.cache.set(key, date.toISOString());
          this.persist();
     }

     clear(): void {
          this.cache.clear();
          localStorage.removeItem(this.STORAGE_KEY);
     }

     private persist(): void {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(Array.from(this.cache.entries())));
     }
}
