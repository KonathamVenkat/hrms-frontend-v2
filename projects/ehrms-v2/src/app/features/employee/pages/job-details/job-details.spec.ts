import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { JobDetailsComponent } from './job-details';
import { JobDetailsService } from '../../services/job-details.service';
import { EmployeeService } from '../../services/employee';
import { WorkShiftService } from '../../../admin/work-shifts/services/work-shift';
import { OfficeLocationService } from '../../../admin/office-locations/services/office-location';
import { DesignationLookup, SectionLookup } from '../../models/employee';
import { JobDetails } from '../../models/job-details.model';

const reply = <T>(data: T) => of({ success: true, message: '', statusCode: 200, data });

const accountant: DesignationLookup = {
  id: 20,
  code: 'ACC',
  title: 'Senior Accountant',
  titleAr: 'x',
  gradeLevel: 'P2',
  professionId: 7,
  departmentId: 10,
};
const clerk: DesignationLookup = {
  id: 21,
  code: 'CLK',
  title: 'Clerk',
  titleAr: 'x',
  gradeLevel: 'S1',
  departmentId: 10,
};

const geology: SectionLookup = { id: 50, code: 'SEC-1', name: 'Geology', nameAr: 'x', departmentId: 10 };
const survey: SectionLookup = { id: 51, code: 'SEC-2', name: 'Survey', nameAr: 'x', departmentId: 10 };

function setup() {
  const jobSvc = {
    getCurrentJob: vi.fn(() => reply(null)),
    getJobHistory: vi.fn(() => reply([])),
    assignJob: vi.fn(() => reply({})),
    updateCurrentJob: vi.fn(() => reply({})),
  };
  const empSvc = {
    getDepartments: vi.fn(() => reply([])),
    getDesignations: vi.fn(() => reply([accountant, clerk])),
    getProfessions: vi.fn(() =>
      reply([
        { id: 7, code: 'ACC', name: 'Accountant', nameAr: 'x' },
        { id: 8, code: 'ENG', name: 'Engineer', nameAr: 'x' },
      ]),
    ),
    getSpecializations: vi.fn(() => reply([{ id: 3, code: 'COST', name: 'Cost accounting', nameAr: 'x' }])),
    getContractTypes: vi.fn(() => reply([{ id: 4, code: 'PERM', name: 'Permanent', nameAr: 'x' }])),
    getDepartmentManagers: vi.fn(() => reply([])),
    getSectionsByDepartment: vi.fn(() => reply([geology, survey])),
  };
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService(),
      { provide: JobDetailsService, useValue: jobSvc },
      { provide: EmployeeService, useValue: empSvc },
      { provide: WorkShiftService, useValue: { getActive: () => reply([]) } },
      { provide: OfficeLocationService, useValue: { getActive: () => reply([]) } },
    ],
  });
  const fixture = TestBed.createComponent(JobDetailsComponent);
  fixture.componentRef.setInput('employeeId', 5);
  const comp = fixture.componentInstance;
  // Not rendered: the form logic is tested without the child cards.
  comp.ngOnInit();
  return { comp, jobSvc, empSvc };
}

function fill(comp: JobDetailsComponent, designationId: number) {
  comp.openNewAssignment();
  comp.form.patchValue({ departmentId: 10 });
  comp.form.patchValue({
    designationId,
    locationId: 30,
    effectiveFrom: '2026-10-28',
  });
}

