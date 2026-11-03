import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';

import { LoginComponent } from './login';
import { Auth } from '../../../core/auth/auth';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/services/language.service';

function setup() {
  TestBed.configureTestingModule({
    imports: [LoginComponent],
    providers: [
      provideTranslateService(),
      provideRouter([]),
      provideNoopAnimations(),
      { provide: Auth, useValue: { hasValidSession: () => false, clearSession: () => undefined } },
      { provide: AuthService, useValue: {} },
      {
        provide: LanguageService,
        useValue: {
          direction: signal('ltr'),
          currentLang: signal('en'),
          languages: [{ code: 'en', label: 'English' }],
          getCurrentLanguage: () => 'en',
          setLanguage: () => undefined,
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(LoginComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('LoginComponent company logos', () => {
  it('shows the Nile Petroleum and Afro Genius logos as one labelled group under the form', () => {
    const el = setup();
    const group = el.querySelector('.partners');

    expect(group).not.toBeNull();
    expect(group?.getAttribute('role')).toBe('group');
    expect(group?.getAttribute('aria-label')).toBe('auth.login.partners.label');
    expect([...(group?.querySelectorAll('img') ?? [])].map((i) => i.getAttribute('src'))).toEqual([
      expect.stringContaining('images/partner-nilepet.jpg'),
      expect.stringContaining('images/partner-afro-genius.png'),
    ]);
  });

  it('gives each logo text for screen readers, and hides the decorative divider', () => {
    const el = setup();
    const images = [...el.querySelectorAll('.partners img')];

    expect(images.map((i) => i.getAttribute('alt'))).toEqual([
      'auth.login.partners.nilepet',
      'auth.login.partners.afroGenius',
    ]);
    expect(el.querySelector('.partner-divider')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps the logos after the sign-in form and before the copyright line', () => {
    const el = setup();
    const form = el.querySelector('form');
    const logos = el.querySelector('.partners');
    const footer = el.querySelector('.footer-text');

    expect(form && logos && form.compareDocumentPosition(logos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(logos && footer && logos.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the full HRMS logo, with its symbol, in the brand panel and no Afro Genius there', () => {
    const el = setup();
    const images = [...el.querySelectorAll('.brand-panel .brand-logo img')];

    expect(images).toHaveLength(1);
    expect(images[0].getAttribute('src')).toContain('images/logo-full.png');
    expect(images[0].getAttribute('alt')).toBe('HRMS');
    expect(el.querySelector('.brand-panel')?.innerHTML).not.toContain('afro-genius');
  });
});
