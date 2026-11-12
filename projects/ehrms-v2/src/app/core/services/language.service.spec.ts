import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageService } from './language.service';

describe('LanguageService', () => {
  const translate = { currentLang: 'en', use: vi.fn() };
  let service: LanguageService;

  beforeEach(() => {
    localStorage.clear();
    translate.currentLang = 'en';
    translate.use.mockClear();
    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: translate }],
    });
    service = TestBed.inject(LanguageService);
  });

  afterEach(() => localStorage.clear());

  it('applies a stored language that is on offer', () => {
    localStorage.setItem('hrms_lang', 'ar');

    service.init();

    expect(translate.use).toHaveBeenCalledWith('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('ignores a stored value that is not an offered language', () => {
    localStorage.setItem('hrms_lang', '../../evil');

    service.init();

    expect(translate.use).not.toHaveBeenCalled();
    expect(document.documentElement.lang).toBe('en');
  });

  it('refuses to switch to a language that is not offered, and stores nothing', () => {
    service.setLanguage('../x');

    expect(translate.use).not.toHaveBeenCalled();
    expect(localStorage.getItem('hrms_lang')).toBeNull();
  });

  it('switches to an offered language and remembers it', () => {
    service.setLanguage('fr');

    expect(translate.use).toHaveBeenCalledWith('fr');
    expect(localStorage.getItem('hrms_lang')).toBe('fr');
    expect(document.documentElement.dir).toBe('ltr');
  });
});
