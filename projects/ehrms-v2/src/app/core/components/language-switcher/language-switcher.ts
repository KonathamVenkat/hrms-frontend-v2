import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-language-switcher',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <select
      class="lang-select"
      [attr.aria-label]="'layout.toolbar.language' | translate"
      [value]="languageService.getCurrentLanguage()"
      (change)="languageService.setLanguage($any($event.target).value)"
    >
      @for (lang of languageService.languages; track lang.code) {
        <option [value]="lang.code">{{ lang.label }}</option>
      }
    </select>
  `,
  styles: [
    `
      .lang-select {
        block-size: 44px;
        padding-inline: 10px;
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: var(--radius-md);
        font: var(--mat-sys-label-large);
        background: var(--mat-sys-surface);
        color: var(--mat-sys-on-surface);
        cursor: pointer;
      }
      .lang-select:focus-visible {
        outline: 2px solid var(--mat-sys-primary);
        outline-offset: 2px;
      }
    `,
  ],
})
export class LanguageSwitcher {
  protected languageService = inject(LanguageService);
}
