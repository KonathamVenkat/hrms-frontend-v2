import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { EmployeeForm } from './employee-form';
import { EmployeeService } from '../../services/employee';
import { Auth } from '../../../../core/auth/auth';
import { LanguageService } from '../../../../core/services/language.service';

function setup() {
  const lookups = () => of({ success: true, message: '', statusCode: 200, data: [] });
  TestBed.configureTestingModule({
    imports: [EmployeeForm],
    providers: [
      provideTranslateService(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
      {
        provide: EmployeeService,
        useValue: {
          getNationalities: lookups,
          getReligions: lookups,
          getDepartments: lookups,
          getDesignations: lookups,
        },
      },
      { provide: Auth, useValue: { getRole: () => 'HR_ADMIN', hasAnyRole: () => true } },
      { provide: LanguageService, useValue: { direction: signal('ltr'), currentLang: signal('en') } },
    ],
  });
  const fixture = TestBed.createComponent(EmployeeForm);
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('EmployeeForm unsaved changes', () => {
  it('has none until something is typed, and then asks before leaving', () => {
    const component = setup();
    expect(component.hasUnsavedChanges()).toBe(false);

    component.form.controls.firstName.setValue('Sara');
    component.form.controls.firstName.markAsDirty();

    expect(component.hasUnsavedChanges()).toBe(true);
  });

  it('does not ask once the employee was saved', () => {
    const component = setup();
    component.form.controls.firstName.markAsDirty();

    component.success.set(true);

    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('asks the browser to warn before the tab closes, only while there are unsaved edits', () => {
    const component = setup();
    const clean = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    component.onBeforeUnload(clean);
    expect(clean.defaultPrevented).toBe(false);

    component.form.controls.firstName.markAsDirty();
    const dirty = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    component.onBeforeUnload(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});
