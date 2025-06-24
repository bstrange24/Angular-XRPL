// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';
import { Buffer } from 'buffer';
import { provideHttpClient } from '@angular/common/http';

// Make Buffer and process available globally
(window as any).Buffer = Buffer;

bootstrapApplication(AppComponent, {
     providers: [provideRouter(routes), provideHttpClient()],
}).catch(err => console.error(err));
