import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { EmployeeDetail } from './employee-detail';
import { EmployeeService } from '../../services/employee';
import { EmployeeDetailData } from '../../models/employee';
import { Auth } from '../../../../core/auth/auth';
import { AuthService } from '../../../../core/auth/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { OwnPhoto } from '../../../../core/services/own-photo.service';
import { PhotoCache } from '../../../../core/services/photo-cache.service';
import { UnsavedChangesTracker } from '../../../../core/forms/discard-prompt';

const employee = {
  employeeId: 7,
  employeeCode: 'EMP-2026-0007',
  firstName: 'Sara',
  firstNameAr: 'سارة',
  lastName: 'Khan',
  lastNameAr: 'خان',
  fullNameEn: 'Sara Khan',
  fullNameAr: 'سارة خان',
  dateOfBirth: '1990-01-02',
  gender: 'FEMALE',
  personalEmail: 'sara@example.com',
  workEmail: 'sara@company.com',
  hireDate: '2024-03-01',
  employmentStatus: 'ACTIVE',
  employmentType: 'FULL_TIME',
  isActive: true,
} as EmployeeDetailData;

function setup(opts: { self: boolean; role: string; routeId?: string }) {
  const none = () => of({ success: true, message: '', statusCode: 200, data: [] });
  const employees = {
    getEmployee: vi.fn(() => of({ success: true, message: '', statusCode: 200, data: employee })),
    // The Job Details tab, once opened, asks the same service for its dropdown lists.
    getDepartments: none,
    getDesignations: none,
    getProfessions: none,
    getSpecializations: none,
    getContractTypes: none,
    getDepartmentManagers: none,
    getSectionsByDepartment: none,
  };
  const ownPhoto = { set: vi.fn(), url: signal<string | undefined>(undefined) };
  const roles = [opts.role];

  TestBed.configureTestingModule({
    imports: [EmployeeDetail],
    providers: [
      provideTranslateService(),
      provideRouter([]),
      // The tab components inside the page load their own data; the requests are never answered here.
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            data: opts.self ? { self: true } : {},
            paramMap: convertToParamMap(opts.routeId ? { id: opts.routeId } : {}),
          },
        },
      },
      { provide: EmployeeService, useValue: employees },
      {
        provide: Auth,
        useValue: {
          getRole: () => opts.role,
          getEmployeeId: () => 7,
          hasAnyRole: (...wanted: string[]) => wanted.some((r) => roles.includes(r)),
        },
      },
      { provide: AuthService, useValue: {} },
      { provide: LanguageService, useValue: { direction: signal('ltr'), currentLang: signal('en') } },
      { provide: OwnPhoto, useValue: ownPhoto },
      { provide: PhotoCache, useValue: { load: () => of(null) } },
    ],
  });

  const fixture = TestBed.createComponent(EmployeeDetail);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const tabIds = () => [...el.querySelectorAll('[role=tab]')].map((t) => t.id);
  return { fixture, component: fixture.componentInstance, employees, ownPhoto, el, tabIds };
}

describe('EmployeeDetail as "My profile"', () => {
  it('loads the signed-in user\'s own record, with no HR actions and only the tabs an employee may read', () => {
    const { employees, el, tabIds, component } = setup({ self: true, role: 'EMPLOYEE' });

    expect(employees.getEmployee).toHaveBeenCalledWith(7);
    expect(el.querySelector('.back-btn')).toBeNull();
    expect(el.querySelector('.btn-edit')).toBeNull();
    expect(el.querySelector('.btn-deactivate')).toBeNull();
    expect(tabIds()).toEqual([
      'detail-tab-profile',
      'detail-tab-identity',
      'detail-tab-bank',
      'detail-tab-family',
      'detail-tab-qualifications',
      'detail-tab-experience',
    ]);
    expect(component.identityReadOnly()).toBe(true);
  });

  it('shows every tab to an HR user viewing their own profile, but still no HR actions', () => {
    const { el, tabIds } = setup({ self: true, role: 'HR_MANAGER' });

    expect(tabIds()).toHaveLength(9);
    expect(el.querySelector('.btn-edit')).toBeNull();
  });

  it('lets an HR_ADMIN change their own identity details', () => {
    const { component } = setup({ self: true, role: 'HR_ADMIN' });

    expect(component.identityReadOnly()).toBe(false);
  });

  it('leaves through the dashboard, because the employee list is HR-only', () => {
    const { component } = setup({ self: true, role: 'EMPLOYEE' });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    component.goBack();

    expect(navigate).toHaveBeenCalledWith('/app/dashboard');
  });

  it('updates the toolbar photo when the user changes their own photo', () => {
    const { component, ownPhoto } = setup({ self: true, role: 'EMPLOYEE' });

    component.onPhotoChanged('/api/v1/employees/7/photo?v=9');

    expect(ownPhoto.set).toHaveBeenCalledWith('/api/v1/employees/7/photo?v=9');
  });
});

