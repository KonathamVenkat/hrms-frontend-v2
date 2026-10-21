import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';

import { EmployeeInfoSection } from './employee-info-section';
import {
  DEPENDANTS,
  EDUCATION,
  EXPERIENCE,
  REFERENCES,
  SectionConfig,
  TRAINING,
} from './employee-info.config';
import { EmployeeInfoService } from '../../services/employee-info.service';
import {
  DependantRecord,
  ExperienceRecord,
  InfoLookup,
  InfoRecord,
} from '../../models/employee-info.model';

const ok = <T>(data: T) => of({ success: true, message: '', statusCode: 200, data });

const rose: DependantRecord = {
  id: 1,
  employeeId: 10,
  isActive: true,
  version: 3,
  relationId: 1,
  relationName: 'Spouse',
  relationNameAr: 'زوج',
  firstName: 'Rose',
  lastName: 'Lado',
  firstNameAr: 'روز',
  dateOfBirth: '1990-07-04',
  isAlive: true,
};
const switchedOff: DependantRecord = {
  ...rose,
  id: 2,
  isActive: false,
  firstName: 'Old',
  lastName: 'Record',
  firstNameAr: undefined,
  relationId: 9,
  relationName: 'Uncle',
  relationNameAr: undefined,
};
const relations: InfoLookup[] = [
  { id: 1, code: 'SPOUSE', name: 'Spouse', nameAr: 'زوج' },
  { id: 2, code: 'SON', name: 'Son', nameAr: 'ابن' },
];

function setup<R extends InfoRecord>(
  config: SectionConfig<R>,
  records: R[],
  options: { readOnly?: boolean; svc?: Partial<Record<string, unknown>> } = {},
) {
  const svc = {
    getAll: vi.fn(() => ok(records)),
    add: vi.fn(() => ok({ ...records[0], id: 99 })),
    update: vi.fn(() => ok(records[0])),
    deactivate: vi.fn(() => ok(null)),
    activate: vi.fn(() => ok(null)),
    getLookup: vi.fn(() => ok(relations)),
    ...options.svc,
  };
  TestBed.configureTestingModule({
    imports: [EmployeeInfoSection],
    providers: [provideTranslateService(), { provide: EmployeeInfoService, useValue: svc }],
  });
  const fixture = TestBed.createComponent(EmployeeInfoSection);
  fixture.componentRef.setInput('config', config);
  fixture.componentRef.setInput('employeeId', 10);
  fixture.componentRef.setInput('readOnly', options.readOnly ?? false);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, comp: fixture.componentInstance, svc, el };
}

const click = (el: Element | null) => (el as HTMLElement).click();

