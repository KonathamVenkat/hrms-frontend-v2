import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';

import { LanguageSwitcher } from './language-switcher';
import { LanguageService } from '../../services/language.service';

const languages = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
];

function setup(initial: string) {
  const currentLang = signal(initial);
  const setLanguage = vi.fn((code: string) => currentLang.set(code));
  TestBed.configureTestingModule({
    imports: [LanguageSwitcher],
    providers: [
      provideTranslateService(),
      { provide: LanguageService, useValue: { languages, currentLang, setLanguage } },
    ],
  });
  const fixture = TestBed.createComponent(LanguageSwitcher);
  fixture.detectChanges();
  const select = (fixture.nativeElement as HTMLElement).querySelector('select') as HTMLSelectElement;
  return { fixture, select, setLanguage, currentLang };
}

describe('LanguageSwitcher', () => {
  it('shows the saved language the first time it is drawn, not English', () => {
    // After a reload the saved language is applied at start-up, before the translation files have finished loading.
    expect(setup('ar').select.value).toBe('ar');
    TestBed.resetTestingModule();
    expect(setup('fr').select.value).toBe('fr');
  });

  it('follows the language when it changes elsewhere, and reports the user\'s choice', () => {
    const { fixture, select, setLanguage, currentLang } = setup('en');
    expect(select.value).toBe('en');

    currentLang.set('ar');
    fixture.detectChanges();
    expect(select.value).toBe('ar');

    select.value = 'fr';
    select.dispatchEvent(new Event('change'));
    expect(setLanguage).toHaveBeenCalledWith('fr');
  });

  it('lists every language and labels the control for screen readers', () => {
    const { select } = setup('en');

    expect([...select.options].map((o) => o.value)).toEqual(['en', 'fr', 'ar']);
    expect(select.getAttribute('aria-label')).toBe('layout.toolbar.language');
  });
});