describe('JobDetailsComponent profession', () => {
  it('loads the profession list', () => {
    const { comp, empSvc } = setup();
    expect(empSvc.getProfessions).toHaveBeenCalledTimes(1);
    expect(comp.professions().map((p) => p.name)).toEqual(['Accountant', 'Engineer']);
  });

  it('defaults the profession from the chosen designation, and clears it for one without', () => {
    const { comp } = setup();
    fill(comp, 20);
    expect(comp.form.controls.professionId.value).toBe(7);

    comp.form.controls.designationId.setValue(21);
    expect(comp.form.controls.professionId.value).toBeNull();
  });

  it('refuses a profession that differs from the designation and says why', () => {
    const { comp, jobSvc } = setup();
    fill(comp, 20);
    comp.form.controls.professionId.setValue(8);
    comp.form.controls.professionId.markAsTouched();

    expect(comp.form.controls.professionId.hasError('professionMismatch')).toBe(true);
    expect(comp.isInvalid('professionId')).toBe(true);
    comp.onSubmit();
    expect(jobSvc.assignJob).not.toHaveBeenCalled();
  });

  it('allows any profession when the designation has none, and sends it', () => {
    const { comp, jobSvc } = setup();
    fill(comp, 21);
    comp.form.controls.professionId.setValue(8);

    expect(comp.form.controls.professionId.valid).toBe(true);
    comp.onSubmit();
    expect(jobSvc.assignJob).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ designationId: 21, professionId: 8 }),
    );
  });

  it('sends the defaulted profession of a new assignment', () => {
    const { comp, jobSvc } = setup();
    fill(comp, 20);
    comp.onSubmit();

    expect(jobSvc.assignJob).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ designationId: 20, professionId: 7 }),
    );
  });

  it('shows the current profession when editing, locked, and keeps sending it', () => {
    const { comp, jobSvc } = setup();
    comp.currentJob.set({
      jobDetailsId: 1,
      employeeId: 5,
      departmentId: 10,
      designationId: 20,
      professionId: 7,
      locationId: 30,
      workMode: 'ON_SITE',
      effectiveFrom: '2026-01-01',
      isCurrent: true,
    } as JobDetails);
    comp.openEditCurrent();

    expect(comp.form.controls.professionId.value).toBe(7);
    expect(comp.form.controls.professionId.disabled).toBe(true);
    comp.onSubmit();
    expect(jobSvc.updateCurrentJob).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ professionId: 7 }),
    );
  });
  it('lets an empty profession of the current record be filled in, defaulting from the designation', async () => {
    const { comp, jobSvc } = setup();
    comp.currentJob.set({
      jobDetailsId: 1,
      employeeId: 5,
      departmentId: 10,
      designationId: 20,
      locationId: 30,
      workMode: 'ON_SITE',
      effectiveFrom: '2026-01-01',
      isCurrent: true,
    } as JobDetails);
    comp.openEditCurrent();

    expect(comp.form.controls.professionId.disabled).toBe(false);
    expect(comp.form.controls.professionId.value).toBe(7);
    comp.onSubmit();
    expect(jobSvc.updateCurrentJob).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ professionId: 7 }),
    );
  });
});