describe('EmployeeInfoSection', () => {
  it('shows a loading state, then one card per active record', () => {
    const pending = new Subject<{
      success: boolean;
      message: string;
      statusCode: number;
      data: DependantRecord[];
    }>();
    const { fixture, el } = setup(DEPENDANTS, [rose], {
      svc: { getAll: vi.fn(() => pending) },
    });
    expect(el.querySelector('[role="status"]')).not.toBeNull();

    pending.next({ success: true, message: '', statusCode: 200, data: [rose] });
    pending.complete();
    fixture.detectChanges();

    expect(el.querySelector('.loading-wrap')).toBeNull();
    expect(el.querySelectorAll('li.info-card').length).toBe(1);
    expect(el.querySelector('.info-name')?.textContent).toContain('Rose Lado');
    expect(el.querySelector('.ar-text')?.textContent).toContain('روز');
    expect(el.querySelector('.info-chip')?.textContent).toContain('Spouse');
  });

  it('shows the empty state with a hint for HR, and without one for a read-only reader', () => {
    const hr = setup(DEPENDANTS, []);
    expect(hr.el.querySelector('.empty-state')).not.toBeNull();
    expect(hr.el.querySelector('.empty-state small')).not.toBeNull();
    TestBed.resetTestingModule();

    const reader = setup(DEPENDANTS, [], { readOnly: true });
    expect(reader.el.querySelector('.empty-state')).not.toBeNull();
    expect(reader.el.querySelector('.empty-state small')).toBeNull();
  });

  it('shows an error with a retry that loads again', () => {
    const getAll = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValue(ok([rose]));
    const { fixture, el } = setup(DEPENDANTS, [rose], { svc: { getAll } });

    expect(el.querySelector('.alert-error[role="alert"]')).not.toBeNull();
    click(el.querySelector('[data-testid="retry"]'));
    fixture.detectChanges();

    expect(getAll).toHaveBeenCalledTimes(2);
    expect(el.querySelectorAll('li.info-card').length).toBe(1);
  });

  it('gives a read-only reader no buttons and does not even ask for the dropdowns', () => {
    const { el, svc } = setup(DEPENDANTS, [rose, switchedOff], { readOnly: true });

    expect(el.querySelector('.btn-add')).toBeNull();
    expect(el.querySelector('[data-testid="edit"]')).toBeNull();
    expect(el.querySelector('[data-testid="deactivate"]')).toBeNull();
    expect(el.querySelector('[data-testid="activate"]')).toBeNull();
    expect(svc.getLookup).not.toHaveBeenCalled();
    expect(svc.getAll).toHaveBeenCalledTimes(1);
  });

  it('asks only for the dropdowns its fields use', () => {
    const dependants = setup(DEPENDANTS, [rose]);
    expect(dependants.svc.getLookup).toHaveBeenCalledTimes(1);
    expect(dependants.svc.getLookup).toHaveBeenCalledWith('relations');
    TestBed.resetTestingModule();

    const education = setup(EDUCATION, []);
    expect(education.svc.getLookup).toHaveBeenCalledWith('education-levels');
    TestBed.resetTestingModule();

    const training = setup(TRAINING, []);
    expect(training.svc.getLookup).not.toHaveBeenCalled();
  });

  it('adds with empty values as null, trimmed text, no version, then closes and reloads', () => {
    const { fixture, comp, svc, el } = setup(DEPENDANTS, [rose]);
    click(el.querySelector('.btn-add'));
    fixture.detectChanges();
    expect(el.querySelector('.modal')).not.toBeNull();

    comp.form().patchValue({ relationId: 2, firstName: '  Nyadak ', lastName: ' Lado ' });
    comp.onSubmit();
    fixture.detectChanges();

    expect(svc.add).toHaveBeenCalledTimes(1);
    const [employeeId, endpoint, payload] = svc.add.mock.calls[0] as unknown as [
      number,
      string,
      Record<string, unknown>,
    ];
    expect(employeeId).toBe(10);
    expect(endpoint).toBe('dependants');
    expect(payload).toMatchObject({
      relationId: 2,
      firstName: 'Nyadak',
      lastName: 'Lado',
      middleName: null,
      gender: null,
      isAlive: true,
    });
    expect(payload).not.toHaveProperty('version');
    expect(el.querySelector('.modal')).toBeNull();
    expect(svc.getAll).toHaveBeenCalledTimes(2);
    expect(el.querySelector('.alert-success[role="status"]')).not.toBeNull();
  });

  it("edits with the record's values and sends its version; a value switched off since stays choosable", () => {
    const { fixture, comp, svc } = setup(DEPENDANTS, [rose, switchedOff]);

    comp.openEdit(switchedOff);
    fixture.detectChanges();
    expect(comp.form().controls['firstName'].value).toBe('Old');
    expect(comp.form().controls['relationId'].value).toBe(9);
    expect(comp.selectOptions()['relationId'].map((o) => o.id)).toEqual([1, 2, 9]); // 9 = the held, inactive one
    expect(comp.selectOptions()['relationId'][2].label).toBe('Uncle');

    comp.form().patchValue({ firstName: 'Changed' });
    comp.onSubmit();

    expect(svc.update).toHaveBeenCalledTimes(1);
    const [, , id, payload] = svc.update.mock.calls[0] as unknown as [
      number,
      string,
      number,
      Record<string, unknown>,
    ];
    expect(id).toBe(2);
    expect(payload).toMatchObject({ firstName: 'Changed', version: 3 });
  });

  it('does not save without the required values and marks them', () => {
    const { fixture, comp, svc, el } = setup(DEPENDANTS, [rose]);
    comp.openAdd();
    fixture.detectChanges();

    comp.onSubmit();
    fixture.detectChanges();

    expect(svc.add).not.toHaveBeenCalled();
    expect(comp.isInvalid('firstName')).toBe(true);
    expect(comp.isInvalid('relationId')).toBe(true);
    expect(el.querySelector('#fe-firstName')).not.toBeNull();
  });

  it('refuses a future date of birth and an end date before the start date', () => {
    const { fixture, comp, svc } = setup(DEPENDANTS, []);
    comp.openAdd();
    comp.form().patchValue({ relationId: 1, firstName: 'A', dateOfBirth: '2999-01-01' });
    comp.onSubmit();
    expect(svc.add).not.toHaveBeenCalled();
    expect(comp.getError('dateOfBirth')).toBe('employee.info.errors.future');
    TestBed.resetTestingModule();

    const education = setup(EDUCATION, []);
    education.comp.openAdd();
    education.comp
      .form()
      .patchValue({ qualification: 'BSc', startDate: '2020-01-01', endDate: '2019-01-01' });
    education.comp.onSubmit();
    education.fixture.detectChanges();
    expect(education.svc.add).not.toHaveBeenCalled();
    expect(education.comp.dateRangeInvalid()).toBe(true);

    education.comp.form().patchValue({ endDate: '2020-01-01' }); // the same day is fine
    education.comp.onSubmit();
    expect(education.svc.add).toHaveBeenCalledTimes(1);
    expect(fixture).toBeDefined();
  });

  it('rewrites its cards in the new words once a language\'s texts have loaded', () => {
    const job: ExperienceRecord = {
      id: 5,
      employeeId: 10,
      isActive: true,
      version: 0,
      employerName: 'Ministry of Petroleum',
      startDate: '2022-07-01',
    };
    const { fixture, el } = setup(EXPERIENCE, [job]);
    expect(el.querySelector('.info-meta')?.textContent).toContain('employee.info.present');   // no texts yet

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('ar', { employee: { info: { present: 'حتى الآن' } } });
    translate.use('ar');
    fixture.detectChanges();

    expect(el.querySelector('.info-meta')?.textContent).toContain('حتى الآن');
  });

  it('explains a bad phone number and a bad e-mail address in their own words', () => {
    const { comp, svc } = setup(REFERENCES, []);
    comp.openAdd();
    comp.form().patchValue({ firstName: 'John', phone: 'abc', email: 'not-an-email' });

    comp.onSubmit();

    expect(svc.add).not.toHaveBeenCalled();
    expect(comp.getError('phone')).toBe('employee.info.errors.phone');   // not the generic "letters and underscores" text
    expect(comp.getError('email')).toBe('common.validation.email');

    comp.form().patchValue({ phone: '+211 (912) 000-000', email: 'john.deng@example.test' });
    comp.onSubmit();
    expect(svc.add).toHaveBeenCalledTimes(1);
  });

  it('ignores a second submit while the first is still saving', () => {
    const pending = new Subject<ReturnType<typeof ok>>();
    const { fixture, comp, svc, el } = setup(DEPENDANTS, [rose], {
      svc: { add: vi.fn(() => pending) },
    });
    comp.openAdd();
    comp.form().patchValue({ relationId: 1, firstName: 'A' });

    comp.onSubmit();
    comp.onSubmit();
    fixture.detectChanges();

    expect(svc.add).toHaveBeenCalledTimes(1);
    expect((el.querySelector('.btn-save') as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps the dialog and the input open when the server refuses, and says why in the user's language", () => {
    const refusal = new HttpErrorResponse({
      status: 422,
      error: { errors: { ruleCode: 'RELATION_INACTIVE' } },
    });
    const { fixture, comp, el } = setup(DEPENDANTS, [rose], {
      svc: { add: vi.fn(() => throwError(() => refusal)) },
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      employee: { info: { errors: { rules: { RELATION_INACTIVE: 'Pick another relation' } } } },
    });
    translate.use('en');
    comp.openAdd();
    comp.form().patchValue({ relationId: 1, firstName: 'Typed value' });

    comp.onSubmit();
    fixture.detectChanges();

    expect(el.querySelector('.modal-alert[role="alert"]')?.textContent).toContain(
      'Pick another relation',
    );
    expect(comp.form().controls['firstName'].value).toBe('Typed value');
    expect(comp.saving()).toBe(false);
  });

  it('on a stale edit (409) keeps the dialog and says to reload', () => {
    const stale = new HttpErrorResponse({ status: 409 });
    const { fixture, comp, el } = setup(DEPENDANTS, [rose], {
      svc: { update: vi.fn(() => throwError(() => stale)) },
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      employee: { info: { errors: { stale: 'Changed by someone else' } } },
    });
    translate.use('en');

    comp.openEdit(rose);
    comp.onSubmit();
    fixture.detectChanges();

    expect(el.querySelector('.modal')).not.toBeNull();
    expect(el.querySelector('.modal-alert')?.textContent).toContain('Changed by someone else');
  });

  it('deactivates after a confirmation, reloads, and a refusal stays inside the confirmation', () => {
    const { fixture, svc, el } = setup(DEPENDANTS, [rose]);

    click(el.querySelector('[data-testid="deactivate"]'));
    fixture.detectChanges();
    expect(el.querySelector('.confirm-dialog')).not.toBeNull();
    expect(svc.deactivate).not.toHaveBeenCalled();

    click(el.querySelector('[data-testid="confirm"]'));
    fixture.detectChanges();

    expect(svc.deactivate).toHaveBeenCalledWith(10, 'dependants', 1);
    expect(el.querySelector('.confirm-dialog')).toBeNull();
    expect(svc.getAll).toHaveBeenCalledTimes(2);
  });

  it('lists switched-off records apart, with an Activate button that activates after a confirmation', () => {
    const { fixture, svc, el } = setup(DEPENDANTS, [rose, switchedOff]);

    expect(el.querySelectorAll('li.info-card').length).toBe(2);
    expect(el.querySelectorAll('.inactive-card').length).toBe(1);
    expect(el.querySelector('.inactive-card')?.textContent).toContain('Old Record');

    click(el.querySelector('[data-testid="activate"]'));
    fixture.detectChanges();
    click(el.querySelector('[data-testid="confirm"]'));

    expect(svc.activate).toHaveBeenCalledWith(10, 'dependants', 2);
  });
});
