import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';

import { EmployeeDetail } from './employee-detail';
import { EmployeeService } from '../../services/employee';
import { EmployeeCompleteness, EmployeeDetailData } from '../../models/employee';
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

const NOTHING_SAVED: EmployeeCompleteness = {
  job: false,
  addresses: false,
  identity: false,
  bank: false,
  documents: false,
  family: false,
  qualifications: false,
  experience: false,
};

function setup(opts: {
  self: boolean;
  role: string;
  routeId?: string;
  completeness?: EmployeeCompleteness;
  completenessFails?: boolean;
  /** The completeness answer is held back until the test sends it. */
  pendingCompleteness?: Subject<{ success: boolean; message: string; statusCode: number; data: EmployeeCompleteness }>;
}) {
  const none = () => of({ success: true, message: '', statusCode: 200, data: [] });
  const employees = {
    getEmployee: vi.fn(() => of({ success: true, message: '', statusCode: 200, data: employee })),
    getCompleteness: vi.fn(() =>
      opts.pendingCompleteness
        ? opts.pendingCompleteness
        : opts.completenessFails
        ? throwError(() => new Error('down'))
        : of({ success: true, message: '', statusCode: 200, data: opts.completeness ?? NOTHING_SAVED }),
    ),
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
      'detail-tab-addresses',
      'detail-tab-identity',
      'detail-tab-family',
      'detail-tab-qualifications',
      'detail-tab-experience',
    ]);
    // An employee fills in and edits their own details, so nothing on their profile is read-only.
    expect(component.identityReadOnly()).toBe(false);
    expect(component.canEditRecords()).toBe(true);
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

  it('lets an HR_MANAGER edit only their own record, not that of another employee', () => {
    expect(setup({ self: true, role: 'HR_MANAGER' }).component.canEditRecords()).toBe(true);
    TestBed.resetTestingModule();
    expect(setup({ self: false, role: 'HR_MANAGER', routeId: '9' }).component.canEditRecords()).toBe(false);
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

  it('opens the first tab from Profile (nothing is required there), then waits for the tab\'s required data', () => {
    const { component, fixture, el } = setup({ self: false, role: 'HR_ADMIN', routeId: '7' });
    expect(component.canContinue()).toBe(true);

    el.querySelector<HTMLButtonElement>('.btn-continue')?.click();
    fixture.detectChanges();

    // Job Details is still loading (the request is never answered here): Continue is off and says why.
    expect(component.activeDetailTab()).toBe('job');
    expect(component.canContinue()).toBe(false);
    // Not natively disabled: it stays focusable so a keyboard or screen-reader user can read why it waits.
    expect(el.querySelector<HTMLButtonElement>('.btn-continue')?.getAttribute('aria-disabled')).toBe('true');
    expect(el.querySelector<HTMLButtonElement>('.btn-continue')?.disabled).toBe(false);
    expect(el.querySelector('#continue-blocked')?.getAttribute('role')).toBe('status');
    expect(el.querySelector('#continue-blocked')?.textContent).toContain('employee.detail.continueBlocked');
    expect(el.querySelector('.btn-continue')?.getAttribute('aria-describedby')).toBe('continue-blocked');

    component.goToNextTab();
    expect(component.activeDetailTab()).toBe('job');
  });

  it('locks every tab after the first one whose required data is not saved, and disables it in the tab bar', () => {
    const { component, el } = setup({ self: false, role: 'HR_ADMIN', routeId: '7' });

    // Nothing has loaded: Profile is open, Job Details (the first required tab) is reachable, the rest are locked.
    expect([...component.lockedTabs()]).toEqual([
      'addresses', 'identity', 'bank', 'documents', 'family', 'qualifications', 'experience',
    ]);
    expect(el.querySelector('#detail-tab-job')?.getAttribute('aria-disabled')).toBeNull();
    expect(el.querySelector('#detail-tab-bank')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('keeps a locked tab focusable and explained, but a click or an arrow key never opens it', () => {
    const { component, fixture, el } = setup({ self: false, role: 'HR_ADMIN', routeId: '7' });
    const bank = el.querySelector<HTMLButtonElement>('#detail-tab-bank');

    expect(bank?.disabled).toBe(false); // still reachable with the arrow keys
    expect(bank?.getAttribute('aria-describedby')).toBe('tab-locked-reason');
    expect(el.querySelector('#tab-locked-reason')?.textContent).toContain('employee.detail.tabLocked');

    bank?.click();
    fixture.detectChanges();
    expect(component.activeDetailTab()).toBe('profile');

    component.openTab('job'); // the first required tab is open to everyone
    expect(component.activeDetailTab()).toBe('job');
  });

  it('keeps the last answer when a later check fails, instead of unlocking every tab', () => {
    const { component, fixture, employees } = setup({
      self: false,
      role: 'HR_ADMIN',
      routeId: '7',
      completeness: { ...NOTHING_SAVED, job: true, addresses: true },
    });
    const before = [...component.lockedTabs()];
    expect(before).toContain('bank');

    employees.getCompleteness.mockImplementation(() => throwError(() => new Error('down')));
    component.activeDetailTab.set('addresses');
    fixture.detectChanges();

    expect([...component.lockedTabs()]).toEqual(before);
  });

  it('does not flash every tab as locked before the first answer arrives', () => {
    TestBed.resetTestingModule();
    const { component } = setup({ self: false, role: 'HR_ADMIN', routeId: '7' });

    expect(component.lockedTabs().size).toBeGreaterThan(0); // answered synchronously here
    // Before any answer there is nothing to lock on: a fresh component starts with no locks.
    const fresh = TestBed.createComponent(EmployeeDetail).componentInstance;
    expect(fresh.lockedTabs().size).toBe(0);
  });

  it('opens the tabs up to the first one the server says is empty, and locks the rest', () => {
    const { component } = setup({
      self: false,
      role: 'HR_ADMIN',
      routeId: '7',
      completeness: { ...NOTHING_SAVED, job: true, addresses: true },
    });

    expect([...component.lockedTabs()]).toEqual([
      'bank', 'documents', 'family', 'qualifications', 'experience',
    ]);
  });

  it('asks the server once when the page opens and again when another tab opens, not once per tab', () => {
    const { component, fixture, employees } = setup({ self: false, role: 'HR_ADMIN', routeId: '7' });
    expect(employees.getCompleteness).toHaveBeenCalledTimes(1);
    expect(employees.getCompleteness).toHaveBeenCalledWith(7);

    component.activeDetailTab.set('job');
    fixture.detectChanges();

    expect(employees.getCompleteness).toHaveBeenCalledTimes(2);
  });

  it('locks nobody out when the completeness check fails', () => {
    const { component } = setup({ self: false, role: 'HR_ADMIN', routeId: '7', completenessFails: true });

    expect(component.lockedTabs().size).toBe(0);
  });

  it('never holds an employee up on a tab they cannot add to (HR_MANAGER on another employee)', () => {
    const { component } = setup({ self: false, role: 'HR_MANAGER', routeId: '9' });

    // Every tab is view-only for them (only an HR_ADMIN adds a job, bank account or document, and only the
    // owner edits the rest), so nothing the server reports as empty may hold them up.
    expect(component.canEditRecords()).toBe(false);
    expect(component.lockedTabs().size).toBe(0);
  });

  it('sends the user back to where data is missing when the tab they opened early turns out to be locked', () => {
    const pending = new Subject<{ success: boolean; message: string; statusCode: number; data: EmployeeCompleteness }>();
    const { component, fixture } = setup({ self: false, role: 'HR_ADMIN', routeId: '7', pendingCompleteness: pending });
    component.activeDetailTab.set('bank'); // nothing is locked yet: no answer has arrived
    fixture.detectChanges();
    expect(component.activeDetailTab()).toBe('bank');

    pending.next({ success: true, message: '', statusCode: 200, data: NOTHING_SAVED });
    fixture.detectChanges();

    expect(component.lockedTabs().has('bank')).toBe(true);
    expect(component.activeDetailTab()).toBe('job'); // the first tab whose data is missing
  });

  it('moves the arrow keys from the tab that has the focus, and a locked tab only takes focus', () => {
    const { component, fixture, el } = setup({
      self: false,
      role: 'HR_ADMIN',
      routeId: '7',
      completeness: { ...NOTHING_SAVED, job: true },
    });
    document.body.appendChild(el);
    component.activeDetailTab.set('addresses'); // the first tab with missing data: open; identity onwards locked
    fixture.detectChanges();
    const key = (id: string, name: string) =>
      el.querySelector('#detail-tab-' + id)?.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));

    key('addresses', 'ArrowRight');
    expect(document.activeElement?.id).toBe('detail-tab-identity'); // locked: focused, not opened
    expect(component.activeDetailTab()).toBe('addresses');

    key('identity', 'ArrowLeft'); // from the focused tab, not from the open one
    expect(document.activeElement?.id).toBe('detail-tab-addresses');

    key('addresses', 'ArrowLeft');
    expect(component.activeDetailTab()).toBe('job'); // an unlocked tab is opened
    el.remove();
  });

  it('says why when a locked tab or a waiting Continue is pressed', () => {
    const { component, fixture } = setup({ self: false, role: 'HR_ADMIN', routeId: '7' });
    const open = vi.spyOn(fixture.debugElement.injector.get(MatSnackBar), 'open');

    component.openTab('bank');
    expect(open).toHaveBeenLastCalledWith('employee.detail.tabLocked', 'common.close', { duration: 5000 });

    component.activeDetailTab.set('job');
    fixture.detectChanges();
    component.goToNextTab(); // job has no records yet
    expect(open).toHaveBeenLastCalledWith('employee.detail.continueBlocked', 'common.close', { duration: 5000 });
  });

  it('does not block a tab that has no required data, and offers nothing after the last', () => {
    const everythingSaved: EmployeeCompleteness = {
      job: true, addresses: true, identity: true, bank: true, documents: true,
      family: true, qualifications: true, experience: true,
    };
    const { component, fixture, el } = setup({
      self: false, role: 'HR_ADMIN', routeId: '7', completeness: everythingSaved,
    });
    component.activeDetailTab.set('experience');
    fixture.detectChanges();

    expect(component.nextTab()).toBeNull();
    expect(el.querySelector('.btn-continue')).toBeNull();
  });

  it('marks only the open tab as active, for the tab bar and for screen readers', () => {
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

    el.querySelector<HTMLButtonElement>('.btn-continue')?.click();
    fixture.detectChanges();

    expect(component.activeDetailTab()).toBe('addresses');
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
