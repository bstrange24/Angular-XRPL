// src/app/pipes/sanitize-html.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
     name: 'sanitizeHtml',
     standalone: true,
})
export class SanitizeHtmlPipe implements PipeTransform {
     constructor(private sanitizer: DomSanitizer) {}

     transform(value: string): SafeHtml {
          return this.sanitizer.bypassSecurityTrustHtml(value);
     }
}
