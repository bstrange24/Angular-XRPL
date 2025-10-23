import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ClickToCopyService {
     private renderer: Renderer2;

     constructor(rendererFactory: RendererFactory2) {
          this.renderer = rendererFactory.createRenderer(null, null);
     }

     attachCopy(container: HTMLElement) {
          if (!container) return;

          // const codeElements = container.querySelectorAll<HTMLElement>('code, .result-cell.value');
          const codeElements = container.querySelectorAll<HTMLElement>('code');

          codeElements.forEach(codeEl => {
               if (codeEl.dataset['copyBound']) return;
               codeEl.dataset['copyBound'] = 'true';

               this.renderer.setStyle(codeEl, 'cursor', 'pointer');
               this.renderer.setAttribute(codeEl, 'title', 'Click to copy');

               codeEl.addEventListener('click', e => {
                    const target = e.target as HTMLElement;
                    if (target.closest('input') || target.closest('label')) return;

                    const text = codeEl.textContent?.trim() || '';
                    if (!text) return;

                    navigator.clipboard.writeText(text).then(() => {
                         this.renderer.addClass(codeEl, 'copied');
                         this.renderer.setAttribute(codeEl, 'title', 'Copied!');
                         setTimeout(() => {
                              this.renderer.removeClass(codeEl, 'copied');
                              this.renderer.setAttribute(codeEl, 'title', 'Click to copy');
                         }, 600);
                    });
               });
          });
     }
}
