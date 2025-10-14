import { TestBed } from '@angular/core/testing';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SanitizeHtmlPipe } from './sanitize-html.pipe';

describe('SanitizeHtmlPipe', () => {
     let pipe: SanitizeHtmlPipe;
     let sanitizerSpy: jasmine.SpyObj<DomSanitizer>;

     beforeEach(() => {
          // Mock DomSanitizer to avoid real sanitization in tests
          sanitizerSpy = jasmine.createSpyObj('DomSanitizer', ['bypassSecurityTrustHtml', 'sanitize']);
          (sanitizerSpy.bypassSecurityTrustHtml as jasmine.Spy).and.returnValue('sanitized html' as SafeHtml);

          TestBed.configureTestingModule({
               providers: [{ provide: DomSanitizer, useValue: sanitizerSpy }, SanitizeHtmlPipe],
          });

          pipe = TestBed.inject(SanitizeHtmlPipe);
     });

     it('create an instance', () => {
          expect(pipe).toBeTruthy();
     });

     // Add more tests as needed, e.g.:
     it('should sanitize HTML', () => {
          const value = '<script>alert("xss")</script>';
          const result = pipe.transform(value);
          expect(result).toBe('sanitized html');
          expect(sanitizerSpy.bypassSecurityTrustHtml).toHaveBeenCalledWith(value);
     });
});
