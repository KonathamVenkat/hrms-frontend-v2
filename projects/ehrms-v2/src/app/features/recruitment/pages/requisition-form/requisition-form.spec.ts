import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideTranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';

import { RaiseOptions, Requisition } from '../../models/requisition.model';
import { RequisitionService } from '../../services/requisition.service';
import { RequisitionForm } from './requisition-form';

const options: RaiseOptions = {
  departments: [{ id: 1, name: 'Finance' }],
  designations: [
    { id: 11, title: 'Analyst', departmentId: 1 },
    { id: 12, title: 'Other dept', departmentId: 2 },
    { id: 13, title: 'Anywhere' },
  ],
  locations: [{ id: 3, name: 'Juba HQ' }],
};

const ok = <T>(data: T) => of({ success: true, message: '', data, statusCode: 200 });

function saved(): Requisition {
  return { id: 77, code: 'REQ-2026-000077', version: 0 } as Requisition;
}

function setup(
  opts: {
    id?: string;
    options?: RaiseOptions;
    create?: ReturnType<typeof vi.fn>;
    get?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const svc = {
    raiseOptions: vi.fn(() => ok(opts.options ?? options)),
    people: vi.fn(() => ok([{ id: 21, code: 'EMP-1', name: 'Ayen Deng' }])),
    get: opts.get ?? vi.fn(),
    create: opts.create ?? vi.fn(() => ok(saved())),
    update: vi.fn(),
  };
  const snack = { open: vi.fn() };
  TestBed.configureTestingModule({
    imports: [RequisitionForm, NoopAnimationsModule],
    providers: [
      provideTranslateService(),
      provideRouter([]),
      { provide: RequisitionService, useValue: svc },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap(opts.id ? { id: opts.id } : {}) } },
      },
    ],
  });
  TestBed.overrideComponent(RequisitionForm, {
    set: { providers: [{ provide: MatSnackBar, useValue: snack }] },
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(RequisitionForm);
  fixture.detectChanges();
  return {
    fixture,
    component: fixture.componentInstance,
    svc,
    snack,
    navigate,
    el: fixture.nativeElement as HTMLElement,
  };
}

function fillValid(component: RequisitionForm) {
  component.form.patchValue({
    jobTitle: '  Data Analyst ',
    departmentId: 1,
    designationId: 11,
    noOfPositions: 2,
    minExperienceYears: 2,
    priority: 'HIGH',
    justification: ' Team is growing ',
  });
}

describe('RequisitionForm', () => {
  it('tells someone who may raise nothing why, instead of showing a form that cannot be saved', () => {
    const { el, component } = setup({
      options: { departments: [], designations: [], locations: [] },
    });
    expect(component.cannotRaise()).toBe(true);
    expect(el.querySelector('form')).toBeNull();
    expect(el.textContent).toContain('recruitment.form.cannotRaise');
  });

  it('lists only the designations of the chosen department, plus the ones that fit every department', () => {
    const { component } = setup();
    component.form.controls.departmentId.setValue(1);
    expect(component.designations().map((d) => d.id)).toEqual([11, 13]);
  });

  it('loads the people of the department when it is chosen', () => {
    const { component, svc } = setup();
    component.form.controls.departmentId.setValue(1);
    expect(svc.people).toHaveBeenCalledWith(1);
    expect(component.people().map((p) => p.id)).toEqual([21]);
  });

  it('does not send an invalid form and marks the fields so their errors show', () => {
    const { component, svc } = setup();
    component.onSubmit();
    expect(svc.create).not.toHaveBeenCalled();
    expect(component.form.controls.jobTitle.touched).toBe(true);
    expect(component.form.controls.departmentId.hasError('min')).toBe(true);
  });

  it('refuses a replacement without the replaced employee, and a maximum below the minimum', () => {
    const { component } = setup();
    fillValid(component);
    component.form.patchValue({ requisitionType: 'REPLACEMENT', replacedEmployeeId: 0 });
    expect(component.form.hasError('replacedRequired')).toBe(true);
    component.form.patchValue({ requisitionType: 'NEW', minSalary: 900, maxSalary: 100 });
    expect(component.form.hasError('salaryRange')).toBe(true);
  });

  it('sends trimmed text, omits what is not chosen and formats the date in local time', () => {
    const { component, svc } = setup();
    fillValid(component);
    component.form.patchValue({ targetJoinDate: new Date(2099, 0, 5, 23, 59) });
    component.onSubmit();
    expect(svc.create).toHaveBeenCalledTimes(1);
    const payload = svc.create.mock.calls[0][0];
    expect(payload).toMatchObject({
      jobTitle: 'Data Analyst',
      justification: 'Team is growing',
      departmentId: 1,
      designationId: 11,
      targetJoinDate: '2099-01-05',
    });
    expect(payload.locationId).toBeUndefined();
    expect(payload.reportingManagerId).toBeUndefined();
    expect(payload.jobTitleAr).toBeUndefined();
    expect(payload.maxSalary).toBeUndefined();
    expect(payload.version).toBeUndefined();
  });

  it('sends the request once when the button is pressed twice while it is in flight', () => {
    const inFlight = new Subject<never>();
    const { component, svc } = setup({ create: vi.fn(() => inFlight) });
    fillValid(component);
    component.onSubmit();
    component.onSubmit();
    expect(svc.create).toHaveBeenCalledTimes(1);
    expect(component.saving()).toBe(true);
  });

  it('keeps what the user typed and shows a translated message when saving fails', () => {
    const { component } = setup({ create: vi.fn(() => throwError(() => ({ status: 409 }))) });
    fillValid(component);
    component.onSubmit();
    expect(component.error()).toBe('recruitment.errors.stale');
    expect(component.saving()).toBe(false);
    expect(component.form.controls.jobTitle.value).toBe('  Data Analyst ');
  });

  it('warns about unsaved changes only once the form was touched, and not after saving', () => {
    const { component, navigate, snack } = setup();
    expect(component.hasUnsavedChanges()).toBe(false);
    fillValid(component);
    component.form.markAsDirty();
    expect(component.hasUnsavedChanges()).toBe(true);
    component.onSubmit();
    expect(component.hasUnsavedChanges()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/app/recruitment/requisitions', 77]);
    expect(snack.open).toHaveBeenCalled();
  });

  it('will not edit a requisition that is no longer a draft', () => {
    const approved = { id: 5, status: 'APPROVED', version: 2 } as Requisition;
    const { component, el } = setup({ id: '5', get: vi.fn(() => ok(approved)) });
    expect(component.blocked()).toBe('recruitment.errors.rules.REQUISITION_NOT_EDITABLE');
    expect(el.querySelector('form')).toBeNull();
  });

  it('loads a draft into the form and sends its version when saved', () => {
    const draft = {
      id: 5,
      status: 'DRAFT',
      version: 4,
      jobTitle: 'Analyst',
      departmentId: 1,
      designationId: 11,
      noOfPositions: 1,
      employmentType: 'FULL_TIME',
      requisitionType: 'NEW',
      minExperienceYears: 0,
      priority: 'LOW',
    } as Requisition;
    const { component, svc } = setup({ id: '5', get: vi.fn(() => ok(draft)) });
    svc.update.mockReturnValue(ok(saved()));
    expect(component.form.controls.jobTitle.value).toBe('Analyst');
    expect(component.hasUnsavedChanges()).toBe(false); // loading the draft is not an edit
    component.onSubmit();
    expect(svc.update).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ jobTitle: 'Analyst', version: 4 }),
    );
  });
});