describe('EmployeeDetail for an HR user opening someone else', () => {
  it('uses the id from the address, keeps the back button and does not touch the toolbar photo', () => {
    const { employees, el, component, ownPhoto } = setup({ self: false, role: 'HR_ADMIN', routeId: '9' });
    employees.getEmployee.mockClear();

    expect(el.querySelector('.back-btn')).not.toBeNull();
    expect(el.querySelector('.btn-edit')).not.toBeNull();

    component.employee.update((e) => (e ? { ...e, employeeId: 9 } : e));
    component.onPhotoChanged('/api/v1/employees/9/photo?v=1');
    expect(ownPhoto.set).not.toHaveBeenCalled();
  });
});

describe('EmployeeDetail guided flow (Continue to the next tab)', () => {
  it('starts on Profile with a Continue button that names the next tab', () => {
    const { component, el } = setup({ self: false, role: 'HR_ADMIN', routeId: '7' });

    expect(component.activeDetailTab()).toBe('profile');
    expect(component.nextTab()?.id).toBe('job');
    const button = el.querySelector<HTMLButtonElement>('.btn-continue');
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain('employee.detail.continueTo');
    expect(button?.getAttribute('type')).toBe('button');
  });

  it('walks through every tab in order, one click each, and offers nothing after the last', () => {
    const { component, fixture, el } = setup({ self: false, role: 'HR_ADMIN', routeId: '7' });
    const seen: string[] = [component.activeDetailTab()];

    for (let i = 0; i < 8; i++) {
      el.querySelector<HTMLButtonElement>('.btn-continue')?.click();
      fixture.detectChanges();
      seen.push(component.activeDetailTab());
    }

    expect(seen).toEqual(['profile', 'job', 'addresses', 'identity', 'bank', 'documents', 'family', 'qualifications', 'experience']);
    expect(component.nextTab()).toBeNull();
    expect(el.querySelector('.btn-continue')).toBeNull();
  });

  it('marks only the open tab as active, for the red bar and for screen readers', () => {
    const { component, fixture, el } = setup({ self: false, role: 'HR_ADMIN', routeId: '7' });

    component.goToNextTab();
    fixture.detectChanges();

    const active = [...el.querySelectorAll('[role=tab].active')].map((t) => t.id);
    expect(active).toEqual(['detail-tab-job']);
    expect(el.querySelector('#detail-tab-job')?.getAttribute('aria-selected')).toBe('true');
    expect(el.querySelector('#detail-tab-profile')?.getAttribute('aria-selected')).toBe('false');
  });

  it('skips the tabs an employee may not read when they continue through their own profile', () => {
    const { component, fixture, el } = setup({ self: true, role: 'EMPLOYEE' });
    const seen: string[] = [component.activeDetailTab()];

    while (component.nextTab()) {
      el.querySelector<HTMLButtonElement>('.btn-continue')?.click();
      fixture.detectChanges();
      seen.push(component.activeDetailTab());
    }

    expect(seen).toEqual(['profile', 'identity', 'bank', 'family', 'qualifications', 'experience']);
  });

  it('does nothing on the last tab', () => {
    const { component } = setup({ self: false, role: 'HR_ADMIN', routeId: '7' });
    component.activeDetailTab.set('experience');

    component.goToNextTab();

    expect(component.activeDetailTab()).toBe('experience');
  });
});

describe('EmployeeDetail unsaved changes', () => {
  it('has unsaved changes while a form on one of the tabs does, and warns before the browser tab closes', () => {
    const { component } = setup({ self: false, role: 'HR_ADMIN', routeId: '7' });
    const tracker = TestBed.inject(UnsavedChangesTracker);
    const forget = tracker.register(() => true);

    expect(component.hasUnsavedChanges()).toBe(true);
    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    component.onBeforeUnload(event);
    expect(event.defaultPrevented).toBe(true);

    forget();
  });

  it('lets the browser close without a warning when every form is saved or closed', () => {
    const { component } = setup({ self: false, role: 'HR_ADMIN', routeId: '7' });

    expect(component.hasUnsavedChanges()).toBe(false);
    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    component.onBeforeUnload(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