describe('JobDetailsComponent section', () => {
  it('lists the sections of the chosen department and clears the choice when the department changes', () => {
    const { comp, empSvc } = setup();
    fill(comp, 20);
    expect(empSvc.getSectionsByDepartment).toHaveBeenCalledWith(10);
    expect(comp.sections().map((s) => s.name)).toEqual(['Geology', 'Survey']);

    comp.form.controls.sectionId.setValue(50);
    comp.form.controls.departmentId.setValue(11);
    expect(comp.form.controls.sectionId.value).toBeNull();
  });

  it('sends the chosen section, and null when none is chosen', () => {
    const { comp, jobSvc } = setup();
    fill(comp, 20);
    comp.onSubmit();
    expect(jobSvc.assignJob).toHaveBeenLastCalledWith(5, expect.objectContaining({ sectionId: null }));

    comp.form.controls.sectionId.setValue(51);
    comp.onSubmit();
    expect(jobSvc.assignJob).toHaveBeenLastCalledWith(5, expect.objectContaining({ sectionId: 51 }));
  });

  it('locks a saved section while editing the current record, and still sends it', () => {
    const { comp, jobSvc } = setup();
    comp.currentJob.set({
      jobDetailsId: 1,
      employeeId: 5,
      departmentId: 10,
      designationId: 20,
      sectionId: 50,
      locationId: 30,
      workMode: 'ON_SITE',
      effectiveFrom: '2026-01-01',
    } as JobDetails);
    comp.openEditCurrent();

    expect(comp.form.controls.sectionId.disabled).toBe(true);
    comp.onSubmit();
    expect(jobSvc.updateCurrentJob).toHaveBeenCalledWith(5, expect.objectContaining({ sectionId: 50 }));
  });

  it('lets an empty section be filled in while editing the current record', () => {
    const { comp } = setup();
    comp.currentJob.set({
      jobDetailsId: 1,
      employeeId: 5,
      departmentId: 10,
      designationId: 20,
      locationId: 30,
      workMode: 'ON_SITE',
      effectiveFrom: '2026-01-01',
    } as JobDetails);
    comp.openEditCurrent();

    expect(comp.form.controls.sectionId.enabled).toBe(true);
  });

  it('loads the specialization and contract type lists once', () => {
    const { comp, empSvc } = setup();

    expect(empSvc.getSpecializations).toHaveBeenCalledTimes(1);
    expect(empSvc.getContractTypes).toHaveBeenCalledTimes(1);
    expect(comp.specializations().map((s) => s.name)).toEqual(['Cost accounting']);
    expect(comp.contractTypes().map((c) => c.name)).toEqual(['Permanent']);
  });

  it('sends the appointment fields trimmed, and null for an empty choice or date', () => {
    const { comp, jobSvc } = setup();
    fill(comp, 21);
    comp.form.patchValue({ specializationId: 3, afe: ' AFE9 ', currentWorkAddress: ' Block 3 ' });
    comp.onSubmit();

    expect(jobSvc.assignJob).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        specializationId: 3,
        contractTypeId: null,
        contractStartDate: null,
        contractEndDate: null,
        afe: 'AFE9',
        formRequestNo: '',
        currentWorkAddress: 'Block 3',
      }),
    );
  });

  it('refuses a contract that ends before it starts, says why, and sends nothing', () => {
    const { comp, jobSvc } = setup();
    fill(comp, 21);
    comp.form.patchValue({ contractStartDate: '2026-05-02', contractEndDate: '2026-05-01' });
    comp.form.controls.contractEndDate.markAsTouched();

    expect(comp.form.controls.contractEndDate.hasError('contractEndBeforeStart')).toBe(true);
    expect(comp.isInvalid('contractEndDate')).toBe(true);
    comp.onSubmit();
    expect(jobSvc.assignJob).not.toHaveBeenCalled();

    // Moving the start back makes the end valid again without touching the end field.
    comp.form.controls.contractStartDate.setValue('2026-04-01');
    expect(comp.form.controls.contractEndDate.valid).toBe(true);
  });

  it('accepts a contract that ends the day it starts', () => {
    const { comp } = setup();
    fill(comp, 21);
    comp.form.patchValue({ contractStartDate: '2026-05-01', contractEndDate: '2026-05-01' });

    expect(comp.form.controls.contractEndDate.valid).toBe(true);
  });

  it('refuses a work phone with letters and a value over the lengths the backend allows', () => {
    const { comp, jobSvc } = setup();
    fill(comp, 21);
    comp.form.patchValue({ currentWorkPhone: '12ab', afe: 'x'.repeat(31), currentWorkAddress: 'y'.repeat(301) });

    expect(comp.form.controls.currentWorkPhone.hasError('pattern')).toBe(true);
    expect(comp.form.controls.afe.hasError('maxlength')).toBe(true);
    expect(comp.form.controls.currentWorkAddress.hasError('maxlength')).toBe(true);
    comp.onSubmit();
    expect(jobSvc.assignJob).not.toHaveBeenCalled();
  });

  it('fills the appointment fields from the current record when editing, and sends them back', () => {
    const { comp, jobSvc } = setup();
    comp.currentJob.set({
      jobDetailsId: 1,
      employeeId: 5,
      departmentId: 10,
      designationId: 20,
      locationId: 30,
      workMode: 'ON_SITE',
      effectiveFrom: '2026-01-01',
      specializationId: 3,
      contractTypeId: 4,
      contractStartDate: '2026-01-01',
      contractEndDate: '2026-12-31',
      afe: 'A1',
      currentWorkPhone: '+249 123',
    } as JobDetails);
    comp.openEditCurrent();

    expect(comp.form.controls.specializationId.value).toBe(3);
    expect(comp.form.controls.contractEndDate.value).toBe('2026-12-31');
    expect(comp.form.controls.afe.value).toBe('A1');
    comp.onSubmit();
    expect(jobSvc.updateCurrentJob).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ specializationId: 3, contractTypeId: 4, contractEndDate: '2026-12-31', afe: 'A1', currentWorkPhone: '+249 123' }),
    );
  });
});

describe('JobDetailsComponent version and text checks', () => {
  const current = {
    jobDetailsId: 1,
    employeeId: 5,
    departmentId: 10,
    designationId: 20,
    locationId: 30,
    workMode: 'ON_SITE',
    effectiveFrom: '2026-01-01',
    isCurrent: true,
    version: 4,
  } as JobDetails;

  it('sends the version the screen was opened with when editing the current job', () => {
    const { comp, jobSvc } = setup();
    comp.currentJob.set(current);
    comp.openEditCurrent();
    comp.onSubmit();
    expect(jobSvc.updateCurrentJob).toHaveBeenCalledWith(5, expect.objectContaining({ version: 4 }));
  });

  it('sends no version with a new assignment', () => {
    const { comp, jobSvc } = setup();
    comp.currentJob.set(current);
    fill(comp, 20);
    comp.onSubmit();
    expect(jobSvc.assignJob).toHaveBeenCalledWith(5, expect.not.objectContaining({ version: 4 }));
  });

  it('refuses hidden characters in remarks and the position id, but allows line breaks in remarks', () => {
    const { comp } = setup();
    comp.currentJob.set(current);
    comp.openEditCurrent();
    comp.form.controls.remarks.setValue('first line\nsecond line');
    expect(comp.form.controls.remarks.valid).toBe(true);
    comp.form.controls.remarks.setValue('hidden\u200Btext');
    expect(comp.form.controls.remarks.hasError('controlChars')).toBe(true);
    comp.form.controls.jobPositionId.setValue('P-1\u200B');
    expect(comp.form.controls.jobPositionId.hasError('controlChars')).toBe(true);
  });
});
